import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime

PAGE_URL = "https://pintofscienceno.wixsite.com/norway/pint26-program/troms%C3%B8"

DATE_RE = re.compile(r"(\d{2}/\d{2}/\d{2}),\s*(\d{2}:\d{2})")


def scrape() -> list[dict]:
    resp = requests.get(
        PAGE_URL,
        timeout=30,
        headers={"User-Agent": "Mozilla/5.0 (compatible; tromso-events-aggregator/1.0)"},
    )
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    events = []
    for card in soup.find_all("div", class_="wH18kY"):
        h2 = card.find("h2")
        if not h2:
            continue

        # Collect paragraphs with date matches — skip the aggregate card (multiple dates)
        date_paras = [p for p in card.find_all("p") if DATE_RE.search(p.get_text())]
        if len(date_paras) != 1:
            continue

        title = h2.get_text(strip=True)
        date_text = date_paras[0].get_text(strip=True)
        m = DATE_RE.search(date_text)
        dt = datetime.strptime(f"{m.group(1)}, {m.group(2)}", "%d/%m/%y, %H:%M")

        # Venue is the first non-date, non-description paragraph after the date
        all_paras = card.find_all("p")
        date_idx = all_paras.index(date_paras[0])
        venue = all_paras[date_idx + 1].get_text(strip=True) if date_idx + 1 < len(all_paras) else "Tromsø"

        # First unique link in the card
        links = [a["href"] for a in card.find_all("a", href=True)]
        url = links[0] if links else PAGE_URL

        uid = f"pintofsciencetromso-{dt.strftime('%Y%m%dT%H%M')}@pintofscienceno.wixsite.com"

        events.append({
            "uid": uid,
            "title": title,
            "url": url,
            "start": dt,
            "venue": venue,
            "source": "pintofsciencetromso",
            "time_inferred": False,
            "image": None,
        })

    return events
