import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime

PAGE_URL = "https://framtidennord.no/index.php/det-skjer/kommende-arrangementer/"
BASE_URL = "https://framtidennord.no"

MONTHS_NO = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "mai": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "okt": 10, "nov": 11, "des": 12,
}

BG_RE = re.compile(r"background-image:\s*url\(([^)]+)\)")


def _bg_image(style: str) -> str | None:
    m = BG_RE.search(style or "")
    if not m:
        return None
    url = m.group(1).strip("'\"")
    return (BASE_URL + url) if url.startswith("/") else url


def scrape() -> list[dict]:
    resp = requests.get(
        PAGE_URL,
        timeout=30,
        headers={"User-Agent": "tromso-events-aggregator/1.0"},
    )
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    events = []
    seen = set()

    for ev in soup.find_all("div", class_="ic-list-event"):
        # Location filter: skip if explicitly non-Tromsø
        place_el = ev.find("div", class_="ic-place")
        place = place_el.get_text(strip=True) if place_el else ""
        if place and "tromsø" not in place.lower():
            continue

        # Date
        day_el = ev.find("div", class_="ic-day")
        month_el = ev.find("div", class_="ic-month")
        year_el = ev.find("div", class_="ic-year")
        time_el = ev.find("span", class_="ic-single-starttime")
        if not (day_el and month_el and year_el and time_el):
            continue

        month = MONTHS_NO.get(month_el.get_text(strip=True).lower())
        if not month:
            continue
        try:
            dt = datetime(
                int(year_el.get_text(strip=True)),
                month,
                int(day_el.get_text(strip=True)),
                *map(int, time_el.get_text(strip=True).split(":")),
            )
        except ValueError:
            continue

        # Title and URL — the h2 anchor, not the date-box wrapper
        h2 = ev.find("h2")
        title_a = h2.find("a") if h2 else None
        if not title_a:
            continue
        title = title_a.get_text(strip=True)
        href = title_a.get("href", "")
        url = (BASE_URL + href) if href.startswith("/") else href

        # UID from href path slug + datetime (same event recurs on different dates)
        slug = href.rstrip("/").rsplit("/", 2)[-2].split("-")[0]  # numeric ID
        uid = f"framtidennord-{slug}-{dt.strftime('%Y%m%dT%H%M')}@framtidennord.no"

        if uid in seen:
            continue
        seen.add(uid)

        # Image from ic-box-date background-image style
        box = ev.find("div", class_="ic-box-date")
        image = _bg_image(box.get("style", "") if box else "")

        venue = place if place else "Tromsø"

        events.append({
            "uid": uid,
            "title": title,
            "url": url,
            "start": dt,
            "venue": venue,
            "source": "framtidennord",
            "time_inferred": False,
            "image": image,
        })

    return events
