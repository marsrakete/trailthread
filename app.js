import { translations } from "./translations.js";

const DB_NAME = "gpx-bibliothek";
const DB_VERSION = 3;
const STORES = { tracks: "tracks", accounts: "accounts", settings: "settings" };
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const PROXY_URL = "http://localhost:8787/api/komoot";
const RECORDED_COLORS = ["#0050ff", "#006dff", "#0077cc", "#00a86b", "#3a86ff", "#6d28d9"];
const PLANNED_COLORS = ["#ff6b00", "#ff3d00", "#e11d48", "#c026d3", "#a21caf", "#f97316"];
const HIGHLIGHT_COLOR = "#ff2a1a";
const TRACK_CASING_COLOR = "rgba(248, 251, 250, 0.95)";
const TRACK_HIGHLIGHT_CASING = "rgba(93, 10, 2, 0.92)";
const DECORATION_ZOOM_LEVELS = { coarse: 11, fine: 13 };
  const PANE_LIMITS = { left: { min: 168, max: 520 }, middle: { min: 352, max: 720 } };
const AUTO_UPDATE_CHECK_INTERVAL_MS = 3 * 60 * 1000;
const CURRENT_VERSION_INFO = Object.freeze(globalThis.APP_VERSION_INFO || {
  appVersion: "0.0.0",
  cacheVersion: "v0",
  label: "",
});
const REPLAY_TIME_SCALE = 1;
const REPLAY_DISTANCE_SECONDS = 480;

const state = { db: null, map: null, replayMap2d: null, replayMap3d: null, replayMap3dReady: false, layers: new Map(), tracks: [], accounts: [], settings: { id: "app", language: "auto", activeWorkspace: "library", activeAccountId: null, leftPaneWidth: 320, middlePaneWidth: 400, sidebarCompact: false, libraryCompact: false, photoOverlayOnly: false, trackLineWeight: 6 }, selectedTrackIds: new Set(), highlightedTrackId: null, libraryUi: { focusTrackId: null, scrollTop: 0 }, profileUi: { trackId: null, samples: [], plot: null, hoverMarker: null }, photoDialogUi: { trackId: null, photos: [], index: 0, swipeStartX: null }, resizeUi: { handle: null, startX: 0, leftPaneWidth: 320, middlePaneWidth: 400, rafId: null }, komootTours: [], selectedKomootTourIds: new Set(), komootUi: { focusTourId: null, focusList: null, scrollTopByList: { recorded: 0, planned: 0 }, focusOffsetByList: { recorded: null, planned: null }, progress: { active: false, label: '', value: 0, indeterminate: false } }, replay: { activeTrackId: null, replayTrack: null, view: '2d', mode: 'distance', playing: false, speed: 4, cursor: 0, followCamera: true, showPhotos: true, showProfile: true, cameraMode2d: 'center', cameraMode3d: 'orbit', rafId: null, lastFrameAt: 0, layers2d: { route: null, played: null, marker: null, photos: null }, sources3dReady: false, marker3d: null, lastApplied2DMode: null, last2DCameraAppliedAt: 0 }, proxy: { online: false, mode: null, lastCheckAt: null, lastError: null } };

const el = {
  workspaceButtons: [...document.querySelectorAll('.workspace-button[data-workspace]')], settingsButton: document.querySelector('#open-settings-button'), helpButton: document.querySelector('#open-help-button'), toggleSidebarCompactButton: document.querySelector('#toggle-sidebar-compact-button'), toggleLibraryCompactButton: document.querySelector('#toggle-library-compact-button'), libraryWorkspace: document.querySelector('#library-workspace'), komootWorkspace: document.querySelector('#komoot-workspace'), replayWorkspace: document.querySelector('#replay-workspace'), statusPill: document.querySelector('#status-pill'), komootStatusPill: document.querySelector('#komoot-status-pill'), addAccountButton: document.querySelector('#add-account-button'), accountsList: document.querySelector('#accounts-list'), fileInput: document.querySelector('#file-input'), trackList: document.querySelector('#track-list'), librarySearchInput: document.querySelector('#library-search-input'), libraryTypeFilter: document.querySelector('#library-type-filter'), librarySportFilter: document.querySelector('#library-sport-filter'), libraryMetaFilter: document.querySelector('#library-meta-filter'), librarySortSelect: document.querySelector('#library-sort-select'), fitAllButton: document.querySelector('#fit-all-button'), mapPhotoModeButton: document.querySelector('#map-photo-mode-button'), prevTrackButton: document.querySelector('#prev-track-button'), nextTrackButton: document.querySelector('#next-track-button'), resizeHandles: [...document.querySelectorAll('[data-resize-handle]')], toggleSelectionButton: document.querySelector('#toggle-selection-button'), libraryToggleSelectionButton: document.querySelector('#library-toggle-selection-button'), selectionStats: document.querySelector('#selection-stats'), distanceStats: document.querySelector('#distance-stats'), pointStats: document.querySelector('#point-stats'), profileTrackName: document.querySelector('#profile-track-name'), profileDistance: document.querySelector('#profile-distance'), profileElevationRange: document.querySelector('#profile-elevation-range'), profileAscent: document.querySelector('#profile-ascent'), profileDescent: document.querySelector('#profile-descent'), profileAvgSpeed: document.querySelector('#profile-avg-speed'), profileEmpty: document.querySelector('#profile-empty'), profileChartShell: document.querySelector('#profile-chart-shell'), profileChart: document.querySelector('#profile-chart'), profileCursorInfo: document.querySelector('#profile-cursor-info'), profileCursorAfter: document.querySelector('#profile-cursor-after'), profileCursorAltitude: document.querySelector('#profile-cursor-altitude'), profileCursorGrade: document.querySelector('#profile-cursor-grade'), selectionList: document.querySelector('#selection-list'), recentList: document.querySelector('#staging-list'), recentSummary: document.querySelector('#staging-summary'), librarySummary: document.querySelector('#library-summary'), komootAccountSelect: document.querySelector('#komoot-account-select'), komootLoadButton: document.querySelector('#komoot-load-button'), komootImportButton: document.querySelector('#komoot-import-button'), komootProgress: document.querySelector('#komoot-progress'), komootProgressLabel: document.querySelector('#komoot-progress-label'), komootProgressValue: document.querySelector('#komoot-progress-value'), komootProgressBar: document.querySelector('#komoot-progress-bar'), recordedList: document.querySelector('#recorded-tour-list'), plannedList: document.querySelector('#planned-tour-list'), recordedSummary: document.querySelector('#recorded-summary'), plannedSummary: document.querySelector('#planned-summary'), recordedSelectAllButton: document.querySelector('#recorded-select-all-button'), plannedSelectAllButton: document.querySelector('#planned-select-all-button'), diagProxy: document.querySelector('#komoot-diag-proxy'), diagMode: document.querySelector('#komoot-diag-mode'), diagChecked: document.querySelector('#komoot-diag-checked'), diagError: document.querySelector('#komoot-diag-error'), replayTrackTitle: document.querySelector('#replay-track-title'), replayTrackSubtitle: document.querySelector('#replay-track-subtitle'), replayViewButtons: [...document.querySelectorAll('[data-replay-view]')], replayRestartButton: document.querySelector('#replay-restart-button'), replayPlayButton: document.querySelector('#replay-play-button'), replayPauseButton: document.querySelector('#replay-pause-button'), replayBackButton: document.querySelector('#replay-back-button'), replayForwardButton: document.querySelector('#replay-forward-button'), replaySpeedSelect: document.querySelector('#replay-speed-select'), replayModeButtons: [...document.querySelectorAll('[data-replay-mode]')], replayCamera2dRow: document.querySelector('#replay-camera-2d-row'), replayCamera3dRow: document.querySelector('#replay-camera-3d-row'), replayCamera2dButtons: [...document.querySelectorAll('[data-replay-camera-2d]')], replayCameraButtons: [...document.querySelectorAll('[data-replay-camera]')], replayFollowCameraInput: document.querySelector('#replay-follow-camera-input'), replayShowPhotosInput: document.querySelector('#replay-show-photos-input'), replayShowProfileInput: document.querySelector('#replay-show-profile-input'), replayMap2d: document.querySelector('#replay-map-2d'), replayMap3d: document.querySelector('#replay-map-3d'), replayDistanceValue: document.querySelector('#replay-distance-value'), replayAltitudeValue: document.querySelector('#replay-altitude-value'), replayGradeValue: document.querySelector('#replay-grade-value'), replayTimeValue: document.querySelector('#replay-time-value'), replayProfilePanel: document.querySelector('#replay-profile-panel'), replayProfileTrackName: document.querySelector('#replay-profile-track-name'), replayAscentValue: document.querySelector('#replay-ascent-value'), replayDescentValue: document.querySelector('#replay-descent-value'), replaySpeedValue: document.querySelector('#replay-speed-value'), replayPointValue: document.querySelector('#replay-point-value'), replayProfileEmpty: document.querySelector('#replay-profile-empty'), replayProfileChartShell: document.querySelector('#replay-profile-chart-shell'), replayProfileChart: document.querySelector('#replay-profile-chart'), accountDialog: document.querySelector('#account-dialog'), accountEmailInput: document.querySelector('#account-email-input'), accountPasswordInput: document.querySelector('#account-password-input'), saveAccountButton: document.querySelector('#save-account-button'), settingsDialog: document.querySelector('#settings-dialog'), helpDialog: document.querySelector('#help-dialog'), helpStatus: document.querySelector('#help-status'), helpContent: document.querySelector('#help-content'), exportBackupButton: document.querySelector('#export-backup-button'), backupInput: document.querySelector('#backup-input'), exportTourBackupButton: document.querySelector('#export-tour-backup-button'), settingsExportTourBackupButton: document.querySelector('#settings-export-tour-backup-button'), tourBackupInput: document.querySelector('#tour-backup-input'), languageSelect: document.querySelector('#language-select'), trackWidthInput: document.querySelector('#track-width-input'), trackWidthValue: document.querySelector('#track-width-value'), trackItemTemplate: document.querySelector('#track-item-template'), accountItemTemplate: document.querySelector('#account-item-template'), tourItemTemplate: document.querySelector('#tour-item-template'), stagingItemTemplate: document.querySelector('#staging-item-template'), trackDetailDialog: document.querySelector('#track-detail-dialog'), trackDetailTitle: document.querySelector('#track-detail-title'), trackDetailSubtitle: document.querySelector('#track-detail-subtitle'), trackDetailFacts: document.querySelector('#track-detail-facts'), trackDetailDescription: document.querySelector('#track-detail-description'), trackDetailPhotos: document.querySelector('#track-detail-photos'),
  photoDialog: document.querySelector('#photo-dialog'), photoDialogTitle: document.querySelector('#photo-dialog-title'), photoDialogSubtitle: document.querySelector('#photo-dialog-subtitle'), photoDialogStage: document.querySelector('#photo-dialog-stage'), photoDialogImage: document.querySelector('#photo-dialog-image'), photoDialogCaption: document.querySelector('#photo-dialog-caption'), photoDialogMeta: document.querySelector('#photo-dialog-meta'), photoDialogThumbs: document.querySelector('#photo-dialog-thumbs'), photoDialogPrev: document.querySelector('#photo-dialog-prev'), photoDialogNext: document.querySelector('#photo-dialog-next'), photoDialogClose: document.querySelector('#photo-dialog-close'),
  confirmDialog: document.querySelector('#confirm-dialog'), confirmDialogTitle: document.querySelector('#confirm-dialog-title'), confirmDialogMessage: document.querySelector('#confirm-dialog-message'), confirmDialogConfirm: document.querySelector('#confirm-dialog-confirm'), confirmDialogCancel: document.querySelector('#confirm-dialog-cancel')
};

Object.assign(el, {
  versionLabel: document.querySelector('#version-label'),
  checkUpdatesButton: document.querySelector('#check-updates-button'),
  reloadAppButton: document.querySelector('#reload-app-button'),
  updateStatus: document.querySelector('#update-status')
});

let helpCache = { path: null, text: '' };
let serviceWorkerRegistration = null;
let updateInProgress = false;
let lastAutoUpdateCheckAt = 0;

const lang = () => (state.settings.language && state.settings.language !== 'auto' ? state.settings.language : (translations[navigator.language.slice(0, 2)] ? navigator.language.slice(0, 2) : 'de'));
const t = (key, params = {}) => Object.entries(params).reduce((v, [k, r]) => v.replaceAll(`{${k}}`, String(r)), (translations[lang()][key] ?? translations.de[key] ?? key));
const fmtDate = (value) => value ? new Date(value).toLocaleDateString(lang()) : '-';
const fmtNum = (value) => new Intl.NumberFormat(lang()).format(value ?? 0);
const fmtKm = (value) => (value ?? 0).toFixed(1);
const fmtMeters = (value) => `${fmtNum(Math.round(value ?? 0))} m`;
const fmtHours = (value) => value == null || !Number.isFinite(value) ? '-' : `${value.toFixed(1)} km/h`;
function fmtElapsedShort(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '--:--:--';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
function replayDefaultSpeed(view = state.replay.view, mode = state.replay.mode) {
  return mode === 'time' ? 2 : 1;
}
function applyReplayModeDefaults(mode, view = state.replay.view) {
  state.replay.speed = replayDefaultSpeed(view, mode);
}
function gradeArrow(gradePercent) {
  if (!Number.isFinite(gradePercent) || Math.abs(gradePercent) < 0.2) return '~';
  return gradePercent > 0 ? '↗' : '↘';
}
function fmtGrade(gradePercent) {
  if (!Number.isFinite(gradePercent)) return '~ 0 %';
  const rounded = Math.round(Math.abs(gradePercent));
  if (rounded === 0) return '~ 0 %';
  return `${gradeArrow(gradePercent)} ${rounded} %`;
}
const id = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const trackType = (value) => value === 'tour_planned' || value === 'planned' ? 'planned' : value === 'tour_recorded' || value === 'recorded' ? 'recorded' : 'unknown';
const trackTypeLabel = (value) => value === 'planned' ? t('typePlanned') : value === 'recorded' ? t('typeRecorded') : t('typeUnknown');
const trackSourceLabel = (value) => value === 'komoot' ? t('trackSourceKomoot') : value === 'backup' ? t('trackSourceBackup') : t('trackSourceLocal');
const signature = (track) => `${track.source}|${track.accountEmail ?? ''}|${track.sourceTrackId ?? ''}|${track.name}|${track.dateStart ?? ''}|${track.pointCount ?? 0}`;
const isoNow = () => new Date().toISOString();
function trackLastChanged(track) {
  return track?.lastChanged || track?.updatedAt || track?.importedAt || null;
}
function sanitizeFileName(value) {
  return `${value ?? ''}`.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').trim() || 'track';
}
function touchTrack(track, changes = {}) {
  return enrichTrackMetrics({ ...track, ...changes, lastChanged: isoNow(), signature: signature({ ...track, ...changes }) });
}
const komootProgressText = () => lang() === 'fr' ? { loadingTours: 'Chargement des tours...', importing: 'Import des tours...', done: 'Termine' } : lang() === 'en' ? { loadingTours: 'Loading tours...', importing: 'Importing tours...', done: 'Done' } : { loadingTours: 'Touren werden geladen...', importing: 'Touren werden importiert...', done: 'Fertig' };
const hashString = (value) => [...`${value ?? ''}`].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 7);
const SPORT_LABELS = {
  cycling: { de: 'Radfahren', en: 'Cycling', fr: 'Cyclisme', icon: '🚴', aliases: ['cycling', 'bike', 'bicycle', 'touring_bike', 'cycle_touring', 'commute', 'commuting', 'city_bike', 'fiets'] },
  road_cycling: { de: 'Rennradfahren', en: 'Road cycling', fr: 'Cyclisme sur route', icon: '🚴', aliases: ['road_cycling', 'road_bike', 'racebike', 'roadbike', 'racing_bike'] },
  gravel_riding: { de: 'Gravelbiken', en: 'Gravel riding', fr: 'Gravel', icon: '🚴', aliases: ['gravel', 'gravel_bike', 'gravel_riding'] },
  mountain_biking: { de: 'Mountainbiken', en: 'Mountain biking', fr: 'VTT', icon: '🚴', aliases: ['mountain_biking', 'mountain_bike', 'mtb', 'mountainbike'] },
  mountain_biking_easy: { de: 'Gravelbike', en: 'Gravel bike', fr: 'Gravel', icon: '🚴', aliases: ['mtb_easy', 'mtb easy', 'mountain_bike_easy', 'mountain biking easy'] },
  mountain_biking_intermediate: { de: 'Mountainbiken', en: 'Mountain biking', fr: 'VTT', icon: '🚴', aliases: ['mtb_intermediate', 'mtb intermediate', 'mountain_bike_intermediate'] },
  mountain_biking_advanced: { de: 'Anspruchsvolles Mountainbiken', en: 'Advanced mountain biking', fr: 'VTT sportif', icon: '🚴', aliases: ['mtb_advanced', 'mtb advanced', 'mountain_bike_advanced', 'mountain biking advanced'] },
  enduro_mtb: { de: 'Enduro-Mountainbiken', en: 'Enduro mountain biking', fr: 'VTT enduro', icon: '🚴', aliases: ['enduro_mtb', 'enduro_mountain_biking', 'enduro'] },
  downhill_mtb: { de: 'Downhill-Mountainbiken', en: 'Downhill mountain biking', fr: 'VTT de descente', icon: '🚴', aliases: ['downhill_mtb', 'downhill_mountain_biking', 'downhill'] },
  pedelec: { de: 'Pedelec', en: 'Pedelec', fr: 'Pedelec', icon: '🚴', aliases: ['e_touringbicycle', 'e_touring_bicycle', 'etouringbicycle', 'etouring_bicycle', 'pedelec', 'e_bike', 'ebike', 'electric_bike'] },
  unicycling: { de: 'Einradfahren', en: 'Unicycling', fr: 'Monocycle', icon: '🚴', aliases: ['unicycling', 'unicycle'] },
  hiking: { de: 'Wandern', en: 'Hiking', fr: 'Randonnee', icon: '🥾', aliases: ['hiking', 'hike', 'wanderung'] },
  walking: { de: 'Spazieren', en: 'Walking', fr: 'Marche', icon: '🥾', aliases: ['walking', 'walk', 'on_foot', 'foot'] },
  running: { de: 'Laufen', en: 'Running', fr: 'Course a pied', icon: '🏃', aliases: ['running', 'run', 'jogging'] },
  trail_running: { de: 'Traillauf', en: 'Trail running', fr: 'Trail', icon: '🏃', aliases: ['trail_running', 'trail_run'] },
  nordic_walking: { de: 'Nordic Walking', en: 'Nordic walking', fr: 'Marche nordique', icon: '🥾', aliases: ['nordic_walking'] },
  snowshoeing: { de: 'Schneeschuhwandern', en: 'Snowshoeing', fr: 'Raquettes', icon: '🥾', aliases: ['snowshoeing', 'snow_shoeing'] },
  rock_climbing: { de: 'Felsklettern', en: 'Rock climbing', fr: 'Escalade en rocher', icon: '🧗', aliases: ['rock_climbing', 'climbing', 'rockclimbing'] },
  mountaineering: { de: 'Alpinismus', en: 'Mountaineering', fr: 'Alpinisme', icon: '🧗', aliases: ['mountaineering', 'alpinism', 'alpine_climbing'] },
  alpine_skiing: { de: 'Skifahren', en: 'Alpine skiing', fr: 'Ski alpin', icon: '🎿', aliases: ['alpine_skiing', 'skiing', 'ski'] },
  cross_country_skiing: { de: 'Langlaufen', en: 'Cross-country skiing', fr: 'Ski de fond', icon: '🎿', aliases: ['cross_country_skiing', 'nordic_skiing', 'xc_ski'] },
  ski_touring: { de: 'Skitourengehen', en: 'Ski touring', fr: 'Ski de randonnee', icon: '🎿', aliases: ['ski_touring', 'ski_tour', 'backcountry_skiing'] },
  snowboarding: { de: 'Snowboarden', en: 'Snowboarding', fr: 'Snowboard', icon: '🏂', aliases: ['snowboarding', 'snowboard'] },
  sledding: { de: 'Schlittenfahren', en: 'Sledding', fr: 'Luge', icon: '🛷', aliases: ['sledding', 'sled', 'luge'] },
  skating: { de: 'Skaten', en: 'Skating', fr: 'Skating', icon: '⛸', aliases: ['skating', 'inline_skating', 'roller_skating'] },
  other_activities: { de: 'Andere Aktivitaeten', en: 'Other activities', fr: 'Autres activites', icon: '•', aliases: ['other', 'other_activities', 'misc', 'unknown'] }
};
const SPORT_ALIAS_LOOKUP = Object.fromEntries(Object.entries(SPORT_LABELS).flatMap(([key, config]) => config.aliases.map((alias) => [alias, key])));
const defaultTrackColor = (trackLike) => {
  const baseKey = [trackLike.accountEmail, trackType(trackLike.type), trackLike.sourceTrackId, trackLike.id, trackLike.name].filter(Boolean).join('|') || signature(trackLike);
  const palette = trackType(trackLike.type) === 'planned' ? PLANNED_COLORS : RECORDED_COLORS;
  return palette[hashString(baseKey) % palette.length];
};
function normalizeTrackDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 1980) return null;
  return value;
}
function resolveTrackDate(preferred, fallback = null) {
  return normalizeTrackDate(preferred) || normalizeTrackDate(fallback) || null;
}
function looksLikeGeneratedMetricText(value) {
  const text = cleanText(value).toLowerCase();
  if (!text) return false;
  return (
    text.startsWith('distance:') ||
    text.startsWith('distanz:') ||
    text.startsWith('duree estimee:') ||
    text.includes('estimated duration:') ||
    text.includes('geschaetzte dauer:') ||
    text.includes('elevation up:') ||
    text.includes('hoehenmeter bergauf:') ||
    text.includes('denivele positif:')
  );
}
function normalizeTrackDescription(value, fallback = null) {
  const preferred = cleanText(value);
  if (preferred && !looksLikeGeneratedMetricText(preferred)) return preferred;
  const secondary = cleanText(fallback);
  return secondary && !looksLikeGeneratedMetricText(secondary) ? secondary : null;
}
function reqToPromise(request) { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function openDb() { return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, DB_VERSION); request.onerror = () => reject(request.error); request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(STORES.tracks)) db.createObjectStore(STORES.tracks, { keyPath: 'id' }); if (!db.objectStoreNames.contains(STORES.accounts)) db.createObjectStore(STORES.accounts, { keyPath: 'id' }); if (!db.objectStoreNames.contains(STORES.settings)) db.createObjectStore(STORES.settings, { keyPath: 'id' }); }; request.onsuccess = () => resolve(request.result); }); }
async function all(store) { return reqToPromise(state.db.transaction(store, 'readonly').objectStore(store).getAll()); }
async function put(store, value) { const tx = state.db.transaction(store, 'readwrite'); tx.objectStore(store).put(value); return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); }
async function putMany(store, values) { const tx = state.db.transaction(store, 'readwrite'); values.forEach((value) => tx.objectStore(store).put(value)); return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); }
async function del(store, key) { const tx = state.db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); }
async function saveSettings() { await put(STORES.settings, { ...state.settings, id: 'app' }); }
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
function applyPaneWidths() {
  const left = clamp(Number(state.settings.leftPaneWidth) || 320, PANE_LIMITS.left.min, PANE_LIMITS.left.max);
  const middle = clamp(Number(state.settings.middlePaneWidth) || 400, PANE_LIMITS.middle.min, PANE_LIMITS.middle.max);
  state.settings.leftPaneWidth = left;
  state.settings.middlePaneWidth = middle;
  document.documentElement.style.setProperty('--left-pane-width', `${left}px`);
  document.documentElement.style.setProperty('--middle-pane-width', `${middle}px`);
  document.body.classList.toggle('is-sidebar-compact', !!state.settings.sidebarCompact);
  document.body.classList.toggle('is-library-compact', !!state.settings.libraryCompact);
}
function scheduleMapLayoutRefresh() {
  window.requestAnimationFrame(() => {
    state.map?.invalidateSize(false);
    state.replayMap2d?.invalidateSize(false);
    state.replayMap3d?.resize?.();
    renderSelection();
    renderProfile();
    renderReplayWorkspace();
  });
}
function beginPaneResize(handle, clientX) {
  state.resizeUi.handle = handle;
  state.resizeUi.startX = clientX;
  state.resizeUi.leftPaneWidth = state.settings.leftPaneWidth;
  state.resizeUi.middlePaneWidth = state.settings.middlePaneWidth;
  el.resizeHandles.forEach((node) => node.classList.toggle('is-active', node.dataset.resizeHandle === handle));
}
function updatePaneResize(clientX) {
  if (!state.resizeUi.handle) return;
  const delta = clientX - state.resizeUi.startX;
  if (state.resizeUi.handle === 'left') {
    state.settings.leftPaneWidth = clamp(state.resizeUi.leftPaneWidth + delta, PANE_LIMITS.left.min, PANE_LIMITS.left.max);
  } else if (state.resizeUi.handle === 'middle') {
    state.settings.middlePaneWidth = clamp(state.resizeUi.middlePaneWidth + delta, PANE_LIMITS.middle.min, PANE_LIMITS.middle.max);
  }
  applyPaneWidths();
  scheduleMapLayoutRefresh();
}
function endPaneResize() {
  if (!state.resizeUi.handle) return;
  state.resizeUi.handle = null;
  el.resizeHandles.forEach((node) => node.classList.remove('is-active'));
  saveSettings().catch(() => {});
}

function setStatus(message, error = false) { el.statusPill.textContent = message; el.statusPill.style.color = error ? 'var(--danger)' : 'var(--muted)'; }
function setKomootStatus(message, error = false) { el.komootStatusPill.textContent = message; el.komootStatusPill.style.color = error ? 'var(--danger)' : 'var(--muted)'; }
function confirmAction(message, { title = null, confirmLabel = null, cancelLabel = null } = {}) {
  return new Promise((resolve) => {
    el.confirmDialogTitle.textContent = title || (lang() === 'en' ? 'Confirm' : lang() === 'fr' ? 'Confirmation' : 'Bestaetigung');
    el.confirmDialogMessage.textContent = message;
    el.confirmDialogConfirm.textContent = confirmLabel || (lang() === 'en' ? 'Confirm' : lang() === 'fr' ? 'Confirmer' : 'Bestaetigen');
    el.confirmDialogCancel.textContent = cancelLabel || t('cancelButton');
    const handleClose = () => {
      el.confirmDialog.removeEventListener('close', handleClose);
      resolve(el.confirmDialog.returnValue === 'confirm');
    };
    el.confirmDialog.addEventListener('close', handleClose, { once: true });
    el.confirmDialog.showModal();
  });
}
function decodeHtml(value) { const area = document.createElement('textarea'); area.innerHTML = value; return area.value; }
function cleanText(value) { return decodeHtml(`${value ?? ''}`).replace(/\s+/g, ' ').trim(); }
function escapeHtml(value) { return `${value ?? ''}`.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function renderInlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g, '<a href="$3" target="_blank" rel="noreferrer noopener"><img src="$2" alt="$1"></a>');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return html;
}
function convertHelpHtmlBlocks(markdown) {
  return markdown
    .replace(/<p\s+align="center">\s*<img\s+src="([^"]+)"\s+alt="([^"]*)"\s+width="([^"]+)"\s*>\s*<\/p>/gi, (_, src, alt, width) =>
      `<p class="help-centered"><img src="${src}" alt="${escapeHtml(alt)}" width="${width}"></p>`)
    .replace(/<p\s+align="center">\s*([\s\S]*?)\s*<\/p>/gi, (_, content) =>
      `<p class="help-centered">${renderInlineMarkdown(content.trim())}</p>`);
}
function renderMarkdownAsHtml(markdown) {
  const prepared = convertHelpHtmlBlocks(markdown.replace(/\r\n/g, "\n"));
  const lines = prepared.split("\n");
  const html = [];
  let inList = false;
  let listTag = "";
  let inCode = false;
  let codeLines = [];
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!inList) return;
    html.push(`</${listTag}>`);
    inList = false;
    listTag = "";
  };
  const flushCode = () => {
    if (!inCode) return;
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    inCode = false;
    codeLines = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      flushParagraph();
      flushList();
      if (inCode) flushCode();
      else inCode = true;
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.trim().startsWith('<p class="help-centered">')) {
      flushParagraph();
      flushList();
      html.push(line.trim());
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const ordered = line.match(/^\d+\.\s+(.*)$/);
    const unordered = line.match(/^-\s+(.*)$/);
    if (ordered || unordered) {
      flushParagraph();
      const nextTag = ordered ? "ol" : "ul";
      if (!inList || listTag !== nextTag) {
        flushList();
        inList = true;
        listTag = nextTag;
        html.push(`<${listTag}>`);
      }
      html.push(`<li>${renderInlineMarkdown((ordered || unordered)[1])}</li>`);
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  flushCode();
  return html.join("");
}
function normalizeVersionInfo(value = {}) {
  return {
    appVersion: String(value.appVersion || "").trim(),
    cacheVersion: String(value.cacheVersion || "").trim(),
    label: String(value.label || "").trim(),
  };
}
function versionSignature(value = {}) {
  const normalized = normalizeVersionInfo(value);
  return `${normalized.appVersion}|${normalized.cacheVersion}`;
}
function renderVersionLabel() {
  if (!el.versionLabel) return;
  const parts = [
    `${t('versionPrefix')} ${CURRENT_VERSION_INFO.appVersion}`,
    `${t('offlineVersion')} ${CURRENT_VERSION_INFO.cacheVersion}`
  ];
  if (CURRENT_VERSION_INFO.label) parts.push(CURRENT_VERSION_INFO.label);
  el.versionLabel.textContent = parts.join(' · ');
}
function setUpdateStatus(message, showReload = false, error = false) {
  if (!el.updateStatus || !el.reloadAppButton) return;
  el.updateStatus.textContent = message || "";
  el.updateStatus.dataset.state = error ? 'error' : (message ? 'info' : '');
  el.reloadAppButton.hidden = !showReload;
}
async function loadReadmeContent() {
  const path = "./README.md";
  if (helpCache.path === path && helpCache.text) {
    el.helpStatus.textContent = "";
    el.helpContent.innerHTML = renderMarkdownAsHtml(helpCache.text);
    return;
  }
  el.helpStatus.textContent = t('helpLoading');
  el.helpContent.innerHTML = "";
  try {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error("README unavailable");
    const text = await response.text();
    helpCache = { path, text };
    el.helpStatus.textContent = "";
    el.helpContent.innerHTML = renderMarkdownAsHtml(text);
  } catch (error) {
    console.error(error);
    el.helpStatus.textContent = t('helpFailed');
    if (!(helpCache.path === path && helpCache.text)) el.helpContent.innerHTML = "";
  }
}
async function fetchVersionInfo() {
  const response = await fetch("./version.js", { cache: "no-cache" });
  if (!response.ok) throw new Error("Version file unavailable");
  const source = await response.text();
  const appVersion = source.match(/appVersion:\s*"([^"]+)"/)?.[1] || "";
  const cacheVersion = source.match(/cacheVersion:\s*"([^"]+)"/)?.[1] || "";
  const label = source.match(/label:\s*"([^"]*)"/)?.[1] || "";
  return normalizeVersionInfo({ appVersion, cacheVersion, label });
}
async function performAppReload() {
  setUpdateStatus(t('updateApplying'), false);
  await serviceWorkerRegistration?.update().catch(() => {});
  window.location.reload();
}
function shouldRunAutoUpdateCheck() {
  const now = Date.now();
  if (now - lastAutoUpdateCheckAt < AUTO_UPDATE_CHECK_INTERVAL_MS) return false;
  lastAutoUpdateCheckAt = now;
  return true;
}
async function checkForUpdates(options = {}) {
  const { showChecking = true, silentNoChange = false, silentError = false } = options;
  if (!el.checkUpdatesButton || updateInProgress) return;
  updateInProgress = true;
  el.checkUpdatesButton.disabled = true;
  if (showChecking) setUpdateStatus(t('updateChecking'), false);
  try {
    await serviceWorkerRegistration?.update();
    const remoteVersion = await fetchVersionInfo();
    if (!remoteVersion.appVersion || !remoteVersion.cacheVersion) {
      if (!silentError) setUpdateStatus(t('updateVersionIncomplete'), false, true);
      return;
    }
    if (versionSignature(remoteVersion) === versionSignature(CURRENT_VERSION_INFO)) {
      if (!silentNoChange) setUpdateStatus(t('updateNoChange'), false);
      return;
    }
    const remoteLabel = remoteVersion.label ? ` · ${remoteVersion.label}` : '';
    setUpdateStatus(`${t('updateAvailablePrefix')}: ${remoteVersion.appVersion} · ${remoteVersion.cacheVersion}${remoteLabel}. ${t('updateAvailableAction')}`, true);
  } catch (error) {
    console.error(error);
    if (!silentError) setUpdateStatus(t('updateFailed'), false, true);
  } finally {
    updateInProgress = false;
    el.checkUpdatesButton.disabled = false;
  }
}
function scheduleSilentUpdateCheck() {
  if (!shouldRunAutoUpdateCheck()) return;
  void checkForUpdates({ showChecking: false, silentNoChange: true, silentError: true });
}
function firstText(xml, selectors) { for (const selector of selectors) { const value = cleanText(xml.querySelector(selector)?.textContent); if (value) return value; } return null; }
function parsePhotoNode(node) {
  if (!node) return null;
  const url = cleanText(node.getAttribute?.('href') || node.getAttribute?.('src') || node.textContent);
  if (!/^https?:\/\//i.test(url)) return null;
  const title = cleanText(node.getAttribute?.('title') || node.getAttribute?.('label')) || null;
  return { url, title };
}
function normalizePhotoLocation(value) {
  if (!value) return null;
  const lat = Number(value.lat ?? value.latitude);
  const lng = Number(value.lng ?? value.lon ?? value.longitude);
  const altValue = value.alt ?? value.altitude ?? value.ele;
  const alt = altValue == null ? null : Number(altValue);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, alt: Number.isFinite(alt) ? alt : null };
}
function isRenderablePhotoUrl(url) {
  if (/^data:image\//i.test(url)) return true;
  if (!/^https?:\/\//i.test(url)) return false;
  if (/\{width\}|\{height\}|\{crop\}/i.test(url)) return false;
  if (/api\.komoot\.de\/v\d+\/tours\/[^/]+\/(translations|tour_line|timeline|details|faqs)\/?$/i.test(url)) return false;
  return true;
}
function normalizePhotos(photos) {
  if (!Array.isArray(photos)) return [];
  const seen = new Set();
  return photos.map((photo) => typeof photo === 'string' ? { url: photo, title: null } : { ...photo }).filter((photo) => {
    const url = cleanText(photo?.url);
    const sourceUrl = cleanText(photo?.sourceUrl) || url;
    if (!isRenderablePhotoUrl(url) || seen.has(sourceUrl)) return false;
    seen.add(sourceUrl);
    photo.url = url;
    photo.sourceUrl = sourceUrl;
    photo.title = cleanText(photo.title) || null;
    photo.caption = cleanText(photo.caption) || null;
    photo.createdAt = cleanText(photo.createdAt) || null;
    photo.attribution = cleanText(photo.attribution) || null;
    photo.attributionUrl = cleanText(photo.attributionUrl) || null;
    photo.type = cleanText(photo.type) || null;
    photo.id = cleanText(photo.id) || null;
    photo.loadError = cleanText(photo.loadError) || null;
    photo.inlineLoaded = photo.inlineLoaded === true;
    photo.widthPx = Number.isFinite(Number(photo.widthPx)) ? Number(photo.widthPx) : null;
    photo.heightPx = Number.isFinite(Number(photo.heightPx)) ? Number(photo.heightPx) : null;
    photo.location = normalizePhotoLocation(photo.location);
    photo.lineLocation = normalizePhotoLocation(photo.lineLocation);
    return true;
  });
}
function collectGpxPhotos(xml) {
  const photos = [];
  const selectors = [
    'wpt link[href]',
    'wpt extensions\\:link[href]',
    'wpt [href]',
    'trkpt link[href]',
    'trkpt [href]',
    'rtept link[href]',
    'rtept [href]',
    'extensions image',
    'extensions img',
    'extensions url'
  ];
  selectors.forEach((selector) => {
    xml.querySelectorAll(selector).forEach((node) => {
      const photo = parsePhotoNode(node);
      if (photo) photos.push(photo);
    });
  });
  return normalizePhotos(photos);
}
function haversine(a, b) { const r = 6371; const toRad = (d) => d * Math.PI / 180; const dLat = toRad(b.lat - a.lat); const dLng = toRad(b.lng - a.lng); const q = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2; return 2 * r * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q)); }
function bearingDegrees(a, b) { return ((Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180 / Math.PI) + 360) % 360; }
function parsePointTime(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}
function profileGradeAtPoint(points, index) {
  if (!Array.isArray(points) || index < 0 || index >= points.length) return null;
  const current = points[index];
  const previous = points[Math.max(0, index - 1)];
  const next = points[Math.min(points.length - 1, index + 1)];
  const left = previous === current ? current : previous;
  const right = next === current ? current : next;
  if (left?.ele == null || right?.ele == null || left.cumulativeKm == null || right.cumulativeKm == null) return null;
  const distanceMeters = Math.abs((right.cumulativeKm - left.cumulativeKm) * 1000);
  if (!distanceMeters) return null;
  return ((right.ele - left.ele) / distanceMeters) * 100;
}
function decorationStepsForZoom(zoom) {
  if (zoom >= DECORATION_ZOOM_LEVELS.fine) return { kmStep: 1, arrowStep: 2 };
  if (zoom >= DECORATION_ZOOM_LEVELS.coarse) return { kmStep: 5, arrowStep: 5 };
  return { kmStep: null, arrowStep: null };
}
function sampleAlongTrack(points, targetKm) {
  let distance = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const segmentKm = haversine(from, to);
    if (!segmentKm) continue;
    const nextDistance = distance + segmentKm;
    if (nextDistance >= targetKm) {
      const ratio = Math.min(1, Math.max(0, (targetKm - distance) / segmentKm));
      return {
        lat: from.lat + (to.lat - from.lat) * ratio,
        lng: from.lng + (to.lng - from.lng) * ratio,
        bearing: bearingDegrees(from, to),
        distanceKm: targetKm
      };
    }
    distance = nextDistance;
  }
  return null;
}
function markerIconHtml(label, color, highlighted) {
  return `<span class="km-marker${highlighted ? ' is-highlighted' : ''}" style="--marker-color:${color}">${label}</span>`;
}
function arrowIconHtml(color, rotation, highlighted) {
    return `<span class="track-arrow${highlighted ? ' is-highlighted' : ''}" style="--arrow-color:${color}; --arrow-rotation:${rotation - 90}deg"></span>`;
  }
  function replayMarkerIconHtml(rotation) {
    return `<span class="replay-marker-arrow" style="--replay-arrow-rotation:${(rotation ?? 0) + 90}deg"></span>`;
  }
function enrichTrackMetrics(track) {
  if ((!Array.isArray(track.points) || !track.points.some((point) => point?.ele != null)) && typeof track.gpxText === 'string') {
    try {
      const parsed = parseGpx(track.gpxText);
      return {
        ...track,
        points: parsed.points,
        pointCount: parsed.pointCount,
        distanceKm: parsed.distanceKm,
        dateStart: resolveTrackDate(track.dateStart, parsed.dateStart),
        hasElevation: parsed.hasElevation,
        elevationGainM: parsed.elevationGainM,
        elevationLossM: parsed.elevationLossM,
        elevationMinM: parsed.elevationMinM,
        elevationMaxM: parsed.elevationMaxM
      };
    } catch {}
  }
  const points = Array.isArray(track.points) ? track.points.map((point) => ({ ...point })) : [];
  let distanceKm = 0;
  let elevationGainM = 0;
  let elevationLossM = 0;
  let previousElevation = points[0]?.ele ?? null;
  const firstTime = parsePointTime(points[0]?.time);
  let lastTime = firstTime;
  let cumulativeAscentM = 0;
  points.forEach((point, index) => {
    if (index === 0) {
      point.cumulativeKm = 0;
      point.cumulativeAscentM = 0;
      point.cumulativeTimeSec = 0;
      return;
    }
    distanceKm += haversine(points[index - 1], point);
    point.cumulativeKm = distanceKm;
    if (previousElevation != null && point.ele != null) {
      const delta = point.ele - previousElevation;
      if (delta > 0) {
        elevationGainM += delta;
        cumulativeAscentM += delta;
      }
      if (delta < 0) elevationLossM += Math.abs(delta);
    }
    point.cumulativeAscentM = cumulativeAscentM;
    const pointTime = parsePointTime(point.time);
    if (firstTime != null && pointTime != null && pointTime >= firstTime) {
      point.cumulativeTimeSec = Math.round((pointTime - firstTime) / 1000);
      lastTime = pointTime;
    } else {
      point.cumulativeTimeSec = points[index - 1]?.cumulativeTimeSec ?? 0;
    }
    if (point.ele != null) previousElevation = point.ele;
  });
  const elevationValues = points.map((point) => point.ele).filter((value) => value != null);
  const derivedDurationHours = firstTime != null && lastTime != null && lastTime > firstTime ? (lastTime - firstTime) / 3600000 : null;
  const durationHours = track.durationHours ?? derivedDurationHours;
  const avgSpeedKmh = durationHours && durationHours > 0 ? Number((distanceKm / durationHours).toFixed(1)) : null;
  return {
    ...track,
    points,
    distanceKm: Number((track.distanceKm ?? distanceKm).toFixed(2)),
    pointCount: track.pointCount ?? points.length,
    hasElevation: elevationValues.length >= 2,
    elevationGainM: track.elevationGainM ?? Math.round(elevationGainM),
    elevationLossM: track.elevationLossM ?? Math.round(elevationLossM),
    elevationMinM: track.elevationMinM ?? (elevationValues.length ? Math.min(...elevationValues) : null),
    elevationMaxM: track.elevationMaxM ?? (elevationValues.length ? Math.max(...elevationValues) : null),
    durationHours,
    avgSpeedKmh
  };
}

function parseGpx(text) {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('Invalid GPX');
  const name = firstText(xml, ['metadata > name', 'trk > name', 'rte > name']) || t('unnamedTrack');
  const description = firstText(xml, ['metadata > desc', 'trk > desc', 'rte > desc', 'metadata > cmt', 'trk > cmt', 'rte > cmt']);
  const photos = collectGpxPhotos(xml);
  const nodes = [...xml.querySelectorAll('trkpt, rtept')];
  if (!nodes.length) throw new Error('No track points found');
  const points = nodes.map((node) => {
    const elevation = Number(node.querySelector('ele')?.textContent);
    return { lat: Number(node.getAttribute('lat')), lng: Number(node.getAttribute('lon')), ele: Number.isFinite(elevation) ? elevation : null, time: node.querySelector('time')?.textContent || null, cumulativeKm: 0, cumulativeTimeSec: 0, cumulativeAscentM: 0 };
  });
  let distanceKm = 0;
  let elevationGainM = 0;
  let elevationLossM = 0;
  let previousElevation = points[0]?.ele ?? null;
  let cumulativeAscentM = 0;
  const firstTime = parsePointTime(points[0]?.time);
  let lastTime = firstTime;
  for (let i = 1; i < points.length; i += 1) {
    distanceKm += haversine(points[i - 1], points[i]);
    points[i].cumulativeKm = distanceKm;
    if (previousElevation != null && points[i].ele != null) {
      const delta = points[i].ele - previousElevation;
      if (delta > 0) {
        elevationGainM += delta;
        cumulativeAscentM += delta;
      }
      if (delta < 0) elevationLossM += Math.abs(delta);
    }
    points[i].cumulativeAscentM = cumulativeAscentM;
    const pointTime = parsePointTime(points[i].time);
    if (firstTime != null && pointTime != null && pointTime >= firstTime) {
      points[i].cumulativeTimeSec = Math.round((pointTime - firstTime) / 1000);
      lastTime = pointTime;
    } else {
      points[i].cumulativeTimeSec = points[i - 1]?.cumulativeTimeSec ?? 0;
    }
    if (points[i].ele != null) previousElevation = points[i].ele;
  }
  const dates = points.map((point) => point.time).filter(Boolean).sort();
  const elevationValues = points.map((point) => point.ele).filter((value) => value != null);
  const durationHours = firstTime != null && lastTime != null && lastTime > firstTime ? (lastTime - firstTime) / 3600000 : null;
  const avgSpeedKmh = durationHours && durationHours > 0 ? Number((distanceKm / durationHours).toFixed(1)) : null;
  return {
    name,
    description,
    photos,
    points,
    pointCount: points.length,
    distanceKm: Number(distanceKm.toFixed(2)),
    dateStart: dates[0] || null,
    hasElevation: elevationValues.length >= 2,
    elevationGainM: Math.round(elevationGainM),
    elevationLossM: Math.round(elevationLossM),
    elevationMinM: elevationValues.length ? Math.min(...elevationValues) : null,
    elevationMaxM: elevationValues.length ? Math.max(...elevationValues) : null,
    durationHours,
    avgSpeedKmh
  };
}

function buildTrackRecord({ gpxText, fileName, source, type, account, description = null, photos = null, meta = null }) {
  const parsed = parseGpx(gpxText);
  const timestamp = isoNow();
  const track = {
    id: id('track'),
    name: parsed.name || fileName?.replace(/\.gpx$/i, '') || t('unnamedTrack'),
    description: normalizeTrackDescription(description, parsed.description),
    photos: normalizePhotos(Array.isArray(photos) && photos.length ? photos : parsed.photos),
    source,
    type: trackType(type),
    accountId: account?.id ?? null,
    accountEmail: account?.email ?? null,
    accountLabel: account?.label ?? null,
    sourceTrackId: account?.sourceTrackId ?? null,
    importedAt: timestamp,
    lastChanged: timestamp,
    dateStart: source === 'komoot' ? resolveTrackDate(meta?.dateStart, parsed.dateStart) : resolveTrackDate(parsed.dateStart, meta?.dateStart),
    distanceKm: parsed.distanceKm,
    pointCount: parsed.pointCount,
    hasElevation: parsed.hasElevation,
    elevationGainM: parsed.elevationGainM,
    elevationLossM: parsed.elevationLossM,
    elevationMinM: parsed.elevationMinM,
    elevationMaxM: parsed.elevationMaxM,
    durationHours: meta?.durationHours ?? parsed.durationHours ?? null,
    avgSpeedKmh: meta?.durationHours ? Number((parsed.distanceKm / meta.durationHours).toFixed(1)) : parsed.avgSpeedKmh ?? null,
    sport: meta?.sport ?? null,
    surfaces: normalizeTagList(meta?.surfaces),
    wayTypes: normalizeTagList(meta?.wayTypes),
    color: null,
    gpxText,
    points: parsed.points
  };
  track.color = defaultTrackColor(track);
  track.signature = signature(track); return track;
}

function normalizeTagList(value) {
  if (Array.isArray(value)) return value.map((item) => cleanText(item?.name || item?.type || item)).filter(Boolean);
  return [];
}

function canonicalSportKey(value) {
  const sport = cleanText(value).toLowerCase();
  if (!sport) return null;
  return SPORT_ALIAS_LOOKUP[sport] || null;
}
function sportLabel(value) {
  const sport = cleanText(value).toLowerCase();
  if (!sport) return '-';
  const key = canonicalSportKey(sport);
  if (key) return SPORT_LABELS[key][lang()] || SPORT_LABELS[key].en;
  return sport.replaceAll('_', ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}
function iconForSport(value) {
  const key = canonicalSportKey(value);
  if (key) return SPORT_LABELS[key].icon;
  const sport = `${value ?? ''}`.toLowerCase();
  if (sport.includes('hike') || sport.includes('walk')) return '🥾';
  if (sport.includes('run')) return '🏃';
  if (sport.includes('bike') || sport.includes('bicycle') || sport.includes('mtb') || sport.includes('cycle')) return '🚴';
  return '•';
}
function metaTags(track) { return [...normalizeTagList(track.surfaces), ...normalizeTagList(track.wayTypes)]; }
function allSports() { return [...new Set(state.tracks.map((track) => track.sport).filter(Boolean))].sort(); }
function allMetaTags() { return [...new Set(state.tracks.flatMap((track) => metaTags(track)).filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
function renderLibraryFilters() {
  const currentSport = el.librarySportFilter.value || 'all';
  const currentMeta = el.libraryMetaFilter.value || 'all';
  el.librarySportFilter.replaceChildren();
  el.libraryMetaFilter.replaceChildren();
  [{ value: 'all', label: t('filterAllSports') }, ...allSports().map((sport) => ({ value: sport, label: sportLabel(sport) }))].forEach((item) => {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    option.selected = item.value === currentSport;
    el.librarySportFilter.append(option);
  });
  [{ value: 'all', label: t('filterAllDetails') }, ...allMetaTags().map((tag) => ({ value: tag, label: tag }))].forEach((item) => {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    option.selected = item.value === currentMeta;
    el.libraryMetaFilter.append(option);
  });
}

function filteredTracks() {
  const q = el.librarySearchInput.value.trim().toLowerCase(); const type = el.libraryTypeFilter.value; const sport = el.librarySportFilter.value; const meta = el.libraryMetaFilter.value; const sort = el.librarySortSelect.value; let tracks = [...state.tracks];
  if (type !== 'all') tracks = tracks.filter((track) => track.type === type);
  if (sport !== 'all') tracks = tracks.filter((track) => track.sport === sport);
  if (meta !== 'all') tracks = tracks.filter((track) => metaTags(track).includes(meta));
  if (q) tracks = tracks.filter((track) => [track.name, track.description, track.accountLabel, track.accountEmail, track.source, track.dateStart, track.sport, ...metaTags(track)].filter(Boolean).join(' ').toLowerCase().includes(q));
  tracks.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'distance' ? (b.distanceKm ?? 0) - (a.distanceKm ?? 0) : sort === 'date' ? `${b.dateStart ?? ''}`.localeCompare(`${a.dateStart ?? ''}`) : (b.importedAt ?? '').localeCompare(a.importedAt ?? ''));
  return tracks;
}
function recentTracks() { return [...state.tracks].sort((a, b) => (b.importedAt ?? '').localeCompare(a.importedAt ?? '')).slice(0, 12); }
function activeAccount() { return state.accounts.find((account) => account.id === state.settings.activeAccountId) ?? null; }
function photoCountLabel(count) {
  if (lang() === 'en') return `${count} ${count === 1 ? 'photo' : 'photos'}`;
  if (lang() === 'fr') return `${count} ${count === 1 ? 'photo' : 'photos'}`;
  return `${count} ${count === 1 ? 'Foto' : 'Fotos'}`;
}
function createFact(icon, label, value) {
  return `<span class="track-fact"><span class="track-fact-icon">${icon}</span><span>${label}:</span><strong>${value}</strong></span>`;
}
function photoLatLng(photo) {
  const point = photo?.location || photo?.lineLocation || null;
  return point && Number.isFinite(point.lat) && Number.isFinite(point.lng) ? [point.lat, point.lng] : null;
}
function photoNeedsReload(photo) {
  return !!(photo?.loadError && photo?.sourceUrl);
}
function trackHasReloadablePhotos(track) {
  return Array.isArray(track?.photos) && track.photos.some(photoNeedsReload);
}
function nearestTrackPoint(track, latLng) {
  if (!track || !latLng || !Array.isArray(track.points) || !track.points.length) return null;
  return track.points.reduce((best, point) => {
    const distance = haversine({ lat: latLng[0], lng: latLng[1] }, point);
    if (!best || distance < best.distance) return { point, distance };
    return best;
  }, null)?.point ?? null;
}
function renderPhotoDialog() {
  const track = state.tracks.find((item) => item.id === state.photoDialogUi.trackId);
  const photos = state.photoDialogUi.photos;
  const photo = photos[state.photoDialogUi.index];
  if (!track || !photo) return;
  el.photoDialogTitle.textContent = photo.title || track.name;
  el.photoDialogSubtitle.textContent = t('detailDialogSubtitle', { source: track.accountLabel || trackSourceLabel(track.source), date: fmtDate(photo.createdAt || track.dateStart) });
  el.photoDialogImage.src = photo.url;
  el.photoDialogImage.alt = photo.title || track.name;
  if (/^https?:\/\//i.test(photo.url)) el.photoDialogImage.referrerPolicy = 'no-referrer';
  el.photoDialogCaption.textContent = photo.caption || '';
  el.photoDialogCaption.hidden = !photo.caption;
  const facts = [];
  if (photo.createdAt) facts.push(createFact('📅', t('labelDate'), fmtDate(photo.createdAt)));
  if (photo.attribution) facts.push(createFact('©', t('labelAttribution'), photo.attribution));
  if (photo.location) facts.push(createFact('📍', 'GPS', `${photo.location.lat.toFixed(5)}, ${photo.location.lng.toFixed(5)}`));
  el.photoDialogMeta.innerHTML = facts.join('');
  el.photoDialogThumbs.replaceChildren();
  photos.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `photo-dialog-thumb${index === state.photoDialogUi.index ? ' is-active' : ''}`;
    const image = document.createElement('img');
    image.src = item.url;
    image.alt = item.title || `${track.name} ${index + 1}`;
    button.append(image);
    button.addEventListener('click', () => {
      state.photoDialogUi.index = index;
      renderPhotoDialog();
    });
    el.photoDialogThumbs.append(button);
  });
  el.photoDialogPrev.hidden = photos.length < 2;
  el.photoDialogNext.hidden = photos.length < 2;
  const activeThumb = el.photoDialogThumbs.querySelector('.photo-dialog-thumb.is-active');
  activeThumb?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
}
function stepPhotoDialog(offset) {
  const photos = state.photoDialogUi.photos;
  if (!photos.length) return;
  state.photoDialogUi.index = (state.photoDialogUi.index + offset + photos.length) % photos.length;
  renderPhotoDialog();
}
function openPhotoDialog(track, photoOrIndex) {
  const photos = Array.isArray(track?.photos) ? track.photos : [];
  if (!track || !photos.length) return;
  const index = typeof photoOrIndex === 'number' ? photoOrIndex : Math.max(0, photos.indexOf(photoOrIndex));
  state.photoDialogUi.trackId = track.id;
  state.photoDialogUi.photos = photos;
  state.photoDialogUi.index = Math.min(index, photos.length - 1);
  renderPhotoDialog();
  if (!el.photoDialog.open) el.photoDialog.showModal();
}
function photoPopupMarkup(track, photo) {
  const title = escapeHtml(photo.title || track.name);
  const subtitle = escapeHtml(photo.caption || fmtDate(photo.createdAt || track.dateStart));
  return `<div class="photo-popup"><img src="${photo.url}" alt="${title}"><strong>${title}</strong><span>${subtitle}</span><button class="button button-subtle photo-popup-gallery-button" type="button">Galerie</button></div>`;
}
function buildTrackPhotoLayer(track) {
  const layer = L.layerGroup();
  (Array.isArray(track.photos) ? track.photos : []).forEach((photo, index) => {
    const latLng = photoLatLng(photo);
    if (!latLng) return;
    const marker = L.marker(latLng, {
      icon: L.divIcon({
        className: 'photo-marker-icon',
        html: `<span class="photo-marker"><img src="${photo.url}" alt="${escapeHtml(photo.title || `${track.name} ${index + 1}`)}"></span>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -20]
      })
    }).bindPopup(photoPopupMarkup(track, photo));
    marker.on('popupopen', () => {
      const popupElement = marker.getPopup()?.getElement();
      const galleryButton = popupElement?.querySelector('.photo-popup-gallery-button');
      if (galleryButton) {
        galleryButton.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          openPhotoDialog(track, index);
        }, { once: true });
      }
    });
    layer.addLayer(marker);
  });
  return layer;
}
async function reloadTrackPhotos(trackId) {
  const track = state.tracks.find((item) => item.id === trackId);
  if (!track) return;
  const candidates = (track.photos ?? []).map((photo, index) => ({ photo, index })).filter(({ photo }) => photoNeedsReload(photo));
  if (!candidates.length) {
    setStatus(t('reloadPhotosNone'));
    return;
  }
  try {
    const account = state.accounts.find((item) => item.id === track.accountId || item.email === track.accountEmail) ?? null;
    if (account) {
      if (!await checkProxy()) return;
      await ensureProxyAccountLogin(account);
    }
    const payload = await proxyRequest('/photo-inline', {
      method: 'POST',
      body: {
        photos: candidates.map(({ photo }) => ({
          url: photo.sourceUrl || photo.url,
          title: photo.title,
          caption: photo.caption,
          createdAt: photo.createdAt,
          attribution: photo.attribution,
          attributionUrl: photo.attributionUrl,
          widthPx: photo.widthPx,
          heightPx: photo.heightPx,
          type: photo.type,
          id: photo.id,
          location: photo.location,
          lineLocation: photo.lineLocation
        }))
      }
    });
    const replacements = normalizePhotos(payload.items || []);
    const updatedPhotos = [...(track.photos || [])];
    candidates.forEach(({ index }, candidateIndex) => {
      if (replacements[candidateIndex]) updatedPhotos[index] = replacements[candidateIndex];
    });
  const updatedTrack = touchTrack(track, { photos: updatedPhotos });
  await put(STORES.tracks, updatedTrack);
  state.tracks = state.tracks.map((item) => item.id === updatedTrack.id ? updatedTrack : item);
    renderAll();
    syncMap();
    setStatus(t('reloadPhotosDone'));
  } catch (error) {
    setStatus(error.message || t('reloadPhotosFailed'), true);
  }
}
function trackFactsMarkup(track) {
  const facts = [
    createFact('📅', t('labelDate'), fmtDate(track.dateStart)),
    createFact('↔', t('labelDistance'), `${fmtKm(track.distanceKm)} km`)
  ];
  if (track.durationHours != null) facts.push(createFact('⏱', t('labelDuration'), `${track.durationHours.toFixed(1)} h`));
  if (track.elevationGainM != null) facts.push(createFact('↗', t('labelAscent'), fmtMeters(track.elevationGainM)));
  if (track.elevationLossM != null) facts.push(createFact('↘', t('labelDescent'), fmtMeters(track.elevationLossM)));
  if (track.sport) facts.push(createFact(iconForSport(track.sport), t('labelSport'), sportLabel(track.sport)));
  normalizeTagList(track.surfaces).slice(0, 2).forEach((item) => facts.push(`<span class="track-tag-chip">${t('labelSurface')}: ${item}</span>`));
  normalizeTagList(track.wayTypes).slice(0, 2).forEach((item) => facts.push(`<span class="track-tag-chip">${t('labelWayType')}: ${item}</span>`));
  return facts.join('');
}
function renderPhotoGrid(container, track, limit = 4) {
  if (!container) return;
  container.replaceChildren();
  const allPhotos = Array.isArray(track.photos) ? track.photos : [];
  const photos = allPhotos.slice(0, limit);
  if (trackHasReloadablePhotos(track)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button button-subtle track-photo-reload-button';
    button.textContent = t('reloadPhotos');
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      await reloadTrackPhotos(track.id);
    });
    container.append(button);
  }
  photos.forEach((photo, index) => {
    const image = document.createElement('img');
    image.className = 'track-photo-thumb';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.src = photo.url;
    image.alt = photo.title || `${track.name} ${index + 1}`;
    image.addEventListener('error', () => image.remove(), { once: true });
    if (/^https?:\/\//i.test(photo.url)) image.referrerPolicy = 'no-referrer';
    image.addEventListener('click', (event) => { event.stopPropagation(); openPhotoDialog(track, index); });
    container.append(image);
  });
  if (allPhotos.length > photos.length) {
    const count = document.createElement('span');
    count.className = 'track-photo-count';
    count.textContent = photoCountLabel(allPhotos.length);
    container.append(count);
  }
  container.hidden = photos.length === 0;
}
function renderTrackExtras(copyNode, track) {
  const submeta = copyNode.querySelector('.track-submeta');
  const description = copyNode.querySelector('.track-description');
  const facts = copyNode.querySelector('.track-facts');
  const photoStrip = copyNode.querySelector('.track-photo-strip');
  if (submeta) {
    submeta.textContent = t('trackSubmeta', { date: fmtDate(track.dateStart), source: track.accountLabel || trackSourceLabel(track.source) });
  }
  if (description) {
    description.textContent = track.description || '';
    description.hidden = !track.description;
  }
  if (facts) facts.innerHTML = trackFactsMarkup(track);
  renderPhotoGrid(photoStrip, track, 6);
}
function openTrackDetail(trackId) {
  const track = state.tracks.find((item) => item.id === trackId);
  if (!track) return;
  el.trackDetailTitle.textContent = track.name;
  el.trackDetailSubtitle.textContent = t('detailDialogSubtitle', { source: track.accountLabel || trackSourceLabel(track.source), date: fmtDate(track.dateStart) });
  el.trackDetailFacts.innerHTML = trackFactsMarkup(track);
  el.trackDetailDescription.textContent = track.description || '';
  el.trackDetailDescription.hidden = !track.description;
  el.trackDetailPhotos.replaceChildren();
  (Array.isArray(track.photos) ? track.photos : []).forEach((photo, index) => {
    const image = document.createElement('img');
    image.src = photo.url;
    image.alt = photo.title || `${track.name} ${index + 1}`;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => image.remove(), { once: true });
    if (/^https?:\/\//i.test(photo.url)) image.referrerPolicy = 'no-referrer';
    image.addEventListener('click', () => openPhotoDialog(track, index));
    el.trackDetailPhotos.append(image);
  });
  el.trackDetailPhotos.hidden = !(Array.isArray(track.photos) && track.photos.length);
  el.trackDetailDialog.showModal();
}
function allFilteredSelected() { const tracks = filteredTracks(); return tracks.length > 0 && tracks.every((track) => state.selectedTrackIds.has(track.id)); }
function renderToggleSelectionButton() { if (el.libraryToggleSelectionButton) el.libraryToggleSelectionButton.textContent = allFilteredSelected() ? t('clearSelection') : t('selectAll'); }
function trackWidthPresetLabel(value) {
  const weight = Number(value) || 6;
  if (lang() === 'fr') {
    if (weight <= 4) return `${weight} px · fin`;
    if (weight <= 6) return `${weight} px · standard`;
    if (weight <= 8) return `${weight} px · large`;
    return `${weight} px · fort`;
  }
  if (lang() === 'en') {
    if (weight <= 4) return `${weight} px · fine`;
    if (weight <= 6) return `${weight} px · standard`;
    if (weight <= 8) return `${weight} px · wide`;
    return `${weight} px · bold`;
  }
  if (weight <= 4) return `${weight} px · fein`;
  if (weight <= 6) return `${weight} px · standard`;
  if (weight <= 8) return `${weight} px · breit`;
  return `${weight} px · praesent`;
}
function renderTrackWidthControl() {
  if (!el.trackWidthInput || !el.trackWidthValue) return;
  const weight = Number(state.settings.trackLineWeight) || 6;
  el.trackWidthInput.value = String(weight);
  el.trackWidthValue.textContent = trackWidthPresetLabel(weight);
}
function renderMapPhotoModeButton() {
  if (!el.mapPhotoModeButton) return;
  const active = !!state.settings.photoOverlayOnly;
  el.mapPhotoModeButton.textContent = active ? t('showTracksAgain') : t('showAllTrackPhotos');
  el.mapPhotoModeButton.classList.toggle('is-active', active);
}
function renderPaneCompactButtons() {
  const sidebarCompact = !!state.settings.sidebarCompact;
  const libraryCompact = !!state.settings.libraryCompact;
  if (el.toggleSidebarCompactButton) {
    const label = lang() === 'fr'
      ? (sidebarCompact ? 'Elargir la colonne gauche' : 'Rendre la colonne gauche plus etroite')
      : lang() === 'en'
        ? (sidebarCompact ? 'Expand left column' : 'Make left column narrower')
        : (sidebarCompact ? 'Linke Spalte verbreitern' : 'Linke Spalte schmal schalten');
    el.toggleSidebarCompactButton.textContent = sidebarCompact ? '⟫' : '⟪';
    el.toggleSidebarCompactButton.setAttribute('title', label);
    el.toggleSidebarCompactButton.setAttribute('aria-label', label);
  }
  if (el.toggleLibraryCompactButton) {
    const label = lang() === 'fr'
      ? (libraryCompact ? 'Elargir la bibliotheque' : 'Rendre la bibliotheque plus etroite')
      : lang() === 'en'
        ? (libraryCompact ? 'Expand library column' : 'Make library column narrower')
        : (libraryCompact ? 'Bibliothek verbreitern' : 'Bibliothek schmal schalten');
    el.toggleLibraryCompactButton.textContent = libraryCompact ? '⟫' : '⟪';
    el.toggleLibraryCompactButton.setAttribute('title', label);
    el.toggleLibraryCompactButton.setAttribute('aria-label', label);
  }
}

function renderI18n() {
  document.documentElement.lang = lang(); document.title = 'Trailthread'; document.querySelectorAll('[data-i18n]').forEach((node) => { node.textContent = t(node.dataset.i18n); }); el.librarySearchInput.placeholder = t('searchPlaceholder'); el.librarySearchInput.setAttribute('aria-label', t('searchPlaceholder')); el.prevTrackButton?.setAttribute('aria-label', lang() === 'fr' ? 'Trace precedente' : lang() === 'en' ? 'Previous track' : 'Vorheriger Track'); el.prevTrackButton?.setAttribute('title', lang() === 'fr' ? 'Trace precedente' : lang() === 'en' ? 'Previous track' : 'Vorheriger Track'); el.nextTrackButton?.setAttribute('aria-label', lang() === 'fr' ? 'Trace suivante' : lang() === 'en' ? 'Next track' : 'Naechster Track'); el.nextTrackButton?.setAttribute('title', lang() === 'fr' ? 'Trace suivante' : lang() === 'en' ? 'Next track' : 'Naechster Track'); el.photoDialogClose?.setAttribute('aria-label', t('closeButton')); el.photoDialogClose?.setAttribute('title', t('closeButton')); [['replayRestartButton', 'replayRestart'], ['replayBackButton', 'replayBack'], ['replayPlayButton', 'replayPlay'], ['replayPauseButton', 'replayStop'], ['replayForwardButton', 'replayForward']].forEach(([ref, key]) => { el[ref]?.setAttribute('aria-label', t(key)); el[ref]?.setAttribute('title', t(key)); }); el.languageSelect.value = state.settings.language ?? 'auto'; renderTrackWidthControl(); renderMapPhotoModeButton(); renderPaneCompactButtons(); renderReplayControls(); renderVersionLabel();
}
function renderWorkspace() { const w = ['library', 'komoot', 'replay'].includes(state.settings.activeWorkspace) ? state.settings.activeWorkspace : 'library'; state.settings.activeWorkspace = w; el.libraryWorkspace.hidden = w !== 'library'; el.komootWorkspace.hidden = w !== 'komoot'; el.replayWorkspace.hidden = w !== 'replay'; el.workspaceButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.workspace === w)); if (w === 'replay') ensureReplayMaps(); scheduleMapLayoutRefresh(); }
function renderAccounts() {
  el.accountsList.replaceChildren(); el.komootAccountSelect.replaceChildren();
  const first = document.createElement('option'); first.value = ''; first.textContent = t('accountSelectPlaceholder'); el.komootAccountSelect.append(first);
  state.accounts.forEach((account) => {
    const frag = el.accountItemTemplate.content.cloneNode(true); const card = frag.querySelector('.account-card'); const name = frag.querySelector('.account-name'); const meta = frag.querySelector('.account-meta'); const useButton = frag.querySelector('.account-use-button'); const deleteButton = frag.querySelector('.account-delete-button'); const active = account.id === state.settings.activeAccountId;
    card.classList.toggle('is-active', active); name.textContent = account.label || account.email; meta.textContent = t('accountMeta', { email: account.email, label: active ? t('accountActive') : t('accountInactive') });
    useButton.title = 'Use'; deleteButton.title = t('deleteTrack');
    useButton.addEventListener('click', async () => { state.settings.activeAccountId = account.id; await saveSettings(); renderAccounts(); });
    deleteButton.addEventListener('click', async () => { if (!await confirmAction(t('confirmDeleteAccount'))) return; await del(STORES.accounts, account.id); state.accounts = state.accounts.filter((item) => item.id !== account.id); if (state.settings.activeAccountId === account.id) { state.settings.activeAccountId = state.accounts[0]?.id ?? null; await saveSettings(); } renderAll(); setStatus(t('accountRemoved')); });
    el.accountsList.append(frag);
    const opt = document.createElement('option'); opt.value = account.id; opt.textContent = `${account.label || account.email} (${account.email})`; opt.selected = active; el.komootAccountSelect.append(opt);
  });
  el.komootAccountSelect.value = state.settings.activeAccountId ?? '';
}
function renderLibrary() {
  renderLibraryFilters();
  const tracks = filteredTracks(); el.trackList.replaceChildren(); el.librarySummary.textContent = tracks.length ? t('librarySummary', { count: tracks.length }) : t('libraryEmpty');
  tracks.forEach((track) => {
    const frag = el.trackItemTemplate.content.cloneNode(true);
    const item = frag.querySelector('.track-item');
    const checkbox = frag.querySelector('.track-checkbox');
    const swatch = frag.querySelector('.track-swatch');
    const colorInput = frag.querySelector('.track-color-input');
    const copy = frag.querySelector('.track-copy');
    const name = frag.querySelector('.track-name');
    const focusButton = frag.querySelector('.focus-button');
    const replayButton = frag.querySelector('.replay-button');
    const exportButton = frag.querySelector('.export-button');
    const expandButton = frag.querySelector('.expand-button');
    const deleteButton = frag.querySelector('.delete-button');
    item.classList.toggle('is-selected', state.selectedTrackIds.has(track.id));
    item.dataset.trackId = track.id;
    item.tabIndex = 0;
    checkbox.checked = state.selectedTrackIds.has(track.id);
    checkbox.dataset.trackId = track.id;
    swatch.style.background = track.color;
    colorInput.value = track.color;
    name.textContent = track.name;
    renderTrackExtras(copy, track);
    item.addEventListener('click', (event) => {
      if (event.target.closest('.track-actions')) return;
      if (state.settings.activeWorkspace === 'replay') {
        preserveLibraryListState(track.id);
        openReplayTrack(track.id);
        return;
      }
      preserveLibraryListState(track.id);
      checkbox.checked ? state.selectedTrackIds.delete(track.id) : state.selectedTrackIds.add(track.id);
      renderLibrary();
      renderSelection();
      syncMap();
    });
    item.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (state.settings.activeWorkspace === 'replay') {
        preserveLibraryListState(track.id);
        openReplayTrack(track.id);
        return;
      }
      preserveLibraryListState(track.id);
      checkbox.checked ? state.selectedTrackIds.delete(track.id) : state.selectedTrackIds.add(track.id);
      renderLibrary();
      renderSelection();
      syncMap();
    });
    colorInput.addEventListener('input', async (event) => {
      event.stopPropagation();
      const updatedTrack = touchTrack(track, { color: colorInput.value });
      await put(STORES.tracks, updatedTrack);
      state.tracks = state.tracks.map((item) => item.id === updatedTrack.id ? updatedTrack : item);
      swatch.style.background = updatedTrack.color;
      updateTrackLayerStyle(updatedTrack.id);
    });
    exportButton.textContent = '⇩';
    exportButton.title = t('exportTrackGpx');
    exportButton.setAttribute('aria-label', t('exportTrackGpx'));
    exportButton.addEventListener('click', (event) => { event.stopPropagation(); exportTrackGpx(track.id); });
    focusButton.textContent = '⌖';
    focusButton.title = t('focusTrack');
    focusButton.setAttribute('aria-label', t('focusTrack'));
    focusButton.addEventListener('click', (event) => { event.stopPropagation(); focusTrack(track.id); });
    replayButton.textContent = '▶';
    replayButton.title = t('replayOpen');
    replayButton.setAttribute('aria-label', t('replayOpen'));
    replayButton.addEventListener('click', async (event) => { event.stopPropagation(); await openReplayTrack(track.id); });
    expandButton.textContent = '⤢';
    expandButton.title = t('expandTrack');
    expandButton.setAttribute('aria-label', t('expandTrack'));
    expandButton.addEventListener('click', (event) => { event.stopPropagation(); openTrackDetail(track.id); });
    deleteButton.title = t('deleteTrack');
    deleteButton.addEventListener('click', async (event) => { event.stopPropagation(); preserveLibraryListState(null); if (!await confirmAction(t('confirmDeleteSelected'))) return; await deleteTracks([track.id]); });
    el.trackList.append(frag);
  });
  renderToggleSelectionButton();
  restoreLibraryListState();
}
function renderSelection() {
  const tracks = state.tracks.filter((track) => state.selectedTrackIds.has(track.id)); el.selectionStats.textContent = fmtNum(tracks.length); el.distanceStats.textContent = `${fmtKm(tracks.reduce((sum, track) => sum + (track.distanceKm ?? 0), 0))} km`; el.pointStats.textContent = fmtNum(tracks.reduce((sum, track) => sum + (track.pointCount ?? 0), 0));
  const overlay = el.selectionStats?.closest('.map-overlay');
  if (overlay?.parentElement) overlay.parentElement.append(overlay);
  if (!el.selectionList) return;
  el.selectionList.replaceChildren();
  if (!tracks.length) { const li = document.createElement('li'); li.className = 'track-item compact-item'; li.textContent = t('noSelection'); el.selectionList.append(li); return; }
  tracks.forEach((track) => { const frag = el.stagingItemTemplate.content.cloneNode(true); frag.querySelector('.track-name').textContent = track.name; frag.querySelector('.track-meta').textContent = t('trackMeta', { distance: fmtKm(track.distanceKm), points: fmtNum(track.pointCount), type: trackTypeLabel(track.type) }); frag.querySelector('.track-submeta').textContent = t('trackSubmeta', { date: fmtDate(track.dateStart), source: track.accountLabel || trackSourceLabel(track.source) }); el.selectionList.append(frag); });
}
function renderRecent() {
  if (!el.recentList || !el.recentSummary) return;
  const tracks = recentTracks(); el.recentList.replaceChildren(); el.recentSummary.textContent = tracks.length ? t('recentSummary', { count: tracks.length }) : t('inboxEmpty');
  tracks.forEach((track) => { const frag = el.stagingItemTemplate.content.cloneNode(true); frag.querySelector('.track-name').textContent = track.name; frag.querySelector('.track-meta').textContent = t('trackMeta', { distance: fmtKm(track.distanceKm), points: fmtNum(track.pointCount), type: trackTypeLabel(track.type) }); frag.querySelector('.track-submeta').textContent = t('trackSubmeta', { date: fmtDate(track.importedAt), source: track.accountLabel || trackSourceLabel(track.source) }); el.recentList.append(frag); });
}
function preserveKomootListState(listName, tourId = null) {
  const container = listName === 'recorded' ? el.recordedList : el.plannedList;
  state.komootUi.scrollTopByList[listName] = container.scrollTop;
  if (!tourId) {
    state.komootUi.focusOffsetByList[listName] = null;
    return;
  }
  const item = container.querySelector(`.tour-item[data-tour-id="${tourId}"]`);
  state.komootUi.focusOffsetByList[listName] = item ? (item.offsetTop - container.scrollTop) : null;
}
function preserveLibraryListState(trackId = null) {
  state.libraryUi.scrollTop = el.trackList?.scrollTop ?? 0;
  state.libraryUi.focusTrackId = trackId;
}
function restoreLibraryListState() {
  if (el.trackList) el.trackList.scrollTop = state.libraryUi.scrollTop ?? 0;
  if (!state.libraryUi.focusTrackId) return;
  const card = el.trackList?.querySelector(`.track-item[data-track-id="${state.libraryUi.focusTrackId}"]`);
  if (card) card.focus({ preventScroll: true });
}
function restoreKomootListState() {
  ['recorded', 'planned'].forEach((listName) => {
    const container = listName === 'recorded' ? el.recordedList : el.plannedList;
    container.scrollTop = state.komootUi.scrollTopByList[listName] ?? 0;
  });
  if (state.komootUi.focusTourId) {
    const listName = state.komootUi.focusList === 'planned' ? 'planned' : 'recorded';
    const container = listName === 'planned' ? el.plannedList : el.recordedList;
    const item = container.querySelector(`.tour-item[data-tour-id="${state.komootUi.focusTourId}"]`);
    const offset = state.komootUi.focusOffsetByList[listName];
    if (item && offset != null) {
      container.scrollTop = Math.max(0, item.offsetTop - offset);
    }
    const checkbox = container.querySelector(`.tour-checkbox[data-tour-id="${state.komootUi.focusTourId}"]`);
    if (checkbox) {
      checkbox.focus({ preventScroll: true });
    }
  }
}
function renderKomoot() {
  const renderList = (container, tours, listName) => { container.replaceChildren(); tours.forEach((tour) => { const frag = el.tourItemTemplate.content.cloneNode(true); const item = frag.querySelector('.tour-item'); const checkbox = frag.querySelector('.tour-checkbox'); frag.querySelector('.track-name').textContent = tour.name; frag.querySelector('.track-meta').textContent = `${fmtKm(tour.distanceKm)} km · ${sportLabel(tour.sport)} · ${trackTypeLabel(tour.type)}`; frag.querySelector('.track-submeta').textContent = `${fmtDate(tour.date)} · ${tour.accountLabel} · ${tour.id}`; item.dataset.tourId = tour.id; checkbox.checked = state.selectedKomootTourIds.has(tour.id); checkbox.dataset.tourId = tour.id; checkbox.dataset.listName = listName; item.classList.toggle('is-selected', checkbox.checked); checkbox.addEventListener('change', () => { preserveKomootListState(listName, tour.id); state.komootUi.focusTourId = tour.id; state.komootUi.focusList = listName; checkbox.checked ? state.selectedKomootTourIds.add(tour.id) : state.selectedKomootTourIds.delete(tour.id); renderKomoot(); }); container.append(frag); }); };
  const byNewest = (left, right) => `${right.date ?? ''}`.localeCompare(`${left.date ?? ''}`);
  const recorded = state.komootTours.filter((tour) => tour.type === 'recorded').sort(byNewest); const planned = state.komootTours.filter((tour) => tour.type === 'planned').sort(byNewest); renderList(el.recordedList, recorded, 'recorded'); renderList(el.plannedList, planned, 'planned'); el.recordedSummary.textContent = recorded.length ? t('komootLoadedSummary', { count: recorded.length }) : t('recordedEmpty'); el.plannedSummary.textContent = planned.length ? t('komootLoadedSummary', { count: planned.length }) : t('plannedEmpty'); el.recordedSelectAllButton.textContent = recorded.length && recorded.every((tour) => state.selectedKomootTourIds.has(tour.id)) ? t('clearSelection') : t('selectAll'); el.plannedSelectAllButton.textContent = planned.length && planned.every((tour) => state.selectedKomootTourIds.has(tour.id)) ? t('clearSelection') : t('selectAll'); restoreKomootListState();
}
function renderProxy() { el.diagProxy.textContent = state.proxy.online ? t('proxyOnline') : t('proxyUnknown'); el.diagMode.textContent = state.proxy.mode ? t(state.proxy.mode === 'stub' ? 'proxyModeStub' : 'proxyModeReal') : t('proxyModeUnknown'); el.diagChecked.textContent = state.proxy.lastCheckAt ? new Date(state.proxy.lastCheckAt).toLocaleString(lang()) : t('lastCheckNever'); el.diagError.textContent = state.proxy.lastError || t('noError'); }
function renderKomootProgress() { const progress = state.komootUi.progress; el.komootProgress.hidden = !progress.active; el.komootProgressLabel.textContent = progress.label || ''; el.komootProgressValue.textContent = progress.indeterminate ? '...' : `${Math.round(progress.value)}%`; if (progress.indeterminate) { el.komootProgressBar.removeAttribute('value'); } else { el.komootProgressBar.value = progress.value; } }
function setKomootProgress(label, value = 0, indeterminate = false) { state.komootUi.progress = { active: true, label, value, indeterminate }; renderKomootProgress(); }
function clearKomootProgress() { state.komootUi.progress = { active: false, label: '', value: 0, indeterminate: false }; renderKomootProgress(); }
function ensureProfileHoverMarker() {
  if (state.profileUi.hoverMarker || !state.map) return state.profileUi.hoverMarker;
  state.profileUi.hoverMarker = L.circleMarker([0, 0], { radius: 7, weight: 3, color: 'rgba(14,18,17,0.95)', fillColor: '#ffffff', fillOpacity: 1, opacity: 1 }).addTo(state.map);
  return state.profileUi.hoverMarker;
}
function clearProfileHover() {
  if (state.profileUi.hoverMarker) state.profileUi.hoverMarker.remove();
  state.profileUi.hoverMarker = null;
  if (!el.profileChart) return;
  const hover = el.profileChart.querySelector('.profile-hover');
  if (hover) hover.innerHTML = '';
  if (el.profileCursorInfo) {
    el.profileCursorInfo.hidden = true;
    el.profileCursorInfo.classList.remove('is-right');
  }
}
function profileSampleFromEvent(event) {
  if (!state.profileUi.samples.length || !state.profileUi.plot || !el.profileChart) return null;
  const rect = el.profileChart.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  const targetKm = (state.profileUi.samples.at(-1)?.cumulativeKm ?? 0) * ratio;
  return state.profileUi.samples.reduce((best, current) => Math.abs(current.cumulativeKm - targetKm) < Math.abs(best.cumulativeKm - targetKm) ? current : best, state.profileUi.samples[0]);
}
function updateProfileHover(sample) {
  const marker = ensureProfileHoverMarker();
  marker.setLatLng([sample.lat, sample.lng]);
  const hover = el.profileChart.querySelector('.profile-hover');
  if (!hover || !state.profileUi.plot) return;
  const x = state.profileUi.plot.x(sample.cumulativeKm);
  const y = state.profileUi.plot.y(sample.ele);
  hover.innerHTML = `<line class="profile-hover-line" x1="${x}" y1="22" x2="${x}" y2="214"></line><line class="profile-hover-line" x1="46" y1="${y}" x2="954" y2="${y}"></line><circle class="profile-hover-dot" cx="${x}" cy="${y}" r="6"></circle>`;
  if (!el.profileCursorInfo) return;
  const ascent = Number.isFinite(sample.cumulativeAscentM) ? Math.round(sample.cumulativeAscentM) : 0;
  const grade = profileGradeAtPoint(state.profileUi.samples, state.profileUi.samples.indexOf(sample));
  el.profileCursorAfter.textContent = `${fmtKm(sample.cumulativeKm)} km (${fmtElapsedShort(sample.cumulativeTimeSec)}, ${gradeArrow(ascent > 0 ? 1 : 0)} ${fmtNum(ascent)} m)`;
  el.profileCursorAltitude.textContent = fmtMeters(sample.ele);
  el.profileCursorGrade.textContent = fmtGrade(grade);
  el.profileCursorInfo.classList.toggle('is-right', x < 280);
  el.profileCursorInfo.hidden = false;
}
function focusProfileSample(sample) {
  if (!sample || !state.map) return;
  updateProfileHover(sample);
  state.map.panTo([sample.lat, sample.lng], { animate: true, duration: 0.35 });
}
function renderProfile() {
  const track = state.selectedTrackIds.has(state.highlightedTrackId)
    ? (state.tracks.find((item) => item.id === state.highlightedTrackId) ?? null)
    : null;
  el.profileTrackName.textContent = track?.name || '-';
  el.profileDistance.textContent = track ? `${fmtKm(track.distanceKm)} km` : '-';
  el.profileElevationRange.textContent = track?.hasElevation ? `${fmtMeters(track.elevationMinM)} - ${fmtMeters(track.elevationMaxM)}` : '-';
  el.profileAscent.textContent = track?.hasElevation ? fmtMeters(track.elevationGainM) : '-';
  el.profileDescent.textContent = track?.hasElevation ? fmtMeters(track.elevationLossM) : '-';
  el.profileAvgSpeed.textContent = track?.avgSpeedKmh != null ? fmtHours(track.avgSpeedKmh) : '-';
  state.profileUi.trackId = track?.id ?? null;
  state.profileUi.samples = [];
  state.profileUi.plot = null;
  clearProfileHover();
  if (!track) {
    el.profileEmpty.hidden = false;
    el.profileEmpty.textContent = t('profileHintNoTrack');
    el.profileChartShell.hidden = true;
    el.profileChart.innerHTML = '';
    return;
  }
  const samples = track.points.filter((point) => point.ele != null);
  if (samples.length < 2) {
    el.profileEmpty.hidden = false;
    el.profileEmpty.textContent = t('profileHintNoElevation');
    el.profileChartShell.hidden = true;
    el.profileChart.innerHTML = '';
    return;
  }
  const minEle = Math.min(...samples.map((point) => point.ele));
  const maxEle = Math.max(...samples.map((point) => point.ele));
  const maxDist = Math.max(track.distanceKm || samples.at(-1)?.cumulativeKm || 0, 0.1);
  const padX = 46;
  const padY = 22;
  const width = 1000;
  const height = 260;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padY * 2 - 24;
  const elevSpan = Math.max(maxEle - minEle, 10);
  const x = (distance) => padX + (distance / maxDist) * plotWidth;
  const y = (elevation) => padY + ((maxEle - elevation) / elevSpan) * plotHeight;
  const linePath = samples.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.cumulativeKm).toFixed(2)} ${y(point.ele).toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L ${x(samples.at(-1).cumulativeKm).toFixed(2)} ${(padY + plotHeight).toFixed(2)} L ${x(samples[0].cumulativeKm).toFixed(2)} ${(padY + plotHeight).toFixed(2)} Z`;
  const photoMarkers = (Array.isArray(track.photos) ? track.photos : []).map((photo, index) => {
    const latLng = photoLatLng(photo);
    const point = nearestTrackPoint(track, latLng);
    if (!point || point.cumulativeKm == null) return '';
    const photoX = x(point.cumulativeKm).toFixed(2);
    return `<g class="profile-photo-marker" data-photo-index="${index}" tabindex="0" role="button" aria-label="${escapeHtml(photo.title || `${track.name} ${index + 1}`)}"><line class="profile-photo-line" x1="${photoX}" y1="22" x2="${photoX}" y2="36"></line><circle class="profile-photo-dot" cx="${photoX}" cy="18" r="7"></circle><text class="profile-photo-icon" x="${photoX}" y="22" text-anchor="middle">📷</text></g>`;
  }).join('');
  const grid = [0, 0.5, 1].map((ratio) => {
    const elevation = maxEle - elevSpan * ratio;
    const lineY = y(elevation);
    return `<line class="profile-grid-line" x1="${padX}" y1="${lineY.toFixed(2)}" x2="${width - padX}" y2="${lineY.toFixed(2)}"></line><text class="profile-axis-text" x="8" y="${(lineY + 6).toFixed(2)}">${Math.round(elevation)} m</text>`;
  }).join('');
  const xTicks = [0, maxDist / 2, maxDist].map((distance, index) => `<text class="profile-axis-text" x="${x(distance).toFixed(2)}" y="${height - 8}" text-anchor="${index === 0 ? 'start' : index === 2 ? 'end' : 'middle'}">${fmtKm(distance)} km</text>`).join('');
  el.profileChart.innerHTML = `${grid}<path class="profile-area" d="${areaPath}" fill="${track.color}"></path><path class="profile-line" d="${linePath}" stroke="${track.color}"></path><g class="profile-photos">${photoMarkers}</g><g class="profile-hover"></g>`;
  el.profileChart.insertAdjacentHTML('beforeend', xTicks);
  el.profileEmpty.hidden = true;
  el.profileChartShell.hidden = false;
  state.profileUi.samples = samples;
  state.profileUi.plot = { x, y };
}
function replayTrackSourceLabel(track) {
  return track?.accountLabel || trackSourceLabel(track?.source);
}
function buildReplayTrack(track) {
  if (!track?.points?.length) return null;
  const samples = track.points.map((point, index, points) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const timeMs = point.time ? parsePointTime(point.time) : null;
    return {
      index,
      lat: point.lat,
      lng: point.lng,
      ele: point.ele ?? null,
      cumulativeKm: point.cumulativeKm ?? (index ? previous.cumulativeKm + haversine(previous, point) : 0),
      timeMs,
      elapsedSec: null,
      bearing: bearingDegrees(previous === point ? point : previous, next === point ? point : next),
      gradePercent: profileGradeAtPoint(points, index),
      pointIndex: index
    };
  });
  const firstTime = samples.find((sample) => sample.timeMs != null)?.timeMs ?? null;
  const rawHasTime = firstTime != null && samples.some((sample) => sample.timeMs != null && sample.timeMs !== firstTime);
  const totalDistanceKm = samples.at(-1)?.cumulativeKm ?? 0;
  const rawDurationSec = rawHasTime ? (Math.max(0, ((samples.at(-1)?.timeMs ?? firstTime) - firstTime) / 1000)) : null;
  const fallbackDurationSec = Number.isFinite(track?.durationHours) && track.durationHours > 0 ? track.durationHours * 3600 : null;
  const shouldUseFallbackDuration = Number.isFinite(fallbackDurationSec) && fallbackDurationSec > 0 && (
    !rawHasTime ||
    !Number.isFinite(rawDurationSec) ||
    rawDurationSec <= 0 ||
    rawDurationSec > 172800 ||
    rawDurationSec > fallbackDurationSec * 4
  );
  const hasTime = rawHasTime || shouldUseFallbackDuration;
  if (shouldUseFallbackDuration && totalDistanceKm > 0) {
    samples.forEach((sample) => {
      sample.elapsedSec = (sample.cumulativeKm / totalDistanceKm) * fallbackDurationSec;
    });
  } else if (rawHasTime) {
    const knownTimedIndexes = samples
      .map((sample, index) => ({ sample, index }))
      .filter(({ sample }) => sample.timeMs != null)
      .map(({ index }) => index);
    samples.forEach((sample) => {
      sample.elapsedSec = sample.timeMs != null ? Math.max(0, (sample.timeMs - firstTime) / 1000) : null;
    });
    for (let anchorIndex = 0; anchorIndex < knownTimedIndexes.length - 1; anchorIndex += 1) {
      const startIndex = knownTimedIndexes[anchorIndex];
      const endIndex = knownTimedIndexes[anchorIndex + 1];
      const startSample = samples[startIndex];
      const endSample = samples[endIndex];
      const distanceSpan = Math.max(0.000001, (endSample.cumulativeKm ?? 0) - (startSample.cumulativeKm ?? 0));
      const timeSpan = Math.max(0, (endSample.elapsedSec ?? 0) - (startSample.elapsedSec ?? 0));
      for (let index = startIndex + 1; index < endIndex; index += 1) {
        const ratio = ((samples[index].cumulativeKm ?? 0) - (startSample.cumulativeKm ?? 0)) / distanceSpan;
        samples[index].elapsedSec = (startSample.elapsedSec ?? 0) + (timeSpan * clamp(ratio, 0, 1));
      }
    }
    const firstKnownIndex = knownTimedIndexes[0];
    for (let index = 0; index < firstKnownIndex; index += 1) {
      samples[index].elapsedSec = samples[firstKnownIndex].elapsedSec ?? 0;
    }
    const lastKnownIndex = knownTimedIndexes.at(-1);
    for (let index = lastKnownIndex + 1; index < samples.length; index += 1) {
      samples[index].elapsedSec = samples[lastKnownIndex].elapsedSec ?? 0;
    }
    let lastElapsed = 0;
    samples.forEach((sample) => {
      sample.elapsedSec = Math.max(lastElapsed, sample.elapsedSec ?? lastElapsed);
      lastElapsed = sample.elapsedSec;
    });
  } else {
    samples.forEach((sample) => {
      sample.elapsedSec = sample.cumulativeKm;
    });
  }
  const photoMarkers = (track.photos ?? []).map((photo, photoIndex) => {
    const latLng = photoLatLng(photo);
    if (!latLng) return null;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    samples.forEach((sample, sampleIndex) => {
      const delta = Math.hypot(sample.lat - latLng[0], sample.lng - latLng[1]);
      if (delta < bestDistance) {
        bestDistance = delta;
        bestIndex = sampleIndex;
      }
    });
    return { photoIndex, sampleIndex: bestIndex, distanceKm: samples[bestIndex]?.cumulativeKm ?? 0 };
  }).filter(Boolean);
  return {
    trackId: track.id,
    track,
    samples,
    totalDistanceKm,
    totalDurationSec: hasTime ? (samples.at(-1)?.elapsedSec ?? 0) : totalDistanceKm,
    totalAscentM: track.elevationGainM ?? 0,
    totalDescentM: track.elevationLossM ?? 0,
    modeAvailable: { time: hasTime, distance: true },
    photoMarkers
  };
}
function interpolateReplaySample(left, right, ratio) {
  const safeRatio = clamp(ratio, 0, 1);
  const lerp = (a, b) => a + (b - a) * safeRatio;
  return {
    lat: lerp(left.lat, right.lat),
    lng: lerp(left.lng, right.lng),
    ele: left.ele != null && right.ele != null ? lerp(left.ele, right.ele) : (left.ele ?? right.ele ?? null),
    cumulativeKm: lerp(left.cumulativeKm, right.cumulativeKm),
    elapsedSec: lerp(left.elapsedSec ?? 0, right.elapsedSec ?? 0),
    bearing: lerp(left.bearing ?? 0, right.bearing ?? 0),
    gradePercent: lerp(left.gradePercent ?? 0, right.gradePercent ?? 0),
    pointIndex: right.pointIndex,
    sampleIndex: left.index
  };
}
function replayFrameAtCursor(replayTrack, mode, cursor) {
  if (!replayTrack?.samples?.length) return null;
  const metric = mode === 'time' && replayTrack.modeAvailable.time ? 'elapsedSec' : 'cumulativeKm';
  const samples = replayTrack.samples;
  const clampedCursor = clamp(cursor, 0, replayMetricMax(replayTrack, mode));
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    if (clampedCursor <= current[metric]) {
      const span = (current[metric] - previous[metric]) || 1;
      const ratio = (clampedCursor - previous[metric]) / span;
      return interpolateReplaySample(previous, current, ratio);
    }
  }
  const last = samples.at(-1);
  return { ...last, sampleIndex: last.index };
}
function replayMetricMax(replayTrack, mode = state.replay.mode) {
  if (!replayTrack) return 0;
  return mode === 'time' && replayTrack.modeAvailable.time ? replayTrack.totalDurationSec : replayTrack.totalDistanceKm;
}
function replayMetricLabel(replayTrack, cursor, mode = state.replay.mode) {
  if (mode === 'time' && replayTrack?.modeAvailable.time) return fmtElapsedShort(cursor);
  return `${fmtKm(cursor)} km`;
}
function replayCursorForMode(replayTrack, targetMode, referenceFrame) {
  if (!replayTrack || !referenceFrame) return 0;
  return targetMode === 'time' && replayTrack.modeAvailable.time
    ? clamp(referenceFrame.elapsedSec ?? 0, 0, replayTrack.totalDurationSec)
    : clamp(referenceFrame.cumulativeKm ?? 0, 0, replayTrack.totalDistanceKm);
}
function replayCandidateTrack() {
  const highlighted = state.tracks.find((track) => track.id === state.highlightedTrackId) ?? null;
  if (highlighted) return highlighted;
  const selected = state.tracks.find((track) => state.selectedTrackIds.has(track.id)) ?? null;
  if (selected) return selected;
  if (state.replay.activeTrackId) return state.tracks.find((track) => track.id === state.replay.activeTrackId) ?? null;
  return null;
}
function replaySeekValueFromDistance(distanceKm) {
  if (!state.replay.replayTrack) return 0;
  if (state.replay.mode !== 'time' || !state.replay.replayTrack.modeAvailable.time) return distanceKm;
  const sample = state.replay.replayTrack.samples.reduce((best, current) => Math.abs(current.cumulativeKm - distanceKm) < Math.abs(best.cumulativeKm - distanceKm) ? current : best, state.replay.replayTrack.samples[0]);
  return sample?.elapsedSec ?? 0;
}
function replayDistanceFromProfileEvent(event) {
  const replayTrack = state.replay.replayTrack;
  if (!replayTrack?.samples?.length || !el.replayProfileChart) return null;
  const rect = el.replayProfileChart.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  return ratio * (replayTrack.totalDistanceKm || 0);
}
function clearReplay2DScene() {
  if (!state.replay.layers2d) return;
  Object.values(state.replay.layers2d).forEach((layer) => {
    if (!layer) return;
    try {
      layer.remove?.();
    } catch {}
  });
  state.replay.layers2d = {};
}
function clearReplay3DScene() {
  if (state.replayMap3dReady && state.replayMap3d) {
    state.replayMap3d.getSource('replay-route')?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
    state.replayMap3d.getSource('replay-played')?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
    state.replayMap3d.getSource('replay-photos')?.setData({ type: 'FeatureCollection', features: [] });
  }
  state.replay.marker3d?.setLngLat([10.4, 51.2]);
}
function clearReplayScene() {
  clearReplay2DScene();
  clearReplay3DScene();
}
function ensureReplayMaps() {
  if (!state.replayMap2d && el.replayMap2d) {
    state.replayMap2d = L.map(el.replayMap2d, { zoomControl: true, attributionControl: true }).setView([51.2, 10.4], 6);
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(state.replayMap2d);
  }
  if (!state.replayMap3d && el.replayMap3d && window.maplibregl) {
    state.replayMap3d = new window.maplibregl.Map({
      container: el.replayMap3d,
      center: [10.4, 51.2],
      zoom: 6,
      pitch: 62,
      bearing: 0,
      maxZoom: 18,
      maxPitch: 85,
      style: {
        version: 8,
        sources: {
          osm: { type: 'raster', tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '&copy; OpenStreetMap Contributors', maxzoom: 19 },
          terrainSource: { type: 'raster-dem', url: 'https://tiles.mapterhorn.com/tilejson.json' },
          hillshadeSource: { type: 'raster-dem', url: 'https://tiles.mapterhorn.com/tilejson.json' }
        },
        layers: [
          { id: 'osm', type: 'raster', source: 'osm' },
          { id: 'hills', type: 'hillshade', source: 'hillshadeSource', layout: { visibility: 'visible' }, paint: { 'hillshade-shadow-color': '#473B24' } }
        ],
        terrain: { source: 'terrainSource', exaggeration: 1.55 },
        sky: {}
      }
    });
    state.replayMap3d.addControl(new window.maplibregl.NavigationControl({ visualizePitch: true, showZoom: true, showCompass: true }));
    state.replayMap3d.on('load', () => {
      state.replayMap3dReady = true;
      ensureReplay3DSources();
      updateReplayScene();
    });
  } else if (!window.maplibregl && el.replayMap3d && !el.replayMap3d.textContent.trim()) {
    el.replayMap3d.innerHTML = `<div class="replay-placeholder-note">${t('replayUnavailable3d')}</div>`;
  }
}
function ensureReplay3DSources() {
  if (!state.replayMap3dReady || !state.replayMap3d) return;
  const map = state.replayMap3d;
  if (!map.getSource('replay-route')) {
    map.addSource('replay-route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });
    map.addLayer({ id: 'replay-route', type: 'line', source: 'replay-route', paint: { 'line-color': '#9ed5b0', 'line-width': 4.5, 'line-opacity': 0.78 } });
  }
  if (!map.getSource('replay-played')) {
    map.addSource('replay-played', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });
    map.addLayer({ id: 'replay-played', type: 'line', source: 'replay-played', paint: { 'line-color': '#ff2a1a', 'line-width': 6, 'line-opacity': 1 } });
  }
  if (!map.getSource('replay-photos')) {
    map.addSource('replay-photos', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'replay-photos', type: 'circle', source: 'replay-photos', paint: { 'circle-radius': 4, 'circle-color': '#f8fbfa', 'circle-stroke-width': 2, 'circle-stroke-color': '#14201d' } });
  }
  if (!state.replay.marker3d) {
    const markerEl = document.createElement('div');
    markerEl.className = 'replay-maplibre-marker';
    state.replay.marker3d = new window.maplibregl.Marker({ element: markerEl }).setLngLat([10.4, 51.2]).addTo(map);
  }
}
function fitReplayMaps(replayTrack) {
  const bounds = trackBounds(replayTrack?.track);
  if (bounds && state.replayMap2d) state.replayMap2d.fitBounds(bounds.pad(0.08));
  if (replayTrack?.samples?.length && state.replayMap3dReady && state.replayMap3d) {
    const coordinates = replayTrack.samples.map((sample) => [sample.lng, sample.lat]);
    const lngLatBounds = coordinates.reduce((acc, coordinate) => acc.extend(coordinate), new window.maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
    state.replayMap3d.fitBounds(lngLatBounds, { padding: 56, pitch: 70, bearing: 12, duration: 0 });
  }
}
function replayPlayedLatLngs(replayTrack, frame) {
  if (!replayTrack || !frame) return [];
  const points = replayTrack.track.points.filter((point) => (point.cumulativeKm ?? 0) <= frame.cumulativeKm).map((point) => [point.lat, point.lng]);
  points.push([frame.lat, frame.lng]);
  return points;
}
function replayRouteCoordinates(replayTrack) {
  return replayTrack?.track?.points?.map((point) => [point.lng, point.lat]) ?? [];
}
function replay2DTarget(replayTrack, frame) {
  if (!replayTrack || !frame) return null;
  if (state.replay.cameraMode2d === 'overview') {
    const bounds = trackBounds(replayTrack.track);
    return { center: bounds ? bounds.getCenter() : L.latLng(frame.lat, frame.lng), zoom: null, bounds };
  }
  if (state.replay.cameraMode2d === 'ahead') {
    const frameIndex = Math.max(0, Math.round(frame.sampleIndex ?? frame.pointIndex ?? 0));
    const lookAheadIndex = Math.min(replayTrack.samples.length - 1, frameIndex + 64);
    const lookAheadSample = replayTrack.samples[lookAheadIndex] ?? frame;
    return {
      center: L.latLng(
        frame.lat + ((lookAheadSample.lat ?? frame.lat) - frame.lat) * 0.9,
        frame.lng + ((lookAheadSample.lng ?? frame.lng) - frame.lng) * 0.9
      ),
      zoom: 13.2,
      bounds: null
    };
  }
  return { center: L.latLng(frame.lat, frame.lng), zoom: 17.5, bounds: null };
}
function applyReplay2DCamera(replayTrack = state.replay.replayTrack, frame = replayFrameAtCursor(state.replay.replayTrack, state.replay.mode, state.replay.cursor), options = {}) {
  const force = !!options.force;
  const animate = !!options.animate;
  if (!state.replayMap2d || !replayTrack || !frame) return;
  if (state.settings.activeWorkspace !== 'replay' || state.replay.view !== '2d') return;
  if (!force && !state.replay.followCamera) return;
  const target = replay2DTarget(replayTrack, frame);
  if (!target) return;
  if (target.bounds) {
    if (!force && state.replay.lastApplied2DMode === 'overview') return;
    state.replayMap2d.fitBounds(target.bounds.pad(0.22), { animate, duration: animate ? 0.45 : 0 });
    state.replay.lastApplied2DMode = 'overview';
    return;
  }
  const map = state.replayMap2d;
  const zoomTarget = target.zoom ?? state.replayMap2d.getZoom();
  const currentZoom = map.getZoom();
  const currentCenter = map.getCenter?.();
  state.replay.lastApplied2DMode = state.replay.cameraMode2d;
  if (!force && currentCenter && Math.abs(currentZoom - zoomTarget) < 0.01) {
    const currentPoint = map.project(currentCenter, currentZoom);
    const targetPoint = map.project(target.center, currentZoom);
    const deltaX = targetPoint.x - currentPoint.x;
    const deltaY = targetPoint.y - currentPoint.y;
    const shiftPx = Math.hypot(deltaX, deltaY);
    const minShiftPx = state.replay.cameraMode2d === 'center' ? 96 : 132;
    if (shiftPx < minShiftPx) return;
    map.panBy([deltaX, deltaY], { animate: false, duration: 0 });
    return;
  }
  map.setView(target.center, zoomTarget, { animate, duration: animate ? 0.45 : 0 });
}
function refreshReplay2DCamera(options = {}) {
  const replayTrack = state.replay.replayTrack;
  const frame = replayFrameAtCursor(replayTrack, state.replay.mode, state.replay.cursor);
  if (!state.replayMap2d || !replayTrack || !frame || state.replay.view !== '2d') return;
  state.replayMap2d.invalidateSize(false);
  applyReplay2DCamera(replayTrack, frame, options);
  window.requestAnimationFrame(() => {
    if (!state.replayMap2d || state.replay.view !== '2d') return;
    state.replayMap2d.invalidateSize(false);
    applyReplay2DCamera(replayTrack, replayFrameAtCursor(replayTrack, state.replay.mode, state.replay.cursor), { ...options, animate: false, force: true });
  });
}
function setReplayCameraMode2d(mode, options = {}) {
  if (!mode) return;
  state.replay.cameraMode2d = mode;
  state.replay.lastApplied2DMode = null;
  state.replay.last2DCameraAppliedAt = 0;
  renderReplayControls();
  refreshReplay2DCamera({ force: true, animate: options.animate !== false });
}
function syncReplay2DScene(replayTrack, frame) {
  if (!state.replayMap2d || !replayTrack || !frame) return;
  const map = state.replayMap2d;
  const routeLatLngs = replayTrack.track.points.map((point) => [point.lat, point.lng]);
  if (!state.replay.layers2d.route) {
    state.replay.layers2d.route = L.polyline(routeLatLngs, { color: '#9ed5b0', weight: 5, opacity: 0.66, lineCap: 'round', lineJoin: 'round' }).addTo(map);
    state.replay.layers2d.played = L.polyline(replayPlayedLatLngs(replayTrack, frame), { color: '#ff2a1a', weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(map);
      state.replay.layers2d.marker = L.marker([frame.lat, frame.lng], { icon: L.divIcon({ className: 'replay-marker-wrap', html: replayMarkerIconHtml(frame.bearing), iconSize: [22, 22], iconAnchor: [11, 11] }), zIndexOffset: 1000 }).addTo(map);
      state.replay.layers2d.photos = L.layerGroup().addTo(map);
    } else {
      state.replay.layers2d.route.setLatLngs(routeLatLngs);
      state.replay.layers2d.played.setLatLngs(replayPlayedLatLngs(replayTrack, frame));
      state.replay.layers2d.marker.setLatLng([frame.lat, frame.lng]);
      state.replay.layers2d.marker.setIcon(L.divIcon({ className: 'replay-marker-wrap', html: replayMarkerIconHtml(frame.bearing), iconSize: [22, 22], iconAnchor: [11, 11] }));
    }
  state.replay.layers2d.route?.bringToBack?.();
  state.replay.layers2d.played?.bringToFront?.();
  state.replay.layers2d.photos?.bringToFront?.();
  state.replay.layers2d.marker?.setZIndexOffset?.(1000);
  state.replay.layers2d.photos.clearLayers();
  if (state.replay.showPhotos) {
    (replayTrack.track.photos ?? []).forEach((photo) => {
      const latLng = photoLatLng(photo);
      if (!latLng) return;
      L.circleMarker(latLng, { radius: 4, color: '#14201d', weight: 2, fillColor: '#f8fbfa', fillOpacity: 1 }).addTo(state.replay.layers2d.photos);
    });
  }
  applyReplay2DCamera(replayTrack, frame, { animate: false });
}
function replay3DCamera(frame) {
  if (!frame) return { pitch: 70, zoom: 13.8, bearing: 0 };
  if (state.replay.cameraMode3d === 'top') return { pitch: 32, zoom: 13.45, bearing: 0 };
  if (state.replay.cameraMode3d === 'orbit') {
    const stableBearing = Number.isFinite(state.replay.replayTrack?.orbitBearing) ? state.replay.replayTrack.orbitBearing : ((frame.bearing ?? 0) + 32) % 360;
    return { pitch: 72, zoom: 14.05, bearing: stableBearing };
  }
  return { pitch: 79, zoom: 14.85, bearing: frame.bearing ?? 0 };
}
function syncReplay3DScene(replayTrack, frame) {
  if (!state.replayMap3dReady || !state.replayMap3d || !replayTrack || !frame) return;
  ensureReplay3DSources();
  const map = state.replayMap3d;
  map.getSource('replay-route')?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: replayRouteCoordinates(replayTrack) } });
  map.getSource('replay-played')?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: replayPlayedLatLngs(replayTrack, frame).map(([lat, lng]) => [lng, lat]) } });
  map.getSource('replay-photos')?.setData({ type: 'FeatureCollection', features: state.replay.showPhotos ? (replayTrack.track.photos ?? []).map((photo) => { const latLng = photoLatLng(photo); return latLng ? { type: 'Feature', geometry: { type: 'Point', coordinates: [latLng[1], latLng[0]] }, properties: {} } : null; }).filter(Boolean) : [] });
  state.replay.marker3d?.setLngLat([frame.lng, frame.lat]);
  if (state.settings.activeWorkspace === 'replay' && state.replay.view === '3d' && state.replay.followCamera) {
    const camera = replay3DCamera(frame);
    map.jumpTo({ center: [frame.lng, frame.lat], bearing: camera.bearing, pitch: camera.pitch, zoom: camera.zoom });
  }
}
function renderReplayControls() {
  const replayTrack = state.replay.replayTrack;
  const hasTrack = !!replayTrack;
  const canUseTime = !!replayTrack?.modeAvailable.time;
  const is2d = state.replay.view === '2d';
  el.replayViewButtons?.forEach((button) => {
    const active = button.dataset.replayView === state.replay.view;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  if (el.replaySpeedSelect) el.replaySpeedSelect.value = String(state.replay.speed);
  el.replayModeButtons?.forEach((button) => {
    const isTime = button.dataset.replayMode === 'time';
    const active = button.dataset.replayMode === state.replay.mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.disabled = !hasTrack || (isTime && !canUseTime);
  });
  if (el.replayCamera2dRow) el.replayCamera2dRow.hidden = !is2d;
  if (el.replayCamera3dRow) el.replayCamera3dRow.hidden = is2d;
  el.replayCamera2dButtons?.forEach((button) => {
    const mode = button.getAttribute('data-replay-camera-2d') || 'center';
    const active = mode === state.replay.cameraMode2d;
    button.classList.toggle('is-active', active);
    button.dataset.active = active ? 'true' : 'false';
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.style.background = active ? 'linear-gradient(135deg, rgba(185, 224, 196, 0.98), rgba(142, 198, 160, 0.82))' : '';
    button.style.borderColor = active ? 'rgba(185, 224, 196, 0.9)' : '';
    button.style.color = active ? '#18302a' : '';
    button.style.boxShadow = active ? 'inset 0 0 0 1px rgba(255, 255, 255, 0.16), 0 10px 20px rgba(8, 16, 14, 0.22)' : '';
  });
  el.replayCameraButtons?.forEach((button) => {
    const active = button.dataset.replayCamera === state.replay.cameraMode3d;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  [el.replayRestartButton, el.replayPlayButton, el.replayPauseButton, el.replayBackButton, el.replayForwardButton, ...el.replayViewButtons, ...el.replayCamera2dButtons, ...el.replayCameraButtons].forEach((button) => {
    if (!button) return;
    button.disabled = !hasTrack;
  });
  el.replayPlayButton?.classList.toggle('is-active', !!state.replay.playing);
  el.replayPauseButton?.classList.toggle('is-active', !state.replay.playing && !!hasTrack);
  if (el.replaySpeedSelect) el.replaySpeedSelect.disabled = !hasTrack;
  if (el.replayFollowCameraInput) el.replayFollowCameraInput.checked = !!state.replay.followCamera;
  if (el.replayShowPhotosInput) el.replayShowPhotosInput.checked = !!state.replay.showPhotos;
  if (el.replayShowProfileInput) el.replayShowProfileInput.checked = !!state.replay.showProfile;
  if (el.replayFollowCameraInput) el.replayFollowCameraInput.disabled = !hasTrack;
  if (el.replayShowPhotosInput) el.replayShowPhotosInput.disabled = !hasTrack;
  if (el.replayShowProfileInput) el.replayShowProfileInput.disabled = !hasTrack;
}
function renderReplayProfile() {
  const replayTrack = state.replay.replayTrack;
  const frame = replayFrameAtCursor(replayTrack, state.replay.mode, state.replay.cursor);
  const visible = !!(replayTrack && replayTrack.track.hasElevation && state.replay.showProfile);
  el.replayProfilePanel.hidden = !state.replay.showProfile;
  el.replayWorkspace?.classList.toggle('is-profile-collapsed', !state.replay.showProfile);
  if (el.replayProfileTrackName) el.replayProfileTrackName.textContent = replayTrack?.track?.name || '-';
  el.replayAscentValue.textContent = replayTrack?.track?.hasElevation ? fmtMeters(replayTrack.track.elevationGainM) : '-';
  el.replayDescentValue.textContent = replayTrack?.track?.hasElevation ? fmtMeters(replayTrack.track.elevationLossM) : '-';
  el.replaySpeedValue.textContent = frame?.elapsedSec > 0 && frame?.cumulativeKm > 0 ? fmtHours((frame.cumulativeKm / frame.elapsedSec) * 3600) : '-';
  el.replayPointValue.textContent = replayTrack && frame ? `${fmtNum(Math.min(replayTrack.samples.length, Math.round(frame.pointIndex ?? 0) + 1))} / ${fmtNum(replayTrack.samples.length)}` : '-';
  el.replayProfileEmpty.hidden = visible;
  el.replayProfileChartShell.hidden = !visible;
  if (!visible) {
    el.replayProfileEmpty.textContent = replayTrack && !replayTrack.track.hasElevation ? t('profileHintNoElevation') : t('replayProfileHint');
    el.replayProfileChart.innerHTML = '';
    return;
  }
  const samples = replayTrack.samples;
  const width = 1000;
  const height = 260;
  const padding = { top: 10, right: 18, bottom: 18, left: 18 };
  const elevations = samples.map((sample) => sample.ele ?? replayTrack.track.elevationMinM ?? 0);
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const span = Math.max(1, max - min);
  const exaggeration = span < 35 ? 1.85 : span < 80 ? 1.55 : span < 180 ? 1.3 : 1.12;
  const mid = (min + max) / 2;
  const midY = padding.top + ((height - padding.top - padding.bottom) / 2);
  const halfPlotHeight = (height - padding.top - padding.bottom) / 2;
  const xFor = (km) => padding.left + (km / Math.max(0.001, replayTrack.totalDistanceKm || 0.001)) * (width - padding.left - padding.right);
  const yFor = (ele) => {
    const normalized = ((ele - mid) / Math.max(span / 2, 1)) * exaggeration;
    const rawY = midY - (normalized * halfPlotHeight);
    return clamp(rawY, padding.top, height - padding.bottom);
  };
  const polyline = samples.map((sample) => `${xFor(sample.cumulativeKm)},${yFor(sample.ele ?? min)}`).join(' ');
  const cursorX = frame ? xFor(frame.cumulativeKm) : padding.left;
  const cursorY = frame ? yFor(frame.ele ?? min) : yFor(min);
  el.replayProfileChart.innerHTML = `
    <line class="profile-grid-line" x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}"></line>
    <polyline class="profile-line" points="${polyline}" stroke="${replayTrack.track.color || '#9ed5b0'}"></polyline>
    <line class="profile-hover-line" x1="${cursorX}" y1="${padding.top}" x2="${cursorX}" y2="${height - padding.bottom}"></line>
    <circle class="profile-hover-dot" cx="${cursorX}" cy="${cursorY}" r="7"></circle>
  `;
}
function renderReplayTimeline() {}
function updateReplayReadouts(replayTrack, frame) {
  el.replayDistanceValue.textContent = frame ? `${fmtKm(frame.cumulativeKm)} km` : '0.0 km';
  el.replayAltitudeValue.textContent = frame?.ele != null ? fmtMeters(frame.ele) : '-';
  el.replayGradeValue.textContent = frame ? fmtGrade(frame.gradePercent) : '-';
  el.replayTimeValue.textContent = frame ? fmtElapsedShort(frame.elapsedSec) : '--:--:--';
}
function renderReplayWorkspace() {
  const replayTrack = state.replay.replayTrack;
  const frame = replayFrameAtCursor(replayTrack, state.replay.mode, state.replay.cursor);
  el.replayMap2d.hidden = state.replay.view !== '2d';
  el.replayMap3d.hidden = state.replay.view !== '3d';
  renderReplayControls();
  if (!replayTrack || !frame) {
    state.replay.playing = false;
    cancelReplayLoop();
    el.replayTrackTitle.textContent = t('replayEmptyTitle');
    el.replayTrackSubtitle.textContent = t('replayEmptySubtitle');
    updateReplayReadouts(null, null);
    renderReplayTimeline();
    renderReplayProfile();
    clearReplayScene();
    return;
  }
  el.replayTrackTitle.textContent = replayTrack?.track?.name || t('replayEmptyTitle');
  if (replayTrack) {
    const sourceLabel = replayTrackSourceLabel(replayTrack.track);
    const accountLabel = replayTrack.track.accountLabel || '';
    const subtitleParts = [sourceLabel, fmtDate(replayTrack.track.dateStart)];
    if (accountLabel && accountLabel !== sourceLabel) subtitleParts.push(accountLabel);
    el.replayTrackSubtitle.textContent = subtitleParts.filter(Boolean).join(' · ');
  } else {
    el.replayTrackSubtitle.textContent = t('replayEmptySubtitle');
  }
  updateReplayReadouts(replayTrack, frame);
  renderReplayTimeline();
  renderReplayProfile();
  updateReplayScene();
}
function updateReplayScene() {
  const replayTrack = state.replay.replayTrack;
  const frame = replayFrameAtCursor(replayTrack, state.replay.mode, state.replay.cursor);
  if (!replayTrack || !frame) {
    clearReplayScene();
    return;
  }
  if (state.replay.view === '2d') syncReplay2DScene(replayTrack, frame);
  if (state.replay.view === '3d') syncReplay3DScene(replayTrack, frame);
}
function cancelReplayLoop() {
  if (state.replay.rafId) cancelAnimationFrame(state.replay.rafId);
  state.replay.rafId = null;
  state.replay.lastFrameAt = 0;
}
function replayTick(timestamp) {
  if (!state.replay.playing || !state.replay.replayTrack) return;
  if (!state.replay.lastFrameAt) state.replay.lastFrameAt = timestamp;
  const deltaSec = (timestamp - state.replay.lastFrameAt) / 1000;
  state.replay.lastFrameAt = timestamp;
  const metricMax = replayMetricMax(state.replay.replayTrack, state.replay.mode);
  const distanceScale = Math.max(0.05, (state.replay.replayTrack.totalDistanceKm || 1) / REPLAY_DISTANCE_SECONDS);
  const increment = state.replay.mode === 'time'
    ? deltaSec * state.replay.speed * REPLAY_TIME_SCALE
    : deltaSec * state.replay.speed * distanceScale;
  state.replay.cursor = clamp(state.replay.cursor + increment, 0, metricMax);
  if (state.replay.cursor >= metricMax) {
    state.replay.playing = false;
    renderReplayWorkspace();
    cancelReplayLoop();
    return;
  }
  const frame = replayFrameAtCursor(state.replay.replayTrack, state.replay.mode, state.replay.cursor);
  updateReplayReadouts(state.replay.replayTrack, frame);
  renderReplayProfile();
  updateReplayScene();
  state.replay.rafId = requestAnimationFrame(replayTick);
}
function setReplayPlaying(playing) {
  if (playing && !state.replay.replayTrack) return;
  state.replay.playing = playing;
  if (!playing) {
    cancelReplayLoop();
    renderReplayControls();
    return;
  }
  cancelReplayLoop();
  renderReplayControls();
  state.replay.rafId = requestAnimationFrame(replayTick);
}
function setReplayCursor(value) {
  state.replay.cursor = clamp(value, 0, replayMetricMax(state.replay.replayTrack, state.replay.mode));
  renderReplayWorkspace();
}
function resetReplayToStart() {
  setReplayPlaying(false);
  setReplayCursor(0);
}
function setReplayMode(mode) {
  const replayTrack = state.replay.replayTrack;
  const referenceFrame = replayFrameAtCursor(replayTrack, state.replay.mode, state.replay.cursor);
  state.replay.mode = mode === 'time' && replayTrack?.modeAvailable.time ? 'time' : 'distance';
  applyReplayModeDefaults(state.replay.mode, state.replay.view);
  state.replay.cursor = replayCursorForMode(replayTrack, state.replay.mode, referenceFrame);
  renderReplayWorkspace();
}
function setReplayView(view) {
  state.replay.view = view === '3d' ? '3d' : '2d';
  state.replay.mode = 'distance';
  applyReplayModeDefaults(state.replay.mode, state.replay.view);
  if (state.replay.view === '3d') {
    state.replay.cameraMode3d = 'follow';
  }
  el.replayMap2d.hidden = state.replay.view !== '2d';
  el.replayMap3d.hidden = state.replay.view !== '3d';
  ensureReplayMaps();
  scheduleMapLayoutRefresh();
  renderReplayWorkspace();
}
async function openReplayTrack(trackId) {
  const track = state.tracks.find((item) => item.id === trackId) ?? replayCandidateTrack();
  if (!track) return;
  ensureReplayMaps();
  state.replay.activeTrackId = trackId;
  state.replay.replayTrack = buildReplayTrack(track);
  if (!state.replay.replayTrack) return;
  state.replay.replayTrack.orbitBearing = (((state.replay.replayTrack.samples ?? []).find((sample) => Number.isFinite(sample?.bearing))?.bearing ?? 0) + 32) % 360;
  state.replay.activeTrackId = track.id;
  state.replay.mode = 'distance';
  state.replay.speed = replayDefaultSpeed(state.replay.view, state.replay.mode);
  state.replay.cameraMode3d = 'follow';
  state.replay.cursor = 0;
  state.replay.playing = false;
  cancelReplayLoop();
  state.settings.activeWorkspace = 'replay';
  await saveSettings();
  renderWorkspace();
  scheduleMapLayoutRefresh();
  fitReplayMaps(state.replay.replayTrack);
  renderReplayWorkspace();
}
function renderAll() { renderI18n(); renderWorkspace(); renderAccounts(); renderLibrary(); renderSelection(); renderRecent(); renderKomoot(); renderProxy(); renderKomootProgress(); renderProfile(); renderReplayWorkspace(); }
function layerStyleForTrack(track, casing = false) {
  const highlighted = state.highlightedTrackId === track.id;
  const baseWeight = Math.max(4, Number(state.settings.trackLineWeight) || 6);
  return casing
    ? { color: highlighted ? TRACK_HIGHLIGHT_CASING : TRACK_CASING_COLOR, weight: highlighted ? baseWeight + 6 : baseWeight + 4, opacity: 0.98, dashArray: null, lineCap: 'round', lineJoin: 'round' }
    : { color: highlighted ? HIGHLIGHT_COLOR : track.color, weight: highlighted ? baseWeight + 2 : baseWeight, opacity: 1, dashArray: track.type === 'planned' ? '10 8' : null, lineCap: 'round', lineJoin: 'round' };
}
function buildTrackDecorations(track) {
  const zoom = state.map?.getZoom?.() ?? 0;
  const { kmStep, arrowStep } = decorationStepsForZoom(zoom);
  const highlighted = state.highlightedTrackId === track.id;
  const color = highlighted ? HIGHLIGHT_COLOR : track.color;
  const kmLayer = L.layerGroup();
  const arrowLayer = L.layerGroup();
  if (kmStep && highlighted) {
    for (let markerKm = kmStep; markerKm < (track.distanceKm ?? 0); markerKm += kmStep) {
      const sample = sampleAlongTrack(track.points, markerKm);
      if (!sample) continue;
      L.marker([sample.lat, sample.lng], {
        interactive: false,
        icon: L.divIcon({ className: 'km-marker-wrap', html: markerIconHtml(Math.round(markerKm), color, highlighted), iconSize: [34, 24], iconAnchor: [17, 12] })
      }).addTo(kmLayer);
    }
  }
  if (arrowStep) {
    const offset = kmStep ? 0.5 : Math.max(0.5, arrowStep / 2);
    for (let arrowKm = offset; arrowKm < (track.distanceKm ?? 0); arrowKm += arrowStep) {
      const sample = sampleAlongTrack(track.points, arrowKm);
      if (!sample) continue;
      L.marker([sample.lat, sample.lng], {
        interactive: false,
        icon: L.divIcon({ className: 'track-arrow-wrap', html: arrowIconHtml(color, sample.bearing, highlighted), iconSize: [18, 18], iconAnchor: [9, 9] })
      }).addTo(arrowLayer);
    }
  }
  return { kmLayer, arrowLayer };
}
function updateTrackDecorations(trackId) {
  const track = state.tracks.find((item) => item.id === trackId);
  const entry = state.layers.get(trackId);
  if (!track || !entry || state.settings.photoOverlayOnly || !entry.line) return;
  entry.group.removeLayer(entry.kmLayer);
  entry.group.removeLayer(entry.arrowLayer);
  const { kmLayer, arrowLayer } = buildTrackDecorations(track);
  entry.kmLayer = kmLayer;
  entry.arrowLayer = arrowLayer;
  entry.group.addLayer(kmLayer);
  entry.group.addLayer(arrowLayer);
}
function updateTrackLayerStyle(trackId) {
  if (!state.tracks.find((item) => item.id === trackId)) return;
  syncMap();
}
function exportTrackGpx(trackId) {
  const track = state.tracks.find((item) => item.id === trackId);
  if (!track?.gpxText) return;
  downloadBlob(`${sanitizeFileName(track.name)}.gpx`, new Blob([track.gpxText], { type: 'application/gpx+xml' }));
}
function setHighlightedTrack(trackId) { state.highlightedTrackId = trackId; syncMap(); renderProfile(); }
function initMap() {
  state.map = L.map('map', { zoomControl: true }).setView([51.2, 10.4], 6);
  L.tileLayer(TILE_URL, { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(state.map);
  state.map.on('zoomend', () => state.tracks.forEach((track) => updateTrackDecorations(track.id)));
}
function trackBounds(track) {
  const latLngs = track?.points?.map((point) => [point.lat, point.lng]).filter((point) => point.every(Number.isFinite));
  return latLngs?.length ? L.latLngBounds(latLngs) : null;
}
function syncMap() {
  for (const entry of state.layers.values()) {
    entry.group.remove();
  }
  state.layers.clear();
  const active = new Set(state.selectedTrackIds);
  const photoOnlyMode = !!state.settings.photoOverlayOnly;
  state.tracks.forEach((track) => {
    if (!active.has(track.id)) return;
    const latLngs = track.points.map((point) => [point.lat, point.lng]);
    const layers = [];
    let casing = null;
    let line = null;
    let kmLayer = L.layerGroup();
    let arrowLayer = L.layerGroup();
    const decorationLayers = buildTrackDecorations(track);
    kmLayer = decorationLayers.kmLayer;
    arrowLayer = decorationLayers.arrowLayer;
    const photoLayer = buildTrackPhotoLayer(track);
    if (!photoOnlyMode) {
      casing = L.polyline(latLngs, layerStyleForTrack(track, true));
      line = L.polyline(latLngs, layerStyleForTrack(track, false)).bindPopup(`<strong>${track.name}</strong><br>${fmtKm(track.distanceKm)} km`);
      line.on('click', (event) => { L.DomEvent.stopPropagation(event); setHighlightedTrack(track.id); });
      casing.on('click', (event) => { L.DomEvent.stopPropagation(event); setHighlightedTrack(track.id); });
      layers.push(casing, line, kmLayer, arrowLayer);
      if (state.highlightedTrackId === track.id) layers.push(photoLayer);
    } else if (photoLayer.getLayers().length) {
      layers.push(photoLayer);
    }
    const group = L.layerGroup(layers).addTo(state.map);
    state.layers.set(track.id, { group, casing, line, kmLayer, arrowLayer, photoLayer });
  });
}
function fitSelection() {
  const bounds = state.tracks.filter((track) => state.selectedTrackIds.has(track.id)).map(trackBounds).filter(Boolean);
  if (!bounds.length) return;
  const merged = bounds.reduce((acc, current) => acc ? acc.extend(current) : current, null);
  if (merged) state.map.fitBounds(merged.pad(0.08));
}
function activeTrackNavigationOrder() {
  return state.tracks.filter((track) => state.selectedTrackIds.has(track.id));
}
function stepTrackSelection(offset) {
  const tracks = activeTrackNavigationOrder();
  if (!tracks.length) return;
  const currentIndex = Math.max(0, tracks.findIndex((track) => track.id === state.highlightedTrackId));
  const fallbackIndex = state.highlightedTrackId ? currentIndex : (offset > 0 ? -1 : 0);
  const nextIndex = (fallbackIndex + offset + tracks.length) % tracks.length;
  focusTrack(tracks[nextIndex].id);
}
function focusTrack(trackId) {
  if (!state.layers.has(trackId)) {
    state.selectedTrackIds.add(trackId);
    renderLibrary();
    renderSelection();
    syncMap();
  }
  setHighlightedTrack(trackId);
  const entry = state.layers.get(trackId);
  if (entry) {
    const bounds = entry.line?.getBounds?.() || trackBounds(state.tracks.find((track) => track.id === trackId));
    if (bounds) state.map.fitBounds(bounds.pad(0.08));
    entry.line?.openPopup();
  }
  renderProfile();
}
async function deleteTracks(trackIds) { for (const trackId of trackIds) { await del(STORES.tracks, trackId); state.selectedTrackIds.delete(trackId); } state.tracks = state.tracks.filter((track) => !trackIds.includes(track.id)); if (trackIds.includes(state.replay.activeTrackId)) { state.replay.activeTrackId = null; state.replay.replayTrack = null; setReplayPlaying(false); } renderAll(); syncMap(); setStatus(t('statusDeleted')); }

async function importTrackRecords(records, replaceExisting = false) {
  const existing = new Map(state.tracks.map((track) => [track.signature, track])); const incoming = []; let duplicates = 0;
  records.forEach((record) => { const dupe = existing.get(record.signature); if (dupe && !replaceExisting) { duplicates += 1; return; } if (dupe && replaceExisting) record.id = dupe.id; incoming.push(record); });
  if (!incoming.length && duplicates) { setStatus(t('duplicateTracksSkipped', { count: duplicates })); return { imported: 0, duplicates }; }
  await putMany(STORES.tracks, incoming); const map = new Map(incoming.map((track) => [track.id, track])); state.tracks = state.tracks.filter((track) => !map.has(track.id)).concat(incoming).sort((a, b) => (b.importedAt ?? '').localeCompare(a.importedAt ?? '')); incoming.forEach((track) => state.selectedTrackIds.add(track.id)); incoming.forEach((track) => { const entry = state.layers.get(track.id); if (!entry) return; entry.group.remove(); state.layers.delete(track.id); }); if (state.replay.activeTrackId) { const updatedReplayTrack = state.tracks.find((track) => track.id === state.replay.activeTrackId) || incoming.find((track) => track.id === state.replay.activeTrackId) || null; state.replay.replayTrack = updatedReplayTrack ? buildReplayTrack(updatedReplayTrack) : null; } renderAll(); syncMap(); fitSelection(); setStatus(duplicates ? `${t('statusImported')} · ${t('duplicateTracksSkipped', { count: duplicates })}` : t('statusImported')); return { imported: incoming.length, duplicates };
}
function normalizeBackupTrack(track) {
  const normalized = {
    ...track,
    id: track.id || id('track'),
    importedAt: track.importedAt || isoNow(),
    lastChanged: trackLastChanged(track) || track.importedAt || isoNow(),
    signature: track.signature || signature(track),
    description: normalizeTrackDescription(track.description),
    dateStart: normalizeTrackDate(track.dateStart),
    photos: normalizePhotos(track.photos),
    color: track.color || defaultTrackColor(track)
  };
  return enrichTrackMetrics(normalized);
}
async function importTourBackupRecords(records) {
  const existingById = new Map(state.tracks.map((track) => [track.id, track]));
  const existingBySignature = new Map(state.tracks.map((track) => [track.signature, track]));
  const incoming = [];
  let duplicates = 0;
  let skippedConflicts = 0;
  for (const rawTrack of records) {
    const track = normalizeBackupTrack(rawTrack);
    const existingSameId = existingById.get(track.id);
    if (existingSameId) {
      const incomingStamp = Date.parse(trackLastChanged(track) || '') || 0;
      const existingStamp = Date.parse(trackLastChanged(existingSameId) || '') || 0;
      const key = incomingStamp > existingStamp ? 'confirmBackupOverwriteNewer' : 'confirmBackupOverwriteOlder';
      const shouldOverwrite = await confirmAction(t(key, { name: track.name || existingSameId.name || t('unnamedTrack') }));
      if (!shouldOverwrite) {
        skippedConflicts += 1;
        continue;
      }
      incoming.push({ ...track, id: existingSameId.id, signature: signature(track) });
      continue;
    }
    const dupe = existingBySignature.get(track.signature);
    if (dupe) {
      duplicates += 1;
      continue;
    }
    incoming.push(track);
  }
  if (!incoming.length && (duplicates || skippedConflicts)) {
    const pieces = [];
    if (duplicates) pieces.push(t('duplicateTracksSkipped', { count: duplicates }));
    if (skippedConflicts) pieces.push(`${skippedConflicts} Konflikte uebersprungen`);
    setStatus(pieces.join(' · '));
    return { imported: 0, duplicates, skippedConflicts };
  }
  await putMany(STORES.tracks, incoming);
  const map = new Map(incoming.map((track) => [track.id, track]));
  state.tracks = state.tracks.filter((track) => !map.has(track.id)).concat(incoming).sort((a, b) => (b.importedAt ?? '').localeCompare(a.importedAt ?? ''));
  incoming.forEach((track) => state.selectedTrackIds.add(track.id));
  incoming.forEach((track) => {
    const entry = state.layers.get(track.id);
    if (!entry) return;
    entry.group.remove();
    state.layers.delete(track.id);
  });
  if (state.replay.activeTrackId) {
    const updatedReplayTrack = state.tracks.find((track) => track.id === state.replay.activeTrackId) || null;
    state.replay.replayTrack = updatedReplayTrack ? buildReplayTrack(updatedReplayTrack) : null;
  }
  renderAll();
  syncMap();
  fitSelection();
  const pieces = [t('tourBackupImported')];
  if (duplicates) pieces.push(t('duplicateTracksSkipped', { count: duplicates }));
  if (skippedConflicts) pieces.push(`${skippedConflicts} Konflikte uebersprungen`);
  setStatus(pieces.join(' · '));
  return { imported: incoming.length, duplicates, skippedConflicts };
}
async function importLocalFiles(files) { const records = []; for (const file of files) records.push(buildTrackRecord({ gpxText: await file.text(), fileName: file.name, source: 'local', type: 'unknown', account: null })); await importTrackRecords(records); }

async function proxyRequest(path, options = {}) { const response = await fetch(`${PROXY_URL}${path}`, { method: options.method ?? 'GET', headers: options.body ? { 'Content-Type': 'application/json' } : {}, body: options.body ? JSON.stringify(options.body) : undefined }); const payload = await response.json().catch(() => null); if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`); return payload; }
async function ensureProxyAccountLogin(account) { if (!account) throw new Error(t('accountRequired')); await proxyRequest('/login', { method: 'POST', body: { email: account.email, password: account.password } }); }
async function checkProxy() { try { const payload = await proxyRequest('/health'); state.proxy = { ...state.proxy, online: true, mode: payload.mode ?? null, lastCheckAt: payload.serverTime || new Date().toISOString(), lastError: null }; renderProxy(); setKomootStatus(t('proxyOnline')); return true; } catch (error) { state.proxy = { ...state.proxy, online: false, lastCheckAt: new Date().toISOString(), lastError: error.message }; renderProxy(); setKomootStatus(t('proxyOffline'), true); return false; } }
async function saveAccount() { const email = el.accountEmailInput.value.trim(); const password = el.accountPasswordInput.value; if (!email || !password) return; if (!await checkProxy()) return; try { const payload = await proxyRequest('/login', { method: 'POST', body: { email, password } }); const current = state.accounts.find((account) => account.email.toLowerCase() === email.toLowerCase()); const account = { id: current?.id ?? id('account'), email, password, label: payload.user?.name || email.split('@')[0] || t('accountLabelFallback'), remoteUserId: payload.user?.id ?? null, updatedAt: new Date().toISOString() }; await put(STORES.accounts, account); state.accounts = state.accounts.filter((item) => item.id !== account.id).concat(account).sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')); state.settings.activeAccountId = account.id; await saveSettings(); el.accountDialog.close(); el.accountEmailInput.value = ''; el.accountPasswordInput.value = ''; renderAll(); setStatus(t('accountStored')); setKomootStatus(t('connectedAs', { name: account.label })); } catch (error) { state.proxy.lastError = error.message; renderProxy(); setStatus(t('accountLoginFailed'), true); } }
async function loadKomootTours() { const account = state.accounts.find((item) => item.id === (el.komootAccountSelect.value || state.settings.activeAccountId)); if (!account) { setKomootStatus(t('accountRequired'), true); return; } state.settings.activeAccountId = account.id; await saveSettings(); if (!await checkProxy()) return; try { setKomootProgress(komootProgressText().loadingTours, 20, true); await ensureProxyAccountLogin(account); setKomootProgress(komootProgressText().loadingTours, 55, true); const payload = await proxyRequest('/tours'); setKomootProgress(komootProgressText().loadingTours, 100, false); state.komootTours = (payload.tours ?? []).map((tour) => ({ ...tour, type: trackType(tour.type), dateStart: tour.date || null, accountId: account.id, accountEmail: account.email, accountLabel: account.label })); state.selectedKomootTourIds = new Set(); renderKomoot(); setKomootStatus(t('komootLoadedSummary', { count: state.komootTours.length })); window.setTimeout(clearKomootProgress, 500); } catch (error) { clearKomootProgress(); state.proxy.lastError = error.message; renderProxy(); setKomootStatus(error.message, true); } }
async function importKomootSelection() { if (!state.komootTours.length) { setKomootStatus(t('loadToursFirst'), true); return; } const ids = [...state.selectedKomootTourIds]; if (!ids.length) { setKomootStatus(t('selectToursFirst'), true); return; } const account = activeAccount(); if (!account) { setKomootStatus(t('accountRequired'), true); return; } if (!await checkProxy()) return; try { setKomootProgress(komootProgressText().importing, 15, true); await ensureProxyAccountLogin(account); const payload = await proxyRequest('/import', { method: 'POST', body: { language: lang(), tourIds: ids } }); setKomootProgress(komootProgressText().importing, 80, true); const toursById = new Map(state.komootTours.map((tour) => [tour.id, tour])); const records = payload.items.map((item) => { const summary = toursById.get(item.id); return buildTrackRecord({ gpxText: item.gpx, fileName: item.fileName, source: 'komoot', type: summary?.type || 'unknown', account: { ...account, sourceTrackId: item.id }, description: item.description || null, photos: item.photos || null, meta: { dateStart: item.dateStart || summary?.dateStart || summary?.date || null, durationHours: item.durationHours ?? null, sport: item.sport || summary?.sport || null, surfaces: item.surfaces || null, wayTypes: item.wayTypes || null } }); }); const result = await importTrackRecords(records, true); setKomootProgress(komootProgressText().done, 100, false); setKomootStatus(t('komootImported', { count: result.imported })); window.setTimeout(clearKomootProgress, 500); } catch (error) { clearKomootProgress(); state.proxy.lastError = error.message; renderProxy(); setKomootStatus(error.message, true); } }

function downloadBlob(name, blob) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }
function downloadJson(name, payload) { const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); downloadBlob(name, blob); }
async function gzipJsonBlob(payload) {
  const json = JSON.stringify(payload, null, 2);
  if (typeof CompressionStream === 'undefined') {
    return new Blob([json], { type: 'application/json' });
  }
  const stream = new Blob([json], { type: 'application/json' }).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}
async function readJsonFile(file) {
  const isGzip = /\.gz$/i.test(file.name) || /gzip/i.test(file.type);
  if (!isGzip) return JSON.parse(await file.text());
  if (typeof DecompressionStream === 'undefined') return JSON.parse(await file.text());
  const stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}
function exportAppBackup() { downloadJson(t('backupFileName'), { kind: 'gpx-bibliothek-backup', version: 1, appVersion: CURRENT_VERSION_INFO.appVersion, cacheVersion: CURRENT_VERSION_INFO.cacheVersion, exportedAt: new Date().toISOString(), settings: state.settings, accounts: state.accounts }); }
async function exportTourBackup() {
  const tracks = state.tracks.map((track) => ({
    ...track,
    lastChanged: trackLastChanged(track) || track.importedAt || isoNow()
  }));
  const blob = await gzipJsonBlob({ kind: 'gpx-bibliothek-touren', version: 1, appVersion: CURRENT_VERSION_INFO.appVersion, cacheVersion: CURRENT_VERSION_INFO.cacheVersion, exportedAt: new Date().toISOString(), tracks });
  downloadBlob(t('tourBackupFileName'), blob);
}
async function importAppBackup(file) { if (!await confirmAction(t('confirmImportBackup'))) return; const payload = await readJsonFile(file); if (payload.kind !== 'gpx-bibliothek-backup' || !Array.isArray(payload.accounts)) throw new Error(t('invalidBackup')); const merged = new Map(state.accounts.map((account) => [account.email.toLowerCase(), account])); payload.accounts.forEach((account) => merged.set(account.email.toLowerCase(), { ...account, id: account.id || id('account'), updatedAt: account.updatedAt || new Date().toISOString() })); state.accounts = [...merged.values()].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')); await putMany(STORES.accounts, state.accounts); state.settings = { ...state.settings, ...(payload.settings ?? {}) }; await saveSettings(); renderAll(); setStatus(t('backupImported')); }
async function importTourBackup(file) { if (!await confirmAction(t('confirmImportTours'))) return; const payload = await readJsonFile(file); if (payload.kind !== 'gpx-bibliothek-touren' || !Array.isArray(payload.tracks)) throw new Error(t('invalidBackup')); await importTourBackupRecords(payload.tracks); }
function selectAllKomootTours(listName) { const ids = state.komootTours.filter((tour) => tour.type === listName).map((tour) => tour.id); const allSelected = ids.length > 0 && ids.every((tourId) => state.selectedKomootTourIds.has(tourId)); if (allSelected) { ids.forEach((tourId) => state.selectedKomootTourIds.delete(tourId)); state.komootUi.focusTourId = null; } else { ids.forEach((tourId) => state.selectedKomootTourIds.add(tourId)); state.komootUi.focusTourId = ids[0] ?? null; } state.komootUi.focusList = listName; state.komootUi.scrollTopByList[listName] = 0; renderKomoot(); }

async function loadState() { state.db = await openDb(); state.tracks = (await all(STORES.tracks)).map((track) => enrichTrackMetrics({ ...track, description: normalizeTrackDescription(track.description), dateStart: normalizeTrackDate(track.dateStart), photos: normalizePhotos(track.photos), color: track.color || defaultTrackColor(track), lastChanged: trackLastChanged(track) || track.importedAt || isoNow() })).sort((a, b) => (b.importedAt ?? '').localeCompare(a.importedAt ?? '')); state.accounts = (await all(STORES.accounts)).sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')); const settings = await all(STORES.settings); state.settings = { ...state.settings, ...(settings[0] ?? {}) }; if (!['library', 'komoot', 'replay'].includes(state.settings.activeWorkspace)) state.settings.activeWorkspace = 'library'; applyPaneWidths(); if (!state.settings.activeAccountId && state.accounts[0]) { state.settings.activeAccountId = state.accounts[0].id; await saveSettings(); } }
function bindEvents() {
  el.workspaceButtons.forEach((button) => button.addEventListener('click', async () => {
    state.settings.activeWorkspace = button.dataset.workspace;
    await saveSettings();
    if (state.settings.activeWorkspace === 'replay') {
      const candidate = replayCandidateTrack();
      if (candidate) {
        await openReplayTrack(candidate.id);
        return;
      }
    }
    renderWorkspace();
    if (state.settings.activeWorkspace === 'komoot') await checkProxy();
    if (state.settings.activeWorkspace === 'replay') renderReplayWorkspace();
  }));
  el.settingsButton.addEventListener('click', () => el.settingsDialog.showModal());
  el.helpButton?.addEventListener('click', () => {
    el.helpDialog.showModal();
    void loadReadmeContent();
  });
  el.checkUpdatesButton?.addEventListener('click', async () => {
    await checkForUpdates();
  });
  el.reloadAppButton?.addEventListener('click', async () => {
    await performAppReload();
  });
  el.toggleSidebarCompactButton?.addEventListener('click', async () => {
    state.settings.sidebarCompact = !state.settings.sidebarCompact;
    applyPaneWidths();
    renderPaneCompactButtons();
    await saveSettings();
    scheduleMapLayoutRefresh();
  });
  el.toggleLibraryCompactButton?.addEventListener('click', async () => {
    state.settings.libraryCompact = !state.settings.libraryCompact;
    applyPaneWidths();
    renderPaneCompactButtons();
    await saveSettings();
    scheduleMapLayoutRefresh();
  });
  document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog)?.close()));
  el.addAccountButton.addEventListener('click', () => el.accountDialog.showModal());
  el.saveAccountButton.addEventListener('click', saveAccount);
  el.fileInput.addEventListener('change', async (event) => {
    const files = [...event.target.files];
    if (files.length) await importLocalFiles(files);
    event.target.value = '';
  });
  el.librarySearchInput.addEventListener('input', renderLibrary);
  el.libraryTypeFilter.addEventListener('change', renderLibrary);
  el.librarySportFilter.addEventListener('change', renderLibrary);
  el.libraryMetaFilter.addEventListener('change', renderLibrary);
  el.librarySortSelect.addEventListener('change', renderLibrary);
  el.fitAllButton.addEventListener('click', fitSelection);
  el.mapPhotoModeButton?.addEventListener('click', async () => {
    state.settings.photoOverlayOnly = !state.settings.photoOverlayOnly;
    await saveSettings();
    renderMapPhotoModeButton();
    syncMap();
  });
  el.prevTrackButton?.addEventListener('click', () => stepTrackSelection(-1));
  el.nextTrackButton?.addEventListener('click', () => stepTrackSelection(1));
  el.resizeHandles.forEach((handle) => handle.addEventListener('pointerdown', (event) => {
    handle.setPointerCapture?.(event.pointerId);
    beginPaneResize(handle.dataset.resizeHandle, event.clientX);
  }));
  window.addEventListener('pointermove', (event) => updatePaneResize(event.clientX));
  window.addEventListener('pointerup', endPaneResize);
  window.addEventListener('pointercancel', endPaneResize);
  window.addEventListener('resize', scheduleMapLayoutRefresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSilentUpdateCheck();
  });
  window.addEventListener('focus', scheduleSilentUpdateCheck);
  el.libraryToggleSelectionButton.addEventListener('click', () => {
    if (allFilteredSelected()) {
      filteredTracks().forEach((track) => state.selectedTrackIds.delete(track.id));
    } else {
      filteredTracks().forEach((track) => state.selectedTrackIds.add(track.id));
    }
    renderAll();
    syncMap();
  });
  el.komootAccountSelect.addEventListener('change', async (event) => {
    state.settings.activeAccountId = event.target.value || null;
    await saveSettings();
    renderAccounts();
  });
  el.komootLoadButton.addEventListener('click', loadKomootTours);
  el.komootImportButton.addEventListener('click', importKomootSelection);
  el.recordedSelectAllButton.addEventListener('click', () => selectAllKomootTours('recorded'));
  el.plannedSelectAllButton.addEventListener('click', () => selectAllKomootTours('planned'));
  el.replayViewButtons.forEach((button) => button.addEventListener('click', () => setReplayView(button.dataset.replayView)));
  el.replaySpeedSelect?.addEventListener('change', () => {
    state.replay.speed = Number(el.replaySpeedSelect.value) || 1;
    renderReplayControls();
  });
  el.replayModeButtons.forEach((button) => button.addEventListener('click', () => setReplayMode(button.dataset.replayMode)));
  el.replayCamera2dButtons.forEach((button) => button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const mode = button.getAttribute('data-replay-camera-2d') || 'center';
    setReplayCameraMode2d(mode, { animate: true });
  }));
  el.replayCameraButtons.forEach((button) => button.addEventListener('click', () => { state.replay.cameraMode3d = button.dataset.replayCamera || 'orbit'; renderReplayControls(); updateReplayScene(); }));
  el.replayRestartButton?.addEventListener('click', resetReplayToStart);
  el.replayPlayButton?.addEventListener('click', () => setReplayPlaying(true));
  el.replayPauseButton?.addEventListener('click', () => setReplayPlaying(false));
  el.replayBackButton?.addEventListener('click', () => setReplayCursor(state.replay.cursor - Math.max(0.5, replayMetricMax(state.replay.replayTrack, state.replay.mode) / 40)));
  el.replayForwardButton?.addEventListener('click', () => setReplayCursor(state.replay.cursor + Math.max(0.5, replayMetricMax(state.replay.replayTrack, state.replay.mode) / 40)));
  el.replayFollowCameraInput?.addEventListener('change', () => {
    state.replay.followCamera = el.replayFollowCameraInput.checked;
    renderReplayControls();
    if (state.replay.followCamera) {
      state.replay.lastApplied2DMode = null;
      refreshReplay2DCamera({ force: true, animate: false });
    }
    updateReplayScene();
  });
  el.replayShowPhotosInput?.addEventListener('change', () => { state.replay.showPhotos = el.replayShowPhotosInput.checked; renderReplayControls(); updateReplayScene(); renderReplayTimeline(); });
  el.replayShowProfileInput?.addEventListener('change', () => {
    state.replay.showProfile = el.replayShowProfileInput.checked;
    renderReplayWorkspace();
    scheduleMapLayoutRefresh();
  });
  window.addEventListener('pointerdown', (event) => {
    const replayOptionsMenu = document.querySelector('.replay-options-menu');
    if (!replayOptionsMenu?.hasAttribute('open')) return;
    if (event.target instanceof Node && replayOptionsMenu.contains(event.target)) return;
    replayOptionsMenu.removeAttribute('open');
  });
  el.replayProfileChart?.addEventListener('click', (event) => {
    const distanceKm = replayDistanceFromProfileEvent(event);
    if (distanceKm == null) return;
    setReplayCursor(replaySeekValueFromDistance(distanceKm));
  });
  el.exportBackupButton.addEventListener('click', exportAppBackup);
  el.exportTourBackupButton.addEventListener('click', exportTourBackup);
  el.settingsExportTourBackupButton.addEventListener('click', exportTourBackup);
  el.backupInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (file) try { await importAppBackup(file); } catch (error) { setStatus(error.message, true); }
    event.target.value = '';
  });
  el.tourBackupInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (file) try { await importTourBackup(file); } catch (error) { setStatus(error.message, true); }
    event.target.value = '';
  });
  el.languageSelect.addEventListener('change', async (event) => {
    state.settings.language = event.target.value;
    await saveSettings();
    renderAll();
  });
  el.trackWidthInput?.addEventListener('input', async (event) => {
    state.settings.trackLineWeight = Number(event.target.value);
    renderTrackWidthControl();
    syncMap();
    await saveSettings();
  });
  el.profileChart?.addEventListener('pointermove', (event) => {
    const sample = profileSampleFromEvent(event);
    if (sample) updateProfileHover(sample);
  });
  el.profileChart?.addEventListener('click', (event) => {
    const photoMarker = event.target instanceof Element ? event.target.closest('.profile-photo-marker') : null;
    const track = state.tracks.find((item) => item.id === state.profileUi.trackId);
    if (photoMarker && track) {
      const index = Number(photoMarker.getAttribute('data-photo-index'));
      if (Number.isInteger(index)) openPhotoDialog(track, index);
      return;
    }
    const sample = profileSampleFromEvent(event);
    if (sample) focusProfileSample(sample);
  });
  el.profileChart?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const photoMarker = event.target instanceof Element ? event.target.closest('.profile-photo-marker') : null;
    const track = state.tracks.find((item) => item.id === state.profileUi.trackId);
    if (!photoMarker || !track) return;
    event.preventDefault();
    const index = Number(photoMarker.getAttribute('data-photo-index'));
    if (Number.isInteger(index)) openPhotoDialog(track, index);
  });
  el.profileChart?.addEventListener('pointerleave', clearProfileHover);
  el.photoDialogPrev?.addEventListener('click', () => stepPhotoDialog(-1));
  el.photoDialogNext?.addEventListener('click', () => stepPhotoDialog(1));
  el.photoDialogClose?.addEventListener('click', () => el.photoDialog.close());
  el.photoDialogStage?.addEventListener('pointerdown', (event) => {
    state.photoDialogUi.swipeStartX = event.clientX;
  });
  el.photoDialogStage?.addEventListener('pointerup', (event) => {
    if (state.photoDialogUi.swipeStartX == null) return;
    const delta = event.clientX - state.photoDialogUi.swipeStartX;
    state.photoDialogUi.swipeStartX = null;
    if (Math.abs(delta) < 40) return;
    stepPhotoDialog(delta < 0 ? 1 : -1);
  });
  el.photoDialog?.addEventListener('click', (event) => {
    if (event.target === el.photoDialog) el.photoDialog.close();
  });
  el.photoDialog?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      stepPhotoDialog(-1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      stepPhotoDialog(1);
    }
  });
  el.photoDialog?.addEventListener('close', () => {
    state.photoDialogUi.swipeStartX = null;
  });
  state.map?.on('click', () => {
    setHighlightedTrack(null);
    renderProfile();
  });
  state.map?.on('zoomend', renderSelection);
  state.map?.on('moveend', renderSelection);
  state.map?.on('resize', renderSelection);
}
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    setUpdateStatus(t('statusNoSupport'), false, true);
    return;
  }
  try {
    serviceWorkerRegistration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    await navigator.serviceWorker.ready;
    await checkForUpdates({ showChecking: false, silentNoChange: true, silentError: true });
  } catch (error) {
    console.error(error);
    setUpdateStatus(t('statusSwRegisterFailed', { message: error.message }), false, true);
  }
}
async function init() { await loadState(); applyPaneWidths(); renderI18n(); initMap(); bindEvents(); renderAll(); syncMap(); fitSelection(); scheduleMapLayoutRefresh(); setStatus(t('statusReady')); setKomootStatus(t('statusProxyRequired')); await registerServiceWorker(); if (state.settings.activeWorkspace === 'komoot') await checkProxy(); }
init().catch((error) => { console.error(error); setStatus(error.message || t('statusError'), true); });

