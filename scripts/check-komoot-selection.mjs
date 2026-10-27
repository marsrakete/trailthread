import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../browser-extension/', import.meta.url);
const context = vm.createContext({
  URL, console, Error,
  location: new URL('https://www.komoot.com/de-de/user/123/activities?type=recorded'),
  document: { querySelectorAll: () => [] },
  chrome: { runtime: { onMessage: { addListener() {} } } },
});
vm.runInContext(await readFile(new URL('tour-selection.js', root), 'utf8'), context);
const source = await readFile(new URL('content-komoot.js', root), 'utf8');
vm.runInContext(source.replace(/^observeKomootPage\(\);$/m, '').replace(/^void sendRuntimeMessage\(\{ type: 'trailthread:detail-ready' \}\);$/m, ''), context);
const api = context.TrailthreadTourSelection;
assert.equal(api.normalizeTourType('tour_recorded'), 'recorded');
assert.equal(api.normalizeTourType(' PLANNED '), 'planned');
assert.equal(api.normalizeTourType(null), 'unknown');
assert.equal(api.normalizeTourType(123), 'unknown');
assert.equal(api.listType(context.location.href), 'recorded');
assert.equal(api.listType('https://www.komoot.com/user/123/routes'), 'planned');
assert.equal(api.listType('https://www.komoot.com/user/123'), 'all');
assert.throws(() => api.listType('invalid'));

const overview = 'https://www.komoot.com/de-de/user/123/activities?type=recorded&search=Erft+%26+Seen';
const filtered = api.buildRequest(overview, '123', 'filtered');
assert.equal(new URL(filtered.href).searchParams.get('name'), 'Erft & Seen');
assert.equal(new URL(filtered.href).searchParams.get('type'), 'tour_recorded');
assert.equal(new URL(filtered.href).searchParams.has('search'), false);
assert.equal(new URL(api.buildRequest(overview, '123', 'all').href).searchParams.has('name'), false);
assert.equal(new URL(api.buildRequest(overview, '123', 'planned').href).searchParams.get('type'), 'tour_planned');
assert.equal(new URL(api.buildRequest(overview.replace('Erft+%26+Seen', ''), '123', 'filtered').href).searchParams.has('name'), false);
assert.throws(() => api.buildRequest(`${overview}&sport=hike`, '123', 'filtered'), /unsupported-filters/);
assert.throws(() => api.buildRequest(overview.replace('recorded', 'unknown'), '123', 'filtered'), /unsupported-filters/);
assert.throws(() => api.buildRequest(overview, '', 'all'), /missing-user/);
assert.throws(() => api.buildRequest(overview, '123', 'invalid'), /invalid-scope/);

/**
 * Returns the current package's identifiers for assertions across VM realms.
 * @returns {string[]} Selected tour identifiers.
 */
function selectedIds() {
  return Array.from(vm.runInContext('[...SELECTED_TOURS.keys()]', context));
}

/**
 * Runs the production content-script action against deterministic API pages.
 * @param {string} scope Selection scope to add.
 * @param {object[]} pages API responses, or Error values for partial failures.
 * @returns {Promise<string[]>} Actual API request URLs in order.
 */
async function add(scope, pages) {
  const requests = [];
  context.loadKomootApiPage = async (href) => {
    requests.push(href);
    const payload = pages[requests.length - 1];
    if (payload instanceof Error) throw payload;
    return payload;
  };
  context.scope = scope;
  await vm.runInContext('loadAllKomootTours(scope)', context);
  return requests;
}

const mixedPages = [
  { _embedded: { tours: [{ id: 1, type: 'tour_recorded' }, { id: 2, type: 'planned' }, { id: 3, type: 'unexpected' }] }, _links: { next: { href: '?page=1' } } },
  { _embedded: { tours: [{ id: 1, type: 'recorded' }, { id: 4, type: 'tour_planned' }, { id: 5, type: 'recorded' }, { id: 'invalid' }] } },
];
await add('recorded', mixedPages);
assert.deepEqual(selectedIds(), ['1', '5']);
await add('planned', mixedPages);
assert.deepEqual(selectedIds(), ['1', '5', '2', '4']);
await add('all', mixedPages);
assert.deepEqual(selectedIds(), ['1', '5', '2', '4', '3']);
await add('all', mixedPages);
assert.match(vm.runInContext('tourListLoadStatus', context), /^0 Touren hinzugefügt, 5 insgesamt/);
await add('all', [{ _embedded: { tours: [] } }]);
assert.equal(selectedIds().length, 5);
vm.runInContext('clearTourSelection()', context);
assert.equal(selectedIds().length, 0);

context.location = new URL(overview);
const manyPages = [0, 1, 2].map((page) => {
  const tours = Array.from({ length: Math.min(24, 50 - page * 24) }, (_, index) => ({ id: page * 24 + index + 10, type: 'tour_recorded' }));
  const result = { _embedded: { tours } };
  if (page < 2) result._links = { next: { href: `https://api.komoot.de/v007/users/123/tours/?page=${page + 1}` } };
  return result;
});
const requests = await add('filtered', manyPages);
assert.equal(selectedIds().length, 50);
for (const href of requests) {
  const url = new URL(href);
  assert.equal(url.searchParams.get('name'), 'Erft & Seen');
  assert.equal(url.searchParams.get('type'), 'tour_recorded');
}
context.location = new URL(overview.replace('Erft+%26+Seen', 'Emscher'));
await add('filtered', [{ _embedded: { tours: [{ id: 10, type: 'tour_recorded' }, { id: 100, type: 'tour_recorded' }] } }]);
assert.equal(selectedIds().length, 51);
assert.match(vm.runInContext('tourListLoadStatus', context), /^1 Tour hinzugefügt, 51 insgesamt/);
const partialPage = { _embedded: { tours: [{ id: 999, type: 'tour_recorded' }] }, _links: { next: { href: '?page=1' } } };
await add('filtered', [partialPage, new Error('offline')]);
assert.equal(selectedIds().length, 52);
assert.match(vm.runInContext('tourListLoadStatus', context), /nicht vollständig hinzugefügt/);
assert.equal(vm.runInContext('tourListLoading', context), false);

context.location = new URL(`${overview}&sport=hike`);
assert.deepEqual(await add('filtered', manyPages), []);
assert.equal(selectedIds().length, 52);
assert.match(vm.runInContext('tourListLoadStatus', context), /noch nicht unterstützt/);
context.location = new URL(overview);
await add('filtered', [{}]);
assert.match(vm.runInContext('tourListLoadStatus', context), /keine lesbare Tourenliste/);
assert.equal(selectedIds().length, 52);
vm.runInContext('runActive = true; clearTourSelection(); runActive = false;', context);
assert.equal(selectedIds().length, 52);

await assert.rejects(api.addTours(filtered, {
  selection: new Map(), describeTour: () => null, onProgress() {},
  loadPage: async () => ({ _embedded: { tours: [] }, _links: { next: { href: 'https://example.com/leak' } } }),
}), /invalid-next-page/);
await assert.rejects(api.addTours(filtered, {
  selection: new Map(), describeTour: () => null, onProgress() {},
  loadPage: async () => ({ _embedded: { tours: [] }, _links: { next: { href: filtered.href } } }),
}), /repeated-page/);
vm.runInContext('clearTourSelection()', context);
assert.equal(selectedIds().length, 0);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
assert.deepEqual(manifest.content_scripts[0].js, ['tour-selection.js', 'content-komoot.js']);
console.log('Komoot selection checks passed: additive scopes, URL mapping, 50 filtered results, pagination, deduplication, empty results, unsupported filters and partial failures.');
