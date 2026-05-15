import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta

PROGRAM_URL = "https://www.halogalandteater.no/forestillinger"
BASE_URL = "https://www.halogalandteater.no"

# "fre 15.05.2026 19:30" — day abbreviation prefix, then DD.MM.YYYY HH:MM
DATE_RE = re.compile(r"(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})")


def _parse_date(text: str) -> datetime | None:
    m = DATE_RE.search(text)
    if not m:
        return None
    day, month, year, hour, minute = m.groups()
    try:
        return datetime(int(year), int(month), int(day), int(hour), int(minute))
    except ValueError:
        return None


def scrape() -> list[dict]:
    resp = requests.get(
        PROGRAM_URL,
        timeout=30,
        headers={"User-Agent": "tromso-events-aggregator/1.0"},
    )
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    events = []

    for article in soup.find_all("article", class_=re.compile(r"node--production--teaser")):
        title_a = article.select_one("div.field--name-title h4 a")
        if not title_a:
            continue

        title = title_a.get_text(strip=True)
        url = BASE_URL + title_a["href"] if title_a["href"].startswith("/") else title_a["href"]
        slug = title_a["href"].rstrip("/").rsplit("/", 1)[-1]

        next_show_el = article.select_one("div.field--name-production-next-show-date div.field__item")
        if not next_show_el:
            continue

        dt = _parse_date(next_show_el.get_text(strip=True))
        if not dt:
            continue

        uid = f"{slug}-{dt.strftime('%Y%m%dT%H%M')}@halogalandteater.no"
        events.append({
            "uid": uid,
            "title": title,
            "url": url,
            "start": dt,
            "venue": "Hålogaland Teater",
            "source": "halogalandteater",
        })

    return events
