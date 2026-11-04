# Tromsø Events Aggregator

Scrapes events from Tromsø cultural sources and outputs a single `.ics` calendar feed, served via GitHub Pages and subscribed from Google Calendar.

## Kartkalender / nettside

`site/` inneholder Eleventy-kildekode, tospråklige JSON-arrangementer og egne bilder for kartkalenderen. `docs/` er GitHub Pages-utdata. Endringer under `site/` bygges av `.github/workflows/build-site.yml`, som også kjører daglig slik at avsluttede arrangementer forsvinner fra oversiktene uten JavaScript. Se [site/README.md](site/README.md) for hvordan Alvin på Dojo kan legge til oppføringer uten å redigere designet. Den tidligere forsiden er bevart på `/previous/`; `/poc/` og kalenderfeedene består.

**Foreløpig bare demonstrasjon:** alle åtte kort er fiktive, og kartkalenderen har `noindex,nofollow` til ekte, kontrollerte oppføringer er klare.

## Sources
- Kulturhuset i Tromsø
- Visit Tromsø
- AllEvents.in
- Select venues (TBD)

## Output
`events.ics` — updated daily via GitHub Actions.
