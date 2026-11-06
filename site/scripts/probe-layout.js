#!/usr/bin/env node
// Layout probe for a locally served tromsø.net build.
//   node scripts/probe-layout.js <port> [path]
//
// Reports the geometry that has actually gone wrong in this project before —
// quote these numbers in a report instead of saying "it looks right".
//
// Checks per viewport (1440 / 390 / 360):
//   * horizontal scroll (scrollWidth vs clientWidth)
//   * hero image: rendered w/h and ratio (must be ~1.5)
//   * masthead: logo box, subtitle on its own line below it, and their right edges
//   * NO/EN switch and filter row: same row right of the logo on desktop, below it
//     on phones, and never overlapping the logo
//   * 4xx responses (missing textures after a texture cleanup)
const puppeteer = require('puppeteer');
const PORT = process.argv[2] || '8094';
const PATH = process.argv[3] || '/no/';
const BASE = `http://localhost:${PORT}${PATH}`;
const EVENT = '/no/hendelse/';

const overlap = (a, b) =>
  !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  for (const w of [1440, 390, 360]) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: 844 });
    const bad = [];
    page.on('response', r => { if (r.status() >= 400) bad.push(r.url().split('/').pop()); });
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    const home = await page.evaluate(() => {
      const box = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
      const img = document.querySelector('.brand-link img').getBoundingClientRect();
      const el = document.querySelector('.brand p');
      const range = document.createRange(); range.selectNodeContents(el);
      const sub = range.getBoundingClientRect();
      return {
        logo: { x: Math.round(img.x), y: Math.round(img.y), w: Math.round(img.width), h: Math.round(img.height) },
        // The wordmark SVG carries ~2.9 units (1.9 % of its width) of empty
        // space right of the letters — compare against the visible edge, not
        // the img box.
        logoVisibleRight: Math.round(img.right - 2.9 * (img.height / 24)),
        sub: { x: Math.round(sub.x), y: Math.round(sub.y), right: Math.round(sub.right) },
        lang: box('.languages'), filters: box('.mast-extra'),
        overflow: document.documentElement.scrollWidth + '/' + document.documentElement.clientWidth,
      };
    });
    // one event page: hero ratio
    let hero = null;
    const link = await page.evaluate(() => { const a = document.querySelector('a[href*="/hendelse/"]'); return a ? a.getAttribute('href') : null; });
    if (link) {
      await page.goto(`http://localhost:${PORT}${link}`, { waitUntil: 'networkidle0' });
      hero = await page.evaluate(() => {
        const i = document.querySelector('.detail-art img'); const r = i.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), ratio: +(r.width / r.height).toFixed(2), loaded: i.complete && i.naturalWidth > 0 };
      });
    }
    console.log(`--- ${w} px ---`);
    console.log('  overflow        ', home.overflow);
    console.log('  hero            ', JSON.stringify(hero), hero && hero.ratio > 1.4 && hero.ratio < 1.6 ? 'OK' : 'SJÅ ETTER (skal vera ~1.5)');
    console.log('  logo            ', JSON.stringify(home.logo));
    console.log('  subtitle        ', JSON.stringify(home.sub), 'eiga linje:', home.sub.y >= home.logo.y + home.logo.h,
      '| høgrekant-skilnad:', (home.sub.right - home.logoVisibleRight).toFixed(1));
    console.log('  NO/EN           ', JSON.stringify(home.lang));
    console.log('  filter          ', JSON.stringify(home.filters),
      '| overlapp med logo:', overlap(home.logo, home.filters),
      '| høgre for logo:', home.filters && home.filters.x >= home.logo.x + home.logo.w,
      '| under logo:', home.filters && home.filters.y >= home.logo.y + home.logo.h);
    console.log('  4xx             ', bad.length ? bad.join(',') : 'ingen');
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
