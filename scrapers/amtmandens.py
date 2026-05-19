import requests
from datetime import datetime

FEED_URL = "https://amtmandens.antitickets.com/feed.json"


def scrape() -> list[dict]:
    resp = requests.get(
        FEED_URL,
        timeout=30,
        headers={"User-Agent": "tromso-events-aggregator/1.0"},
    )
    resp.raise_for_status()
    data = resp.json()

    events = []
    for item in data.get("items", []):
        # Strip timezone — iso is already Oslo local time; generate.py re-localises naive datetimes
        dt = datetime.fromisoformat(item["iso"]).replace(tzinfo=None)

        url = item["link"]
        if url.startswith("//"):
            url = "https:" + url

        image = item.get("image") or {}
        image_url = image.get("onex")

        events.append({
            "uid": f"amtmandens-{item['id']}@antitickets.com",
            "title": item["title"],
            "url": url,
            "start": dt,
            "venue": "Amtmandens, Tromsø",
            "source": "amtmandens",
            "time_inferred": False,
            "image": image_url,
        })

    return events
