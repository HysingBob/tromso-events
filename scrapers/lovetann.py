import requests
from bs4 import BeautifulSoup
from datetime import datetime

PAGE_URL = "https://www.tickettailor.com/events/lovetann/"
BASE_URL = "https://www.tickettailor.com"

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def _parse_date(date_span) -> datetime | None:
    vars_ = date_span.find_all("var")
    spans = [s for s in date_span.find_all("span") if not s.get("class")]
    if len(vars_) < 3 or len(spans) < 2:
        return None
    try:
        day = int(vars_[0].get_text(strip=True))
        year = int(vars_[1].get_text(strip=True))
        time_str = vars_[2].get_text(strip=True)  # "HH:MM"
        month_str = spans[1].get_text(strip=True).lower()[:3]
        month = MONTHS.get(month_str)
        if not month:
            return None
        hour, minute = map(int, time_str.split(":"))
        return datetime(year, month, day, hour, minute)
    except (ValueError, IndexError):
        return None


def scrape() -> list[dict]:
    resp = requests.get(
        PAGE_URL,
        timeout=30,
        headers={"User-Agent": "Mozilla/5.0 (compatible; tromso-events-aggregator/1.0)"},
    )
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    events = []
    for li in soup.find_all("li", class_="events-listing__item"):
        title_a = li.find("a", class_="event__link")
        if not title_a:
            continue

        title = title_a.get_text(strip=True)
        if "(members only)" in title.lower():
            continue

        date_span = li.find("span", class_="event-meta__date")
        if not date_span:
            continue

        dt = _parse_date(date_span)
        if not dt:
            continue

        detail_a = li.find("a", class_="event__cta--view")
        url = (BASE_URL + detail_a["href"]) if detail_a else PAGE_URL

        # UID from the event path slug (e.g. /events/lovetann/2211264 → 2211264)
        slug = title_a["href"].rstrip("/").rsplit("/", 1)[-1]
        uid = f"lovetann-{slug}@tickettailor.com"

        events.append({
            "uid": uid,
            "title": title,
            "url": url,
            "start": dt,
            "venue": "Løvetann, Grønnegata 118A, Tromsø",
            "source": "lovetann",
            "time_inferred": False,
            "image": None,
        })

    return events
