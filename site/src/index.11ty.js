const {listing} = require('../lib/render');
module.exports = class {
  data(){return {pagination:{data:'pages.locales',size:1,alias:'lang'},permalink:({lang})=>`/${lang}/index.html`};}
  render({lang,catalog}){return listing(lang,catalog.upcoming);}
};
