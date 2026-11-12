/* Framside-modulane til tromsø.net — faner, vêr- og ljosscene, «Skjer i dag»,
 * «Fire tall» og oppslagsstraumen. Byggetopp frå briefen 2026-11-10:
 * - Alle tal står i no.json (henta av scripts/fetch-now.js) og er krediterte.
 * - Ein feila kjelde skal gøymast, aldri fabulerast.
 * - Kunsten er utklipp i /assets/cutouts/<namn>.webp — byte av fil krev
 *   ingen kodeendring (namna er kontrakten).
 */
const { shell, cats, tr, filters } = require('./render');
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

/* ---------- vêr no: live Yr-panel ---------- */
/* Bob vedtok 2026-11-11: den teikna scena er HELT borte frå framsida.
 * Panelet viser været i Tromsø akkurat no, frå MET (Yr) — same kjelde,
 * to dataomgrep: byggjetalet frå now.json, og live-oppdatering i
 * nettlesaren via /assets/weather-live.js (api.met.no, kvart 10. min).
 * Aldri fabrikkerie tal: manglar no.json vêr, visast ikkje talet. */
const YR_TROMSO = 'https://www.yr.no/en/forecast/daily-table/1-305409/Norway/Troms/Troms%C3%B8/Troms%C3%B8';
const osloHm = iso => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(iso ? new Date(iso) : new Date());
const symbolSvg = code => `/assets/yr/${encodeURIComponent(String(code || 'clearsky_day'))}.svg`;

/* ---------- teksten under talet: daglengd, mørketid, midnattssol ---------- */
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

/* ---------- panelet ---------- */
function weatherNow(lang, now) {
  const w = now?.weather || {};
  const t = tagText(lang, now);
  const upd = w.updated ? osloHm(w.updated) : '';
  const temp = t.temp
    ? `<strong class="weather-temp">${esc(t.temp)}</strong>`
    : `<strong class="weather-temp weather-missing">${esc(tr(lang, 'Vêret er ikkje tilgjengeleg', 'Weather unavailable'))}</strong>`;
  const icon = w.symbol_code
    ? `<img class="weather-icon" src="${symbolSvg(w.symbol_code)}" alt="" width="84" height="84">`
    : '';
  const num = (lang, v) => lang === 'no' ? String(v).replace('.', ',') : String(v);
  const wind = w.wind != null
    ? `<span class="weather-wind">${esc(tr(lang, 'vind', 'wind'))} ${num(lang, w.wind)} m/s</span>`
    : '';
  return `<div class="front-hero"><section class="weather-now" data-lat="69.649" data-lon="18.956" data-lang="${lang}" aria-label="${esc(tr(lang, 'Været i Tromsø nå', 'Weather in Tromsø now'))}">
  <div class="weather-main">${icon}<div class="weather-facts">${temp}<div class="weather-sub">${wind}${t.note ? `<span class="weather-note">${esc(t.note)}</span>` : ''}</div></div></div>
  <p class="weather-credit"><a href="${YR_TROMSO}" rel="noopener noreferrer">${esc(tr(lang, 'Været nå i Tromsø', 'Weather now in Tromsø'))} — Yr</a>${upd ? ` · <span class="weather-updated">${esc(tr(lang, 'oppdatert', 'updated'))} ${esc(upd)}</span>` : ''}</p>
</section><script src="/assets/weather-live.js" defer></script></div>`;
}

/* ---------- panorama-header (Bob 2026-11-12, runde 2): IKKJE eit nytt band —
   Panoramautsikt-crop erstattar marmoren (.marble.webp) som bakgrunn i
   sjølve mastheaden på framsida. Overskrift/logo/faner står att i kvit. ---------- */

/* ---------- Skjer i dag ---------- */
/* Bob (2026-11-11): ingen FILM i denne bolken — filmar får sine eigne sider,
 * dei skal ikkje oppta plassen på framsida. Alt anna står urørt. */
const NOT_ON_FRONT = new Set(['Film']);
function skjerIDag(lang, upcoming, now = new Date()) {
  const oslo = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const today = oslo.slice(0, 10);
  const tomorrow = new Date(Date.parse(today + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
  const front = upcoming.filter(e => !(e.kategori || []).some(k => NOT_ON_FRONT.has(k)));
  const live = front.filter(e => e.start.slice(0, 10) === today && (e.slutt || e.start).slice(0, 16) >= `${today}T00:00`);
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
    const tmr = front.filter(e => e.start.slice(0, 10) === tomorrow);
    heading = tr(lang, 'Skjer i morgen', 'On tomorrow'); list = pick(tmr);
  }
  if (!list.length) return '';
  const eventsUrl = root(lang) + (lang === 'no' ? 'hva-skjer' : 'whats-on') + '/';
  const empty = `<div class="empty-state" data-empty hidden><h3>${tr(lang, 'Ingen treff i dag', 'No matches today')}</h3><p>${tr(lang, 'Prøv ein annan kategori, eller sjå alt som kjem.', 'Try another category, or see everything coming up.')}</p><p class="front-more"><a href="${eventsUrl}">${tr(lang, 'Se alt som skjer', 'See everything on')} <span aria-hidden="true">→</span></a></p></div>`;
  return `<section class="front-section skjer-idag" aria-labelledby="skjer-idag-h"><h2 id="skjer-idag-h">${esc(heading)}</h2><div class="event-grid front-events" data-filter-list>${list.map(e => card(e, lang, now)).join('')}</div>${empty}<p class="front-more"><a href="${eventsUrl}">${tr(lang, 'Se alt som skjer', 'See everything on')} <span aria-hidden="true">→</span></a></p></section>`;
}

/* ---------- Fire tall ---------- */
function statCard(lang, key, label, data) {
  // data = {value, note, source, updated} — manglar verdi = gøymst kortet.
  if (!data || data.value == null) return '';
  const d = data.updated ? new Date(data.updated) : null;
  const upd = d ? new Intl.DateTimeFormat(lang === 'no' ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(d) : '';
  const source = data.url
    ? `<a href="${esc(data.url)}" rel="noopener noreferrer">${esc(data.source)}</a>`
    : esc(data.source);
  return `<div class="stat-card" data-stat="${esc(key)}"><img class="stat-icon" src="/assets/cutouts/icon-${esc(key)}.webp" alt="" width="56" height="56"><strong class="stat-number">${esc(data.value)}</strong><span class="stat-label">${esc(label)}</span>${data.note ? `<small class="stat-note">${esc(data.note)}</small>` : ''}<small class="stat-source">${tr(lang, 'Kilde', 'Source')}: ${source}${upd ? ' · ' + esc(upd) : ''}</small></div>`;
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
  /* Hovudmenyen står PÅ marmoret (mast-extra i shell), i kvitt — Bob 2026-11-11.
   * Panorama i headeren og filterknappar under overskrifta — Bob 2026-11-12. */
  const body = `${filters(lang)}${weatherNow(lang, now)}${skjerIDag(lang, catalog.upcoming)}${fireTall(lang, now)}${oppslag(lang, now)}`;
  return shell(lang, tr(lang, 'Oppslag', 'Front'), body, langAlt, tabBar(lang, 'front'), 'page-front');
}
module.exports = { tabs, tabBar, tagText, weatherNow, symbolSvg, skjerIDag, fireTall, oppslag, frontPage, statCard };