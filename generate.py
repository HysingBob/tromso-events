#!/usr/bin/env python3
"""Fetch events from all scrapers and write docs/events.ics."""

import pathlib
from datetime import datetime, timedelta, timezone

import pytz
from icalendar import Calendar, Event, vText

from scrapers import kulturhuset

OSLO = pytz.timezone("Europe/Oslo")
OUTPUT = pathlib.Path("docs/events.ics")
SCRAPERS = [kulturhuset]


def build_calendar(events: list[dict]) -> Calendar:
    cal = Calendar()
    cal.add("prodid", "-//Tromsø Events Aggregator//EN")
    cal.add("version", "2.0")
    cal.add("x-wr-calname", "Tromsø Events")
    cal.add("x-wr-timezone", "Europe/Oslo")
    cal.add("refresh-interval;value=duration", "PT12H")

    for ev in events:
        vevent = Event()
        vevent.add("uid", ev["uid"])
        vevent.add("summary", ev["title"])
        vevent.add("url", ev["url"])
        vevent.add("location", vText(ev["venue"]))
        vevent.add("dtstamp", datetime.now(tz=timezone.utc))

        if ev["start"]:
            start = OSLO.localize(ev["start"])
            vevent.add("dtstart", start)
            vevent.add("dtend", start + timedelta(hours=2))
        else:
            # No time info — use date-only
            vevent.add("dtstart", datetime.now(tz=OSLO).date())

        cal.add_component(vevent)

    return cal


def main():
    all_events = []
    for scraper in SCRAPERS:
        try:
            events = scraper.scrape()
            print(f"{scraper.__name__.split('.')[-1]}: {len(events)} events")
            all_events.extend(events)
        except Exception as e:
            print(f"ERROR {scraper.__name__}: {e}")

    # Drop events with no start date
    valid = [e for e in all_events if e["start"]]
    skipped = len(all_events) - len(valid)
    if skipped:
        print(f"Skipped {skipped} events with no parseable date")

    cal = build_calendar(valid)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(cal.to_ical())
    print(f"Wrote {len(valid)} events to {OUTPUT}")


if __name__ == "__main__":
    main()
