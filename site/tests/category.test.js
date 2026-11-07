const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cats } = require('../lib/render');
const { loadEvents } = require('../lib/events');
const pageData = require('../src/_data/pages')();

test('Activity is a category for participatory events, including indoor events', () => {
  const activity = cats.find(category => category.key === 'Aktivitet');
  assert.deepEqual(activity, {
    no: 'Aktivitet',
    en: 'Activity',
    slug: 'activity',
    key: 'Aktivitet',
  });

  const events = loadEvents();
  const rites = events.find(event => event.id === '2026-11-09-tibetanske-riter');
  assert.ok(rites, 'Five Tibetan Rites event exists');
  assert.deepEqual(rites.kategori, ['Aktivitet']);
  assert.ok(pageData.categories.some(category => category.lang === 'no' && category.name === 'Aktivitet' && category.slug === 'activity'));
  assert.ok(pageData.categories.some(category => category.lang === 'en' && category.slug === 'activity'));
});

test('Film is a category for cinema listings in both locales', () => {
  const film = cats.find(category => category.key === 'Film');
  assert.deepEqual(film, {
    no: 'Film',
    en: 'Film',
    slug: 'film',
    key: 'Film',
  });
  assert.ok(pageData.categories.some(category => category.lang === 'no' && category.name === 'Film' && category.slug === 'film'));
  assert.ok(pageData.categories.some(category => category.lang === 'en' && category.name === 'Film' && category.slug === 'film'));
});
