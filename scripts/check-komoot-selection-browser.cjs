const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

/**
 * Exercises the real content scripts and toolbar in Chromium with a local Komoot API fixture.
 * @returns {Promise<void>} Resolves after initialization, additive selection and geometry assertions pass.
 */
async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    const requests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const tours = Array.from({ length: 50 }, (_, index) => ({
      id: String(index + 1), type: 'tour_recorded', name: `Erft ${index + 1}`,
    }));
    tours[0].name = 'Erft Emscher';
    tours.push({ id: '100', type: 'tour_recorded', name: 'Emscher' });
    tours.push({ id: '200', type: 'tour_planned', name: 'Geplant' });
    await page.route('https://www.komoot.com/**', async (route) => {
      const url = new URL(route.request().url());
      if (!url.pathname.startsWith('/api/')) {
        await route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><title>Komoot fixture</title></head><body><main></main></body></html>' });
        return;
      }
      requests.push(url.href);
      const name = (url.searchParams.get('name') || '').toLowerCase();
      const type = url.searchParams.get('type');
      const matches = tours.filter((tour) => (!type || tour.type === type) && tour.name.toLowerCase().includes(name));
      const index = Number(url.searchParams.get('page') || 0);
      const response = { _embedded: { tours: matches.slice(index * 24, (index + 1) * 24) } };
      if ((index + 1) * 24 < matches.length) {
        response._links = { next: { href: `https://api.komoot.de/v007/users/123/tours/?page=${index + 1}` } };
      }
      await route.fulfill({ json: response });
    });
    await page.addInitScript(() => {
      window.chrome = { runtime: { id: 'fixture', sendMessage: async () => ({}), onMessage: { addListener() {} } } };
    });
    await page.goto('https://www.komoot.com/de-de/user/123/activities?type=recorded&search=Erft');
    await page.evaluate(() => {
      const main = document.querySelector('main');
      for (let id = 1; id <= 24; id += 1) {
        const card = document.createElement('article');
        const link = document.createElement('a');
        link.href = `/de-de/tour/${id}`;
        link.textContent = `Erft ${id}`;
        card.append(link);
        main.append(card);
      }
    });
    const extension = path.resolve(__dirname, '../browser-extension');
    await page.addStyleTag({ path: path.join(extension, 'styles.css') });
    await page.addScriptTag({ path: path.join(extension, 'tour-selection.js') });
    await page.addScriptTag({ path: path.join(extension, 'content-komoot.js') });
    await page.locator('.trailthread-komoot-toggle').click();
    const filtered = page.locator('[data-tour-type="filtered"]');
    await filtered.click();
    await page.waitForFunction(() => document.querySelector('.trailthread-komoot-status').textContent === '50 Touren hinzugefügt, 50 insgesamt markiert.');
    assert.equal(requests.length, 3);
    assert.equal(await page.locator('.trailthread-komoot-selection-input:checked').count(), 24);
    for (const href of requests) {
      assert.equal(new URL(href).searchParams.get('name'), 'Erft');
      assert.equal(new URL(href).searchParams.get('type'), 'tour_recorded');
    }
    await page.evaluate(() => history.pushState({}, '', '?type=recorded&search=Emscher'));
    await filtered.click();
    await page.waitForFunction(() => document.querySelector('.trailthread-komoot-status').textContent === '1 Tour hinzugefügt, 51 insgesamt markiert.');
    await page.locator('[data-tour-type="planned"]').click();
    await page.waitForFunction(() => document.querySelector('.trailthread-komoot-status').textContent === '1 Tour hinzugefügt, 52 insgesamt markiert.');
    await page.locator('[data-tour-type="all"]').click();
    await page.waitForFunction(() => document.querySelector('.trailthread-komoot-status').textContent === '0 Touren hinzugefügt, 52 insgesamt markiert.');
    await page.evaluate(() => history.pushState({}, '', '?type=recorded&search=Erft&sport=hike'));
    const requestCount = requests.length;
    await filtered.click();
    await page.waitForFunction(() => document.querySelector('.trailthread-komoot-status').textContent.includes('noch nicht unterstützt'));
    assert.equal(requests.length, requestCount);
    const box = await filtered.boundingBox();
    assert.ok(box && box.width > 100 && box.x >= 0 && box.x + box.width <= 1280);
    await page.locator('.trailthread-komoot-clear-selection').click();
    assert.equal(await page.locator('.trailthread-komoot-selection-input:checked').count(), 0);
    assert.equal(await page.locator('.trailthread-komoot-summary').textContent(), '0 Touren ausgewählt');
    assert.deepEqual(errors, []);
    console.log('Chromium toolbar test passed: no pageerrors, 50 filtered tours, additive searches/types, checkbox sync, unsupported filters, clear selection and button geometry.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
