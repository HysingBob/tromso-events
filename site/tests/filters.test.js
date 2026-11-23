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
    assert.match(card, /data-audience="/);
    assert.match(card, /data-free="[01]"/);
  }
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
// Kategorifargar (Bob 2026-11-23): rette fargar i staden for teksturar —
// éi farge per kategori på korta OG arrangementssida (.detail).
// Kontrastar: Spruce 7,6 · Slate 4,7 · Brick 4,7 mot #EDE4D3;
// Ochre 7,4 mot #2A1E0C; Bone 9,7 mot #24393A.
test('kvart kort og arrangementsside får kategorifargen sin (rette fargar, ingen tekstur)', () => {
  const css = fs.readFileSync(path.join(root, 'design', 'style-v7.css'), 'utf8');
  const FARGAR = {
    Konsert:   ['#6B6359', '#EDE4D3', '#8C8275'],
    Scene:     ['#94533D', '#EDE4D3', '#B96E55'],
    Film:      ['#2F4A4A', '#EDE4D3', '#5A7B77'],
    Aktivitet: ['#D4A84B', '#2A1E0C', '#A9832F'],
    Annet:     ['#EDE4D3', '#24393A', '#C4B8A1'],
  };
  for (const [kat, [bg, tekst, skilje]] of Object.entries(FARGAR)) {
    assert.ok(css.includes(`.event-card[data-categories="${kat}"]::before{background-image:none;background-color:${bg}}`), `${kat} manglar kortfargen ${bg}`);
    assert.ok(css.includes(`.event-card[data-categories="${kat}"]{border:1px solid ${skilje};color:${tekst}}`), `${kat} manglar tekst/skilje-fargane`);
    assert.ok(css.includes(`.event-card[data-categories="${kat}"]:hover{border-color:${skilje}}`), `${kat} manglar hover-skiljefarge`);
    assert.ok(css.includes(`body.page-event .detail[data-categories="${kat}"]{background-color:${bg};color:${tekst};border:2px solid #EDE4D3}`), `${kat} mangnar arrangementside-fargen`);
  }
  // Standard .detail (utan kategori) = Annet/Bone med mørkt blekk.
  // Bone-kant (2px #EDE4D3) skil korfargen frå den brune planken (Bob 2026-11-23).
  assert.ok(css.includes('body.page-event .detail{background-image:none;background-color:#EDE4D3;color:#24393A;border:2px solid #EDE4D3}'), '.detail manglar Bone-standarden');
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

// Sidebakgrunn (Bob 2026-11-12): woodplank_30 som body-bakgrunn på
// listesidene (page-front), berre der — marmoren står att som standard-body.
test('Listesidene får plank-30 som bakgrunn, marmoren står att elles', () => {
  const css = fs.readFileSync(path.join(root, 'design', 'style-v7.css'), 'utf8');
  assert.ok(fs.existsSync(path.join(root, 'src', 'assets', 'textures', 'plank-30.webp')), 'plank-30.webp manglar');
  // plank-2 er tilbake som v8-framside-bakgrunn (Bob 2026-11-12) — vakt flytt hitifrå.
  assert.ok(css.includes('body.page-front{\n  background-image:url("/assets/textures/plank-30.webp")'), 'page-front manglar plank-30-bakgrunn');
  assert.ok(css.includes('body.page-front .page-heading h1{color:#2A1D12}'), 'page-heading får ikkje mørkt blekk på planka');
  assert.match(css, /body\{[^}]*linear-gradient\(rgba\(0,0,0,\.28\),rgba\(0,0,0,\.28\)\),url\("\/assets\/textures\/marble-82\.webp"\)/);
});

// Arrangementssidene (Bob 2026-11-23): woodplank_32_adjusted som
// body-bakgrunn — mørkare enn plank_32 (p50 lum 0,341): kvit 7,2:1,
// krem 6,0:1.
test('Arrangementssidene får plank-32-adjusted som bakgrunn', () => {
  const css = fs.readFileSync(path.join(root, 'design', 'style-v7.css'), 'utf8');
  assert.ok(fs.existsSync(path.join(root, 'src', 'assets', 'textures', 'plank-32-adjusted.webp')), 'plank-32-adjusted.webp manglar');
  assert.ok(css.includes('body.page-event{\n  background-image:radial-gradient(ellipse at 50% 45%,transparent 40%,rgba(0,0,0,.35) 100%),url("/assets/textures/plank-32-adjusted.webp")'), 'page-event manglar plank-32-adjusted-bakgrunn');
  assert.ok(!css.includes('plank-32.webp'), 'plank-32 (utan adjusted) skal vere ute av CSS-en');
});

test('v8-framsida får woodplank_2 som bakgrunn (Bob 2026-11-12)', () => {
  const css = fs.readFileSync(path.join(root, 'design', 'style-v8.css'), 'utf8');
  assert.ok(fs.existsSync(path.join(root, 'src', 'assets', 'textures', 'plank-2.webp')), 'plank-2.webp manglar');
  assert.ok(css.includes('body.page-front{background-image:url("/assets/textures/plank-2.webp");background-color:#7BA7A1}'), 'v8-framsida manglar plank-2-bakgrunn');
});
