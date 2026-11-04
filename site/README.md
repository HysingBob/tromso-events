# tromsø.net — publisert demonstrasjon

En reklamefri, tospråklig arrangementskalender med statiske filer. Den publiserte forhåndsvisningen bygges fra `site/` i repoet `HysingBob/tromso-events` og vises på `tromsoevents.net`. **Den er foreløpig en demonstrasjon, ikke en kalender med virkelige arrangementer.** De åtte arrangementene i `events/` er oppdiktede og tydelig merket som eksempler; ingen av dem finner sted. Hele demonstrasjonen har `noindex,nofollow` i HTML og skal ikke åpnes for søkeindeksering før eksemplene er erstattet og informasjonen kontrollert. E-postadressen på om-siden er et forslag og må aktiveres før den kan brukes.

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
2. Endre datoer, språk, kategori og kilde. `start` og `slutt` skrives som norsk lokal tid, for eksempel `2027-02-01T20:00` (Europe/Oslo). `slutt` anbefales; uten den regnes arrangementet som over når det starter.
3. Legg en **egenprodusert** 1500×1000 WebP-illustrasjon i `images/` med samme navn (`images/ÅÅÅÅ-MM-DD-kort-navn.webp`). `bilde` peker dit. En valgfri 750×500-versjon i `images/cards/` brukes på kort; ellers brukes originalen automatisk. Ikke bruk bilder fra eksterne nettsteder.
4. Sett `status` til `"venter"` mens Bob kontrollerer informasjonen. Først når `status` er `"publisert"`, vises arrangementet. Sett **ikke** `"eksempel": true` på virkelige arrangementer; det feltet er kun for de åtte oppdiktede demonstrasjonene.
5. Kjør `npm test` og `npm run build` lokalt. Commit og push JSON-filen og bildet til `site/events/` og `site/images/` i GitHub-repoet. Workflowen bygger da `docs/` og GitHub Pages oppdaterer nettstedet.

Eksempelfilene inneholder alle feltene. `sted`, `adresse`, `pris`, `gratis`, `aldersgrense`, bildetekst og kilde kan utelates når opplysningene mangler; siden viser ikke tomme felt. Lenke til arrangør må være kontrollert før publisering. Gamle eventsider beholdes ved senere bygg, mens avsluttede arrangementer forsvinner fra kalenderoversikten. Dette krever at kalenderen bygges på nytt regelmessig, også på dager uten nye filer (for eksempel daglig hos verten). En allerede publisert statisk fil oppdaterer seg ikke helt av seg selv.

## Utseende

- **Logo og favicon:** bytt `src/assets/logo.svg` og `src/assets/favicon.svg` med nye SVG-filer med samme navn. Hold kompassrosen lesbar i liten størrelse.
- **Farger:** grunnfargene står som CSS-variabler øverst i `src/assets/style.css`; den mørkere «blekk på lær»-behandlingen ligger i `src/assets/leather.css`. Tidligere stil ligger i `design/style-v1.css`. Kontroller tekstkontrast etter endringer.
- **Skriftene:** ligger lokalt i `src/assets/fonts/`; siden laster ikke skrifter eller skript fra tredjepart.

Ingen nye kontoer eller DNS-endringer er gjort. E-postadressen er ikke aktivert. Før ordinær lansering må oppdiktede oppføringer erstattes med kontrollerte ekte arrangementer, og `noindex,nofollow` fjernes etter godkjenning.
