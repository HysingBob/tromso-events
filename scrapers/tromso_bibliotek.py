import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime

PAGE_URL = "https://tromso.kommune.no/bibliotek/kalender"
BASE_URL = "https://tromso.kommune.no"

MONTHS_NO = {
    "januar": 1, "februar": 2, "mars": 3, "april": 4, "mai": 5, "juni": 6,
    "juli": 7, "august": 8, "september": 9, "oktober": 10, "november": 11, "desember": 12,
}

TIME_RE = re.compile(r"kl\.\s*(\d{1,2}):(\d{2})")


def scrape() -> list[dict]:
    resp = requests.get(
        PAGE_URL,
        timeout=30,
        headers={"User-Agent": "tromso-events-aggregator/1.0"},
    )
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    now = datetime.now()
    events = []

    for card in soup.find_all("div", class_="card--calendar_homepage"):
        title_a = card.find("a", class_="h3__link")
        if not title_a:
            continue

        day_el = card.find("span", class_="day")
        month_el = card.find("span", class_="month")
        time_el = card.find("div", class_="event-time")
        copy = card.find("div", class_="card__copy")
        loc_el = copy.find("div", class_="item") if copy else None
        img_el = card.find("img", class_="img")

        if not (day_el and month_el and time_el):
            continue

        month = MONTHS_NO.get(month_el.get_text(strip=True).lower())
        if not month:
            continue

        day = int(day_el.get_text(strip=True))
        year = now.year
        if month < now.month or (month == now.month and day < now.day - 1):
            year += 1

        time_m = TIME_RE.search(time_el.get_text(strip=True))
        if not time_m:
            continue

        try:
            dt = datetime(year, month, day, int(time_m.group(1)), int(time_m.group(2)))
        except ValueError:
            continue

        href = title_a.get("href", "")
        url = (BASE_URL + href) if href.startswith("/") else href

        location = loc_el.get_text(strip=True) if loc_el else "Tromsø bibliotek"

        # Skip the Kroken branch (a suburb) — the calendar lists it alongside the
        # central library, but only Hovedbiblioteket belongs on the city-centre map.
        if "kroken" in location.lower():
            continue

        venue = f"{location}, Tromsø" if "tromsø" not in location.lower() else location

        img_src = img_el.get("src", "") if img_el else ""
        image = (BASE_URL + img_src) if img_src.startswith("/") else (img_src or None)

        slug = href.rstrip("/").rsplit("/", 1)[-1]
        uid = f"tromso-bibliotek-{slug}-{dt.strftime('%Y%m%dT%H%M')}@tromso.kommune.no"

        events.append({
            "uid": uid,
            "title": title_a.get_text(strip=True),
            "url": url,
            "start": dt,
            "venue": venue,
            "source": "tromso_bibliotek",
            "time_inferred": False,
            "image": image,
            "free": True,
        })

    return events
