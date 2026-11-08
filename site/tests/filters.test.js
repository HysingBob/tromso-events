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

// Desse sju er Bob si kategoriliste; «malgruppe» er kven arrangementet passar for.
const KATEGORIAR = ['Konsert', 'Scene', 'Film', 'Utstilling', 'Prat', 'Idrett', 'Aktivitet'];
const MALGRUPPER = ['Familie', 'Ungdom', '18+'];

const raw = () => fs.readdirSync(eventsDir).filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(eventsDir, f), 'utf8')));

test('kvar arrangementsfil har kategori frå dei sju og minst éin målgruppe', () => {
  const files = raw();
  assert.ok(files.length > 0);
  for (const e of files) {
    assert.ok(Array.isArray(e.kategori) && e.kategori.length, `${e.id} manglar kategori`);
    for (const k of e.kategori) assert.ok(KATEGORIAR.includes(k), `${e.id} har ukjend kategori «${k}»`);
    assert.ok(Array.isArray(e.malgruppe) && e.malgruppe.length, `${e.id} manglar malgruppe`);
    for (const m of e.malgruppe) assert.ok(MALGRUPPER.includes(m), `${e.id} har ukjend målgruppe «${m}»`);
  }
});

test('gratis er alltid ein boolsk verdi, så «Gratis»-filteret aldri er udefinert', () => {
  for (const e of raw()) assert.equal(typeof e.gratis, 'boolean', `${e.id} har gratis=${e.gratis}`);
});

test('forsida har tre filterrader, og kvart kort ber data for alle dimensjonane', () => {
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'pipe' });
  const front = html('no/');
  for (const rad of ['filter-kategori', 'filter-malgruppe', 'filter-pris']) {
    assert.match(front, new RegExp(`id="${rad}"`), `manglar filterrad ${rad}`);
  }
  assert.match(front, /data-category-filter="Konsert"/);
  assert.match(front, /data-audience-filter="18\+"/);
  assert.match(front, /data-free-filter="/);
  assert.match(front, /data-filter-reset/);

  const cards = loadEvents().filter(e => e.status === 'publisert');
  assert.ok(cards.length);
  for (const card of front.match(/<a class="event-card"[^>]*>/g) || []) {
    assert.match(card, /data-categories="/);
    assert.match(card, /data-audience="/);
    assert.match(card, /data-free="[01]"/);
  }
});

test('tom kategori får ikkje eigen knapp — berre knappar som kan gje treff', () => {
  const front = html('no/');
  const knappar = [...front.matchAll(/data-category-filter="([^"]+)"/g)].map(m => m[1]);
  const brukte = new Set(raw().filter(e => e.status === 'publisert').flatMap(e => e.kategori));
  for (const k of knappar) assert.ok(brukte.has(k), `knapp for «${k}» har ingen arrangement`);
  assert.ok(knappar.length > 0);
});
