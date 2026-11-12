const {eventPage} = require('../lib/render');
module.exports = class {
  data(){return {pagination:{data:'pages.events',size:1,alias:'item'},permalink:({item})=>`/${item.lang}/${item.lang==='no'?'hendelse':'event'}/${item.event.id}/index.html`};}
  /* style-v8 med fyrst arrangementssida (Bob 2026-11-12): panorama-banner. */
  render({item,catalog}) {return eventPage(item.lang,item.event,catalog.all).replace('</head>','<link rel="stylesheet" href="/assets/style-v8.css"></head>');}
};
