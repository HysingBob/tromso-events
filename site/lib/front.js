/* Framside-modulane til tromsø.net — faner, vêr- og ljosscene, «Skjer i dag»,
 * «Fire tall» og oppslagsstraumen. Byggetopp frå briefen 2026-11-10:
 * - Alle tal står i no.json (henta av scripts/fetch-now.js) og er krediterte.
 * - Ein feila kjelde skal gøymast, aldri fabulerast.
 * - Kunsten er utklipp i /assets/cutouts/<namn>.webp — byte av fil krev
 *   ingen kodeendring (namna er kontrakten).
 */
const { shell, cats, tr } = require('./render');
const fs = require('node:fs');
const path = require('node:path');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const root = lang => `/${lang}/`;

/* ---------- faner ---------- */
const tabs = [
  { key: 'front', no: 'Oppslag', en: 'Front', url: l => root(l)+'landing/' },
  { key: 'events', no: 'Hva skjer', en: "What's on", url: l => root(l) + (l === 'no' ? 'hva-skjer' : 'whats-on') + '/' },
  { key: 'figures', no: 'Tromsø i tall', en: 'Tromsø in figures', url: l => root(l) + (l === 'no' ? 'tall' : 'figures') + '/' },
  { key: 'about', no: 'Om siden', en: 'About', url: l => root(l) + (l === 'no' ? 'om' : 'about') + '/' },
];
function tabBar(lang, active) {
  return `<nav class="site-tabs" aria-label="${tr(lang, 'Hovedmeny', 'Main menu')}"><ul>${tabs.map(t => `<li${t.key === active ? ' aria-current="page"' : ''}><a class="tab" href="${t.url(lang)}">${esc(t[lang])}</a></li>`).join('')}</ul></nav>`;
}

/* ---------- vêr-oppskrift: symbol_code -> lag ---------- */
/* Bertit MET sine symbolnamn. 0–3 skyer, himmelkropp, stjerner, aurora, nedbør, tåke. */
function sceneRecipe(symbol, dark) {
  const s = String(symbol || 'clearsky');
  const base = s.replace(/_(day|night|polartwilight)$/, '');
  const heavy = /heavy/.test(base);
  const r = {
    sky: 'sun',      // sol om dagen, måne om natta — sett nedanfor
    clouds: 0, cloudsDark: dark,
    rain: null, snow: null, sleet: null, fog: false,
    aurora: false, stars: false,
  };
  if (base.startsWith('fair') || base === 'partlycloudy') r.clouds = 1;
  else if (base === 'cloudy') r.clouds = 3;
  else if (/rain$|rainshowers/.test(base) && base !== 'rainshowers') { /* nedanfor */ }
  if (/heavysnow|snow$|snowshowers/.test(base)) r.snow = heavy ? 'heavy' : 'normal';
  else if (/heavysleet|sleet$|sleetshowers/.test(base)) r.sleet = heavy ? 'heavy' : 'normal';
  else if (/heavyrain|rain$|rainshowers/.test(base)) r.rain = heavy ? 'heavy' : 'normal';
  if (base === 'fog') r.fog = true;
  if (r.rain || r.snow || r.sleet) r.clouds = Math.max(r.clouds, heavy ? 3 : 2);
  if (dark) {
    r.sky = 'moon';
    const clear = base.startsWith('clearsky') || base === 'fair';
    if (clear) { r.stars = true; r.aurora = true; }
  }
  // Sky-morken er berre himmelen å sjå; «cloudy» gøymer himmelkroppen.
  if (r.clouds >= 3) r.sky = null;
  return r;
}

/* månefase -> kor langt skyvefdisken er over: 0 = full, 0.5 (motsett side). */
function moonShift(phase) {
  return Math.round(Math.min(phase, 1 - phase) * 2 * 100); // % frå venstre, 0 = fullmåne
}

/* ---------- teksten på etiketten ---------- */
function fmtDayLen(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return `${h} t ${m} min`;
}
function tagText(lang, now) {
  if (!now) return { temp: '', note: '' };
  const w = now.weather || {}, l = now.light || {}, moon = now.moon || {};
  const temp = w.temperature != null ? `${Math.round(w.temperature)}°` : '';
  let note = '';
  if (l.polar && l.polar.kind === 'polar_night' && l.polar.days != null) {
    note = tr(lang, `Sola tilbake om ${l.polar.days} dager`, `Sun returns in ${l.polar.days} days`);
  } else if (l.polar && l.polar.kind === 'midnight_sun' && l.polar.days != null) {
    note = tr(lang, `Sola går ned igjen om ${l.polar.days} dager`, `The sun sets again in ${l.polar.days} days`);
  } else if (l.day_length != null) {
    const c = l.day_change != null ? ` · ${Math.abs(Math.round(l.day_change))} min ${l.day_change < 0 ? tr(lang, 'kortere', 'shorter') : tr(lang, 'lengre', 'longer')} ${tr(lang, 'enn i går', 'than yesterday')}` : '';
    note = `${tr(lang, 'Dagen er', 'Day length')} ${fmtDayLen(l.day_length)}${c}`;
  }
  return { temp, note };
}

/* ---------- scena ---------- */
function piece(name, alt, style = '') {
  return `<img class="scene-piece" src="/assets/cutouts/${name}.webp" alt="${esc(alt)}" style="${style}">`;
}
function scene(lang, now) {
  const w = now?.weather || {};
  const l = now?.light || {};
  const recipe = sceneRecipe(w.symbol_code, l.dark !== false); // manglar ljosdata = trur mørkt (tryggast)
  const moon = now?.moon || {};
  const parts = [];
  // lag 1: himmelkropp
  if (recipe.sky === 'sun') parts.push(piece('sun', tr(lang, 'Sol', 'Sun'), 'z-index:1'));
  else if (recipe.sky === 'moon') {
    const shift = moonShift(moon.phase ?? 0.5);
    parts.push(`<span class="moon-wrap" style="z-index:1">${piece('moon-full', tr(lang, 'Fullmåne', 'Full moon'))}${shift > 0 ? piece('moon-shadow', tr(lang, 'Måneskygge', 'Moon shadow'), `transform:translateX(${shift}%)`) : ''}</span>`);
  }
  // lag 2/3: aurora og stjerner (berre mørkt + klart)
  if (recipe.aurora) parts.push(piece('aurora-1', tr(lang, 'Nordlys', 'Aurora'), 'z-index:2'), piece('aurora-2', '', 'z-index:2'));
  if (recipe.stars) parts.push(piece('stars', tr(lang, 'Stjerner', 'Stars'), 'z-index:3'));
  // lag 4: skyer
  for (let i = 0; i < recipe.clouds; i++) parts.push(piece(`cloud-${1 + (i % 3)}`, tr(lang, 'Sky', 'Cloud'), `z-index:${4 + i};${i === 0 ? ' --cover:1' : ''}`));
  // lag 5: nedbør
  if (recipe.rain) parts.push(piece(recipe.rain === 'heavy' ? 'rain-heavy' : 'rain', tr(lang, 'Regn', 'Rain'), 'z-index:7'));
  if (recipe.snow) parts.push(piece(recipe.snow === 'heavy' ? 'snow-heavy' : 'snow', tr(lang, 'Snø', 'Snow'), 'z-index:7'));
  if (recipe.sleet) parts.push(piece('sleet', tr(lang, 'Sludd', 'Sleet'), 'z-index:7'));
  if (recipe.fog) parts.push(piece('fog', tr(lang, 'Tåke', 'Fog'), 'z-index:8'));
  // lag 6: etiketten
  const t = tagText(lang, now);
  parts.push(`<div class="scene-tag" style="z-index:9">${t.temp ? `<strong>${esc(t.temp)}</strong>` : ''}${t.note ? `<span>${esc(t.note)}</span>` : ''}</div>`);
  return `<div class="scene" data-symbol="${esc(w.symbol_code || '')}" data-dark="${l.dark ? '1' : '0'}"><div class="scene-layers" aria-hidden="${parts.length ? 'false' : 'true'}">${parts.join('')}</div>${w.source ? `<p class="scene-credit">${tr(lang, 'Værdata', 'Weather data')}: ${esc(w.source)}</p>` : ''}</div>`;
}

/* ---------- Skjer i dag ---------- */
function skjerIDag(lang, upcoming, now = new Date()) {
  const oslo = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const today = oslo.slice(0, 10);
  const tomorrow = new Date(Date.parse(today + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
  const live = upcoming.filter(e => e.start.slice(0, 10) === today && (e.slutt || e.start).slice(0, 16) >= `${today}T00:00`);
  const { card } = require('./render');
  const pick = (list) => {
    // Raudskap over kategoriar: gå gjennom lista og hopp over meir enn éi
    // av same kategori om det finst ein annan.
    const seen = new Set(); const out = [];
    for (const e of list) {
      const cat = (e.kategori || [])[0] || 'Annet';
      if (seen.has(cat)) continue;
      seen.add(cat); out.push(e);
    }
    for (const e of list) { if (!out.includes(e)) out.push(e); }
    return out.slice(0, 4);
  };
  let heading, list;
  if (live.length) { heading = tr(lang, 'Skjer i dag', 'On today'); list = pick(live); }
  else {
    const tmr = upcoming.filter(e => e.start.slice(0, 10) === tomorrow);
    heading = tr(lang, 'Skjer i morgen', 'On tomorrow'); list = pick(tmr);
  }
  if (!list.length) return '';
  const eventsUrl = root(lang) + (lang === 'no' ? 'hva-skjer' : 'whats-on') + '/';
  return `<section class="front-section skjer-idag" aria-labelledby="skjer-idag-h"><h2 id="skjer-idag-h">${esc(heading)}</h2><div class="event-grid front-events">${list.map(e => card(e, lang, now)).join('')}</div><p class="front-more"><a href="${eventsUrl}">${tr(lang, 'Se alt som skjer', 'See everything on')} <span aria-hidden="true">→</span></a></p></section>`;
}

/* ---------- Fire tall ---------- */
function statCard(lang, key, label, data) {
  // data = {value, note, source, updated} — manglar verdi = gøymst kortet.
  if (!data || data.value == null) return '';
  const d = data.updated ? new Date(data.updated) : null;
  const upd = d ? new Intl.DateTimeFormat(lang === 'no' ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(d) : '';
  return `<div class="stat-card" data-stat="${esc(key)}"><img class="stat-icon" src="/assets/cutouts/icon-${esc(key)}.webp" alt="" width="56" height="56"><strong class="stat-number">${esc(data.value)}</strong><span class="stat-label">${esc(label)}</span>${data.note ? `<small class="stat-note">${esc(data.note)}</small>` : ''}<small class="stat-source">${tr(lang, 'Kilde', 'Source')}: ${esc(data.source)}${upd ? ' · ' + esc(upd) : ''}</small></div>`;
}
function fireTall(lang, now) {
  const s = now?.stats || {};
  const cards = [
    statCard(lang, 'people', tr(lang, 'innbyggere', 'residents'), s.people),
    statCard(lang, 'suitcase', tr(lang, 'besøkende per natt', 'guests per night'), s.suitcase),
    statCard(lang, 'boat', tr(lang, 'fartøy i havn nå', 'vessels in harbour now'), s.boat),
    statCard(lang, 'bus', tr(lang, 'busser i rute nå', 'buses in service now'), s.bus),
  ].filter(Boolean);
  if (!cards.length) return '';
  const figuresUrl = root(lang) + (lang === 'no' ? 'tall' : 'figures') + '/';
  return `<section class="front-section fire-tall" aria-labelledby="fire-tall-h"><h2 id="fire-tall-h">${tr(lang, 'Tromsø i tall', 'Tromsø in figures')}</h2><div class="stat-grid">${cards.join('')}</div><p class="front-more"><a href="${figuresUrl}">${tr(lang, 'Se alle tall', 'See all figures')} <span aria-hidden="true">→</span></a></p></section>`;
}

/* ---------- Oppslagsstraumen ---------- */
function noticeCard(lang, n) {
  const d = n.published ? new Date(n.published) : null;
  const pub = d ? new Intl.DateTimeFormat(lang === 'no' ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'long' }).format(d) : '';
  const fetched = n.fetched ? new Date(n.fetched) : null;
  const fet = fetched ? new Intl.DateTimeFormat(lang === 'no' ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(fetched) : '';
  return `<a class="notice-card" href="${esc(n.url)}" rel="noopener noreferrer"><h3>${esc(n.title)}</h3>${n.text ? `<p>${esc(n.text)}</p>` : ''}<p class="notice-meta">${esc(n.source)}${pub ? ' · ' + esc(pub) : ''}${fet ? ` <span class="notice-fetched">(${tr(lang, 'hentet', 'fetched')} ${esc(fet)})</span>` : ''}</p><span class="notice-link">${tr(lang, 'Les mer hos', 'Read more at')} ${esc(n.source)} <span aria-hidden="true">→</span></span></a>`;
}
function oppslag(lang, now) {
  const list = (now?.notices || []).slice(0, 10);
  if (!list.length) return '';
  return `<section class="front-section oppslag" aria-labelledby="oppslag-h"><h2 id="oppslag-h">${tr(lang, 'Oppslagstavle', 'Notice board')}</h2><div class="notice-feed">${list.map(n => noticeCard(lang, n)).join('')}</div></section>`;
}

/* ---------- heile framsida ---------- */
function frontPage(lang, catalog, now, langAlt) {
  const body = `${tabBar(lang,'front')}<div class="front-hero">${scene(lang, now)}</div>${skjerIDag(lang, catalog.upcoming)}${fireTall(lang, now)}${oppslag(lang, now)}`;
  return shell(lang, tr(lang, 'Oppslag', 'Front'), body, langAlt, '', 'page-front');
}
module.exports = { tabs, tabBar, sceneRecipe, moonShift, tagText, scene, skjerIDag, fireTall, oppslag, frontPage, statCard };