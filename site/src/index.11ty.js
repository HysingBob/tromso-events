// Hovudsida /no/: berre arrangement (Bob 2026-11-12) — filterknappane står i
// headeren (mast-extra via listing()), ingen faner. v8-stylen held panoramaet
// i mastheaden + plank-16 som body-bakgrunn.
const {listing} = require('../lib/render');
module.exports = class {
  data(){return {pagination:{data:'pages.locales',size:1,alias:'lang'},permalink:({lang})=>`/${lang}/index.html`};}
  render({lang,catalog}){return listing(lang,catalog.upcoming).replace('</head>','<link rel="stylesheet" href="/assets/style-v8.css"></head>');}
};
