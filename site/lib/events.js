const fs = require('node:fs');
const path = require('node:path');
const zone = 'Europe/Oslo';
const fmt = new Intl.DateTimeFormat('sv-SE', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function osloNow(date = new Date()) { return fmt.format(date).replace(' ','T'); }
function eventStatus(event, now = new Date()) { return (event.slutt || event.start) > osloNow(now) ? 'upcoming' : 'past'; }
function prepareEvents(raw, now = new Date()) {
  const all = raw.filter(e => e.status === 'publisert').sort((a,b)=>a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  return {all, upcoming:all.filter(e=>eventStatus(e,now)==='upcoming')};
}
function relatedEvents(event, all, now = new Date()) {
  return all.filter(e=>e.id!==event.id && e.start.slice(0,10)===event.start.slice(0,10) && e.status==='publisert' && eventStatus(e,now)==='upcoming').slice(0,3);
}
function timeBucket(start, now = new Date()) {
  const today = osloNow(now).slice(0,10);
  const day = start.slice(0,10);
  if (day === today) return 'today';
  const d0 = Date.parse(today+'T00:00:00Z');
  const days = Math.round((Date.parse(day+'T00:00:00Z')-d0)/86400000);
  const weekday = new Date(d0).getUTCDay();
  const untilSunday = (7-weekday)%7;
  if (days > 0 && days <= untilSunday && ((weekday+days)%7===0 || (weekday+days)%7===6)) return 'weekend';
  if (days <= 7) return 'week';
  return 'later';
}
function loadEvents(directory = path.join(__dirname,'../events')) {
  return fs.readdirSync(directory).filter(f=>f.endsWith('.json')).map(file=>{
    const e = JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));
    if (file !== `${e.id}.json` || !/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(e.id) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(e.start) || !['venter','publisert'].includes(e.status)) throw new Error(`Ugyldig eventfil: ${file}`);
    return e;
  });
}
module.exports = { osloNow,eventStatus,prepareEvents,relatedEvents,timeBucket,loadEvents };
