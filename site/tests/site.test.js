const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { loadEvents,osloNow } = require('../lib/events');
const render = require('../lib/render');
const root = path.join(__dirname,'..');
const output = path.join(root,'_site');
const html = p=>fs.readFileSync(path.join(output,p,'index.html'),'utf8');
test('Eleventy builds both languages and all four page types without third-party assets', () => {
  execFileSync('npm',['run','build'],{cwd:root,stdio:'pipe'});
  for (const p of ['no/','en/','no/om/','en/about/','no/landing/','en/landing/','no/hva-skjer/','no/tall/','no/kategori/konsert/','en/category/concert/']) assert.match(html(p),/<html lang="(no|en)"/);
  assert.match(html('no/'),/<meta name="robots" content="noindex,nofollow">/);

  assert.match(html('no/'),/data-category-filter="Konsert"/);
  // Tidsfanene (I dag / Til helgen / Alt) er tekne bort — lista er kronologisk.
  assert.doesNotMatch(html('no/'),/data-time-filter=/);
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
  // Merk: tidene i events/ er Oslo-lokal tid, så «no» må reknast i Oslo, ikkje UTC —
  // elles trur testen at eit arrangement som enda for under ein time sidan er komande.
  const nowIso = osloNow();
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

test('cinema cards and detail pages show all verified same-day showtimes', () => {
  const event = { id:'2026-11-10-test-film', start:'2026-11-10T20:15', sted:'Aurora kino Fokus', kategori:['Film'], malgruppe:['18+'], gratis:false, visningstider:['17:30','20:15'], no:{tittel:'Testfilm',ingress:'',tekst:''}, en:{title:'Test Film',lead:'',text:''} };
  const cardHtml = render.card(event,'no');
  assert.match(cardHtml,/17:30, 20:15/);
  const pageHtml = render.eventPage('no',event,[event]);
  assert.match(pageHtml,/17:30, 20:15/);
});
