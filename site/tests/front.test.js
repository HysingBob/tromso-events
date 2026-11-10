const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sceneRecipe, moonShift, tagText, statCard, frontPage, tabs, scene } = require('../lib/front');
const now = require('../src/_data/now.json');

test('scene recipes follow the MET symbol code table in the brief', () => {
  const light = r => sceneRecipe(r, false);
  const dark = r => sceneRecipe(r, true);
  assert.equal(light('clearsky_day').clouds, 0);
  assert.equal(light('partlycloudy_day').clouds, 1);
  assert.equal(light('fair_day').clouds, 1);
  assert.equal(light('cloudy').clouds, 3);
  assert.equal(light('cloudy').sky, null); // tre skyer gøymer himmelkroppen
  assert.equal(light('lightsnow').snow, 'normal');
  assert.equal(light('heavysnow').snow, 'heavy');
  assert.equal(light('heavyrain').rain, 'heavy');
  assert.equal(light('sleet').sleet, 'normal');
  assert.equal(light('fog').fog, true);
  assert.equal(dark('clearsky_night').sky, 'moon');
  assert.equal(dark('clearsky_night').aurora, true);  // mørkt og klart
  assert.equal(dark('clearsky_night').stars, true);
  assert.equal(dark('partlycloudy_night').aurora, false);
  assert.equal(light('snowshowers_day').clouds >= 2, true);
});

test('moon phase drives the shadow disc, never hard-coded', () => {
  assert.equal(moonShift(0), 0);          // nymåne: disken heilt over
  assert.equal(moonShift(0.5), 100);      // fullmåne: disken heilt av (0.02-off-cosen)
  assert.equal(moonShift(0.25), 50);      // halv: halvvegs
  assert.ok(moonShift(0.02) < 10);
});

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

test('front page renders tabs, scene and MET credit from real now.json', () => {
  const html = frontPage('no', { upcoming: [] }, now, '/en/');
  assert.match(html, /class="tab" href="\/no\/landing\/"/);
  assert.match(html, /class="tab" href="\/no\/hva-skjer\//);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /data-symbol="[a-z_]+"/);
  assert.match(html, /Værdata: MET Norway/);
  assert.ok(tabs.length === 4);
});

test('scene background asset sits on the wood wall without duplicate layer pieces', () => {
  const html = scene('no', now);
  assert.match(html, /data-scene-bg="1"/);            // bakgrunnsmodus er på
  assert.doesNotMatch(html, /class="scene-piece"/);   // ingen utklipp oppå teikninga
  assert.match(html, /scene-tag/);                    // etiketten står att
  assert.match(html, /Dagen er/);                     // med rekna lysdata
});
