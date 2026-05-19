#!/usr/bin/env python3
"""Fetch events from all scrapers and write docs/events.ics and docs/facebook-events-{hash}.ics."""

import re
import sys
import pathlib
from datetime import datetime, timedelta, timezone

import pytz
from icalendar import Calendar, Event, Timezone, TimezoneStandard, TimezoneDaylight, vText

from scrapers import kulturhuset, halogalandteater, til, aurora, kulturskolen, bryggeriet, lovetann, uit, verdensteatret, framtidennord, amtmandens, tromso_bibliotek
from scrapers import facebook as facebook_scraper
from scrapers.config import FB_HASH

OSLO = pytz.timezone("Europe/Oslo")
OUTPUT = pathlib.Path("docs/events.ics")
FB_OUTPUT = pathlib.Path(f"docs/facebook-events-{FB_HASH}.ics")
SCRAPERS = [kulturhuset, halogalandteater, til, aurora, kulturskolen, bryggeriet, lovetann, uit, verdensteatret, framtidennord, amtmandens, tromso_bibliotek]

_STOP_WORDS = {"i", "på", "og", "med", "av", "for", "til", "the", "a", "an", "and", "in", "at"}


def _sig_words(title: str) -> set[str]:
    words = re.findall(r"[a-zæøå0-9]+", title.lower())
    return {w for w in words if w not in _STOP_WORDS and len(w) > 1}


def _deduplicate(events: list[dict]) -> list[dict]:
    """Remove near-duplicate events (same date, ≥60% title word overlap).

    When two events match, keep the one whose time is not inferred.
    """
    kept: list[dict] = []
    for ev in events:
        ev_date = ev["start"].date() if ev.get("start") else None
        ev_words = _sig_words(ev["title"])
        duplicate = False
        for i, other in enumerate(kept):
            other_date = other["start"].date() if other.get("start") else None
            if ev_date != other_date:
                continue
            other_words = _sig_words(other["title"])
            union = ev_words | other_words
            if not union:
                continue
            overlap = len(ev_words & other_words) / len(union)
            if overlap >= 0.6:
                # Prefer the event with a real (non-inferred) time
                if other.get("time_inferred") and not ev.get("time_inferred"):
                    kept[i] = ev
                duplicate = True
                break
        if not duplicate:
            kept.append(ev)
    return kept


def build_vtimezone() -> Timezone:
    tz = Timezone()
    tz.add("tzid", "Europe/Oslo")

    standard = TimezoneStandard()
    standard.add("dtstart", datetime(1970, 10, 25, 3, 0, 0))
    standard.add("tzoffsetfrom", timedelta(hours=2))
    standard.add("tzoffsetto", timedelta(hours=1))
    standard.add("tzname", "CET")
    standard.add("rrule", {"freq": "yearly", "bymonth": [10], "byday": ["-1SU"]})

    daylight = TimezoneDaylight()
    daylight.add("dtstart", datetime(1970, 3, 29, 2, 0, 0))
    daylight.add("tzoffsetfrom", timedelta(hours=1))
    daylight.add("tzoffsetto", timedelta(hours=2))
    daylight.add("tzname", "CEST")
    daylight.add("rrule", {"freq": "yearly", "bymonth": [3], "byday": ["-1SU"]})

    tz.add_component(standard)
    tz.add_component(daylight)
    return tz


def build_calendar(events: list[dict]) -> Calendar:
    cal = Calendar()
    cal.add("prodid", "-//Tromsø Events Aggregator//EN")
    cal.add("version", "2.0")
    cal.add("x-wr-calname", "Tromsø Events")
    cal.add("x-wr-timezone", "Europe/Oslo")
    cal.add("refresh-interval;value=duration", "PT12H")
    cal.add_component(build_vtimezone())

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
            if ev.get("time_inferred"):
                vevent.add("x-tromso-time-inferred", "TRUE")
        else:
            # No time info — use date-only
            vevent.add("dtstart", datetime.now(tz=OSLO).date())
        if ev.get("image"):
            vevent.add("x-image", ev["image"])
        if ev.get("free"):
            vevent.add("x-tromso-free", "TRUE")
        if ev.get("source"):
            vevent.add("x-tromso-source", vText(ev["source"]))

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

    # Drop past events (keep anything from yesterday onward)
    cutoff = datetime.now() - timedelta(days=1)
    future = [e for e in valid if e["start"] >= cutoff]
    past = len(valid) - len(future)
    if past:
        print(f"Dropped {past} past events (before {cutoff.date()})")
    valid = future

    # Deduplicate near-identical events across sources
    before_dedup = len(valid)
    valid = _deduplicate(valid)
    dupes = before_dedup - len(valid)
    if dupes:
        print(f"Removed {dupes} duplicate events")

    cal = build_calendar(valid)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(cal.to_ical())
    print(f"Wrote {len(valid)} events to {OUTPUT}")

    # Facebook feed — separate output, does not feed into events.ics
    try:
        fb_cal = facebook_scraper.fetch()
        fb_count = sum(1 for c in fb_cal.walk() if c.name == "VEVENT")
        FB_OUTPUT.write_bytes(fb_cal.to_ical())
        print(f"Wrote {fb_count} Facebook events to {FB_OUTPUT}")
        print(f"Facebook feed URL: https://hysingbob.github.io/tromso-events/facebook-events-{FB_HASH}.ics")
    except RuntimeError as e:
        print(f"WARNING: {e}", file=sys.stderr)
        if FB_OUTPUT.exists():
            print("Keeping previous Facebook feed unchanged.", file=sys.stderr)
        else:
            print("No previous Facebook feed to keep.", file=sys.stderr)


if __name__ == "__main__":
    main()
