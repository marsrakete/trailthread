const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

/**
 * Waits for the real extension action state on one browser tab.
 * @param {object} worker Extension service worker.
 * @param {string} href Current tab URL.
 * @param {boolean} expected Expected enabled state.
 * @returns {Promise<void>} Resolves when the action reaches the expected state.
 */
async function waitForAction(worker, href, expected) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await worker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find((item) => item.url === url);
      if (!tab) return null;
      return chrome.action.isEnabled(tab.id);
    }, href);
    if (result === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`Extension action state did not become ${expected} for ${href}`);
}

/**
 * Loads the actual unpacked extension and checks action availability across real tab events.
 * @returns {Promise<void>} Resolves when service-worker initialization and tab state checks pass.
 */
async function main() {
  const extension = path.resolve(__dirname, '../browser-extension');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  const errors = [];
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
  try {
    await context.route('**/*', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Action test</title>' }));
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
    const first = await context.newPage();
    await first.goto('https://example.org/');
    await waitForAction(worker, first.url(), false);
    assert.equal(await worker.evaluate(() => chrome.action.isEnabled()), false);
    for (const host of ['www.komoot.com', 'komoot.com', 'www.komoot.de', 'komoot.de']) {
      await first.goto(`https://${host}/about`);
      await waitForAction(worker, first.url(), true);
    }
    const second = await context.newPage();
    await second.goto('https://example.org/second');
    await waitForAction(worker, second.url(), false);
    await first.bringToFront();
    await waitForAction(worker, first.url(), true);
    await second.bringToFront();
    await waitForAction(worker, second.url(), false);
    await first.goto('https://komoot.com.example.org/');
    await waitForAction(worker, first.url(), false);
    await first.goto('https://www.komoot.com/about');
    await waitForAction(worker, first.url(), true);
    await first.goto('https://example.org/after-komoot');
    await waitForAction(worker, first.url(), false);
    assert.deepEqual(errors, []);
    console.log('Real extension Chromium test passed: worker loads, action disabled globally, four Komoot hosts enabled, other hosts/navigation/tab switches disabled; no pageerrors.');
  } finally {
    await context.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
