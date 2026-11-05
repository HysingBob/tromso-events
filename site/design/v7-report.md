# v7 «oppslagstavle» — rapport

Upublisert eksperiment. v2 er framleis standard og urørt.

## 1. Kvar det ligg

- Repo: `~/Projects/Code/tromso-events` (nettsida ligg i `site/`, ikkje `~/Projects/tromso-net`
  — den manglar v3–v6 og `contrast-audit.js`).
- Branch: **`design-v7`** — ikkje pusha.
- Commit: **`3ac2e5f0d0c86581584212d05ef2a54b10de8509`** («v7 «oppslagstavle»: tavle av ved …»).
  Denne rapporten kjem i commit nr. 2 på same branch.
- Ny fil med alt visuelt: `design/style-v7.css`.
- Bygg: `THEME=v7 npx eleventy --output=_site-v7`.

## 2. Kontrast (alle roller ≥ 4.5:1)

Frå `node scripts/contrast-audit.js 8094` (v7, 1280 px, «Denne uken»-filteret klikka):

| Rolle | Storleik | Kontrast |  |
|---|---|---|---|
| masthead-tagline | 13px | 5.86 | AA |
| lang-nav | 13px | 5.86 | AA |
| eyebrow | 12px | 5.39 | AA |
| h1 | 82px | 7.88 | AAA |
| section-label | 11px | 5.36 | AA |
| tab-active (ljos tekst på --sea) | 17px | 8.87 | AAA |
| card-kicker | 10px | 5.39 | AA |
| card-title | 33px | 7.88 | AAA |
| card-meta | 13px | 5.36 | AA |
| stamp-day | 28px | 7.53 | AAA |
| footer-text | 13px | 5.36 | AA |

Målt på sjølve teksturane (ikkje berre fallbackfargen), mørkaste og ljosaste del:

| Tekst | Flate | Mørkast | Snitt | Ljosast |
|---|---|---|---|---|
| blekk `#3A2A1E` | papir (`#CFBD97`–`#DDC9A2`) | 7.44 | 7.88 | 8.47 |
| uttonsk `#57432F` | papir | 5.06 | 5.36 | 5.76 |
| rust `#7A2E1C` (kicker/eyebrow/stempel) | papir | 5.09 | 5.39 | 5.79 |
| gratis `#2E3C1E` | papir | 6.39 | 6.77 | 7.27 |
| lenkje `--sea #1E434A` | papir | 5.81 | 6.16 | 6.62 |
| blekk | plank (etter kvitvask) | **4.61** | 6.24 | 9.02 |
| logo (grafikk, krav 3:1) | plank | 5.2 | 7.1 | 10.2 |

Verdstigen held: ved 0.089 < plank 0.427 < papir 0.557 (middelluminans, målt i skjermbilde).

## 3. Endringar frå briefen (med grunngjeving)

1. **`lib/render.js`, éi linje** (Bob godkjende): `THEME=vX` lastar no `leather.css` +
   `style-vX.css`. Utan `THEME` eller `THEME=v2` er utput byte-identisk med `HEAD`
   (verifisert: `diff -rq _site _site-head` gir berre den nye, ulenka `assets/style-v7.css`).
2. **`eleventy.config.js`**: lagt til passthrough `design/style-v7.css → assets/style-v7.css`
   (same måte som v5/v6).
3. **Masthead 120 px, éi heil planke.** Flisa har 17 plankar over 1024 px (60,2 px kvar).
   `background-size:2040px` gir plankhøgd 120 px; `background-position:0 -16px` legg fuga i
   toppkanten. Målt i skjermbilde: fuge på rad 0–3 og 119–124, innhald på rad 22–103 →
   logo og tagline ligg midt på plankflata.
4. **12 % varm kvitvask på banneret** (`rgba(255,250,238,.12)` over `banner.webp`).
   Utan vask var blekket 3.87:1 mot dei mørkaste fibra i planken; med vask 4.61:1.
   Plankeskilja er framleis tydelege (fuge 0.017 i luminans).
5. **`--faded` = `#57432F`** — mørkast som framleis ser uttonsk ut og held 4.5:1 på mørkaste
   papir (5.06). `#5E4A35` var for ljos (4.54, for lita margin).
6. **Papirflate på desse**, så inga tekst ligg på veden (§4): `.page-heading`, `.filter-area`,
   `.results-head`, `.empty-state`, `.related > p`, `.breadcrumb`, `.detail`, `.about-copy`,
   `.site-footer`. Sjekka med skript på fire sider: ingen tekstnode utan papir-/plankflate.
7. **`scripts/contrast-audit.js`**: tek no ein valfri sti (standard `/no/`, sidan `/` berre er
   videresending) og klikkar «Denne uken» før måling — elles er forsida tom.
8. **Logo-plass**: kvadratisk, tom, `::before` på `.brand-link` (68 px skrivebord / 44 px /
   40 px ≤410 px). Bob leverer måla kompassrose seinare. Eksisterande `logo.svg`
   (ordmerke + kompassrose) står urørt og får `filter:none`, altså mørkebrun.

## 4. Teksturar

| Fil | Kjelde | Storleik |
|---|---|---|
| `src/assets/textures/board.webp` | `wood-brown.jpg` 1024×512 | 30,1 KB |
| `src/assets/textures/banner.webp` | `planks-blue.jpg` 1024×1024 | 125,4 KB |
| `src/assets/textures/paper.webp` | `paper-kraft.jpg` (6144×3429) → 1024×572, ljosna til snitt `#D6C29C` | 17,8 KB |

Til saman **173,3 KB** (budsjett 450 KB). Kjeldefilene ligg i `design/textures/src/`
(ikkje i git, 6,6 MB). Verktøy: `python3 scripts/make_textures.py` (PIL, WebP q80).

Snittfarger: board `#625040`, banner `#7BA7A1` (vaska `#8BB1AA`), paper `#D6C29C`.

## 5. Skjermbilde (par v2 / v7)

- `design/shots/v7/home-390.png` · `design/shots/v2/home-390.png`
- `design/shots/v7/home-1440.png` · `design/shots/v2/home-1440.png`
- `design/shots/v7/event-390.png` (2026-11-14-fiktiv-familiedag) · `design/shots/v2/event-390.png`
- `design/shots/v7/event-1440.png` · `design/shots/v2/event-1440.png`
- `design/shots/v7/about-390.png` · `design/shots/v2/about-390.png`
- `design/shots/v7/about-1440.png` · `design/shots/v2/about-1440.png`
- `design/shots/v7/home-1440-nojs.png` (JavaScript avslått: 17 kort synlege)

Verktøy: `node scripts/shoot.js http://localhost:8094 design/shots/v7`
(krev `NODE_PATH=<mappe med puppeteer>`).

## 6. Andre kontrollar

- `npm test`: 12/12 grøne.
- Vassrett scroll: 360 / 390 / 1440 px → `scrollWidth == clientWidth` (ingen overflow).
- Helning: −0,50° / −0,25° på skrivebord, −0,40° / −0,20° under 640 px. Aldri over 1°.
  Kortet rettar seg ved hover/fokus (`rotate(0) translateY(-2px)`, 200 ms).
- `prefers-reduced-motion: reduce`: overgangar 0 s, helninga står.
- JavaScript avslått: alle 17 kommande arrangement synlege.
- Bilete på kort: `sepia(.35) saturate(.85)`, full farge ved hover/fokus (300 ms);
  full farge på hendelsesida.

## 7. Kunne ikkje gjerast / konfliktar

1. **`data-variant` er skeivt fordelt — det største visuelle problemet.**
   `render.js` reknar `1 + (sum av teiknkodar % 3)`. Over dei 17 arrangementa: 9 / 4 / 4.
   I «Denne uken»-utsnittet som no visast er **4 av 5 kort variant 1** → identisk papirutsnitt
   og identisk helning (−0,5°). Briefens mål («nabokort skal ikkje vise identisk papir») er
   ikkje nådd denne veka. Einaste botemiddel er i `render.js` (betre hash, t.d. 6 variantar) —
   ikkje gjort, sidan briefen seier render.js skal liggje urørt utanom temalinja Bob godkjende.
   **Sei ifrå, så fiksar eg det på éi linje.**
2. **Inga kompassrose-fil enno** → plassen står tom, som bedt.
3. **`design/style-v3.css` er referert i `eleventy.config.js`, men finst ikkje** — eleventy
   åtvarar ikkje, så det er ufarleg, men det er ein død peikar frå før.
4. Revisjonsmålinga i `contrast-audit.js` viser 5 «øydelagde bilete» — det er
   lazy-lasta kortbilete utanfor vindauget og eksterne arrangørbilete; same talet i v2.
