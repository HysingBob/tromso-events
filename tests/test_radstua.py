import unittest
from unittest.mock import patch

from scrapers import radstua


PROGRAM_HTML = '''
<div class="summary-item">
 <a class="summary-title-link" href="/aktuelt-program/testevent">Testforestilling</a>
 <div class="summary-excerpt"><p>Torsdag 12. november kl. 18:00 og 19:30</p></div>
 <div class="summary-thumbnail"><img data-image="https://images.example/test.png" alt="Testforestilling"></div>
</div>
<div class="summary-item">
 <a class="summary-title-link" href="/aktuelt-program/unknown-year">Mangler år</a>
 <div class="summary-excerpt"><p>Onsdag 13. mars kl. 19:00</p></div>
</div>
'''

DETAIL_HTML = '''
<html><head><meta itemprop="datePublished" content="2026-10-01T12:00:00+0200"></head>
<body><main><article><article><h1>Testforestilling</h1>
<img data-image="https://images.example/test.png" alt="Testforestilling">
</article></article></main></body></html>
'''


class Response:
    def __init__(self, text):
        self.text = text

    def raise_for_status(self):
        pass


class RadstuaScraperTests(unittest.TestCase):
    @patch("scrapers.radstua.requests.get")
    def test_scrapes_multiple_explicit_times_and_uses_detail_year(self, get):
        get.side_effect = [
            Response(PROGRAM_HTML),
            Response(DETAIL_HTML),
            Response('<html><head></head><body><main><article><article><h1>Mangler år</h1></article></article></main></body></html>'),
        ]
        events = radstua.scrape()

        self.assertEqual(len(events), 2)
        self.assertEqual([e["start"].isoformat() for e in events], [
            "2026-11-12T18:00:00", "2026-11-12T19:30:00"
        ])
        self.assertTrue(all("testevent" in e["url"] for e in events))
        self.assertEqual(events[0]["image"], "https://images.example/test.png")
        self.assertEqual(events[0]["venue"], "Rådstua Teaterhus, Tromsø")
        self.assertEqual(events[0]["source"], "radstua")

    def test_date_range_end_is_not_emitted_as_a_solo_occurrence(self):
        self.assertEqual(radstua._extract_occurrences(
            "Hver dag fra 1. til 23. desember kl. 18:00", 2026
        ), [])


if __name__ == "__main__":
    unittest.main()
