const runs = new Map();
let pendingGpxDownload = null;

/**
 * Extracts a GPX file name from one browser download event.
 * @param {chrome.downloads.DownloadItem} item Browser-provided download metadata.
 * @returns {string|null} Downloaded GPX base name or null for unrelated downloads.
 */
function gpxFileNameFromDownloadItem(item) {
  const fileName = item.filename || '';
  if (!fileName.toLocaleLowerCase().endsWith('.gpx')) return null;
  const pieces = fileName.split(/[\\/]/);
  return pieces[pieces.length - 1] || null;
}

/**
 * Prepares one GPX browser-download observation while exactly one selected tour is being processed.
 * @param {object} run Active sequential tour export run.
 * @returns {Promise<boolean>} True when the observation was started and false when another run is pending.
 */
async function prepareGpxDownload(run) {
  if (pendingGpxDownload) return false;
  let downloads;
  try {
    downloads = await chrome.downloads.search({});
  } catch (error) {
    return false;
  }
  const knownDownloadIds = new Set();
  for (const item of downloads) {
    knownDownloadIds.add(item.id);
  }
  let resolveCompletion;
  const completion = new Promise((resolve) => {
    resolveCompletion = resolve;
  });
  const pending = { run, completion, resolveCompletion, knownDownloadIds, timeoutId: null, pollIntervalId: null, settled: false };
  pendingGpxDownload = pending;
  pending.timeoutId = setTimeout(() => {
    resolvePreparedGpxDownload(pending, { ok: false, error: 'Komoot hat innerhalb von 30 Sekunden keinen GPX-Download gestartet.' });
  }, 30000);
  pending.pollIntervalId = setInterval(() => {
    void findPreparedGpxDownload(pending);
  }, 500);
  return true;
}

/**
 * Resolves a pending GPX observation once, stopping all related background timers.
 * @param {object} pending Prepared GPX observation.
 * @param {object} result Successful file name or timeout error.
 * @returns {void} Returns without changes when this observation was already settled.
 */
function resolvePreparedGpxDownload(pending, result) {
  if (pending.settled) return;
  pending.settled = true;
  clearTimeout(pending.timeoutId);
  clearInterval(pending.pollIntervalId);
  pending.resolveCompletion(result);
}

/**
 * Looks for a newly added GPX entry in Chrome's download history as a fallback for missed events.
 * @param {object} pending Prepared GPX observation.
 * @returns {Promise<void>} Resolves after a matching download was found or no new GPX exists yet.
 */
async function findPreparedGpxDownload(pending) {
  if (pending.settled || pendingGpxDownload !== pending) return;
  try {
    const downloads = await chrome.downloads.search({});
    for (const item of downloads) {
      const fileName = gpxFileNameFromDownloadItem(item);
      if (!fileName || pending.knownDownloadIds.has(item.id)) continue;
      resolvePreparedGpxDownload(pending, { ok: true, fileName });
      return;
    }
  } catch (error) {
    // The direct downloads event remains available if the history query fails.
  }
}

/**
 * Resolves the active GPX wait when Chrome immediately reports a new GPX file.
 * @param {chrome.downloads.DownloadItem} item Browser-provided download metadata.
 * @returns {void} Ignores non-GPX downloads and runs without an active export wait.
 */
function handleCreatedDownload(item) {
  const fileName = gpxFileNameFromDownloadItem(item);
  if (!fileName) return;
  const pending = pendingGpxDownload;
  if (pending) resolvePreparedGpxDownload(pending, { ok: true, fileName });
}

/**
 * Waits for the prepared GPX observation and then clears it for the next selected tour.
 * @param {object} run Active sequential tour export run.
 * @returns {Promise<object>} Confirmed GPX file name or a descriptive timeout error.
 */
async function awaitPreparedGpxDownload(run) {
  if (!pendingGpxDownload || pendingGpxDownload.run !== run) return { ok: false, error: 'Es wurde kein GPX-Download vorbereitet.' };
  const pending = pendingGpxDownload;
  const result = await pending.completion;
  if (pendingGpxDownload === pending) pendingGpxDownload = null;
  clearTimeout(pending.timeoutId);
  clearInterval(pending.pollIntervalId);
  return result;
}

/**
 * Resolves the tab that owns a run request from a content script or extension popup.
 * @param {object} message Runtime message that may contain a source tab identifier.
 * @param {chrome.runtime.MessageSender} sender Chrome-provided message sender.
 * @returns {number|null} Source tab identifier, or null when no valid tab was supplied.
 */
function sourceTabIdFromMessage(message, sender) {
  if (sender.tab?.id != null) return sender.tab.id;
  if (Number.isInteger(message?.sourceTabId)) return message.sourceTabId;
  return null;
}

/**
 * Creates a popup-safe view of an active export run.
 * @param {object} run Internal export state.
 * @returns {object} Serializable status shown in the extension popup.
 */
function createRunStatus(run) {
  let current = run.entries.length + 1;
  if (current > run.total) current = run.total;
  return {
    current,
    total: run.total,
    status: run.status || 'Komoot-Export wird vorbereitet.',
    tourName: run.currentTour?.name || run.currentTour?.tourId || null,
    cancelled: run.cancelled === true,
    exportMode: run.exportMode
  };
}

chrome.downloads.onCreated.addListener(handleCreatedDownload);

/**
 * Starts a sequential export run for the selected Komoot tour URLs.
 * @param {number} sourceTabId Tab that contains the Komoot tour list.
 * @param {Array<object>} tours Selected tour descriptors from the content script.
 * @param {'gpx'|'backup'} exportMode Requested individual GPX or combined backup export mode.
 * @returns {Promise<void>} Resolves after the first export tab has been opened.
 */
async function startRun(sourceTabId, tours, exportMode) {
  const queue = tours.filter((tour) => typeof tour?.tourUrl === 'string' && tour.tourUrl);
  if (!queue.length) return;
  let normalizedExportMode = 'gpx';
  if (exportMode === 'backup') normalizedExportMode = 'backup';
  runs.set(sourceTabId, { sourceTabId, queue, total: queue.length, currentTabId: null, currentTabIsSource: false, currentTour: null, exportRequested: false, entries: [], cancelled: false, exportMode: normalizedExportMode, status: 'Export wird vorbereitet.' });
  await advanceRun(sourceTabId);
}

/**
 * Normalizes a Komoot tour URL so a selected route can be compared with the active browser tab.
 * @param {string} value Komoot URL that may contain a query string, fragment or nested subpage.
 * @returns {string} Origin and canonical numeric tour path, or an empty string for invalid URLs.
 */
function canonicalTourUrl(value) {
  try {
    const url = new URL(value);
    const pathMatch = url.pathname.match(/^(\/[a-z]{2}(?:-[a-z]{2})?)?\/tour\/\d+/i);
    if (pathMatch) return `${url.origin}${pathMatch[0]}`;
  } catch (error) {
    // An unavailable source tab URL simply cannot be reused for a tour export.
  }
  return '';
}

/**
 * Checks whether the selected tour is already displayed by the tab that started the export run.
 * @param {number} sourceTabId Browser tab identifier of the selected-tour page.
 * @param {object} tour Selected Komoot tour descriptor.
 * @returns {Promise<boolean>} True when the active source tab already shows the selected tour.
 */
async function sourceTabShowsTour(sourceTabId, tour) {
  try {
    const tab = await chrome.tabs.get(sourceTabId);
    return canonicalTourUrl(tab.url || '') === canonicalTourUrl(tour.tourUrl || '');
  } catch (error) {
    return false;
  }
}

/**
 * Shows the current extension activity in the toolbar of the original Komoot list tab.
 * @param {object} run Active export run.
 * @param {string} status Human-readable activity text.
 * @returns {Promise<void>} Resolves after the original tab was notified when it remains open.
 */
async function sendRunProgress(run, status) {
  const current = run.entries.length + 1;
  run.status = status;
  try {
    await chrome.tabs.sendMessage(run.sourceTabId, { type: 'trailthread:run-progress', current, total: run.total, status });
  } catch (error) {
    // The original list tab may have been closed while an export is active.
  }
}

/**
 * Starts the next selected tour export in the original list tab without opening a tour detail tab.
 * @param {number} sourceTabId Tab identifier of the selection page.
 * @returns {Promise<void>} Resolves when the next page has been opened or the run completed.
 */
async function advanceRun(sourceTabId) {
  const run = runs.get(sourceTabId);
  if (!run) return;
  if (run.cancelled || !run.queue.length) {
    await completeRun(run);
    return;
  }
  const nextTour = run.queue.shift();
  await sendRunProgress(run, `GPX wird exportiert: ${nextTour.name || nextTour.tourId}`);
  run.currentTabId = run.sourceTabId;
  run.currentTabIsSource = true;
  run.currentTour = nextTour;
  run.exportRequested = false;
  await sendDetailExport(run, run.sourceTabId);
}

/**
 * Sends the completed export state back to the original list tab and clears the run state.
 * @param {object} run Completed export run.
 * @returns {Promise<void>} Resolves after the list tab was notified when it is still available.
 */
async function completeRun(run) {
  runs.delete(run.sourceTabId);
  try {
    await chrome.tabs.sendMessage(run.sourceTabId, { type: 'trailthread:run-complete', entries: run.entries, cancelled: run.cancelled, exportMode: run.exportMode });
  } catch (error) {
    // The user may have closed the list tab before the export run finished.
  }
}

/**
 * Sends one guarded export command and allows a detail-ready message to retry when injection was late.
 * @param {object|null} run Active export run for the detail tab.
 * @param {number} tabId Browser tab identifier of the Komoot tour detail page.
 * @returns {Promise<void>} Resolves after the command was sent or marked retryable.
 */
async function sendDetailExport(run, tabId) {
  if (!run || run.exportRequested) return;
  run.exportRequested = true;
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'trailthread:export-current-tour', tour: run.currentTour, exportMode: run.exportMode });
  } catch (error) {
    // A single-page navigation can finish before its content script has registered.
    run.exportRequested = false;
  }
}

/**
 * Requests that the content script on the just-loaded detail page use its visible GPX button.
 * @param {number} tabId Browser tab identifier.
 * @param {object} changeInfo Chrome navigation update information.
 * @returns {Promise<void>} Resolves after the command was sent or ignored.
 */
async function requestDetailExport(tabId, changeInfo) {
  if (changeInfo.status !== 'complete') return;
  const run = [...runs.values()].find((item) => item.currentTabId === tabId);
  await sendDetailExport(run, tabId);
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  void requestDetailExport(tabId, changeInfo);
});

/**
 * Converts one binary response into a data URL without expanding a large byte array on the call stack.
 * @param {ArrayBuffer} buffer Image data received by the extension worker.
 * @param {string} contentType Verified image MIME type.
 * @returns {string} Data URL that can be transferred to the Komoot content script.
 */
function arrayBufferToDataUrl(buffer, contentType) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 32768;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

/**
 * Converts one requested file name into a safe relative name for Chrome's download folder.
 * @param {string} fileName Requested GPX file name from a Komoot tour.
 * @returns {string} Safe GPX file name without path separators or Windows-reserved characters.
 */
function safeDownloadFileName(fileName) {
  let safeName = String(fileName || 'komoot-tour.gpx').replace(/[\\/:*?"<>|]/g, '_').trim();
  if (!safeName) safeName = 'komoot-tour.gpx';
  if (!safeName.toLocaleLowerCase().endsWith('.gpx')) safeName += '.gpx';
  return safeName;
}

/**
 * Starts an automatic GPX download through Chrome instead of a page-side save dialog.
 * @param {string} fileName Requested GPX file name.
 * @param {string} gpxText Generated GPX document text.
 * @returns {Promise<object>} Successful download identifier or a descriptive error.
 */
async function downloadGeneratedGpx(fileName, gpxText) {
  if (typeof gpxText !== 'string' || !gpxText.trim()) return { ok: false, error: 'Die GPX-Datei enthält keine Daten.' };
  try {
    const downloadId = await chrome.downloads.download({
      url: `data:application/gpx+xml;charset=utf-8,${encodeURIComponent(gpxText)}`,
      filename: safeDownloadFileName(fileName),
      conflictAction: 'uniquify',
      saveAs: false
    });
    return { ok: true, downloadId };
  } catch (error) {
    return { ok: false, error: 'Chrome konnte die GPX-Datei nicht automatisch speichern.' };
  }
}

/**
 * Loads one permitted image in the extension worker so page CORS rules cannot block the backup export.
 * @param {string} sourceUrl Absolute image URL supplied by Komoot's cover-image resource.
 * @returns {Promise<object>} Data URL on success or a human-readable failure message.
 */
async function fetchKomootImageDataUrl(sourceUrl) {
  let imageUrl;
  try {
    imageUrl = new URL(sourceUrl);
  } catch (error) {
    return { ok: false, error: 'Die Bildadresse ist ungültig.' };
  }
  if (imageUrl.protocol !== 'https:') return { ok: false, error: 'Die Bildadresse verwendet kein HTTPS.' };
  try {
    const response = await fetch(imageUrl.href, { credentials: 'omit' });
    if (!response.ok) return { ok: false, error: `Bildabruf mit HTTP ${response.status} fehlgeschlagen.` };
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLocaleLowerCase().startsWith('image/')) return { ok: false, error: 'Der Bildabruf lieferte keinen Bildinhalt.' };
    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength) return { ok: false, error: 'Der Bildabruf lieferte eine leere Datei.' };
    return { ok: true, dataUrl: arrayBufferToDataUrl(buffer, contentType) };
  } catch (error) {
    return { ok: false, error: 'Das Bild konnte nicht aus der Erweiterung geladen werden.' };
  }
}

/**
 * Checks whether one URL targets a Komoot API host that this extension is permitted to request.
 * @param {string} pageUrl Absolute URL supplied by the Komoot image pagination response.
 * @returns {boolean} True when the URL is an HTTPS Komoot API resource.
 */
function isPermittedKomootApiPageUrl(pageUrl) {
  try {
    const url = new URL(pageUrl);
    const allowedHosts = ['www.komoot.com', 'komoot.com', 'www.komoot.de', 'komoot.de', 'api.komoot.de'];
    if (url.protocol !== 'https:') return false;
    if (!allowedHosts.includes(url.hostname)) return false;
    if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/v')) return false;
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Loads one Komoot API page in the extension worker when the content script is blocked by CORS.
 * @param {string} pageUrl Absolute Komoot API pagination URL.
 * @returns {Promise<object>} Parsed response payload or a descriptive error.
 */
async function fetchKomootApiPage(pageUrl) {
  if (!isPermittedKomootApiPageUrl(pageUrl)) return { ok: false, error: 'Die Komoot-Bildseiten-Adresse ist nicht erlaubt.' };
  try {
    const response = await fetch(pageUrl, { credentials: 'include' });
    if (!response.ok) return { ok: false, error: `Komoot-Bildseite lieferte HTTP ${response.status}.` };
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLocaleLowerCase().includes('json')) return { ok: false, error: 'Komoot-Bildseite lieferte keine JSON-Daten.' };
    return { ok: true, payload: await response.json() };
  } catch (error) {
    return { ok: false, error: 'Komoot-Bildseite konnte nicht im Hintergrund geladen werden.' };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'trailthread:download-generated-gpx') {
    void downloadGeneratedGpx(message.fileName, message.gpxText).then(sendResponse);
    return true;
  }
  if (message?.type === 'trailthread:fetch-komoot-image') {
    void fetchKomootImageDataUrl(message.sourceUrl).then(sendResponse);
    return true;
  }
  if (message?.type === 'trailthread:fetch-komoot-api-page') {
    void fetchKomootApiPage(message.pageUrl).then(sendResponse);
    return true;
  }
  if (message?.type === 'trailthread:start-run' && sender.tab?.id) {
    void startRun(sender.tab.id, message.tours || [], message.exportMode);
    sendResponse({ ok: true });
    return;
  }
  if (message?.type === 'trailthread:get-run-status') {
    const sourceTabId = sourceTabIdFromMessage(message, sender);
    if (sourceTabId == null) {
      sendResponse({ ok: false });
      return;
    }
    const run = runs.get(sourceTabId);
    let runStatus = null;
    if (run) runStatus = createRunStatus(run);
    sendResponse({ ok: true, run: runStatus });
    return;
  }
  if (message?.type === 'trailthread:cancel-run') {
    const sourceTabId = sourceTabIdFromMessage(message, sender);
    if (sourceTabId == null) {
      sendResponse({ ok: false });
      return;
    }
    const run = runs.get(sourceTabId);
    if (run) {
      run.cancelled = true;
      void sendRunProgress(run, 'Abbruch angefordert. Der laufende Schritt wird beendet.');
      if (pendingGpxDownload?.run === run) resolvePreparedGpxDownload(pendingGpxDownload, { ok: false, error: 'Der Export wurde abgebrochen.' });
      void chrome.tabs.sendMessage(sourceTabId, { type: 'trailthread:cancel-export-current-tour' }).catch(() => undefined);
      void completeRun(run);
    }
    sendResponse({ ok: true });
    return;
  }
  if (message?.type === 'trailthread:detail-ready' && sender.tab?.id) {
    const run = [...runs.values()].find((item) => item.currentTabId === sender.tab.id);
    void sendDetailExport(run, sender.tab.id);
    sendResponse({ ok: true });
    return;
  }
  if (message?.type === 'trailthread:tour-exported' && sender.tab?.id) {
    const run = [...runs.values()].find((item) => item.currentTabId === sender.tab.id);
    if (!run) {
      sendResponse({ ok: false });
      return;
    }
    run.entries.push(message.entry);
    const currentTabId = run.currentTabId;
    run.currentTabId = null;
    run.currentTour = null;
    run.exportRequested = false;
    if (currentTabId != null && !run.currentTabIsSource && !message.entry.keepTabOpen) void chrome.tabs.remove(currentTabId).catch(() => undefined);
    run.currentTabIsSource = false;
    void advanceRun(run.sourceTabId);
    sendResponse({ ok: true });
    return;
  }
  if (message?.type === 'trailthread:detail-progress' && sender.tab?.id) {
    const run = [...runs.values()].find((item) => item.currentTabId === sender.tab.id);
    if (run) void sendRunProgress(run, message.status || 'Komoot-Tour wird verarbeitet.');
    sendResponse({ ok: true });
    return;
  }
  if (message?.type === 'trailthread:prepare-gpx-download' && sender.tab?.id) {
    const run = [...runs.values()].find((item) => item.currentTabId === sender.tab.id);
    if (!run) {
      sendResponse({ ok: false, error: 'Kein aktiver Trailthread-Export für diesen Tab.' });
      return;
    }
    void prepareGpxDownload(run).then((prepared) => {
      if (!prepared) {
        sendResponse({ ok: false, error: 'Ein anderer GPX-Download wird bereits erwartet.' });
        return;
      }
      sendResponse({ ok: true });
    });
    return true;
  }
  if (message?.type === 'trailthread:await-prepared-gpx-download' && sender.tab?.id) {
    const run = [...runs.values()].find((item) => item.currentTabId === sender.tab.id);
    if (!run) {
      sendResponse({ ok: false, error: 'Kein aktiver Trailthread-Export für diesen Tab.' });
      return;
    }
    void awaitPreparedGpxDownload(run).then(sendResponse);
    return true;
  }
});
