const {prepareEvents,loadEvents} = require('./lib/events');
module.exports = function(eleventyConfig) {
  eleventyConfig.addWatchTarget('./events/');
  eleventyConfig.addWatchTarget('./images/');
  eleventyConfig.addPassthroughCopy({'images':'images','src/assets':'assets'});
  eleventyConfig.addGlobalData('catalog',()=>prepareEvents(loadEvents(),new Date()));
  return {dir:{input:'src',output:'_site'},templateFormats:['11ty.js'],htmlTemplateEngine:false};
};
