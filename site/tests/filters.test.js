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
  assert.match(list, /Tromsø IL – Viking/);
  assert.match(list, /Tromsø IL – Start/);
});

// Kategoriveggen sit på papirlaget (::before med eigen tekstur), ikkje på
// kortet sjølv — elles ville filteret tatt blekkteksten òg (Bob 2026-11-11).
test('kvart kort får kategorivegg (Wallpaper A–D) på papirlaget; Annet står urørt', () => {
  const css = fs.readFileSync(path.join(root, 'design', 'style-v7.css'), 'utf8');
  const wall = { Konsert: 'a', Scene: 'b', Film: 'c', Aktivitet: 'd' };
  for (const [k, w] of Object.entries(wall)) {
    assert.ok(new RegExp(`\\.event-card\\[data-categories="${k}"\\]::before\\{background-image:url\\("/assets/textures/wall-${w}\\.webp"\\)`).test(css), `${k} manglar wall-${w}`);
    if (w !== 'd') {
      assert.ok(fs.existsSync(path.join(root, 'src', 'assets', 'textures', `wall-${w}.webp`)), `wall-${w}.webp manglar`);
    }
  }
  // wall-d er framleis på ventetrå hjå Bob — kravd fyrst når fila finst.
  if (fs.existsSync(path.join(root, 'src', 'assets', 'textures', 'wall-d.webp'))) {
    assert.ok(css.includes('.event-card[data-categories="Aktivitet"]::before{background-image:url("/assets/textures/wall-d.webp")'));
  }
  assert.doesNotMatch(css, /\.event-card\[data-categories="Annet"\]::before\{(filter|background-image)/);
  assert.match(css, /\.event-card::before\{[^}]*paper\.webp/);
  assert.match(css, /\.event-card\{[^}]*position:relative/);
});

// Aurora kino Fokus-signatur (Bob 2026-11-12): **marble_101** frå Koofr som
// tekstur på korta OG arrangementssida (var wallpaper_4). Grøn-grå marmor,
// snitt lum 0,233: krem #F7E8CB 12,4:1 mot p50 — «nattkort» framleis.
test('Aurora kino Fokus får marble_101 som signurflate (kort + arrangementside)', () => {
  const css = fs.readFileSync(path.join(root, 'design', 'style-v7.css'), 'utf8');
  assert.ok(fs.existsSync(path.join(root, 'src', 'assets', 'textures', 'marble-101.webp')), 'marble-101.webp manglar');
  assert.ok(css.includes('.event-card[data-sted="Aurora kino Fokus"]::before{background-image:url("/assets/textures/marble-101.webp")'), 'kortet manglar marble-101-regelen');
  assert.ok(css.includes('.detail[data-sted="Aurora kino Fokus"]{background-image:url("/assets/textures/marble-101.webp")'), 'arrangementssida manglar marble-101-regelen');
  assert.match(css, /\.event-card\[data-sted="Aurora kino Fokus"\]\{color:#F7E8CB\}/);
  assert.match(css, /\.detail\[data-sted="Aurora kino Fokus"\]\{[^}]*color:#F7E8CB\}/);
  assert.ok(!css.includes('aurorawall-4'), 'aurorawall-4 skal vere ute av CSS-en');
});

// Løvetann Studio-signatur (Bob 2026-11-11): Wallpaper_23 frå Koofr som
// eitt lag på korta OG arrangementssida — lys blågrå mural = «dagkort»,
// standard mørkt blekk står urørt.
test('Løvetann Studio får Wallpaper_23 som signaturflate (kort + arrangementside)', () => {
  const css = fs.readFileSync(path.join(root, 'design', 'style-v7.css'), 'utf8');
  assert.ok(fs.existsSync(path.join(root, 'src', 'assets', 'textures', 'lovewall-23.webp')), 'lovewall-23.webp manglar');
  assert.ok(css.includes('.event-card[data-sted="Løvetann Studio"]::before{background-image:url("/assets/textures/lovewall-23.webp")'), 'kortet manglar lovewall-23-regelen');
  assert.ok(css.includes('.detail[data-sted="Løvetann Studio"]{background-image:url("/assets/textures/lovewall-23.webp")'), 'arrangementssida manglar lovewall-23-regelen');
  // Dagkort: muralen er lys, så arrangementsida må ha mørkt blekk inni .detail
  assert.match(css, /\.detail\[data-sted="Løvetann Studio"\]\{color:#3A2A1E\}/, 'arrangementssida manglar mørkt blekk (lys tekstur)');
});

// PUST Lavvo-signatur (Bob 2026-11-11): mahogany_1 frå Koofr som eitt lag
// på korta OG arrangementssida. Mahogny er midtone, så ein 28 % svartvask
// ligg over teksturen — kremblekk (nattkort) landar på 6,4-6,9:1.
test('PUST Lavvo får mahogany_1 som signaturflate (kort + arrangementside)', () => {
  const css = fs.readFileSync(path.join(root, 'design', 'style-v7.css'), 'utf8');
  assert.ok(fs.existsSync(path.join(root, 'src', 'assets', 'textures', 'mahogany.webp')), 'mahogany.webp manglar');
  assert.ok(css.includes('.event-card[data-sted="PUST Lavvo, Tromsø"]::before{background-image:linear-gradient(rgba(0,0,0,.28),rgba(0,0,0,.28)),url("/assets/textures/mahogany.webp")'), 'kortet manglar mahogany-regelen med svartvask');
  assert.ok(css.includes('.detail[data-sted="PUST Lavvo, Tromsø"]{background-image:linear-gradient(rgba(0,0,0,.28),rgba(0,0,0,.28)),url("/assets/textures/mahogany.webp")'), 'arrangementssida manglar mahogany-regelen');
  assert.match(css, /\.event-card\[data-sted="PUST Lavvo, Tromsø"\]\{color:#F7E8CB\}/);
  assert.match(css, /\.detail\[data-sted="PUST Lavvo, Tromsø"\]\{[^}]*color:#F7E8CB\}/);
});

// Ishavskatedralen-signatur (Bob 2026-11-11): wallpaper_38 frå Koofr som
// eitt lag på korta OG arrangementssida — lys off-white mural = «dagkort»,
// standard mørkt blekk, og mørkt blekk-overstyringar inni .detail.
test('Ishavskatedralen får wallpaper_38 som signaturflate (kort + arrangementside)', () => {
  const css = fs.readFileSync(path.join(root, 'design', 'style-v7.css'), 'utf8');
  assert.ok(fs.existsSync(path.join(root, 'src', 'assets', 'textures', 'ishavswall-38.webp')), 'ishavswall-38.webp manglar');
  assert.ok(css.includes('.event-card[data-sted="Ishavskatedralen"]::before{background-image:url("/assets/textures/ishavswall-38.webp")'), 'kortet manglar ishavswall-38-regelen');
  assert.ok(css.includes('.detail[data-sted="Ishavskatedralen"]{background-image:url("/assets/textures/ishavswall-38.webp")'), 'arrangementssida manglar ishavswall-38-regelen');
  assert.match(css, /\.detail\[data-sted="Ishavskatedralen"\]\{color:#3A2A1E\}/, 'arrangementssida manglar mørkt blekk (lys tekstur)');
});

// Tromsø Kulturhus-signatur (Bob 2026-11-11): fabric_192 frå Koofr som
// eige papirlag på korta OG arrangementssida — alle tre scenene treffast
// med prefixet ^=. Alt blekk i krem (veven er mørk, p99.9 lum 0.144).
test('Tromsø Kulturhus får fabric_192 som signaturvev (kort + arrangementside)', () => {
  const css = fs.readFileSync(path.join(root, 'design', 'style-v7.css'), 'utf8');
  assert.ok(fs.existsSync(path.join(root, 'src', 'assets', 'textures', 'kulturhus-192.webp')), 'kulturhus-192.webp manglar');
  assert.ok(css.includes('.event-card[data-sted^="Tromsø Kulturhus"]::before{background-image:url("/assets/textures/kulturhus-192.webp")'), 'kortet manglar kulturhus-192-regelen');
  assert.ok(css.includes('.detail[data-sted^="Tromsø Kulturhus"]{background-image:url("/assets/textures/kulturhus-192.webp")'), 'arrangementssida manglar kulturhus-192-regelen');
  assert.match(css, /\.event-card\[data-sted\^="Tromsø Kulturhus"\]\{color:#F7E8CB\}/);
  assert.match(css, /\.detail\[data-sted\^="Tromsø Kulturhus"\]\{[^}]*color:#F7E8CB\}/);
});

// Sidebakgrunn (Bob 2026-11-12): woodplank_30 som body-bakgrunn på
// listesidene (page-front), berre der — marmoren står att som
// standard-body. Tekst rett på planka = mørkt blekk #2A1D12.
// Arrangementssidene (Bob 2026-11-12): woodplank_32 som body-bakgrunn på
// page-event — varmare enn plank_30 på framsida. Kremtonane på .detail
// kvitast ut (planka er midtmørk); marmoren står att på default body.
test('Arrangementssidene får plank-32 som bakgrunn, krem kvitast ut', () => {
  const css = fs.readFileSync(path.join(root, 'design', 'style-v7.css'), 'utf8');
  assert.ok(fs.existsSync(path.join(root, 'src', 'assets', 'textures', 'plank-32.webp')), 'plank-32.webp manglar');
  assert.ok(css.includes('body.page-event{\n  background-image:radial-gradient(ellipse at 50% 45%,transparent 40%,rgba(0,0,0,.35) 100%),url("/assets/textures/plank-32.webp")'), 'page-event manglar plank-32-bakgrunn');
  assert.ok(css.includes('body.page-event .detail h1,\nbody.page-event .detail .eyebrow{color:#fff}'), '.detail-teksten er ikkje kvita på planka');
});

test('Listesidene får plank-30 som bakgrunn, marmoren står att elles', () => {
  const css = fs.readFileSync(path.join(root, 'design', 'style-v7.css'), 'utf8');
  assert.ok(fs.existsSync(path.join(root, 'src', 'assets', 'textures', 'plank-30.webp')), 'plank-30.webp manglar');
  assert.ok(!fs.existsSync(path.join(root, 'src', 'assets', 'textures', 'plank-2.webp')), 'plank-2.webp skulle vore sletta');
  assert.ok(css.includes('body.page-front{\n  background-image:url("/assets/textures/plank-30.webp")'), 'page-front manglar plank-30-bakgrunn');
  assert.ok(!css.includes('plank-2.webp'), 'plank-2 skal vere ute av CSS-en');
  assert.ok(css.includes('body.page-front .page-heading h1{color:#2A1D12}'), 'page-heading får ikkje mørkt blekk på planka');
  assert.match(css, /body\{[^}]*linear-gradient\(rgba\(0,0,0,\.28\),rgba\(0,0,0,\.28\)\),url\("\/assets\/textures\/marble-82\.webp"\)/);
});

test('v8-framsida får woodplank_16 som bakgrunn (Bob 2026-11-12)', () => {
  const css = fs.readFileSync(path.join(root, 'design', 'style-v8.css'), 'utf8');
  assert.ok(fs.existsSync(path.join(root, 'src', 'assets', 'textures', 'plank-16.webp')), 'plank-16.webp manglar');
  assert.ok(css.includes('body.page-front{background-image:url("/assets/textures/plank-16.webp");background-color:#B89C7C}'), 'v8-framsida manglar plank-16-bakgrunn');
});
