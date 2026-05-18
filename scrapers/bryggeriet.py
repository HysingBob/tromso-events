import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime

BASE_URL = "https://www.bryggerietscene.no"
PROGRAM_URL = BASE_URL + "/program"

HEADERS = {"User-Agent": "tromso-events-aggregator/1.0"}


def scrape() -> list[dict]:
    try:
        resp = requests.get(PROGRAM_URL, timeout=20, headers=HEADERS)
        resp.raise_for_status()
    except Exception as e:
        print(f"bryggeriet: fetch failed: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    events = []

    for article in soup.find_all("article", class_="eventlist-event"):
        # Title + URL
        title_a = article.find("a", class_="eventlist-title-link")
        if not title_a:
            continue
        title = title_a.get_text(strip=True)
        href = title_a.get("href", "")
        url = BASE_URL + href if href.startswith("/") else href

        # Date — use datetime attribute for clean ISO date
        date_el = article.find("time", class_="event-date")
        if not date_el:
            continue
        date_str = date_el.get("datetime", "")
        try:
            date = datetime.fromisoformat(date_str).date()
        except (ValueError, TypeError):
            continue

        # Start time — text like "17:00"
        time_el = article.find("time", class_="event-time-localized-start")
        hour, minute = 19, 0
        time_inferred = True
        if time_el:
            time_text = time_el.get_text(strip=True)
            m = re.match(r"(\d{1,2}):(\d{2})", time_text)
            if m:
                hour, minute = int(m.group(1)), int(m.group(2))
                time_inferred = False

        try:
            dt = datetime(date.year, date.month, date.day, hour, minute)
        except ValueError:
            continue

        # Image
        thumb_a = article.find("a", class_="eventlist-column-thumbnail")
        image = None
        if thumb_a:
            img = thumb_a.find("img")
            if img:
                src = img.get("data-src") or img.get("src") or ""
                if src and not src.startswith("data:"):
                    image = BASE_URL + src if src.startswith("/") else src

        slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
        uid = f"bryggeriet-{dt.strftime('%Y%m%dT%H%M')}-{slug}@bryggerietscene.no"

        events.append({
            "uid": uid,
            "title": title,
            "url": url,
            "start": dt,
            "venue": "Bryggeriet Scene, Tromsø",
            "source": "bryggeriet",
            "image": image,
            "time_inferred": time_inferred,
        })

    return events
