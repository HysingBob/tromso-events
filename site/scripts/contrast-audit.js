#!/usr/bin/env node
// Visual audit for a locally served static build: contrast per text role, element
// geometry, overflow and broken images. Usage: node contrast-audit.js <port> [host]
// Requires puppeteer available to node (installed in this workspace if missing).
const puppeteer = require('puppeteer');

const SELECTORS = [
  ['masthead-tagline', '.brand p'],
  ['lang-nav', '.languages a'],
  ['eyebrow', '.eyebrow'],
  ['h1', 'h1'],
  ['section-label', '.section-label'],
  ['tab-active', '[aria-pressed="true"]'],
  ['card-kicker', '.card-kicker'],
  ['card-title', '.card-body h3'],
  ['card-meta', '.card-meta'],
  ['stamp-day', '.date-stamp strong'],
  ['footer-text', 'footer p'],
];

const PORT = process.argv[2] || '8080';
const HOST = process.argv[3] || 'localhost';
const PATH = process.argv[4] || '/no/';   // / er berre ein videresending til /no/

function lum([r, g, b]) {
  const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a, b) => {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  await page.goto(`http://${HOST}:${PORT}${PATH}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  // Standardfilteret er «I dag» og kan vere tomt — klikk «Denne uken» først.
  await page.evaluate(() => {
    const t = document.querySelector('[data-time-filter="week"]');
    if (t) t.click();
  });
  const data = await page.evaluate((sels) => {
    const parse = c => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const bgOf = el => {
      let n = el;
      while (n) {
        const bg = getComputedStyle(n).backgroundColor;
        const p = parse(bg);
        const a = (bg.match(/[\d.]+/g) || [])[3];
        if (p.length === 3 && (a === undefined || Number(a) > 0.6) && !/rgba\(0, 0, 0, 0\)/.test(bg)) return p;
        n = n.parentElement;
      }
      return [255, 255, 255];
    };
    const out = {};
    for (const [name, sel] of sels) {
      const el = document.querySelector(sel);
      if (!el) { out[name] = null; continue; }
      const cs = getComputedStyle(el);
      out[name] = { fg: parse(cs.color), bg: bgOf(el), size: parseFloat(cs.fontSize), weight: cs.fontWeight, family: cs.fontFamily.split(',')[0].replace(/['"]/g, '') };
    }
    const box = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
    out._boxes = { card: box('.event-card'), h1: box('h1'), grid: box('.event-grid') };
    out._overflow = { docScroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth };
    out._counts = { cards: document.querySelectorAll('.event-card').length, brokenImgs: [...document.images].filter(i => !i.complete || i.naturalWidth === 0).length };
    return out;
  }, SELECTORS);

  console.log('overflow:', JSON.stringify(data._overflow), 'counts:', JSON.stringify(data._counts));
  console.log('boxes:', JSON.stringify(data._boxes));
  for (const [name] of SELECTORS) {
    const d = data[name];
    if (!d) { console.log(`  ${name}: IKKE FUNNET`); continue; }
    const c = contrast(d.fg, d.bg);
    const flag = c >= 7 ? 'AAA' : c >= 4.5 ? 'AA' : c >= 3 ? 'AA-large' : 'LAV';
    console.log(`  ${name.padEnd(14)} ${d.size}px ${d.weight} ${d.family.padEnd(12)} kontrast ${c.toFixed(2)} ${flag}`);
  }
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
