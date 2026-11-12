const {timeBucket,relatedEvents,eventStatus} = require('./events');
const fs = require('node:fs');
const path = require('node:path');
const cats = [
  {no:'Konsert',en:'Concert',slug:'concert',key:'Konsert'},
  {no:'Scene',en:'Stage',slug:'stage',key:'Scene'},
  {no:'Film',en:'Film',slug:'film',key:'Film'},
  {no:'Aktivitet',en:'Activity',slug:'activity',key:'Aktivitet'},
  {no:'Annet',en:'Other',slug:'annet',key:'Annet'}
];
// Kven arrangementet passar for. Nøklane er dei same i begge språk — berre
// merkelappen vert omsett. Sjå migrate_filters.py for kva reglane er.
const audiences = [
  {no:'Familie',en:'Family',key:'Familie'}
];
const themeSheets = (process.env.THEME || 'v2') === 'v2' ? ['leather.css'] : ['leather.css', `style-${process.env.THEME}.css`];
const themeLinks = themeSheets.map(f=>`<link rel="stylesheet" href="/assets/${f}">`).join('');
const tr = (lang,no,en)=>lang==='no'?no:en;
const esc = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root = lang=>`/${lang}/`;
const eventUrl = (e,lang)=>`${root(lang)}${lang==='no'?'hendelse':'event'}/${e.id}/`;
const catUrl = (c,lang)=>`${root(lang)}${lang==='no'?'kategori':'category'}/${lang==='no'?c.key.toLowerCase().replaceAll(' ','-').replace('og-drikke','og-drikke'):c.slug}/`;
const date = (value,lang)=>new Intl.DateTimeFormat(lang==='no'?'nb-NO':'en-GB',{day:'numeric',month:'long',year:'numeric'}).format(new Date(value.slice(0,10)+'T12:00:00Z'));
const time = s=>s?.slice(11,16);
const eventTimes = (e,lang)=>{const list=Array.isArray(e.visningstider)?e.visningstider:[time(e.start)];return [...new Set(list.filter(Boolean))].join(tr(lang,', ', ', '));};
const merkeText = (e,lang)=>{const m=e.merke; if(!m) return ''; return typeof m==='object' ? (m[lang]||m.no||'') : m;};
const dayName = (value,lang)=>new Intl.DateTimeFormat(lang==='no'?'nb-NO':'en-GB',{weekday:'long'}).format(new Date(value.slice(0,10)+'T12:00:00Z'));
const imageUrl = (value)=>/^https?:\/\//i.test(String(value||'')) ? String(value) : `/${String(value||'').replace(/^\/+/, '')}`;
const image = (e,klass='')=>`<img class="${klass}" src="${esc(imageUrl(e.bilde))}" alt="${esc(e[`bildetekst_${klass==='hero-image'?'heroLang':'cardLang'}`]||'')}" loading="lazy">`;
function shell(lang,title,body,alternate,mastExtra='',bodyClass='') {
  const tagline=tr(lang,'Sånn går dagan','Thus goes the days');
  const metaDesc=tr(lang,'Alt som skjer i Tromsø – uten reklame','Everything happening in Tromsø – no ads');
  const other=lang==='no'?'en':'no';
  /* Språkval som flagg-knapp: på norsk side står det britiske flagget
     (byt til engelsk), på engelsk side det norske (byt tilbake). */
  const flagAlt=tr(lang,'Bytt til engelsk','Bytt til norsk');
  const flag=`<a class="lang-flag" href="${alternate}" lang="${other}" hreflang="${other}" aria-label="${flagAlt}"><span class="flag flag-${other==='en'?'uk':'no'}" aria-hidden="true"></span></a>`;
  /* Forsida: flagget ligg sist i filterklynga (setjast inn i filters).
     Andre sider: flagget til venstre på undertekstrada under ordmerket. */
  const brandRow=`<div class="brand-row">${mastExtra?'':flag}<p>${tagline}</p></div>`;
  const mast=mastExtra?mastExtra.replace('</div><p class="filter-foot',flag+'</div><p class="filter-foot'):'';
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="robots" content="noindex,nofollow"><title>${esc(title)} · tromsø.net</title><meta name="description" content="${esc(metaDesc)}"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/style.css">${themeLinks}<script defer src="/assets/filters.js"></script></head><body${bodyClass?` class="${bodyClass}"`:''}><div class="page-shell"><header class="masthead"><div class="mast-inner"><div class="brand"><a class="brand-link" href="${root(lang)}" aria-label="tromsø.net"><img src="/assets/logo.svg" width="152" height="24" alt="tromsø.net"></a>${brandRow}</div>${mast?`<div class="mast-extra">${mast}</div>`:''}</div></header><main id="main">${body}</main><footer class="site-footer"><div class="route-line" aria-hidden="true"><span>✦</span></div><div class="footer-inner"><img src="/assets/textures/compass.webp" width="34" height="34" alt=""><div><a href="${root(lang)}${lang==='no'?'om':'about'}/">${tr(lang,'Om prosjektet','About the project')}</a><span> · </span><a href="/${other}/" hreflang="${other}">${other.toUpperCase()}</a><p>${tr(lang,'Uten reklame. Uten sporing.','No ads. No tracking.')}</p></div><small>69°39′ N · 18°57′ Ø</small></div></footer></div></body></html>`;
}
const shortDate = s=>`${s.slice(8,10)}/${s.slice(5,7)}`;
function card(e,lang,now=new Date()) {
  const title=e[lang]?.[lang==='no'?'tittel':'title'];
  const c=cats.find(c=>e.kategori?.includes(c.key));
  const kickerCat=c?.[lang] || (e.kategori||[])[0] || '';
  const imageAlt=e[`bildetekst_${lang}`] || tr(lang,'Beige plassholderillustrasjon','Beige placeholder illustration');
  const thumb = `images/cards/${e.id}.webp`;
  const cardImage = /^https?:\/\//i.test(String(e.bilde||'')) ? e.bilde : (fs.existsSync(path.join(__dirname,'..',thumb)) ? thumb : e.bilde);
  const variant = 1 + ([...e.id].reduce((a,c)=>a+c.charCodeAt(0),0) % 3);
  return `<a class="event-card" data-variant="${variant}" href="${eventUrl(e,lang)}" data-event data-start="${esc(e.start)}" data-end="${esc(e.slutt||e.start)}" data-time="${timeBucket(e.start,now)}" data-categories="${esc((e.kategori||[]).join('|'))}" data-audience="${esc((e.malgruppe||[]).join('|'))}" data-free="${e.gratis?'1':'0'}" data-sted="${esc(e.sted||'')}"><div class="card-art"><img src="${esc(imageUrl(cardImage))}" alt="${esc(imageAlt)}" loading="lazy" width="750" height="500">${merkeText(e,lang)?`<span class="card-stamp">${esc(merkeText(e,lang))}</span>`:''}</div><div class="card-body"><div class="card-kicker">${esc(kickerCat)} <span aria-hidden="true">–</span> ${esc(dayName(e.start,lang))}, ${esc(shortDate(e.start))}</div><h3>${esc(title)}</h3><p class="card-meta">${esc(eventTimes(e,lang))}${e.sted?' <span aria-hidden="true">·</span> '+esc(e.sted):''}${e.gratis?' <span class="free">'+tr(lang,'Gratis','Free')+'</span>':e.pris?' <span aria-hidden="true">·</span> '+esc(e.pris):''}</p>${e.eksempel?`<span class="sample-mark">${tr(lang,'FIKTIVT EKSEMPEL','FICTIONAL EXAMPLE')}</span>`:''}</div></a>`;
}
// Éi klynge med knappar rett under logoen — ingen radoverskrifter, ingen tidsfaner.
// Rekkjefølgje: kategoriar, så målgrupper, så «Gratis» sist.
function chipCluster(lang) {
  const chips=[
    ...cats.map(c=>({attr:'data-category-filter',key:c.key,label:c[lang]})),
    ...audiences.map(a=>({attr:'data-audience-filter',key:a.key,label:a[lang]})),
    {attr:'data-free-filter',key:'gratis',label:tr(lang,'Gratis','Free'),klass:'chip-free'}
  ];
  return chips.map(i=>`<button type="button" ${i.attr}="${esc(i.key)}"${i.klass?` class="${i.klass}"`:''} aria-pressed="false">${esc(i.label)}</button>`).join('');
}
function filters(lang) {
  return `<section class="filter-area" aria-label="${tr(lang,'Filtrer arrangementer','Filter events')}"><div class="category-controls filter-cluster js-only" role="group" aria-label="${tr(lang,'Filtrer arrangementer','Filter events')}">${chipCluster(lang)}</div><p class="filter-foot js-only"><button type="button" class="filter-reset" data-filter-reset>${tr(lang,'Nullstill','Reset')}</button></p><p class="nojs-note"><noscript>${tr(lang,'Alle kommende arrangementer vises. Aktiver JavaScript for å filtrere.','All upcoming events are shown. Enable JavaScript to filter.')}</noscript></p></section>`;
}
function dayGroups(list,lang) {
  const byDay=new Map();
  for (const e of [...list].sort((a,b)=>a.start.localeCompare(b.start))) {
    const key=e.start.slice(0,10);
    if(!byDay.has(key)) byDay.set(key,[]);
    byDay.get(key).push(e);
  }
  return [...byDay].map(([key,items])=>({key,items}));
}
function listing(lang,upcoming,now=new Date(),category=null) {
  const list=category?upcoming.filter(e=>e.kategori?.includes(category.key)):upcoming;
  const heading=category?category[lang]:tr(lang,'Alt som skjer i Tromsø','Everything happening in Tromsø');
  const intro=category?tr(lang,'Et lite utsnitt av kalenderen, samlet på ett sted.','A closer look at one corner of the calendar.'):tr(lang,'En håndplukket oversikt over byens små og store øyeblikk.','A considered guide to the city’s little and large moments.');
  const front=!category;
  const groups=dayGroups(list,lang).map(g=>`<section class="day-group" data-day="${g.key}"><div class="event-grid">${g.items.map(e=>card(e,lang,now)).join('')}</div></section>`).join('');
  const head=front?'':`<div class="page-heading"><h1>${esc(heading)}</h1><p>${intro}</p></div>`;
  const body=`${head}<section class="results" aria-label="${tr(lang,'Kommende arrangementer','Upcoming events')}"><div data-filter-list>${groups}</div><div class="empty-state" data-empty ${list.length?'hidden':''}><img class="empty-art" src="/assets/quiet-waters.webp" alt="" width="600" height="400"><h3>${tr(lang,'Stille i farvannet akkurat nå','Quiet waters for now')}</h3><p>${tr(lang,'Prøv en annen dag eller kategori.','Try another date or category.')}</p></div></section>`;
  return shell(lang,heading,body,category?catUrl(category,lang==='no'?'en':'no'):root(lang==='no'?'en':'no'),filters(lang),'page-front');
}
function fact(label,value){return value?`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`:'';}
function eventPage(lang,e,all,now=new Date()) {
  const title=e[lang]?.[lang==='no'?'tittel':'title'];
  const lead=e[lang]?.[lang==='no'?'ingress':'lead'];
  const body=e[lang]?.[lang==='no'?'tekst':'text'];
  const related=relatedEvents(e,all,now);
  const archived=eventStatus(e,now)==='past';
  const imageAlt=e[`bildetekst_${lang}`]||'';
  const detail=`<nav class="breadcrumb"><a href="${root(lang)}">${tr(lang,'Alle arrangementer','All events')}</a><span aria-hidden="true"> / </span>${esc(title)}</nav><article class="detail" data-sted="${esc(e.sted||'')}"><div class="detail-art"><img class="hero-image" src="${esc(imageUrl(e.bilde))}" alt="${esc(imageAlt)}" width="1500" height="1000">${merkeText(e,lang)?`<span class="card-stamp">${esc(merkeText(e,lang))}</span>`:''}</div><div class="detail-heading"><p class="eyebrow">${esc((e.kategori||[]).map(x=>cats.find(c=>c.key===x)?.[lang]||x).join(' · '))}</p><h1>${esc(title)}</h1>${lead?`<p class="lead">${esc(lead)}</p>`:''}${e.eksempel?`<span class="sample-mark">${tr(lang,'FIKTIVT EKSEMPEL – IKKE ET REELT ARRANGEMENT','FICTIONAL EXAMPLE – NOT A REAL EVENT')}</span>`:''}${archived?`<p class="archive-label">${tr(lang,'Arkivert arrangement','Archived event')}</p>`:''}</div><dl class="facts">${fact(tr(lang,'Dato','Date'),date(e.start,lang))}${fact(tr(lang,'Tid','Time'),eventTimes(e,lang)+(e.slutt?'–'+time(e.slutt):''))}${fact(tr(lang,'Sted','Venue'),e.sted)}${fact(tr(lang,'Adresse','Address'),e.adresse)}${fact(tr(lang,'Pris','Price'),e.gratis?tr(lang,'Gratis','Free'):e.pris)}${fact(tr(lang,'Aldersgrense','Age limit'),e.aldersgrense)}</dl><div class="story">${(body||'').split(/\n\n/).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join('')}</div>${e.kilde_url&&!e.eksempel?`<a class="ticket-link" href="${esc(e.kilde_url)}" target="_blank" rel="noopener noreferrer">${tr(lang,'Billetter og mer info','Tickets and more information')} <span aria-hidden="true">↗</span></a>`:''}${e.eksempel?`<p class="source-note">${tr(lang,'Eksempeltekst og plassholderbilde laget for tromsø.net. Ingen virkelig arrangør eller billettsalg.','Sample text and placeholder image created for tromsø.net. No real organiser or tickets.')}</p>`:e.kilde_navn?`<p class="source-note">${tr(lang,'Tekst og bilde laget av tromsø.net. Kilde:','Text and image created by tromsø.net. Source:')} ${e.kilde_url?`<a href="${esc(e.kilde_url)}" rel="noopener noreferrer">${esc(e.kilde_navn)}</a>`:esc(e.kilde_navn)}</p>`:''}</article><section class="related"><div class="results-head"><h2>${tr(lang,'Mer som skjer samme dag','More on the same day')}</h2></div>${related.length?`<div class="event-grid">${related.map(x=>card(x,lang,now)).join('')}</div>`:`<p>${tr(lang,'Ingen andre arrangementer denne dagen ennå.','No other events that day yet.')}</p>`}</section>`;
  return shell(lang,title,detail,eventUrl(e,lang==='no'?'en':'no'),'','page-event');
}
function about(lang) {
  return shell(lang,tr(lang,'Om tromsø.net','About tromsø.net'),`<div class="page-heading"><p class="eyebrow">69°39′ N · EN ÅPEN KALENDER</p><h1>${tr(lang,'En liten havn for det som skjer','A little harbour for what’s on')}</h1><p>${tr(lang,'Alt som skjer i Tromsø – uten reklame.','Everything happening in Tromsø – no ads.')}</p></div><article class="about-copy"><h2>${tr(lang,'Hvorfor finnes dette?','Why does this exist?')}</h2><p>${tr(lang,'Tromsø fortjener en rolig og oversiktlig kalender for både fastboende og besøkende. Ingen annonser, ingen sporing og ingen informasjonsstøy.','Tromsø deserves a calm, useful calendar for residents and visitors alike. No ads, no tracking, no noise.')}</p><p>${tr(lang,'Når kalenderen tas i bruk, skal AI-agenter skrive tekster og lage illustrasjoner ut fra offentlig tilgjengelig informasjon. Arrangørens egne opplysninger må kontrolleres før publisering. Nettstedet er uferdig og under arbeid. Alle arrangementene som er lagt inn så langt er ekte og gyldige.','When the calendar goes live, AI agents will write copy and create illustrations from publicly available information. Organiser information must be checked before publication. The site is incomplete and still under construction. Every event listed so far is real and valid.')}</p><h2>${tr(lang,'Send inn eller rett et arrangement','Submit or correct an event')}</h2><p>${tr(lang,'Arrangør? Ta kontakt på','Organiser? Write to')} <a href="mailto:post@tromsoevents.net">post@tromsoevents.net</a>. ${tr(lang,'Adressen er foreslått for prosjektet og må aktiveres før den kan brukes.','This is a proposed project address; it must be activated before it can receive mail.')}</p></article>`,lang==='no'?'/en/about/':'/no/om/');
}
module.exports={listing,eventPage,about,cats,card,shell,tr,filters};
