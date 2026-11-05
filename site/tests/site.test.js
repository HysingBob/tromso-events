const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { loadEvents } = require('../lib/events');
const root = path.join(__dirname,'..');
const output = path.join(root,'_site');
const html = p=>fs.readFileSync(path.join(output,p,'index.html'),'utf8');
test('Eleventy builds both languages and all four page types without third-party assets', () => {
  execFileSync('npm',['run','build'],{cwd:root,stdio:'pipe'});
  for (const p of ['no/','en/','no/om/','en/about/','no/kategori/konsert/','en/category/concert/']) assert.match(html(p),/<html lang="(no|en)"/);
  assert.match(html('no/'),/<meta name="robots" content="noindex,nofollow">/);

  assert.match(html('no/'),/data-time-filter="today"/);
  assert.match(html('no/'),/href="\/en\/" lang="en"/);
  assert.match(html('no/'),/data-filter-list/);
  assert.match(html(''),/href="\/no\/"/);
  assert.match(html('no/'),/class="empty-art" src="\/assets\/quiet-waters.webp"/);
  assert.match(html('no/'),/<noscript>/);
  assert.doesNotMatch(html('no/'),/https?:\/\/(fonts|www\.google|unpkg|cdn\.)/);

  const events=loadEvents();
  const published=events.filter(e=>e.status==='publisert');
  assert.equal(fs.readdirSync(path.join(output,'no/hendelse')).length,published.length);
  assert.equal(fs.readdirSync(path.join(output,'en/event')).length,published.length);
  // Vakt mot å publisere eit bygg som manglar oppslag: alle kommande, publiserte
  // arrangement skal finnast i oversikten (dette fanga at eit utdatert bygg la
  // seg over docs/ og sletta Alvins arrangement).
  const nowIso = new Date().toISOString().slice(0,16);
  const upcoming = published.filter(e=>(e.slutt||e.start).slice(0,16) >= nowIso);
  for (const e of upcoming) {
    assert.ok(html('no/').includes(`href="/no/hendelse/${e.id}/"`), `manglar i oversikten: ${e.id}`);
  }
  assert.ok(upcoming.length > 0, 'ingen kommande arrangement å vise');
  for (const event of published) {
    assert.ok(fs.existsSync(path.join(output,'no/hendelse',event.id,'index.html')));
    assert.ok(fs.existsSync(path.join(output,'en/event',event.id,'index.html')));
    if (event.eksempel) {
      assert.match(html('no/hendelse/'+event.id),/FIKTIVT EKSEMPEL/);
      assert.match(html('en/event/'+event.id),/FICTIONAL EXAMPLE/);
      assert.doesNotMatch(html('en/event/'+event.id),/Tickets and more information/);
    }
  }
  assert.equal(fs.readdirSync(path.join(output,'images')).filter(x=>x.endsWith('.webp')).length,
    fs.readdirSync(path.join(root,'images')).filter(x=>x.endsWith('.webp')).length);
  assert.equal(fs.readdirSync(path.join(output,'images/cards')).filter(x=>x.endsWith('.webp')).length,
    fs.readdirSync(path.join(root,'images/cards')).filter(x=>x.endsWith('.webp')).length);

});
