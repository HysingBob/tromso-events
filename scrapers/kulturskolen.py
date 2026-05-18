import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime

BASE_URL = "https://www.kulturskolentromso.no"
LISTING_URL = BASE_URL + "/praktisk-info/kommende-aktiviteter/"

HEADERS = {"User-Agent": "tromso-events-aggregator/1.0"}

DATE_RE = re.compile(r"(\d{2})-(\d{2})-(\d{4})")
# "I Rødbanken kl 11:30" or "kl. 11:30"
VENUE_TIME_RE = re.compile(r"[Ii]\s+(.+?)\s+kl\.?\s*(\d{1,2}:\d{2})", re.IGNORECASE)
TIME_RE = re.compile(r"kl\.?\s*(\d{1,2}:\d{2})", re.IGNORECASE)


def _parse_detail(booking_id: str) -> dict | None:
    url = f"{LISTING_URL}?spwibookingid={booking_id}"
    try:
        resp = requests.get(url, timeout=20, headers=HEADERS)
        resp.raise_for_status()
    except Exception:
        return None

    soup = BeautifulSoup(resp.text, "html.parser")
    # Multiple div.info on the page — find the one containing the event date
    info = None
    for div in soup.find_all("div", class_="info"):
        if div.find("p", class_="secondary-heading"):
            info = div
            break
    if not info:
        return None

    # Title
    h1 = info.find("h1", class_="heading")
    title = h1.get_text(strip=True) if h1 else None
    if not title:
        return None

    # Date
    date_el = info.find("p", class_="secondary-heading")
    date_str = date_el.get_text(strip=True) if date_el else ""
    date_m = DATE_RE.search(date_str)
    if not date_m:
        return None
    day, month, year = int(date_m.group(1)), int(date_m.group(2)), int(date_m.group(3))

    # Venue and time — search line by line to avoid matching across the description
    body = info.find("div", class_="text")
    lines = [s.strip() for s in body.strings if s.strip()] if body else []

    venue = "Kulturskolen Tromsø"
    hour, minute = 18, 0
    time_inferred = True

    for line in lines:
        vt_m = VENUE_TIME_RE.search(line)
        if vt_m:
            venue = vt_m.group(1).strip().rstrip(",")
            h, m = vt_m.group(2).split(":")
            hour, minute = int(h), int(m)
            time_inferred = False
            break
        t_m = TIME_RE.search(line)
        if t_m:
            h, m = t_m.group(1).split(":")
            hour, minute = int(h), int(m)
            time_inferred = False
            break

    try:
        dt = datetime(year, month, day, hour, minute)
    except ValueError:
        return None

    # Image from listing thumbnail (in speedware path)
    img = soup.find("img", src=re.compile(r"/speedware/Bookings/"))
    image = None
    if img:
        src = img.get("src", "")
        image = BASE_URL + src if src.startswith("/") else src

    return {
        "title": title,
        "start": dt,
        "venue": venue,
        "url": url,
        "image": image,
        "time_inferred": time_inferred,
    }


def scrape() -> list[dict]:
    try:
        resp = requests.get(LISTING_URL, timeout=20, headers=HEADERS)
        resp.raise_for_status()
    except Exception as e:
        print(f"kulturskolen: listing fetch failed: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")

    # Collect unique booking IDs — each link may appear multiple times (once per date)
    seen: set[str] = set()
    booking_ids = []
    for a in soup.find_all("a", href=re.compile(r"spwibookingid=")):
        m = re.search(r"spwibookingid=(\d+)", a["href"])
        if m and m.group(1) not in seen:
            seen.add(m.group(1))
            booking_ids.append(m.group(1))

    events = []
    for booking_id in booking_ids:
        ev = _parse_detail(booking_id)
        if not ev:
            continue
        uid = f"kulturskolen-{booking_id}-{ev['start'].strftime('%Y%m%dT%H%M')}@kulturskolentromso.no"
        events.append({
            "uid": uid,
            "title": ev["title"],
            "url": ev["url"],
            "start": ev["start"],
            "venue": ev["venue"],
            "source": "kulturskolen",
            "image": ev["image"],
            "time_inferred": ev["time_inferred"],
        })

    return events
