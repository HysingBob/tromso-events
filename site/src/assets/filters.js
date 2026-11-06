(() => {
  document.documentElement.classList.add('js');
  const list = document.querySelector('[data-filter-list]');
  if (!list) return;
  const cards = [...list.querySelectorAll('[data-event]')];
  const groups = [...list.querySelectorAll('[data-day]')];
  const tabs = [...document.querySelectorAll('[data-time-filter]')];
  const categories = [...document.querySelectorAll('[data-category-filter]')];
  const empty = document.querySelector('[data-empty]');
  const count = document.querySelector('[data-count]');
  const lang = document.documentElement.lang;
  let period = 'all';   // «Alt» er forhandsvald: sida skal aldri sjå tom ut
  const chosen = new Set();
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
  function update() {
    const now=osloNow();
    let shown=0;
    for (const card of cards) {
      const visible=card.dataset.end>now && inPeriod(card.dataset.start,period,now);
      card.hidden=!visible;
      if(visible) shown++;
    }
    for (const group of groups) group.hidden = !group.querySelector('[data-event]:not([hidden])');
    empty.hidden=shown!==0;
    if (count) count.textContent=shown+' '+(lang==='no'?(shown===1?'arrangement':'arrangementer'):(shown===1?'event':'events'));
  }
  for (const tab of tabs) tab.addEventListener('click',()=>{period=tab.dataset.timeFilter;tabs.forEach(t=>t.setAttribute('aria-pressed',String(t===tab)));update();});
  for (const button of categories) button.addEventListener('click',()=>{const cat=button.dataset.categoryFilter;chosen.has(cat)?chosen.delete(cat):chosen.add(cat);button.setAttribute('aria-pressed',String(chosen.has(cat)));update();});
  update();
})();
