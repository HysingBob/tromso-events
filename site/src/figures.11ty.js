// /tall/ — plassholder (Tromsø i tall får eige innhold seinare).
const { shell, tr } = require('../lib/render');
module.exports = class {
  data(){return {pagination:{data:'pages.locales',size:1,alias:'lang'},permalink:({lang})=>`/${lang}/${lang==='no'?'tall':'figures'}/index.html`};}
  render({lang}){
    const body=`<div class="page-heading"><h1>${tr(lang,'Tromsø i tall','Tromsø in figures')}</h1><p>${tr(lang,'Denne siden får eget innhold seinere.','This page gets its own content later.')}</p></div>`;
    return shell(lang,tr(lang,'Tromsø i tall','Tromsø in figures'),body,`/${lang==='no'?'en':'no'}/${lang==='no'?'tall':'figures'}/`);
  }
};
