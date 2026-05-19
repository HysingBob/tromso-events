import requests
from bs4 import BeautifulSoup
from datetime import datetime

PAGE_URL = "https://www.verdensteatret.no/"
BASE_VENUE = "Verdensteatret, Tromsø"


def scrape() -> list[dict]:
    resp = requests.get(
        PAGE_URL,
        timeout=30,
        headers={"User-Agent": "tromso-events-aggregator/1.0"},
    )
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    events = []
    for ev in soup.find_all("div", class_="event"):
        a = ev.find("a", href=True)
        h3 = ev.find("h3")
        time_el = ev.find("time")
        img = ev.find("img")

        if not (a and h3 and time_el and time_el.get("datetime")):
            continue

        raw_title = h3.get_text(strip=True)
        if " @ " in raw_title:
            title, venue_name = raw_title.rsplit(" @ ", 1)
            venue = f"{venue_name}, Tromsø"
        else:
            title = raw_title
            venue = BASE_VENUE

        dt = datetime.strptime(time_el["datetime"], "%Y-%m-%d %H:%M")

        slug = a["href"].rstrip("/").rsplit("/", 1)[-1]
        uid = f"verdensteatret-{slug}-{dt.strftime('%Y%m%dT%H%M')}@verdensteatret.no"

        image = img["src"] if img and img.get("src") and not img["src"].startswith("data:") else None

        events.append({
            "uid": uid,
            "title": title,
            "url": a["href"],
            "start": dt,
            "venue": venue,
            "source": "verdensteatret",
            "time_inferred": False,
            "image": image,
        })

    return events
