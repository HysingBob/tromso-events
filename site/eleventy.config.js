const {prepareEvents,loadEvents} = require('./lib/events');
const FONT_FILES = {imfell:'imfell-english.woff2',fredericka:'FrederickatheGreat-Regular.ttf',pirata:'PirataOne-Regular.ttf',rye:'Rye-Regular.ttf',milonga:'Milonga-Regular.ttf',unifraktur:'unifraktur-maguntia.woff2'};
const _fontKey = String(process.env.FONT || 'imfell').replace(/[^a-z]/g,'');
const _fontFile = FONT_FILES[_fontKey] || FONT_FILES.imfell;
module.exports = function(eleventyConfig) {
  eleventyConfig.addWatchTarget('./events/');
  eleventyConfig.addWatchTarget('./images/');
  const _copy = {'images':'images','src/assets':'assets','design/style-v5.css':'assets/style-v5.css','design/style-v3.css':'assets/style-v3.css','design/style-v4.css':'assets/style-v4.css','design/style-v6.css':'assets/style-v6.css','design/style-v7.css':'assets/style-v7.css'};
  _copy['design/fonts/' + _fontFile] = 'assets/candidates/' + _fontFile;
  eleventyConfig.addPassthroughCopy(_copy);
  eleventyConfig.addGlobalData('catalog',()=>prepareEvents(loadEvents(),new Date()));
  return {dir:{input:'src',output:'_site'},templateFormats:['11ty.js'],htmlTemplateEngine:false};
};
