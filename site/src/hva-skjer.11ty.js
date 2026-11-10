// /hva-skjer/ — same arrangementsliste som hovudsida, på eigen URL så
// landing-fanen «Hva skjer» fungerer på testbygget.
const { listing } = require('../lib/render');
module.exports = class {
  data(){return {pagination:{data:'pages.locales',size:1,alias:'lang'},permalink:({lang})=>`/${lang}/${lang==='no'?'hva-skjer':'whats-on'}/index.html`};}
  render({lang,catalog}){return listing(lang,catalog.upcoming,new Date(),null);}
};
