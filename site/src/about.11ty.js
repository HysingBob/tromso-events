const {about} = require('../lib/render');
module.exports = class {
  data(){return {pagination:{data:'pages.locales',size:1,alias:'lang'},permalink:({lang})=>lang==='no'?'/no/om/index.html':'/en/about/index.html'};}
  render({lang}){return about(lang);}
};
