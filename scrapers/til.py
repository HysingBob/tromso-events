import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime

PROGRAM_URL = "https://www.til.no/terminliste"
TIL_IMAGE   = "https://www.til.no/terminliste/_/image/10515ecf-056c-43d9-8968-c7be73390ce2:263f1e9ce5a841f03052f0bd240abf553eb37266/width-1200/TIL_one_RGB.png"

# "25.05. 2026 17:00" — trailing dot + space before year
DATE_RE = re.compile(r"(\d{2})\.(\d{2})\.\s+(\d{4})\s+(\d{2}):(\d{2})")


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

    for row in soup.find_all("tr"):
        if "schedule__match" not in " ".join(row.get("class", [])):
            continue

        teams_td = row.find("td", class_="schedule__match__item--teams")
        date_td = row.find("td", class_="schedule__match__item--date")
        if not teams_td or not date_td:
            continue

        teams_text = teams_td.get_text(" ", strip=True)
        if not teams_text.startswith("Tromsø"):
            continue

        opponent = teams_text.split(" - ", 1)[-1].strip()
        dt = _parse_date(date_td.get_text(" ", strip=True))
        if not dt:
            continue

        venue_td = row.find("td", class_="schedule__match__item--venue")
        venue = (venue_td.get_text(strip=True) if venue_td else "") or "Romssa Arena"

        slug = re.sub(r"[^a-z0-9]+", "-", opponent.lower()).strip("-")
        uid = f"til-{dt.strftime('%Y%m%dT%H%M')}-{slug}@til.no"

        events.append({
            "uid": uid,
            "title": f"TIL — {opponent}",
            "url": PROGRAM_URL,
            "start": dt,
            "venue": venue,
            "source": "til",
            "image": TIL_IMAGE,
        })

    return events
