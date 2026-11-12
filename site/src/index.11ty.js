// Hovudsida /no/ er no v8-framsida «Oppslag» (panorama i mastheaden, filterknappar,
// Skjer i dag) — Bob 2026-11-12. Heile arrangementslista står på /hva-skjer/.
const { frontPage } = require('../lib/front');
const now = require('../src/_data/now.json');
module.exports = class {
  data(){return {pagination:{data:'pages.locales',size:1,alias:'lang'},permalink:({lang})=>`/${lang}/index.html`};}
  render({lang,catalog}){
    const other = lang==='no'?'en':'no';
    return frontPage(lang,catalog,now,`/${other}/`)
      .replace('</head>','<link rel="stylesheet" href="/assets/style-v8.css"></head>');
  }
};
