const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { loadEvents } = require('../lib/events');
const root = path.join(__dirname, '..');
const output = path.join(root, '_site');
const eventsDir = path.join(root, 'events');
const html = p => fs.readFileSync(path.join(output, p, 'index.html'), 'utf8');

// Desse fem er Bob si kategoriliste (2026-11-11); «malgruppe» er kven arrangementet passar for.
const KATEGORIAR = ['Konsert', 'Scene', 'Film', 'Aktivitet', 'Annet'];
const MALGRUPPER = ['Familie'];

const raw = () => fs.readdirSync(eventsDir).filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(eventsDir, f), 'utf8')));

test('kvar arrangementsfil har nøyaktig éi kategori frå dei fem; målgruppe (Familie) er valfri', () => {
  const files = raw();
  assert.ok(files.length > 0);
  for (const e of files) {
    assert.ok(Array.isArray(e.kategori) && e.kategori.length === 1, `${e.id} må ha nøyaktig éi kategori`);
    for (const k of e.kategori) assert.ok(KATEGORIAR.includes(k), `${e.id} har ukjend kategori «${k}»`);
    if (e.malgruppe !== undefined) {
      assert.ok(Array.isArray(e.malgruppe) && e.malgruppe.length === 1, `${e.id} må ha nøyaktig éi målgruppe`);
      for (const m of e.malgruppe) assert.ok(MALGRUPPER.includes(m), `${e.id} har ukjend målgruppe «${m}»`);
    }
  }
});

test('gratis er alltid ein boolsk verdi, så «Gratis»-filteret aldri er udefinert', () => {
  for (const e of raw()) assert.equal(typeof e.gratis, 'boolean', `${e.id} har gratis=${e.gratis}`);
});

test('forsida har éi klynge knappar utan radoverskrifter, og kvart kort ber data for alle dimensjonane', () => {
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'pipe' });
  const front = html('no/');
  const list = html('no/hva-skjer/');
  // Ingen «Kategori»/«Passer for»/«Pris»-overskrifter, ingen tidsfaner.
  assert.doesNotMatch(front, /filter-row/);
  assert.doesNotMatch(front, /data-time-filter=/);
  assert.doesNotMatch(front, /class="section-label"/);
  assert.match(front, /class="category-controls filter-cluster js-only"/);
  assert.match(front, /data-filter-reset/);
  assert.doesNotMatch(front, /data-audience-filter=/);
  assert.match(front, /data-free-filter="/);
  assert.match(front, /data-filter-reset/);

  const cards = loadEvents().filter(e => e.status === 'publisert');
  assert.ok(cards.length);
  for (const card of list.match(/<a class="event-card"[^>]*>/g) || []) {
    assert.match(card, /data-categories="/);
    assert.match(card, /data-category="(concert|stage|activity|film|annet)"/);
    assert.match(card, /data-audience="/);
    assert.match(card, /data-free="[01]"/);
  }
});

// Kicker (Bob 2026-11-23): sted – ukedag, dd/mm på fyrste linja; kategorien
// står IKKJE på kortet (fargen ber bodet), og sted er UTENFOR botnlinja.
test('kickeren viser sted og dag — ikkje kategori; sted er ute av botnlinja', () => {
  const list = html('no/hva-skjer/');
  const cards = list.match(/<div class="card-kicker">[\s\S]*?<\/div><hr>/g) || [];
  assert.ok(cards.length, 'ingen kort å måle');
  for (const k of ['Konsert','Scene','Film','Aktivitet','Annet']) {
    // Gammalt format var «<kategori> –»; stadnamn (t.d. «Scene Øst») må få stå.
    assert.ok(!cards.some(c=>c.includes(`>${k} <span`)), `kategorien ${k} står framleis fyrst i ein kicker`);
  }
  const metas = list.match(/<p class="card-meta">[\s\S]*?<\/p>/g) || [];
  assert.ok(metas.length);
  assert.ok(!list.includes('· Tromsøbadet</p>'), 'stad står framleis i botnlinja');
});

// Spek 2026-11-23: hr-skilje på kvart kort, data-category på kort og <body>.
test('korta har hr-skilje og arrangementsida har data-category på <body>', () => {
  const list = html('no/hva-skjer/');
  assert.ok((list.match(/<div class="card-kicker">[\s\S]*?<\/div><hr>/g) || []).length > 0, 'korta manglar hr under kickeren');
  const events = fs.readdirSync(path.join(output, 'no', 'hendelse'));
  const sample = fs.readFileSync(path.join(output, 'no', 'hendelse', events[0], 'index.html'), 'utf8');
  assert.match(sample, /<body class="page-event" data-category="(concert|stage|activity|film|annet)">/);
  assert.match(sample, /<article class="detail"[^>]*data-category=/);
});

test('alle fem kategoriar får knapp sjølv utan arrangement i kategorien', () => {
  const front = html('no/');
  const knappar = [...front.matchAll(/data-category-filter="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(knappar, ['Konsert', 'Scene', 'Film', 'Aktivitet', 'Annet']);
  // Målgruppe-knappar (Familie) er tekne ut — for vag (Bob 2026-11-12).
  assert.doesNotMatch(front, /data-audience-filter=/);
  assert.match(front, /data-free-filter="/);
});

test('Annet-knappen viser TIL-kampene som er publisert i kategorien', () => {
  const list = html('no/hva-skjer/');
  const publishedSports = raw().filter(e => e.status === 'publisert' && e.kategori.includes('Annet'));
  assert.ok(publishedSports.some(e => e.id === '2026-11-21-til-viking'));
  assert.ok(publishedSports.some(e => e.id === '2026-12-06-til-start'));
  assert.match(list, /data-category-filter="Annet"/);
  // Viking-kampen (21.11) er passert og skal ute av oversikten — berre
  // kommande kampar står i lista. Start-kampen (06.12) står att.
  assert.doesNotMatch(list, /Tromsø IL – Viking/);
  assert.match(list, /Tromsø IL – Start/);
});
// Kategorifargar (spek 2026-11-23 «event colour spec»): kvile/blomstre-par
// per kategori — korta kviler i dempa kategorifarge og blomstrar på hover/fokus,
// éi tekstfarge i begge tilstandar, hr-skilje som skifter, bein-kant 1,5 px.
test('kvart kort og arrangementsside får kvile/blomstre-para sine (spek 2026-11-23)', () => {
  const css = fs.readFileSync(path.join(root, 'design', 'style-v7.css'), 'utf8');
  const FARGAR = {
    Konsert:   ['#755B52', '#94533D', '#E7E2D9', '#9B7D73', '#B96E55'],
    Scene:     ['#755C6E', '#884975', '#E7E2D9', '#96798D', '#AB6396'],
    Aktivitet: ['#525841', '#5B6A2F', '#E7E2D9', '#737B5B', '#7F9442'],
    Film:      ['#586574', '#42648A', '#E7E2D9', '#738396', '#5A82AF'],
    Annet:     ['#AB9974', '#D4A84B', '#221C14', '#847554', '#A9832F'],
  };
  for (const [kat, [rest, bloom, tekst, sep, sepBloom]] of Object.entries(FARGAR)) {
    assert.ok(css.includes(`[data-categories="${kat}"]{--rest:${rest};--bloom:${bloom};--txt:${tekst};--sep:${sep};--sep-bloom:${sepBloom}}`), `${kat} manglar kvile/blomstre-para`);
  }
  // Bein-kant 1,5 px på kvart kort, i begge tilstandar; hr-skilje følgjer blomstringa.
  assert.ok(css.includes('.event-card{border:1.5px solid var(--edge);color:var(--txt)}'), 'korta manglar bein-kanten');
  assert.ok(css.includes('.event-card::before{background-image:none;background-color:var(--rest);transition:background-color .5s ease}'), '::before manglar kvilefargen');
  assert.ok(css.includes('.event-card:hover::before,.event-card:focus-visible::before{background-color:var(--bloom)}'), 'manglar blomstrarfarge på hover/fokus');
  assert.ok(css.includes('.event-card hr{border:0;border-top:1px solid var(--sep);margin:8px 0;transition:border-color .5s ease}'), 'manglar hr-skilje i hvile');
  assert.ok(css.includes('.event-card:hover hr,.event-card:focus-visible hr{border-top-color:var(--sep-bloom)}'), 'manglar hr-skilje i blomstrande tilstand');
  // Bindestrek/punkt-spanane på korta følger tekstfargen, ikkje brunt var(--rule).
  assert.ok(css.includes('.event-card .card-kicker span,.event-card .card-meta span,.event-card .free{color:inherit}'), 'spanane på korta manglar tekstfarge');
  // Touch (ingen hover) og redusert rørsle.
  assert.match(css, /@media \(hover:none\)\{[^}]*\.event-card::before\{background-color:var\(--bloom\)\}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{[^@]*\.event-card,\.event-card::before,\.event-card hr\{transition:none\}/);
  // Arrangementssida: panelet står i KVILEfargen (Bob 2026-11-23: blomstra var
  // «for lys»); billettknappen ber blomstrarfargen og skiljefargen ved hover.
  assert.ok(css.includes('body.page-event .detail{background-image:none;background-color:var(--rest);color:var(--txt);border:1.5px solid var(--edge)}'), '.detail manglar kvile-standarden');
  assert.ok(css.includes('body.page-event .detail .ticket-link{background:var(--bloom);color:var(--txt)}'), 'billettknappen manglar blomstrarfargen');
  assert.ok(css.includes('body.page-event .detail .ticket-link:hover,body.page-event .detail .ticket-link:focus-visible{background:var(--sep-bloom);color:var(--txt)}'), 'billettknappen manglar skiljefarge-hover');
  // Skiljestrekar inni .detail følgjer kategorien (sep-bloom — alltid blomstra der),
  // ikkje det brune var(--rule) frå grunn-CSS-en (Bob 2026-11-23: «framleis brune»).
  assert.ok(css.includes('body.page-event .detail .facts{border-top:2px solid var(--sep-bloom);border-bottom:2px solid var(--sep-bloom)}'), '.facts manglar kategoriskiljet');
  assert.ok(css.includes('body.page-event .detail .source-note{border-top:1px solid var(--sep-bloom)}'), '.source-note manglar kategoriskiljet');
});

// Alle signaturteksturar per lokale er tekne ut (Bob 2026-11-23) —
// kategorifargane er alt. Ingen data-sted-reglar i CSS-en lenger.
test('ingen signatur-teksturar per lokale står att i CSS-en', () => {
  const css = fs.readFileSync(path.join(root, 'design', 'style-v7.css'), 'utf8');
  assert.doesNotMatch(css, /data-sted/, 'data-sted-reglar skal vere ute av CSS-en');
  for (const gamal of ['marble-101b', 'teak-2', 'woodfine-21', 'ishavswall-38', 'rosewood-1', 'wallpaper-2', 'mahogany-1', 'marble-83', 'marble-66', 'wall-a', 'wall-b', 'wall-c', 'wall-d']) {
    assert.ok(!css.includes(gamal), `${gamal} skal vere ute av CSS-en`);
  }
});

// Sidebakgrunn (spek 2026-11-23): heile sida på mørk blågrøn planke
// (wood_plank_2_dark), flat fallback #3C5150 under teksturen.
test('heile sida får wood-plank-2-dark som bakgrunn med #3C5150-fallback', () => {
  const css = fs.readFileSync(path.join(root, 'design', 'style-v7.css'), 'utf8');
  assert.ok(fs.existsSync(path.join(root, 'src', 'assets', 'textures', 'wood-plank-2-dark.webp')), 'wood-plank-2-dark.webp manglar');
  assert.ok(css.includes('background-image:url("/assets/textures/wood-plank-2-dark.webp")'), 'body manglar wood-plank-2-dark-bakgrunn');
  assert.ok(css.includes('--body-bg:#3C5150'), 'manglar #3C5150-fallback');
  // Globale flater frå speket.
  assert.ok(css.includes('--edge:#E7E2D9'), 'manglar bein-kanten --edge');
  assert.ok(css.includes('--text-light:#E7E2D9'), 'manglar --text-light');
  assert.ok(css.includes('--text-dark:#221C14'), 'manglar --text-dark');
  assert.ok(css.includes('--panel:#1E3030'), 'manglar --panel');
  for (const gamal of ['plank-30', 'plank-2.webp', 'textures/plank-2-dark', 'marble-82']) {
    assert.ok(!css.includes(gamal), `${gamal} skal vere ute av v7-CSS-en`);
  }
});

// Arrangementssidene (Bob 2026-11-23: dei tinta kategoribakgrunnene var «for
// mykje farger og forvirrande») — attende til woodplank_32_adjusted som
// éiaste sidebakgrunn; dei tinta planke-32-flatene er tekne ut.
test('Arrangementssidene får plank-32-adjusted som bakgrunn — kategoribakgrunnar ute', () => {
  const css = fs.readFileSync(path.join(root, 'design', 'style-v7.css'), 'utf8');
  assert.ok(fs.existsSync(path.join(root, 'src', 'assets', 'textures', 'plank-32-adjusted.webp')), 'plank-32-adjusted.webp manglar');
  assert.ok(css.includes('body.page-event{\n  background-image:radial-gradient(ellipse at 50% 45%,transparent 40%,rgba(0,0,0,.35) 100%),url("/assets/textures/plank-32-adjusted.webp")'), 'page-event manglar plank-32-adjusted-bakgrunn');
  assert.ok(!css.includes('plank-32.webp'), 'plank-32 (utan adjusted) skal vere ute av CSS-en');
  assert.doesNotMatch(css, /body\.page-event\[data-category/, 'per-kategori sidebakgrunnar skal vere ute');
  for (const fil of ['woodplank-32-concert.webp','woodplank-32-stage.webp','woodplank-32-activity.webp','woodplank-32-film.webp','woodplank-32-other.webp']) {
    assert.ok(!fs.existsSync(path.join(root, 'src', 'assets', 'textures', fil)), `${fil} skal vere ute av teksturmappa`);
  }
});

test('v8-framsida får wood-plank-2-dark som bakgrunn (spek 2026-11-23)', () => {
  const css = fs.readFileSync(path.join(root, 'design', 'style-v8.css'), 'utf8');
  assert.ok(fs.existsSync(path.join(root, 'src', 'assets', 'textures', 'wood-plank-2-dark.webp')), 'wood-plank-2-dark.webp manglar');
  assert.ok(css.includes('body.page-front{background-image:url("/assets/textures/wood-plank-2-dark.webp");background-color:#3C5150}'), 'v8-framsida manglar wood-plank-2-dark-bakgrunn');
});
