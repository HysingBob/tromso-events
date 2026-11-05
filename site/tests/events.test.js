const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepareEvents, osloNow, eventStatus, relatedEvents, timeBucket } = require('../lib/events');
const sample = (id, start, slutt, status='publisert') => ({id,start,slutt,status,kategori:['Konsert'],no:{tittel:id},en:{title:id}});

test('published-only and chronological; unpublished has no public page', () => {
  const events = prepareEvents([sample('later','2027-01-02T20:00'),sample('draft','2027-01-01T10:00',null,'venter'),sample('first','2027-01-01T18:00')], new Date('2027-01-01T12:00:00Z'));
  assert.deepEqual(events.all.map(e=>e.id), ['first','later']);
  assert.deepEqual(events.upcoming.map(e=>e.id), ['first','later']);
});

test('Oslo boundary respects winter and summer offset and an event stays upcoming until end', () => {
  assert.equal(osloNow(new Date('2027-01-01T11:00:00Z')), '2027-01-01T12:00');
  assert.equal(osloNow(new Date('2027-07-01T10:00:00Z')), '2027-07-01T12:00');
  const e = sample('ongoing','2027-07-01T11:00','2027-07-01T13:00');
  assert.equal(eventStatus(e,new Date('2027-07-01T10:00:00Z')), 'upcoming');
  assert.equal(eventStatus(e,new Date('2027-07-01T11:00:00Z')), 'past');
});

test('past published events retain archival pages but leave index', () => {
  const events = prepareEvents([sample('old','2026-01-01T10:00'),sample('new','2027-01-01T10:00')],new Date('2026-11-04T12:00:00Z'));
  assert.deepEqual(events.all.map(e=>e.id), ['old','new']);
  assert.deepEqual(events.upcoming.map(e=>e.id), ['new']);
});

test('same-day related excludes current and future archives, caps at three', () => {
  const all = [sample('a','2027-01-02T08:00'),sample('b','2027-01-02T10:00'),sample('c','2027-01-02T12:00'),sample('d','2027-01-02T14:00'),sample('e','2027-01-02T16:00'),sample('other','2027-01-03T10:00')];
  assert.deepEqual(relatedEvents(all[0],all,new Date('2027-01-01T00:00:00Z')).map(e=>e.id),['b','c','d']);
});

test('a new event with only its full-size image renders a working card', () => {
  const {listing} = require('../lib/render');
  const e={...sample('2027-02-01-ny-hendelse','2027-02-01T20:00'),bilde:'images/2027-02-01-ny-hendelse.webp',bildetekst_no:'Ny illustrasjon'};
  const page=listing('no',[e],new Date('2027-01-01T00:00:00Z'));
  assert.match(page,/src="\/images\/2027-02-01-ny-hendelse.webp"/);
  assert.doesNotMatch(page,/FIKTIVT EKSEMPEL/);
});

test('organiser-hosted images render as external URLs in cards and event pages', () => {
  const {listing,eventPage}=require('../lib/render');
  const e={...sample('2027-02-01-ekstern-bilde','2027-02-01T20:00'),bilde:'https://cdn.example.org/event-image.jpg',bildetekst_no:'Arrangørens arrangementsbilde'};
  const card=listing('no',[e],new Date('2027-01-01T00:00:00Z'));
  const detail=eventPage('no',e,[e],new Date('2027-01-01T00:00:00Z'));
  assert.match(card,/src="https:\/\/cdn\.example\.org\/event-image\.jpg"/);
  assert.match(detail,/src="https:\/\/cdn\.example\.org\/event-image\.jpg"/);
  assert.doesNotMatch(card,/src="\/https:\/\//);
});

test('missing optional event details render no empty labels or fabricated source', () => {
  const {eventPage}=require('../lib/render');
  const e=sample('2027-02-01-ny-hendelse','2027-02-01T20:00');
  const page=eventPage('en',e,[e],new Date('2027-01-01T00:00:00Z'));
  assert.doesNotMatch(page,/<dt>Price<\/dt>|<dt>Venue<\/dt>|<p class="lead"><\/p>|Source: fictional/);
});

test('fictional samples never offer a ticket button or outbound organiser link', () => {
  const {eventPage}=require('../lib/render');
  const e={...sample('2027-02-01-fiktiv-test','2027-02-01T20:00'),eksempel:true,bilde:'images/test.webp',kilde_navn:'Oppdiktet arrangør',kilde_url:'https://example.org/'};
  const page=eventPage('no',e,[e],new Date('2027-01-01T00:00:00Z'));
  assert.doesNotMatch(page,/Billetter og mer info|href="https:\/\/example.org\/"/);
  assert.match(page,/FIKTIVT EKSEMPEL/);
});

test('verified real events retain their organiser link', () => {
  const {eventPage}=require('../lib/render');
  const e={...sample('2027-02-01-ekte-test','2027-02-01T20:00'),bilde:'images/test.webp',kilde_navn:'Arrangør',kilde_url:'https://example.org/'};
  assert.match(eventPage('no',e,[e],new Date('2027-01-01T00:00:00Z')),/Billetter og mer info/);
});

test('time buckets are Oslo calendar periods including weekend and later', () => {
  const now = new Date('2026-11-06T12:00:00Z'); // Friday 13:00 Oslo
  assert.equal(timeBucket('2026-11-06T18:00',now),'today');
  assert.equal(timeBucket('2026-11-08T15:00',now),'weekend');
  assert.equal(timeBucket('2026-11-09T18:00',now),'week');
  assert.equal(timeBucket('2026-11-15T18:00',now),'later');
});
