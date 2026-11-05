#!/usr/bin/env node
// Skjermbilde av ein lokal, ferdig bygd versjon til samanlikning.
// Bruk: node scripts/shoot.js <base-url> <utmappe> [hendelse-sti]
//   node scripts/shoot.js http://localhost:8094 design/shots/v7
// Tek forsida (klikkar «Denne uken» først), ei hendelseside og om-sida
// ved 390 px (mobil) og 1440 px (skrivebord). Skriv også ut overflow-mål.
const puppeteer = require('puppeteer');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.argv[2] || 'http://localhost:8094';
const OUT = process.argv[3] || 'design/shots/v7';
const EVENT = process.argv[4] || '/no/hendelse/2026-11-14-fiktiv-familiedag/';

const PAGES = [
  ['home', '/no/'],
  ['event', EVENT],
  ['about', '/no/om/'],
];
const WIDTHS = [390, 1440];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const lines = [];
  for (const width of WIDTHS) {
    for (const [name, url] of PAGES) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: width === 390 ? 844 : 1000, deviceScaleFactor: 1 });
      await page.goto(BASE + url, { waitUntil: 'networkidle0' });
      await page.evaluate(() => document.fonts.ready);
      if (name === 'home') {
        await page.evaluate(() => {
          const t = document.querySelector('[data-time-filter="week"]');
          if (t) t.click();
        });
      }
      // last alle lazy-bilete innafor sida
      await page.evaluate(async () => {
        for (const img of document.images) img.loading = 'eager';
        await Promise.all([...document.images].map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(r => setTimeout(r, 400));
      const m = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
        cards: document.querySelectorAll('.event-card:not([hidden])').length,
      }));
      const file = `${name}-${width}.png`;
      await page.screenshot({ path: path.join(OUT, file), fullPage: true });
      lines.push(`${file}: overflow ${m.scroll}/${m.client}${m.scroll > m.client ? '  ⚠ VASSRETT SCROLL' : ''}  kort ${m.cards}`);
      await page.close();
    }
  }
  // éi avlasting med JavaScript avslått
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(BASE + '/no/', { waitUntil: 'networkidle0' });
  const nojs = await page.evaluate(() => document.querySelectorAll('.event-card:not([hidden])').length);
  await page.screenshot({ path: path.join(OUT, 'home-1440-nojs.png'), fullPage: true });
  lines.push(`utan JavaScript: ${nojs} kort synlege`);
  await browser.close();
  console.log(lines.join('\n'));
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
