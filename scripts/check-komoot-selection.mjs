import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Match the observed German calendar boundaries independently of the test host timezone.
process.env.TZ = 'Europe/Berlin';

const root = new URL('../browser-extension/', import.meta.url);
const context = vm.createContext({
  URL, console, Error,
  location: new URL('https://www.komoot.com/de-de/user/123/activities?type=recorded'),
  document: { querySelectorAll: () => [] },
  chrome: { runtime: { onMessage: { addListener() {} } } },
});
vm.runInContext(await readFile(new URL('tour-selection.js', root), 'utf8'), context);
vm.runInContext(await readFile(new URL('filter-preview.js', root), 'utf8'), context);
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
for (const order of ['duration_desc', '', 'duration_asc&order=date_desc']) {
  const ordered = `${overview}&order=${order}`;
  assert.equal(api.buildRequest(ordered, '123', 'filtered').href, filtered.href);
  assert.equal(context.TrailthreadFilterPreview.describe(ordered, api.buildRequest).valid, true);
}
assert.equal(new URL(filtered.href).searchParams.get('name'), 'Erft & Seen');
assert.equal(new URL(filtered.href).searchParams.get('type'), 'tour_recorded');
assert.equal(new URL(filtered.href).searchParams.has('search'), false);
assert.equal(new URL(api.buildRequest(overview, '123', 'all').href).searchParams.has('name'), false);
assert.equal(new URL(api.buildRequest(overview, '123', 'planned').href).searchParams.get('type'), 'tour_planned');
assert.equal(new URL(api.buildRequest(overview.replace('Erft+%26+Seen', ''), '123', 'filtered').href).searchParams.has('name'), false);
assert.throws(() => api.buildRequest(`${overview}&new_filter=1`, '123', 'filtered'), /unsupported-filters/);
assert.throws(() => api.buildRequest(overview.replace('recorded', 'unknown'), '123', 'filtered'), /unsupported-filters/);
assert.throws(() => api.buildRequest(overview, '', 'all'), /missing-user/);
assert.throws(() => api.buildRequest(overview, '123', 'invalid'), /invalid-scope/);

const observedFilters = '&location=50.909622,6.808193,30r&date=2026-09-01,2026-09-30&visibility=PUBLIC&min_uphill=0&max_uphill=1800';
const durationOverview = `${overview}${observedFilters}&min_duration=9000&max_duration=16200`;
const durationRequest = api.buildRequest(durationOverview, '123', 'filtered');
const durationParameters = new URL(durationRequest.href).searchParams;
const expectedFilters = {
  name: 'Erft & Seen', type: 'tour_recorded', center: '50.909622,6.808193', max_distance: '30000',
  start_date: '2026-08-31T22:00:00.000Z', end_date: '2026-09-30T21:59:59.999Z',
  visibilities: 'PUBLIC', min_uphill: '0', max_uphill: '1800', min_duration: '9000', max_duration: '16200',
};
const sportOverview = `${durationOverview}&sport=mtb_easy,racebike&include_ebike=false`;
assert.equal(new URL(api.buildRequest(sportOverview, '123', 'filtered').href).searchParams.get('sport_types'), 'mtb_easy,racebike');
assert.equal(new URL(api.buildRequest(sportOverview.replace('include_ebike=false', 'include_ebike=true'), '123', 'filtered').href).searchParams.get('sport_types'), 'mtb_easy,e_mtb_easy,racebike,e_racebike');
assert.equal(new URL(api.buildRequest(`${overview}&sport=mtb_easy&sport=racebike&sport=mtb_easy&include_ebike=true`, '123', 'filtered').href).searchParams.get('sport_types'), 'mtb_easy,e_mtb_easy,racebike,e_racebike');
assert.equal(new URL(api.buildRequest(`${overview}&sport=e_mtb_easy&include_ebike=true`, '123', 'filtered').href).searchParams.get('sport_types'), 'e_mtb_easy');
assert.equal(new URL(api.buildRequest(`${overview}&sport=hike`, '123', 'filtered').href).searchParams.get('sport_types'), 'hike');
assert.equal(new URL(api.buildRequest(`${overview}&include_ebike=false`, '123', 'filtered').href).searchParams.has('sport_types'), false);
assert.equal(new URL(api.buildRequest(sportOverview, '123', 'all').href).searchParams.has('sport_types'), false);
assert.throws(() => api.buildRequest(`${overview}&sport=hike&include_ebike=true`, '123', 'filtered'), /unsupported-ebike-sport/);
for (const query of ['sport=', 'sport=mtb_easy,', 'sport=MTB', 'include_ebike=invalid']) {
  assert.throws(() => api.buildRequest(`${overview}&${query}`, '123', 'filtered'), /invalid-filters/);
}
const previewApi = context.TrailthreadFilterPreview;
const preview = previewApi.describe(sportOverview, api.buildRequest);
assert.equal(preview.valid, true);
assert.equal(preview.rows.find((row) => row.label === 'Sportarten').value, 'Mountainbike, Rennrad');
assert.equal(preview.rows.find((row) => row.label === 'Zeitraum').value, '01.09.2026 – 30.09.2026');
assert.equal(preview.rows.find((row) => row.label === 'Dauer').value, '2,5 – 4,5 h');
assert.match(previewApi.describe(`${overview}&new_filter=1`, api.buildRequest).warning, /new_filter/);
assert.equal(previewApi.describe(`${overview}&date=invalid`, api.buildRequest).valid, false);
assert.equal(previewApi.describe('invalid-url', api.buildRequest).valid, false);
assert.equal(previewApi.describe('https://www.komoot.com/user/123', api.buildRequest).rows[0].value, 'Alle Touren');
for (const [key, value] of Object.entries(expectedFilters)) assert.equal(durationParameters.get(key), value, key);
const lengthOverview = `${overview}${observedFilters}&filter_by_duration=false&min_length=35000&max_length=100000&min_duration=9000&max_duration=16200`;
const lengthParameters = new URL(api.buildRequest(lengthOverview, '123', 'filtered').href).searchParams;
assert.equal(lengthParameters.get('min_length'), '35000');
assert.equal(lengthParameters.get('max_length'), '100000');
assert.equal(lengthParameters.has('min_duration'), false);
assert.equal(lengthParameters.has('max_duration'), false);
assert.equal(lengthParameters.has('filter_by_duration'), false);
const durationMode = new URL(api.buildRequest(lengthOverview.replace('filter_by_duration=false', 'filter_by_duration=true'), '123', 'filtered').href).searchParams;
assert.equal(durationMode.has('min_length'), false);
assert.equal(durationMode.has('max_length'), false);
assert.equal(durationMode.get('max_duration'), '16200');
const unlimited = new URL(api.buildRequest(durationOverview.replace('max_duration=16200', 'max_duration=36000'), '123', 'filtered').href).searchParams;
assert.equal(unlimited.get('min_duration'), '9000');
assert.equal(unlimited.has('max_duration'), false);
for (const scope of ['all', 'recorded', 'planned']) {
  const params = new URL(api.buildRequest(lengthOverview, '123', scope).href).searchParams;
  for (const key of ['name', 'center', 'start_date', 'visibilities', 'min_uphill', 'min_length']) assert.equal(params.has(key), false);
}
for (const [day, start, end] of [
  ['2026-03-29', '2026-03-28T23:00:00.000Z', '2026-03-29T21:59:59.999Z'],
  ['2026-10-25', '2026-10-24T22:00:00.000Z', '2026-10-25T22:59:59.999Z'],
  ['2028-02-29', '2028-02-28T23:00:00.000Z', '2028-02-29T22:59:59.999Z'],
]) {
  const params = new URL(api.buildRequest(`${overview}&date=${day},${day}`, '123', 'filtered').href).searchParams;
  assert.equal(params.get('start_date'), start);
  assert.equal(params.get('end_date'), end);
}
for (const invalid of [
  'date=2026-02-30,2026-03-01', 'date=2026-09-30,2026-09-01', 'date=2026-09-01,',
  'location=91,6,30r', 'location=50,181,30r', 'location=50,6,0r', 'location=invalid',
  'visibility=', 'min_uphill=-1', 'min_uphill=NaN', 'min_length=100&max_length=50',
  'min_duration=9000&max_duration=8000', 'filter_by_duration=invalid', 'min_length=1&min_length=2',
]) assert.throws(() => api.buildRequest(`${overview}&${invalid}`, '123', 'filtered'), /invalid-filters/, invalid);

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

context.location = new URL(`${durationOverview}&sport=mtb_easy,racebike&include_ebike=true`);
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
  for (const [key, value] of Object.entries(expectedFilters)) assert.equal(url.searchParams.get(key), value, key);
  assert.equal(url.searchParams.get('sport_types'), 'mtb_easy,e_mtb_easy,racebike,e_racebike');
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

context.location = new URL(`${overview}&new_filter=1`);
assert.deepEqual(await add('filtered', manyPages), []);
assert.equal(selectedIds().length, 52);
assert.match(vm.runInContext('tourListLoadStatus', context), /noch nicht unterstützt/);
context.location = new URL(`${overview}&min_length=100&max_length=50`);
assert.deepEqual(await add('filtered', manyPages), []);
assert.equal(selectedIds().length, 52);
assert.match(vm.runInContext('tourListLoadStatus', context), /Filterwerte konnten nicht gelesen werden/);
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
assert.deepEqual(manifest.content_scripts[0].js, ['tour-selection.js', 'filter-preview.js', 'content-komoot.js']);
console.log('Komoot selection checks passed: additive scopes, URL mapping, 50 filtered results, pagination, deduplication, empty results, unsupported filters and partial failures.');
