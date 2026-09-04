const TOUR_URL_PATTERN = /\/tour\/(\d+)/i;
const SELECTED_TOURS = new Map();
const LOADED_TOURS = new Map();
let toolbar = null;
let runActive = false;
let tourListLoading = false;
let tourListLoadStatus = '';
let selectionTemplate = null;
let listEnhancementIsStarting = false;
let enhancementQueued = false;
let lastRunFailureCount = 0;
let activeExportMode = null;
const completedBackupEntries = [];
let currentExportCancelled = false;
let currentExportAbortController = null;

/**
 * Checks whether this content script still belongs to a loaded extension instance.
 * @returns {boolean} True when Chrome still exposes a valid extension runtime identifier.
 */
function hasActiveExtensionContext() {
  try {
    return Boolean(chrome.runtime.id);
  } catch (error) {
    return false;
  }
}

/**
 * Sends one message to the extension worker and ignores an invalidated context after an extension reload.
 * @param {object} message Serializable message for the Trailthread background worker.
 * @returns {Promise<object|null>} Worker response or null when this content script is no longer current.
 */
async function sendRuntimeMessage(message) {
  if (!hasActiveExtensionContext()) return null;
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    return null;
  }
}

/**
 * Creates a stable tour descriptor from a Komoot tour link and its closest visible card.
 * @param {HTMLAnchorElement} link Link pointing to a Komoot tour.
 * @returns {object|null} Tour descriptor or null when the link has no numeric tour identifier.
 */
function describeTourLink(link) {
  const match = link.href.match(TOUR_URL_PATTERN);
  if (!match) return null;
  const card = link.closest('article, li, [role="listitem"]') || link.parentElement;
  const heading = card?.querySelector('h1, h2, h3, h4') || link;
  return { tourId: match[1], tourUrl: canonicalTourUrl(link.href, match[1]), name: heading.textContent.trim(), card };
}

/**
 * Removes Komoot editing and photo subpaths so an export always starts from the actual tour page.
 * @param {string} href Any Komoot URL that contains a numeric tour identifier.
 * @param {string} tourId Numeric Komoot tour identifier.
 * @returns {string} Canonical locale-aware tour URL without a fragment, query or nested page path.
 */
function canonicalTourUrl(href, tourId) {
  const url = new URL(href);
  const pathMatch = url.pathname.match(/^(\/[a-z]{2}(?:-[a-z]{2})?)?\/tour\/\d+/i);
  if (pathMatch) return `${url.origin}${pathMatch[0]}`;
  return `${url.origin}/tour/${tourId}`;
}

/**
 * Finds likely tour links without relying on Komoot class names that may change frequently.
 * @returns {HTMLAnchorElement[]} Unique tour links found in the current document.
 */
function findTourLinks() {
  const links = [...document.querySelectorAll('a[href*="/tour/"]')];
  const unique = new Map();
  for (const link of links) {
    const tour = describeTourLink(link);
    if (tour && !unique.has(tour.tourId)) unique.set(tour.tourId, link);
  }
  return [...unique.values()];
}

/**
 * Creates the extension controls in a detached template fragment without a page-side network request.
 * @returns {DocumentFragment} Fragment containing the toolbar and selection templates.
 */
function createToolbarTemplates() {
  const host = document.createElement('template');
  host.innerHTML = `
    <template id="trailthread-komoot-toolbar-template">
      <aside class="trailthread-komoot-toolbar" aria-live="polite">
        <strong class="trailthread-komoot-title">Trailthread</strong>
        <span class="trailthread-komoot-summary">Keine Tour ausgewählt</span>
        <button class="trailthread-komoot-load-all" type="button" hidden>Alle eigenen Touren laden</button>
        <button class="trailthread-komoot-select-all" type="button" hidden>Alle auswählen</button>
        <button class="trailthread-komoot-download-gpx" type="button" disabled>Ausgewählte GPX-Dateien herunterladen</button>
        <button class="trailthread-komoot-download-backup" type="button" disabled>Als Trailthread-Datei mit Bildern exportieren</button>
        <button class="trailthread-komoot-cancel" type="button" hidden>Export abbrechen</button>
        <p class="trailthread-komoot-status">Wähle eigene Touren aus.</p>
      </aside>
    </template>
    <template id="trailthread-komoot-selection-template">
      <label class="trailthread-komoot-selection" title="Für Trailthread auswählen">
        <input class="trailthread-komoot-selection-input" type="checkbox">
        <span>Trailthread</span>
      </label>
    </template>`;
  return host.content;
}

/**
 * Checks whether the current Komoot URL is a single tour detail page.
 * @returns {boolean} True when the browser currently shows a numeric Komoot tour URL.
 */
function isKomootTourDetailPage() {
  return TOUR_URL_PATTERN.test(location.pathname);
}

/**
 * Creates a selected-tour descriptor directly from the current Komoot tour URL.
 * @returns {object|null} Current tour descriptor or null when the page is not a tour detail page.
 */
function describeCurrentKomootTour() {
  const match = location.pathname.match(TOUR_URL_PATTERN);
  if (!match) return null;
  const heading = document.querySelector('h1');
  let name = `Komoot Tour ${match[1]}`;
  if (heading && heading.textContent.trim()) name = heading.textContent.trim();
  return { tourId: match[1], tourUrl: canonicalTourUrl(location.href, match[1]), name };
}

/**
 * Updates the toolbar controls and text for the current local selection and export state.
 * @returns {void} Does nothing until the toolbar template has been mounted.
 */
function renderToolbar() {
  if (!toolbar) return;
  const count = SELECTED_TOURS.size;
  const summary = toolbar.querySelector('.trailthread-komoot-summary');
  const gpxDownloadButton = toolbar.querySelector('.trailthread-komoot-download-gpx');
  const backupDownloadButton = toolbar.querySelector('.trailthread-komoot-download-backup');
  const loadAllButton = toolbar.querySelector('.trailthread-komoot-load-all');
  const selectAllButton = toolbar.querySelector('.trailthread-komoot-select-all');
  const cancelButton = toolbar.querySelector('.trailthread-komoot-cancel');
  const status = toolbar.querySelector('.trailthread-komoot-status');
  const availableTours = availableTourDescriptors();
  const allAvailableToursSelected = availableTours.length > 0 && availableTours.every((tour) => SELECTED_TOURS.has(tour.tourId));
  if (isKomootTourDetailPage()) summary.textContent = 'Aktuelle Tour';
  else if (count === 1) summary.textContent = '1 Tour ausgewählt';
  else summary.textContent = `${count} Touren ausgewählt`;
  gpxDownloadButton.disabled = !count || runActive;
  backupDownloadButton.disabled = !count || runActive;
  loadAllButton.hidden = isKomootTourDetailPage();
  loadAllButton.disabled = runActive || tourListLoading;
  if (tourListLoading) loadAllButton.textContent = 'Touren werden geladen …';
  else loadAllButton.textContent = 'Alle eigenen Touren laden';
  selectAllButton.hidden = isKomootTourDetailPage();
  selectAllButton.disabled = !availableTours.length || runActive || tourListLoading;
  if (allAvailableToursSelected) selectAllButton.textContent = 'Auswahl aufheben';
  else selectAllButton.textContent = 'Alle auswählen';
  cancelButton.hidden = !runActive;
  if (runActive && activeExportMode === 'gpx') status.textContent = 'Komoot lädt die ausgewählten GPX-Dateien nacheinander herunter.';
  else if (runActive) status.textContent = 'Komoot bereitet die ausgewählten Touren mit Bildern vor.';
  else if (tourListLoading) status.textContent = 'Alle eigenen Touren werden direkt über Komoot geladen.';
  else if (tourListLoadStatus) status.textContent = tourListLoadStatus;
  else if (isKomootTourDetailPage()) status.textContent = 'Wähle GPX-Download oder Trailthread-Datei mit eingebetteten Bildern.';
  else if (count) status.textContent = 'Wähle GPX-Massendownload oder eine gemeinsame Trailthread-Datei.';
  else status.textContent = 'Wähle eigene Touren aus.';
}

/**
 * Adds a local selection checkbox to one discovered Komoot tour card.
 * @param {HTMLAnchorElement} link Tour link inside a visible Komoot card.
 * @param {HTMLTemplateElement} selectionTemplate Template used for the inserted checkbox.
 * @returns {void} Does nothing when the card has already been extended.
 */
function addTourSelection(link, selectionTemplate) {
  const tour = describeTourLink(link);
  if (!tour || !tour.card || tour.card.querySelector('.trailthread-komoot-selection')) return;
  const fragment = selectionTemplate.content.cloneNode(true);
  const control = fragment.querySelector('.trailthread-komoot-selection');
  const input = fragment.querySelector('.trailthread-komoot-selection-input');
  input.checked = SELECTED_TOURS.has(tour.tourId);
  input.addEventListener('change', () => {
    if (input.checked) SELECTED_TOURS.set(tour.tourId, { tourId: tour.tourId, tourUrl: tour.tourUrl, name: tour.name });
    else SELECTED_TOURS.delete(tour.tourId);
    renderToolbar();
  });
  control.addEventListener('click', (event) => event.stopPropagation());
  tour.card.prepend(fragment);
}

/**
 * Adds extension controls to tour cards that appeared after a Komoot client-side navigation.
 * @param {HTMLTemplateElement} selectionTemplate Template used for the inserted checkbox.
 * @returns {void} Scans the current document once.
 */
function enhanceTourList(selectionTemplate) {
  for (const link of findTourLinks()) addTourSelection(link, selectionTemplate);
}

/**
 * Collects the unique tour descriptors currently visible in Komoot's list.
 * @returns {Array<object>} Visible tours that can be selected by the extension.
 */
function visibleTourDescriptors() {
  const tours = [];
  for (const link of findTourLinks()) {
    const tour = describeTourLink(link);
    if (tour) tours.push(tour);
  }
  return tours;
}

/**
 * Combines Komoot cards visible in the document with tours loaded through the paginated API.
 * @returns {Array<object>} Unique tour descriptors available for selection and export.
 */
function availableTourDescriptors() {
  const tours = new Map(LOADED_TOURS);
  for (const tour of visibleTourDescriptors()) tours.set(tour.tourId, tour);
  return [...tours.values()];
}

/**
 * Selects every visible tour or clears that visible selection when all are already selected.
 * @returns {void} Synchronizes the toolbar and every injected tour checkbox.
 */
function toggleVisibleTourSelection() {
  const availableTours = availableTourDescriptors();
  const allAvailableToursSelected = availableTours.length > 0 && availableTours.every((tour) => SELECTED_TOURS.has(tour.tourId));
  for (const tour of availableTours) {
    if (allAvailableToursSelected) {
      SELECTED_TOURS.delete(tour.tourId);
    } else {
      SELECTED_TOURS.set(tour.tourId, { tourId: tour.tourId, tourUrl: tour.tourUrl, name: tour.name });
    }
  }
  syncTourSelectionControls();
  renderToolbar();
}

/**
 * Reads one usable Komoot user identifier from a tour metadata response.
 * @param {object|null} metadata Tour metadata loaded from Komoot.
 * @returns {string|null} Komoot user identifier or null when the response has no owner data.
 */
function komootUserIdFromTourMetadata(metadata) {
  const userId = komootPhotoText(metadata?.userId);
  if (userId) return userId;
  return null;
}

/**
 * Finds a Komoot profile identifier in links rendered by the currently visible list page.
 * @returns {string|null} User identifier or null when no profile link is present.
 */
function komootUserIdFromDocument() {
  for (const link of document.querySelectorAll('a[href*="/user/"]')) {
    try {
      const url = new URL(link.href, location.origin);
      const match = url.pathname.match(/\/user\/([^/?#]+)/i);
      if (!match) continue;
      const userId = decodeURIComponent(match[1]).trim();
      if (userId) return userId;
    } catch (error) {
      // A malformed profile link cannot identify the active Komoot account.
    }
  }
  return null;
}

/**
 * Determines the signed-in account identifier from the current Komoot list context.
 * @returns {Promise<string|null>} User identifier needed by Komoot's paginated tour endpoint.
 */
async function loadKomootUserId() {
  const visibleTours = visibleTourDescriptors();
  if (visibleTours.length) {
    const metadata = await loadKomootTourMetadata(visibleTours[0].tourId);
    const metadataUserId = komootUserIdFromTourMetadata(metadata);
    if (metadataUserId) return metadataUserId;
  }
  return komootUserIdFromDocument();
}

/**
 * Converts one API tour summary into a descriptor usable by the existing export queue.
 * @param {object} tour Komoot tour summary from the user's paginated API response.
 * @returns {object|null} Selection descriptor or null when the summary has no numeric tour identifier.
 */
function createKomootApiTourDescriptor(tour) {
  const tourId = String(tour?.id || '').trim();
  if (!/^\d+$/.test(tourId)) return null;
  const localeMatch = location.pathname.match(/^\/([a-z]{2}(?:-[a-z]{2})?)\//i);
  let localePath = '';
  if (localeMatch) localePath = `/${localeMatch[1]}`;
  const name = komootPhotoText(tour?.name) || `Komoot Tour ${tourId}`;
  return {
    tourId,
    tourUrl: `${location.origin}${localePath}/tour/${tourId}`,
    name,
    type: normalizeKomootTourType(tour?.type)
  };
}

/**
 * Loads every own Komoot tour through the API's next-page links and selects the received tours.
 * @returns {Promise<void>} Resolves after all available pages were processed or a failure was shown.
 */
async function loadAllKomootTours() {
  if (tourListLoading || isKomootTourDetailPage()) return;
  tourListLoading = true;
  tourListLoadStatus = '';
  renderToolbar();
  try {
    const userId = await loadKomootUserId();
    if (!userId) throw new Error('Die Komoot-Nutzer-ID konnte auf dieser Liste nicht ermittelt werden.');
    let pageUrl = `${location.origin}/api/v007/users/${encodeURIComponent(userId)}/tours/`;
    let workerPageUrl = pageUrl;
    const loadedPages = new Set();
    let loadedCount = 0;
    while (pageUrl && !loadedPages.has(pageUrl)) {
      loadedPages.add(pageUrl);
      tourListLoadStatus = `Komoot-Tourseite ${loadedPages.size} wird geladen.`;
      renderToolbar();
      const payload = await loadKomootApiPage(pageUrl, workerPageUrl);
      const tours = payload?._embedded?.tours;
      if (Array.isArray(tours)) {
        for (const tour of tours) {
          const descriptor = createKomootApiTourDescriptor(tour);
          if (!descriptor) continue;
          LOADED_TOURS.set(descriptor.tourId, descriptor);
          SELECTED_TOURS.set(descriptor.tourId, descriptor);
          loadedCount += 1;
        }
      }
      const nextHref = payload?._links?.next?.href;
      if (typeof nextHref === 'string' && nextHref) {
        workerPageUrl = new URL(nextHref, pageUrl).href;
        pageUrl = sameOriginKomootApiPageUrl(workerPageUrl);
      } else {
        pageUrl = null;
      }
    }
    syncTourSelectionControls();
    tourListLoadStatus = `${loadedCount} eigene Komoot-Touren wurden geladen und ausgewählt.`;
  } catch (error) {
    let details = 'Unbekannter Fehler';
    if (error instanceof Error) details = error.message;
    tourListLoadStatus = `Komoot-Touren konnten nicht vollständig geladen werden: ${details}`;
  } finally {
    tourListLoading = false;
    renderToolbar();
  }
}

/**
 * Synchronizes every inserted checkbox with the current internal tour selection.
 * @returns {void} Updates visible controls without changing Komoot's own page state.
 */
function syncTourSelectionControls() {
  for (const input of document.querySelectorAll('.trailthread-komoot-selection-input')) {
    const control = input.closest('.trailthread-komoot-selection');
    const card = control?.parentElement;
    const link = card?.querySelector('a[href*="/tour/"]') || null;
    const tour = link instanceof HTMLAnchorElement ? describeTourLink(link) : null;
    input.checked = !!tour && SELECTED_TOURS.has(tour.tourId);
  }
}

/**
 * Collects usable image URLs from a Komoot cover-image value that may contain multiple size variants.
 * @param {unknown} value One cover-image source value from Komoot's response.
 * @param {Set<string>} urls Mutable set that receives unique HTTP image URLs.
 * @returns {void} Adds image URLs without requesting or downloading their binary data.
 */
function collectCoverImageUrls(value, urls) {
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) urls.add(value);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectCoverImageUrls(item, urls);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (!['src', 'url', 'large', 'medium', 'small', 'thumb', 'thumbnail'].includes(key)) continue;
    collectCoverImageUrls(item, urls);
  }
}

/**
 * Reads a short human-readable text value from one Komoot photo field.
 * @param {unknown} value Candidate title, caption or identifier value from Komoot.
 * @returns {string|null} Trimmed text or null when the value is not usable.
 */
function komootPhotoText(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  return text;
}

/**
 * Maps Komoot's API-specific tour type values to Trailthread's stable filter values.
 * @param {unknown} value Tour type supplied by Komoot's metadata endpoint.
 * @returns {'recorded'|'planned'|'unknown'} Track type stored in a Trailthread export.
 */
function normalizeKomootTourType(value) {
  const type = komootPhotoText(value);
  if (!type) return 'unknown';
  const normalizedType = type.toLocaleLowerCase();
  if (normalizedType === 'tour_planned' || normalizedType === 'planned') return 'planned';
  if (normalizedType === 'tour_recorded' || normalizedType === 'recorded') return 'recorded';
  return 'unknown';
}

/**
 * Creates a date-prefixed GPX file name from Komoot tour metadata.
 * @param {string|null} dateStart Komoot tour start date, optionally including a time.
 * @param {string} title Human-readable Komoot tour title.
 * @returns {string} File name in YYYYMMDD_HHMM_Titel.gpx format.
 */
function komootGpxFileName(dateStart, title) {
  let datePrefix = '00000000_0000';
  const dateText = komootPhotoText(dateStart);
  if (dateText) {
    const match = dateText.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
    if (match) {
      let hours = '00';
      let minutes = '00';
      if (match[4]) hours = match[4];
      if (match[5]) minutes = match[5];
      datePrefix = `${match[1]}${match[2]}${match[3]}_${hours}${minutes}`;
    }
  }
  return `${datePrefix}_${title}.gpx`;
}

/**
 * Creates one Trailthread-compatible photo reference while retaining Komoot's location metadata.
 * @param {object} item One item from Komoot's cover-image response.
 * @param {string} sourceUrl One image URL extracted from the item.
 * @returns {object} Photo reference with coordinates where Komoot provided them.
 */
function createKomootPhotoReference(item, sourceUrl) {
  return {
    externalUrl: sourceUrl,
    sourceUrl,
    title: komootPhotoText(item?.title) || komootPhotoText(item?.name),
    caption: komootPhotoText(item?.caption) || komootPhotoText(item?.title),
    id: komootPhotoText(item?.id),
    createdAt: komootPhotoText(item?.created_at) || komootPhotoText(item?.createdAt),
    location: item?.location || null,
    lineLocation: item?.line_location || item?.lineLocation || null
  };
}

/**
 * Unwraps Komoot's varying embedded collection shapes into their individual items.
 * @param {unknown} value Komoot response value, collection wrapper or item.
 * @returns {Array<unknown>} Flattened items from the supplied response value.
 */
function komootEmbeddedItems(value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    const items = [];
    for (const item of value) items.push(...komootEmbeddedItems(item));
    return items;
  }
  if (typeof value !== 'object') return [value];
  const collectionKeys = ['items', 'segments', 'elements', 'results', 'values', 'data', 'collection'];
  for (const key of collectionKeys) {
    if (Object.hasOwn(value, key)) return komootEmbeddedItems(value[key]);
  }
  return [value];
}

/**
 * Extracts a readable surface or way-type label from one Komoot analysis item.
 * @param {unknown} item Komoot surface or way-type item.
 * @param {Array<string>} preferredKeys Field names specific to the requested analysis type.
 * @returns {string|null} Normalized label, or null when no usable value is present.
 */
function komootAnalysisValue(item, preferredKeys) {
  if (typeof item === 'string') return komootPhotoText(item);
  if (!item || typeof item !== 'object') return null;
  const keys = ['name', 'type', 'label', ...preferredKeys, 'element', 'slug', 'value'];
  for (const key of keys) {
    const value = komootPhotoText(item[key]);
    if (!value) continue;
    if (key === 'element') return value.replace(/^[a-z]+#/, '');
    return value;
  }
  return null;
}

/**
 * Converts Komoot analysis items into labels and point-indexed segments used by Trailthread.
 * @param {unknown} value Embedded Komoot surface or way-type collection.
 * @param {Array<string>} preferredKeys Field names specific to the requested analysis type.
 * @returns {{values: Array<string>, segments: Array<object>}} Labels and their optional point ranges.
 */
function collectKomootAnalysis(value, preferredKeys) {
  const values = [];
  const segments = [];
  const knownValues = new Set();
  for (const item of komootEmbeddedItems(value)) {
    const label = komootAnalysisValue(item, preferredKeys);
    if (!label) continue;
    if (!knownValues.has(label)) {
      knownValues.add(label);
      values.push(label);
    }
    if (!item || typeof item !== 'object') continue;
    const from = Number(item.from);
    const to = Number(item.to);
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    const raw = komootPhotoText(item.element) || label;
    segments.push({ from, to, value: label, raw });
  }
  return { values, segments };
}

/**
 * Converts Komoot navigation items into Trailthread's portable directions format.
 * @param {unknown} value Embedded Komoot directions collection.
 * @returns {Array<object>} Human-readable navigation hints with optional distance and type.
 */
function collectKomootDirections(value) {
  const directions = [];
  for (const item of komootEmbeddedItems(value)) {
    if (!item || typeof item !== 'object') continue;
    const instruction = komootPhotoText(item.instruction) || komootPhotoText(item.text) || komootPhotoText(item.name) || komootPhotoText(item.title);
    const type = komootPhotoText(item.type) || komootPhotoText(item._type) || komootPhotoText(item.icon);
    let distanceM = null;
    const distanceCandidates = [item.distance, item.segment_length, item.length];
    for (const candidate of distanceCandidates) {
      const distance = Number(candidate);
      if (!Number.isFinite(distance)) continue;
      distanceM = distance;
      break;
    }
    if (!instruction && !type && distanceM == null) continue;
    directions.push({ instruction, distanceM, type });
  }
  return directions;
}

/**
 * Creates a short descriptive fallback when a Komoot tour has no own text description.
 * @param {object} tour Detailed Komoot tour response.
 * @returns {string|null} Summary of distance, duration and elevation, or null without usable facts.
 */
function komootTourDescriptionFallback(tour) {
  const facts = [];
  const locale = komootLanguage();
  const distanceMeters = Number(tour?.distance);
  if (Number.isFinite(distanceMeters) && distanceMeters > 0) facts.push(`Distanz: ${(distanceMeters / 1000).toLocaleString(locale, { maximumFractionDigits: 2 })} km`);
  const durationSeconds = Number(tour?.duration);
  if (Number.isFinite(durationSeconds) && durationSeconds > 0) facts.push(`Geschätzte Dauer: ${(durationSeconds / 3600).toLocaleString(locale, { maximumFractionDigits: 1 })} h`);
  const elevationUp = Number(tour?.elevation_up);
  if (Number.isFinite(elevationUp) && elevationUp > 0) facts.push(`Höhenmeter bergauf: ${Math.round(elevationUp)} m`);
  const elevationDown = Number(tour?.elevation_down);
  if (Number.isFinite(elevationDown) && elevationDown > 0) facts.push(`Höhenmeter bergab: ${Math.round(elevationDown)} m`);
  if (!facts.length) return null;
  return facts.join(', ');
}

/**
 * Adds analysis metadata supplied by Komoot's detailed tour response to one export entry.
 * @param {object} entry Trailthread export entry that receives the metadata.
 * @param {object} tour Detailed Komoot tour response.
 * @returns {void} Updates the supplied entry in place.
 */
function applyKomootTourDetailMetadata(entry, tour) {
  const surfaceAnalysis = collectKomootAnalysis(tour?._embedded?.surfaces, ['surface', 'surface_type']);
  const wayTypeAnalysis = collectKomootAnalysis(tour?._embedded?.way_types, ['way_type', 'wayType']);
  entry.durationHours = null;
  const durationSeconds = Number(tour?.duration);
  if (Number.isFinite(durationSeconds) && durationSeconds > 0) entry.durationHours = durationSeconds / 3600;
  if (!entry.description) entry.description = komootTourDescriptionFallback(tour);
  entry.surfaces = surfaceAnalysis.values;
  entry.surfaceSegments = surfaceAnalysis.segments;
  entry.wayTypes = wayTypeAnalysis.values;
  entry.wayTypeSegments = wayTypeAnalysis.segments;
  entry.directions = collectKomootDirections(tour?._embedded?.directions);
  entry.timeline = tour?._embedded?.timeline || [];
  entry.komootDetailRelations = collectKomootDetailRelations(tour);
}

/**
 * Extracts a numeric Komoot tour identifier from a tour-relation URL.
 * @param {string|null|undefined} value Absolute or relative Komoot relation URL.
 * @returns {string|null} Referenced tour identifier, or null when the URL does not reference a tour.
 */
function komootTourIdFromRelationUrl(value) {
  const match = String(value || '').match(/\/tours\/(\d+)(?:[/?#]|$)/i);
  if (!match) return null;
  return match[1];
}

/**
 * Selects safe relation diagnostics from a Komoot detail response for export troubleshooting.
 * @param {object} tour Detailed Komoot tour response.
 * @returns {{linkKeys: Array<string>, masterHref: string|null, masterTourId: string|null, source: unknown}} Relation metadata without copying complete API links.
 */
function collectKomootDetailRelations(tour) {
  const links = tour?._links || {};
  const masterHref = links?.master?.href || null;
  return {
    linkKeys: Object.keys(links).sort(),
    masterHref,
    masterTourId: komootTourIdFromRelationUrl(masterHref),
    source: tour?.source ?? null
  };
}

/**
 * Returns timeline events from the collection shapes used by Komoot's detail and timeline endpoints.
 * @param {unknown} payload Raw Komoot timeline response.
 * @returns {Array<object>} Timeline event list, or an empty array when no events are present.
 */
function komootTimelineItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?._embedded?.items)) return payload._embedded.items;
  if (Array.isArray(payload?._embedded?.timeline)) return payload._embedded.timeline;
  return [];
}

/**
 * Indicates whether a timeline value contains at least one event.
 * @param {unknown} timeline Raw or normalized timeline value.
 * @returns {boolean} True when one or more timeline events exist.
 */
function hasKomootTimelineItems(timeline) {
  return komootTimelineItems(timeline).length > 0;
}

/**
 * Determines the active Komoot language code from the current route URL.
 * @returns {string} Two-letter language code for Komoot API requests.
 */
function komootLanguage() {
  const localeMatch = location.pathname.match(/^\/([a-z]{2})(?:-[a-z]{2})?\//i);
  if (localeMatch) return localeMatch[1].toLocaleLowerCase();
  return 'de';
}

/**
 * Loads one tour's authoritative metadata from Komoot without opening its detail page.
 * @param {string} tourId Numeric Komoot tour identifier.
 * @returns {Promise<object|null>} Name, description and optional type/date/sport data, or null on failure.
 */
async function loadKomootTourMetadata(tourId) {
  try {
    const path = `/api/v007/tours/${encodeURIComponent(tourId)}?hl=${encodeURIComponent(komootLanguage())}`;
    let response = await fetch(`${location.origin}${path}`, { credentials: 'include' });
    if (!response.ok) response = await fetch(`https://api.komoot.de${path}`, { credentials: 'include' });
    if (!response.ok) return null;
    const tour = await response.json();
    return {
      name: komootPhotoText(tour?.name),
      description: komootPhotoText(tour?.description) || komootPhotoText(tour?.subtitle) || komootPhotoText(tour?.summary),
      type: komootPhotoText(tour?.type),
      dateStart: komootPhotoText(tour?.date),
      sport: komootPhotoText(tour?.sport),
      userId: komootPhotoText(tour?._embedded?.creator?.username) || komootPhotoText(tour?.creator?.username),
      authorName: komootPhotoText(tour?._embedded?.creator?.display_name) || komootPhotoText(tour?.creator?.display_name),
      authorUser: komootPhotoText(tour?._embedded?.creator?.username) || komootPhotoText(tour?.creator?.username)
    };
  } catch (error) {
    return null;
  }
}

/**
 * Loads one Komoot API page through the active browser session with an API-host fallback.
 * @param {string} pageUrl Same-origin Komoot API page URL for the content-script attempt.
 * @param {string} workerPageUrl Original Komoot pagination URL for the CORS-safe worker fallback.
 * @returns {Promise<object>} Parsed Komoot API response.
 */
async function loadKomootApiPage(pageUrl, workerPageUrl) {
  try {
    const response = await fetch(pageUrl, { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (pageError) {
    const result = await sendRuntimeMessage({ type: 'trailthread:fetch-komoot-api-page', pageUrl: workerPageUrl });
    if (!result?.ok) throw new Error(result?.error || 'Komoot-Bildseite konnte nicht geladen werden.');
    return result.payload;
  }
}

/**
 * Rewrites a Komoot API pagination link to the active logged-in Komoot origin.
 * @param {string} pageUrl Absolute or relative Komoot API pagination link.
 * @returns {string} Same-origin API URL that keeps the browser session and avoids cross-origin CORS failures.
 */
function sameOriginKomootApiPageUrl(pageUrl) {
  const source = new URL(pageUrl, location.origin);
  let path = source.pathname;
  if (!path.startsWith('/api/')) path = `/api${path}`;
  return `${location.origin}${path}${source.search}`;
}

/**
 * Loads every image page from Komoot's observed per-tour cover-image resource.
 * @param {string} tourId Numeric Komoot tour identifier.
 * @returns {Promise<object>} Deduplicated photo references and an optional partial-load error.
 */
async function loadKomootCoverImages(tourId) {
  let pageUrl = `${location.origin}/api/v007/tours/${encodeURIComponent(tourId)}/cover_images/`;
  let workerPageUrl = pageUrl;
  const photos = [];
  const seen = new Set();
  const loadedPages = new Set();
  let error = null;
  while (pageUrl && !loadedPages.has(pageUrl)) {
    if (currentExportCancelled) {
      error = 'Der Export wurde beim Laden der Komoot-Bildseiten abgebrochen.';
      break;
    }
    loadedPages.add(pageUrl);
    let payload;
    try {
      await reportDetailProgress(`Komoot-Bildseite ${loadedPages.size} wird geladen.`);
      payload = await loadKomootApiPage(pageUrl, workerPageUrl);
    } catch (loadError) {
      let details = 'Unbekannter Fehler';
      if (loadError instanceof Error) details = loadError.message;
      error = `Nicht alle Komoot-Bildseiten konnten geladen werden: ${details}`;
      break;
    }
    const items = payload?._embedded?.items;
    if (Array.isArray(items)) {
      for (const item of items) {
        const urls = new Set();
        collectCoverImageUrls(item?.src, urls);
        for (const sourceUrl of urls) {
          if (seen.has(sourceUrl)) continue;
          seen.add(sourceUrl);
          photos.push(createKomootPhotoReference(item, sourceUrl));
        }
      }
    }
    const nextHref = payload?._links?.next?.href;
    if (typeof nextHref === 'string' && nextHref) {
      try {
        workerPageUrl = new URL(nextHref, pageUrl).href;
        pageUrl = sameOriginKomootApiPageUrl(workerPageUrl);
      } catch (nextError) {
        error = 'Komoot hat eine ungültige Bildseiten-Verknüpfung geliefert.';
        pageUrl = null;
      }
    } else pageUrl = null;
  }
  return { photos, error };
}

/**
 * Extracts visible metadata and optional image references from the current Komoot tour detail page.
 * @param {object} tour Selected list entry that initiated the detail-page export.
 * @param {boolean} includeImages Whether Komoot image references should be requested for a backup export.
 * @returns {Promise<object>} Export entry with source metadata and optional image references.
 */
async function collectTourEntry(tour, includeImages) {
  let title = tour.name || `Komoot Tour ${tour.tourId}`;
  let description = null;
  let type = normalizeKomootTourType(tour.type);
  let dateStart = null;
  let sport = null;
  let authorName = null;
  let authorUser = null;
  const photos = [];
  try {
    await reportDetailProgress('Tourdaten werden bei Komoot geladen.');
    const metadata = await loadKomootTourMetadata(tour.tourId);
    if (metadata?.name) title = metadata.name;
    if (metadata?.description) description = metadata.description;
    if (metadata?.type) type = metadata.type;
    if (metadata?.dateStart) dateStart = metadata.dateStart;
    if (metadata?.sport) sport = metadata.sport;
    if (metadata?.authorName) authorName = metadata.authorName;
    if (metadata?.authorUser) authorUser = metadata.authorUser;
  } catch (error) {
    // The list entry remains a safe fallback when Komoot does not provide tour metadata.
  }
  if (isKomootTourDetailPage() && includeImages) {
    const heading = document.querySelector('h1');
    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (heading && heading.textContent.trim() && title.startsWith('Komoot Tour ')) title = heading.textContent.trim();
    if (descriptionMeta && descriptionMeta.content.trim() && !description) description = descriptionMeta.content.trim();
    for (const image of document.querySelectorAll('main img[src], article img[src]')) {
      const sourceUrl = image.currentSrc || image.src;
      let imageTitle = null;
      if (image.alt) imageTitle = image.alt.trim();
      photos.push({ externalUrl: sourceUrl, sourceUrl, title: imageTitle, caption: imageTitle });
    }
  }
  const usablePhotos = photos.filter((photo) => photo.sourceUrl && !photo.sourceUrl.startsWith('data:'));
  const uniquePhotos = [];
  const seen = new Set();
  for (const photo of usablePhotos) {
    if (seen.has(photo.sourceUrl)) continue;
    seen.add(photo.sourceUrl);
    uniquePhotos.push(photo);
  }
  const entry = {
    tourId: tour.tourId,
    tourUrl: tour.tourUrl,
    name: title,
    description,
    photos: uniquePhotos,
    gpxFileName: komootGpxFileName(dateStart, title),
    type: normalizeKomootTourType(type),
    dateStart,
    sport,
    authorName,
    authorUser,
    durationHours: null,
    surfaces: [],
    surfaceSegments: [],
    wayTypes: [],
    wayTypeSegments: [],
    directions: [],
        timeline: [],
        komootDetailRelations: null
  };
  if (includeImages) {
    try {
      const coverImageResult = await loadKomootCoverImages(tour.tourId);
      if (coverImageResult.photos.length) entry.photos = coverImageResult.photos;
      if (coverImageResult.error) entry.photoExportError = coverImageResult.error;
    } catch (error) {
      entry.photoExportError = 'Komoot-Bilder konnten nicht geladen werden.';
    }
  }
  return entry;
}

/**
 * Builds the allowed Komoot tour-detail endpoint used to create a GPX fallback locally.
 * @param {string} tourId Numeric Komoot tour identifier.
 * @returns {string} Same-origin tour-detail URL containing coordinate data.
 */
function buildKomootTourDataEndpoint(tourId) {
  const parameters = new URLSearchParams();
  parameters.set('_embedded', 'coordinates,way_types,surfaces,directions,participants');
  parameters.set('hl', komootLanguage());
  parameters.set('directions', 'v2');
  parameters.set('fields', 'timeline');
  parameters.set('timeline_highlights_fields', 'tips,recommenders');
  parameters.set('format', 'coordinate_array');
  return `${location.origin}/api/v007/tours/${encodeURIComponent(tourId)}?${parameters.toString()}`;
}

/**
 * Builds the Komoot endpoint that serves timeline events separately from a tour detail response.
 * @param {string} tourId Numeric Komoot tour identifier.
 * @returns {string} Same-origin timeline URL with highlight tips and recommenders requested.
 */
function buildKomootTourTimelineEndpoint(tourId) {
  const parameters = new URLSearchParams();
  parameters.set('hl', komootLanguage());
  parameters.set('page', '0');
  parameters.set('limit', '1000');
  parameters.set('timeline_highlights_fields', 'tips,recommenders');
  return `${location.origin}/api/v007/tours/${encodeURIComponent(tourId)}/timeline/?${parameters.toString()}`;
}

/**
 * Resolves Komoot's own timeline link to the current Komoot origin for session-authenticated requests.
 * @param {object} tour Detailed Komoot tour response.
 * @param {string} tourId Numeric Komoot tour identifier used as a fallback.
 * @returns {string} Same-origin timeline endpoint for the selected tour.
 */
function komootTimelineEndpointFromTour(tour, tourId) {
  const link = tour?._links?.timeline?.href;
  if (!link) return buildKomootTourTimelineEndpoint(tourId);
  try {
    const target = new URL(link, location.origin);
    let pathname = target.pathname;
    if (!pathname.startsWith('/api/')) pathname = `/api${pathname}`;
    target.searchParams.set('hl', komootLanguage());
    target.searchParams.set('page', '0');
    target.searchParams.set('limit', '1000');
    target.searchParams.set('timeline_highlights_fields', 'tips,recommenders');
    return `${location.origin}${pathname}?${target.searchParams.toString()}`;
  } catch (error) {
    return buildKomootTourTimelineEndpoint(tourId);
  }
}

/**
 * Loads optional timeline events without making the primary GPX export dependent on them.
 * @param {string} endpoint Same-origin Komoot timeline URL.
 * @param {AbortSignal} signal Cancellation signal for the active export run.
 * @returns {Promise<{items: Array<object>, status: number, endpoint: string}>} Timeline items and transport diagnostics.
 */
async function loadKomootTourTimeline(endpoint, signal) {
  const response = await fetch(endpoint, { credentials: 'include', signal });
  if (!response.ok) return { items: [], status: response.status, endpoint };
  const payload = await response.json();
  return { items: komootTimelineItems(payload), status: response.status, endpoint };
}

/**
 * Escapes a text value for use in generated GPX XML.
 * @param {unknown} value Text or value that may contain XML control characters.
 * @returns {string} XML-safe text representation.
 */
function escapeGpxXml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => {
    if (character === '&') return '&amp;';
    if (character === '<') return '&lt;';
    if (character === '>') return '&gt;';
    if (character === "'") return '&apos;';
    return '&quot;';
  });
}

/**
 * Converts one Komoot coordinate timestamp to a GPX UTC timestamp.
 * @param {unknown} value Unix timestamp in seconds or milliseconds from Komoot.
 * @returns {string|null} ISO UTC timestamp or null when the value is not usable.
 */
function komootGpxTimestamp(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return null;
  let milliseconds = timestamp;
  if (Math.abs(timestamp) < 100000000000) milliseconds = timestamp * 1000;
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Converts Komoot coordinate objects to GPX track point XML elements.
 * @param {Array<object>} coordinates Coordinate items with lat, lng, optional alt and t fields.
 * @returns {string} GPX track point XML, or an empty string when no coordinate is valid.
 */
function formatKomootGpxTrackPoints(coordinates) {
  const points = [];
  for (const coordinate of coordinates) {
    const latitude = Number(coordinate?.lat);
    const longitude = Number(coordinate?.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    let point = `<trkpt lat="${latitude}" lon="${longitude}">`;
    const altitude = Number(coordinate?.alt);
    if (Number.isFinite(altitude)) point += `<ele>${altitude}</ele>`;
    const timestamp = komootGpxTimestamp(coordinate?.t);
    if (timestamp) point += `<time>${timestamp}</time>`;
    point += '</trkpt>';
    points.push(point);
  }
  return points.join('\n      ');
}

/**
 * Generates a GPX document from an allowed Komoot tour-detail response.
 * @param {object} tour Komoot tour detail containing embedded coordinates.
 * @param {object} entry Export entry used as a metadata fallback.
 * @returns {string|null} GPX text or null when Komoot returned no usable route coordinates.
 */
function createGpxFromKomootTourData(tour, entry) {
  const coordinates = tour?._embedded?.coordinates?.items;
  if (!Array.isArray(coordinates)) return null;
  const trackPoints = formatKomootGpxTrackPoints(coordinates);
  if (!trackPoints) return null;
  const title = escapeGpxXml(tour?.name || entry.name || `Komoot Tour ${entry.tourId}`);
  const description = escapeGpxXml(tour?.description || entry.description || 'Komoot-Tour');
  const tourUrl = escapeGpxXml(entry.tourUrl || `${location.origin}/tour/${entry.tourId}`);
  const authorName = escapeGpxXml(entry.authorName || tour?._embedded?.creator?.display_name || '');
  const authorUser = escapeGpxXml(entry.authorUser || tour?._embedded?.creator?.username || '');
  let author = '';
  if (authorName) {
    author = `\n    <author>\n      <name>${authorName}</name>`;
    if (authorUser) author += `\n      <link href="https://www.komoot.com/user/${authorUser}"><text>Komoot-Profil</text></link>`;
    author += '\n    </author>';
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Trailthread Komoot Exporthelfer" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${title}</name>
    <desc>${description}</desc>${author}
    <link href="${tourUrl}"><text>Komoot-Tour</text></link>
  </metadata>
  <trk>
    <name>${title}</name>
    <desc>${description}</desc>
    <trkseg>
      ${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Loads tour coordinates from Komoot and creates a local GPX export.
 * @param {object} entry Backup entry that receives generated GPX text.
 * @param {AbortSignal} signal Cancellation signal for the active export run.
 * @returns {Promise<boolean>} True when a GPX export was generated successfully.
 */
async function loadKomootTourDataGpx(entry, signal) {
  const endpoint = buildKomootTourDataEndpoint(entry.tourId);
  entry.gpxFallbackEndpoint = endpoint;
  await reportDetailProgress('Tourdaten werden für eine lokale GPX-Datei geladen.');
  const response = await fetch(endpoint, { credentials: 'include', signal });
  if (!response.ok) return false;
  const tour = await response.json();
  applyKomootTourDetailMetadata(entry, tour);
  entry.timelineExportDiagnostics = { source: 'tour-detail', count: komootTimelineItems(entry.timeline).length };
  if (!hasKomootTimelineItems(entry.timeline)) {
    try {
      const timelineEndpoint = komootTimelineEndpointFromTour(tour, entry.tourId);
      const timelineResult = await loadKomootTourTimeline(timelineEndpoint, signal);
      entry.timeline = timelineResult.items;
      entry.timelineExportDiagnostics = { source: 'timeline-endpoint', count: timelineResult.items.length, status: timelineResult.status, endpoint: timelineResult.endpoint };
    } catch (error) {
      // Timeline data is optional and must not prevent GPX or photo export.
      entry.timelineExportDiagnostics = { source: 'timeline-endpoint', count: 0, error: error?.message || String(error) };
    }
  }
  const gpxText = createGpxFromKomootTourData(tour, entry);
  if (!gpxText) return false;
  entry.gpxText = gpxText;
  entry.gpxIncluded = true;
  await reportDetailProgress(`GPX-Datei aus Komoot-Tourdaten erstellt: ${entry.gpxFileName}`);
  return true;
}

/**
 * Loads one selected tour through Komoot's detail endpoint and creates a local GPX file.
 * @param {object} entry Backup entry that receives GPX text or a descriptive error message.
 * @param {AbortSignal} signal Cancellation signal for the active export run.
 * @returns {Promise<void>} Resolves after the GPX response was retained for the combined backup.
 */
async function loadKomootTourGpx(entry, signal) {
  try {
    const exportSucceeded = await loadKomootTourDataGpx(entry, signal);
    if (exportSucceeded) return;
    entry.exportError = 'Komoot lieferte keine nutzbaren Tourdaten für den lokalen GPX-Export.';
  } catch (error) {
    if (signal.aborted) entry.exportError = 'Der Export wurde vor dem GPX-Download abgebrochen.';
    else entry.exportError = 'Die GPX-Datei konnte nicht aus der bestehenden Komoot-Sitzung geladen werden.';
  }
}

/**
 * Downloads one already loaded GPX text through the extension's automatic download worker.
 * @param {object} entry Export entry containing a GPX file name and GPX text.
 * @returns {Promise<void>} Resolves after the browser has received the individual download request.
 */
async function downloadGpxFile(entry) {
  await reportDetailProgress(`GPX-Datei wird automatisch gespeichert: ${entry.gpxFileName}`);
  const result = await sendRuntimeMessage({ type: 'trailthread:download-generated-gpx', fileName: entry.gpxFileName, gpxText: entry.gpxText });
  if (!result?.ok) throw new Error(result?.error || 'Die GPX-Datei konnte nicht automatisch gespeichert werden.');
}

/**
 * Replaces Komoot's responsive-image placeholders with one portable backup size.
 * @param {string} sourceUrl Absolute Komoot image URL, optionally containing width placeholders.
 * @returns {string} Usable image URL without unresolved image-service placeholders.
 */
function normalizeKomootImageUrl(sourceUrl) {
  const imageUrl = new URL(sourceUrl);
  const replacements = { width: '1600', height: '1200', crop: 'false' };
  for (const [name, value] of Object.entries(replacements)) {
    const currentValue = imageUrl.searchParams.get(name);
    if (currentValue === `{${name}}`) imageUrl.searchParams.set(name, value);
  }
  return imageUrl.href;
}

/**
 * Requests one validated Komoot image from the extension worker, which can bypass page CORS restrictions.
 * @param {string} sourceUrl Absolute Komoot image URL without unresolved placeholders.
 * @returns {Promise<string>} Embedded data URL for a valid non-empty image response.
 */
async function loadKomootImageDataUrl(sourceUrl) {
  const result = await sendRuntimeMessage({ type: 'trailthread:fetch-komoot-image', sourceUrl });
  if (!result?.ok || typeof result.dataUrl !== 'string') throw new Error(result?.error || 'Das Bild konnte nicht geladen werden.');
  return result.dataUrl;
}

/**
 * Embeds all available Komoot images in one backup entry and retains references for failed downloads.
 * @param {object} entry Backup entry whose image references are converted to data URLs.
 * @returns {Promise<void>} Resolves after every image was embedded or marked with a load error.
 */
async function embedKomootTourPhotos(entry) {
  const photos = Array.isArray(entry.photos) ? entry.photos : [];
  if (!photos.length) return;
  const embeddedPhotos = [];
  let failedCount = 0;
  for (let photoIndex = 0; photoIndex < photos.length; photoIndex += 1) {
    if (currentExportCancelled) {
      entry.exportError = 'Der Export wurde beim Einbetten der Bilder abgebrochen.';
      break;
    }
    const photo = photos[photoIndex];
    const sourceUrl = photo.sourceUrl || photo.externalUrl || photo.url;
    if (!sourceUrl) continue;
    const normalizedSourceUrl = normalizeKomootImageUrl(sourceUrl);
    const embeddedPhoto = { ...photo, sourceUrl: normalizedSourceUrl, externalUrl: normalizedSourceUrl };
    await reportDetailProgress(`Bild ${photoIndex + 1} von ${photos.length} wird eingebettet.`);
    try {
      embeddedPhoto.url = await loadKomootImageDataUrl(normalizedSourceUrl);
      embeddedPhoto.inlineLoaded = true;
    } catch (error) {
      failedCount += 1;
      embeddedPhoto.loadError = 'Bild konnte nicht in die Trailthread-Datei eingebettet werden.';
    }
    embeddedPhotos.push(embeddedPhoto);
  }
  entry.photos = embeddedPhotos;
  if (failedCount) {
    const imageError = `${failedCount} Bilder konnten nicht eingebettet werden.`;
    if (entry.photoExportError) entry.photoExportError = `${entry.photoExportError} ${imageError}`;
    else entry.photoExportError = imageError;
  }
}

/**
 * Stops the currently running tour export and aborts its active GPX request.
 * @returns {void} Marks the current content-script export as cancelled.
 */
function cancelCurrentTourExport() {
  currentExportCancelled = true;
  if (currentExportAbortController) currentExportAbortController.abort();
}

/**
 * Reports one detail-page action to the Trailthread toolbar on the original tour list.
 * @param {string} status Human-readable description of the current action.
 * @returns {Promise<void>} Resolves after the background worker accepted the progress update.
 */
async function reportDetailProgress(status) {
  await sendRuntimeMessage({ type: 'trailthread:detail-progress', status });
}

/**
 * Builds one Track record that Trailthread can import from its compressed tour-backup format.
 * @param {object} entry Exported Komoot entry containing GPX text, metadata and embedded photos.
 * @param {string} exportedAt ISO timestamp shared by all tracks in the created backup.
 * @returns {object} Trailthread-compatible track record.
 */
function createTrailthreadBackupTrack(entry, exportedAt) {
  return {
    id: `komoot-${entry.tourId}`,
    name: entry.name,
    source: 'komoot',
    sourceTrackId: entry.tourId,
    komootUrl: entry.tourUrl,
    type: entry.type || 'unknown',
    dateStart: entry.dateStart || null,
    sport: entry.sport || null,
    durationHours: entry.durationHours,
    description: entry.description || null,
    surfaces: entry.surfaces || [],
    surfaceSegments: entry.surfaceSegments || [],
    wayTypes: entry.wayTypes || [],
    wayTypeSegments: entry.wayTypeSegments || [],
    directions: entry.directions || [],
    timeline: entry.timeline || [],
    komootDetailRelations: entry.komootDetailRelations || null,
    timelineExportDiagnostics: entry.timelineExportDiagnostics || null,
    photoExportError: entry.photoExportError || null,
    importedAt: exportedAt,
    lastChanged: exportedAt,
    gpxText: entry.gpxText,
    photos: entry.photos || []
  };
}

/**
 * Compresses a JSON payload when the browser supports CompressionStream.
 * @param {object} payload Serializable Trailthread backup data.
 * @returns {Promise<Blob>} Gzip-compressed JSON, or plain JSON when compression is unavailable.
 */
async function gzipJsonBlob(payload) {
  const json = JSON.stringify(payload, null, 2);
  if (typeof CompressionStream === 'undefined') return new Blob([json], { type: 'application/json' });
  const source = new Blob([json], { type: 'application/json' });
  const stream = source.stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

/**
 * Downloads one compressed Trailthread backup that contains GPX text, metadata and embedded images.
 * @param {Array<object>} entries Tour metadata, GPX text and photos gathered during the export run.
 * @param {boolean} cancelled Whether the user stopped the run early.
 * @returns {Promise<number>} Number of successfully included tracks.
 */
async function downloadTrailthreadTourBackup(entries, cancelled) {
  const exportedAt = new Date().toISOString();
  const tracks = entries.filter((entry) => typeof entry.gpxText === 'string' && entry.gpxText.trim()).map((entry) => createTrailthreadBackupTrack(entry, exportedAt));
  if (!tracks.length) return 0;
  const payload = { kind: 'gpx-bibliothek-touren', version: 1, exportedAt, cancelled, tracks };
  const blob = await gzipJsonBlob(payload);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'trailthread-komoot-touren.json.gz';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return tracks.length;
}

/**
 * Mounts the list controls after Komoot has rendered at least one tour link.
 * @returns {void} Does nothing when the current Komoot page has no supported tour context.
 */
function ensureTourListEnhancement() {
  const currentTour = describeCurrentKomootTour();
  if (!currentTour && !findTourLinks().length) return;
  if (currentTour && !SELECTED_TOURS.size) SELECTED_TOURS.set(currentTour.tourId, currentTour);
  if (toolbar && selectionTemplate) {
    if (!currentTour) enhanceTourList(selectionTemplate);
    renderToolbar();
    return;
  }
  if (listEnhancementIsStarting) return;
  listEnhancementIsStarting = true;
  const templates = createToolbarTemplates();
  const toolbarTemplate = templates.querySelector('#trailthread-komoot-toolbar-template');
  selectionTemplate = templates.querySelector('#trailthread-komoot-selection-template');
  if (!toolbarTemplate || !selectionTemplate || document.querySelector('.trailthread-komoot-toolbar')) {
    listEnhancementIsStarting = false;
    return;
  }
  const toolbarFragment = toolbarTemplate.content.cloneNode(true);
  toolbar = toolbarFragment.querySelector('.trailthread-komoot-toolbar');
  toolbar.querySelector('.trailthread-komoot-download-gpx').addEventListener('click', () => startKomootExport('gpx'));
  toolbar.querySelector('.trailthread-komoot-download-backup').addEventListener('click', () => startKomootExport('backup'));
  toolbar.querySelector('.trailthread-komoot-load-all').addEventListener('click', () => void loadAllKomootTours());
  toolbar.querySelector('.trailthread-komoot-select-all').addEventListener('click', toggleVisibleTourSelection);
  toolbar.querySelector('.trailthread-komoot-cancel').addEventListener('click', () => {
    cancelCurrentTourExport();
    void sendRuntimeMessage({ type: 'trailthread:cancel-run' });
  });
  document.body.append(toolbarFragment);
  if (!currentTour) enhanceTourList(selectionTemplate);
  renderToolbar();
  listEnhancementIsStarting = false;
}

/**
 * Starts one sequential Komoot export in the requested file format.
 * @param {'gpx'|'backup'} exportMode Individual GPX download or combined Trailthread backup.
 * @returns {void} Sends the selected tour queue to the background worker.
 */
function startKomootExport(exportMode) {
  runActive = true;
  activeExportMode = exportMode;
  completedBackupEntries.length = 0;
  renderToolbar();
  void sendRuntimeMessage({ type: 'trailthread:start-run', exportMode, tours: [...SELECTED_TOURS.values()] });
}

/**
 * Queues one deferred tour-control update while Komoot is applying many DOM changes.
 * @returns {void} Limits document-wide tour scans so the Komoot renderer stays responsive.
 */
function scheduleTourListEnhancement() {
  if (enhancementQueued) return;
  enhancementQueued = true;
  window.setTimeout(() => {
    enhancementQueued = false;
    try {
      ensureTourListEnhancement();
    } catch (error) {
      listEnhancementIsStarting = false;
    }
  }, 250);
}

/**
 * Watches Komoot client-side navigation and delayed rendering until tour list controls can be mounted.
 * @returns {void} Starts one throttled document-wide observer for the lifetime of this content script.
 */
function observeKomootPage() {
  const observer = new MutationObserver(() => {
    scheduleTourListEnhancement();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scheduleTourListEnhancement();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'trailthread:run-complete') {
    void (async () => {
      const runEntries = message.entries || [];
      let includedCount = 0;
      if (message.exportMode === 'backup') {
        const backupEntries = [...completedBackupEntries];
        try {
          includedCount = await downloadTrailthreadTourBackup(backupEntries, message.cancelled === true);
        } catch (error) {
          includedCount = 0;
        }
      } else {
        includedCount = runEntries.filter((entry) => !entry.exportError).length;
      }
      runActive = false;
      activeExportMode = null;
      lastRunFailureCount = runEntries.filter((entry) => entry.exportError).length;
      SELECTED_TOURS.clear();
      syncTourSelectionControls();
      renderToolbar();
      if (toolbar && message.exportMode === 'gpx' && includedCount && lastRunFailureCount) toolbar.querySelector('.trailthread-komoot-status').textContent = `${includedCount} GPX-Dateien wurden heruntergeladen, ${lastRunFailureCount} konnten nicht exportiert werden.`;
      else if (toolbar && message.exportMode === 'gpx' && includedCount) toolbar.querySelector('.trailthread-komoot-status').textContent = `${includedCount} GPX-Dateien wurden heruntergeladen.`;
      else if (toolbar && includedCount && lastRunFailureCount) toolbar.querySelector('.trailthread-komoot-status').textContent = `${includedCount} Touren wurden gespeichert, ${lastRunFailureCount} konnten nicht exportiert werden.`;
      else if (toolbar && includedCount) toolbar.querySelector('.trailthread-komoot-status').textContent = `${includedCount} Touren wurden als Trailthread-Datei gespeichert.`;
      else if (toolbar && message.exportMode === 'gpx') toolbar.querySelector('.trailthread-komoot-status').textContent = 'Es konnten keine GPX-Dateien heruntergeladen werden.';
      else if (toolbar) toolbar.querySelector('.trailthread-komoot-status').textContent = 'Es konnte keine Trailthread-Datei erstellt werden.';
      completedBackupEntries.length = 0;
    })();
    return;
  }
  if (message?.type === 'trailthread:run-progress') {
    if (toolbar) toolbar.querySelector('.trailthread-komoot-status').textContent = `Tour ${message.current}/${message.total}: ${message.status}`;
    return;
  }
  if (message?.type === 'trailthread:export-current-tour') {
    void (async () => {
      const isBackupExport = message.exportMode === 'backup';
      currentExportCancelled = false;
      currentExportAbortController = new AbortController();
      const entry = await collectTourEntry(message.tour, isBackupExport);
      if (currentExportCancelled) entry.exportError = 'Der Export wurde abgebrochen.';
      else await loadKomootTourGpx(entry, currentExportAbortController.signal);
      if (!entry.exportError && isBackupExport) {
        await reportDetailProgress('Komoot-Bilder werden in die Trailthread-Datei eingebettet.');
        await embedKomootTourPhotos(entry);
        if (!entry.exportError) completedBackupEntries.push(entry);
      }
      if (!entry.exportError && !isBackupExport) {
        try {
          await downloadGpxFile(entry);
        } catch (error) {
          entry.exportError = 'Die GPX-Datei konnte nicht automatisch gespeichert werden.';
        }
      }
      await sendRuntimeMessage({ type: 'trailthread:tour-exported', entry: { tourId: entry.tourId, exportError: entry.exportError || null } });
      currentExportAbortController = null;
    })();
    return;
  }
  if (message?.type === 'trailthread:cancel-export-current-tour') {
    cancelCurrentTourExport();
    return;
  }
});

observeKomootPage();
void sendRuntimeMessage({ type: 'trailthread:detail-ready' });
