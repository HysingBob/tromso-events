import re
import json
import urllib.parse
import requests
from datetime import datetime, timedelta

BASE_URL = "https://fokus.aurorakino.no"
PROGRAM_URL = BASE_URL + "/program/{date}/popularity/all/all"
DAYS_AHEAD = 14


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
    # url like /f/the-devil-wears-prada-2/1405
    parts = movie_url.rstrip("/").rsplit("/", 2)
    if len(parts) >= 2:
        return parts[-2].replace("-", " ").title()
    return movie_url


def scrape() -> list[dict]:
    events = []
    seen_uids: set[str] = set()

    for day_offset in range(DAYS_AHEAD):
        date = (datetime.now() + timedelta(days=day_offset)).strftime("%Y-%m-%d")
        url = PROGRAM_URL.format(date=date)
        try:
            resp = requests.get(
                url,
                timeout=20,
                headers={"User-Agent": "tromso-events-aggregator/1.0"},
            )
            resp.raise_for_status()
        except Exception:
            continue

        blocks = _decode_blocks(resp.text)

        # Build movieId → {title, url} from Card2 blocks
        movie_info: dict[str, dict] = {}
        for block in blocks:
            if block.get("_blockName") != "Card2":
                continue
            movie_url = block.get("url", "")
            if "/f/" not in movie_url:
                continue
            movie_id = movie_url.rstrip("/").rsplit("/", 1)[-1]
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

                    # The Z suffix is nominal — the time is already local (Oslo)
                    dt = datetime.fromisoformat(
                        start_raw.replace("Z", "").replace(".000", "")
                    )

                    info = movie_info.get(movie_id, {})
                    screen = st.get("screenName", "")
                    venue = f"Aurora Kino{', ' + screen if screen else ''}, Tromsø"

                    events.append({
                        "uid": uid,
                        "title": info.get("title", f"Film #{movie_id}"),
                        "url": info.get("url", BASE_URL),
                        "start": dt,
                        "venue": venue,
                        "source": "aurora",
                    })

    return events
