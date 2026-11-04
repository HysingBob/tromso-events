const {listing,cats} = require('../lib/render');
module.exports = class {
  data(){return {pagination:{data:'pages.categories',size:1,alias:'item'},permalink:({item})=>`/${item.lang}/${item.lang==='no'?'kategori':'category'}/${item.lang==='no'?item.name.toLowerCase().replaceAll(' ','-'):item.slug}/index.html`};}
  render({item,catalog}) {return listing(item.lang,catalog.upcoming,new Date(),cats.find(c=>c.key===item.name));}
};
