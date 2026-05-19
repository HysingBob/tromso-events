import os
import sys

import requests
from icalendar import Calendar, vText


def fetch() -> Calendar:
    """Fetch the Facebook personal events ICS and tag each VEVENT with X-TROMSO-SOURCE."""
    url = os.environ.get("FB_EVENTS_URL", "").strip()
    if not url:
        raise RuntimeError("FB_EVENTS_URL is not set — skipping Facebook scraper")

    resp = requests.get(
        url,
        timeout=30,
        headers={"User-Agent": "Mozilla/5.0 (compatible; tromso-events-aggregator/1.0)"},
    )
    if resp.status_code != 200:
        raise RuntimeError(
            f"Facebook ICS fetch returned HTTP {resp.status_code} — "
            "auth token may have expired; update FB_EVENTS_URL secret"
        )

    cal = Calendar.from_ical(resp.content)
    out = Calendar()

    for key, val in cal.items():
        out.add(key, val)

    for component in cal.walk():
        if component.name == "VEVENT":
            component.add("x-tromso-source", vText("facebook"))
            out.add_component(component)
        elif component.name not in ("VCALENDAR",):
            out.add_component(component)

    return out


if __name__ == "__main__":
    try:
        cal = fetch()
        count = sum(1 for c in cal.walk() if c.name == "VEVENT")
        print(f"facebook: {count} events")
    except RuntimeError as e:
        print(f"WARNING facebook: {e}", file=sys.stderr)
        sys.exit(1)
