const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tagText, statCard, frontPage, tabs, weatherNow } = require('../lib/front');
const now = require('../src/_data/now.json');

test('tag text: day length, mørketid and midnight sun are calculated', () => {
  const dag = tagText('no', { weather:{temperature:1}, light:{ day_length:302, day_change:-10 } });
  assert.match(dag.note, /Dagen er 5 t 2 min/);
  assert.match(dag.note, /10 min kortere enn i går/);
  const morketid = tagText('no', { weather:{}, light:{ polar:{ kind:'polar_night', days:63 } } });
  assert.match(morketid.note, /Sola tilbake om 63 dager/);
  const midnatt = tagText('en', { weather:{}, light:{ polar:{ kind:'midnight_sun', days:21 } } });
  assert.match(midnatt.note, /The sun sets again in 21 days/);
});

test('a missing source hides the card instead of inventing a number', () => {
  assert.equal(statCard('no', 'boat', 'fartøy i havn nå', { value: 23, source: 'Kystverket' }).includes('23'), true);
  assert.equal(statCard('no', 'boat', 'fartøy i havn nå', null), '');
  assert.equal(statCard('no', 'bus', 'busser i rute', { value: null, source: 'Entur' }), '');
});

test('front page renders tabs and the live Yr panel from real now.json', () => {
  const html = frontPage('no', { upcoming: [] }, now, '/en/');
  assert.match(html, /class="tab" href="\/no\/landing\/"/);
  assert.match(html, /class="tab" href="\/no\/hva-skjer\//);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /class="weather-now" data-lat="69.649"/);
  assert.match(html, /weather-live\.js/);
  assert.match(html, /assets\/yr\//);
  assert.match(html, /Yr<\/a>/);
  assert.ok(tabs.length === 4);
});


test('weather panel: real numbers from now.json, Yr credit and Tromsø link', () => {
  const html = weatherNow('no', now);
  const en = weatherNow('en', now);
  const r = Math.round(now.weather.temperature);
  const expect = `${r}°`;  // same rounding as tagText: Math.round(-0.5) => "0", ikkje "-0"
  assert.ok(html.includes(`class="weather-temp">${expect}</strong>`), 'temp ' + expect);
  assert.match(html, new RegExp('weather-icon[^>]+yr/' + now.weather.symbol_code + '.svg'));
  // vind: avleia frå now.json (no.json vert ferska av Actions — aldri hardkoda tal)
  const wv = now.weather.wind;
  if (wv != null) {
    assert.match(html, new RegExp('vind ' + String(wv).replace('.', ',') + ' m/s'));
    assert.match(en, new RegExp('wind ' + String(wv) + ' m/s'));
  }
  assert.match(html, /Været nå i Tromsø — Yr<\/a>/);
  assert.match(html, /1-305409/);
  assert.match(en, /Weather now in Tromsø — Yr<\/a>/);
});

test('missing weather data hides numbers instead of inventing them', () => {
  const html = weatherNow('no', { weather: {} });
  assert.match(html, /weather-missing/);
  assert.doesNotMatch(html, /weather-temp">\S°/);
  assert.doesNotMatch(html, /weather-icon/);
  assert.doesNotMatch(html, /oppdatert/);
});
