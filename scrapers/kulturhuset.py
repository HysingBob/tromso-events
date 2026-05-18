import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta

PROGRAM_URL = "https://kulturhuset.tr.no/program"
BASE_URL = "https://kulturhuset.tr.no"

MONTHS_NO = {
    "januar": 1, "jan": 1,
    "februar": 2, "feb": 2,
    "mars": 3, "mar": 3,
    "april": 4, "apr": 4,
    "mai": 5,
    "juni": 6, "jun": 6,
    "juli": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sep": 9,
    "oktober": 10, "okt": 10,
    "november": 11, "nov": 11,
    "desember": 12, "des": 12,
}

# Handles: "15. mai kl. 19:00" and "10. apr 2027 kl. 18:30"
DATE_RE = re.compile(
    r"(\d{1,2})\.\s*(\w+)\s+(?:(\d{4})\s+)?kl\.\s*(\d{1,2}):(\d{2})",
    re.IGNORECASE,
)


def _extract_image(article) -> str | None:
    img = article.find("img")
    if not img:
        return None
    src = img.get("src") or img.get("data-src") or img.get("data-lazy-src") or ""
    if not src or src.startswith("data:"):
        return None
    if src.startswith("//"):
        return "https:" + src
    if src.startswith("/"):
        return BASE_URL + src
    return src if src.startswith("http") else None


def _parse_date(text: str) -> datetime | None:
    m = DATE_RE.search(text)
    if not m:
        return None
    day, month_str, explicit_year, hour, minute = m.groups()
    month = MONTHS_NO.get(month_str.lower())
    if not month:
        return None
    if explicit_year:
        year = int(explicit_year)
    else:
        year = datetime.now().year
    try:
        dt = datetime(year, month, int(day), int(hour), int(minute))
        # If no explicit year and date is more than 30 days in the past, assume next year
        if not explicit_year and dt < datetime.now() - timedelta(days=30):
            dt = dt.replace(year=year + 1)
        return dt
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
    seen_slugs = set()

    for article in soup.find_all("article", class_="chili-event-wrapper"):
        title_a = article.find("a", class_="chili-event-title")
        if not title_a:
            continue

        title = title_a.get_text(strip=True)
        url = title_a["href"]
        slug = url.rstrip("/").rsplit("/", 1)[-1]

        venue_el = article.find(class_="chili-scene-header")
        venue = venue_el.get_text(strip=True).title() if venue_el else "Kulturhuset Tromsø"

        image = _extract_image(article)

        performances = article.select(".chili-event-performances li")
        dates = [_parse_date(li.get_text(strip=True)) for li in performances]
        dates = [d for d in dates if d is not None]

        # Events with no parseable date still get included with None start
        if not dates:
            dates = [None]

        for dt in dates:
            time_inferred = False
            if dt is not None and dt.hour == 0 and dt.minute == 0:
                dt = dt.replace(hour=18)
                time_inferred = True

            uid = f"{slug}-{dt.strftime('%Y%m%dT%H%M') if dt else 'nodate'}@kulturhuset.tr.no"
            if uid in seen_slugs:
                continue
            seen_slugs.add(uid)
            events.append({
                "uid": uid,
                "title": title,
                "url": url,
                "start": dt,
                "venue": f"{venue}, Kulturhuset Tromsø",
                "source": "kulturhuset",
                "time_inferred": time_inferred,
                "image": image,
            })

    return events
