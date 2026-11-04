const {eventPage} = require('../lib/render');
module.exports = class {
  data(){return {pagination:{data:'pages.events',size:1,alias:'item'},permalink:({item})=>`/${item.lang}/${item.lang==='no'?'hendelse':'event'}/${item.event.id}/index.html`};}
  render({item,catalog}) {return eventPage(item.lang,item.event,catalog.all);}
};
