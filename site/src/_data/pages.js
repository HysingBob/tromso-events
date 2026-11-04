const {prepareEvents,loadEvents} = require('../../lib/events');
const categories = [
  ['Konsert','concert'],['Scene','stage'],['Utstilling','exhibition'],['Foredrag','talk'],
  ['Familie','family'],['Friluft','outdoors'],['Mat og drikke','food-and-drink'],['Annet','other']
];
module.exports = () => ({
  locales:['no','en'],
  categories: ['no','en'].flatMap(lang=>categories.map(([name,slug])=>({lang,name,slug}))),
  events: ['no','en'].flatMap(lang=>prepareEvents(loadEvents()).all.map(event=>({lang,event})))
});
