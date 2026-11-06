# tromsø.net — publisert arrangementskalender

Reklamefri, tospråklig arrangementskalender med statiske filer. Nettstedet bygges fra `site/` i repoet `HysingBob/tromso-events` og vises på `tromsoevents.net`. Alle innslag skal være ekte og kontrollert mot arrangørens kilde. Siden bruker fortsatt `noindex,nofollow` mens lansering for offentlig spredning avventes.

## Hvorfor Eleventy?

Eleventy bygger ferdige HTML-filer fra JSON uten en server i drift. Agentene trenger bare å levere eventfiler og lokale bilder; de skal ikke endre malene. Løsningen er liten, og siden fungerer med alle kommende arrangementer også når JavaScript er avslått. JavaScript brukes kun til filtrene.

## Start lokalt

Krever Node.js. Kjør i prosjektmappen:

```sh
npm ci
npm test
npm run dev
```

Åpne adressen Eleventy skriver ut (vanligvis `http://localhost:8080/`). `npm run build` bygger ferdige sider i `_site/`. I utviklingsmodus overvåkes `events/` og `images/` for endringer. GitHub Actions bygger og tester nettstedet ved endringer i `site/` og daglig; genererte filer legges i repoets `docs/` uten å slette `events.ics`, `events.json`, `/poc/` eller den forrige forsiden i `/previous/`. `tromsø.net` er fortsatt bare planlagt hoveddomene; DNS og 301-viderekobling er ikke endret.

## Legg til et arrangement

1. Kopier en JSON-fil i `events/` til `events/ÅÅÅÅ-MM-DD-kort-navn.json`. Filnavnet og feltet `id` må være identiske uten `.json`.
2. Endre innholdet, språkene og kategorien. `start` er obligatorisk og styrer datoen/ukedagen på kortet, dagsgruppering og filtrene. Bruk verifisert norsk lokal tid, for eksempel `2027-02-01T20:00` (Europe/Oslo); feil tidssone kan gi feil ukedag. `slutt` er valgfritt og skal bare fylles ut når det er bekreftet.
3. Velg nøyaktig én `kategori` blant `Konsert`, `Scene`, `Utstilling`, `Foredrag`, `Familie`, `Friluft`, `Mat og drikke`, `Annet`. Kategorien står ikke på kortet, men vises over tittelen på arrangementssiden og styrer kategorisidene.
4. Valgfritt `merke` viser et rødt merke på kortet, for eksempel `"merke": "Utsolgt"` eller `"merke": {"no":"Premiere","en":"Premiere"}`. Bruk det bare for kontrollert informasjon.
5. Legg en **egenprodusert** 1500×1000 WebP-illustrasjon i `images/` med samme navn (`images/ÅÅÅÅ-MM-DD-kort-navn.webp`). En valgfri 750×500-versjon i `images/cards/` brukes på kort; ellers brukes originalen automatisk. Både kort og hero beskjæres 3:2. Ikke bruk bilder fra eksterne nettsteder, og ikke legg datostempel i illustrasjonen.
6. Sett `status` til `"venter"` før kontroll. Etter at oppføringen er kontrollert mot arrangørens kilde, settes den til `"publisert"`. `eksempel`-feltet er ikke i bruk; ikke lag oppdiktede eller øvingsoppføringer — alle innslag skal være ekte.
7. Kjør `npm test` og `npm run build` lokalt. Commit og push JSON-filen og bildet til `site/events/` og `site/images/` i GitHub-repoet. Workflowen bygger da `docs/` og GitHub Pages oppdaterer nettstedet.

Valgfrie felt som `sted`, `adresse`, `pris`, `gratis`, `aldersgrense`, bildetekst og kilde kan utelates når de ikke er bekreftet; siden viser ikke tomme felt. `Alt` er standardfilteret, så nye oppføringer vises med én gang. Gamle eventsider beholdes ved senere bygg, mens avsluttede arrangementer forsvinner fra kalenderoversikten. Dette krever at kalenderen bygges på nytt regelmessig, også på dager uten nye filer (for eksempel daglig hos verten). En allerede publisert statisk fil oppdaterer seg ikke helt av seg selv.

## Utseende

- **Logo og favicon:** bytt `src/assets/logo.svg` og `src/assets/favicon.svg` med nye SVG-filer med samme navn. Hold kompassrosen lesbar i liten størrelse.
- **Farger:** grunnfargene står som CSS-variabler øverst i `src/assets/style.css`; den mørkere «blekk på lær»-behandlingen ligger i `src/assets/leather.css`. Tidligere stil ligger i `design/style-v1.css`. Kontroller tekstkontrast etter endringer.
- **Skriftene:** ligger lokalt i `src/assets/fonts/`; siden laster ikke skrifter eller skript fra tredjepart.

Ingen nye kontoer eller DNS-endringer er gjort. E-postadressen er ikke aktivert. `noindex,nofollow` blir stående mens offentlig lansering avventes.
