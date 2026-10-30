import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isSupportedKomootUrl, registerActionState } from '../browser-extension/action-state.js';

for (const host of ['komoot.com', 'www.komoot.com', 'komoot.de', 'www.komoot.de']) {
  assert.equal(isSupportedKomootUrl(`https://${host}/de-de/tour/123`), true);
}
for (const value of [undefined, null, 12, '', 'invalid', 'about:blank', 'chrome://extensions',
  'http://komoot.com/', 'https://api.komoot.de/', 'https://komoot.com.example.org/',
  'https://example.org/?url=https://komoot.com', 'https://komoot.com@example.org/']) {
  assert.equal(isSupportedKomootUrl(value), false, String(value));
}

/**
 * Creates a browser-event fixture exposing its registered handler to the test.
 * @returns {object} Event registration and async dispatch methods.
 */
function event() {
  let handler;
  return {
    addListener(listener) { handler = listener; },
    async emit(...args) { await handler(...args); },
  };
}

const tabs = new Map([[1, { id: 1, url: 'https://www.komoot.com/' }],
  [2, { id: 2, url: 'https://example.org/' }], [3, { id: 3 }]]);
const states = new Map();
const browser = {
  action: {
    async enable(id) { states.set(id, true); },
    async disable(id) { states.set(id, false); },
  },
  tabs: {
    async get(id) { if (!tabs.has(id)) throw new Error('Tab closed'); return tabs.get(id); },
    async query() { return [...tabs.values()]; },
    onUpdated: event(), onActivated: event(), onCreated: event(), onReplaced: event(),
  },
  runtime: { onInstalled: event(), onStartup: event() },
};
const controller = registerActionState(browser);
await controller.ready;
assert.deepEqual([...states], [[1, true], [2, false], [3, false]]);
tabs.set(1, { id: 1, url: 'https://example.org/' });
await browser.tabs.onUpdated.emit(1, { url: 'https://www.komoot.com/' });
assert.equal(states.get(1), false); // Current tab URL wins over stale event data.
tabs.set(2, { id: 2, url: 'https://komoot.de/' });
await browser.tabs.onActivated.emit({ tabId: 2 });
assert.equal(states.get(2), true);
tabs.set(4, { id: 4, url: 'https://www.komoot.de/' });
await browser.tabs.onCreated.emit({ id: 4 });
assert.equal(states.get(4), true);
await browser.tabs.onReplaced.emit(4, 3);
tabs.set(4, { id: 4, url: 'https://example.org/' });
await browser.runtime.onStartup.emit();
assert.equal(states.get(4), false);
tabs.set(4, { id: 4, url: 'https://komoot.com/' });
await browser.runtime.onInstalled.emit();
assert.equal(states.get(4), true);
tabs.delete(4);
await controller.updateTab(4);
await controller.updateTab(-1);
await controller.updateTab(undefined);
browser.tabs.query = async () => { throw new Error('Browser closing'); };
await controller.refreshAllTabs();
const manifest = JSON.parse(await readFile(new URL('../browser-extension/manifest.json', import.meta.url), 'utf8'));
assert.equal(manifest.action.default_state, 'disabled');
console.log('Extension action contracts passed: supported hosts, default disabled, navigation, activation, startup, installation and closed tabs.');
