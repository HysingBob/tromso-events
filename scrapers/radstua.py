import re
from datetime import datetime
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.radstua.no"
PROGRAM_URL = BASE_URL + "/program-summary"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; tromso-events-aggregator/1.0)"}
MONTHS = {
    "jan": 1, "januar": 1,
    "feb": 2, "februar": 2,
    "mar": 3, "mars": 3,
    "apr": 4, "april": 4,
    "mai": 5,
    "jun": 6, "juni": 6,
    "jul": 7, "juli": 7,
    "aug": 8, "august": 8,
    "sep": 9, "september": 9,
    "okt": 10, "oktober": 10,
    "nov": 11, "november": 11,
    "des": 12, "desember": 12,
}
DATE_RE = re.compile(
    r"(?<!\w)(\d{1,2})\.?\s+(januar|jan|februar|feb|mars|mar|april|apr|mai|juni|jun|juli|jul|august|aug|september|sep|oktober|okt|november|nov|desember|des)\b(?:\s+(20\d{2}))?",
    re.IGNORECASE,
)
TIME_RE = re.compile(r"kl\.?\s*(\d{1,2}):(\d{2})", re.IGNORECASE)


def _extract_occurrences(text: str, fallback_year: int | None) -> list[datetime]:
    """Extract explicitly dated and timed occurrences from a source text block."""
    dates = list(DATE_RE.finditer(text))
    occurrences = []
    for index, match in enumerate(dates):
        # Do not turn the end of a stated multi-day range ("1.-23. desember")
        # into a single event on the last day.
        prefix = text[max(0, match.start() - 20):match.start()]
        if re.search(r"\d{1,2}\.\s*(?:-|til)\s*$", prefix, re.IGNORECASE):
            continue
        end = dates[index + 1].start() if index + 1 < len(dates) else len(text)
        segment = text[match.end():end]
        times = list(TIME_RE.finditer(segment))
        # A single "kl." may introduce multiple listed start times, e.g.
        # "kl. 18:00 og 19:30"; include following HH:MM values in that run.
        expanded_times = []
        for time_match in times:
            expanded_times.append((time_match.group(1), time_match.group(2)))
            cursor = time_match.end()
            while True:
                extra = re.match(r"\s*(?:og|&)\s*(\d{1,2}):(\d{2})", segment[cursor:], re.IGNORECASE)
                if not extra:
                    break
                expanded_times.append((extra.group(1), extra.group(2)))
                cursor += extra.end()
        year = int(match.group(3)) if match.group(3) else fallback_year
        if year is None:
            continue
        month = MONTHS[match.group(2).lower()]
        day = int(match.group(1))
        for hour, minute in expanded_times:
            try:
                occurrences.append(datetime(year, month, day, int(hour), int(minute)))
            except ValueError:
                continue
    return sorted(set(occurrences))


def _page_year(soup: BeautifulSoup) -> int | None:
    # Squarespace article metadata dates the post; use only as a year fallback
    # when the event page itself gives a day/month and the event time.
    for meta in soup.select('meta[itemprop="datePublished"]'):
        value = meta.get("content", "")
        match = re.match(r"(20\d{2})-", value)
        if match:
            return int(match.group(1))
    return None


def scrape() -> list[dict]:
    response = requests.get(PROGRAM_URL, timeout=30, headers=HEADERS)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    events = []

    for item in soup.select(".summary-item"):
        title_link = item.select_one(".summary-title-link")
        if not title_link or not title_link.get("href"):
            continue

        event_url = urljoin(BASE_URL, title_link["href"])
        detail_response = requests.get(event_url, timeout=30, headers=HEADERS)
        detail_response.raise_for_status()
        detail = BeautifulSoup(detail_response.text, "html.parser")
        article = detail.select_one("main article article") or detail.select_one("main article") or detail
        title_el = article.select_one("h1") or title_link
        title = title_el.get_text(" ", strip=True)
        year = _page_year(detail)

        # The detail page's published date is used only as a year fallback when
        # the program excerpt gives a day/month and exact start time.
        excerpt = item.select_one(".summary-excerpt")
        schedule_text = excerpt.get_text(" ", strip=True) if excerpt else ""
        if year is None:
            occurrences = []
        else:
            occurrences = _extract_occurrences(schedule_text, year)
        image = None
        for img in item.select(".summary-thumbnail img"):
            src = img.get("data-image") or img.get("data-src") or img.get("src")
            if src and not src.startswith("data:"):
                image = urljoin(BASE_URL, src)
                break

        slug = event_url.rstrip("/").rsplit("/", 1)[-1]
        for start in occurrences:
            events.append({
                "uid": f"radstua-{slug}-{start.strftime('%Y%m%dT%H%M')}@radstua.no",
                "title": title,
                "url": event_url,
                "start": start,
                "venue": "Rådstua Teaterhus, Tromsø",
                "source": "radstua",
                "time_inferred": False,
                "image": image,
            })

    return events
