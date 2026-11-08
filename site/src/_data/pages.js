const {prepareEvents,loadEvents} = require('../../lib/events');
// Kategoriane er éin stad — i lib/render.js. Elles får ein kategorisider for
// namn som ikkje lenger finst (Foredrag, Familie, Mat og drikke, Annet).
const {cats} = require('../../lib/render');
module.exports = () => ({
  locales:['no','en'],
  categories: ['no','en'].flatMap(lang=>cats.map(category=>({lang,name:lang==='no'?category.no:category.en,slug:category.slug}))),
  events: ['no','en'].flatMap(lang=>prepareEvents(loadEvents()).all.map(event=>({lang,event})))
});
