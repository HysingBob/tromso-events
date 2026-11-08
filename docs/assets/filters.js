(() => {
  document.documentElement.classList.add('js');
  const list = document.querySelector('[data-filter-list]');
  if (!list) return;
  const cards = [...list.querySelectorAll('[data-event]')];
  const groups = [...list.querySelectorAll('[data-day]')];
  const tabs = [...document.querySelectorAll('[data-time-filter]')];
  const categoryButtons = [...document.querySelectorAll('[data-category-filter]')];
  const audienceButtons = [...document.querySelectorAll('[data-audience-filter]')];
  const freeButton = document.querySelector('[data-free-filter]');
  const reset = document.querySelector('[data-filter-reset]');
  const empty = document.querySelector('[data-empty]');
  const count = document.querySelector('[data-count]');
  const lang = document.documentElement.lang;
  let period = 'all';   // «Alt» er forhandsvald: sida skal aldri sjå tom ut
  const chosen = {category:new Set(), audience:new Set(), free:false};
  function osloNow() {
    const parts = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
    return parts.replace(' ','T');
  }
  function bucket(start, now) {
    const today=now.slice(0,10), day=start.slice(0,10);
    if (day===today) return 'today';
    const d0=Date.parse(today+'T00:00:00Z');
    const days=Math.round((Date.parse(day+'T00:00:00Z')-d0)/86400000);
    const weekday=new Date(d0).getUTCDay();
    const untilSunday=(7-weekday)%7;
    if (days>0 && days<=untilSunday && [0,6].includes((weekday+days)%7)) return 'weekend';
    return days<=7?'week':'later';
  }
  // Er «i dag» ein helgedag? Då skal dagens arrangement også telje med under
  // «Til helgen» — elles vert filteret tomt på fredag/laurdag/sundag.
  function isWeekendDay(now) {
    const wd = new Date(Date.parse(now.slice(0,10)+'T00:00:00Z')).getUTCDay();
    return wd === 5 || wd === 6 || wd === 0;
  }
  function inPeriod(start, period, now) {
    if (period === 'all') return true;
    const b = bucket(start, now);
    if (period === 'today') return b === 'today';
    if (period === 'weekend') return b === 'weekend' || (b === 'today' && isWeekendDay(now));
    return b === period;
  }
  // Fleire val innan éi rad gjev fleire treff (ELLER). Rader imellom må alle
  // vera oppfylte (OG): Konsert eller Film, og passar for familie, og gratis.
  const has = (value, set) => splits(value).some(part => set.has(part));
  const splits = value => String(value || '').split('|').filter(Boolean);
  function update() {
    const now=osloNow();
    let shown=0;
    for (const card of cards) {
      const okCategory = chosen.category.size === 0 || has(card.dataset.categories, chosen.category);
      const okAudience = chosen.audience.size === 0 || has(card.dataset.audience, chosen.audience);
      const okFree = !chosen.free || card.dataset.free === '1';
      const visible = card.dataset.end > now && inPeriod(card.dataset.start, period, now) && okCategory && okAudience && okFree;
      card.hidden = !visible;
      if(visible) shown++;
    }
    for (const group of groups) group.hidden = !group.querySelector('[data-event]:not([hidden])');
    empty.hidden = shown !== 0;
    if (count) count.textContent = shown + ' ' + (lang==='no' ? (shown===1?'arrangement':'arrangementer') : (shown===1?'event':'events'));
    if (reset) reset.hidden = !chosen.category.size && !chosen.audience.size && !chosen.free && period === 'all';
  }
  function toggle(set, key, button) {
    set.has(key) ? set.delete(key) : set.add(key);
    button.setAttribute('aria-pressed', String(set.has(key)));
  }
  for (const tab of tabs) tab.addEventListener('click',()=>{period=tab.dataset.timeFilter;tabs.forEach(t=>t.setAttribute('aria-pressed',String(t===tab)));update();});
  for (const button of categoryButtons) button.addEventListener('click',()=>{toggle(chosen.category,button.dataset.categoryFilter,button);update();});
  for (const button of audienceButtons) button.addEventListener('click',()=>{toggle(chosen.audience,button.dataset.audienceFilter,button);update();});
  if (freeButton) freeButton.addEventListener('click',()=>{chosen.free=!chosen.free;freeButton.setAttribute('aria-pressed',String(chosen.free));update();});
  if (reset) reset.addEventListener('click',()=>{
    chosen.category.clear(); chosen.audience.clear(); chosen.free=false; period='all';
    for (const b of [...categoryButtons,...audienceButtons,...(freeButton?[freeButton]:[])]) b.setAttribute('aria-pressed','false');
    tabs.forEach(t=>t.setAttribute('aria-pressed',String(t.dataset.timeFilter==='all')));
    update();
  });
  update();
})();
