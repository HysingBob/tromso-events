import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime

PAGE_URL = "https://uit.no/tavla"

DATE_RE = re.compile(r"(\d{2}\.\d{2}\.\d{2})\s+(\d{2}:\d{2})")


def _text_after_strong(container, label: str) -> str:
    for div in container.find_all("div", recursive=False):
        strong = div.find("strong")
        if strong and strong.get_text(strip=True) == label:
            return div.get_text(strip=True).removeprefix(label).strip()
    return ""


def scrape() -> list[dict]:
    resp = requests.get(
        PAGE_URL,
        timeout=30,
        headers={"User-Agent": "tromso-events-aggregator/1.0"},
    )
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    events = []
    for item in soup.find_all("div", class_="grid-item"):
        link = item.find("a", href=True)
        if not link:
            continue

        title_span = item.find("span", class_="ul-uit")
        if not title_span:
            continue
        title = title_span.get_text(strip=True)

        card_text = item.find_all("div", class_="tavla-card-text")
        # The second tavla-card-text block holds Hvor/Sted/Tid
        meta = card_text[1] if len(card_text) > 1 else (card_text[0] if card_text else None)
        if not meta:
            continue

        sted = _text_after_strong(meta, "Sted:")
        if "tromsø" not in sted.lower():
            continue

        tid = _text_after_strong(meta, "Tid:")
        m = DATE_RE.search(tid)
        if not m:
            continue
        dt = datetime.strptime(f"{m.group(1)} {m.group(2)}", "%d.%m.%y %H:%M")

        hvor = _text_after_strong(meta, "Hvor:")
        venue = f"{hvor}, UiT Tromsø" if hvor else "UiT Tromsø"

        img_tag = item.find("img", class_="tavla-small")
        image = img_tag["src"] if img_tag and img_tag.get("src") else None

        url = link["href"]
        slug = url.rstrip("/").split("/")[-2]  # artikkel ID from .../artikkel/927558/title
        uid = f"uit-{slug}@uit.no"

        events.append({
            "uid": uid,
            "title": title,
            "url": url,
            "start": dt,
            "venue": venue,
            "source": "uit",
            "time_inferred": False,
            "image": image,
        })

    return events
