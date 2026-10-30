const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { gunzipSync } = require('node:zlib');
const { chromium } = require('playwright');

/**
 * Exercises the real content scripts and toolbar in Chromium with a local Komoot API fixture.
 * @returns {Promise<void>} Resolves after initialization, additive selection and geometry assertions pass.
 */
async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, timezoneId: 'Europe/Berlin' });
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
      if (url.pathname === '/api/v007/collections/3179080/compilation/') {
        let response = { _embedded: { items: [{ id: '302', type: 'tour_planned' }, { id: '303', type: 'tour_recorded' }, { id: '301', type: 'tour_recorded' }] } };
        if (!url.searchParams.has('page')) response = {
          _embedded: { items: [{ id: '1', type: 'tour_recorded' }, { id: '301', type: 'tour_recorded' }, { id: '999', type: 'highlight' }] },
          _links: { next: { href: 'https://api.komoot.de/v007/collections/3179080/compilation/?page=1&limit=24' } },
        };
        await route.fulfill({ json: response });
        return;
      }
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
      window.fixtureMessageListeners = [];
      window.chrome = { runtime: { id: 'fixture', sendMessage: async () => ({}), onMessage: { addListener(listener) { window.fixtureMessageListeners.push(listener); } } } };
    });
    const observedFilters = '&location=50.909622,6.808193,30r&date=2026-09-01,2026-09-30&visibility=PUBLIC&min_uphill=0&max_uphill=1800&sport=mtb_easy,racebike&include_ebike=false&order=duration_desc';
    await page.goto(`https://www.komoot.com/de-de/user/123/activities?type=recorded&search=Erft${observedFilters}&min_duration=9000&max_duration=16200`);
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
    await page.addScriptTag({ path: path.join(extension, 'filter-preview.js') });
    await page.addScriptTag({ path: path.join(extension, 'backup-filenames.js') });
    await page.addScriptTag({ path: path.join(extension, 'content-komoot.js') });
    await page.locator('.trailthread-komoot-toggle').click();
    const filtered = page.locator('[data-tour-type="filtered"]');
    const preview = page.locator('.trailthread-komoot-filter-preview');
    assert.equal(requests.length, 0);
    assert.match(await preview.innerText(), /Mountainbike, Rennrad/);
    assert.match(await preview.innerText(), /01\.09\.2026 – 30\.09\.2026/);
    assert.match(await preview.innerText(), /2,5 – 4,5 h/);
    await filtered.click();
    await page.waitForFunction(() => document.querySelector('.trailthread-komoot-status').textContent === '50 Touren hinzugefügt, 50 insgesamt markiert.');
    assert.equal(requests.length, 3);
    assert.equal(await page.locator('.trailthread-komoot-selection-input:checked').count(), 24);
    for (const href of requests) {
      assert.equal(new URL(href).searchParams.get('name'), 'Erft');
      assert.equal(new URL(href).searchParams.get('type'), 'tour_recorded');
      assert.equal(new URL(href).searchParams.has('order'), false);
      const params = new URL(href).searchParams;
      assert.equal(params.get('center'), '50.909622,6.808193');
      assert.equal(params.get('max_distance'), '30000');
      assert.equal(params.get('start_date'), '2026-08-31T22:00:00.000Z');
      assert.equal(params.get('end_date'), '2026-09-30T21:59:59.999Z');
      assert.equal(params.get('visibilities'), 'PUBLIC');
      assert.equal(params.get('min_uphill'), '0');
      assert.equal(params.get('max_uphill'), '1800');
      assert.equal(params.get('min_duration'), '9000');
      assert.equal(params.get('max_duration'), '16200');
      assert.equal(params.get('sport_types'), 'mtb_easy,racebike');
    }
    await page.evaluate((query) => history.pushState({}, '', query), `?type=recorded&search=Erft${observedFilters.replace('include_ebike=false', 'include_ebike=true')}&filter_by_duration=false&min_length=35000&max_length=100000&min_duration=9000`);
    await page.waitForFunction(() => document.querySelector('.trailthread-komoot-filter-preview').textContent.includes('E-Mountainbike'));
    assert.match(await preview.innerText(), /35 – 100 km/);
    assert.doesNotMatch(await preview.innerText(), /2,5 – 4,5 h/);
    const lengthRequestStart = requests.length;
    await filtered.click();
    await page.waitForFunction(() => document.querySelector('.trailthread-komoot-status').textContent === '0 Touren hinzugefügt, 50 insgesamt markiert.');
    assert.equal(requests.length - lengthRequestStart, 3);
    for (const href of requests.slice(lengthRequestStart)) {
      const params = new URL(href).searchParams;
      assert.equal(params.get('min_length'), '35000');
      assert.equal(params.get('max_length'), '100000');
      assert.equal(params.has('min_duration'), false);
      assert.equal(params.get('sport_types'), 'mtb_easy,e_mtb_easy,racebike,e_racebike');
    }
    await page.evaluate(() => history.pushState({}, '', '?type=recorded&search=Emscher'));
    await filtered.click();
    await page.waitForFunction(() => document.querySelector('.trailthread-komoot-status').textContent === '1 Tour hinzugefügt, 51 insgesamt markiert.');
    await page.locator('[data-tour-type="planned"]').click();
    await page.waitForFunction(() => document.querySelector('.trailthread-komoot-status').textContent === '1 Tour hinzugefügt, 52 insgesamt markiert.');
    await page.locator('[data-tour-type="all"]').click();
    await page.waitForFunction(() => document.querySelector('.trailthread-komoot-status').textContent === '0 Touren hinzugefügt, 52 insgesamt markiert.');
    await page.evaluate(() => history.pushState({}, '', '/de-de/collection/3179080/eine-vennbahn-reise'));
    const collectionButton = page.locator('[data-tour-type="collection"]');
    await collectionButton.waitFor({ state: 'visible' });
    assert.equal(await page.locator('.trailthread-komoot-selection-actions').isVisible(), false);
    assert.equal(await filtered.isVisible(), false);
    assert.equal(await preview.isVisible(), false);
    const collectionRequestStart = requests.length;
    await collectionButton.click();
    await page.waitForFunction(() => document.querySelector('.trailthread-komoot-status').textContent === '3 Touren hinzugefügt, 55 insgesamt markiert.');
    assert.equal(requests.length - collectionRequestStart, 2);
    for (const href of requests.slice(collectionRequestStart)) assert.equal(new URL(href).pathname, '/api/v007/collections/3179080/compilation/');
    await collectionButton.click();
    await page.waitForFunction(() => document.querySelector('.trailthread-komoot-status').textContent === '0 Touren hinzugefügt, 55 insgesamt markiert.');
    await page.evaluate(() => history.pushState({}, '', '/de-de/user/123/activities?type=recorded'));
    await filtered.waitFor({ state: 'visible' });
    assert.equal(await collectionButton.isVisible(), false);
    await page.evaluate(() => history.pushState({}, '', '?type=recorded&search=Erft&new_filter=1'));
    const requestCount = requests.length;
    await page.waitForFunction(() => document.querySelector('[data-tour-type="filtered"]').disabled);
    assert.match(await page.locator('.trailthread-komoot-filter-warning').innerText(), /new_filter/);
    assert.equal(requests.length, requestCount);
    const box = await filtered.boundingBox();
    assert.ok(box && box.width > 100 && box.x >= 0 && box.x + box.width <= 1280);
    await page.locator('.trailthread-komoot-clear-selection').click();
    assert.equal(await page.locator('.trailthread-komoot-selection-input:checked').count(), 0);
    assert.equal(await page.locator('.trailthread-komoot-summary').textContent(), '0 Touren ausgewählt');
    await page.evaluate(() => history.pushState({}, '', '?type=recorded&search=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E'));
    await page.waitForFunction(() => !document.querySelector('[data-tour-type="filtered"]').disabled);
    assert.equal(await preview.locator('img').count(), 0);
    assert.match(await preview.innerText(), /<img src=x onerror=alert\(1\)>/);
    await page.setViewportSize({ width: 844, height: 390 });
    const toolbarBox = await page.locator('.trailthread-komoot-toolbar').boundingBox();
    assert.ok(toolbarBox && toolbarBox.y >= 0 && toolbarBox.y + toolbarBox.height <= 390);
    await page.goto('https://www.komoot.com/de-de/collection/3179080/eine-vennbahn-reise');
    await page.evaluate(() => {
      const heading = document.createElement('h1');
      heading.textContent = 'Eine Vennbahn-Reise: Bikepacking / drei Länder?';
      document.querySelector('main').append(heading);
    });
    await page.addStyleTag({ path: path.join(extension, 'styles.css') });
    await page.addScriptTag({ path: path.join(extension, 'tour-selection.js') });
    await page.addScriptTag({ path: path.join(extension, 'filter-preview.js') });
    await page.addScriptTag({ path: path.join(extension, 'backup-filenames.js') });
    await page.addScriptTag({ path: path.join(extension, 'content-komoot.js') });
    await page.locator('.trailthread-komoot-toggle').click();
    assert.equal(await page.locator('.trailthread-komoot-summary').textContent(), '0 Touren ausgewählt');
    assert.equal(await page.locator('[data-tour-type="collection"]').isVisible(), true);
    await page.locator('[data-tour-type="collection"]').click();
    await page.waitForFunction(() => document.querySelector('.trailthread-komoot-status').textContent === '4 Touren hinzugefügt, 4 insgesamt markiert.');
    await page.locator('.trailthread-komoot-download-backup').click();
    const collectionDownloadEvent = page.waitForEvent('download');
    await page.evaluate(() => {
      completedBackupEntries.push({ tourId: '301', name: 'Etappe 1', gpxText: '<gpx />' });
      history.pushState({}, '', '/de-de/collection/999/andere-kollektion');
      document.querySelector('h1').textContent = 'Andere Kollektion';
      window.fixtureMessageListeners[0]({ type: 'trailthread:run-complete', exportMode: 'backup', entries: [{ tourId: '301' }] }, {}, () => {});
    });
    const collectionDownload = await collectionDownloadEvent;
    assert.equal(collectionDownload.suggestedFilename(), 'Eine Vennbahn-Reise_ Bikepacking _ drei Länder_.json.gz');
    const collectionPayload = JSON.parse(gunzipSync(await fs.readFile(await collectionDownload.path())).toString('utf8'));
    assert.equal(collectionPayload.tracks.length, 1);
    console.log('Collection backup naming passed: original collection title survives navigation and a partial export.');
    await page.goto('https://www.komoot.com/de-de/user/123/activities?type=recorded&search=KeineTreffer');
    await page.addStyleTag({ path: path.join(extension, 'styles.css') });
    await page.addScriptTag({ path: path.join(extension, 'tour-selection.js') });
    await page.addScriptTag({ path: path.join(extension, 'filter-preview.js') });
    await page.addScriptTag({ path: path.join(extension, 'backup-filenames.js') });
    await page.addScriptTag({ path: path.join(extension, 'content-komoot.js') });
    await page.locator('.trailthread-komoot-toggle').click();
    assert.match(await page.locator('.trailthread-komoot-filter-preview').innerText(), /KeineTreffer/);
    assert.deepEqual(errors, []);
    const exportEntry = { tourId: '123', name: 'Runde ab Frechen', dateStart: '2026-09-27T06:02:00Z',
      gpxText: '<gpx />', gpxFileName: '20260927_0602_Runde ab Frechen.gpx' };
    for (const test of [
      { entries: [exportEntry], expected: '20260927_0602_Runde ab Frechen.json.gz', count: 1 },
      { entries: [exportEntry, { ...exportEntry, tourId: '456' }], expected: 'trailthread-komoot-touren.json.gz', count: 2 },
      { entries: [{ ...exportEntry, gpxText: null }, exportEntry], expected: '20260927_0602_Runde ab Frechen.json.gz', count: 1 },
      { entries: [{ ...exportEntry, gpxFileName: null }], expected: '20260927_0602_Runde ab Frechen.json.gz', count: 1 },
    ]) {
      const downloadEvent = page.waitForEvent('download');
      const count = await page.evaluate((entries) => downloadTrailthreadTourBackup(entries, false), test.entries);
      const download = await downloadEvent;
      assert.equal(download.suggestedFilename(), test.expected);
      assert.equal(count, test.count);
      const payload = JSON.parse(gunzipSync(await fs.readFile(await download.path())).toString('utf8'));
      assert.equal(payload.kind, 'gpx-bibliothek-touren');
      assert.equal(payload.tracks.length, test.count);
    }
    console.log('Backup downloads passed: single-tour GPX basename, multi-tour collection name, failed entries and metadata fallback; gzip payloads verified.');
    const popup = await browser.newPage({ viewport: { width: 320, height: 600 } });
    popup.on('pageerror', (error) => errors.push(error.message));
    const manifest = JSON.parse(await fs.readFile(path.join(extension, 'manifest.json'), 'utf8'));
    const popupFiles = {
      '/popup.html': { contentType: 'text/html', body: await fs.readFile(path.join(extension, 'popup.html'), 'utf8') },
      '/popup.js': { contentType: 'application/javascript', body: await fs.readFile(path.join(extension, 'popup.js'), 'utf8') },
      '/popup.css': { contentType: 'text/css', body: await fs.readFile(path.join(extension, 'popup.css'), 'utf8') },
    };
    await popup.route('https://trailthread-popup.test/**', async (route) => {
      const file = popupFiles[new URL(route.request().url()).pathname];
      if (file) await route.fulfill(file);
      else await route.fulfill({ status: 404, body: '' });
    });
    await popup.addInitScript((version) => {
      window.fixtureRun = null;
      window.chrome = {
        tabs: { query: async () => [{ id: 1 }] },
        runtime: { getManifest: () => ({ version }), sendMessage: async () => ({ ok: true, run: window.fixtureRun }) },
      };
    }, manifest.version);
    await popup.goto('https://trailthread-popup.test/popup.html');
    assert.equal(await popup.locator('.popup-version').textContent(), manifest.version);
    assert.equal(await popup.locator('.popup-status').textContent(), 'Kein Export aktiv.');
    const projectLinks = popup.locator('.popup-project-info a');
    assert.equal(await projectLinks.count(), 2);
    assert.equal(await projectLinks.nth(0).getAttribute('href'), 'https://github.com/marsrakete/trailthread');
    assert.equal(await projectLinks.nth(1).getAttribute('href'), 'https://github.com/marsrakete/trailthread/issues/new');
    for (const link of await projectLinks.all()) {
      assert.equal(await link.getAttribute('target'), '_blank');
      assert.match(await link.getAttribute('rel'), /noopener/);
    }
    await popup.evaluate(async () => {
      window.fixtureRun = { status: 'Bilder werden geladen.', current: 3, total: 10, tourName: 'Erft-Tour' };
      await refreshRunStatus();
    });
    assert.equal(await popup.locator('.popup-count').textContent(), 'Tour 3/10');
    assert.equal(await popup.locator('.popup-cancel').isVisible(), true);
    const footerBox = await popup.locator('.popup-project-info').boundingBox();
    assert.ok(footerBox && footerBox.y >= 0 && footerBox.y + footerBox.height <= 600);
    assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth <= 320), true);
    assert.deepEqual(errors, []);
    console.log('Popup test passed: installed version, project/issue links, active export status and 320px layout; no pageerrors.');
    console.log('Chromium toolbar test passed: no pageerrors, 50 filtered tours, additive searches/types, checkbox sync, unsupported filters, clear selection and button geometry.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
