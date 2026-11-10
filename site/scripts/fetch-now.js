#!/usr/bin/env node
/* Henter server-sidedata til framsida: MET Locationforecast (noverande time),
 * MET Sunrise (soloppgång/nedgang + polararbeid), månefase (rekna), SSB folkemengd.
 * Reglane i briefen: aldri fabrikkerie tal — feila kjelder behald sist kjende
 * verdi frå no.json, elles gøymst kortet. Skriv site/src/_data/now.json.
 * Køyres av GitHub Actions (refresh.yml) og kan køyrast lokalt.
 */
const fs = require('node:fs');
const path = require('node:path');
const UA = 'tromso.net/1.0 (https://xn--troms-zua.net; kontakt: hysinghenrik@gmail.com)';
const LAT = 69.649, LON = 18.956;
const ZONE = 'Europe/Oslo';
const HERE = path.join(__dirname, '..');
const OUT = path.join(HERE, 'src/_data/now.json');
const NOW_FILE = OUT;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function metGet(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (res.status === 429 || res.status >= 500) { await sleep(1500 * (i + 1)); continue; }
      if (!res.ok) throw new Error(`MET ${res.status} ${url}`);
      return await res.json();
    } catch (e) { if (i === tries - 1) throw e; await sleep(1500 * (i + 1)); }
  }
}

/* Oslo-lokal dato utan sekund/i såkalte ISO-format: 2026-11-10T14:30 */
const osloFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const osloNow = (d = new Date()) => osloFmt.format(d).replace(' ', 'T');
const osloDate = (d = new Date()) => osloNow(d).slice(0, 10);

/* ---- MET Sunrise: https://api.met.no/weatherapi/sunrise/3.0/sun?lat&lon&date&offset ---- */
async function sunData(dateStr) {
  const off = new Date('2000-01-01T12:00:00Z'); // +01:00
  const url = `https://api.met.no/weatherapi/sunrise/3.0/sun?lat=${LAT}&lon=${LON}&date=${dateStr}&offset=+01:00`;
  return metGet(url);
}
/* Solær reknast frå polar-målera; MET Sunrise gir polar_night_start etc. på datar
 * utan soloppgång. "Mørketid"-teksten: tal dagar til første dag sola står opp att. */
function sunSummary(today, nextDays) {
  // today/nextDays: {date, sunrise:'...', sunset:'...'} eller null dersom polar
  const sunrise = today?.time?.find?.(x => x?.event === 'sunrise') || null;
  return { sunrise, sunset: today?.time?.find?.(x => x?.event === 'sunset') || null };
}

/* ---- Locationforecast compact: symbol_code + temperatur for current hour ---- */
async function weatherNow() {
  const j = await metGet(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${LAT}&lon=${LON}`);
  const nowIso = osloNow();
  const times = j.properties.timeseries.map(t => ({ time: t.time, data: t.data }));
  // Finn timen som gjeld no: første med time <= no < neste.
  let cur = times[0];
  for (const t of times) { if (t.time.replace(/Z$/, '+00:00') && t.time.slice(0, 16) <= nowIso) cur = t; else break; }
  // t.time er UTC; konverter Oslo: samanlikn via Date.
  const nowMs = Date.now();
  let best = null;
  for (const t of times) {
    const ms = Date.parse(t.time);
    if (ms <= nowMs && (!best || ms > Date.parse(best.time))) best = t;
  }
  const d = best?.data || times[0]?.data || {};
  const next = d.next_1_hours || d.next_6_hours || d.next_12_hours || {};
  return {
    symbol_code: next?.summary?.symbol_code || null,
    temperature: d.instant?.details?.air_temperature ?? null,
    wind: d.instant?.details?.wind_speed ?? null,
    series_time: best?.time || null,
  };
}

/* ---- Månefase: rekna frå dato, ingen API. 0 = nymåne, 0.5 = fullmåne. ---- */
function moonPhase(date) {
  const known = Date.UTC(2000, 0, 6, 18, 14); // kjend nymåne 2000-01-06 18:14 UTC
  const synodic = 29.530588853 * 86400000;
  const days = (date.getTime() - known) % synodic;
  return ((days / synodic) % 1 + 1) % 1;
}
function moonName(p) {
  if (p < 0.03 || p > 0.97) return 'nymåne';
  if (Math.abs(p - 0.5) < 0.03) return 'fullmåne';
  return p < 0.5 ? 'nedadgående' : 'oppadgående';
}

/* ---- Daglengd + endring, mørketid/midnattssol frå MET-sunrise ---- */
function dayLength(sun) { // sun = {sunrise:{time}, sunset:{time}} i UTC ISO
  if (!sun.sunrise || !sun.sunset) return null;
  return (Date.parse(sun.sunset.time) - Date.parse(sun.sunrise.time)) / 60000; // minutt
}
async function lightInfo() {
  const todayStr = osloDate();
  async function sun(dateStr) { return sunData(dateStr).catch(() => null); }
  // MET Sunrise 3.0: properties.sunrise = {time, azimuth} (selve soloppgangshendinga).
  const pick = (obj) => obj?.properties || null;
  const t = await sun(todayStr);
  const y = await sun(new Date(Date.parse(todayStr + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10));
  const today = pick(t), yesterday = pick(y);
  const rise = today?.sunrise?.time || null, set = today?.sunset?.time || null;
  const yRise = yesterday?.sunrise?.time || null, ySet = yesterday?.sunset?.time || null;
  const len = (rise && set) ? (Date.parse(set) - Date.parse(rise)) / 60000 : null;
  const lenY = (yRise && ySet) ? (Date.parse(ySet) - Date.parse(yRise)) / 60000 : null;
  const change = len != null && lenY != null ? len - lenY : null;
  let polar = null;
  if (!rise) {
    // Ingen soloppgang i dag: mørketid (finn første dag med soloppgång att)
    // eller midnattssol (ingen solnedgang; finn første dag med solnedgang att).
    const noSet = !set;
    const key = noSet ? 'sunset' : 'sunrise';
    let found = null;
    for (let i = 1; i < 70 && !found; i += 1) {
      const ds = new Date(Date.parse(todayStr + 'T12:00:00Z') + i * 86400000).toISOString().slice(0, 10);
      const s = await sun(ds);
      const p = pick(s);
      if (p?.[key]?.time) found = { date: ds, count: i };
    }
    polar = { kind: noSet ? 'midnight_sun' : 'polar_night', days: found?.count ?? null, date: found?.date ?? null };
  }
  return {
    date: todayStr,
    sunrise: rise,
    sunset: set,
    dark: (function(){ // mørkt = sola under horisonten akkurat no
      if (!rise && !set) return true;
      const n = Date.now();
      return !rise ? n < Date.parse(set) : !set ? n > Date.parse(rise) : (n < Date.parse(rise) || n > Date.parse(set));
    })(),
    day_length: len, day_change: change,
    polar,
  };
}

/* ---- SSB: folkemengd, tabell 12744 (Kommunefakta) via data.ssb.no ---- */
async function ssbPopulation() {
  // Fylkesinndelt folkemengd: tabell 07425 gir kommunar; vi tar Tromsø kommune.
  const url = 'https://data.ssb.no/api/v0/no/table/07425';
  const query = { query: [{ selection: { filter: 'item', values: ['5401'] } }], response: { format: 'json' } };
  // 07425 har region/innholdsinnhald; prøv generisk: kvar tabell har ulik kode.
  // Vi nyttar heller "Kommunefakta"-API (factomata)? Hald det enkelt: 12978 = folkemengd per kommune.
  const j2 = await metGet('https://data.ssb.no/api/v0/no/table/12978?csv=1').catch(() => null);
  return null; // sett opp skikkeleg i runde 2 — kortet gøymst til då
}

async function main() {
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const next = { fetched_at: new Date().toISOString(), fetched_at_oslo: osloNow() };
  let failures = [];
  // Vêret: ved feil behold sist kjende (brief-regel).
  try {
    const w = await weatherNow();
    next.weather = { ...w, source: 'MET Norway', updated: new Date().toISOString() };
  } catch (e) { failures.push('weather'); if (prev.weather) next.weather = prev.weather; }
  try {
    const l = await lightInfo();
    next.light = l;
  } catch (e) { failures.push('light'); if (prev.light) next.light = prev.light; }
  // Måne er alltid rekna lokalt — aldri feil.
  const p = moonPhase(new Date());
  next.moon = { phase: +p.toFixed(4), name: moonName(p), source: 'tromso.net (berekna)', updated: new Date().toISOString() };
  fs.writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  console.log('now.json oppdatert:', JSON.stringify({ weather: next.weather?.symbol_code, temp: next.weather?.temperature, dark: next.light?.dark, moon: next.moon.name, polar: next.light?.polar?.kind, day_length: next.light?.day_length, failures }));
  if (failures.length) console.log('FEILA KJELDER (held gammal verdi):', failures.join(','));
}
main().catch(e => { console.error('Kritisk feil, now.json ikkje endra:', e.message); process.exit(1); });