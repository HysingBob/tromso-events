// Testside: heile v8-framsida som LIVE PREVIEW på /landing — hovudsida er urørt.
// v8-stylen injiserast berre her (CI bygger framleis med THEME=v7).
const { frontPage } = require('../lib/front');
const now = require('../src/_data/now.json');
module.exports = class {
  data(){return {pagination:{data:'pages.locales',size:1,alias:'lang'},permalink:({lang})=>`/${lang}/landing/index.html`};}
  render({lang,catalog}){
    const other = lang==='no'?'en':'no';
    return frontPage(lang,catalog,now,`/${other}/landing/`)
      .replace('</head>','<link rel="stylesheet" href="/assets/style-v8.css"></head>');
  }
};
