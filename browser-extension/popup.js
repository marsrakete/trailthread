/**
 * Finds the active browser tab in the popup's current window.
 * @returns {Promise<chrome.tabs.Tab|null>} Active tab or null when Chrome cannot provide one.
 */
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs.length) return null;
  return tabs[0];
}

/**
 * Renders the background worker's export state in the popup.
 * @param {object|null} runStatus Serializable export state, or null when no export runs in this tab.
 * @returns {void} Updates the mounted popup fields.
 */
function renderRunStatus(runStatus) {
  const status = document.querySelector('.popup-status');
  const count = document.querySelector('.popup-count');
  const tour = document.querySelector('.popup-tour');
  const cancelButton = document.querySelector('.popup-cancel');
  if (!status || !count || !tour || !cancelButton) return;
  if (!runStatus) {
    status.textContent = 'Kein Export aktiv.';
    count.textContent = 'Kein Export aktiv.';
    tour.textContent = '–';
    cancelButton.hidden = true;
    return;
  }
  status.textContent = runStatus.status || 'Komoot-Export läuft.';
  count.textContent = `Tour ${runStatus.current}/${runStatus.total}`;
  tour.textContent = runStatus.tourName || 'Tour wird vorbereitet.';
  cancelButton.hidden = false;
  cancelButton.disabled = runStatus.cancelled === true;
  if (runStatus.cancelled === true) cancelButton.textContent = 'Abbruch wird verarbeitet …';
  else cancelButton.textContent = 'Export abbrechen';
}

/**
 * Requests the current export state for the active Komoot tab.
 * @returns {Promise<void>} Resolves after the popup was refreshed.
 */
async function refreshRunStatus() {
  const tab = await getActiveTab();
  if (!tab || typeof tab.id !== 'number') {
    renderRunStatus(null);
    return;
  }
  const response = await chrome.runtime.sendMessage({ type: 'trailthread:get-run-status', sourceTabId: tab.id });
  if (!response?.ok) {
    renderRunStatus(null);
    return;
  }
  renderRunStatus(response.run || null);
}

/**
 * Requests cancellation for the export running in the active Komoot tab.
 * @returns {Promise<void>} Resolves after the background worker accepted the cancellation request.
 */
async function cancelActiveRun() {
  const tab = await getActiveTab();
  if (!tab || typeof tab.id !== 'number') return;
  await chrome.runtime.sendMessage({ type: 'trailthread:cancel-run', sourceTabId: tab.id });
  await refreshRunStatus();
}

/**
 * Mounts the popup template and wires its user interactions.
 * @returns {void} Initializes the extension popup once its document is ready.
 */
function initializePopup() {
  const template = document.querySelector('#trailthread-komoot-popup-template');
  const root = document.querySelector('#popup-root');
  const fragment = template.content.cloneNode(true);
  root.append(fragment);
  const cancelButton = document.querySelector('.popup-cancel');
  if (cancelButton) cancelButton.addEventListener('click', () => void cancelActiveRun());
  void refreshRunStatus();
  window.setInterval(() => void refreshRunStatus(), 1000);
}

initializePopup();
