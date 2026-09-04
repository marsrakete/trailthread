import { translations } from "./translations.js";

const DB_NAME = "gpx-bibliothek";
const DB_VERSION = 4;
const STORES = { tracks: "tracks", photos: "photos", accounts: "accounts", settings: "settings" };
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const LOCAL_PROXY_ORIGIN = "http://localhost:8787";
const PROXY_PATH = "/api/komoot";
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
const TRAILTHREAD_CONFIG = Object.freeze(globalThis.TRAILTHREAD_CONFIG || {});
const REPLAY_TIME_SCALE = 1;
const LIBRARY_DESCRIPTION_PREVIEW_LENGTH = 300;
const LIBRARY_DESCRIPTION_MAX_LENGTH = 5000;
const REPLAY_DISTANCE_SECONDS = 1200;
const APP_SHARE_URL = "https://marsrakete.github.io/trailthread/";
const OSM_OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const OSM_ANALYSIS_SAMPLE_DISTANCE_M = 160;
const OSM_ANALYSIS_MAX_SAMPLES = 300;
const OSM_ANALYSIS_QUERY_CHUNK_SIZE = 60;
const OSM_ANALYSIS_MATCH_DISTANCE_M = 55;
const OSM_ANALYSIS_RETRY_DELAY_MS = 30000;

const state = { db: null, map: null, replayMap2d: null, replayMap3d: null, replayMap3dReady: false, layers: new Map(), heatmapLayer: null, heatmapStats: null, tracks: [], accounts: [], settings: { id: "app", language: "auto", activeWorkspace: "library", activeAccountId: null, leftPaneWidth: 180, middlePaneWidth: 400, sidebarCompact: false, libraryCompact: false, photoOverlayOnly: false, heatmapMode: false, segmentOverlayMode: false, replayDirectionOverlayCollapsed: false, trackLineWeight: 6, komootCaches: {} }, selectedTrackIds: new Set(), highlightedTrackId: null, libraryUi: { focusTrackId: null, scrollTop: 0 }, mergeUi: { orderedTrackIds: [] }, profileUi: { trackId: null, samples: [], plot: null, hoverMarker: null }, photoDialogUi: { trackId: null, photos: [], index: 0, swipeStartX: null }, trackDetailUi: { trackId: null, editing: false }, resizeUi: { handle: null, startX: 0, leftPaneWidth: 180, middlePaneWidth: 400, rafId: null }, komootTours: [], selectedKomootTourIds: new Set(), komootUi: { focusTourId: null, focusList: null, scrollTopByList: { recorded: 0, planned: 0 }, focusOffsetByList: { recorded: null, planned: null }, progress: { active: false, label: '', value: 0, indeterminate: false } }, replay: { activeTrackId: null, replayTrack: null, view: '2d', mode: 'distance', playing: false, speed: 4, cursor: 0, followCamera: true, showPhotos: true, showProfile: true, cameraMode2d: 'center', cameraMode3d: 'orbit', rafId: null, lastFrameAt: 0, layers2d: { route: null, played: null, marker: null, photos: null }, sources3dReady: false, marker3d: null, lastApplied2DMode: null, last2DCameraAppliedAt: 0, profileRender: { key: null, geometry: null } }, proxy: { online: false, mode: null, lastCheckAt: null, lastError: null } };

const libraryDerivedCache = {
  tracksRef: null,
  language: '',
  sports: [],
  customTags: [],
  metaTags: [],
  filteredKey: '',
  filteredTracks: [],
  filteredIds: new Set(),
  selectSignatures: { sport: '', tag: '', meta: '' }
};

const el = {
workspaceButtons: [...document.querySelectorAll('.workspace-button[data-workspace]')], settingsButton: document.querySelector('#open-settings-button'), helpButton: document.querySelector('#open-help-button'), toggleSidebarCompactButton: document.querySelector('#toggle-sidebar-compact-button'), toggleLibraryCompactButton: document.querySelector('#toggle-library-compact-button'), libraryWorkspace: document.querySelector('#library-workspace'), komootWorkspace: document.querySelector('#komoot-workspace'), replayWorkspace: document.querySelector('#replay-workspace'), statusToast: document.querySelector('#status-toast'), komootStatusPill: document.querySelector('#komoot-status-pill'), addAccountButton: document.querySelector('#add-account-button'), accountsList: document.querySelector('#accounts-list'), fileInput: document.querySelector('#file-input'), exportSelectedGpxButton: document.querySelector('#export-selected-gpx-button'), exportSelectedGpxMenu: document.querySelector('#export-selected-gpx-menu'), exportSelectedMultiTrackGpxButton: document.querySelector('#export-selected-multitrack-gpx-button'), mergeSelectedTracksButton: document.querySelector('#merge-selected-tracks-button'), trackList: document.querySelector('#track-list'), librarySearchInput: document.querySelector('#library-search-input'), libraryTypeFilter: document.querySelector('#library-type-filter'), libraryFavoriteFilter: document.querySelector('#library-favorite-filter'), librarySportFilter: document.querySelector('#library-sport-filter'), libraryTagFilter: document.querySelector('#library-tag-filter'), libraryMetaFilter: document.querySelector('#library-meta-filter'), librarySortSelect: document.querySelector('#library-sort-select'), fitAllButton: document.querySelector('#fit-all-button'), mapPhotoModeButton: document.querySelector('#map-photo-mode-button'), prevTrackButton: document.querySelector('#prev-track-button'), nextTrackButton: document.querySelector('#next-track-button'), resizeHandles: [...document.querySelectorAll('[data-resize-handle]')], toggleSelectionButton: document.querySelector('#toggle-selection-button'), libraryToggleSelectionButton: document.querySelector('#library-toggle-selection-button'), selectionStats: document.querySelector('#selection-stats'), distanceStats: document.querySelector('#distance-stats'), pointStats: document.querySelector('#point-stats'), profileTrackName: document.querySelector('#profile-track-name'), profileDistance: document.querySelector('#profile-distance'), profileElevationRange: document.querySelector('#profile-elevation-range'), profileAscent: document.querySelector('#profile-ascent'), profileDescent: document.querySelector('#profile-descent'), profileAvgSpeed: document.querySelector('#profile-avg-speed'), profileSegmentSummary: document.querySelector('#profile-segment-summary'), profileSurfaceBreakdown: document.querySelector('#profile-surface-breakdown'), profileWaytypeBreakdown: document.querySelector('#profile-waytype-breakdown'), profileEmpty: document.querySelector('#profile-empty'), profileChartShell: document.querySelector('#profile-chart-shell'), profileChart: document.querySelector('#profile-chart'), profileCursorInfo: document.querySelector('#profile-cursor-info'), profileCursorAfter: document.querySelector('#profile-cursor-after'), profileCursorAltitude: document.querySelector('#profile-cursor-altitude'), profileCursorGrade: document.querySelector('#profile-cursor-grade'), selectionList: document.querySelector('#selection-list'), recentList: document.querySelector('#staging-list'), recentSummary: document.querySelector('#staging-summary'), librarySummary: document.querySelector('#library-summary'), komootAccountSelect: document.querySelector('#komoot-account-select'), komootLoadButton: document.querySelector('#komoot-load-button'), komootImportButton: document.querySelector('#komoot-import-button'), komootProgress: document.querySelector('#komoot-progress'), komootProgressLabel: document.querySelector('#komoot-progress-label'), komootProgressValue: document.querySelector('#komoot-progress-value'), komootProgressBar: document.querySelector('#komoot-progress-bar'), recordedList: document.querySelector('#recorded-tour-list'), plannedList: document.querySelector('#planned-tour-list'), recordedSummary: document.querySelector('#recorded-summary'), plannedSummary: document.querySelector('#planned-summary'), recordedSelectAllButton: document.querySelector('#recorded-select-all-button'), plannedSelectAllButton: document.querySelector('#planned-select-all-button'), diagProxy: document.querySelector('#komoot-diag-proxy'), diagMode: document.querySelector('#komoot-diag-mode'), diagChecked: document.querySelector('#komoot-diag-checked'), diagError: document.querySelector('#komoot-diag-error'), replayTrackTitle: document.querySelector('#replay-track-title'), replayTrackSubtitle: document.querySelector('#replay-track-subtitle'), replayViewButtons: [...document.querySelectorAll('[data-replay-view]')], replayRestartButton: document.querySelector('#replay-restart-button'), replayPlayButton: document.querySelector('#replay-play-button'), replayPauseButton: document.querySelector('#replay-pause-button'), replayBackButton: document.querySelector('#replay-back-button'), replayForwardButton: document.querySelector('#replay-forward-button'), replayJumpStartButton: document.querySelector('#replay-jump-start-button'), replayJumpHighButton: document.querySelector('#replay-jump-high-button'), replayJumpPhotoButton: document.querySelector('#replay-jump-photo-button'), replayJumpEndButton: document.querySelector('#replay-jump-end-button'), replaySpeedSelect: document.querySelector('#replay-speed-select'), replayModeButtons: [...document.querySelectorAll('[data-replay-mode]')], replayCamera2dRow: document.querySelector('#replay-camera-2d-row'), replayCamera3dRow: document.querySelector('#replay-camera-3d-row'), replayCamera2dButtons: [...document.querySelectorAll('[data-replay-camera-2d]')], replayCameraButtons: [...document.querySelectorAll('[data-replay-camera]')], replayFollowCameraInput: document.querySelector('#replay-follow-camera-input'), replayShowPhotosInput: document.querySelector('#replay-show-photos-input'), replayShowProfileInput: document.querySelector('#replay-show-profile-input'), replayMap2d: document.querySelector('#replay-map-2d'), replayMap3d: document.querySelector('#replay-map-3d'), replayDirectionOverlay: document.querySelector('#replay-direction-overlay'), replayDirectionOverlayToggle: document.querySelector('#replay-direction-overlay-toggle'), replayDirectionOverlayIcon: document.querySelector('#replay-direction-overlay-icon'), replayDistanceValue: document.querySelector('#replay-distance-value'), replayAltitudeValue: document.querySelector('#replay-altitude-value'), replayGradeValue: document.querySelector('#replay-grade-value'), replayTimeValue: document.querySelector('#replay-time-value'), replayProfilePanel: document.querySelector('#replay-profile-panel'), replayProfileTrackName: document.querySelector('#replay-profile-track-name'), replayAscentValue: document.querySelector('#replay-ascent-value'), replayDescentValue: document.querySelector('#replay-descent-value'), replaySpeedValue: document.querySelector('#replay-speed-value'), replayPointValue: document.querySelector('#replay-point-value'), replayDirectionValue: document.querySelector('#replay-direction-value'), replayProfileEmpty: document.querySelector('#replay-profile-empty'), replayProfileChartShell: document.querySelector('#replay-profile-chart-shell'), replayProfileChart: document.querySelector('#replay-profile-chart'), accountDialog: document.querySelector('#account-dialog'), accountEmailInput: document.querySelector('#account-email-input'), accountPasswordInput: document.querySelector('#account-password-input'), saveAccountButton: document.querySelector('#save-account-button'), settingsDialog: document.querySelector('#settings-dialog'), helpDialog: document.querySelector('#help-dialog'), helpStatus: document.querySelector('#help-status'), helpContent: document.querySelector('#help-content'), exportBackupButton: document.querySelector('#export-backup-button'), backupInput: document.querySelector('#backup-input'), exportTourBackupButton: document.querySelector('#export-tour-backup-button'), settingsExportTourBackupButton: document.querySelector('#settings-export-tour-backup-button'), tourBackupInput: document.querySelector('#tour-backup-input'), languageSelect: document.querySelector('#language-select'), trackWidthInput: document.querySelector('#track-width-input'), trackWidthValue: document.querySelector('#track-width-value'), trackItemTemplate: document.querySelector('#track-item-template'), accountItemTemplate: document.querySelector('#account-item-template'), tourItemTemplate: document.querySelector('#tour-item-template'), stagingItemTemplate: document.querySelector('#staging-item-template'), trackDetailDialog: document.querySelector('#track-detail-dialog'), trackDetailTitle: document.querySelector('#track-detail-title'), trackDetailSubtitle: document.querySelector('#track-detail-subtitle'), trackDetailEditBlock: document.querySelector('#track-detail-edit-block'), trackDetailNameInput: document.querySelector('#track-detail-name-input'), trackDetailFavoriteInput: document.querySelector('#track-detail-favorite-input'), trackDetailTagsInput: document.querySelector('#track-detail-tags-input'), trackDetailDescriptionInput: document.querySelector('#track-detail-description-input'), trackDetailFacts: document.querySelector('#track-detail-facts'), trackDetailDescription: document.querySelector('#track-detail-description'), trackDetailAnalysis: document.querySelector('#track-detail-analysis'), trackDetailPhotos: document.querySelector('#track-detail-photos'), trackDetailEditButton: document.querySelector('#track-detail-edit-button'), trackDetailSaveButton: document.querySelector('#track-detail-save-button'), trackDetailCancelButton: document.querySelector('#track-detail-cancel-button'),
  photoDialog: document.querySelector('#photo-dialog'), photoDialogTitle: document.querySelector('#photo-dialog-title'), photoDialogSubtitle: document.querySelector('#photo-dialog-subtitle'), photoDialogStage: document.querySelector('#photo-dialog-stage'), photoDialogImage: document.querySelector('#photo-dialog-image'), photoDialogCaption: document.querySelector('#photo-dialog-caption'), photoDialogMeta: document.querySelector('#photo-dialog-meta'), photoDialogThumbs: document.querySelector('#photo-dialog-thumbs'), photoDialogPrev: document.querySelector('#photo-dialog-prev'), photoDialogNext: document.querySelector('#photo-dialog-next'), photoDialogClose: document.querySelector('#photo-dialog-close'), photoDialogThumbTemplate: document.querySelector('#photo-dialog-thumb-template'), trackPhotoThumbTemplate: document.querySelector('#track-photo-thumb-template'), trackFactTemplate: document.querySelector('#track-fact-template'), trackQuickBadgeTemplate: document.querySelector('#track-quick-badge-template'), trackAnalysisGridTemplate: document.querySelector('#track-analysis-grid-template'), trackAnalysisCardTemplate: document.querySelector('#track-analysis-card-template'), analysisPillTemplate: document.querySelector('#analysis-pill-template'), trackTimelineTemplate: document.querySelector('#track-timeline-template'), trackTimelineItemTemplate: document.querySelector('#track-timeline-item-template'), timelineMapMarkerTemplate: document.querySelector('#timeline-map-marker-template'), timelineMapPopupTemplate: document.querySelector('#timeline-map-popup-template'), replayProfileChartTemplate: document.querySelector('#replay-profile-chart-template'), profileSegmentChipTemplate: document.querySelector('#profile-segment-chip-template'), accountStatus: document.querySelector('#account-status'),
  confirmDialog: document.querySelector('#confirm-dialog'), confirmDialogTitle: document.querySelector('#confirm-dialog-title'), confirmDialogMessage: document.querySelector('#confirm-dialog-message'), confirmDialogConfirm: document.querySelector('#confirm-dialog-confirm'), confirmDialogCancel: document.querySelector('#confirm-dialog-cancel'), mergeDialog: document.querySelector('#merge-dialog'), mergeDialogFirstName: document.querySelector('#merge-track-first-name'), mergeDialogFirstMeta: document.querySelector('#merge-track-first-meta'), mergeDialogSecondName: document.querySelector('#merge-track-second-name'), mergeDialogSecondMeta: document.querySelector('#merge-track-second-meta'), mergeDialogSwapButton: document.querySelector('#merge-dialog-swap-button'), mergeDialogConfirm: document.querySelector('#merge-dialog-confirm')
};

Object.assign(el, {
  photoDialogSheet: document.querySelector('#photo-dialog-sheet'),
  photoDialogFullscreenButton: document.querySelector('#photo-dialog-fullscreen'),
  versionLabel: document.querySelector('#version-label'),
  checkUpdatesButton: document.querySelector('#check-updates-button'),
  reloadAppButton: document.querySelector('#reload-app-button'),
  updateStatus: document.querySelector('#update-status'),
  mapHeatmapButton: document.querySelector('#map-heatmap-button'),
  mapSegmentButton: document.querySelector('#map-segment-button'),
  segmentHelpSurfaceItems: document.querySelector('#segment-help-surface-items'),
  segmentHelpWaytypeItems: document.querySelector('#segment-help-waytype-items'),
  shareAppButton: document.querySelector('#share-app-button'),
  exportSelectedTourBackupButton: document.querySelector('#export-selected-tour-backup-button'),
  exportSelectedKmzButton: document.querySelector('#export-selected-kmz-button'),
  exportSelectedKmzProButton: document.querySelector('#export-selected-kmz-pro-button'),
  settingsExportSelectedTourBackupButton: document.querySelector('#settings-export-selected-tour-backup-button')
});

let helpCache = { path: null, text: '' };
let mermaidRuntime = null;
let mermaidLoadFailed = false;
let serviceWorkerRegistration = null;
let updateInProgress = false;
let reloadInProgress = false;
let lastAutoUpdateCheckAt = 0;
let komootRestoreRaf = 0;
let statusToastTimer = 0;
let osmAnalysisTrackId = null;

/**
 * Resolves the currently active application language with a browser-language fallback.
 * @returns {string} Supported language code.
 */
function lang() {
  if (state.settings.language && state.settings.language !== 'auto') return state.settings.language;
  const browserLanguage = navigator.language.slice(0, 2);
  if (translations[browserLanguage]) return browserLanguage;
  return 'de';
}

/**
 * Resolves a translated UI text and replaces its named parameters.
 * @param {string} key Translation key.
 * @param {Record<string, unknown>} params Values for placeholders in the translation.
 * @returns {string} Localized text or the key when no translation exists.
 */
function t(key, params = {}) {
  let value = translations[lang()][key];
  if (value == null) value = translations.de[key];
  if (value == null) value = key;
  for (const [parameter, replacement] of Object.entries(params)) {
    value = value.replaceAll(`{${parameter}}`, String(replacement));
  }
  return value;
}

/**
 * Formats a date for the active application language.
 * @param {string|null|undefined} value ISO date value.
 * @returns {string} Localized date or a placeholder.
 */
function fmtDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString(lang());
}

/**
 * Formats a numeric value for the active application language.
 * @param {number|null|undefined} value Numeric value.
 * @returns {string} Localized number.
 */
function fmtNum(value) {
  return new Intl.NumberFormat(lang()).format(value ?? 0);
}

/**
 * Formats a distance value with one decimal place.
 * @param {number|null|undefined} value Distance in kilometers.
 * @returns {string} Formatted numeric distance.
 */
function fmtKm(value) {
  return (value ?? 0).toFixed(1);
}

/**
 * Formats a height value in meters.
 * @param {number|null|undefined} value Height in meters.
 * @returns {string} Localized meter label.
 */
function fmtMeters(value) {
  return `${fmtNum(Math.round(value ?? 0))} m`;
}

/**
 * Formats a speed value in kilometers per hour.
 * @param {number|null|undefined} value Speed in kilometers per hour.
 * @returns {string} Formatted speed or a placeholder.
 */
function fmtHours(value) {
  if (value == null || !Number.isFinite(value)) return '-';
  return `${value.toFixed(1)} km/h`;
}
function fmtElapsedShort(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '--:--:--';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
/**
 * Returns the initial replay speed for a replay mode.
 * @param {string} view Active replay view, retained for future view-specific speeds.
 * @param {string} mode Active replay mode.
 * @returns {number} Default playback multiplier.
 */
function replayDefaultSpeed(view = state.replay.view, mode = state.replay.mode) {
  if (mode === 'time') return 2;
  return 1;
}
function applyReplayModeDefaults(mode, view = state.replay.view) {
  state.replay.speed = replayDefaultSpeed(view, mode);
}
/**
 * Returns the directional symbol for a route gradient.
 * @param {number} gradePercent Gradient in percent.
 * @returns {string} Upward, downward or level symbol.
 */
function gradeArrow(gradePercent) {
  if (!Number.isFinite(gradePercent) || Math.abs(gradePercent) < 0.2) return '~';
  if (gradePercent > 0) return '↗';
  return '↘';
}
function fmtGrade(gradePercent) {
  if (!Number.isFinite(gradePercent)) return '~ 0 %';
  const rounded = Math.round(Math.abs(gradePercent));
  if (rounded === 0) return '~ 0 %';
  return `${gradeArrow(gradePercent)} ${rounded} %`;
}
const id = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
/**
 * Converts known source-specific tour types to Trailthread's internal type values.
 * @param {string|null|undefined} value Source type value.
 * @returns {'planned'|'recorded'|'unknown'} Normalized track type.
 */
function trackType(value) {
  if (value === 'tour_planned' || value === 'planned') return 'planned';
  if (value === 'tour_recorded' || value === 'recorded') return 'recorded';
  return 'unknown';
}

/**
 * Returns the translated label for an internal track type.
 * @param {string|null|undefined} value Track type.
 * @returns {string} Localized type label.
 */
function trackTypeLabel(value) {
  if (value === 'planned') return t('typePlanned');
  if (value === 'recorded') return t('typeRecorded');
  return t('typeUnknown');
}

/**
 * Returns the translated label for a track source.
 * @param {string|null|undefined} value Track source.
 * @returns {string} Localized source label.
 */
function trackSourceLabel(value) {
  if (value === 'komoot') return t('trackSourceKomoot');
  if (value === 'backup') return t('trackSourceBackup');
  return t('trackSourceLocal');
}
const signature = (track) => `${track.source}|${track.accountEmail ?? ''}|${track.sourceTrackId ?? ''}|${track.name}|${track.dateStart ?? ''}|${track.pointCount ?? 0}`;

/**
 * Builds an identifier for a track that belongs to a remote source account.
 * @param {object|null|undefined} track Candidate track record.
 * @returns {string|null} Stable remote identifier or null for local tracks.
 */
function remoteTrackKey(track) {
  if (!track?.source || !track?.accountEmail || !track?.sourceTrackId) return null;
  return `${track.source}|${track.accountEmail}|${track.sourceTrackId}`;
}

/**
 * Returns the Komoot website URL for a Komoot-originated track.
 * @param {object|null|undefined} track Candidate track record.
 * @returns {string|null} Original Komoot URL or null when not applicable.
 */
function komootTrackUrl(track) {
  if (track?.source !== 'komoot' || !track?.sourceTrackId) return null;
  return `https://www.komoot.de/tour/${track.sourceTrackId}`;
}
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
function komootProgressText() {
  if (lang() === 'fr') return { loadingTours: 'Chargement des tours...', importing: 'Import des tours...', done: 'Termine' };
  if (lang() === 'en') return { loadingTours: 'Loading tours...', importing: 'Importing tours...', done: 'Done' };
  return { loadingTours: 'Touren werden geladen...', importing: 'Touren werden importiert...', done: 'Fertig' };
}
const hashString = (value) => [...`${value ?? ''}`].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 7);
const LOOPBACK_HOST_PATTERN = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|::1)$/i;
function isLoopbackHost(hostname = "") {
  return LOOPBACK_HOST_PATTERN.test(`${hostname ?? ""}`.trim());
}
function appRunsOnLoopbackOrigin() {
  return isLoopbackHost(globalThis.location?.hostname || "");
}
/**
 * Returns the separate local Komoot proxy endpoint.
 * @returns {string} The proxy base URL including its API path.
 */
function proxyBaseUrl() {
  return `${LOCAL_PROXY_ORIGIN}${PROXY_PATH}`;
}
function shouldRequestLoopbackAccess() {
  return !appRunsOnLoopbackOrigin() && /^https?:$/i.test(globalThis.location?.protocol || "");
}
function proxyBlockedByHostedLoopbackPolicy(message = "") {
  const normalized = `${message ?? ""}`.toLowerCase();
  return normalized.includes("loopback address space")
    || normalized.includes("private network access")
    || (normalized.includes("failed to fetch") && shouldRequestLoopbackAccess());
}
function normalizeProxyError(error) {
  const message = `${error?.message ?? error ?? ""}`.trim();
  if (proxyBlockedByHostedLoopbackPolicy(message)) return t("proxyHostedLoopbackBlocked");
  return message || t("proxyOffline");
}
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
  other_activities: { de: 'Andere Aktivitäten', en: 'Other activities', fr: 'Autres activites', icon: '•', aliases: ['other', 'other_activities', 'misc', 'unknown'] }
};
const SPORT_ALIAS_LOOKUP = Object.fromEntries(Object.entries(SPORT_LABELS).flatMap(([key, config]) => config.aliases.map((alias) => [alias, key])));
/**
 * Selects a stable default color for a track from its status-specific palette.
 * @param {object} trackLike Track data used to build a stable color key.
 * @returns {string} CSS color value.
 */
function defaultTrackColor(trackLike) {
  const baseKey = [trackLike.accountEmail, trackType(trackLike.type), trackLike.sourceTrackId, trackLike.id, trackLike.name].filter(Boolean).join('|') || signature(trackLike);
  let palette = RECORDED_COLORS;
  if (trackType(trackLike.type) === 'planned') palette = PLANNED_COLORS;
  return palette[hashString(baseKey) % palette.length];
}
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
    text.includes('geschätzte dauer:') ||
    text.includes('elevation up:') ||
    text.includes('höhenmeter bergauf:') ||
    text.includes('hoehenmeter bergauf:') ||
    text.includes('denivele positif:')
  );
}
function normalizeTrackDescription(value, fallback = null) {
  const preferred = cleanText(value);
  if (preferred && /^@\{.+\}$/.test(preferred)) return cleanText(fallback);
  if (preferred && !looksLikeGeneratedMetricText(preferred)) return preferred;
  const secondary = cleanText(fallback);
  if (secondary && /^@\{.+\}$/.test(secondary)) return null;
  if (secondary && !looksLikeGeneratedMetricText(secondary)) return secondary;
  return null;
}
function reqToPromise(request) { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function openDb() { return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, DB_VERSION); request.onerror = () => reject(request.error); request.onupgradeneeded = () => { const db = request.result; if (request.transaction && request.oldVersion < 4 && db.objectStoreNames.contains(STORES.tracks)) db.deleteObjectStore(STORES.tracks); if (!db.objectStoreNames.contains(STORES.tracks)) db.createObjectStore(STORES.tracks, { keyPath: 'id' }); if (!db.objectStoreNames.contains(STORES.photos)) db.createObjectStore(STORES.photos, { keyPath: 'id' }); if (!db.objectStoreNames.contains(STORES.accounts)) db.createObjectStore(STORES.accounts, { keyPath: 'id' }); if (!db.objectStoreNames.contains(STORES.settings)) db.createObjectStore(STORES.settings, { keyPath: 'id' }); }; request.onsuccess = () => resolve(request.result); }); }
async function all(store) { return reqToPromise(state.db.transaction(store, 'readonly').objectStore(store).getAll()); }
async function get(store, key) { return reqToPromise(state.db.transaction(store, 'readonly').objectStore(store).get(key)); }
async function put(store, value) { const tx = state.db.transaction(store, 'readwrite'); tx.objectStore(store).put(value); return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); }
async function putMany(store, values) { const tx = state.db.transaction(store, 'readwrite'); values.forEach((value) => tx.objectStore(store).put(value)); return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); }
async function del(store, key) { const tx = state.db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); }
/**
 * Deletes every record in one IndexedDB object store.
 * @param {string} store Name of the object store to clear.
 * @returns {Promise<void>} Resolves after IndexedDB has committed the deletion.
 */
async function clearStore(store) {
  const tx = state.db.transaction(store, 'readwrite');
  tx.objectStore(store).clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function getMany(store, keys) {
  const uniqueKeys = [...new Set((keys || []).filter(Boolean))];
  if (!uniqueKeys.length) return [];
  const tx = state.db.transaction(store, 'readonly');
  const objectStore = tx.objectStore(store);
  const requests = uniqueKeys.map((key) => reqToPromise(objectStore.get(key)));
  const values = await Promise.all(requests);
  return values.filter(Boolean);
}
async function saveSettings() { await put(STORES.settings, { ...state.settings, id: 'app' }); }
/**
 * Removes the retired password-based proxy connector data from local storage and app state.
 * @returns {Promise<void>} Resolves after all stored accounts and related settings are cleared.
 */
async function deactivateLegacyProxyConnector() {
  await clearStore(STORES.accounts);
  state.accounts = [];
  state.settings.activeAccountId = null;
  state.settings.komootCaches = {};
  state.komootTours = [];
  state.selectedKomootTourIds = new Set();
}
function normalizeKomootTourSummary(tour, account) {
  const replayTrack = {
    ...tour,
    id: `${tour.id ?? ''}`,
    type: trackType(tour.type),
    dateStart: tour.dateStart || tour.date || null,
    accountId: account?.id ?? tour.accountId ?? null,
    accountEmail: account?.email ?? tour.accountEmail ?? null,
    accountLabel: account?.label ?? tour.accountLabel ?? null
  };
}
function komootCacheForAccount(accountId) {
  if (!accountId) return null;
  return state.settings.komootCaches?.[accountId] ?? null;
}
async function persistKomootCache(accountId) {
  if (!accountId) return;
  state.settings.komootCaches = {
    ...(state.settings.komootCaches ?? {}),
    [accountId]: {
      updatedAt: isoNow(),
      tours: state.komootTours.map((tour) => ({
        id: tour.id,
        name: tour.name,
        sport: tour.sport ?? null,
        type: tour.type,
        distanceKm: tour.distanceKm ?? null,
        date: tour.date ?? tour.dateStart ?? null
      })),
      selectedTourIds: [...state.selectedKomootTourIds]
    }
  };
  await saveSettings();
}
function restoreKomootCache(account, { announce = false } = {}) {
  const cache = komootCacheForAccount(account?.id);
  if (!cache) {
    state.komootTours = [];
    state.selectedKomootTourIds = new Set();
    renderKomoot();
    return false;
  }
  state.komootTours = (cache.tours ?? []).map((tour) => normalizeKomootTourSummary(tour, account));
  const validIds = new Set(state.komootTours.map((tour) => tour.id));
  state.selectedKomootTourIds = new Set((cache.selectedTourIds ?? []).filter((tourId) => validIds.has(tourId)));
  renderKomoot();
  if (announce) setKomootStatus(t('komootCachedSummary', { count: state.komootTours.length }));
  return true;
}
function renderKomootLoadButton() {
  const accountId = el.komootAccountSelect?.value || state.settings.activeAccountId;
  const hasCachedTours = !!komootCacheForAccount(accountId)?.tours?.length;
  if (hasCachedTours) {
    el.komootLoadButton.textContent = t('komootRefreshTours');
  } else {
    el.komootLoadButton.textContent = t('komootLoadTours');
  }
}
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

/**
 * Shows a short status toast and optionally keeps it visible until a later status replaces it.
 * @param {string} message Visible status text.
 * @param {boolean} error Whether the toast should use its error styling and longer default duration.
 * @param {boolean} persistent Whether the toast must remain open until replaced explicitly.
 * @returns {void}
 */
function setStatus(message, error = false, persistent = false) {
  if (!el.statusToast) return;
  if (statusToastTimer) {
    window.clearTimeout(statusToastTimer);
    statusToastTimer = 0;
  }
  el.statusToast.textContent = message;
  el.statusToast.hidden = false;
  el.statusToast.classList.toggle('is-error', !!error);
  el.statusToast.classList.add('is-visible');
  if (persistent) return;
  let visibleDuration = 2600;
  if (error) visibleDuration = 4200;
  statusToastTimer = window.setTimeout(() => {
    el.statusToast.classList.remove('is-visible');
    window.setTimeout(() => {
      if (!el.statusToast.classList.contains('is-visible')) el.statusToast.hidden = true;
    }, 180);
  }, visibleDuration);
}
function setKomootStatus(message, error = false) {
  el.komootStatusPill.textContent = message;
  if (error) {
    el.komootStatusPill.style.color = 'var(--danger)';
  } else {
    el.komootStatusPill.style.color = 'var(--muted)';
  }
}
function confirmAction(message, { title = null, confirmLabel = null, cancelLabel = null } = {}) {
  return new Promise((resolve) => {
    let defaultTitle = 'Bestätigung';
    if (lang() === 'en') defaultTitle = 'Confirm';
    if (lang() === 'fr') defaultTitle = 'Confirmation';
    let defaultConfirmLabel = 'Bestätigen';
    if (lang() === 'en') defaultConfirmLabel = 'Confirm';
    if (lang() === 'fr') defaultConfirmLabel = 'Confirmer';
    el.confirmDialogTitle.textContent = title || defaultTitle;
    el.confirmDialogMessage.textContent = message;
    el.confirmDialogConfirm.textContent = confirmLabel || defaultConfirmLabel;
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
function parseTagInput(value) { return [...new Set(`${value ?? ''}`.split(',').map((item) => cleanText(item)).filter(Boolean))]; }
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
async function loadMermaidRuntime() {
  if (mermaidRuntime || mermaidLoadFailed) return mermaidRuntime;
  try {
    const module = await import('https://unpkg.com/mermaid@11/dist/mermaid.esm.min.mjs');
    mermaidRuntime = module.default;
    mermaidRuntime.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        primaryColor: '#1d332d',
        primaryTextColor: '#e8efea',
        primaryBorderColor: 'rgba(185, 224, 196, 0.42)',
        lineColor: '#9fcfb1',
        secondaryColor: '#13211d',
        tertiaryColor: '#0d1714'
      }
    });
    return mermaidRuntime;
  } catch {
    mermaidLoadFailed = true;
    return null;
  }
}
async function renderHelpMermaidBlocks() {
  const blocks = [...el.helpContent.querySelectorAll('.help-mermaid-block')];
  if (!blocks.length) return;
  const mermaid = await loadMermaidRuntime();
  if (!mermaid) return;
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const source = block.dataset.mermaidSource || '';
    if (!source.trim()) continue;
    try {
      const { svg } = await mermaid.render(`trailthread-help-mermaid-${index}-${Date.now()}`, source);
      block.innerHTML = svg;
      block.classList.add('is-rendered');
    } catch {
      // Keep the fallback code block visible.
    }
  }
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
  let codeLang = "";
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
    const source = codeLines.join("\n");
    if (codeLang === 'mermaid') {
      html.push(`<div class="help-mermaid-block" data-mermaid-source="${escapeHtml(source)}"><pre><code>${escapeHtml(source)}</code></pre></div>`);
    } else {
      html.push(`<pre><code>${escapeHtml(source)}</code></pre>`);
    }
    inCode = false;
    codeLang = "";
    codeLines = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      flushParagraph();
      flushList();
      if (inCode) flushCode();
      else {
        inCode = true;
        codeLang = line.trim().slice(3).trim().toLowerCase();
      }
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
      let nextTag = "ul";
      if (ordered) nextTag = "ol";
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
  let statusState = '';
  if (error) {
    statusState = 'error';
  } else if (message) {
    statusState = 'info';
  }
  el.updateStatus.dataset.state = statusState;
  el.reloadAppButton.disabled = Boolean(reloadInProgress);
  el.reloadAppButton.hidden = false;
  el.reloadAppButton.classList.toggle('button-primary', Boolean(showReload));
  el.reloadAppButton.classList.toggle('button-ghost', !showReload);
}
async function loadReadmeContent() {
  const path = "./README.md";
  if (helpCache.path === path && helpCache.text) {
    el.helpStatus.textContent = "";
    el.helpContent.innerHTML = renderMarkdownAsHtml(helpCache.text);
    void renderHelpMermaidBlocks();
    return;
  }
  el.helpStatus.textContent = t('helpLoading');
  el.helpContent.replaceChildren();
  try {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error("README unavailable");
    const text = await response.text();
    helpCache = { path, text };
    el.helpStatus.textContent = "";
    el.helpContent.innerHTML = renderMarkdownAsHtml(text);
    void renderHelpMermaidBlocks();
  } catch (error) {
    console.error(error);
    el.helpStatus.textContent = t('helpFailed');
    if (!(helpCache.path === path && helpCache.text)) el.helpContent.replaceChildren();
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
  if (reloadInProgress) return;
  reloadInProgress = true;
  if (el.reloadAppButton) el.reloadAppButton.disabled = true;
  setUpdateStatus(t('updateApplying'), true);
  try {
    await serviceWorkerRegistration?.update().catch(() => {});
    serviceWorkerRegistration?.waiting?.postMessage?.({ type: "SKIP_WAITING" });
  } catch (error) {
    console.error(error);
  }
  window.setTimeout(() => {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("reload", String(Date.now()));
    window.location.replace(nextUrl.toString());
  }, 120);
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
    let remoteLabel = '';
    if (remoteVersion.label) remoteLabel = ` · ${remoteVersion.label}`;
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
  let alt = null;
  if (altValue != null) alt = Number(altValue);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!Number.isFinite(alt)) alt = null;
  return { lat, lng, alt };
}
function isDataImageUrl(url) {
  return /^data:image\//i.test(url || '');
}
function isRenderablePhotoUrl(url) {
  if (isDataImageUrl(url)) return true;
  if (!/^https?:\/\//i.test(url)) return false;
  if (/\{width\}|\{height\}|\{crop\}/i.test(url)) return false;
  if (/api\.komoot\.de\/v\d+\/tours\/[^/]+\/(translations|tour_line|timeline|details|faqs)\/?$/i.test(url)) return false;
  return true;
}
function blobToObjectUrl(blob) {
  if (blob instanceof Blob) return URL.createObjectURL(blob);
  return null;
}
function revokeTrackPhotoUrls(track) {
  for (const photo of track?.photos ?? []) {
    if (photo?.objectUrl) {
      URL.revokeObjectURL(photo.objectUrl);
      photo.objectUrl = null;
    }
  }
}
function revokeAllTrackPhotoUrls(tracks = state.tracks) {
  tracks.forEach((track) => revokeTrackPhotoUrls(track));
}
async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}
function normalizePhotos(photos) {
  if (!Array.isArray(photos)) return [];
  const seen = new Set();
  return photos.map((photo) => {
    if (typeof photo === 'string') return { url: photo, title: null };
    return { ...photo };
  }).filter((photo) => {
    const url = cleanText(photo?.url);
    let externalUrl = cleanText(photo?.externalUrl);
    if (!externalUrl && isRenderablePhotoUrl(url) && !isDataImageUrl(url)) externalUrl = url;
    const sourceUrl = cleanText(photo?.sourceUrl) || externalUrl || url;
    const blobId = cleanText(photo?.blobId) || null;
    if (!blobId && !externalUrl && !sourceUrl && !isDataImageUrl(url)) return false;
    const dedupeKey = sourceUrl || blobId || url || id('photo-ref');
    if (seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    photo.url = url;
    photo.externalUrl = externalUrl;
    photo.sourceUrl = sourceUrl;
    photo.blobId = blobId;
    photo.objectUrl = cleanText(photo?.objectUrl) || null;
    photo.title = cleanText(photo.title) || null;
    photo.caption = cleanText(photo.caption) || null;
    photo.createdAt = cleanText(photo.createdAt) || null;
    photo.attribution = cleanText(photo.attribution) || null;
    photo.attributionUrl = cleanText(photo.attributionUrl) || null;
    photo.type = cleanText(photo.type) || null;
    photo.id = cleanText(photo.id) || null;
    photo.loadError = cleanText(photo.loadError) || null;
    photo.inlineLoaded = photo.inlineLoaded === true;
    const widthPx = Number(photo.widthPx);
    const heightPx = Number(photo.heightPx);
    photo.widthPx = null;
    photo.heightPx = null;
    if (Number.isFinite(widthPx)) photo.widthPx = widthPx;
    if (Number.isFinite(heightPx)) photo.heightPx = heightPx;
    photo.location = normalizePhotoLocation(photo.location);
    photo.lineLocation = normalizePhotoLocation(photo.lineLocation);
    return true;
  });
}

/**
 * Reads one WGS84 location from a Komoot object or coordinate array.
 * @param {unknown} value Potential location object or [longitude, latitude] coordinate array.
 * @returns {{lat: number, lng: number, alt: number|null}|null} Normalized location, or null when invalid.
 */
function normalizeTimelineLocation(value) {
  const objectLocation = normalizePhotoLocation(value);
  if (objectLocation) return objectLocation;
  if (!Array.isArray(value) || value.length < 2) return null;
  const lng = Number(value[0]);
  const lat = Number(value[1]);
  let alt = null;
  if (value.length > 2 && Number.isFinite(Number(value[2]))) alt = Number(value[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, alt };
}

/**
 * Finds the first usable location among common Komoot timeline field variants.
 * @param {object} item Raw timeline event or embedded Komoot highlight.
 * @param {string} kind Either "start" or "end" to select a segment endpoint.
 * @returns {{lat: number, lng: number, alt: number|null}|null} Usable location, or null without one.
 */
function findTimelineLocation(item, kind = 'start') {
  if (!item || typeof item !== 'object') return null;
  const embeddedHighlight = item._embedded?.highlight || item.highlight || null;
  let candidates = [];
  if (kind === 'end') {
    candidates = [item.end_point, item.endPoint, item.end, embeddedHighlight?.end_point, embeddedHighlight?.endPoint, embeddedHighlight?.end];
  } else {
    candidates = [item.location, item.position, item.point, item.start_point, item.startPoint, item.start, item.coordinates, item.geometry?.coordinates, embeddedHighlight?.location, embeddedHighlight?.position, embeddedHighlight?.point, embeddedHighlight?.start_point, embeddedHighlight?.startPoint, embeddedHighlight?.start, embeddedHighlight?.coordinates, embeddedHighlight?.geometry?.coordinates];
  }
  for (const candidate of candidates) {
    const location = normalizeTimelineLocation(candidate);
    if (location) return location;
  }
  return null;
}

/**
 * Extracts the first readable community tip from common Komoot timeline nesting variants.
 * @param {object} item Raw timeline event returned by Komoot.
 * @param {object} highlight Highlight embedded in the timeline event.
 * @returns {string|null} Tip text, or null when no embedded tip contains text.
 */
function findTimelineTipText(item, highlight) {
  const candidates = [item?._embedded?.tips, item?.tips, highlight?._embedded?.tips, highlight?.tips];
  for (const candidate of candidates) {
    let tips = [];
    if (Array.isArray(candidate)) tips = candidate;
    if (Array.isArray(candidate?.items)) tips = candidate.items;
    for (const tip of tips) {
      const text = cleanText(tip?.text || tip?.content || tip?.description || tip?.body);
      if (text) return text;
    }
  }
  return null;
}

/**
 * Converts a raw Komoot timeline event into display-safe Trailthread data.
 * @param {object} item Raw event returned by Komoot's timeline endpoint.
 * @param {number} index Position of the event in the source timeline.
 * @returns {object|null} Normalized event, or null when it has no readable content.
 */
function normalizeTimelineEntry(item, index) {
  if (!item || typeof item !== 'object') return null;
  const highlight = item._embedded?.highlight || item.highlight || {};
  const title = cleanText(item.name || item.title || item.label || highlight.name || highlight.title || highlight.label);
  let text = cleanText(item.description || item.text || item.content || item.subtitle || highlight.description || highlight.text || highlight.content || highlight.subtitle);
  if (!text) text = findTimelineTipText(item, highlight);
  const rawType = cleanText(item.type || item._type || highlight.type || highlight._type).toLowerCase();
  const startLocation = findTimelineLocation(item, 'start');
  const endLocation = findTimelineLocation(item, 'end');
  const distanceValue = item.distanceM ?? item.distance_m ?? item.distance ?? item.position_m ?? item.positionM ?? highlight.distanceM ?? highlight.distance_m ?? highlight.distance;
  let distanceM = null;
  if (Number.isFinite(Number(distanceValue)) && Number(distanceValue) >= 0) distanceM = Number(distanceValue);
  if (!title && !text && !rawType && !startLocation && distanceM == null) return null;
  let type = rawType;
  if (!type) type = 'timeline';
  let location = startLocation;
  if (!location && distanceM != null) location = null;
  let segment = null;
  if (rawType.includes('segment') && startLocation && endLocation) segment = [startLocation, endLocation];
  return {
    id: `${item.id || highlight.id || type}-${index}`,
    title: title || t('timelineEntryFallback'),
    text: text || null,
    type,
    distanceM,
    location,
    segment
  };
}

/**
 * Normalizes all readable timeline events stored on a track.
 * @param {object} track Track whose raw Komoot timeline should be read.
 * @returns {Array<object>} Chronologically ordered normalized timeline entries.
 */
function normalizeTrackTimeline(track) {
  let sourceItems = [];
  if (Array.isArray(track?.timeline)) sourceItems = track.timeline;
  if (Array.isArray(track?.timeline?.items)) sourceItems = track.timeline.items;
  if (Array.isArray(track?.timeline?._embedded?.items)) sourceItems = track.timeline._embedded.items;
  return sourceItems.map((item, index) => normalizeTimelineEntry(item, index)).filter(Boolean);
}

/**
 * Assigns a track location to a timeline entry that only has a distance reference.
 * @param {object} track Track used as the spatial reference.
 * @param {object} entry Normalized timeline entry.
 * @returns {object} Timeline entry with a location when the track can supply one.
 */
function locateTimelineEntryOnTrack(track, entry) {
  if (entry.location || entry.distanceM == null) return entry;
  const location = sampleAlongTrack(track.points, entry.distanceM / 1000);
  if (!location) return entry;
  return { ...entry, location };
}

/**
 * Creates a Leaflet-compatible DOM marker from the shared timeline template.
 * @param {object} entry Normalized timeline entry to represent.
 * @returns {HTMLElement} Marker element carrying the entry type for CSS styling.
 */
function createTimelineMapMarkerElement(entry) {
  const fragment = el.timelineMapMarkerTemplate.content.cloneNode(true);
  const marker = fragment.querySelector('.timeline-map-marker');
  marker.dataset.timelineType = entry.type;
  return marker;
}

/**
 * Builds the popup DOM for one timeline marker without interpolating raw Komoot text as HTML.
 * @param {object} entry Normalized timeline entry to display.
 * @returns {HTMLElement} Popup element ready for Leaflet.
 */
function createTimelineMapPopup(entry) {
  const fragment = el.timelineMapPopupTemplate.content.cloneNode(true);
  const popup = fragment.querySelector('.timeline-map-popup');
  const title = fragment.querySelector('.timeline-map-popup-title');
  const text = fragment.querySelector('.timeline-map-popup-text');
  const meta = fragment.querySelector('.timeline-map-popup-meta');
  title.textContent = entry.title;
  if (entry.text) {
    text.textContent = entry.text;
    text.hidden = false;
  }
  if (entry.distanceM != null) {
    meta.textContent = t('timelineDistance', { distance: fmtKm(entry.distanceM / 1000) });
    meta.hidden = false;
  }
  return popup;
}

/**
 * Builds map layers for all locatable Komoot timeline entries of a track.
 * @param {object} track Track containing raw Komoot timeline data.
 * @returns {L.LayerGroup} Layer group with timeline point and segment markers.
 */
function buildTrackTimelineLayer(track) {
  const layer = L.layerGroup();
  normalizeTrackTimeline(track).forEach((rawEntry) => {
    const entry = locateTimelineEntryOnTrack(track, rawEntry);
    if (entry.segment) {
      L.polyline(entry.segment.map((location) => [location.lat, location.lng]), { color: '#e6a33e', weight: 7, opacity: 0.78, lineCap: 'round', lineJoin: 'round' }).bindPopup(createTimelineMapPopup(entry)).addTo(layer);
    }
    if (!entry.location) return;
    const marker = L.marker([entry.location.lat, entry.location.lng], {
      timelineEntryId: entry.id,
      icon: L.divIcon({ className: 'timeline-map-marker-wrap', html: createTimelineMapMarkerElement(entry), iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -13] })
    }).bindPopup(createTimelineMapPopup(entry));
    layer.addLayer(marker);
  });
  return layer;
}

/**
 * Centers the main map on a timeline entry and opens its marker popup when available.
 * @param {object} track Track owning the requested timeline entry.
 * @param {string} entryId Identifier of the normalized timeline entry.
 * @returns {void} Updates the highlighted map layer and viewport.
 */
function focusTimelineEntryOnMap(track, entryId) {
  setHighlightedTrack(track.id);
  const entry = normalizeTrackTimeline(track).map((item) => locateTimelineEntryOnTrack(track, item)).find((item) => item.id === entryId);
  if (!entry?.location) return;
  state.map.panTo([entry.location.lat, entry.location.lng]);
  const timelineLayer = state.layers.get(track.id)?.timelineLayer;
  timelineLayer?.eachLayer((layer) => {
    if (layer.options?.timelineEntryId === entryId) layer.openPopup();
  });
}
function photoDisplayUrl(photo) {
  return photo?.objectUrl || photo?.externalUrl || photo?.sourceUrl || photo?.url || '';
}
function collectTrackPhotoBlobIds(tracks) {
  return [...new Set((tracks || []).flatMap((track) => normalizePhotos(track?.photos).map((photo) => photo.blobId).filter(Boolean)))];
}
async function hydrateTrackPhotos(track, photoBlobMap = null) {
  const photos = normalizePhotos(track.photos).map((photo) => ({ ...photo }));
  for (const photo of photos) {
    if (photo.blobId) {
      const stored = photoBlobMap?.get(photo.blobId) ?? await get(STORES.photos, photo.blobId);
      if (stored?.blob instanceof Blob) {
        photo.objectUrl = blobToObjectUrl(stored.blob);
      } else {
        photo.blobId = null;
      }
    }
    photo.url = photoDisplayUrl(photo);
  }
  return { ...track, photos };
}
async function hydrateTracksPhotos(tracks) {
  const photoRecords = await getMany(STORES.photos, collectTrackPhotoBlobIds(tracks));
  const photoBlobMap = new Map(photoRecords.map((entry) => [entry.id, entry]));
  const hydrated = [];
  for (const track of tracks) hydrated.push(await hydrateTrackPhotos(track, photoBlobMap));
  return hydrated;
}
async function prepareTrackPhotosForStorage(track) {
  const photos = normalizePhotos(track.photos).map((photo) => ({ ...photo }));
  const photoEntries = [];
  for (const photo of photos) {
    if (photo.url && isDataImageUrl(photo.url)) {
      const blobId = photo.blobId || id('photo');
      const blob = await dataUrlToBlob(photo.url);
      photoEntries.push({ id: blobId, blob, updatedAt: isoNow() });
      photo.blobId = blobId;
      photo.inlineLoaded = true;
      photo.objectUrl = null;
      photo.externalUrl = null;
      photo.url = null;
    } else if (photo.externalUrl || (photo.url && isRenderablePhotoUrl(photo.url))) {
      photo.externalUrl = photo.externalUrl || photo.url;
      photo.url = null;
    }
    photo.objectUrl = null;
  }
  if (photoEntries.length) await putMany(STORES.photos, photoEntries);
  return { ...track, photos };
}
async function serializeTrackForBackup(track) {
  const photos = [];
  for (const photo of normalizePhotos(track.photos)) {
    const serialized = { ...photo, objectUrl: null };
    if (serialized.blobId) {
      const stored = await get(STORES.photos, serialized.blobId);
      if (stored?.blob instanceof Blob) {
        serialized.url = await blobToDataUrl(stored.blob);
      }
    } else {
      serialized.url = serialized.externalUrl || serialized.sourceUrl || null;
    }
    photos.push(serialized);
  }
  return { ...track, photos, lastChanged: trackLastChanged(track) || track.importedAt || isoNow() };
}
async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
async function deleteTrackPhotoBlobs(track) {
  for (const photo of normalizePhotos(track?.photos)) {
    if (photo.blobId) await del(STORES.photos, photo.blobId);
  }
  revokeTrackPhotoUrls(track);
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

/**
 * Finds the local route heading at a photo location using the nearest track point.
 * @param {Array<object>} points Ordered geographic track points.
 * @param {object} location Geographic photo location with latitude and longitude.
 * @returns {number} Heading in degrees clockwise from north, or zero without a usable segment.
 */
function trackHeadingAtLocation(points, location) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  const target = { lat: Number(location?.lat), lng: Number(location?.lng) };
  if (!Number.isFinite(target.lat) || !Number.isFinite(target.lng)) return 0;
  let closestIndex = -1;
  let closestDistance = Infinity;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lng)) continue;
    const distance = haversine(target, point);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  }
  if (closestIndex < 0) return 0;
  let startIndex = closestIndex - 1;
  let endIndex = closestIndex + 1;
  if (startIndex < 0) startIndex = 0;
  if (endIndex >= points.length) endIndex = points.length - 1;
  if (startIndex === endIndex) return 0;
  return bearingDegrees(points[startIndex], points[endIndex]);
}
function parsePointTime(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isFinite(timestamp)) return timestamp;
  return null;
}
function profileGradeAtPoint(points, index) {
  if (!Array.isArray(points) || index < 0 || index >= points.length) return null;
  const current = points[index];
  const previous = points[Math.max(0, index - 1)];
  const next = points[Math.min(points.length - 1, index + 1)];
  let left = previous;
  let right = next;
  if (previous === current) left = current;
  if (next === current) right = current;
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
  let className = 'km-marker';
  if (highlighted) className += ' is-highlighted';
  return `<span class="${className}" style="--marker-color:${color}">${label}</span>`;
}
function arrowIconHtml(color, rotation, highlighted) {
    let className = 'track-arrow';
    if (highlighted) className += ' is-highlighted';
    return `<span class="${className}" style="--arrow-color:${color}; --arrow-rotation:${(rotation ?? 0) + 90}deg"></span>`;
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
  let points = [];
  if (Array.isArray(track.points)) points = track.points.map((point) => ({ ...point }));
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
  let derivedDurationHours = null;
  if (firstTime != null && lastTime != null && lastTime > firstTime) derivedDurationHours = (lastTime - firstTime) / 3600000;
  const durationHours = track.durationHours ?? derivedDurationHours;
  let avgSpeedKmh = null;
  if (durationHours && durationHours > 0) avgSpeedKmh = Number((distanceKm / durationHours).toFixed(1));
  let elevationMinM = null;
  let elevationMaxM = null;
  if (elevationValues.length) {
    elevationMinM = Math.min(...elevationValues);
    elevationMaxM = Math.max(...elevationValues);
  }
  return {
    ...track,
    points,
    distanceKm: Number((track.distanceKm ?? distanceKm).toFixed(2)),
    pointCount: track.pointCount ?? points.length,
    hasElevation: elevationValues.length >= 2,
    elevationGainM: track.elevationGainM ?? Math.round(elevationGainM),
    elevationLossM: track.elevationLossM ?? Math.round(elevationLossM),
    elevationMinM: track.elevationMinM ?? elevationMinM,
    elevationMaxM: track.elevationMaxM ?? elevationMaxM,
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
    let normalizedElevation = null;
    if (Number.isFinite(elevation)) normalizedElevation = elevation;
    return { lat: Number(node.getAttribute('lat')), lng: Number(node.getAttribute('lon')), ele: normalizedElevation, time: node.querySelector('time')?.textContent || null, cumulativeKm: 0, cumulativeTimeSec: 0, cumulativeAscentM: 0 };
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
  let durationHours = null;
  if (firstTime != null && lastTime != null && lastTime > firstTime) durationHours = (lastTime - firstTime) / 3600000;
  let avgSpeedKmh = null;
  if (durationHours && durationHours > 0) avgSpeedKmh = Number((distanceKm / durationHours).toFixed(1));
  let elevationMinM = null;
  let elevationMaxM = null;
  if (elevationValues.length) {
    elevationMinM = Math.min(...elevationValues);
    elevationMaxM = Math.max(...elevationValues);
  }
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
    elevationMinM,
    elevationMaxM,
    durationHours,
    avgSpeedKmh
  };
}

function buildTrackRecord({ gpxText, fileName, source, type, account, description = null, photos = null, meta = null }) {
  const parsed = parseGpx(gpxText);
  const timestamp = isoNow();
  const surfaceSegments = normalizeRangeSegments(meta?.surfaceSegments);
  const wayTypeSegments = normalizeRangeSegments(meta?.wayTypeSegments);
  let trackPhotos = parsed.photos;
  if (Array.isArray(photos) && photos.length) trackPhotos = photos;
  let komootUrl = null;
  if (source === 'komoot' && account?.sourceTrackId) komootUrl = `https://www.komoot.de/tour/${account.sourceTrackId}`;
  let dateStart = resolveTrackDate(parsed.dateStart, meta?.dateStart);
  if (source === 'komoot') dateStart = resolveTrackDate(meta?.dateStart, parsed.dateStart);
  let avgSpeedKmh = parsed.avgSpeedKmh ?? null;
  if (meta?.durationHours) avgSpeedKmh = Number((parsed.distanceKm / meta.durationHours).toFixed(1));
  let surfaces = segmentValues(surfaceSegments);
  const metaSurfaces = normalizeTagList(meta?.surfaces);
  if (metaSurfaces.length) surfaces = metaSurfaces;
  let wayTypes = segmentValues(wayTypeSegments);
  const metaWayTypes = normalizeTagList(meta?.wayTypes);
  if (metaWayTypes.length) wayTypes = metaWayTypes;
  const track = {
    id: id('track'),
    name: parsed.name || fileName?.replace(/\.gpx$/i, '') || t('unnamedTrack'),
    description: normalizeTrackDescription(description, parsed.description),
    photos: normalizePhotos(trackPhotos),
    source,
    type: trackType(type),
    accountId: account?.id ?? null,
    accountEmail: account?.email ?? null,
    accountLabel: account?.label ?? null,
    sourceTrackId: account?.sourceTrackId ?? null,
    komootUrl,
    importedAt: timestamp,
    lastChanged: timestamp,
    dateStart,
    distanceKm: parsed.distanceKm,
    pointCount: parsed.pointCount,
    hasElevation: parsed.hasElevation,
    elevationGainM: parsed.elevationGainM,
    elevationLossM: parsed.elevationLossM,
    elevationMinM: parsed.elevationMinM,
    elevationMaxM: parsed.elevationMaxM,
    durationHours: meta?.durationHours ?? parsed.durationHours ?? null,
    avgSpeedKmh,
    sport: meta?.sport ?? null,
    surfaces,
    wayTypes,
    surfaceSegments,
    wayTypeSegments,
    directions: normalizeDirections(meta?.directions),
    favorite: false,
    tags: [],
    color: null,
    gpxText,
    points: parsed.points
  };
  track.color = defaultTrackColor(track);
  track.signature = signature(track); return track;
}

function normalizedElementLabel(value) {
  if (typeof value === 'string') return cleanText(value.replace(/^[a-z]+#/, ''));
  return cleanText(value);
}
const DETAIL_VALUE_LABELS = {
  asphalt: { de: 'Asphalt', en: 'Asphalt', fr: 'Asphalte' },
  paved: { de: 'Befestigt', en: 'Paved', fr: 'Revetu' },
  paving_stones: { de: 'Pflastersteine', en: 'Paving stones', fr: 'Paves' },
  compacted: { de: 'Verdichtet', en: 'Compacted', fr: 'Compacte' },
  fine_gravel: { de: 'Feiner Schotter', en: 'Fine gravel', fr: 'Gravier fin' },
  gravel: { de: 'Schotter', en: 'Gravel', fr: 'Gravier' },
  cobblestone: { de: 'Kopfsteinpflaster', en: 'Cobblestone', fr: 'Paves anciens' },
  unpaved: { de: 'Unbefestigt', en: 'Unpaved', fr: 'Non revetu' },
  ground: { de: 'Naturboden', en: 'Ground', fr: 'Sol naturel' },
  dirt: { de: 'Erde', en: 'Dirt', fr: 'Terre' },
  grass: { de: 'Wiese', en: 'Grass', fr: 'Herbe' },
  sand: { de: 'Sand', en: 'Sand', fr: 'Sable' },
  cycleway: { de: 'Radweg', en: 'Cycleway', fr: 'Piste cyclable' },
  minor_road: { de: 'Nebenstrasse', en: 'Minor road', fr: 'Route secondaire' },
  track: { de: 'Wirtschaftsweg', en: 'Track', fr: 'Piste' },
  path: { de: 'Pfad', en: 'Path', fr: 'Sentier' },
  street: { de: 'Strasse', en: 'Street', fr: 'Rue' },
  road: { de: 'Strasse', en: 'Road', fr: 'Route' },
  service_road: { de: 'Serviceweg', en: 'Service road', fr: 'Voie de service' },
  footpath: { de: 'Fussweg', en: 'Footpath', fr: 'Chemin pieton' },
  singletrack: { de: 'Singletrail', en: 'Singletrack', fr: 'Singletrack' },
  way: { de: 'Pfad', en: 'Path', fr: 'Sentier' },
  trail_d1: { de: 'Wanderpfad', en: 'Hiking trail', fr: 'Sentier de randonnee' },
  trail_d2: { de: 'Bergwanderpfad', en: 'Mountain trail', fr: 'Sentier de montagne' }
};
const DIRECTION_VALUE_LABELS = {
  s: { de: 'Start', en: 'Start', fr: 'Depart' },
  tls: { de: 'Ampel', en: 'Traffic lights', fr: 'Feu tricolore' },
  tl: { de: 'Links abbiegen', en: 'Turn left', fr: 'Tourner a gauche' },
  tr: { de: 'Rechts abbiegen', en: 'Turn right', fr: 'Tourner a droite' },
  tsl: { de: 'Leicht links abbiegen', en: 'Turn slight left', fr: 'Tourner legerement a gauche' },
  tsr: { de: 'Leicht rechts abbiegen', en: 'Turn slight right', fr: 'Tourner legerement a droite' },
  ts: { de: 'Geradeaus weiter', en: 'Continue straight', fr: 'Continuer tout droit' },
  tfl: { de: 'Scharf links abbiegen', en: 'Turn far left', fr: 'Tourner fortement a gauche' },
  tfr: { de: 'Scharf rechts abbiegen', en: 'Turn far right', fr: 'Tourner fortement a droite' },
  kl: { de: 'Links halten', en: 'Keep left', fr: 'Rester a gauche' },
  kr: { de: 'Rechts halten', en: 'Keep right', fr: 'Rester a droite' },
  sl: { de: 'Leicht links', en: 'Slight left', fr: 'Legerement a gauche' },
  sr: { de: 'Leicht rechts', en: 'Slight right', fr: 'Legerement a droite' },
  shl: { de: 'Scharf links', en: 'Sharp left', fr: 'Fort a gauche' },
  shr: { de: 'Scharf rechts', en: 'Sharp right', fr: 'Fort a droite' },
  c: { de: 'Geradeaus', en: 'Continue straight', fr: 'Tout droit' },
  tu: { de: 'Wenden', en: 'Make a U-turn', fr: 'Faire demi-tour' },
  traffic_lights: { de: 'Ampel', en: 'Traffic lights', fr: 'Feu tricolore' },
  departure: { de: 'Start', en: 'Start', fr: 'Depart' },
  start: { de: 'Start', en: 'Start', fr: 'Depart' },
  destination: { de: 'Ziel', en: 'Destination', fr: 'Arrivee' },
  finish: { de: 'Ziel', en: 'Finish', fr: 'Arrivee' },
  straight: { de: 'Geradeaus', en: 'Straight ahead', fr: 'Tout droit' },
  continue: { de: 'Weiter', en: 'Continue', fr: 'Continuer' },
  continue_straight: { de: 'Geradeaus weiter', en: 'Continue straight', fr: 'Continuer tout droit' },
  turn_left: { de: 'Links abbiegen', en: 'Turn left', fr: 'Tourner a gauche' },
  turn_right: { de: 'Rechts abbiegen', en: 'Turn right', fr: 'Tourner a droite' },
  slight_left: { de: 'Leicht links', en: 'Slight left', fr: 'Legerement a gauche' },
  slight_right: { de: 'Leicht rechts', en: 'Slight right', fr: 'Legerement a droite' },
  sharp_left: { de: 'Scharf links', en: 'Sharp left', fr: 'Fort a gauche' },
  sharp_right: { de: 'Scharf rechts', en: 'Sharp right', fr: 'Fort a droite' },
  keep_left: { de: 'Links halten', en: 'Keep left', fr: 'Rester a gauche' },
  keep_right: { de: 'Rechts halten', en: 'Keep right', fr: 'Rester a droite' },
  u_turn: { de: 'Wenden', en: 'Make a U-turn', fr: 'Faire demi-tour' },
  uturn: { de: 'Wenden', en: 'Make a U-turn', fr: 'Faire demi-tour' },
  roundabout: { de: 'Kreisverkehr', en: 'Roundabout', fr: 'Rond-point' },
  enter_roundabout: { de: 'In den Kreisverkehr', en: 'Enter roundabout', fr: 'Entrer dans le rond-point' },
  exit_roundabout: { de: 'Kreisverkehr verlassen', en: 'Exit roundabout', fr: 'Sortir du rond-point' },
  merge: { de: 'Einfädeln', en: 'Merge', fr: 'S inserer' },
  fork: { de: 'Gabelung', en: 'Fork', fr: 'Bifurcation' },
  ferry: { de: 'Fähre', en: 'Ferry', fr: 'Ferry' },
  stairs: { de: 'Treppe', en: 'Stairs', fr: 'Escaliers' },
  tunnel: { de: 'Tunnel', en: 'Tunnel', fr: 'Tunnel' }
};
function displayDetailValue(value) {
  const key = `${value ?? ''}`.trim().toLowerCase();
  if (!key) return '';
  const mapped = DETAIL_VALUE_LABELS[key];
  if (mapped) return mapped[lang()] || mapped.de || mapped.en || value;
  return key.replaceAll('_', ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}
function directionValueLabel(value) {
  const key = cleanText(value).toLowerCase();
  if (!key) return '';
  const mapped = DIRECTION_VALUE_LABELS[key];
  if (mapped) return mapped[lang()] || mapped.de || mapped.en || value;
  return '';
}
function directionLooksTechnical(value) {
  const text = cleanText(value);
  if (!text) return false;
  return /^[A-Z0-9_#-]{2,}$/.test(text) || /^[a-z0-9_]+$/.test(text);
}
function humanizeDirectionFallback(value) {
  return cleanText(value).replaceAll('_', ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}
function translateDirectionText(value) {
  const text = cleanText(value);
  if (!text) return '';
  const exact = directionValueLabel(text);
  if (exact) return exact;
  const replaced = text.replace(/\b[A-Za-z0-9_#-]+\b/g, (token) => {
    const translated = directionValueLabel(token);
    return translated || token;
  });
  if (replaced !== text) return replaced;
  if (directionLooksTechnical(text)) return humanizeDirectionFallback(text);
  return text;
}
function uniqueTextList(values) { return [...new Set((values ?? []).map((value) => cleanText(value)).filter(Boolean))]; }
function normalizeTagList(value) {
  if (Array.isArray(value)) return uniqueTextList(value.map((item) => item?.name || item?.type || item?.label || item?.surface || item?.surface_type || item?.way_type || item?.wayType || item?.value || item?.slug || normalizedElementLabel(item?.element) || item));
  if (value && typeof value === 'object') {
    const nested = [];
    if (Array.isArray(value.items)) nested.push(...value.items);
    if (Array.isArray(value.values)) nested.push(...value.values);
    if (Array.isArray(value.surfaces)) nested.push(...value.surfaces);
    if (Array.isArray(value.way_types)) nested.push(...value.way_types);
    if (Array.isArray(value.wayTypes)) nested.push(...value.wayTypes);
    if (nested.length) return uniqueTextList(nested.map((item) => item?.name || item?.type || item?.label || item?.surface || item?.surface_type || item?.way_type || item?.wayType || item?.value || item?.slug || normalizedElementLabel(item?.element) || item));
  }
  return [];
}
function normalizeRangeSegments(value) {
  let items = [];
  if (Array.isArray(value)) {
    items = value;
  } else if (value && typeof value === 'object') {
    if (Array.isArray(value.items)) items.push(...value.items);
    if (Array.isArray(value.values)) items.push(...value.values);
    if (Array.isArray(value.surfaces)) items.push(...value.surfaces);
    if (Array.isArray(value.way_types)) items.push(...value.way_types);
    if (Array.isArray(value.wayTypes)) items.push(...value.wayTypes);
  }
  return items.map((item) => {
    if (!item || typeof item !== 'object') return null;
    const from = Number(item.from ?? item.start ?? item.begin ?? item.indexFrom);
    const to = Number(item.to ?? item.end ?? item.stop ?? item.indexTo);
    const segmentValue = cleanText(item?.value || item?.name || item?.type || item?.label || item?.surface || item?.surface_type || item?.way_type || item?.wayType || item?.slug || normalizedElementLabel(item?.element));
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || !segmentValue) return null;
    return {
      from: Math.max(0, Math.round(from)),
      to: Math.max(0, Math.round(to)),
      value: segmentValue,
      raw: cleanText(item?.element || item?.slug || item?.type || item?.name || item?.value) || segmentValue
    };
  }).filter(Boolean);
}
function segmentValues(segments) {
  return [...new Set(normalizeRangeSegments(segments).map((segment) => segment.value).filter(Boolean))];
}

/**
 * Builds evenly spaced reference points so a long track does not create one OSM request per GPX point.
 * @param {Array<object>} points Track points with latitude and longitude values.
 * @returns {Array<{pointIndex: number, lat: number, lng: number}>} Bounded set of valid route reference points.
 */
function buildOsmAnalysisSamples(points) {
  if (!Array.isArray(points) || points.length < 2) return [];
  const validPoints = [];
  points.forEach((point, pointIndex) => {
    if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lng)) return;
    validPoints.push({ pointIndex, lat: point.lat, lng: point.lng });
  });
  if (validPoints.length < 2) return [];
  let totalDistanceM = 0;
  for (let index = 1; index < validPoints.length; index += 1) {
    totalDistanceM += haversine(validPoints[index - 1], validPoints[index]) * 1000;
  }
  let minimumDistanceM = OSM_ANALYSIS_SAMPLE_DISTANCE_M;
  if (totalDistanceM / minimumDistanceM > OSM_ANALYSIS_MAX_SAMPLES - 1) {
    minimumDistanceM = totalDistanceM / (OSM_ANALYSIS_MAX_SAMPLES - 1);
  }
  const samples = [validPoints[0]];
  let distanceSinceSampleM = 0;
  for (let index = 1; index < validPoints.length - 1; index += 1) {
    distanceSinceSampleM += haversine(validPoints[index - 1], validPoints[index]) * 1000;
    if (distanceSinceSampleM < minimumDistanceM) continue;
    samples.push(validPoints[index]);
    distanceSinceSampleM = 0;
  }
  const lastPoint = validPoints.at(-1);
  if (samples.at(-1)?.pointIndex !== lastPoint.pointIndex) samples.push(lastPoint);
  return samples;
}

/**
 * Splits reference points into small, sequential Overpass query groups.
 * @param {Array<object>} samples OSM analysis reference points.
 * @returns {Array<Array<object>>} Batches safe to send one after another.
 */
function splitOsmAnalysisSamples(samples) {
  const chunks = [];
  for (let start = 0; start < samples.length; start += OSM_ANALYSIS_QUERY_CHUNK_SIZE) {
    chunks.push(samples.slice(start, start + OSM_ANALYSIS_QUERY_CHUNK_SIZE));
  }
  return chunks;
}

/**
 * Creates an Overpass query for highway-tagged ways near one batch of track reference points.
 * @param {Array<{lat: number, lng: number}>} samples Reference points of one query batch.
 * @returns {string} Overpass QL query requesting tags and geometry only.
 */
function buildOsmWayTypeQuery(samples) {
  const clauses = samples.map((sample) => `way(around:${OSM_ANALYSIS_MATCH_DISTANCE_M},${sample.lat.toFixed(6)},${sample.lng.toFixed(6)})[highway];`).join('\n');
  return `[out:json][timeout:25];\n(\n${clauses}\n);\nout tags geom;`;
}

/**
 * Converts an Overpass HTTP status into a helpful retry instruction instead of exposing a technical status alone.
 * @param {number} status HTTP status returned by the OSM service.
 * @returns {string} Localized explanation with a safe next action.
 */
function osmWayTypesRequestError(status) {
  if (status === 429) return t('osmWayTypesRateLimited');
  if (status === 406) return t('osmWayTypesRequestRejected');
  if (status >= 500) return t('osmWayTypesServiceUnavailable');
  return t('osmWayTypesRequestFailed', { status });
}

/**
 * Pauses a retry without blocking the browser event loop.
 * @param {number} durationMs Time to wait in milliseconds.
 * @returns {Promise<void>} Resolves after the requested delay.
 */
function waitForOsmAnalysisRetry(durationMs) {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

/**
 * Requests nearby OSM ways for one group of reference points.
 * @param {Array<{lat: number, lng: number}>} samples Reference points of one query batch.
 * @returns {Promise<Array<object>>} OSM way elements with tags and geometry.
 */
async function fetchOsmWayTypeWays(samples) {
  const url = `${OSM_OVERPASS_ENDPOINT}?data=${encodeURIComponent(buildOsmWayTypeQuery(samples))}`;
  let retryAvailable = true;
  while (true) {
    const response = await fetch(url, { cache: 'no-store' });
    if (response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        throw new Error(t('osmWayTypesInvalidResponse'));
      }
      if (!Array.isArray(payload?.elements)) throw new Error(t('osmWayTypesInvalidResponse'));
      return payload.elements.filter((element) => element?.type === 'way' && element?.tags?.highway && Array.isArray(element?.geometry));
    }
    const canRetry = response.status === 429 || response.status === 406;
    if (!canRetry || !retryAvailable) throw new Error(osmWayTypesRequestError(response.status));
    retryAvailable = false;
    setStatus(t('osmWayTypesWaitingToRetry'), false, true);
    await waitForOsmAnalysisRetry(OSM_ANALYSIS_RETRY_DELAY_MS);
  }
}

/**
 * Calculates the shortest local planar distance from a point to one OSM line segment.
 * @param {{lat: number, lng: number}} point Track reference point.
 * @param {{lat: number, lon: number}} start First OSM geometry coordinate.
 * @param {{lat: number, lon: number}} end Second OSM geometry coordinate.
 * @returns {number} Distance in meters.
 */
function osmPointToSegmentDistanceM(point, start, end) {
  const metersPerLatitudeDegree = 110540;
  const metersPerLongitudeDegree = 111320 * Math.cos(point.lat * Math.PI / 180);
  const endX = (end.lon - start.lon) * metersPerLongitudeDegree;
  const endY = (end.lat - start.lat) * metersPerLatitudeDegree;
  const pointX = (point.lng - start.lon) * metersPerLongitudeDegree;
  const pointY = (point.lat - start.lat) * metersPerLatitudeDegree;
  const segmentLengthSquared = endX * endX + endY * endY;
  if (segmentLengthSquared === 0) return Math.hypot(pointX, pointY);
  let projection = (pointX * endX + pointY * endY) / segmentLengthSquared;
  if (projection < 0) projection = 0;
  if (projection > 1) projection = 1;
  return Math.hypot(pointX - projection * endX, pointY - projection * endY);
}

/**
 * Finds the closest highway-tagged OSM way for one sampled track point.
 * @param {{lat: number, lng: number}} sample Track reference point.
 * @param {Array<object>} ways OSM ways returned for the sample batch.
 * @returns {string|null} OSM highway value, or null when no way is close enough.
 */
function closestOsmWayType(sample, ways) {
  let closestValue = null;
  let closestDistanceM = OSM_ANALYSIS_MATCH_DISTANCE_M;
  ways.forEach((way) => {
    const value = cleanText(way?.tags?.highway).toLowerCase();
    const geometry = way?.geometry;
    if (!value || !Array.isArray(geometry) || geometry.length < 2) return;
    for (let index = 1; index < geometry.length; index += 1) {
      const distanceM = osmPointToSegmentDistanceM(sample, geometry[index - 1], geometry[index]);
      if (distanceM > closestDistanceM) continue;
      closestDistanceM = distanceM;
      closestValue = value;
    }
  });
  return closestValue;
}

/**
 * Turns sampled OSM way matches into contiguous point-index ranges understood by Trailthread's segment renderers.
 * @param {Array<{pointIndex: number, value: string|null}>} matches Ordered sampled OSM way matches.
 * @param {number} pointCount Number of points in the original track.
 * @param {boolean} complete Whether every planned OSM query group completed successfully.
 * @returns {Array<object>} Normalized point-indexed way-type segments.
 */
function buildOsmWayTypeSegments(matches, pointCount, complete = true) {
  const segments = [];
  let activeSegment = null;
  matches.forEach((match, index) => {
    if (!match.value) {
      activeSegment = null;
      return;
    }
    let from = 0;
    let to = pointCount - 1;
    if (index > 0) from = Math.floor((matches[index - 1].pointIndex + match.pointIndex) / 2);
    if (index < matches.length - 1) to = Math.floor((match.pointIndex + matches[index + 1].pointIndex) / 2);
    if (!complete && index === matches.length - 1) to = Math.min(pointCount - 1, match.pointIndex + 1);
    if (to <= from && from < pointCount - 1) to = from + 1;
    if (to <= from) return;
    if (activeSegment && activeSegment.value === match.value && activeSegment.to >= from - 1) {
      activeSegment.to = to;
      return;
    }
    activeSegment = { from, to, value: match.value, raw: match.value };
    segments.push(activeSegment);
  });
  return normalizeRangeSegments(segments);
}

/**
 * Persists complete or partial OSM way-type segments and makes the analysed track visible on the map.
 * @param {object} track Track receiving the derived OSM data.
 * @param {Array<object>} samples All reference points planned for the analysis.
 * @param {Array<{pointIndex: number, value: string|null}>} matches Successfully processed OSM matches.
 * @param {number} totalGroups Number of query groups planned for the analysis.
 * @param {boolean} complete Whether all query groups completed.
 * @returns {Promise<{track: object, segments: Array<object>}|null>} Stored result, or null without usable segments.
 */
async function persistOsmWayTypeAnalysis(track, samples, matches, totalGroups, complete) {
  const wayTypeSegments = buildOsmWayTypeSegments(matches, track.points.length, complete);
  if (!wayTypeSegments.length) return null;
  const updatedTrack = touchTrack(track, {
    wayTypes: segmentValues(wayTypeSegments),
    wayTypeSegments,
    osmWayTypeAnalysis: {
      source: 'openstreetmap',
      analyzedAt: isoNow(),
      sampledPoints: samples.length,
      matchedPoints: matches.filter((match) => !!match.value).length,
      processedGroups: Math.ceil(matches.length / OSM_ANALYSIS_QUERY_CHUNK_SIZE),
      totalGroups,
      complete
    }
  });
  await put(STORES.tracks, updatedTrack);
  state.tracks = state.tracks.map((item) => {
    if (item.id === updatedTrack.id) return updatedTrack;
    return item;
  });
  state.selectedTrackIds.add(updatedTrack.id);
  state.highlightedTrackId = updatedTrack.id;
  if (!state.settings.segmentOverlayMode) {
    state.settings.segmentOverlayMode = true;
    await saveSettings();
  }
  renderAll();
  syncMapForSelectionChange();
  if (state.trackDetailUi.trackId === updatedTrack.id) renderTrackDetailDialog();
  return { track: updatedTrack, segments: wayTypeSegments };
}

/**
 * Loads highway types from OSM for one local track and persists only the derived segment data.
 * @param {string} trackId Identifier of the track selected in the library.
 * @returns {Promise<void>} Resolves after the analysis result or error state is rendered.
 */
async function analyseTrackWayTypesFromOsm(trackId) {
  const track = state.tracks.find((item) => item.id === trackId);
  if (!track) return;
  const samples = buildOsmAnalysisSamples(track.points);
  if (samples.length < 2) {
    setStatus(t('osmWayTypesNeedsTrack'), true);
    return;
  }
  osmAnalysisTrackId = trackId;
  renderLibrary();
  const matches = [];
  const chunks = splitOsmAnalysisSamples(samples);
  try {
    for (let index = 0; index < chunks.length; index += 1) {
      setStatus(t('osmWayTypesProgress', { current: index + 1, total: chunks.length }), false, true);
      const ways = await fetchOsmWayTypeWays(chunks[index]);
      chunks[index].forEach((sample) => {
        matches.push({ pointIndex: sample.pointIndex, value: closestOsmWayType(sample, ways) });
      });
    }
    const result = await persistOsmWayTypeAnalysis(track, samples, matches, chunks.length, true);
    if (!result) {
      setStatus(t('osmWayTypesNoMatch'), true);
      return;
    }
    setStatus(t('osmWayTypesDone', {
      count: result.track.wayTypes.length,
      segments: result.segments.length,
      matched: result.track.osmWayTypeAnalysis.matchedPoints,
      sampled: result.track.osmWayTypeAnalysis.sampledPoints
    }));
  } catch (error) {
    const hasCompleteExistingAnalysis = !!track.osmWayTypeAnalysis && track.osmWayTypeAnalysis.complete !== false;
    let partialResult = null;
    if (!hasCompleteExistingAnalysis) partialResult = await persistOsmWayTypeAnalysis(track, samples, matches, chunks.length, false);
    if (partialResult) {
      setStatus(t('osmWayTypesPartialSaved', {
        count: partialResult.track.wayTypes.length,
        segments: partialResult.segments.length,
        processed: partialResult.track.osmWayTypeAnalysis.processedGroups,
        total: partialResult.track.osmWayTypeAnalysis.totalGroups
      }), true);
      return;
    }
    setStatus(error?.message || t('osmWayTypesFailed'), true);
  } finally {
    osmAnalysisTrackId = null;
    renderLibrary();
  }
}
function segmentPercentages(segments) {
  const normalized = normalizeRangeSegments(segments);
  if (!normalized.length) return [];
  const totals = new Map();
  let sum = 0;
  normalized.forEach((segment) => {
    const span = Math.max(0, Number(segment.to) - Number(segment.from));
    if (!span || !segment.value) return;
    totals.set(segment.value, (totals.get(segment.value) || 0) + span);
    sum += span;
  });
  if (!sum) return [];
  return [...totals.entries()]
    .map(([value, amount]) => ({ value, percent: Math.round((amount / sum) * 100) }))
    .filter((item) => item.percent > 0)
    .sort((a, b) => b.percent - a.percent || a.value.localeCompare(b.value));
}
/**
 * Renders surface or way-type percentage chips into a profile breakdown container.
 * @param {HTMLElement|null} container Target element for the segment chips.
 * @param {Array<object>} segments Raw track segment ranges.
 * @param {'surface'|'waytype'} type Segment category that controls the swatch appearance.
 * @returns {void}
 */
function renderProfileSegmentBreakdown(container, segments, type) {
  if (!container) return;
  container.replaceChildren();
  const items = segmentPercentages(segments);
  if (!items.length) {
    const empty = document.createElement('span');
    empty.className = 'map-segment-empty';
    empty.textContent = t('analysisNone');
    container.append(empty);
    return;
  }
  items.slice(0, 5).forEach(({ value, percent }) => {
    const fragment = el.profileSegmentChipTemplate.content.cloneNode(true);
    const swatch = fragment.querySelector('.profile-segment-swatch-line');
    const label = fragment.querySelector('.profile-segment-chip-label');
    const percentage = fragment.querySelector('.profile-segment-chip-percent');
    swatch.setAttribute('stroke', 'rgba(248, 251, 250, 0.92)');
    swatch.setAttribute('stroke-width', '3');
    swatch.setAttribute('stroke-linecap', 'round');
    swatch.setAttribute('stroke-dasharray', wayTypeSegmentDash(value));
    if (type === 'surface') {
      swatch.setAttribute('stroke', surfaceSegmentColor(value));
      swatch.setAttribute('stroke-width', '4');
      swatch.removeAttribute('stroke-dasharray');
    }
    label.textContent = displayDetailValue(value);
    percentage.textContent = `${percent}%`;
    container.append(fragment);
  });
}
function normalizeDirections(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const rawInstruction = cleanText(item?.instruction || item?.text || item?.name || item?.title || item?.hint);
    const distanceRaw = item?.distanceM ?? item?.distance ?? item?.segment_length ?? item?.length ?? null;
    let distanceM = null;
    if (Number.isFinite(Number(distanceRaw))) distanceM = Math.round(Number(distanceRaw));
    let prefixDistanceM = 0;
    if (Number.isFinite(Number(item?.prefixDistanceM))) prefixDistanceM = Math.max(0, Math.round(Number(item.prefixDistanceM)));
    const rawType = cleanText(item?.type || item?._type || item?.icon || item?.direction);
    if (!rawInstruction && !rawType && !Number.isFinite(distanceM)) return null;
    const instruction = translateDirectionText(rawInstruction || rawType);
    const type = translateDirectionText(rawType);
    return {
      index,
      instruction: instruction || type || `${t('analysisStepFallback')} ${index + 1}`,
      distanceM,
      prefixDistanceM,
      type: type || null,
      rawInstruction: rawInstruction || null,
      rawType: rawType || null
    };
  }).filter(Boolean);
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
function metaTags(track) {
  const surfaceTags = segmentValues(track.surfaceSegments);
  const wayTypeTags = segmentValues(track.wayTypeSegments);
  let tags = normalizeTagList(track.surfaces);
  if (surfaceTags.length) tags = surfaceTags;
  let wayTypes = normalizeTagList(track.wayTypes);
  if (wayTypeTags.length) wayTypes = wayTypeTags;
  return [...new Set([...tags, ...wayTypes].filter(Boolean))];
}
function ensureLibraryDerivedCache() {
  const currentLanguage = lang();
  if (libraryDerivedCache.tracksRef === state.tracks && libraryDerivedCache.language === currentLanguage) return libraryDerivedCache;
  libraryDerivedCache.tracksRef = state.tracks;
  libraryDerivedCache.language = currentLanguage;
  libraryDerivedCache.sports = [...new Set(state.tracks.map((track) => track.sport).filter(Boolean))].sort();
  libraryDerivedCache.metaTags = [...new Set(state.tracks.flatMap((track) => metaTags(track)).filter(Boolean))].sort((a, b) => a.localeCompare(b, lang()));
  libraryDerivedCache.customTags = [...new Set(state.tracks.flatMap((track) => normalizeTagList(track.tags)).filter(Boolean))].sort((a, b) => a.localeCompare(b, lang()));
  libraryDerivedCache.filteredKey = '';
  libraryDerivedCache.filteredTracks = [];
  libraryDerivedCache.filteredIds = new Set();
  libraryDerivedCache.selectSignatures = { sport: '', tag: '', meta: '' };
  return libraryDerivedCache;
}
function allSports() { return ensureLibraryDerivedCache().sports; }
function allMetaTags() { return ensureLibraryDerivedCache().metaTags; }
function allCustomTags() { return ensureLibraryDerivedCache().customTags; }
function syncSelectOptions(select, items, currentValue, signatureKey) {
  if (!select) return;
  const signature = items.map((item) => `${item.value}:${item.label}`).join('|');
  if (libraryDerivedCache.selectSignatures[signatureKey] !== signature) {
    select.replaceChildren();
    items.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.label;
      select.append(option);
    });
    libraryDerivedCache.selectSignatures[signatureKey] = signature;
  }
  select.value = 'all';
  if (items.some((item) => item.value === currentValue)) select.value = currentValue;
}
function currentLibraryFilterState() {
  return {
    q: el.librarySearchInput?.value.trim().toLowerCase() || '',
    type: el.libraryTypeFilter?.value || 'all',
    favorite: el.libraryFavoriteFilter?.value || 'all',
    sport: el.librarySportFilter?.value || 'all',
    tag: el.libraryTagFilter?.value || 'all',
    meta: el.libraryMetaFilter?.value || 'all',
    sort: el.librarySortSelect?.value || 'imported'
  };
}
function renderLibraryFilters() {
  ensureLibraryDerivedCache();
  const currentFavorite = el.libraryFavoriteFilter.value || 'all';
  const currentSport = el.librarySportFilter.value || 'all';
  const currentTag = el.libraryTagFilter.value || 'all';
  const currentMeta = el.libraryMetaFilter.value || 'all';
  el.libraryFavoriteFilter.value = 'all';
  if (['all', 'favorites', 'non-favorites'].includes(currentFavorite)) el.libraryFavoriteFilter.value = currentFavorite;
  syncSelectOptions(el.librarySportFilter, [{ value: 'all', label: t('filterAllSports') }, ...allSports().map((sport) => ({ value: sport, label: sportLabel(sport) }))], currentSport, 'sport');
  syncSelectOptions(el.libraryTagFilter, [{ value: 'all', label: t('filterAllTags') }, ...allCustomTags().map((tag) => ({ value: tag, label: tag }))], currentTag, 'tag');
  syncSelectOptions(el.libraryMetaFilter, [{ value: 'all', label: t('filterAllDetails') }, ...allMetaTags().map((tag) => ({ value: tag, label: displayDetailValue(tag) }))], currentMeta, 'meta');
}

function filteredTracks() {
  ensureLibraryDerivedCache();
  const { q, type, favorite, sport, tag, meta, sort } = currentLibraryFilterState();
  const cacheKey = [q, type, favorite, sport, tag, meta, sort].join('||');
  if (libraryDerivedCache.tracksRef === state.tracks && libraryDerivedCache.filteredKey === cacheKey) return libraryDerivedCache.filteredTracks;
  let tracks = [...state.tracks];
  if (type !== 'all') tracks = tracks.filter((track) => track.type === type);
  if (favorite === 'favorites') tracks = tracks.filter((track) => !!track.favorite);
  if (favorite === 'non-favorites') tracks = tracks.filter((track) => !track.favorite);
  if (sport !== 'all') tracks = tracks.filter((track) => track.sport === sport);
  if (tag !== 'all') tracks = tracks.filter((track) => normalizeTagList(track.tags).includes(tag));
  if (meta !== 'all') tracks = tracks.filter((track) => metaTags(track).includes(meta));
  if (q) tracks = tracks.filter((track) => [track.name, track.description, track.accountLabel, track.accountEmail, track.source, track.dateStart, track.sport, ...metaTags(track), ...normalizeTagList(track.tags)].filter(Boolean).join(' ').toLowerCase().includes(q));
  tracks.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'distance') return (b.distanceKm ?? 0) - (a.distanceKm ?? 0);
    if (sort === 'date') return `${b.dateStart ?? ''}`.localeCompare(`${a.dateStart ?? ''}`);
    return (b.importedAt ?? '').localeCompare(a.importedAt ?? '');
  });
  libraryDerivedCache.filteredKey = cacheKey;
  libraryDerivedCache.filteredTracks = tracks;
  libraryDerivedCache.filteredIds = new Set(tracks.map((track) => track.id));
  return tracks;
}
function filteredTrackIdSet() {
  filteredTracks();
  return libraryDerivedCache.filteredIds;
}
function visibleSelectedTracks() {
  const visibleIds = filteredTrackIdSet();
  return state.tracks.filter((track) => state.selectedTrackIds.has(track.id) && visibleIds.has(track.id));
}
function refreshLibraryFilterView() {
  renderLibrary();
  renderToggleSelectionButton();
  syncMap();
  renderProfile();
}
function recentTracks() { return [...state.tracks].sort((a, b) => (b.importedAt ?? '').localeCompare(a.importedAt ?? '')).slice(0, 12); }
function activeAccount() { return state.accounts.find((account) => account.id === state.settings.activeAccountId) ?? null; }
function photoCountLabel(count) {
  if (lang() === 'en' || lang() === 'fr') {
    if (count === 1) return `${count} photo`;
    return `${count} photos`;
  }
  if (count === 1) return `${count} Foto`;
  return `${count} Fotos`;
}
async function toggleTrackFavorite(trackId) {
  const track = state.tracks.find((item) => item.id === trackId);
  if (!track) return;
  const updatedTrack = touchTrack(track, { favorite: !track.favorite });
  await put(STORES.tracks, updatedTrack);
  state.tracks = state.tracks.map((item) => {
    if (item.id === updatedTrack.id) return updatedTrack;
    return item;
  });
  renderLibrary();
  renderSelection();
  renderRecent();
  renderProfile();
  syncMap();
}
/**
 * Appends one metadata fact by cloning the shared track fact template.
 * @param {HTMLElement} container Target element for the fact.
 * @param {string} icon Visual symbol for the fact category.
 * @param {string} label Localized fact label without punctuation.
 * @param {string} value Display value for the fact.
 * @returns {void}
 */
function appendTrackFact(container, icon, label, value) {
  const fragment = el.trackFactTemplate.content.cloneNode(true);
  fragment.querySelector('.track-fact-icon').textContent = icon;
  fragment.querySelector('.track-fact-label').textContent = `${label}:`;
  fragment.querySelector('.track-fact-value').textContent = value;
  container.append(fragment);
}
function photoLatLng(photo) {
  const point = photo?.location || photo?.lineLocation || null;
  if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)) return [point.lat, point.lng];
  return null;
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

/**
 * Configures a cloned thumbnail image with safe loading behavior and an accessible label.
 * @param {HTMLImageElement} image Image element from a photo template.
 * @param {object} photo Photo record with URL and optional title.
 * @param {object} track Owning track used as the fallback title.
 * @param {number} index Zero-based position of the photo.
 * @returns {void}
 */
function populatePhotoThumbnailImage(image, photo, track, index) {
  image.src = photo.url;
  image.alt = photo.title || `${track.name} ${index + 1}`;
  image.addEventListener('error', () => image.remove(), { once: true });
  if (/^https?:\/\//i.test(photo.url)) image.referrerPolicy = 'no-referrer';
}

/**
 * Creates a dialog thumbnail from the shared dialog thumbnail template.
 * @param {object} photo Photo record to render.
 * @param {object} track Owning track used for accessible fallback text.
 * @param {number} index Zero-based position of the photo.
 * @returns {{fragment: DocumentFragment, button: HTMLButtonElement}} Cloned thumbnail and its button.
 */
function createPhotoDialogThumbnail(photo, track, index) {
  const fragment = el.photoDialogThumbTemplate.content.cloneNode(true);
  const button = fragment.querySelector('.photo-dialog-thumb');
  const image = fragment.querySelector('img');
  populatePhotoThumbnailImage(image, photo, track, index);
  return { fragment, button };
}

/**
 * Creates a track photo thumbnail from the shared track thumbnail template.
 * @param {object} photo Photo record to render.
 * @param {object} track Owning track used for accessible fallback text.
 * @param {number} index Zero-based position of the photo.
 * @returns {{fragment: DocumentFragment, image: HTMLImageElement}} Cloned thumbnail and its image.
 */
function createTrackPhotoThumbnail(photo, track, index) {
  const fragment = el.trackPhotoThumbTemplate.content.cloneNode(true);
  const image = fragment.querySelector('.track-photo-thumb');
  populatePhotoThumbnailImage(image, photo, track, index);
  return { fragment, image };
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
  el.photoDialogMeta.replaceChildren();
  if (photo.createdAt) appendTrackFact(el.photoDialogMeta, '📅', t('labelDate'), fmtDate(photo.createdAt));
  if (photo.attribution) appendTrackFact(el.photoDialogMeta, '©', t('labelAttribution'), photo.attribution);
  if (photo.location) appendTrackFact(el.photoDialogMeta, '📍', 'GPS', `${photo.location.lat.toFixed(5)}, ${photo.location.lng.toFixed(5)}`);
  el.photoDialogThumbs.replaceChildren();
  photos.forEach((item, index) => {
    const { fragment, button } = createPhotoDialogThumbnail(item, track, index);
    if (index === state.photoDialogUi.index) button.classList.add('is-active');
    button.addEventListener('click', () => {
      state.photoDialogUi.index = index;
      renderPhotoDialog();
    });
    el.photoDialogThumbs.append(fragment);
  });
  el.photoDialogPrev.hidden = photos.length < 2;
  el.photoDialogNext.hidden = photos.length < 2;
  const activeThumb = el.photoDialogThumbs.querySelector('.photo-dialog-thumb.is-active');
  activeThumb?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  renderPhotoDialogFullscreenControl();
}

/**
 * Returns whether the photo dialog currently fills the application viewport.
 * @returns {boolean} True when the photo dialog is in its expanded view.
 */
function isPhotoDialogFullscreen() {
  if (document.fullscreenElement === el.photoDialogSheet) return true;
  return el.photoDialogSheet?.classList.contains('is-fullscreen') === true;
}

/**
 * Updates the label and pressed state of the photo dialog fullscreen control.
 * @returns {void} The button reflects the current dialog layout.
 */
function renderPhotoDialogFullscreenControl() {
  if (!el.photoDialogFullscreenButton) return;
  const isFullscreen = isPhotoDialogFullscreen();
  let label = t('photoFullscreenEnter');
  if (isFullscreen) label = t('photoFullscreenExit');
  el.photoDialogFullscreenButton.setAttribute('aria-label', label);
  el.photoDialogFullscreenButton.setAttribute('title', label);
  el.photoDialogFullscreenButton.setAttribute('aria-pressed', String(isFullscreen));
}

/**
 * Enters native browser fullscreen for the gallery and retains a viewport fallback.
 * @returns {Promise<void>} Resolves after the fullscreen request has settled.
 */
async function enterPhotoDialogFullscreen() {
  if (!el.photoDialogSheet) return;
  el.photoDialogSheet.classList.add('is-fullscreen');
  el.photoDialog.classList.add('is-fullscreen');
  if (typeof el.photoDialogSheet.requestFullscreen === 'function') {
    try {
      await el.photoDialogSheet.requestFullscreen();
    } catch (error) {
      // The viewport-filling gallery remains available when native fullscreen is denied.
    }
  }
  renderPhotoDialogFullscreenControl();
}

/**
 * Leaves native browser fullscreen and resets the viewport-filling gallery layout.
 * @returns {Promise<void>} Resolves after native fullscreen has been left when active.
 */
async function exitPhotoDialogFullscreen() {
  if (document.fullscreenElement === el.photoDialogSheet && typeof document.exitFullscreen === 'function') {
    try {
      await document.exitFullscreen();
    } catch (error) {
      // Removing the local layout state still restores the regular gallery.
    }
  }
  el.photoDialogSheet?.classList.remove('is-fullscreen');
  el.photoDialog?.classList.remove('is-fullscreen');
  renderPhotoDialogFullscreenControl();
}

/**
 * Toggles the photo dialog between its regular and browser fullscreen layouts.
 * @returns {Promise<void>} Resolves after the selected layout has been applied.
 */
async function togglePhotoDialogFullscreen() {
  if (isPhotoDialogFullscreen()) {
    await exitPhotoDialogFullscreen();
  } else {
    await enterPhotoDialogFullscreen();
  }
}

/**
 * Closes the photo dialog and resets its fullscreen layout.
 * @returns {void} The next opened photo starts in the regular dialog layout.
 */
function closePhotoDialog() {
  void exitPhotoDialogFullscreen();
  el.photoDialog.close();
}

/**
 * Switches gallery photos from keyboard input while the photo dialog is open.
 * @param {KeyboardEvent} event - Key event received by the document.
 * @returns {void} Moves to the previous or next photo for arrow keys.
 */
function handlePhotoDialogKeyboard(event) {
  if (!el.photoDialog?.open) return;
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    stepPhotoDialog(-1);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    stepPhotoDialog(1);
  }
}
function stepPhotoDialog(offset) {
  const photos = state.photoDialogUi.photos;
  if (!photos.length) return;
  state.photoDialogUi.index = (state.photoDialogUi.index + offset + photos.length) % photos.length;
  renderPhotoDialog();
}
function openPhotoDialog(track, photoOrIndex) {
  let photos = [];
  if (Array.isArray(track?.photos)) photos = track.photos;
  if (!track || !photos.length) return;
  let index = Math.max(0, photos.indexOf(photoOrIndex));
  if (typeof photoOrIndex === 'number') index = photoOrIndex;
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
  let photos = [];
  if (Array.isArray(track.photos)) photos = track.photos;
  photos.forEach((photo, index) => {
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
    await deleteTrackPhotoBlobs(track);
    const preparedTrack = await prepareTrackPhotosForStorage(updatedTrack);
    await put(STORES.tracks, preparedTrack);
    const hydratedTrack = await hydrateTrackPhotos(preparedTrack);
    revokeTrackPhotoUrls(track);
    state.tracks = state.tracks.map((item) => {
      if (item.id === hydratedTrack.id) return hydratedTrack;
      return item;
    });
    renderAll();
    syncMapForSelectionChange();
    setStatus(t('reloadPhotosDone'));
  } catch (error) {
    setStatus(error.message || t('reloadPhotosFailed'), true);
  }
}
/**
 * Renders all metadata facts, badges and tags for a track into one container.
 * @param {HTMLElement} container Target element for the facts.
 * @param {object} track Track record whose metadata is displayed.
 * @returns {void}
 */
function renderTrackFacts(container, track) {
  container.replaceChildren();
  if (track.favorite) {
    const favorite = document.createElement('span');
    favorite.className = 'analysis-pill is-favorite';
    favorite.textContent = '★ Favorit';
    container.append(favorite);
  }
  appendTrackFact(container, '📅', t('labelDate'), fmtDate(track.dateStart));
  appendTrackFact(container, '↔', t('labelDistance'), `${fmtKm(track.distanceKm)} km`);
  if (track.durationHours != null) appendTrackFact(container, '⏱', t('labelDuration'), `${track.durationHours.toFixed(1)} h`);
  if (track.elevationGainM != null) appendTrackFact(container, '↗', t('labelAscent'), fmtMeters(track.elevationGainM));
  if (track.elevationLossM != null) appendTrackFact(container, '↘', t('labelDescent'), fmtMeters(track.elevationLossM));
  if (track.sport) appendTrackFact(container, iconForSport(track.sport), t('labelSport'), sportLabel(track.sport));
  normalizeTagList(track.tags).slice(0, 3).forEach((item) => {
    const tag = document.createElement('span');
    tag.className = 'track-tag-chip';
    tag.textContent = `#${item}`;
    container.append(tag);
  });
}
/**
 * Builds one analysis pill from the shared template.
 * @param {string} value Label text shown inside the pill.
 * @returns {HTMLElement} Cloned pill element with its text set.
 */
function createAnalysisPill(value) {
  const fragment = el.analysisPillTemplate.content.cloneNode(true);
  const pill = fragment.querySelector('.analysis-pill');
  pill.textContent = value;
  return pill;
}
/**
 * Builds one navigation pill from a direction entry.
 * @param {object} direction Normalized navigation step with instruction and optional distance.
 * @returns {HTMLElement} Cloned pill element with formatted direction text.
 */
function createDirectionAnalysisPill(direction) {
  let label = direction.instruction;
  if (Number.isFinite(direction.distanceM)) {
    label = `${label} · ${fmtNum(direction.distanceM)} m`;
  }
  return createAnalysisPill(label);
}
/**
 * Converts raw detail values into ready-to-append analysis pills.
 * @param {Array<string>} items Source values that should be converted.
 * @returns {Array<HTMLElement>} Pill elements for the provided values or one empty-state pill.
 */
function analysisPillElements(items) {
  const values = normalizeTagList(items);
  if (!values.length) {
    return [createAnalysisPill(t('analysisNone'))];
  }
  return values.slice(0, 8).map((item) => createAnalysisPill(displayDetailValue(item)));
}
/**
 * Returns the localized yes/no label for analysis summary rows.
 * @param {boolean} value Whether the summarized property is available.
 * @returns {string} Localized affirmative or negative label.
 */
function booleanLabel(value) {
  if (value) return t('analysisYes');
  return t('analysisNo');
}
/**
 * Creates one analysis card from the shared card template.
 * @param {string} title Localized card heading.
 * @param {string} copy Plain-text summary copy for the card.
 * @returns {HTMLElement} Card element with copy text rendered.
 */
function createTrackAnalysisCopyCard(title, copy) {
  const fragment = el.trackAnalysisCardTemplate.content.cloneNode(true);
  const card = fragment.querySelector('.track-analysis-card');
  const cardTitle = fragment.querySelector('.track-analysis-card-title');
  const cardCopy = fragment.querySelector('.track-analysis-card-copy');
  const cardList = fragment.querySelector('.analysis-list');
  cardTitle.textContent = title;
  cardCopy.textContent = copy;
  cardCopy.hidden = false;
  cardList.remove();
  return card;
}
/**
 * Creates one analysis card from the shared card template and fills its pill list.
 * @param {string} title Localized card heading.
 * @param {Array<HTMLElement>} items Pill elements that should be appended to the list.
 * @param {string} copy Optional plain-text summary copy shown above the list.
 * @returns {HTMLElement} Card element with a rendered list.
 */
function createTrackAnalysisListCard(title, items, copy = '') {
  const fragment = el.trackAnalysisCardTemplate.content.cloneNode(true);
  const card = fragment.querySelector('.track-analysis-card');
  const cardTitle = fragment.querySelector('.track-analysis-card-title');
  const cardCopy = fragment.querySelector('.track-analysis-card-copy');
  const cardList = fragment.querySelector('.analysis-list');
  cardTitle.textContent = title;
  if (copy) {
    cardCopy.textContent = copy;
    cardCopy.hidden = false;
  } else {
    cardCopy.remove();
  }
  cardList.hidden = false;
  cardList.replaceChildren(...items);
  return card;
}
/**
 * Builds the complete track analysis fragment for the detail dialog via shared templates.
 * @param {object} track Track whose analysis cards should be rendered.
 * @returns {DocumentFragment} Fragment containing all analysis cards.
 */
function trackAnalysisMarkup(track) {
  const hasPhotos = Array.isArray(track.photos) && track.photos.length > 0;
  const hasElevation = Number.isFinite(track.elevationGainM) || Number.isFinite(track.elevationLossM) || Number.isFinite(track.elevationMinM) || Number.isFinite(track.elevationMaxM);
  const hasTiming = Array.isArray(track.points) && track.points.some((point) => !!point.time);
  const directions = normalizeDirections(track.directions);
  let photoCount = '0';
  if (hasPhotos) photoCount = fmtNum(track.photos.length);
  let directionCount = '0';
  if (directions.length) directionCount = fmtNum(directions.length);
  const routeText = [
    `${t('labelSport')}: ${sportLabel(track.sport)}`,
    `${t('labelDistance')}: ${fmtKm(track.distanceKm)} km`,
    `${t('pointsTitle')}: ${fmtNum(track.pointCount)}`,
    `${t('profileAltitudeRange')}: ${fmtMeters((track.elevationMaxM ?? 0) - (track.elevationMinM ?? 0))}`
  ].join(' · ');
  const dataText = [
    `${t('analysisPhotosLabel')}: ${photoCount}`,
    `${t('analysisElevationLabel')}: ${booleanLabel(hasElevation)}`,
    `${t('analysisTimingLabel')}: ${booleanLabel(hasTiming)}`,
    `${t('analysisReplayLabel')}: ${booleanLabel(track.pointCount > 1)}`,
    `${t('analysisDirectionsLabel')}: ${directionCount}`
  ].join(' · ');
  const customTags = normalizeTagList(track.tags);
  const directionItems = [];
  if (!directions.length) {
    directionItems.push(createAnalysisPill(t('analysisNone')));
  } else {
    directions.slice(0, 4).forEach((item) => {
      directionItems.push(createDirectionAnalysisPill(item));
    });
  }
  let favoriteLabel = t('analysisStandardLabel');
  if (track.favorite) favoriteLabel = t('analysisFavoriteLabel');
  let customTagCount = 0;
  if (customTags.length) customTagCount = customTags.length;
  let wayTypeCopy = '';
  if (track.osmWayTypeAnalysis) {
    if (track.osmWayTypeAnalysis.complete === false) {
      wayTypeCopy = t('analysisOsmWayTypesPartialInfo', {
        processed: fmtNum(track.osmWayTypeAnalysis.processedGroups || 0),
        total: fmtNum(track.osmWayTypeAnalysis.totalGroups || 0)
      });
    } else {
      wayTypeCopy = t('analysisOsmWayTypesInfo', {
        date: fmtDate(track.osmWayTypeAnalysis.analyzedAt),
        matched: fmtNum(track.osmWayTypeAnalysis.matchedPoints || 0),
        sampled: fmtNum(track.osmWayTypeAnalysis.sampledPoints || 0)
      });
    }
  }
  const fragment = el.trackAnalysisGridTemplate.content.cloneNode(true);
  const grid = fragment.querySelector('.track-analysis-grid');
  const organizationItems = analysisPillElements(customTags);
  grid.append(
    createTrackAnalysisCopyCard(t('analysisRouteTitle'), routeText),
    createTrackAnalysisCopyCard(t('analysisDataTitle'), dataText),
    createTrackAnalysisListCard(t('analysisSurfaceTitle'), analysisPillElements(track.surfaces)),
    createTrackAnalysisListCard(t('analysisWayTypeTitle'), analysisPillElements(track.wayTypes), wayTypeCopy),
    createTrackAnalysisListCard(t('analysisNavigationTitle'), directionItems),
    createTrackAnalysisListCard(
      t('analysisOrganizationTitle'),
      organizationItems,
      `${favoriteLabel} · ${t('analysisTagsLabel')}: ${customTagCount}`
    )
  );
  return fragment;
}

/**
 * Builds the Komoot timeline section for the track detail dialog.
 * @param {object} track Track whose stored timeline should be displayed.
 * @returns {DocumentFragment} Timeline section fragment, or an empty fragment without timeline data.
 */
function trackTimelineMarkup(track) {
  const entries = normalizeTrackTimeline(track);
  const fragment = document.createDocumentFragment();
  if (!entries.length) return fragment;
  const sectionFragment = el.trackTimelineTemplate.content.cloneNode(true);
  const title = sectionFragment.querySelector('.track-timeline-title');
  const description = sectionFragment.querySelector('.track-timeline-description');
  const list = sectionFragment.querySelector('.track-timeline-list');
  title.textContent = t('timelineTitle');
  description.textContent = t('timelineDescription');
  entries.forEach((rawEntry) => {
    const entry = locateTimelineEntryOnTrack(track, rawEntry);
    const itemFragment = el.trackTimelineItemTemplate.content.cloneNode(true);
    const itemTitle = itemFragment.querySelector('.track-timeline-item-title');
    const itemText = itemFragment.querySelector('.track-timeline-item-text');
    const itemMeta = itemFragment.querySelector('.track-timeline-item-meta');
    const mapButton = itemFragment.querySelector('.track-timeline-map-button');
    itemTitle.textContent = entry.title;
    if (entry.text) {
      itemText.textContent = entry.text;
      itemText.hidden = false;
    }
    if (entry.distanceM != null) {
      itemMeta.textContent = t('timelineDistance', { distance: fmtKm(entry.distanceM / 1000) });
      itemMeta.hidden = false;
    }
    if (entry.location) {
      mapButton.textContent = t('timelineShowOnMap');
      mapButton.hidden = false;
      mapButton.addEventListener('click', () => focusTimelineEntryOnMap(track, entry.id));
    }
    list.append(itemFragment);
  });
  fragment.append(sectionFragment);
  return fragment;
}

function renderTrackDetailDialog() {
  const track = state.tracks.find((item) => item.id === state.trackDetailUi.trackId);
  if (!track) return;
  const editing = !!state.trackDetailUi.editing;
  el.trackDetailTitle.textContent = track.name;
  el.trackDetailSubtitle.textContent = t('detailDialogSubtitle', { source: track.accountLabel || trackSourceLabel(track.source), date: fmtDate(track.dateStart) });
  renderTrackFacts(el.trackDetailFacts, track);
  el.trackDetailDescription.textContent = track.description || '';
  el.trackDetailDescription.hidden = editing || !track.description;
  el.trackDetailEditBlock.hidden = !editing;
  el.trackDetailNameInput.value = track.name || '';
  el.trackDetailFavoriteInput.checked = !!track.favorite;
  el.trackDetailTagsInput.value = normalizeTagList(track.tags).join(', ');
  el.trackDetailDescriptionInput.value = track.description || '';
  el.trackDetailAnalysis.replaceChildren(trackAnalysisMarkup(track), trackTimelineMarkup(track));
  el.trackDetailEditButton.hidden = editing;
  el.trackDetailSaveButton.hidden = !editing;
  el.trackDetailCancelButton.hidden = !editing;
  el.trackDetailPhotos.replaceChildren();
  let trackPhotos = [];
  if (Array.isArray(track.photos)) trackPhotos = track.photos;
  trackPhotos.forEach((photo, index) => {
    const { fragment, image } = createTrackPhotoThumbnail(photo, track, index);
    image.addEventListener('click', () => openPhotoDialog(track, index));
    el.trackDetailPhotos.append(fragment);
  });
  el.trackDetailPhotos.hidden = !(Array.isArray(track.photos) && track.photos.length);
}
function renderPhotoGrid(container, track, limit = 4) {
  if (!container) return;
  container.replaceChildren();
  let allPhotos = [];
  if (Array.isArray(track.photos)) allPhotos = track.photos;
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
    const { fragment, image } = createTrackPhotoThumbnail(photo, track, index);
    image.addEventListener('click', (event) => { event.stopPropagation(); openPhotoDialog(track, index); });
    container.append(fragment);
  });
  if (allPhotos.length > photos.length) {
    const count = document.createElement('span');
    count.className = 'track-photo-count';
    count.textContent = photoCountLabel(allPhotos.length);
    container.append(count);
  }
  container.hidden = photos.length === 0;
}
/**
 * Creates a compact, non-interactive badge from the shared track badge template.
 * @param {string} text Visible badge text.
 * @param {string} label Accessible title describing the badge.
 * @returns {HTMLElement} Ready-to-append badge element.
 */
function createTrackQuickBadge(text, label) {
  const fragment = el.trackQuickBadgeTemplate.content.cloneNode(true);
  const badge = fragment.querySelector('.track-quick-badge');
  badge.textContent = text;
  badge.title = label;
  return badge;
}

/**
 * Renders a bounded description preview and its optional expand control in a library card.
 * @param {HTMLElement} container Description wrapper that is hidden without text.
 * @param {HTMLElement} textNode Text node inside the wrapper.
 * @param {HTMLButtonElement} toggleButton Button that expands or collapses the description.
 * @param {string|null|undefined} value Full track description.
 * @param {boolean} expanded Whether the card currently shows its extended preview.
 * @returns {void} Updates the description area in place.
 */
function renderLibraryDescription(container, textNode, toggleButton, value, expanded) {
  const description = cleanText(value);
  container.hidden = !description;
  if (!description) return;
  const boundedDescription = description.slice(0, LIBRARY_DESCRIPTION_MAX_LENGTH);
  let displayText = boundedDescription;
  let hasMoreText = description.length > LIBRARY_DESCRIPTION_PREVIEW_LENGTH;
  if (!expanded) displayText = description.slice(0, LIBRARY_DESCRIPTION_PREVIEW_LENGTH);
  if (!expanded && hasMoreText) displayText += '...';
  if (expanded && description.length > LIBRARY_DESCRIPTION_MAX_LENGTH) displayText += '...';
  textNode.textContent = displayText;
  toggleButton.hidden = !hasMoreText;
  if (hasMoreText) {
    toggleButton.textContent = t('libraryDescriptionMore');
    if (expanded) toggleButton.textContent = t('libraryDescriptionLess');
  }
}

/**
 * Renders the compact metadata, bounded description, badges and photos of one library track card.
 * @param {HTMLElement} copyNode Cloned track card content node.
 * @param {object} track Track supplying the visible metadata.
 * @returns {void} Populates the supplied card node and connects its local description toggle.
 */
function renderTrackExtras(copyNode, track) {
  const titleBadges = copyNode.querySelector('.track-quick-badges');
  const submeta = copyNode.querySelector('.track-submeta');
  const description = copyNode.querySelector('.track-description');
  const descriptionText = copyNode.querySelector('.track-description-text');
  const descriptionToggle = copyNode.querySelector('.track-description-toggle');
  const facts = copyNode.querySelector('.track-facts');
  const photoStrip = copyNode.querySelector('.track-photo-strip');
  if (titleBadges) {
    titleBadges.replaceChildren();
    const favoriteButton = document.createElement('button');
    favoriteButton.type = 'button';
    favoriteButton.className = 'track-quick-badge track-favorite-toggle';
    if (track.favorite) favoriteButton.classList.add('is-favorite');
    favoriteButton.textContent = '★';
    favoriteButton.title = t('favoriteAdd');
    if (track.favorite) favoriteButton.title = t('favoriteRemove');
    favoriteButton.setAttribute('aria-label', favoriteButton.title);
    favoriteButton.setAttribute('aria-pressed', String(!!track.favorite));
    favoriteButton.addEventListener('click', async (event) => {
      event.stopPropagation();
      await toggleTrackFavorite(track.id);
    });
    titleBadges.append(favoriteButton);
    if (Array.isArray(track.photos) && track.photos.length) {
      titleBadges.append(createTrackQuickBadge(`📷 ${fmtNum(track.photos.length)}`, photoCountLabel(track.photos.length)));
    }
    if (normalizeTagList(track.tags).length) {
      titleBadges.append(createTrackQuickBadge(`# ${fmtNum(normalizeTagList(track.tags).length)}`, 'Tags'));
    }
    const timelineCount = normalizeTrackTimeline(track).length;
    if (timelineCount) {
      titleBadges.append(createTrackQuickBadge(`✦ ${fmtNum(timelineCount)}`, t('timelineBadge', { count: timelineCount })));
    }
    titleBadges.hidden = false;
  }
  if (submeta) {
    submeta.textContent = t('trackSubmeta', { date: fmtDate(track.dateStart), source: track.accountLabel || trackSourceLabel(track.source) });
  }
  if (description && descriptionText && descriptionToggle) {
    let expanded = false;
    renderLibraryDescription(description, descriptionText, descriptionToggle, track.description, expanded);
    descriptionToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      expanded = !expanded;
      renderLibraryDescription(description, descriptionText, descriptionToggle, track.description, expanded);
    });
  }
  if (facts) renderTrackFacts(facts, track);
  renderPhotoGrid(photoStrip, track, 6);
}
function openTrackDetail(trackId, startEditing = false) {
  const track = state.tracks.find((item) => item.id === trackId);
  if (!track) return;
  state.trackDetailUi.trackId = track.id;
  state.trackDetailUi.editing = !!startEditing;
  renderTrackDetailDialog();
  el.trackDetailDialog.showModal();
  if (startEditing) {
    queueMicrotask(() => {
      el.trackDetailNameInput?.focus();
      el.trackDetailNameInput?.select();
    });
  }
}
function allFilteredSelected() { const tracks = filteredTracks(); return tracks.length > 0 && tracks.every((track) => state.selectedTrackIds.has(track.id)); }
function renderToggleSelectionButton() {
  if (!el.libraryToggleSelectionButton) return;
  el.libraryToggleSelectionButton.textContent = t('selectAll');
  if (allFilteredSelected()) el.libraryToggleSelectionButton.textContent = t('clearSelection');
}
function selectedTracksForMerge() {
  const preferredOrder = filteredTracks().filter((track) => state.selectedTrackIds.has(track.id) && track.points?.length);
  const fallback = state.tracks.filter((track) => state.selectedTrackIds.has(track.id) && track.points?.length && !preferredOrder.some((item) => item.id === track.id));
  const ordered = preferredOrder.concat(fallback);
  if (state.highlightedTrackId && ordered.some((track) => track.id === state.highlightedTrackId)) {
    ordered.sort((a, b) => {
      if (a.id === state.highlightedTrackId) return -1;
      if (b.id === state.highlightedTrackId) return 1;
      return 0;
    });
  }
  return ordered;
}
function renderMergeSelectedTracksButton() {
  if (!el.mergeSelectedTracksButton) return;
  const tracks = selectedTracksForMerge();
  const enabled = tracks.length === 2;
  el.mergeSelectedTracksButton.disabled = !enabled;
  let title = t('mergeSelectedTracksNeedTwo');
  if (enabled) title = t('mergeSelectedTracks');
  el.mergeSelectedTracksButton.setAttribute('title', title);
}
function mergeDialogTracks() {
  return state.mergeUi.orderedTrackIds.map((trackId) => state.tracks.find((track) => track.id === trackId)).filter(Boolean);
}
function renderMergeDialog() {
  if (!el.mergeDialog) return;
  const [firstTrack, secondTrack] = mergeDialogTracks();
  if (el.mergeDialogFirstName) el.mergeDialogFirstName.textContent = firstTrack?.name || t('unnamedTrack');
  if (el.mergeDialogSecondName) el.mergeDialogSecondName.textContent = secondTrack?.name || t('unnamedTrack');
  if (el.mergeDialogFirstMeta) {
    el.mergeDialogFirstMeta.textContent = '-';
    if (firstTrack) el.mergeDialogFirstMeta.textContent = t('trackMeta', { distance: fmtKm(firstTrack.distanceKm), points: fmtNum(firstTrack.pointCount), type: trackTypeLabel(firstTrack.type) });
  }
  if (el.mergeDialogSecondMeta) {
    el.mergeDialogSecondMeta.textContent = '-';
    if (secondTrack) el.mergeDialogSecondMeta.textContent = t('trackMeta', { distance: fmtKm(secondTrack.distanceKm), points: fmtNum(secondTrack.pointCount), type: trackTypeLabel(secondTrack.type) });
  }
  if (el.mergeDialogConfirm) el.mergeDialogConfirm.disabled = !(firstTrack && secondTrack);
}
function openMergeDialog() {
  const tracks = selectedTracksForMerge();
  if (tracks.length !== 2) {
    setStatus(t('mergeSelectedTracksNeedTwo'), true);
    return;
  }
  state.mergeUi.orderedTrackIds = tracks.map((track) => track.id);
  renderMergeDialog();
  if (el.mergeDialog && !el.mergeDialog.open) el.mergeDialog.showModal();
}
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
  el.mapPhotoModeButton.textContent = t('showAllTrackPhotos');
  if (active) el.mapPhotoModeButton.textContent = t('showTracksAgain');
  el.mapPhotoModeButton.classList.toggle('is-active', active);
  el.mapPhotoModeButton.disabled = !!state.settings.heatmapMode;
}
function renderMapHeatmapButton() {
  if (!el.mapHeatmapButton) return;
  const active = !!state.settings.heatmapMode;
  const available = canRenderHeatmap();
  el.mapHeatmapButton.classList.toggle('is-active', active);
  el.mapHeatmapButton.setAttribute('aria-pressed', String(active));
  const disabled = !active && !available;
  el.mapHeatmapButton.setAttribute('aria-disabled', String(disabled));
  el.mapHeatmapButton.setAttribute('title', t('mapHeatmap'));
  if (disabled) el.mapHeatmapButton.setAttribute('title', t('heatmapNeedsMultipleTracks'));
}
function highlightedTrackWithSegments() {
  const track = state.tracks.find((item) => item.id === state.highlightedTrackId);
  if (!track || !state.selectedTrackIds.has(track.id) || !filteredTrackIdSet().has(track.id)) return null;
  const hasSurfaceSegments = normalizeRangeSegments(track.surfaceSegments).length > 0;
  const hasWayTypeSegments = normalizeRangeSegments(track.wayTypeSegments).length > 0;
  if (hasSurfaceSegments || hasWayTypeSegments) return track;
  return null;
}
function renderMapSegmentButton() {
  if (!el.mapSegmentButton) return;
  const active = !!state.settings.segmentOverlayMode;
  const availableTrack = highlightedTrackWithSegments();
  el.mapSegmentButton.classList.toggle('is-active', active);
  el.mapSegmentButton.setAttribute('aria-pressed', String(active));
  const disabled = !active && !availableTrack;
  el.mapSegmentButton.setAttribute('aria-disabled', String(disabled));
  el.mapSegmentButton.setAttribute('title', t('mapSegments'));
  if (disabled) el.mapSegmentButton.setAttribute('title', t('segmentOverlayNeedsTrack'));
}
function renderPaneCompactButtons() {
  const sidebarCompact = !!state.settings.sidebarCompact;
  const libraryCompact = !!state.settings.libraryCompact;
  if (el.toggleSidebarCompactButton) {
    let label = 'Linke Spalte schmal schalten';
    if (sidebarCompact) label = 'Linke Spalte verbreitern';
    if (lang() === 'en') {
      label = 'Make left column narrower';
      if (sidebarCompact) label = 'Expand left column';
    }
    if (lang() === 'fr') {
      label = 'Rendre la colonne gauche plus etroite';
      if (sidebarCompact) label = 'Elargir la colonne gauche';
    }
    el.toggleSidebarCompactButton.textContent = '⟪';
    if (sidebarCompact) el.toggleSidebarCompactButton.textContent = '⟫';
    el.toggleSidebarCompactButton.setAttribute('title', label);
    el.toggleSidebarCompactButton.setAttribute('aria-label', label);
  }
  if (el.toggleLibraryCompactButton) {
    let label = 'Bibliothek schmal schalten';
    if (libraryCompact) label = 'Bibliothek verbreitern';
    if (lang() === 'en') {
      label = 'Make library column narrower';
      if (libraryCompact) label = 'Expand library column';
    }
    if (lang() === 'fr') {
      label = 'Rendre la bibliotheque plus etroite';
      if (libraryCompact) label = 'Elargir la bibliotheque';
    }
    el.toggleLibraryCompactButton.textContent = '⟪';
    if (libraryCompact) el.toggleLibraryCompactButton.textContent = '⟫';
    el.toggleLibraryCompactButton.setAttribute('title', label);
    el.toggleLibraryCompactButton.setAttribute('aria-label', label);
  }
}

/**
 * Resolves the configured browser-extension download address against the current app URL.
 * @returns {string|null} Absolute package URL, or null when the configuration is invalid.
 */
function komootExtensionDownloadUrl() {
  const configuredUrl = TRAILTHREAD_CONFIG.komootExtensionDownloadUrl;
  if (typeof configuredUrl !== 'string' || !configuredUrl.trim()) return null;
  try {
    return new URL(configuredUrl, window.location.href).href;
  } catch (error) {
    return null;
  }
}

/**
 * Applies the configurable extension package URL to the Komoot installation link.
 * @returns {void} Hides the download action when no valid URL is configured.
 */
function applyKomootExtensionConfiguration() {
  const downloadLink = document.querySelector('#komoot-extension-download-link');
  if (!downloadLink) return;
  const downloadUrl = komootExtensionDownloadUrl();
  if (!downloadUrl) {
    downloadLink.hidden = true;
    return;
  }
  downloadLink.href = downloadUrl;
  downloadLink.hidden = false;
}

/**
 * Returns the localized accessible label for a previous or next track button.
 * @param {'previous'|'next'} direction Direction represented by the control.
 * @returns {string} Localized control label.
 */
function trackNavigationLabel(direction) {
  let label = 'Nächster Track';
  if (direction === 'previous') label = 'Vorheriger Track';
  if (lang() === 'en') {
    label = 'Next track';
    if (direction === 'previous') label = 'Previous track';
  }
  if (lang() === 'fr') {
    label = 'Trace suivante';
    if (direction === 'previous') label = 'Trace precedente';
  }
  return label;
}

/**
 * Applies translated texts and accessible labels to the persistent application controls.
 * @returns {void}
 */
function renderI18n() {
  document.documentElement.lang = lang();
  document.title = 'Trailthread';
  document.querySelectorAll('[data-i18n]').forEach((node) => { node.textContent = t(node.dataset.i18n); });
  el.librarySearchInput.placeholder = t('searchPlaceholder');
  el.librarySearchInput.setAttribute('aria-label', t('searchPlaceholder'));
  const previousLabel = trackNavigationLabel('previous');
  const nextLabel = trackNavigationLabel('next');
  el.prevTrackButton?.setAttribute('aria-label', previousLabel);
  el.prevTrackButton?.setAttribute('title', previousLabel);
  el.nextTrackButton?.setAttribute('aria-label', nextLabel);
  el.nextTrackButton?.setAttribute('title', nextLabel);
  el.photoDialogClose?.setAttribute('aria-label', t('closeButton'));
  el.photoDialogClose?.setAttribute('title', t('closeButton'));
  [['replayRestartButton', 'replayRestart'], ['replayBackButton', 'replayBack'], ['replayPlayButton', 'replayPlay'], ['replayPauseButton', 'replayStop'], ['replayForwardButton', 'replayForward']].forEach(([ref, key]) => {
    el[ref]?.setAttribute('aria-label', t(key));
    el[ref]?.setAttribute('title', t(key));
  });
  el.languageSelect.value = state.settings.language ?? 'auto';
  renderTrackWidthControl();
  renderMapPhotoModeButton();
  renderMapHeatmapButton();
  renderMapSegmentButton();
  renderPaneCompactButtons();
  renderReplayControls();
  renderVersionLabel();
  renderPhotoDialogFullscreenControl();
}
/**
 * Shows the selected main workspace and redirects retired workspace states to the library.
 * @returns {void} Updates workspace visibility and refreshes the map layout.
 */
function renderWorkspace() {
  let workspace = state.settings.activeWorkspace;
  if (!['library', 'replay'].includes(workspace)) workspace = 'library';
  state.settings.activeWorkspace = workspace;
  el.libraryWorkspace.hidden = workspace !== 'library';
  el.komootWorkspace.hidden = true;
  el.replayWorkspace.hidden = workspace !== 'replay';
  el.workspaceButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.workspace === workspace));
  if (workspace === 'replay') ensureReplayMaps();
  scheduleMapLayoutRefresh();
}
function renderAccounts() {
  el.accountsList.replaceChildren(); el.komootAccountSelect.replaceChildren();
  const first = document.createElement('option'); first.value = ''; first.textContent = t('accountSelectPlaceholder'); el.komootAccountSelect.append(first);
  state.accounts.forEach((account) => {
    const frag = el.accountItemTemplate.content.cloneNode(true); const card = frag.querySelector('.account-card'); const name = frag.querySelector('.account-name'); const meta = frag.querySelector('.account-meta'); const useButton = frag.querySelector('.account-use-button'); const deleteButton = frag.querySelector('.account-delete-button'); const active = account.id === state.settings.activeAccountId;
    card.classList.toggle('is-active', active); name.textContent = account.label || account.email;
    let accountStateLabel = t('accountInactive');
    if (active) accountStateLabel = t('accountActive');
    meta.textContent = t('accountMeta', { email: account.email, label: accountStateLabel });
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
  const tracks = filteredTracks(); el.trackList.replaceChildren(); el.librarySummary.textContent = t('libraryEmpty');
  if (tracks.length) el.librarySummary.textContent = t('librarySummary', { count: tracks.length });
  tracks.forEach((track) => {
    const frag = el.trackItemTemplate.content.cloneNode(true);
    const item = frag.querySelector('.track-item');
    const checkbox = frag.querySelector('.track-checkbox');
    const swatch = frag.querySelector('.track-swatch');
    const colorInput = frag.querySelector('.track-color-input');
    const copy = frag.querySelector('.track-copy');
    const name = frag.querySelector('.track-name');
    const komootLinkButton = frag.querySelector('.komoot-link-button');
    const focusButton = frag.querySelector('.focus-button');
    const replayButton = frag.querySelector('.replay-button');
    const editButton = frag.querySelector('.edit-button');
    const exportButton = frag.querySelector('.export-button');
    const osmWaytypeButton = frag.querySelector('.track-osm-waytype-button');
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
    const originalTrackUrl = track.komootUrl || komootTrackUrl(track);
    item.addEventListener('click', (event) => {
      if (event.target.closest('.track-actions')) return;
      if (state.settings.activeWorkspace === 'replay') {
        preserveLibraryListState(track.id);
        openReplayTrack(track.id);
        return;
      }
      preserveLibraryListState(track.id);
      if (checkbox.checked) state.selectedTrackIds.delete(track.id);
      else state.selectedTrackIds.add(track.id);
      renderLibrary();
      renderSelection();
      syncMapForSelectionChange();
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
      if (checkbox.checked) state.selectedTrackIds.delete(track.id);
      else state.selectedTrackIds.add(track.id);
      renderLibrary();
      renderSelection();
      syncMapForSelectionChange();
    });
    colorInput.addEventListener('input', async (event) => {
      event.stopPropagation();
      const updatedTrack = touchTrack(track, { color: colorInput.value });
      await put(STORES.tracks, updatedTrack);
      state.tracks = state.tracks.map((item) => {
        if (item.id === updatedTrack.id) return updatedTrack;
        return item;
      });
      swatch.style.background = updatedTrack.color;
      updateTrackLayerStyle(updatedTrack.id);
    });
    komootLinkButton.hidden = !originalTrackUrl;
    komootLinkButton.textContent = '↗';
    komootLinkButton.title = t('openInKomoot');
    komootLinkButton.setAttribute('aria-label', t('openInKomoot'));
    if (originalTrackUrl) komootLinkButton.addEventListener('click', (event) => { event.stopPropagation(); window.open(originalTrackUrl, '_blank', 'noopener,noreferrer'); });
    editButton.textContent = '✎';
    editButton.title = t('editTrackButton');
    editButton.setAttribute('aria-label', t('editTrackButton'));
    editButton.addEventListener('click', (event) => { event.stopPropagation(); openTrackDetail(track.id, true); });
    exportButton.textContent = '⇩';
    exportButton.title = t('exportTrackGpx');
    exportButton.setAttribute('aria-label', t('exportTrackGpx'));
    exportButton.addEventListener('click', (event) => { event.stopPropagation(); exportTrackGpx(track.id); });
    const canAnalyseOsmWayTypes = Array.isArray(track.points) && track.points.length > 1;
    osmWaytypeButton.hidden = !canAnalyseOsmWayTypes;
    let osmWaytypeButtonLabel = t('osmWayTypesButton');
    if (track.osmWayTypeAnalysis) osmWaytypeButtonLabel = t('osmWayTypesButtonAgain');
    osmWaytypeButton.textContent = osmWaytypeButtonLabel;
    osmWaytypeButton.title = t('osmWayTypesButtonTitle');
    osmWaytypeButton.disabled = osmAnalysisTrackId === track.id;
    if (osmWaytypeButton.disabled) osmWaytypeButton.textContent = t('osmWayTypesLoading');
    osmWaytypeButton.addEventListener('click', (event) => { event.stopPropagation(); analyseTrackWayTypesFromOsm(track.id); });
    focusButton.textContent = '≣';
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
  renderMergeSelectedTracksButton();
  restoreLibraryListState();
}
function renderSelection() {
  const tracks = state.tracks.filter((track) => state.selectedTrackIds.has(track.id)); el.selectionStats.textContent = fmtNum(tracks.length); el.distanceStats.textContent = `${fmtKm(tracks.reduce((sum, track) => sum + (track.distanceKm ?? 0), 0))} km`; el.pointStats.textContent = fmtNum(tracks.reduce((sum, track) => sum + (track.pointCount ?? 0), 0));
  const overlay = el.selectionStats?.closest('.map-overlay');
  if (overlay?.parentElement) overlay.parentElement.append(overlay);
  renderMergeSelectedTracksButton();
  if (!el.selectionList) return;
  el.selectionList.replaceChildren();
  if (!tracks.length) { const li = document.createElement('li'); li.className = 'track-item compact-item'; li.textContent = t('noSelection'); el.selectionList.append(li); return; }
  tracks.forEach((track) => { const frag = el.stagingItemTemplate.content.cloneNode(true); frag.querySelector('.track-name').textContent = track.name; frag.querySelector('.track-meta').textContent = t('trackMeta', { distance: fmtKm(track.distanceKm), points: fmtNum(track.pointCount), type: trackTypeLabel(track.type) }); frag.querySelector('.track-submeta').textContent = t('trackSubmeta', { date: fmtDate(track.dateStart), source: track.accountLabel || trackSourceLabel(track.source) }); el.selectionList.append(frag); });
}
function renderRecent() {
  if (!el.recentList || !el.recentSummary) return;
  const tracks = recentTracks(); el.recentList.replaceChildren(); el.recentSummary.textContent = t('inboxEmpty');
  if (tracks.length) el.recentSummary.textContent = t('recentSummary', { count: tracks.length });
  tracks.forEach((track) => { const frag = el.stagingItemTemplate.content.cloneNode(true); frag.querySelector('.track-name').textContent = track.name; frag.querySelector('.track-meta').textContent = t('trackMeta', { distance: fmtKm(track.distanceKm), points: fmtNum(track.pointCount), type: trackTypeLabel(track.type) }); frag.querySelector('.track-submeta').textContent = t('trackSubmeta', { date: fmtDate(track.importedAt), source: track.accountLabel || trackSourceLabel(track.source) }); el.recentList.append(frag); });
}
function preserveKomootListState(listName) {
  let container = el.plannedList;
  if (listName === 'recorded') container = el.recordedList;
  if (!container) return;
  state.komootUi.scrollTopByList[listName] = container.scrollTop;
}
function preserveAllKomootListStates() {
  preserveKomootListState('recorded');
  preserveKomootListState('planned');
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
    let container = el.plannedList;
    if (listName === 'recorded') container = el.recordedList;
    if (!container) return;
    container.scrollTop = state.komootUi.scrollTopByList[listName] ?? 0;
  });
}
function renderKomootSelectionUi() {
  const recorded = state.komootTours.filter((tour) => tour.type === 'recorded');
  const planned = state.komootTours.filter((tour) => tour.type === 'planned');
  el.recordedSelectAllButton.textContent = t('selectAll');
  if (recorded.length && recorded.every((tour) => state.selectedKomootTourIds.has(tour.id))) el.recordedSelectAllButton.textContent = t('clearSelection');
  el.plannedSelectAllButton.textContent = t('selectAll');
  if (planned.length && planned.every((tour) => state.selectedKomootTourIds.has(tour.id))) el.plannedSelectAllButton.textContent = t('clearSelection');
}
function renderKomoot() {
  const toggleTourSelection = (tour, listName, checked) => {
    if (checked) state.selectedKomootTourIds.add(tour.id);
    else state.selectedKomootTourIds.delete(tour.id);
    let container = el.plannedList;
    if (listName === 'recorded') container = el.recordedList;
    const item = container?.querySelector(`.tour-item[data-tour-id="${tour.id}"]`);
    const checkbox = container?.querySelector(`.tour-checkbox[data-tour-id="${tour.id}"]`);
    if (checkbox) checkbox.checked = checked;
    if (item) item.classList.toggle('is-selected', checked);
    renderKomootSelectionUi();
    void persistKomootCache(state.settings.activeAccountId);
  };
  const renderList = (container, tours, listName) => {
    container.replaceChildren();
    tours.forEach((tour) => {
      const frag = el.tourItemTemplate.content.cloneNode(true);
      const item = frag.querySelector('.tour-item');
      const checkbox = frag.querySelector('.tour-checkbox');
      const importedTrack = state.tracks.find((track) => track.source === 'komoot' && track.accountEmail === tour.accountEmail && `${track.sourceTrackId ?? ''}` === `${tour.id}`) ?? null;
      const hasImportedNavigation = !!(importedTrack && ((importedTrack.directions?.length ?? 0) > 0 || (importedTrack.wayTypes?.length ?? 0) > 0 || (importedTrack.surfaces?.length ?? 0) > 0));
      let navHint = t('komootNavMissing');
      if (tour.type === 'planned') navHint = t('komootNavLikely');
      if (importedTrack && hasImportedNavigation) navHint = t('komootNavLikely');
      frag.querySelector('.track-name').textContent = tour.name;
      frag.querySelector('.track-meta').textContent = `${fmtKm(tour.distanceKm)} km · ${sportLabel(tour.sport)} · ${trackTypeLabel(tour.type)}`;
      frag.querySelector('.track-submeta').textContent = `${fmtDate(tour.date)} · ${tour.accountLabel} · ${navHint} · ${tour.id}`;
      item.dataset.tourId = tour.id;
      item.tabIndex = 0;
      checkbox.checked = state.selectedKomootTourIds.has(tour.id);
      checkbox.dataset.tourId = tour.id;
      checkbox.dataset.listName = listName;
      item.classList.toggle('is-selected', checkbox.checked);
      item.addEventListener('click', (event) => {
        if (event.target === checkbox) return;
        event.preventDefault();
        toggleTourSelection(tour, listName, !checkbox.checked);
      });
      item.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggleTourSelection(tour, listName, !checkbox.checked);
      });
      checkbox.addEventListener('change', () => {
        toggleTourSelection(tour, listName, checkbox.checked);
      });
      container.append(frag);
    });
  };
  const byNewest = (left, right) => `${right.date ?? ''}`.localeCompare(`${left.date ?? ''}`);
  const recorded = state.komootTours.filter((tour) => tour.type === 'recorded').sort(byNewest); const planned = state.komootTours.filter((tour) => tour.type === 'planned').sort(byNewest); renderList(el.recordedList, recorded, 'recorded'); renderList(el.plannedList, planned, 'planned'); restoreKomootListState(); el.recordedSummary.textContent = t('recordedEmpty'); el.plannedSummary.textContent = t('plannedEmpty'); if (recorded.length) el.recordedSummary.textContent = t('komootLoadedSummary', { count: recorded.length }); if (planned.length) el.plannedSummary.textContent = t('komootLoadedSummary', { count: planned.length }); renderKomootSelectionUi(); if (komootRestoreRaf) window.cancelAnimationFrame(komootRestoreRaf); komootRestoreRaf = window.requestAnimationFrame(() => { restoreKomootListState(); komootRestoreRaf = 0; });
  renderKomootLoadButton();
}
function renderProxy() {
  el.diagProxy.textContent = t('proxyUnknown');
  if (state.proxy.lastCheckAt) el.diagProxy.textContent = t('proxyOffline');
  if (state.proxy.online) el.diagProxy.textContent = t('proxyOnline');
  el.diagMode.textContent = t('proxyModeUnknown');
  if (state.proxy.mode) {
    el.diagMode.textContent = t('proxyModeReal');
    if (state.proxy.mode === 'stub') el.diagMode.textContent = t('proxyModeStub');
  }
  el.diagChecked.textContent = t('lastCheckNever');
  if (state.proxy.lastCheckAt) el.diagChecked.textContent = new Date(state.proxy.lastCheckAt).toLocaleString(lang());
  el.diagError.textContent = state.proxy.lastError || t('noError');
}
function renderKomootProgress() { const progress = state.komootUi.progress; el.komootProgress.hidden = !progress.active; el.komootProgressLabel.textContent = progress.label || ''; el.komootProgressValue.textContent = `${Math.round(progress.value)}%`; if (progress.indeterminate) { el.komootProgressValue.textContent = '...'; el.komootProgressBar.removeAttribute('value'); } else { el.komootProgressBar.value = progress.value; } }
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
  if (hover) hover.replaceChildren();
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
  return state.profileUi.samples.reduce((best, current) => {
    if (Math.abs(current.cumulativeKm - targetKm) < Math.abs(best.cumulativeKm - targetKm)) return current;
    return best;
  }, state.profileUi.samples[0]);
}

/**
 * Creates an SVG element in the SVG namespace and applies its attributes.
 * @param {string} name SVG element name.
 * @param {Record<string, string|number>} attributes Attributes for the SVG element.
 * @returns {SVGElement} Configured SVG element.
 */
function createProfileSvgElement(name, attributes) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, `${value}`));
  return element;
}

/**
 * Draws the dynamic crosshair and point for the hovered elevation sample.
 * @param {SVGGElement} container SVG group reserved for hover graphics.
 * @param {number} x Horizontal chart coordinate.
 * @param {number} y Vertical chart coordinate.
 * @returns {void}
 */
function renderProfileHoverGraphics(container, x, y) {
  container.replaceChildren();
  container.append(
    createProfileSvgElement('line', { class: 'profile-hover-line', x1: x, y1: 22, x2: x, y2: 214 }),
    createProfileSvgElement('line', { class: 'profile-hover-line', x1: 46, y1: y, x2: 954, y2: y }),
    createProfileSvgElement('circle', { class: 'profile-hover-dot', cx: x, cy: y, r: 6 })
  );
}

function updateProfileHover(sample) {
  const marker = ensureProfileHoverMarker();
  marker.setLatLng([sample.lat, sample.lng]);
  const hover = el.profileChart.querySelector('.profile-hover');
  if (!hover || !state.profileUi.plot) return;
  const x = state.profileUi.plot.x(sample.cumulativeKm);
  const y = state.profileUi.plot.y(sample.ele);
  renderProfileHoverGraphics(hover, x, y);
  if (!el.profileCursorInfo) return;
  let ascent = 0;
  if (Number.isFinite(sample.cumulativeAscentM)) ascent = Math.round(sample.cumulativeAscentM);
  const grade = profileGradeAtPoint(state.profileUi.samples, state.profileUi.samples.indexOf(sample));
  let ascentDirection = 0;
  if (ascent > 0) ascentDirection = 1;
  el.profileCursorAfter.textContent = `${fmtKm(sample.cumulativeKm)} km (${fmtElapsedShort(sample.cumulativeTimeSec)}, ${gradeArrow(ascentDirection)} ${fmtNum(ascent)} m)`;
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
  const visibleIds = filteredTrackIdSet();
  let track = null;
  if (state.selectedTrackIds.has(state.highlightedTrackId) && visibleIds.has(state.highlightedTrackId)) track = state.tracks.find((item) => item.id === state.highlightedTrackId) ?? null;
  el.profileTrackName.textContent = track?.name || '-';
  el.profileDistance.textContent = '-'; if (track) el.profileDistance.textContent = `${fmtKm(track.distanceKm)} km`;
  el.profileElevationRange.textContent = '-'; if (track?.hasElevation) el.profileElevationRange.textContent = `${fmtMeters(track.elevationMinM)} - ${fmtMeters(track.elevationMaxM)}`;
  el.profileAscent.textContent = '-'; if (track?.hasElevation) el.profileAscent.textContent = fmtMeters(track.elevationGainM);
  el.profileDescent.textContent = '-'; if (track?.hasElevation) el.profileDescent.textContent = fmtMeters(track.elevationLossM);
  el.profileAvgSpeed.textContent = '-'; if (track?.avgSpeedKmh != null) el.profileAvgSpeed.textContent = fmtHours(track.avgSpeedKmh);
  state.profileUi.trackId = track?.id ?? null;
  state.profileUi.samples = [];
  state.profileUi.plot = null;
  clearProfileHover();
  if (el.profileSegmentSummary) el.profileSegmentSummary.hidden = true;
  el.profileSurfaceBreakdown?.replaceChildren();
  el.profileWaytypeBreakdown?.replaceChildren();
  if (!track) {
    el.profileEmpty.hidden = false;
    el.profileEmpty.textContent = t('profileHintNoTrack');
    el.profileChartShell.hidden = true;
    el.profileChart.replaceChildren();
    return;
  }
  const samples = track.points.filter((point) => point.ele != null);
  if (samples.length < 2) {
    el.profileEmpty.hidden = false;
    el.profileEmpty.textContent = t('profileHintNoElevation');
    el.profileChartShell.hidden = true;
    el.profileChart.replaceChildren();
    return;
  }
  const hasSegmentSummary = state.settings.segmentOverlayMode && (normalizeRangeSegments(track.surfaceSegments).length || normalizeRangeSegments(track.wayTypeSegments).length);
  if (el.profileSegmentSummary) el.profileSegmentSummary.hidden = !hasSegmentSummary;
  renderProfileSegmentBreakdown(el.profileSurfaceBreakdown, track.surfaceSegments, 'surface');
  renderProfileSegmentBreakdown(el.profileWaytypeBreakdown, track.wayTypeSegments, 'waytype');
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
  const linePath = samples.map((point, index) => {
    let command = 'L';
    if (index === 0) command = 'M';
    return `${command} ${x(point.cumulativeKm).toFixed(2)} ${y(point.ele).toFixed(2)}`;
  }).join(' ');
  const areaPath = `${linePath} L ${x(samples.at(-1).cumulativeKm).toFixed(2)} ${(padY + plotHeight).toFixed(2)} L ${x(samples[0].cumulativeKm).toFixed(2)} ${(padY + plotHeight).toFixed(2)} Z`;
  el.profileChart.replaceChildren();
  [0, 0.5, 1].forEach((ratio) => {
    const elevation = maxEle - elevSpan * ratio;
    const lineY = y(elevation);
    const gridLine = createProfileSvgElement('line', { class: 'profile-grid-line', x1: padX, y1: lineY, x2: width - padX, y2: lineY });
    const gridLabel = createProfileSvgElement('text', { class: 'profile-axis-text', x: 8, y: lineY + 6 });
    gridLabel.textContent = `${Math.round(elevation)} m`;
    el.profileChart.append(gridLine, gridLabel);
  });
  el.profileChart.append(createProfileSvgElement('path', { class: 'profile-area', d: areaPath, fill: track.color }));
  el.profileChart.append(createProfileSvgElement('path', { class: 'profile-line', d: linePath, stroke: track.color }));
  const photoGroup = createProfileSvgElement('g', { class: 'profile-photos' });
  let profilePhotos = [];
  if (Array.isArray(track.photos)) profilePhotos = track.photos;
  profilePhotos.forEach((photo, index) => {
    const point = nearestTrackPoint(track, photoLatLng(photo));
    if (!point || point.cumulativeKm == null) return;
    const photoX = x(point.cumulativeKm);
    const marker = createProfileSvgElement('g', { class: 'profile-photo-marker', 'data-photo-index': index, tabindex: 0, role: 'button', 'aria-label': photo.title || `${track.name} ${index + 1}` });
    const icon = createProfileSvgElement('text', { class: 'profile-photo-icon', x: photoX, y: 22, 'text-anchor': 'middle' });
    icon.textContent = '📷';
    marker.append(createProfileSvgElement('line', { class: 'profile-photo-line', x1: photoX, y1: 22, x2: photoX, y2: 36 }), createProfileSvgElement('circle', { class: 'profile-photo-dot', cx: photoX, cy: 18, r: 7 }), icon);
    photoGroup.append(marker);
  });
  el.profileChart.append(photoGroup, createProfileSvgElement('g', { class: 'profile-hover' }));
  [0, maxDist / 2, maxDist].forEach((distance, index) => {
    let anchor = 'middle';
    if (index === 0) anchor = 'start';
    else if (index === 2) anchor = 'end';
    const tick = createProfileSvgElement('text', { class: 'profile-axis-text', x: x(distance), y: height - 8, 'text-anchor': anchor });
    tick.textContent = `${fmtKm(distance)} km`;
    el.profileChart.append(tick);
  });
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
    let timeMs = null;
    if (point.time) timeMs = parsePointTime(point.time);
    let cumulativeKm = point.cumulativeKm;
    if (cumulativeKm == null) {
      cumulativeKm = 0;
      if (index) cumulativeKm = previous.cumulativeKm + haversine(previous, point);
    }
    return {
      index,
      lat: point.lat,
      lng: point.lng,
      ele: point.ele ?? null,
      cumulativeKm,
      timeMs,
      elapsedSec: null,
      bearing: bearingDegrees(previous, next),
      gradePercent: profileGradeAtPoint(points, index),
      pointIndex: index
    };
  });
  const firstTime = samples.find((sample) => sample.timeMs != null)?.timeMs ?? null;
  const rawHasTime = firstTime != null && samples.some((sample) => sample.timeMs != null && sample.timeMs !== firstTime);
  const totalDistanceKm = samples.at(-1)?.cumulativeKm ?? 0;
  let rawDurationSec = null;
  if (rawHasTime) rawDurationSec = Math.max(0, ((samples.at(-1)?.timeMs ?? firstTime) - firstTime) / 1000);
  let fallbackDurationSec = null;
  if (Number.isFinite(track?.durationHours) && track.durationHours > 0) fallbackDurationSec = track.durationHours * 3600;
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
      sample.elapsedSec = null;
      if (sample.timeMs != null) sample.elapsedSec = Math.max(0, (sample.timeMs - firstTime) / 1000);
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
  const normalizedDirections = normalizeDirections(track.directions);
  let cumulativeDirectionKm = 0;
  const directionMarkers = normalizedDirections.map((direction, directionIndex) => {
    if (Number.isFinite(direction.prefixDistanceM) && direction.prefixDistanceM > 0) {
      cumulativeDirectionKm += Number(direction.prefixDistanceM) / 1000;
    }
    const distanceKm = clamp(cumulativeDirectionKm, 0, totalDistanceKm);
    if (Number.isFinite(direction.distanceM)) {
      cumulativeDirectionKm += Math.max(0, Number(direction.distanceM)) / 1000;
    } else if (totalDistanceKm) {
      cumulativeDirectionKm = ((directionIndex + 1) / Math.max(1, normalizedDirections.length + 1)) * totalDistanceKm;
    }
    const sampleIndex = samples.reduce((best, sample, index) => {
      if (Math.abs((sample.cumulativeKm ?? 0) - distanceKm) < Math.abs((samples[best]?.cumulativeKm ?? 0) - distanceKm)) return index;
      return best;
    }, 0);
    return {
      directionIndex,
      sampleIndex,
      distanceKm,
      instruction: direction.instruction,
      type: direction.type || null
    };
  }).filter(Boolean);
  const replayTrack = {
    trackId: track.id,
    track,
    samples,
    totalDistanceKm,
    totalDurationSec: totalDistanceKm,
    totalAscentM: track.elevationGainM ?? 0,
    totalDescentM: track.elevationLossM ?? 0,
    modeAvailable: { time: hasTime, distance: true },
    photoMarkers,
    directionMarkers
  };
  if (hasTime) replayTrack.totalDurationSec = samples.at(-1)?.elapsedSec ?? 0;
  return replayTrack;
}
function nextReplayDirection(replayTrack, frame) {
  if (!replayTrack?.directionMarkers?.length || !frame) return null;
  return replayTrack.directionMarkers.find((item) => item.distanceKm >= ((frame.cumulativeKm ?? 0) - 0.02)) ?? replayTrack.directionMarkers.at(-1) ?? null;
}
function replayDirectionText(replayTrack, frame) {
  const nextDirection = nextReplayDirection(replayTrack, frame);
  if (!nextDirection?.instruction) return '-';
  const remainingKm = Math.max(0, (nextDirection.distanceKm ?? 0) - (frame?.cumulativeKm ?? 0));
  const remainingMeters = Math.round(remainingKm * 1000);
  if (remainingMeters > 30) return `${nextDirection.instruction} · ${t('replayDirectionIn', { distance: `${fmtNum(remainingMeters)} m` })}`;
  return nextDirection.instruction;
}
function interpolateReplaySample(left, right, ratio) {
  const safeRatio = clamp(ratio, 0, 1);
  const lerp = (a, b) => a + (b - a) * safeRatio;
  let elevation = left.ele ?? right.ele ?? null;
  if (left.ele != null && right.ele != null) elevation = lerp(left.ele, right.ele);
  return {
    lat: lerp(left.lat, right.lat),
    lng: lerp(left.lng, right.lng),
    ele: elevation,
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
  let metric = 'cumulativeKm';
  if (mode === 'time' && replayTrack.modeAvailable.time) metric = 'elapsedSec';
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
  if (mode === 'time' && replayTrack.modeAvailable.time) return replayTrack.totalDurationSec;
  return replayTrack.totalDistanceKm;
}
function replayMetricLabel(replayTrack, cursor, mode = state.replay.mode) {
  if (mode === 'time' && replayTrack?.modeAvailable.time) return fmtElapsedShort(cursor);
  return `${fmtKm(cursor)} km`;
}
function replayCursorForMode(replayTrack, targetMode, referenceFrame) {
  if (!replayTrack || !referenceFrame) return 0;
  if (targetMode === 'time' && replayTrack.modeAvailable.time) return clamp(referenceFrame.elapsedSec ?? 0, 0, replayTrack.totalDurationSec);
  return clamp(referenceFrame.cumulativeKm ?? 0, 0, replayTrack.totalDistanceKm);
}
function replayCandidateTrack() {
  const highlighted = state.tracks.find((track) => track.id === state.highlightedTrackId) ?? null;
  if (highlighted) return highlighted;
  const favorite = state.tracks.find((track) => track.favorite) ?? null;
  if (favorite) return favorite;
  const selected = state.tracks.find((track) => state.selectedTrackIds.has(track.id)) ?? null;
  if (selected) return selected;
  if (state.replay.activeTrackId) return state.tracks.find((track) => track.id === state.replay.activeTrackId) ?? null;
  return state.tracks[0] ?? null;
}
function replaySeekValueFromDistance(distanceKm) {
  if (!state.replay.replayTrack) return 0;
  if (state.replay.mode !== 'time' || !state.replay.replayTrack.modeAvailable.time) return distanceKm;
  const sample = state.replay.replayTrack.samples.reduce((best, current) => {
    const currentDistance = Math.abs(current.cumulativeKm - distanceKm);
    const bestDistance = Math.abs(best.cumulativeKm - distanceKm);
    if (currentDistance < bestDistance) return current;
    return best;
  }, state.replay.replayTrack.samples[0]);
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
          terrainSource: { type: 'raster-dem', url: 'https://tiles.mapterhorn.com/tilejson.json', attribution: '<a href="https://mapterhorn.com/attribution" target="_blank" rel="noopener noreferrer">&copy; Mapterhorn</a>' },
          hillshadeSource: { type: 'raster-dem', url: 'https://tiles.mapterhorn.com/tilejson.json', attribution: '<a href="https://mapterhorn.com/attribution" target="_blank" rel="noopener noreferrer">&copy; Mapterhorn</a>' }
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
    const template = document.querySelector('#replay-3d-placeholder-template');
    const fragment = template.content.cloneNode(true);
    fragment.querySelector('.replay-placeholder-note').textContent = t('replayUnavailable3d');
    el.replayMap3d.append(fragment);
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
    let center = L.latLng(frame.lat, frame.lng);
    if (bounds) center = bounds.getCenter();
    return { center, zoom: null, bounds };
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
    let duration = 0;
    if (animate) duration = 0.45;
    state.replayMap2d.fitBounds(target.bounds.pad(0.22), { animate, duration });
    state.replay.lastApplied2DMode = 'overview';
    return;
  }
  const map = state.replayMap2d;
  const zoomTarget = target.zoom ?? state.replayMap2d.getZoom();
  const currentZoom = map.getZoom();
  state.replay.lastApplied2DMode = state.replay.cameraMode2d;
  if (force || Math.abs(currentZoom - zoomTarget) > 0.12) {
    let duration = 0;
    if (animate) duration = 0.45;
    map.setView(target.center, zoomTarget, { animate, duration });
    return;
  }
  const size = map.getSize();
  const markerPoint = map.latLngToContainerPoint([frame.lat, frame.lng]);
  let desiredX = size.x * 0.5;
  if (state.replay.cameraMode2d === 'ahead') desiredX = size.x * 0.34;
  const desiredY = size.y * 0.56;
  const deltaX = markerPoint.x - desiredX;
  const deltaY = markerPoint.y - desiredY;
  let deadZoneX = Math.max(40, size.x * 0.06);
  if (state.replay.cameraMode2d === 'ahead') deadZoneX = Math.max(56, size.x * 0.09);
  const deadZoneY = Math.max(28, size.y * 0.08);
  if (!force && Math.abs(deltaX) <= deadZoneX && Math.abs(deltaY) <= deadZoneY) return;
  map.panBy([deltaX, deltaY], { animate: false, duration: 0 });
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
    let stableBearing = ((frame.bearing ?? 0) + 32) % 360;
    if (Number.isFinite(state.replay.replayTrack?.orbitBearing)) stableBearing = state.replay.replayTrack.orbitBearing;
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
  let photoFeatures = [];
  if (state.replay.showPhotos) {
    photoFeatures = (replayTrack.track.photos ?? []).map((photo) => {
      const latLng = photoLatLng(photo);
      if (!latLng) return null;
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [latLng[1], latLng[0]] }, properties: {} };
    }).filter(Boolean);
  }
  map.getSource('replay-photos')?.setData({ type: 'FeatureCollection', features: photoFeatures });
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
  const hasPhotos = !!replayTrack?.photoMarkers?.length;
  const hasElevation = !!replayTrack?.samples?.some((sample) => Number.isFinite(sample?.ele));
  el.replayViewButtons?.forEach((button) => {
    const active = button.dataset.replayView === state.replay.view;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (el.replaySpeedSelect) el.replaySpeedSelect.value = String(state.replay.speed);
  el.replayModeButtons?.forEach((button) => {
    const isTime = button.dataset.replayMode === 'time';
    const active = button.dataset.replayMode === state.replay.mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    button.disabled = !hasTrack || (isTime && !canUseTime);
  });
  if (el.replayCamera2dRow) el.replayCamera2dRow.hidden = !is2d;
  if (el.replayCamera3dRow) el.replayCamera3dRow.hidden = is2d;
  el.replayCamera2dButtons?.forEach((button) => {
    const mode = button.getAttribute('data-replay-camera-2d') || 'center';
    const active = mode === state.replay.cameraMode2d;
    button.classList.toggle('is-active', active);
    button.dataset.active = String(active);
    button.setAttribute('aria-pressed', String(active));
    button.style.background = '';
    button.style.borderColor = '';
    button.style.color = '';
    button.style.boxShadow = '';
    if (active) {
      button.style.background = 'linear-gradient(135deg, rgba(185, 224, 196, 0.98), rgba(142, 198, 160, 0.82))';
      button.style.borderColor = 'rgba(185, 224, 196, 0.9)';
      button.style.color = '#18302a';
      button.style.boxShadow = 'inset 0 0 0 1px rgba(255, 255, 255, 0.16), 0 10px 20px rgba(8, 16, 14, 0.22)';
    }
  });
  el.replayCameraButtons?.forEach((button) => {
    const active = button.dataset.replayCamera === state.replay.cameraMode3d;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  [el.replayRestartButton, el.replayPlayButton, el.replayPauseButton, el.replayBackButton, el.replayForwardButton, ...el.replayViewButtons, ...el.replayCamera2dButtons, ...el.replayCameraButtons].forEach((button) => {
    if (!button) return;
    button.disabled = !hasTrack;
  });
  if (el.replayJumpStartButton) el.replayJumpStartButton.disabled = !hasTrack;
  if (el.replayJumpEndButton) el.replayJumpEndButton.disabled = !hasTrack;
  if (el.replayJumpHighButton) el.replayJumpHighButton.disabled = !hasTrack || !hasElevation;
  if (el.replayJumpPhotoButton) el.replayJumpPhotoButton.disabled = !hasTrack || !hasPhotos;
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
function buildReplayProfileGeometry(replayTrack) {
  const samples = replayTrack.samples;
  const width = 1000;
  const height = 260;
  const padding = { top: 10, right: 18, bottom: 18, left: 18 };
  const elevations = samples.map((sample) => sample.ele ?? replayTrack.track.elevationMinM ?? 0);
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const span = Math.max(1, max - min);
  let exaggeration = 1.12;
  if (span < 180) exaggeration = 1.3;
  if (span < 80) exaggeration = 1.55;
  if (span < 35) exaggeration = 1.85;
  const mid = (min + max) / 2;
  const midY = padding.top + ((height - padding.top - padding.bottom) / 2);
  const halfPlotHeight = (height - padding.top - padding.bottom) / 2;
  const xFor = (km) => padding.left + (km / Math.max(0.001, replayTrack.totalDistanceKm || 0.001)) * (width - padding.left - padding.right);
  const yFor = (ele) => {
    const normalized = ((ele - mid) / Math.max(span / 2, 1)) * exaggeration;
    const rawY = midY - (normalized * halfPlotHeight);
    return clamp(rawY, padding.top, height - padding.bottom);
  };
  return {
    key: `${replayTrack.track.id}:${replayTrack.samples.length}:${replayTrack.totalDistanceKm}:${replayTrack.track.color || ''}`,
    width,
    height,
    padding,
    min,
    xFor,
    yFor,
    polyline: samples.map((sample) => `${xFor(sample.cumulativeKm)},${yFor(sample.ele ?? min)}`).join(' ')
  };
}
function ensureReplayProfileGeometry(replayTrack) {
  if (!replayTrack) return null;
  const current = state.replay.profileRender;
  const nextKey = `${replayTrack.track.id}:${replayTrack.samples.length}:${replayTrack.totalDistanceKm}:${replayTrack.track.color || ''}`;
  if (current.key === nextKey && current.geometry) return current.geometry;
  const geometry = buildReplayProfileGeometry(replayTrack);
  state.replay.profileRender = { key: geometry.key, geometry };
  return geometry;
}
/**
 * Renders the static elevation-profile SVG elements from the replay chart template.
 * @param {object} replayTrack Replay data containing the track color.
 * @param {object} geometry Precalculated dimensions and profile coordinates.
 * @returns {void}
 */
function renderReplayProfileStaticChart(replayTrack, geometry) {
  const startX = geometry.padding.left;
  const startY = geometry.yFor(geometry.min);
  const fragment = el.replayProfileChartTemplate.content.cloneNode(true);
  const chartTemplate = fragment.querySelector('svg');
  const gridLine = chartTemplate.querySelector('.profile-grid-line');
  const profileLine = chartTemplate.querySelector('.profile-line');
  const hoverLine = chartTemplate.querySelector('.profile-hover-line');
  const hoverDot = chartTemplate.querySelector('.profile-hover-dot');
  const chartBottom = geometry.height - geometry.padding.bottom;
  const chartRight = geometry.width - geometry.padding.right;
  let trackColor = '#9ed5b0';
  if (replayTrack.track.color) trackColor = replayTrack.track.color;
  gridLine.setAttribute('x1', `${geometry.padding.left}`);
  gridLine.setAttribute('y1', `${chartBottom}`);
  gridLine.setAttribute('x2', `${chartRight}`);
  gridLine.setAttribute('y2', `${chartBottom}`);
  profileLine.setAttribute('points', geometry.polyline);
  profileLine.setAttribute('stroke', trackColor);
  hoverLine.setAttribute('x1', `${startX}`);
  hoverLine.setAttribute('y1', `${geometry.padding.top}`);
  hoverLine.setAttribute('x2', `${startX}`);
  hoverLine.setAttribute('y2', `${chartBottom}`);
  hoverDot.setAttribute('cx', `${startX}`);
  hoverDot.setAttribute('cy', `${startY}`);
  el.replayProfileChart.replaceChildren(...chartTemplate.children);
  el.replayProfileChart.dataset.geometryKey = geometry.key;
}
function updateReplayProfileCursor(geometry, frame) {
  let cursorX = geometry.padding.left;
  let cursorY = geometry.yFor(geometry.min);
  if (frame) {
    cursorX = geometry.xFor(frame.cumulativeKm);
    cursorY = geometry.yFor(frame.ele ?? geometry.min);
  }
  const cursorLine = el.replayProfileChart.querySelector('.profile-hover-line');
  const cursorDot = el.replayProfileChart.querySelector('.profile-hover-dot');
  if (cursorLine) {
    cursorLine.setAttribute('x1', `${cursorX}`);
    cursorLine.setAttribute('x2', `${cursorX}`);
  }
  if (cursorDot) {
    cursorDot.setAttribute('cx', `${cursorX}`);
    cursorDot.setAttribute('cy', `${cursorY}`);
  }
}
function renderReplayProfile() {
  const replayTrack = state.replay.replayTrack;
  const frame = replayFrameAtCursor(replayTrack, state.replay.mode, state.replay.cursor);
  const visible = !!(replayTrack && replayTrack.track.hasElevation && state.replay.showProfile);
  el.replayProfilePanel.hidden = !state.replay.showProfile;
  el.replayWorkspace?.classList.toggle('is-profile-collapsed', !state.replay.showProfile);
  if (el.replayProfileTrackName) el.replayProfileTrackName.textContent = replayTrack?.track?.name || '-';
  el.replayAscentValue.textContent = '-';
  el.replayDescentValue.textContent = '-';
  if (replayTrack?.track?.hasElevation) {
    el.replayAscentValue.textContent = fmtMeters(replayTrack.track.elevationGainM);
    el.replayDescentValue.textContent = fmtMeters(replayTrack.track.elevationLossM);
  }
  el.replaySpeedValue.textContent = '-';
  if (frame?.elapsedSec > 0 && frame?.cumulativeKm > 0) el.replaySpeedValue.textContent = fmtHours((frame.cumulativeKm / frame.elapsedSec) * 3600);
  el.replayPointValue.textContent = '-';
  if (replayTrack && frame) el.replayPointValue.textContent = `${fmtNum(Math.min(replayTrack.samples.length, Math.round(frame.pointIndex ?? 0) + 1))} / ${fmtNum(replayTrack.samples.length)}`;
  el.replayProfileEmpty.hidden = visible;
  el.replayProfileChartShell.hidden = !visible;
  if (!visible) {
    el.replayProfileEmpty.textContent = t('replayProfileHint');
    if (replayTrack && !replayTrack.track.hasElevation) el.replayProfileEmpty.textContent = t('profileHintNoElevation');
    el.replayProfileChart.replaceChildren();
    state.replay.profileRender = { key: null, geometry: null };
    return;
  }
  const geometry = ensureReplayProfileGeometry(replayTrack);
  if (!geometry) return;
  if (el.replayProfileChart.dataset.geometryKey !== geometry.key) renderReplayProfileStaticChart(replayTrack, geometry);
  updateReplayProfileCursor(geometry, frame);
}
function renderReplayTimeline() {}
function updateReplayReadouts(replayTrack, frame) {
  el.replayDistanceValue.textContent = '0.0 km';
  el.replayAltitudeValue.textContent = '-';
  el.replayGradeValue.textContent = '-';
  el.replayTimeValue.textContent = '--:--:--';
  if (frame) {
    el.replayDistanceValue.textContent = `${fmtKm(frame.cumulativeKm)} km`;
    el.replayGradeValue.textContent = fmtGrade(frame.gradePercent);
    el.replayTimeValue.textContent = fmtElapsedShort(frame.elapsedSec);
    if (frame.ele != null) el.replayAltitudeValue.textContent = fmtMeters(frame.ele);
  }
  if (el.replayDirectionValue) el.replayDirectionValue.textContent = replayDirectionText(replayTrack, frame);
}
function renderReplayDirectionOverlay(replayTrack, frame) {
  if (!el.replayDirectionOverlay || !el.replayDirectionOverlayIcon || !el.replayDirectionOverlayToggle) return;
  const collapsed = !!state.settings.replayDirectionOverlayCollapsed;
  el.replayDirectionOverlay.hidden = collapsed;
  el.replayDirectionOverlayIcon.hidden = !collapsed;
  let directionToggleLabel = t('replayDirectionHide');
  el.replayDirectionOverlayToggle.textContent = '–';
  if (collapsed) {
    el.replayDirectionOverlayToggle.textContent = '+';
    directionToggleLabel = t('replayDirectionShow');
  }
  el.replayDirectionOverlayToggle.setAttribute('aria-label', directionToggleLabel);
  el.replayDirectionOverlayToggle.setAttribute('title', directionToggleLabel);
  el.replayDirectionOverlayIcon.setAttribute('aria-label', t('replayDirectionShow'));
  el.replayDirectionOverlayIcon.setAttribute('title', t('replayDirectionShow'));
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
    renderReplayDirectionOverlay(null, null);
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
  renderReplayDirectionOverlay(replayTrack, frame);
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
  let increment = deltaSec * state.replay.speed * distanceScale;
  if (state.replay.mode === 'time') increment = deltaSec * state.replay.speed * REPLAY_TIME_SCALE;
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
function jumpReplayTo(kind) {
  const replayTrack = state.replay.replayTrack;
  if (!replayTrack?.samples?.length) return;
  let targetFrame = replayTrack.samples[0];
  if (kind === 'end') {
    targetFrame = replayTrack.samples.at(-1);
  } else if (kind === 'highest') {
    targetFrame = replayTrack.samples.reduce((best, sample) => {
      const bestElevation = best.ele ?? Number.NEGATIVE_INFINITY;
      const sampleElevation = sample.ele ?? Number.NEGATIVE_INFINITY;
      if (sampleElevation > bestElevation) return sample;
      return best;
    }, replayTrack.samples[0]);
  } else if (kind === 'photo') {
    const currentFrame = replayFrameAtCursor(replayTrack, state.replay.mode, state.replay.cursor);
    const currentDistance = currentFrame?.cumulativeKm ?? 0;
    const marker = replayTrack.photoMarkers.find((item) => item.distanceKm >= currentDistance) ?? replayTrack.photoMarkers[0];
    if (marker) targetFrame = replayTrack.samples[marker.sampleIndex] ?? targetFrame;
  }
  setReplayPlaying(false);
  setReplayCursor(replayCursorForMode(replayTrack, state.replay.mode, targetFrame));
}
function resetReplayToStart() {
  setReplayPlaying(false);
  setReplayCursor(0);
}
function setReplayMode(mode) {
  const replayTrack = state.replay.replayTrack;
  const referenceFrame = replayFrameAtCursor(replayTrack, state.replay.mode, state.replay.cursor);
  state.replay.mode = 'distance';
  if (mode === 'time' && replayTrack?.modeAvailable.time) state.replay.mode = 'time';
  applyReplayModeDefaults(state.replay.mode, state.replay.view);
  state.replay.cursor = replayCursorForMode(replayTrack, state.replay.mode, referenceFrame);
  renderReplayWorkspace();
}
function setReplayView(view) {
  state.replay.view = '2d';
  if (view === '3d') state.replay.view = '3d';
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
  let color = track.color;
  let weight = baseWeight;
  let opacity = 1;
  let dashArray = null;
  if (highlighted) {
    color = HIGHLIGHT_COLOR;
    weight = baseWeight + 2;
  }
  if (track.type === 'planned') dashArray = '10 8';
  if (casing) {
    color = TRACK_CASING_COLOR;
    weight = baseWeight + 4;
    opacity = 0.98;
    dashArray = null;
    if (highlighted) {
      color = TRACK_HIGHLIGHT_CASING;
      weight = baseWeight + 6;
    }
  }
  return { color, weight, opacity, dashArray, lineCap: 'round', lineJoin: 'round' };
}
function surfaceSegmentColor(value) {
  const key = `${value ?? ''}`.toLowerCase();
  if (key.includes('asphalt')) return '#2563eb';
  if ((key.includes('paved') && !key.includes('unpaved')) || key.includes('concrete')) return '#0f766e';
  if (key.includes('paving') || key.includes('sett') || key.includes('cobbl')) return '#f59e0b';
  if (key.includes('compacted')) return '#c2410c';
  if (key.includes('fine_gravel')) return '#fb7185';
  if (key.includes('gravel')) return '#f97316';
  if (key.includes('unpaved')) return '#7c3aed';
  if (key.includes('dirt') || key.includes('ground') || key.includes('earth') || key.includes('mud')) return '#92400e';
  if (key.includes('sand')) return '#eab308';
  if (key.includes('grass')) return '#65a30d';
  const hue = hashString(key) % 360;
  return `hsl(${hue} 78% 58%)`;
}
function wayTypeSegmentDash(value) {
  const key = `${value ?? ''}`.toLowerCase();
  if (key.includes('cycleway')) return '10 6';
  if (key.includes('path') || key.includes('trail') || key.includes('singletrack')) return '2 6';
  if (key.includes('track') || key.includes('service')) return '14 5';
  if (key.includes('street') || key.includes('road')) return '6 4';
  return '4 5';
}
function scaledSegmentIndices(track, segments, segment) {
  const pointCount = track?.points?.length ?? 0;
  if (pointCount < 2) return null;
  const maxTo = Math.max(1, ...segments.map((item) => Number(item?.to) || 0));
  const pointMax = pointCount - 1;
  const scale = pointMax / maxTo;
  const from = clamp(Math.round((Number(segment.from) || 0) * scale), 0, Math.max(0, pointMax - 1));
  const to = clamp(Math.round((Number(segment.to) || 0) * scale), Math.min(pointMax, from + 1), pointMax);
  if (to <= from) return null;
  return { from, to };
}
function buildTrackSegmentLayers(track) {
  const layers = [];
  const baseWeight = Math.max(4, Number(state.settings.trackLineWeight) || 6);
  const surfaceSegments = normalizeRangeSegments(track.surfaceSegments);
  const wayTypeSegments = normalizeRangeSegments(track.wayTypeSegments);
  if (surfaceSegments.length) {
    surfaceSegments.forEach((segment) => {
      const indices = scaledSegmentIndices(track, surfaceSegments, segment);
      if (!indices) return;
      const latLngs = track.points.slice(indices.from, indices.to + 1).map((point) => [point.lat, point.lng]);
      if (latLngs.length < 2) return;
      layers.push(L.polyline(latLngs, {
        interactive: false,
        color: surfaceSegmentColor(segment.value),
        weight: Math.max(4, baseWeight + 1),
        opacity: 0.92,
        lineCap: 'round',
        lineJoin: 'round'
      }));
    });
  }
  if (wayTypeSegments.length) {
    wayTypeSegments.forEach((segment) => {
      const indices = scaledSegmentIndices(track, wayTypeSegments, segment);
      if (!indices) return;
      const latLngs = track.points.slice(indices.from, indices.to + 1).map((point) => [point.lat, point.lng]);
      if (latLngs.length < 2) return;
      layers.push(L.polyline(latLngs, {
        interactive: false,
        color: 'rgba(248, 251, 250, 0.92)',
        weight: Math.max(2, Math.round(baseWeight / 2)),
        opacity: 0.95,
        dashArray: wayTypeSegmentDash(segment.value),
        lineCap: 'butt',
        lineJoin: 'round'
      }));
    });
  }
  return L.layerGroup(layers);
}
/**
 * Renders surface or way-type legend items using the shared legend item template.
 * @param {HTMLElement|null} container Target element for legend items.
 * @param {Array<string>} values Segment values to display.
 * @param {'surface'|'waytype'} type Segment category that controls the line style.
 * @returns {void}
 */
function renderMapSegmentLegendItems(container, values, type) {
  if (!container) return;
  container.replaceChildren();
  if (!values.length) {
    const empty = document.createElement('span');
    empty.className = 'map-segment-empty';
    empty.textContent = t('analysisNone');
    container.append(empty);
    return;
  }
  const template = document.querySelector('#map-segment-legend-item-template');
  values.forEach((value) => {
    const fragment = template.content.cloneNode(true);
    const line = fragment.querySelector('.map-segment-legend-line');
    const label = fragment.querySelector('.map-segment-legend-label');
    line.setAttribute('stroke', 'rgba(248, 251, 250, 0.92)');
    line.setAttribute('stroke-width', '3');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-dasharray', wayTypeSegmentDash(value));
    if (type === 'surface') {
      line.setAttribute('stroke', surfaceSegmentColor(value));
      line.setAttribute('stroke-width', '4');
      line.removeAttribute('stroke-dasharray');
    }
    label.textContent = displayDetailValue(value);
    container.append(fragment);
  });
}
function renderMapSegmentLegend() {
  const track = state.tracks.find((item) => item.id === state.highlightedTrackId);
  let surfaceValues = [];
  let wayTypeValues = [];
  if (track) {
    surfaceValues = segmentValues(track.surfaceSegments);
    wayTypeValues = segmentValues(track.wayTypeSegments);
  }
  renderMapSegmentLegendItems(el.segmentHelpSurfaceItems, surfaceValues, 'surface');
  renderMapSegmentLegendItems(el.segmentHelpWaytypeItems, wayTypeValues, 'waytype');
}
function buildTrackDecorations(track) {
  const zoom = state.map?.getZoom?.() ?? 0;
  const { kmStep, arrowStep } = decorationStepsForZoom(zoom);
  const highlighted = state.highlightedTrackId === track.id;
  let color = track.color;
  if (highlighted) color = HIGHLIGHT_COLOR;
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
    let offset = Math.max(0.5, arrowStep / 2);
    if (kmStep) offset = 0.5;
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
  if (!track || !entry || state.settings.photoOverlayOnly || state.settings.heatmapMode || !entry.line) return;
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
function heatmapTrackSet() {
  return visibleSelectedTracks().filter((track) => (track.points?.length ?? 0) > 1);
}
  function canRenderHeatmap() {
    return heatmapTrackSet().length > 1;
  }
  function heatmapStepForLatitude(lat) {
    const meters = 60;
    const latStep = meters / 111320;
    const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    const lngStep = meters / (111320 * cosLat);
    return { latStep, lngStep };
  }
function snapHeatmapPoint(lat, lng) {
  const { latStep, lngStep } = heatmapStepForLatitude(lat);
  const snappedLat = Math.round(lat / latStep) * latStep;
  const snappedLng = Math.round(lng / lngStep) * lngStep;
  return {
    lat: snappedLat,
    lng: snappedLng,
    key: `${snappedLat.toFixed(5)}|${snappedLng.toFixed(5)}`
  };
}
function heatmapColor(ratio) {
  const safe = Math.min(1, Math.max(0, ratio));
  const hue = 210 - (210 * safe);
  const saturation = 92;
  const lightness = 58 - (14 * safe);
  return `hsl(${hue.toFixed(0)} ${saturation}% ${lightness.toFixed(0)}%)`;
}
  function buildHeatmapLayer(tracks) {
    const group = L.layerGroup();
    if (!tracks.length) return group;
    const nodeCounts = new Map();
    const segmentCounts = new Map();
    tracks.forEach((track) => {
      let previous = null;
      const trackNodes = new Map();
      const trackSegments = new Map();
      for (const point of track.points || []) {
        if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lng)) continue;
        const snapped = snapHeatmapPoint(point.lat, point.lng);
        if (!trackNodes.has(snapped.key)) {
          trackNodes.set(snapped.key, snapped);
        }
        if (previous && previous.key !== snapped.key) {
          const forward = `${previous.key}->${snapped.key}`;
          const reverse = `${snapped.key}->${previous.key}`;
          let key = reverse;
          let start = snapped;
          let end = previous;
          if (forward < reverse) {
            key = forward;
            start = previous;
            end = snapped;
          }
          if (!trackSegments.has(key)) {
            trackSegments.set(key, { start, end });
          }
        }
        previous = snapped;
      }
      for (const entry of trackNodes.values()) {
        nodeCounts.set(entry.key, { ...entry, count: (nodeCounts.get(entry.key)?.count ?? 0) + 1 });
      }
      for (const [key, entry] of trackSegments.entries()) {
        const existing = segmentCounts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          segmentCounts.set(key, { ...entry, count: 1 });
        }
      }
    });
  const segmentEntries = [...segmentCounts.values()];
  const nodeEntries = [...nodeCounts.values()];
  const maxSegmentCount = Math.max(1, ...segmentEntries.map((entry) => entry.count));
  const maxNodeCount = Math.max(1, ...nodeEntries.map((entry) => entry.count));
  segmentEntries
    .sort((left, right) => left.count - right.count)
    .forEach((entry) => {
      const ratio = entry.count / maxSegmentCount;
      L.polyline(
        [[entry.start.lat, entry.start.lng], [entry.end.lat, entry.end.lng]],
        {
          interactive: false,
          color: heatmapColor(ratio),
          weight: 3 + (ratio * 11),
          opacity: 0.22 + (ratio * 0.63),
          lineCap: 'round',
          lineJoin: 'round'
        }
      ).addTo(group);
    });
    nodeEntries
      .filter((entry) => entry.count > 1)
    .sort((left, right) => left.count - right.count)
    .forEach((entry) => {
      const ratio = entry.count / maxNodeCount;
      L.circleMarker([entry.lat, entry.lng], {
        interactive: false,
        radius: 3 + (ratio * 8),
        weight: 1.5,
        color: 'rgba(19, 28, 27, 0.78)',
        fillColor: heatmapColor(ratio),
        fillOpacity: 0.16 + (ratio * 0.46),
        opacity: 0.8
        }).addTo(group);
      });
    group.__heatmapStats = {
      tracks: tracks.length,
      segments: segmentEntries.length,
      hotspots: nodeEntries.filter((entry) => entry.count > 1).length
    };
    return group;
  }
function exportTrackGpx(trackId) {
  const track = state.tracks.find((item) => item.id === trackId);
  if (!track?.gpxText) return;
  downloadBlob(`${sanitizeFileName(track.name)}.gpx`, new Blob([track.gpxText], { type: 'application/gpx+xml' }));
}
function escapeXml(value) {
  return `${value ?? ''}`.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
function trackToGpxTrackXml(track) {
  const lines = ['  <trk>'];
  lines.push(`    <name>${escapeXml(track.name || t('unnamedTrack'))}</name>`);
  if (track.description) lines.push(`    <desc>${escapeXml(track.description)}</desc>`);
  if (track.sport) lines.push(`    <type>${escapeXml(track.sport)}</type>`);
  lines.push('    <trkseg>');
  (track.points || []).forEach((point) => {
    const attrs = `lat="${Number(point.lat).toFixed(6)}" lon="${Number(point.lng).toFixed(6)}"`;
    lines.push(`      <trkpt ${attrs}>`);
    if (Number.isFinite(point.ele)) lines.push(`        <ele>${Number(point.ele).toFixed(1)}</ele>`);
    if (point.time) lines.push(`        <time>${escapeXml(point.time)}</time>`);
    lines.push('      </trkpt>');
  });
  lines.push('    </trkseg>');
  lines.push('  </trk>');
  return lines.join('\n');
}
async function gzipTextBlob(text, type) {
  if (typeof CompressionStream === 'undefined') {
    return new Blob([text], { type });
  }
  const stream = new Blob([text], { type }).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      if (c & 1) c = 0xEDB88320 ^ (c >>> 1);
      else c >>>= 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (const value of bytes) crc = CRC32_TABLE[(crc ^ value) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function dosDateTimeParts(value) {
  let date = new Date();
  if (value) date = new Date(value);
  let safe = date;
  if (Number.isNaN(date.getTime())) safe = new Date();
  const year = Math.max(1980, safe.getFullYear());
  const dosTime = ((safe.getHours() & 0x1F) << 11) | ((safe.getMinutes() & 0x3F) << 5) | Math.floor(safe.getSeconds() / 2);
  const dosDate = (((year - 1980) & 0x7F) << 9) | (((safe.getMonth() + 1) & 0x0F) << 5) | (safe.getDate() & 0x1F);
  return { dosTime, dosDate };
}
function writeUint16(view, offset, value) { view.setUint16(offset, value, true); }
function writeUint32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }
async function createZipBlob(files) {
  const encoder = new TextEncoder();
  const entries = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    let dataBytes = new Uint8Array(file.bytes);
    if (file.bytes instanceof Uint8Array) dataBytes = file.bytes;
    const { dosTime, dosDate } = dosDateTimeParts(file.modifiedAt);
    const checksum = crc32(dataBytes);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, dosTime);
    writeUint16(localView, 12, dosDate);
    writeUint32(localView, 14, checksum);
    writeUint32(localView, 18, dataBytes.length);
    writeUint32(localView, 22, dataBytes.length);
    writeUint16(localView, 26, nameBytes.length);
    writeUint16(localView, 28, 0);
    localHeader.set(nameBytes, 30);
    entries.push({ nameBytes, dataBytes, localHeader, checksum, dosTime, dosDate, offset });
    offset += localHeader.length + dataBytes.length;
  }
  const centralParts = [];
  let centralSize = 0;
  entries.forEach((entry) => {
    const central = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(central.buffer);
    writeUint32(view, 0, 0x02014b50);
    writeUint16(view, 4, 20);
    writeUint16(view, 6, 20);
    writeUint16(view, 8, 0);
    writeUint16(view, 10, 0);
    writeUint16(view, 12, entry.dosTime);
    writeUint16(view, 14, entry.dosDate);
    writeUint32(view, 16, entry.checksum);
    writeUint32(view, 20, entry.dataBytes.length);
    writeUint32(view, 24, entry.dataBytes.length);
    writeUint16(view, 28, entry.nameBytes.length);
    writeUint16(view, 30, 0);
    writeUint16(view, 32, 0);
    writeUint16(view, 34, 0);
    writeUint16(view, 36, 0);
    writeUint32(view, 38, 0);
    writeUint32(view, 42, entry.offset);
    central.set(entry.nameBytes, 46);
    centralParts.push(central);
    centralSize += central.length;
  });
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, entries.length);
  writeUint16(endView, 10, entries.length);
  writeUint32(endView, 12, centralSize);
  writeUint32(endView, 16, offset);
  writeUint16(endView, 20, 0);
  const parts = [];
  entries.forEach((entry) => {
    parts.push(entry.localHeader, entry.dataBytes);
  });
  parts.push(...centralParts, end);
  return new Blob(parts, { type: 'application/zip' });
}

/**
 * Turns a value into text that is safe inside a KML CDATA section.
 * @param {unknown} value Text content to protect.
 * @returns {string} CDATA-safe text.
 */
function cdataText(value) {
  return `${value ?? ''}`.replaceAll(']]>', ']]]]><![CDATA[>');
}

/**
 * Creates a KML coordinate tuple from a Trailthread point.
 * @param {object} point Track or photo location.
 * @returns {string|null} KML longitude, latitude and optional altitude tuple.
 */
function kmlCoordinates(point) {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const altitude = Number(point?.alt ?? point?.ele);
  if (Number.isFinite(altitude)) return `${lng.toFixed(6)},${lat.toFixed(6)},${altitude.toFixed(1)}`;
  return `${lng.toFixed(6)},${lat.toFixed(6)}`;
}

/**
 * Converts a CSS hexadecimal color into KML's alpha-blue-green-red color order.
 * @param {string} color CSS color in #RRGGBB format.
 * @returns {string} Fully opaque KML color in aabbggrr format.
 */
function kmlLineColor(color) {
  let hex = cleanText(color).replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) hex = '0050ff';
  const red = hex.slice(0, 2);
  const green = hex.slice(2, 4);
  const blue = hex.slice(4, 6);
  return `ff${blue}${green}${red}`;
}

/**
 * Converts a data URL into its bytes and media type.
 * @param {string} dataUrl Image data URL.
 * @returns {Promise<{bytes: Uint8Array, type: string}>} Image file contents and media type.
 */
async function dataUrlToBytes(dataUrl) {
  const response = await fetch(dataUrl);
  return { bytes: new Uint8Array(await response.arrayBuffer()), type: response.headers.get('content-type') || 'application/octet-stream' };
}

/**
 * Returns a suitable filename extension for a packaged photo.
 * @param {string} type Image media type.
 * @returns {string} Filename extension without a dot.
 */
function imageExtensionForType(type) {
  const normalized = cleanText(type).toLocaleLowerCase();
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/gif') return 'gif';
  return 'bin';
}

/**
 * Builds a portable KML description for one photo.
 * @param {object} photo Serialized photo metadata.
 * @param {string|null} imageUrl External image URL, if available.
 * @returns {string} HTML used as KML feature description.
 */
function buildKmlPhotoDescription(photo, imageUrl) {
  const parts = [];
  const caption = cleanText(photo.caption || photo.title);
  if (caption) parts.push(`<p>${escapeXml(caption)}</p>`);
  if (imageUrl) parts.push(`<p><img src="${escapeXml(imageUrl)}" alt="${escapeXml(photo.title || caption || 'Foto')}"></p>`);
  return parts.join('');
}

/**
 * Creates an inline KML style that keeps Trailthread metadata out of the feature balloon.
 * @param {string|null} imagePath Local image path used as a compatibility-mode point icon.
 * @returns {string} KML style markup for one photo feature.
 */
function buildKmlPhotoStyle(imagePath = null) {
  const lines = ['        <Style>'];
  if (imagePath) {
    lines.push('          <IconStyle><scale>0.45</scale><Icon>');
    lines.push(`            <href>${escapeXml(imagePath)}</href>`);
    lines.push('          </Icon></IconStyle>');
  }
  lines.push('          <BalloonStyle><text><![CDATA[<b>$[name]</b><br/>$[description]]]></text></BalloonStyle>');
  lines.push('        </Style>');
  return lines.join('\n');
}

/**
 * Builds the KML and packaged image files for selected Trailthread tracks.
 * @param {Array<object>} tracks Tracks to export.
 * @param {'compatibility'|'photo-overlay'} photoExportMode Target viewer compatibility mode for photos.
 * @returns {Promise<Array<{name: string, bytes: Uint8Array, modifiedAt?: string}>>} KMZ file entries.
 */
async function buildKmzFiles(tracks, photoExportMode = 'compatibility') {
  const encoder = new TextEncoder();
  const files = [];
  const folders = [];
  for (let trackIndex = 0; trackIndex < tracks.length; trackIndex += 1) {
    const serializedTrack = await serializeTrackForBackup(tracks[trackIndex]);
    const photos = normalizePhotos(serializedTrack.photos).map((photo) => ({ ...photo }));
    const photoFeatures = [];
    for (let photoIndex = 0; photoIndex < photos.length; photoIndex += 1) {
      const photo = photos[photoIndex];
      let imagePath = null;
      let descriptionImageUrl = null;
      const externalImageUrl = photo.externalUrl || photo.url;
      if (isRenderablePhotoUrl(externalImageUrl) && !isDataImageUrl(externalImageUrl)) descriptionImageUrl = externalImageUrl;
      if (isDataImageUrl(photo.url)) {
        const image = await dataUrlToBytes(photo.url);
        imagePath = `photos/tour-${trackIndex + 1}/photo-${photoIndex + 1}.${imageExtensionForType(image.type)}`;
        files.push({ name: imagePath, bytes: image.bytes, modifiedAt: serializedTrack.lastChanged });
        photo.url = imagePath;
      }
      const point = photo.location || photo.lineLocation;
      const coordinate = kmlCoordinates(point);
      if (!coordinate) continue;
      const photoHeading = trackHeadingAtLocation(serializedTrack.points, point);
      let photoFeature = [];
      if (imagePath && photoExportMode === 'photo-overlay') {
        const photoDescriptionUrl = imagePath;
        const photoStyle = buildKmlPhotoStyle();
        photoFeature = [
          '      <PhotoOverlay>',
          `        <name>${escapeXml(photo.title || `Foto ${photoIndex + 1}`)}</name>`,
          `        <description><![CDATA[${cdataText(buildKmlPhotoDescription(photo, photoDescriptionUrl))}]]></description>`,
          photoStyle,
          `        <ExtendedData><Data name="trailthread:photo-json"><value><![CDATA[${cdataText(JSON.stringify(photo))}]]></value></Data></ExtendedData>`,
          '        <Camera>',
          `          <longitude>${Number(point.lng).toFixed(6)}</longitude>`,
          `          <latitude>${Number(point.lat).toFixed(6)}</latitude>`,
          '          <altitude>12</altitude>',
          `          <heading>${photoHeading.toFixed(1)}</heading>`,
          '          <tilt>90</tilt>',
          '          <altitudeMode>relativeToGround</altitudeMode>',
          '        </Camera>',
          `        <Icon><href>${escapeXml(imagePath)}</href></Icon>`,
          '        <ViewVolume><leftFov>-35</leftFov><rightFov>35</rightFov><bottomFov>-25</bottomFov><topFov>25</topFov><near>12</near></ViewVolume>',
          `        <Point><coordinates>${coordinate}</coordinates></Point>`,
          '        <shape>rectangle</shape>',
          '      </PhotoOverlay>'
        ];
      } else {
        const photoStyle = buildKmlPhotoStyle(imagePath);
        photoFeature = [
          '      <Placemark>',
          `        <name>${escapeXml(photo.title || `Foto ${photoIndex + 1}`)}</name>`,
          `        <description><![CDATA[${cdataText(buildKmlPhotoDescription(photo, descriptionImageUrl))}]]></description>`,
          photoStyle,
          `        <ExtendedData><Data name="trailthread:photo-json"><value><![CDATA[${cdataText(JSON.stringify(photo))}]]></value></Data></ExtendedData>`,
          `        <Point><coordinates>${coordinate}</coordinates></Point>`,
          '      </Placemark>'
        ];
      }
      photoFeatures.push(photoFeature.join('\n'));
    }
    const coordinates = serializedTrack.points.map(kmlCoordinates).filter(Boolean).join(' ');
    const trackJson = JSON.stringify({ ...serializedTrack, photos });
    const trackColor = serializedTrack.color || defaultTrackColor(serializedTrack);
    const trackLineColor = kmlLineColor(trackColor);
    const photoFolder = [];
    if (photoFeatures.length) {
      photoFolder.push('    <Folder><name>Fotos</name>');
      photoFolder.push(...photoFeatures);
      photoFolder.push('    </Folder>');
    }
    folders.push([
      '  <Folder>',
      `    <name>${escapeXml(serializedTrack.name || t('unnamedTrack'))}</name>`,
      '    <Placemark>',
      `      <name>${escapeXml(serializedTrack.name || t('unnamedTrack'))}</name>`,
      `      <description><![CDATA[${cdataText(serializedTrack.description || '')}]]></description>`,
      '      <Style>',
      `        <LineStyle><color>${trackLineColor}</color><width>4</width></LineStyle>`,
      '      </Style>',
      `      <ExtendedData><Data name="trailthread:track-json"><value><![CDATA[${cdataText(trackJson)}]]></value></Data></ExtendedData>`,
      '      <LineString><tessellate>1</tessellate><coordinates>',
      `        ${coordinates}`,
      '      </coordinates></LineString>',
      '    </Placemark>',
      ...photoFolder,
      '  </Folder>'
    ].filter(Boolean).join('\n'));
  }
  const kml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    '  <Document>',
    '    <name>Trailthread-Export</name>',
    '    <ExtendedData><Data name="trailthread:format"><value>trailthread-kmz-v1</value></Data></ExtendedData>',
    ...folders,
    '  </Document>',
    '</kml>'
  ].join('\n');
  files.unshift({ name: 'doc.kml', bytes: encoder.encode(kml), modifiedAt: isoNow() });
  return files;
}

/**
 * Exports selected tracks in one KMZ document for the requested photo viewer mode.
 * @param {'compatibility'|'photo-overlay'} photoExportMode Target viewer compatibility mode for photos.
 * @returns {Promise<void>} Resolves after the browser download has started.
 */
async function exportSelectedTracksKmz(photoExportMode = 'compatibility') {
  const tracks = state.tracks.filter((track) => state.selectedTrackIds.has(track.id) && track.points?.length);
  if (!tracks.length) {
    setStatus(t('exportSelectedKmzUnavailable'), true);
    return;
  }
  let fileNameKey = 'exportSelectedKmzFileName';
  let doneKey = 'exportSelectedKmzDone';
  if (photoExportMode === 'photo-overlay') {
    fileNameKey = 'exportSelectedKmzProFileName';
    doneKey = 'exportSelectedKmzProDone';
  }
  const blob = await createZipBlob(await buildKmzFiles(tracks, photoExportMode));
  downloadBlob(t(fileNameKey), blob);
  el.exportSelectedGpxMenu?.removeAttribute('open');
  setStatus(t(doneKey, { count: tracks.length }));
}
function buildSelectedTracksMultiGpxXml(tracks) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Trailthread" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
    '  <metadata>',
    `    <name>${escapeXml('Trailthread selection')}</name>`,
    `    <time>${escapeXml(isoNow())}</time>`,
    '  </metadata>',
    ...tracks.map(trackToGpxTrackXml),
    '</gpx>'
  ].join('\n');
}
function buildSingleTrackGpxXml(track) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Trailthread" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
    '  <metadata>',
    `    <name>${escapeXml(track.name || t('unnamedTrack'))}</name>`,
    `    <time>${escapeXml(isoNow())}</time>`,
    '  </metadata>',
    trackToGpxTrackXml(track),
    '</gpx>'
  ].join('\n');
}
function shiftRangeSegments(segments, offset) {
  return normalizeRangeSegments(segments).map((segment) => ({
    ...segment,
    from: Number(segment.from) + offset,
    to: Number(segment.to) + offset
  }));
}
function uniqueTrackName(baseName, excludedIds = []) {
  const normalizedBase = cleanText(baseName) || t('unnamedTrack');
  const excluded = new Set(excludedIds);
  const existingNames = new Set(
    state.tracks
      .filter((track) => !excluded.has(track.id))
      .map((track) => cleanText(track.name).toLowerCase())
      .filter(Boolean)
  );
  if (!existingNames.has(normalizedBase.toLowerCase())) return normalizedBase;
  let suffix = 2;
  let candidate = `${normalizedBase} (${suffix})`;
  while (existingNames.has(candidate.toLowerCase())) {
    suffix += 1;
    candidate = `${normalizedBase} (${suffix})`;
  }
  return candidate;
}
function shiftedPointCopy(point, timeOffsetMs = 0) {
  const copy = { ...point };
  if (timeOffsetMs && point?.time) {
    const parsed = parsePointTime(point.time);
    if (Number.isFinite(parsed)) copy.time = new Date(parsed + timeOffsetMs).toISOString();
    else copy.time = point.time;
  }
  return copy;
}
async function cloneTrackPhotosForMerge(track) {
  const serialized = await serializeTrackForBackup(track);
  return normalizePhotos(serialized.photos).map((photo) => ({
    ...photo,
    blobId: null,
    objectUrl: null
  }));
}
async function mergeSelectedTracks(orderedTracks = selectedTracksForMerge()) {
  const tracks = orderedTracks.filter((track) => track?.points?.length);
  if (tracks.length !== 2) {
    setStatus(t('mergeSelectedTracksNeedTwo'), true);
    return;
  }
  const [firstTrack, secondTrack] = tracks;
  const combinedPoints = [];
  const mergedSurfaceSegments = [];
  const mergedWayTypeSegments = [];
  const mergedDirections = [];
  const seamGapMeters = Math.max(0, Math.round(haversine(firstTrack.points[firstTrack.points.length - 1], secondTrack.points[0]) * 1000));
  let secondTimeOffsetMs = 0;
  const firstStartTime = parsePointTime(firstTrack.points?.[0]?.time);
  const firstEndTime = parsePointTime(firstTrack.points?.[firstTrack.points.length - 1]?.time);
  const secondStartTime = parsePointTime(secondTrack.points?.[0]?.time);
  if (Number.isFinite(firstStartTime) && Number.isFinite(firstEndTime) && Number.isFinite(secondStartTime)) {
    secondTimeOffsetMs = Math.max(1000, (firstEndTime - secondStartTime) + 1000);
  }
  for (const track of tracks) {
    const pointOffset = combinedPoints.length;
    let timeOffsetMs = 0;
    if (track.id === secondTrack.id) timeOffsetMs = secondTimeOffsetMs;
    track.points.forEach((point) => combinedPoints.push(shiftedPointCopy(point, timeOffsetMs)));
    mergedSurfaceSegments.push(...shiftRangeSegments(track.surfaceSegments, pointOffset));
    mergedWayTypeSegments.push(...shiftRangeSegments(track.wayTypeSegments, pointOffset));
    const trackDirections = normalizeDirections(track.directions).map((direction) => ({ ...direction }));
    if (track.id === secondTrack.id && trackDirections[0] && seamGapMeters > 0) {
      trackDirections[0].prefixDistanceM = (trackDirections[0].prefixDistanceM || 0) + seamGapMeters;
    }
    mergedDirections.push(...trackDirections);
  }
  const mergedPhotos = normalizePhotos((await Promise.all(tracks.map(cloneTrackPhotosForMerge))).flat());
  const mergedTags = [...new Set(tracks.flatMap((track) => normalizeTagList(track.tags)))];
  const descriptions = [...new Set(tracks.map((track) => cleanText(track.description)).filter(Boolean))];
  const sport = firstTrack.sport || secondTrack.sport || null;
  let mergedType = 'unknown';
  if (trackType(firstTrack.type) === trackType(secondTrack.type)) mergedType = trackType(firstTrack.type);
  const mergedTrackDraft = {
    name: `${firstTrack.name || t('unnamedTrack')} + ${secondTrack.name || t('unnamedTrack')}`,
    description: descriptions.join('\n\n'),
    sport,
    points: combinedPoints
  };
  const mergedTrack = buildTrackRecord({
    gpxText: buildSingleTrackGpxXml(mergedTrackDraft),
    fileName: sanitizeFileName(mergedTrackDraft.name) || 'merged-track',
    source: 'local',
    type: mergedType,
    account: null,
    description: mergedTrackDraft.description || null,
    photos: mergedPhotos,
    meta: {
      dateStart: firstTrack.dateStart || null,
      durationHours: (firstTrack.durationHours ?? 0) + (secondTrack.durationHours ?? 0) || null,
      sport: mergedTrackDraft.sport,
      surfaces: [...new Set(tracks.flatMap((track) => normalizeTagList(track.surfaces)))],
      wayTypes: [...new Set(tracks.flatMap((track) => normalizeTagList(track.wayTypes)))],
      surfaceSegments: mergedSurfaceSegments,
      wayTypeSegments: mergedWayTypeSegments,
      directions: mergedDirections
    }
  });
  const finalizedTrack = touchTrack(mergedTrack, {
    tags: mergedTags,
    favorite: false,
    color: defaultTrackColor(mergedTrack)
  });
  const conflictingTrack = state.tracks.find((track) => !tracks.some((selected) => selected.id === track.id) && cleanText(track.name).toLowerCase() === cleanText(finalizedTrack.name).toLowerCase());
  let trackToSave = finalizedTrack;
  if (conflictingTrack) {
    const shouldOverwrite = await confirmAction(t('mergeSelectedTracksConflictMessage', { name: finalizedTrack.name || t('unnamedTrack') }), {
      title: t('mergeSelectedTracksConflictTitle'),
      confirmLabel: t('mergeSelectedTracksOverwrite'),
      cancelLabel: t('mergeSelectedTracksCreateNew')
    });
    if (shouldOverwrite) {
      await deleteTrackPhotoBlobs(conflictingTrack);
      trackToSave = touchTrack({
        ...trackToSave,
        id: conflictingTrack.id,
        importedAt: conflictingTrack.importedAt || trackToSave.importedAt
      });
    } else {
      trackToSave = touchTrack({
        ...trackToSave,
        name: uniqueTrackName(trackToSave.name, tracks.map((track) => track.id))
      });
    }
  }
  const preparedTrack = await prepareTrackPhotosForStorage(trackToSave);
  await put(STORES.tracks, preparedTrack);
  const hydratedTrack = await hydrateTrackPhotos(preparedTrack);
  if (conflictingTrack) revokeTrackPhotoUrls(conflictingTrack);
  state.tracks = state.tracks.filter((track) => track.id !== hydratedTrack.id).concat(hydratedTrack).sort((a, b) => (b.importedAt ?? '').localeCompare(a.importedAt ?? ''));
  state.selectedTrackIds = new Set([hydratedTrack.id]);
  state.highlightedTrackId = hydratedTrack.id;
  renderAll();
  syncMapForSelectionChange();
  setStatus(t('mergeSelectedTracksDone'));
}
async function exportSelectedTracksGpx() {
  const tracks = state.tracks.filter((track) => state.selectedTrackIds.has(track.id) && track.points?.length);
  if (!tracks.length) {
    setStatus(t('exportSelectedGpxEmpty'), true);
    return;
  }
  const encoder = new TextEncoder();
  const usedNames = new Set();
  const files = tracks.map((track, index) => {
    const base = sanitizeFileName(track.name || `${t('unnamedTrack')} ${index + 1}`) || `track-${index + 1}`;
    let fileName = `${base}.gpx`;
    let suffix = 2;
    while (usedNames.has(fileName.toLowerCase())) {
      fileName = `${base}-${suffix}.gpx`;
      suffix += 1;
    }
    usedNames.add(fileName.toLowerCase());
    return {
      name: fileName,
      bytes: encoder.encode(track.gpxText || ''),
      modifiedAt: trackLastChanged(track) || track.importedAt || isoNow()
    };
  });
  const blob = await createZipBlob(files);
  downloadBlob(t('exportSelectedGpxFileName'), blob);
  setStatus(t('exportSelectedGpxDone', { count: tracks.length }));
}
function exportSelectedTracksMultiGpx() {
  const tracks = state.tracks.filter((track) => state.selectedTrackIds.has(track.id) && track.points?.length);
  if (!tracks.length) {
    setStatus(t('exportSelectedGpxEmpty'), true);
    return;
  }
  const xml = buildSelectedTracksMultiGpxXml(tracks);
  downloadBlob(t('exportSelectedMultiTrackGpxFileName'), new Blob([xml], { type: 'application/gpx+xml' }));
  el.exportSelectedGpxMenu?.removeAttribute('open');
  setStatus(t('exportSelectedMultiTrackGpxDone', { count: tracks.length }));
}
function setHighlightedTrack(trackId) { state.highlightedTrackId = trackId; syncMap(); renderProfile(); }
function syncMapForSelectionChange() {
  syncMap();
  const selectedTracks = visibleSelectedTracks();
  if (selectedTracks.length === 1) {
    const onlyTrack = selectedTracks[0];
    if (state.highlightedTrackId !== onlyTrack.id) {
      state.highlightedTrackId = onlyTrack.id;
      syncMap();
    }
    const bounds = trackBounds(onlyTrack);
    if (bounds) state.map.fitBounds(bounds.pad(0.08));
  }
  renderProfile();
}
function initMap() {
  state.map = L.map('map', { zoomControl: true }).setView([51.2, 10.4], 6);
  L.tileLayer(TILE_URL, { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(state.map);
  state.map.on('zoomend', () => state.tracks.forEach((track) => updateTrackDecorations(track.id)));
}
function trackBounds(track) {
  const latLngs = track?.points?.map((point) => [point.lat, point.lng]).filter((point) => point.every(Number.isFinite));
  if (latLngs?.length) return L.latLngBounds(latLngs);
  return null;
}
function syncMap() {
  for (const entry of state.layers.values()) {
    entry.group.remove();
  }
    state.layers.clear();
    state.heatmapLayer?.remove();
    state.heatmapLayer = null;
    state.heatmapStats = null;
    const active = new Set(visibleSelectedTracks().map((track) => track.id));
    const photoOnlyMode = !!state.settings.photoOverlayOnly;
    const heatmapMode = !!state.settings.heatmapMode;
    if (heatmapMode) {
      const tracks = heatmapTrackSet();
      if (tracks.length > 1) {
        tracks.forEach((track) => {
          const latLngs = track.points.map((point) => [point.lat, point.lng]);
          const baseLine = L.polyline(latLngs, {
            interactive: false,
            color: 'rgba(210, 223, 219, 0.28)',
            weight: Math.max(3, (state.settings.trackLineWeight ?? 6) - 1),
            opacity: 0.55,
            lineCap: 'round',
            lineJoin: 'round'
          });
          const group = L.layerGroup([baseLine]).addTo(state.map);
          state.layers.set(track.id, { track, group, casing: null, line: baseLine, kmLayer: null, arrowLayer: null, photoLayer: null, segmentLayer: null, timelineLayer: null });
        });
        state.heatmapLayer = buildHeatmapLayer(tracks).addTo(state.map);
        state.heatmapStats = state.heatmapLayer.__heatmapStats ?? null;
      }
      renderMapSegmentLegend();
      renderMapSegmentButton();
      return;
    }
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
    const timelineLayer = buildTrackTimelineLayer(track);
    let segmentLayer = L.layerGroup();
    if (state.settings.segmentOverlayMode && state.highlightedTrackId === track.id) segmentLayer = buildTrackSegmentLayers(track);
    if (!photoOnlyMode) {
      casing = L.polyline(latLngs, layerStyleForTrack(track, true));
      line = L.polyline(latLngs, layerStyleForTrack(track, false)).bindPopup(`<strong>${track.name}</strong><br>${fmtKm(track.distanceKm)} km`);
      line.on('click', (event) => { L.DomEvent.stopPropagation(event); setHighlightedTrack(track.id); });
      casing.on('click', (event) => { L.DomEvent.stopPropagation(event); setHighlightedTrack(track.id); });
      layers.push(casing, line, segmentLayer, kmLayer, arrowLayer);
      if (state.highlightedTrackId === track.id) layers.push(photoLayer, timelineLayer);
    } else if (photoLayer.getLayers().length) {
      layers.push(photoLayer);
    }
    const group = L.layerGroup(layers).addTo(state.map);
    state.layers.set(track.id, { group, casing, line, kmLayer, arrowLayer, photoLayer, segmentLayer, timelineLayer });
  });
  renderMapSegmentLegend();
  renderMapSegmentButton();
}
function fitSelection() {
  const bounds = visibleSelectedTracks().map(trackBounds).filter(Boolean);
  if (!bounds.length) return;
  const merged = bounds.reduce((acc, current) => {
    if (acc) return acc.extend(current);
    return current;
  }, null);
  if (merged) state.map.fitBounds(merged.pad(0.08));
}
function activeTrackNavigationOrder() {
  return visibleSelectedTracks();
}
function stepTrackSelection(offset) {
  const tracks = activeTrackNavigationOrder();
  if (!tracks.length) return;
  const currentIndex = Math.max(0, tracks.findIndex((track) => track.id === state.highlightedTrackId));
  let fallbackIndex = currentIndex;
  if (!state.highlightedTrackId) {
    fallbackIndex = 0;
    if (offset > 0) fallbackIndex = -1;
  }
  const nextIndex = (fallbackIndex + offset + tracks.length) % tracks.length;
  focusTrack(tracks[nextIndex].id);
}
function focusTrack(trackId) {
  if (state.settings.activeWorkspace !== 'library') {
    state.settings.activeWorkspace = 'library';
    renderWorkspace();
    void saveSettings();
  }
  if (!state.layers.has(trackId)) {
    state.selectedTrackIds.add(trackId);
    renderLibrary();
    renderSelection();
    syncMap();
  }
  setHighlightedTrack(trackId);
  const entry = state.layers.get(trackId);
  if (entry) {
    state.map?.invalidateSize?.(false);
    const bounds = entry.line?.getBounds?.() || trackBounds(state.tracks.find((track) => track.id === trackId));
    if (bounds) {
      state.map.fitBounds(bounds.pad(0.08));
      window.requestAnimationFrame(() => {
        state.map?.invalidateSize?.(false);
        state.map?.fitBounds?.(bounds.pad(0.08));
      });
    }
    entry.line?.openPopup();
  }
  renderProfile();
}
async function deleteTracks(trackIds) { for (const trackId of trackIds) { const track = state.tracks.find((item) => item.id === trackId); if (track) await deleteTrackPhotoBlobs(track); await del(STORES.tracks, trackId); state.selectedTrackIds.delete(trackId); } state.tracks = state.tracks.filter((track) => !trackIds.includes(track.id)); if (trackIds.includes(state.replay.activeTrackId)) { state.replay.activeTrackId = null; state.replay.replayTrack = null; setReplayPlaying(false); } renderAll(); syncMapForSelectionChange(); setStatus(t('statusDeleted')); }

async function importTrackRecords(records, replaceExisting = false) {
  const existing = new Map(state.tracks.map((track) => [track.signature, track])); const existingRemote = new Map(state.tracks.map((track) => [remoteTrackKey(track), track]).filter(([key]) => !!key)); const incoming = []; let duplicates = 0;
  records.forEach((record) => {
    const remoteKey = remoteTrackKey(record);
    let remoteExisting = null;
    if (remoteKey) remoteExisting = existingRemote.get(remoteKey);
    const dupe = remoteExisting ?? existing.get(record.signature);
    if (dupe && !replaceExisting) { duplicates += 1; return; }
    if (dupe && replaceExisting) {
      record.id = dupe.id;
      record.favorite = !!dupe.favorite;
      record.tags = normalizeTagList(dupe.tags);
      record.color = dupe.color || record.color;
      record.lastChanged = isoNow();
      record.signature = signature(record);
    }
    incoming.push(record);
  });
  if (!incoming.length && duplicates) { setStatus(t('duplicateTracksSkipped', { count: duplicates })); return { imported: 0, duplicates }; }
  for (const track of incoming) {
    const existingTrack = state.tracks.find((item) => item.id === track.id);
    if (replaceExisting && existingTrack) await deleteTrackPhotoBlobs(existingTrack);
  }
  const prepared = await Promise.all(incoming.map((track) => prepareTrackPhotosForStorage(track)));
  await putMany(STORES.tracks, prepared);
  const hydrated = await hydrateTracksPhotos(prepared);
  const map = new Map(hydrated.map((track) => [track.id, track]));
  revokeAllTrackPhotoUrls(state.tracks.filter((track) => map.has(track.id)));
  state.tracks = state.tracks.filter((track) => !map.has(track.id)).concat(hydrated).sort((a, b) => (b.importedAt ?? '').localeCompare(a.importedAt ?? ''));
  hydrated.forEach((track) => state.selectedTrackIds.add(track.id));
  hydrated.forEach((track) => { const entry = state.layers.get(track.id); if (!entry) return; entry.group.remove(); state.layers.delete(track.id); });
  if (state.replay.activeTrackId) {
    const updatedReplayTrack = state.tracks.find((track) => track.id === state.replay.activeTrackId) || hydrated.find((track) => track.id === state.replay.activeTrackId) || null;
    state.replay.replayTrack = null;
    if (updatedReplayTrack) state.replay.replayTrack = buildReplayTrack(updatedReplayTrack);
  }
  renderAll();
  syncMap();
  fitSelection();
  let importStatus = t('statusImported');
  if (duplicates) importStatus = `${t('statusImported')} · ${t('duplicateTracksSkipped', { count: duplicates })}`;
  setStatus(importStatus);
  return { imported: hydrated.length, duplicates };
}
function normalizeBackupTrack(track) {
  const surfaceSegments = normalizeRangeSegments(track.surfaceSegments);
  const wayTypeSegments = normalizeRangeSegments(track.wayTypeSegments);
  let surfaces = normalizeTagList(track.surfaces);
  let wayTypes = normalizeTagList(track.wayTypes);
  if (!surfaces.length) surfaces = segmentValues(surfaceSegments);
  if (!wayTypes.length) wayTypes = segmentValues(wayTypeSegments);
  const normalized = {
    ...track,
    id: track.id || id('track'),
    importedAt: track.importedAt || isoNow(),
    lastChanged: trackLastChanged(track) || track.importedAt || isoNow(),
    signature: track.signature || signature(track),
    komootUrl: track.komootUrl || komootTrackUrl(track),
    type: trackType(track.type),
    description: normalizeTrackDescription(track.description),
    dateStart: normalizeTrackDate(track.dateStart),
    surfaces,
    wayTypes,
    surfaceSegments,
    wayTypeSegments,
    favorite: !!track.favorite,
    tags: normalizeTagList(track.tags),
    directions: normalizeDirections(track.directions),
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
      let key = 'confirmBackupOverwriteOlder';
      if (incomingStamp > existingStamp) key = 'confirmBackupOverwriteNewer';
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
    if (skippedConflicts) pieces.push(`${skippedConflicts} Konflikte übersprungen`);
    setStatus(pieces.join(' · '));
    return { imported: 0, duplicates, skippedConflicts };
  }
  for (const track of incoming) {
    const existingTrack = state.tracks.find((item) => item.id === track.id);
    if (existingTrack) await deleteTrackPhotoBlobs(existingTrack);
  }
  const prepared = await Promise.all(incoming.map((track) => prepareTrackPhotosForStorage(track)));
  await putMany(STORES.tracks, prepared);
  const hydrated = await hydrateTracksPhotos(prepared);
  const map = new Map(hydrated.map((track) => [track.id, track]));
  revokeAllTrackPhotoUrls(state.tracks.filter((track) => map.has(track.id)));
  state.tracks = state.tracks.filter((track) => !map.has(track.id)).concat(hydrated).sort((a, b) => (b.importedAt ?? '').localeCompare(a.importedAt ?? ''));
  hydrated.forEach((track) => state.selectedTrackIds.add(track.id));
  hydrated.forEach((track) => {
    const entry = state.layers.get(track.id);
    if (!entry) return;
    entry.group.remove();
    state.layers.delete(track.id);
  });
  if (state.replay.activeTrackId) {
    const updatedReplayTrack = state.tracks.find((track) => track.id === state.replay.activeTrackId) || null;
    state.replay.replayTrack = null;
    if (updatedReplayTrack) state.replay.replayTrack = buildReplayTrack(updatedReplayTrack);
  }
  renderAll();
  syncMap();
  fitSelection();
  const pieces = [t('tourBackupImported')];
  if (duplicates) pieces.push(t('duplicateTracksSkipped', { count: duplicates }));
  if (skippedConflicts) pieces.push(`${skippedConflicts} Konflikte übersprungen`);
  setStatus(pieces.join(' · '));
  return { imported: hydrated.length, duplicates, skippedConflicts };
}
/**
 * Checks whether a JSON value is a manifest created by the Trailthread Komoot companion extension.
 * @param {unknown} payload Parsed JSON value from a local file.
 * @returns {boolean} True when the value has the supported companion manifest shape.
 */
function isKomootCompanionManifest(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.kind !== 'trailthread-komoot-companion') return false;
  if (payload.version !== 1) return false;
  return Array.isArray(payload.tours);
}

/**
 * Checks whether a JSON payload is a complete Trailthread tour backup.
 * @param {unknown} payload Parsed JSON value from a local file.
 * @returns {boolean} True when the payload contains Trailthread track records.
 */
function isTrailthreadTourBackup(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.kind !== 'gpx-bibliothek-touren') return false;
  return Array.isArray(payload.tracks);
}

/**
 * Normalizes a local file name for matching a GPX download to its extension manifest entry.
 * @param {string} value File name or route title.
 * @returns {string} Lowercase comparison key without a file extension.
 */
function localImportMatchKey(value) {
  return cleanText(value)
    .replace(/\.[a-z0-9]{1,8}$/i, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f]+/gi, ' ')
    .trim();
}

/**
 * Finds a companion manifest entry for one GPX file.
 * @param {File} file GPX file selected by the user.
 * @param {Array<object>} tours Tour entries supplied by the companion extension.
 * @returns {object|null} Matching tour metadata or null when no safe match exists.
 */
function companionTourForFile(file, tours) {
  const fileKey = localImportMatchKey(file.name);
  const directMatch = tours.find((tour) => localImportMatchKey(tour.gpxFileName || '') === fileKey);
  if (directMatch) return directMatch;
  const titleMatch = tours.find((tour) => localImportMatchKey(tour.name || '') === fileKey);
  if (titleMatch) return titleMatch;
  return null;
}

/**
 * Reads all files from a ZIP or KMZ archive, including deflate-compressed entries.
 * @param {File} file Archive selected by the user.
 * @returns {Promise<Map<string, Uint8Array>>} Archive entries indexed by their paths.
 */
async function readZipEntries(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let endOffset = -1;
  for (let offset = Math.max(0, bytes.length - 65557); offset <= bytes.length - 22; offset += 1) {
    if (view.getUint32(offset, true) === 0x06054b50) endOffset = offset;
  }
  if (endOffset < 0) throw new Error(t('kmzInvalidArchiveDirectory'));
  const entryCount = view.getUint16(endOffset + 10, true);
  let offset = view.getUint32(endOffset + 16, true);
  const decoder = new TextDecoder();
  const entries = new Map();
  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error(t('kmzInvalidZipEntry'));
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error(t('kmzInvalidZipContent'));
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
    let content = compressed;
    if (method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error(t('kmzDecompressionUnavailable'));
      content = new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    } else if (method !== 0) {
      throw new Error(t('kmzUnsupportedCompression', { method }));
    }
    if (content.length !== uncompressedSize) throw new Error(t('kmzCorruptZipEntry', { name }));
    entries.set(name, content);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/**
 * Converts KML coordinate text into Trailthread points.
 * @param {string} value Whitespace-separated KML coordinate tuples.
 * @returns {Array<object>} Parsed geographic points.
 */
function parseKmlCoordinates(value) {
  return `${value || ''}`.trim().split(/\s+/).map((tuple) => {
    const parts = tuple.split(',').map(Number);
    const lng = parts[0];
    const lat = parts[1];
    const ele = parts[2];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    let elevation = null;
    if (Number.isFinite(ele)) elevation = ele;
    return { lat, lng, ele: elevation, time: null };
  }).filter(Boolean);
}

/**
 * Builds GPX XML for a route read from a standard KML Placemark.
 * @param {object} track Parsed KML track fields.
 * @returns {string} GPX document for the normal Trailthread import path.
 */
function buildGpxFromKmlTrack(track) {
  const points = track.points.map((point) => {
    const attributes = `lat="${point.lat.toFixed(6)}" lon="${point.lng.toFixed(6)}"`;
    let elevation = '';
    if (Number.isFinite(point.ele)) elevation = `<ele>${point.ele.toFixed(1)}</ele>`;
    return `<trkpt ${attributes}>${elevation}</trkpt>`;
  }).join('');
  let description = '';
  if (track.description) description = `<desc>${escapeXml(track.description)}</desc>`;
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Trailthread" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${escapeXml(track.name || t('unnamedTrack'))}</name>${description}<trkseg>${points}</trkseg></trk></gpx>`;
}

/**
 * Parses a KML document into Trailthread backup records and generic KML tracks.
 * @param {string} text KML XML text.
 * @param {string} fileName Source filename.
 * @param {Map<string, Uint8Array>|null} archiveEntries Packaged KMZ resources, if any.
 * @returns {Promise<{backupRecords: Array<object>, genericRecords: Array<object>}>} Import-ready records.
 */
async function parseKmlImport(text, fileName, archiveEntries = null) {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error(t('kmlInvalidDocument'));
  const backupRecords = [];
  const genericRecords = [];
  for (const placemark of xml.querySelectorAll('Placemark')) {
    const encodedTrack = placemark.querySelector('Data[name="trailthread:track-json"] > value')?.textContent;
    if (encodedTrack) {
      try {
        const record = JSON.parse(encodedTrack);
        for (const photo of record.photos || []) {
          if (archiveEntries?.has(photo.url)) {
            const bytes = archiveEntries.get(photo.url);
            photo.url = await blobToDataUrl(new Blob([bytes]));
            photo.blobId = null;
            photo.externalUrl = null;
          }
        }
        backupRecords.push(record);
        continue;
      } catch (error) {
        throw new Error(t('kmlMetadataUnreadable', { fileName }));
      }
    }
    const coordinateNode = placemark.querySelector('LineString > coordinates, MultiGeometry LineString > coordinates');
    if (!coordinateNode) continue;
    const points = parseKmlCoordinates(coordinateNode.textContent);
    if (!points.length) continue;
    const name = cleanText(placemark.querySelector(':scope > name')?.textContent) || fileName.replace(/\.kml$/i, '') || t('unnamedTrack');
    const description = cleanText(placemark.querySelector(':scope > description')?.textContent) || null;
    genericRecords.push(buildTrackRecord({
      gpxText: buildGpxFromKmlTrack({ name, description, points }),
      fileName,
      source: 'local',
      type: 'unknown',
      account: null,
      description
    }));
  }
  if (!backupRecords.length && !genericRecords.length) throw new Error(t('kmlNoTrackLines'));
  return { backupRecords, genericRecords };
}

/**
 * Loads KML or KMZ files selected through the general track import control.
 * @param {Array<File>} files KML or KMZ files.
 * @returns {Promise<{backupRecords: Array<object>, genericRecords: Array<object>}>} Import-ready records.
 */
async function importKmlFiles(files) {
  const backupRecords = [];
  const genericRecords = [];
  for (const file of files) {
    if (file.name.toLocaleLowerCase().endsWith('.kmz')) {
      const entries = await readZipEntries(file);
      const kmlEntry = [...entries.entries()].find(([name]) => name.toLocaleLowerCase().endsWith('.kml'));
      if (!kmlEntry) throw new Error(t('kmzMissingKmlFile', { fileName: file.name }));
      const result = await parseKmlImport(new TextDecoder().decode(kmlEntry[1]), file.name, entries);
      backupRecords.push(...result.backupRecords);
      genericRecords.push(...result.genericRecords);
    } else {
      const result = await parseKmlImport(await file.text(), file.name);
      backupRecords.push(...result.backupRecords);
      genericRecords.push(...result.genericRecords);
    }
  }
  return { backupRecords, genericRecords };
}

/**
 * Imports selected GPX, KML, KMZ and Trailthread backup files.
 * @param {FileList|File[]} files Files selected through the local import control.
 * @returns {Promise<void>} Resolves after all valid GPX files have been stored.
 */
async function importLocalFiles(files) {
  const selectedFiles = [...files];
  const gpxFiles = selectedFiles.filter((file) => file.name.toLocaleLowerCase().endsWith('.gpx'));
  const kmlFiles = selectedFiles.filter((file) => {
    const name = file.name.toLocaleLowerCase();
    return name.endsWith('.kml') || name.endsWith('.kmz');
  });
  const packageFiles = selectedFiles.filter((file) => {
    const name = file.name.toLocaleLowerCase();
    return !name.endsWith('.gpx') && !name.endsWith('.kml') && !name.endsWith('.kmz');
  });
  let companionManifest = null;
  const tourBackupRecords = [];
  let invalidPackageFound = false;
  for (const packageFile of packageFiles) {
    try {
      const parsed = await readJsonFile(packageFile);
      if (isTrailthreadTourBackup(parsed)) {
        tourBackupRecords.push(...parsed.tracks);
        continue;
      }
      if (isKomootCompanionManifest(parsed)) {
        companionManifest = parsed;
        continue;
      }
      invalidPackageFound = true;
    } catch (error) {
      invalidPackageFound = true;
    }
  }
  if (tourBackupRecords.length) {
    const shouldImport = await confirmAction(t('confirmImportTours'));
    if (!shouldImport) return;
    await importTourBackupRecords(tourBackupRecords);
  }
  if (kmlFiles.length) {
    const kmlImport = await importKmlFiles(kmlFiles);
    if (kmlImport.backupRecords.length) await importTourBackupRecords(kmlImport.backupRecords);
    if (kmlImport.genericRecords.length) await importTrackRecords(kmlImport.genericRecords);
  }
  if (!gpxFiles.length) {
    if (companionManifest) setStatus('Bitte wähle das Komoot-Importpaket zusammen mit mindestens einer GPX-Datei aus.', true);
    else if (invalidPackageFound) setStatus('Die ausgewählte Datei ist weder eine GPX-Datei noch eine Trailthread-Sicherung.', true);
    return;
  }
  const records = [];
  let enrichedCount = 0;
  for (const file of gpxFiles) {
    let tour = null;
    if (companionManifest) tour = companionTourForFile(file, companionManifest.tours);
    let account = null;
    let source = 'local';
    let type = 'unknown';
    let description = null;
    let photos = null;
    let dateStart = null;
    let sport = null;
    if (tour) {
      account = { sourceTrackId: cleanText(tour.tourId) || null };
      source = 'komoot';
      type = trackType(tour.type);
      description = tour.description || null;
      if (Array.isArray(tour.photos)) photos = tour.photos;
      dateStart = tour.dateStart || null;
      sport = tour.sport || null;
    }
    const record = buildTrackRecord({
      gpxText: await file.text(),
      fileName: file.name,
      source,
      type,
      account,
      description,
      photos,
      meta: { dateStart, sport }
    });
    if (tour && tour.tourUrl) record.komootUrl = cleanText(tour.tourUrl);
    if (tour) enrichedCount += 1;
    records.push(record);
  }
  const result = await importTrackRecords(records);
  if (companionManifest && enrichedCount) setStatus(`${result.imported} GPX importiert, ${enrichedCount} mit Komoot-Metadaten und Bildern ergänzt.`);
  if (companionManifest && !enrichedCount) setStatus(`${result.imported} GPX importiert. Keine Dateinamen passten zum Komoot-Importpaket.`, true);
}

async function proxyRequest(path, options = {}) {
  const url = `${proxyBaseUrl()}${path}`;
  let response;
  try {
    const headers = {};
    let body;
    let targetAddressSpace;
    if (options.body) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    if (shouldRequestLoopbackAccess()) targetAddressSpace = 'loopback';
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body,
      targetAddressSpace
    });
  } catch (error) {
    throw new Error(normalizeProxyError(error));
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
  return payload;
}
async function ensureProxyAccountLogin(account) { if (!account) throw new Error(t('accountRequired')); await proxyRequest('/login', { method: 'POST', body: { email: account.email, password: account.password } }); }

/**
 * Shows a validation result in the account dialog.
 * @param {string} message The text shown to the user.
 * @returns {void}
 */
function setAccountStatus(message) {
  if (!el.accountStatus) return;
  el.accountStatus.textContent = message;
  el.accountStatus.hidden = !message;
}

/**
 * Creates a visible account-validation message from a proxy error.
 * @param {unknown} error The error returned by the proxy request.
 * @returns {string} A short message suitable for the account dialog.
 */
function accountLoginFailureMessage(error) {
  const detail = `${error?.message ?? ''}`.trim();
  if (!detail) return t('accountLoginFailed');
  return `${t('accountLoginFailed')} (${detail})`;
}

async function checkProxy() {
  try {
    const payload = await proxyRequest('/health');
    state.proxy = { ...state.proxy, online: true, mode: payload.mode ?? null, lastCheckAt: payload.serverTime || new Date().toISOString(), lastError: null };
    renderProxy();
    setKomootStatus(t('proxyOnline'));
    return true;
  } catch (error) {
    const message = normalizeProxyError(error);
    state.proxy = { ...state.proxy, online: false, lastCheckAt: new Date().toISOString(), lastError: message };
    renderProxy();
    setKomootStatus(message, true);
    return false;
  }
}
/**
 * Verifies Komoot credentials through the local proxy and persists a confirmed account.
 * @returns {Promise<void>} Resolves after the account is stored or a validation result is shown.
 */
async function saveAccount() {
  const email = el.accountEmailInput.value.trim();
  const password = el.accountPasswordInput.value;
  setAccountStatus('');

  if (!email || !password) {
    setAccountStatus(t('accountLoginFailed'));
    return;
  }

  if (!await checkProxy()) {
    setAccountStatus(state.proxy.lastError || t('proxyOffline'));
    return;
  }

  try {
    const payload = await proxyRequest('/login', { method: 'POST', body: { email, password } });
    const current = state.accounts.find((account) => account.email.toLowerCase() === email.toLowerCase());
    const account = { id: current?.id ?? id('account'), email, password, label: payload.user?.name || email.split('@')[0] || t('accountLabelFallback'), remoteUserId: payload.user?.id ?? null, updatedAt: new Date().toISOString() };
    await put(STORES.accounts, account);
    state.accounts = state.accounts.filter((item) => item.id !== account.id).concat(account).sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    state.settings.activeAccountId = account.id;
    await saveSettings();
    el.accountDialog.close();
    el.accountEmailInput.value = '';
    el.accountPasswordInput.value = '';
    renderAll();
    setStatus(t('accountStored'));
    setKomootStatus(t('connectedAs', { name: account.label }));
  } catch (error) {
    state.proxy.lastError = error.message;
    renderProxy();
    setAccountStatus(accountLoginFailureMessage(error));
    setStatus(t('accountLoginFailed'), true);
  }
}
/**
 * Loads all tours for the selected legacy proxy account and retains valid selections.
 * @returns {Promise<void>} Resolves once the list is rendered or an error is shown.
 */
async function loadKomootTours() {
  const selectedAccountId = el.komootAccountSelect.value || state.settings.activeAccountId;
  const account = state.accounts.find((item) => item.id === selectedAccountId);
  if (!account) {
    setKomootStatus(t('accountRequired'), true);
    return;
  }
  state.settings.activeAccountId = account.id;
  await saveSettings();
  if (!await checkProxy()) return;
  try {
    const hadCache = !!komootCacheForAccount(account.id)?.tours?.length;
    const previousSelection = new Set(state.selectedKomootTourIds);
    setKomootProgress(komootProgressText().loadingTours, 20, false);
    await ensureProxyAccountLogin(account);
    setKomootProgress(komootProgressText().loadingTours, 55, false);
    const payload = await proxyRequest('/tours');
    setKomootProgress(komootProgressText().loadingTours, 100, false);
    state.komootTours = (payload.tours ?? []).map((tour) => normalizeKomootTourSummary(tour, account));
    const validIds = new Set(state.komootTours.map((tour) => tour.id));
    state.selectedKomootTourIds = new Set([...previousSelection].filter((tourId) => validIds.has(tourId)));
    await persistKomootCache(account.id);
    renderKomoot();
    let statusKey = 'komootLoadedSummary';
    if (hadCache) statusKey = 'komootRefreshedSummary';
    setKomootStatus(t(statusKey, { count: state.komootTours.length }));
    window.setTimeout(clearKomootProgress, 500);
  } catch (error) {
    clearKomootProgress();
    state.proxy.lastError = error.message;
    renderProxy();
    setKomootStatus(error.message, true);
  }
}
async function importKomootSelection() { if (!state.komootTours.length) { setKomootStatus(t('loadToursFirst'), true); return; } const ids = [...state.selectedKomootTourIds]; if (!ids.length) { setKomootStatus(t('selectToursFirst'), true); return; } const account = activeAccount(); if (!account) { setKomootStatus(t('accountRequired'), true); return; } if (!await checkProxy()) return; try { setKomootProgress(komootProgressText().importing, 15, false); await ensureProxyAccountLogin(account); setKomootProgress(komootProgressText().importing, 35, false); const payload = await proxyRequest('/import', { method: 'POST', body: { language: lang(), tourIds: ids } }); setKomootProgress(komootProgressText().importing, 80, false); const toursById = new Map(state.komootTours.map((tour) => [tour.id, tour])); const records = payload.items.map((item) => { const summary = toursById.get(item.id); return buildTrackRecord({ gpxText: item.gpx, fileName: item.fileName, source: 'komoot', type: summary?.type || 'unknown', account: { ...account, sourceTrackId: item.id }, description: item.description || null, photos: item.photos || null, meta: { dateStart: item.dateStart || summary?.dateStart || summary?.date || null, durationHours: item.durationHours ?? null, sport: item.sport || summary?.sport || null, surfaces: item.surfaces || null, wayTypes: item.wayTypes || null, surfaceSegments: item.surfaceSegments || null, wayTypeSegments: item.wayTypeSegments || null, directions: item.directions || null } }); }); const result = await importTrackRecords(records, true); setKomootProgress(komootProgressText().done, 100, false); setKomootStatus(t('komootImported', { count: result.imported })); window.setTimeout(clearKomootProgress, 500); } catch (error) { clearKomootProgress(); state.proxy.lastError = error.message; renderProxy(); setKomootStatus(error.message, true); } }

function downloadBlob(name, blob) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }
function downloadJson(name, payload) { const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); downloadBlob(name, blob); }
function timestampedBackupFileName(baseName) {
  const stamp = new Date();
  const yyyy = stamp.getFullYear();
  const mm = `${stamp.getMonth() + 1}`.padStart(2, '0');
  const dd = `${stamp.getDate()}`.padStart(2, '0');
  const hh = `${stamp.getHours()}`.padStart(2, '0');
  const min = `${stamp.getMinutes()}`.padStart(2, '0');
  const ss = `${stamp.getSeconds()}`.padStart(2, '0');
  const timestamp = `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
  const dot = baseName.indexOf('.');
  if (dot < 0) return `${baseName}_${timestamp}`;
  return `${baseName.slice(0, dot)}_${timestamp}${baseName.slice(dot)}`;
}
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
/**
 * Exports application settings without the retired password-based connector data.
 * @returns {void} Starts the local JSON download.
 */
function exportAppBackup() {
  downloadJson(t('backupFileName'), {
    kind: 'gpx-bibliothek-backup',
    version: 1,
    appVersion: CURRENT_VERSION_INFO.appVersion,
    cacheVersion: CURRENT_VERSION_INFO.cacheVersion,
    exportedAt: new Date().toISOString(),
    settings: state.settings
  });
}
async function exportTracksBackup(tracks, fileName) {
  const serializedTracks = [];
  for (const track of tracks) serializedTracks.push(await serializeTrackForBackup(track));
  const blob = await gzipJsonBlob({ kind: 'gpx-bibliothek-touren', version: 1, appVersion: CURRENT_VERSION_INFO.appVersion, cacheVersion: CURRENT_VERSION_INFO.cacheVersion, exportedAt: new Date().toISOString(), tracks: serializedTracks });
  downloadBlob(fileName, blob);
}
async function exportTourBackup() {
  await exportTracksBackup(state.tracks, timestampedBackupFileName(t('tourBackupFileName')));
}
async function exportSelectedTourBackup() {
  const tracks = state.tracks.filter((track) => state.selectedTrackIds.has(track.id));
  if (!tracks.length) {
    setStatus(t('exportSelectedTourBackupEmpty'), true);
    return;
  }
  await exportTracksBackup(tracks, timestampedBackupFileName(t('selectedTourBackupFileName')));
  setStatus(t('exportSelectedTourBackupDone', { count: tracks.length }));
}
/**
 * Imports application settings while discarding retired account and proxy fields from older backups.
 * @param {File} file Selected Trailthread application backup.
 * @returns {Promise<void>} Resolves after sanitized settings have been stored.
 */
async function importAppBackup(file) {
  if (!await confirmAction(t('confirmImportBackup'))) return;
  const payload = await readJsonFile(file);
  if (payload.kind !== 'gpx-bibliothek-backup') throw new Error(t('invalidBackup'));
  state.settings = { ...state.settings, ...(payload.settings ?? {}) };
  await deactivateLegacyProxyConnector();
  await saveSettings();
  renderAll();
  setStatus(t('backupImported'));
}
async function importTourBackup(file) { if (!await confirmAction(t('confirmImportTours'))) return; const payload = await readJsonFile(file); if (payload.kind !== 'gpx-bibliothek-touren' || !Array.isArray(payload.tracks)) throw new Error(t('invalidBackup')); await importTourBackupRecords(payload.tracks); }
async function shareApp() {
  const payload = { title: 'Trailthread', text: t('shareAppText'), url: APP_SHARE_URL };
  try {
    if (navigator.share) {
      await navigator.share(payload);
      return;
    }
    const shareText = `${payload.text}\n${payload.url}`;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareText);
      setStatus(t('shareCopied'));
      return;
    }
    const helper = document.createElement('textarea');
    helper.value = shareText;
    helper.setAttribute('readonly', 'readonly');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    helper.style.pointerEvents = 'none';
    document.body.append(helper);
    helper.select();
    document.execCommand('copy');
    helper.remove();
    setStatus(t('shareCopied'));
  } catch (error) {
    if (error?.name === 'AbortError') return;
    setStatus(t('shareUnavailable'), true);
  }
}
/**
 * Toggles all tours in one Komoot list and synchronizes the visible checkboxes.
 * @param {'recorded'|'planned'} listName Type of Komoot tour list to toggle.
 * @returns {void}
 */
function selectAllKomootTours(listName) {
  const ids = state.komootTours.filter((tour) => tour.type === listName).map((tour) => tour.id);
  const allSelected = ids.length > 0 && ids.every((tourId) => state.selectedKomootTourIds.has(tourId));
  let container = el.plannedList;
  if (listName === 'recorded') container = el.recordedList;
  if (allSelected) ids.forEach((tourId) => state.selectedKomootTourIds.delete(tourId));
  else ids.forEach((tourId) => state.selectedKomootTourIds.add(tourId));
  container?.querySelectorAll('.tour-item').forEach((item) => {
    const tourId = item.getAttribute('data-tour-id') || '';
    const checked = state.selectedKomootTourIds.has(tourId);
    item.classList.toggle('is-selected', checked);
    const checkbox = item.querySelector('.tour-checkbox');
    if (checkbox) checkbox.checked = checked;
  });
  renderKomootSelectionUi();
  void persistKomootCache(state.settings.activeAccountId);
}

/**
 * Loads tracks and settings, then removes retired password-based connector data from IndexedDB.
 * @returns {Promise<void>} Resolves when sanitized state is ready for rendering.
 */
async function loadState() {
  state.db = await openDb();
  const storedTracks = (await all(STORES.tracks)).map((track) => {
    const surfaceSegments = normalizeRangeSegments(track.surfaceSegments);
    const wayTypeSegments = normalizeRangeSegments(track.wayTypeSegments);
    let surfaces = normalizeTagList(track.surfaces);
    let wayTypes = normalizeTagList(track.wayTypes);
    if (!surfaces.length) surfaces = segmentValues(surfaceSegments);
    if (!wayTypes.length) wayTypes = segmentValues(wayTypeSegments);
    return enrichTrackMetrics({
      ...track,
      description: normalizeTrackDescription(track.description),
      dateStart: normalizeTrackDate(track.dateStart),
      surfaces,
      wayTypes,
      surfaceSegments,
      wayTypeSegments,
      photos: normalizePhotos(track.photos),
      color: track.color || defaultTrackColor(track),
      lastChanged: trackLastChanged(track) || track.importedAt || isoNow(),
      favorite: !!track.favorite,
      tags: normalizeTagList(track.tags),
      directions: normalizeDirections(track.directions)
    });
  }).sort((a, b) => (b.importedAt ?? '').localeCompare(a.importedAt ?? ''));
  state.tracks = await hydrateTracksPhotos(storedTracks);
  const settings = await all(STORES.settings);
  state.settings = { ...state.settings, ...(settings[0] ?? {}) };
  await deactivateLegacyProxyConnector();
  if (!['library', 'replay'].includes(state.settings.activeWorkspace)) state.settings.activeWorkspace = 'library';
  applyPaneWidths();
  await saveSettings();
}

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
    if (state.settings.activeWorkspace === 'replay') renderReplayWorkspace();
  }));
  el.settingsButton.addEventListener('click', () => el.settingsDialog.showModal());
  el.helpButton?.addEventListener('click', () => {
    el.helpDialog.showModal();
    void loadReadmeContent();
  });
  el.replayJumpStartButton?.addEventListener('click', () => jumpReplayTo('start'));
  el.replayJumpHighButton?.addEventListener('click', () => jumpReplayTo('highest'));
  el.replayJumpPhotoButton?.addEventListener('click', () => jumpReplayTo('photo'));
  el.replayJumpEndButton?.addEventListener('click', () => jumpReplayTo('end'));
  el.checkUpdatesButton?.addEventListener('click', async () => {
    await checkForUpdates();
  });
  el.reloadAppButton?.addEventListener('click', async () => {
    await performAppReload();
  });
  el.shareAppButton?.addEventListener('click', () => {
    void shareApp();
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
  el.addAccountButton.addEventListener('click', () => {
    setAccountStatus('');
    el.accountDialog.showModal();
  });
  el.saveAccountButton.addEventListener('click', saveAccount);
  el.trackDetailEditButton?.addEventListener('click', () => {
    state.trackDetailUi.editing = true;
    renderTrackDetailDialog();
    el.trackDetailNameInput?.focus();
    el.trackDetailNameInput?.select();
  });
  el.trackDetailCancelButton?.addEventListener('click', () => {
    state.trackDetailUi.editing = false;
    renderTrackDetailDialog();
  });
  el.trackDetailSaveButton?.addEventListener('click', async () => {
    const track = state.tracks.find((item) => item.id === state.trackDetailUi.trackId);
    if (!track) return;
    const nextName = cleanText(el.trackDetailNameInput?.value) || track.name || t('unnamedTrack');
    const nextDescription = cleanText(el.trackDetailDescriptionInput?.value);
    const nextFavorite = !!el.trackDetailFavoriteInput?.checked;
    const nextTags = parseTagInput(el.trackDetailTagsInput?.value);
    const updatedTrack = touchTrack(track, { name: nextName, description: nextDescription || '', favorite: nextFavorite, tags: nextTags });
    await put(STORES.tracks, updatedTrack);
    state.tracks = state.tracks.map((item) => {
      if (item.id === updatedTrack.id) return updatedTrack;
      return item;
    });
    state.trackDetailUi.editing = false;
    renderAll();
    renderTrackDetailDialog();
    setStatus(t('trackSaved'));
  });
  el.trackDetailDialog?.addEventListener('close', () => {
    state.trackDetailUi.trackId = null;
    state.trackDetailUi.editing = false;
  });
  el.fileInput.addEventListener('change', async (event) => {
    const files = [...event.target.files];
    if (files.length) await importLocalFiles(files);
    event.target.value = '';
  });
  el.librarySearchInput.addEventListener('input', refreshLibraryFilterView);
  el.libraryTypeFilter.addEventListener('change', refreshLibraryFilterView);
  el.libraryFavoriteFilter.addEventListener('change', refreshLibraryFilterView);
  el.librarySportFilter.addEventListener('change', refreshLibraryFilterView);
  el.libraryTagFilter.addEventListener('change', refreshLibraryFilterView);
  el.libraryMetaFilter.addEventListener('change', refreshLibraryFilterView);
  el.librarySortSelect.addEventListener('change', refreshLibraryFilterView);
  el.exportSelectedGpxButton.addEventListener('click', exportSelectedTracksGpx);
  el.exportSelectedMultiTrackGpxButton?.addEventListener('click', exportSelectedTracksMultiGpx);
  el.exportSelectedKmzButton?.addEventListener('click', () => {
    void exportSelectedTracksKmz('compatibility');
  });
  el.exportSelectedKmzProButton?.addEventListener('click', () => {
    void exportSelectedTracksKmz('photo-overlay');
  });
  el.mergeSelectedTracksButton?.addEventListener('click', openMergeDialog);
  el.mergeDialogSwapButton?.addEventListener('click', () => {
    if (state.mergeUi.orderedTrackIds.length !== 2) return;
    state.mergeUi.orderedTrackIds.reverse();
    renderMergeDialog();
  });
  el.mergeDialog?.addEventListener('close', () => {
    if (el.mergeDialog.returnValue === 'confirm') {
      const orderedTracks = mergeDialogTracks();
      void mergeSelectedTracks(orderedTracks);
    }
    state.mergeUi.orderedTrackIds = [];
  });
  el.fitAllButton.addEventListener('click', fitSelection);
  el.mapPhotoModeButton?.addEventListener('click', async () => {
    if (state.settings.heatmapMode) return;
    state.settings.photoOverlayOnly = !state.settings.photoOverlayOnly;
    await saveSettings();
    renderMapPhotoModeButton();
    syncMap();
  });
  el.mapHeatmapButton?.addEventListener('click', async () => {
      if (!state.settings.heatmapMode && !canRenderHeatmap()) {
        setStatus(t('heatmapNeedsMultipleTracks'), true);
        return;
      }
      state.settings.heatmapMode = !state.settings.heatmapMode;
      if (state.settings.heatmapMode) state.settings.photoOverlayOnly = false;
      await saveSettings();
      renderMapPhotoModeButton();
      renderMapHeatmapButton();
      syncMap();
      if (state.settings.heatmapMode) {
        const stats = state.heatmapStats;
        if (stats) {
          setStatus(`Heatmap: ${stats.tracks} Tracks, ${stats.segments} Segmente, ${stats.hotspots} Hotspots`);
        } else {
          setStatus(t('heatmapNeedsMultipleTracks'), true);
        }
      } else {
        setStatus(t('statusReady'));
      }
    });
  el.mapSegmentButton?.addEventListener('click', async () => {
    if (!state.settings.segmentOverlayMode && !highlightedTrackWithSegments()) {
      setStatus(t('segmentOverlayNeedsTrack'), true);
      return;
    }
    state.settings.segmentOverlayMode = !state.settings.segmentOverlayMode;
    await saveSettings();
    renderMapSegmentButton();
    syncMap();
    renderProfile();
    let segmentStatus = t('statusReady');
    if (state.settings.segmentOverlayMode) segmentStatus = t('mapSegments');
    setStatus(segmentStatus);
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
    syncMapForSelectionChange();
  });
  el.komootAccountSelect.addEventListener('change', async (event) => {
    state.settings.activeAccountId = event.target.value || null;
    await saveSettings();
    renderAccounts();
  });
  el.komootLoadButton.addEventListener('click', loadKomootTours);
  el.komootAccountSelect?.addEventListener('change', async () => {
    const account = state.accounts.find((item) => item.id === el.komootAccountSelect.value) ?? null;
    if (!account) return;
    state.settings.activeAccountId = account.id;
    await saveSettings();
    restoreKomootCache(account, { announce: true });
    renderKomootLoadButton();
  });
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
  const toggleReplayDirectionOverlay = async (collapsed) => {
    state.settings.replayDirectionOverlayCollapsed = collapsed;
    await saveSettings();
    renderReplayWorkspace();
  };
  el.replayDirectionOverlayToggle?.addEventListener('click', () => void toggleReplayDirectionOverlay(true));
  el.replayDirectionOverlayIcon?.addEventListener('click', () => void toggleReplayDirectionOverlay(false));
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
  el.exportSelectedTourBackupButton?.addEventListener('click', exportSelectedTourBackup);
  el.settingsExportTourBackupButton.addEventListener('click', exportTourBackup);
  el.settingsExportSelectedTourBackupButton?.addEventListener('click', exportSelectedTourBackup);
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
    let photoMarker = null;
    if (event.target instanceof Element) photoMarker = event.target.closest('.profile-photo-marker');
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
    let photoMarker = null;
    if (event.target instanceof Element) photoMarker = event.target.closest('.profile-photo-marker');
    const track = state.tracks.find((item) => item.id === state.profileUi.trackId);
    if (!photoMarker || !track) return;
    event.preventDefault();
    const index = Number(photoMarker.getAttribute('data-photo-index'));
    if (Number.isInteger(index)) openPhotoDialog(track, index);
  });
  el.profileChart?.addEventListener('pointerleave', clearProfileHover);
  el.photoDialogPrev?.addEventListener('click', () => stepPhotoDialog(-1));
  el.photoDialogNext?.addEventListener('click', () => stepPhotoDialog(1));
  el.photoDialogClose?.addEventListener('click', closePhotoDialog);
  el.photoDialogFullscreenButton?.addEventListener('click', () => void togglePhotoDialogFullscreen());
  el.photoDialogStage?.addEventListener('pointerdown', (event) => {
    state.photoDialogUi.swipeStartX = event.clientX;
  });
  el.photoDialogStage?.addEventListener('pointerup', (event) => {
    if (state.photoDialogUi.swipeStartX == null) return;
    const delta = event.clientX - state.photoDialogUi.swipeStartX;
    state.photoDialogUi.swipeStartX = null;
    if (Math.abs(delta) < 40) return;
    let direction = -1;
    if (delta < 0) direction = 1;
    stepPhotoDialog(direction);
  });
  el.photoDialog?.addEventListener('click', (event) => {
    if (event.target === el.photoDialog) closePhotoDialog();
  });
  document.addEventListener('keydown', handlePhotoDialogKeyboard);
  el.photoDialog?.addEventListener('close', () => {
    state.photoDialogUi.swipeStartX = null;
    void exitPhotoDialogFullscreen();
  });
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement !== el.photoDialogSheet) {
      el.photoDialogSheet?.classList.remove('is-fullscreen');
      el.photoDialog?.classList.remove('is-fullscreen');
    }
    renderPhotoDialogFullscreenControl();
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
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('reload', String(Date.now()));
      window.location.replace(nextUrl.toString());
    });
    serviceWorkerRegistration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    await navigator.serviceWorker.ready;
    await checkForUpdates({ showChecking: false, silentNoChange: true, silentError: true });
  } catch (error) {
    console.error(error);
    setUpdateStatus(t('statusSwRegisterFailed', { message: error.message }), false, true);
  }
}
async function init() { await loadState(); applyPaneWidths(); renderI18n(); applyKomootExtensionConfiguration(); initMap(); bindEvents(); renderAll(); syncMap(); fitSelection(); scheduleMapLayoutRefresh(); setStatus(t('statusReady')); await registerServiceWorker(); }
init().catch((error) => { console.error(error); setStatus(error.message || t('statusError'), true); });

