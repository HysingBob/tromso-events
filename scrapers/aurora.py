import re
import json
import urllib.parse
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta

BASE_URL = "https://fokus.aurorakino.no"
PROGRAM_URL = BASE_URL + "/program/{date}/popularity/all/all"
DAYS_AHEAD = 14

HEADERS = {"User-Agent": "tromso-events-aggregator/1.0"}


def _decode_blocks(html: str) -> list[dict]:
    raw_blocks = re.findall(r'decodeURIComponent\("(.*?)"\)', html, re.DOTALL)
    blocks = []
    for raw in raw_blocks:
        try:
            blocks.append(json.loads(urllib.parse.unquote(raw)))
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass
    return blocks


def _title_from_url(movie_url: str) -> str:
    parts = movie_url.rstrip("/").rsplit("/", 2)
    if len(parts) >= 2:
        return parts[-2].replace("-", " ").title()
    return movie_url


def _fetch_poster(movie_url: str) -> str | None:
    try:
        resp = requests.get(movie_url, timeout=15, headers=HEADERS)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        og = soup.find("meta", property="og:image")
        if og and og.get("content"):
            return og["content"]
        # Fallback: find filmgrail poster URL in raw HTML
        m = re.search(
            r'https://images\.filmgrail\.com/mediaserver/movies/[^"\'&\s]+',
            resp.text,
        )
        return m.group(0) if m else None
    except Exception:
        return None


def scrape() -> list[dict]:
    # First pass: collect all unique movies and showtimes across all days
    movie_info: dict[str, dict] = {}   # movie_id → {title, url}
    raw_showtimes: list[dict] = []
    seen_uids: set[str] = set()

    for day_offset in range(DAYS_AHEAD):
        date = (datetime.now() + timedelta(days=day_offset)).strftime("%Y-%m-%d")
        url = PROGRAM_URL.format(date=date)
        try:
            resp = requests.get(url, timeout=20, headers=HEADERS)
            resp.raise_for_status()
        except Exception:
            continue

        blocks = _decode_blocks(resp.text)

        for block in blocks:
            if block.get("_blockName") != "Card2":
                continue
            movie_url = block.get("url", "")
            if "/f/" not in movie_url:
                continue
            movie_id = movie_url.rstrip("/").rsplit("/", 1)[-1]
            if movie_id not in movie_info:
                movie_info[movie_id] = {
                    "title": _title_from_url(movie_url),
                    "url": BASE_URL + movie_url,
                }

        for block in blocks:
            if block.get("_blockName") != "MovieShowtimes":
                continue
            for day_showtimes in block.get("showtimes", []):
                for st in day_showtimes:
                    show_id = st.get("showId", "")
                    movie_id = str(st.get("movieId", ""))
                    start_raw = st.get("startTime", "")
                    if not start_raw or not show_id:
                        continue
                    uid = f"aurora-{show_id}@fokus.aurorakino.no"
                    if uid in seen_uids:
                        continue
                    seen_uids.add(uid)
                    raw_showtimes.append({
                        "uid": uid,
                        "movie_id": movie_id,
                        "start_raw": start_raw,
                        "screen": st.get("screenName", ""),
                    })

    # Second pass: fetch one poster per unique movie
    poster_cache: dict[str, str | None] = {}
    for movie_id, info in movie_info.items():
        poster_cache[movie_id] = _fetch_poster(info["url"])
        print(f"  aurora poster: {info['title']} → {poster_cache[movie_id] and 'ok' or 'none'}")

    # Build final event list
    events = []
    for st in raw_showtimes:
        movie_id = st["movie_id"]
        info = movie_info.get(movie_id, {})
        dt = datetime.fromisoformat(
            st["start_raw"].replace("Z", "").replace(".000", "")
        )
        screen = st["screen"]
        venue = f"Aurora Kino{', ' + screen if screen else ''}, Tromsø"
        events.append({
            "uid": st["uid"],
            "title": info.get("title", f"Film #{movie_id}"),
            "url": info.get("url", BASE_URL),
            "start": dt,
            "venue": venue,
            "source": "aurora",
            "image": poster_cache.get(movie_id),
        })

    return events
