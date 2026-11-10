(() => {
  document.documentElement.classList.add('js');
  const list = document.querySelector('[data-filter-list]');
  if (!list) return;
  const cards = [...list.querySelectorAll('[data-event]')];
  const groups = [...list.querySelectorAll('[data-day]')];
  const categoryButtons = [...document.querySelectorAll('[data-category-filter]')];
  const audienceButtons = [...document.querySelectorAll('[data-audience-filter]')];
  const freeButton = document.querySelector('[data-free-filter]');
  const reset = document.querySelector('[data-filter-reset]');
  const empty = document.querySelector('[data-empty]');
  const count = document.querySelector('[data-count]');
  const lang = document.documentElement.lang;
  // Ingen tidsfaner: lista er kronologisk, så «i dag» står først av seg sjølv.
  // Då viser sida alltid alt som ikkje er ferdig — ho kan aldri sjå tom ut.
  const chosen = {category:new Set(), audience:new Set(), free:false};
  function osloNow() {
    const parts = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
    return parts.replace(' ','T');
  }
  // Fleire val innan éi gruppe gjev fleire treff (ELLER). Gruppene imellom må
  // alle vera oppfylte (OG): Konsert eller Film, og passar for familie, og gratis.
  const has = (value, set) => splits(value).some(part => set.has(part));
  const splits = value => String(value || '').split('|').filter(Boolean);
  function update() {
    const now=osloNow();
    let shown=0;
    for (const card of cards) {
      const okCategory = chosen.category.size === 0 || has(card.dataset.categories, chosen.category);
      const okAudience = chosen.audience.size === 0 || has(card.dataset.audience, chosen.audience);
      const okFree = !chosen.free || card.dataset.free === '1';
      const visible = card.dataset.end > now && okCategory && okAudience && okFree;
      card.hidden = !visible;
      if(visible) shown++;
    }
    for (const group of groups) group.hidden = !group.querySelector('[data-event]:not([hidden])');
    empty.hidden = shown !== 0;
    if (count) count.textContent = shown + ' ' + (lang==='no' ? (shown===1?'arrangement':'arrangementer') : (shown===1?'event':'events'));
    if (reset) reset.hidden = !chosen.category.size && !chosen.audience.size && !chosen.free;
  }
  function toggle(set, key, button) {
    set.has(key) ? set.delete(key) : set.add(key);
    button.setAttribute('aria-pressed', String(set.has(key)));
  }
  for (const button of categoryButtons) button.addEventListener('click',()=>{toggle(chosen.category,button.dataset.categoryFilter,button);update();});
  for (const button of audienceButtons) button.addEventListener('click',()=>{toggle(chosen.audience,button.dataset.audienceFilter,button);update();});
  if (freeButton) freeButton.addEventListener('click',()=>{chosen.free=!chosen.free;freeButton.setAttribute('aria-pressed',String(chosen.free));update();});
  if (reset) reset.addEventListener('click',()=>{
    chosen.category.clear(); chosen.audience.clear(); chosen.free=false;
    for (const b of [...categoryButtons,...audienceButtons,...(freeButton?[freeButton]:[])]) b.setAttribute('aria-pressed','false');
    update();
  });
  update();
})();
