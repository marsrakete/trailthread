import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../browser-extension/content-komoot.js', import.meta.url), 'utf8');
const context = vm.createContext({
  URL,
  console,
  location: new URL('https://www.komoot.com/de-de/user/123/activities?type=recorded'),
  document: { querySelectorAll: () => [] },
  chrome: { runtime: { onMessage: { addListener() {} } } },
});
// Keep the real selection workflow while suppressing page observers and worker startup.
vm.runInContext(source.replace(/^observeKomootPage\(\);$/m, '').replace(/^void sendRuntimeMessage\(\{ type: 'trailthread:detail-ready' \}\);$/m, ''), context);

assert.equal(vm.runInContext('currentKomootListType()', context), 'recorded');
context.location = new URL('https://www.komoot.com/de-de/user/123/routes?type=planned');
assert.equal(vm.runInContext('currentKomootListType()', context), 'planned');
context.location = new URL('https://www.komoot.com/de-de/user/123/activities');
assert.equal(vm.runInContext('currentKomootListType()', context), 'recorded');
context.location = new URL('https://www.komoot.com/de-de/user/123/routes');
assert.equal(vm.runInContext('currentKomootListType()', context), 'planned');
context.location = new URL('https://www.komoot.com/de-de/user/123');
assert.equal(vm.runInContext('currentKomootListType()', context), 'all');
context.location = new URL('https://www.komoot.com/de-de/user/123/activities?type=recorded');

const pages = [
  { _embedded: { tours: [{ id: 1, type: 'tour_recorded' }, { id: 2, type: 'planned' }, { id: 3, type: 'unexpected' }] }, _links: { next: { href: '?page=1' } } },
  { _embedded: { tours: [{ id: 1, type: 'recorded' }, { id: 4, type: 'tour_planned' }, { id: 5, type: 'recorded' }, { id: 'invalid', type: 'recorded' }] } },
];

/**
 * Runs the real paginated selector against mixed tour fixtures.
 * @param {string} type Requested selection scope.
 * @param {boolean} failSecondPage Whether to simulate a subsequent network failure.
 * @returns {Promise<string[]>} Selected identifiers after the operation settles.
 */
async function select(type, failSecondPage = false) {
  let requests = 0;
  context.loadKomootApiPage = async () => {
    if (failSecondPage && requests === 1) throw new Error('offline');
    return pages[requests++];
  };
  context.requestedType = type;
  await vm.runInContext('loadAllKomootTours(requestedType)', context);
  return Array.from(vm.runInContext('[...SELECTED_TOURS.keys()]', context));
}

assert.deepEqual(await select('all'), ['1', '2', '3', '4', '5']);
vm.runInContext('clearTourSelection()', context);
assert.equal(vm.runInContext('SELECTED_TOURS.size', context), 0);
assert.equal(vm.runInContext('tourListLoadStatus', context), '');
vm.runInContext('clearTourSelection()', context);
assert.equal(vm.runInContext('SELECTED_TOURS.size', context), 0);
assert.deepEqual(await select('recorded'), ['1', '5']);
assert.equal(vm.runInContext('tourListLoadStatus', context), '2 gemachte Touren wurden markiert.');
assert.deepEqual(await select('planned'), ['2', '4']);
vm.runInContext('runActive = true; clearTourSelection(); runActive = false;', context);
assert.equal(vm.runInContext('SELECTED_TOURS.size', context), 2);
vm.runInContext('tourListLoading = true; clearTourSelection(); tourListLoading = false;', context);
assert.equal(vm.runInContext('SELECTED_TOURS.size', context), 2);
assert.deepEqual(await select('invalid'), ['2', '4']);
assert.deepEqual(await select('recorded', true), ['1']);
assert.match(vm.runInContext('tourListLoadStatus', context), /nicht vollständig markiert/);
assert.equal(vm.runInContext('tourListLoading', context), false);
context.loadKomootApiPage = async () => ({ _embedded: { tours: [] } });
await vm.runInContext("loadAllKomootTours('planned')", context);
assert.equal(vm.runInContext('SELECTED_TOURS.size', context), 0);
console.log('Komoot selection checks passed: URL context, pagination, type filters, replacement, duplicates, empty results and partial failures.');
