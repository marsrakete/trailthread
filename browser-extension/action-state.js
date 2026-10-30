const KOMOOT_WEBSITE_HOSTS = new Set(['komoot.com', 'www.komoot.com', 'komoot.de', 'www.komoot.de']);

/**
 * Checks whether a URL belongs to a supported Komoot website content-script origin.
 * @param {unknown} value Browser tab URL, possibly missing or restricted.
 * @returns {boolean} True only for the supported HTTPS Komoot websites.
 */
export function isSupportedKomootUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && KOMOOT_WEBSITE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Registers per-tab action activation and restores existing tabs when the worker starts.
 * @param {object} browser Chrome-compatible tabs, action and runtime APIs.
 * @returns {{ready:Promise<void>,updateTab:Function,refreshAllTabs:Function}} Initial synchronization and reusable refresh handlers.
 */
export function registerActionState(browser) {
  /**
   * Refreshes a tab using its current URL rather than a potentially stale navigation event.
   * @param {number} tabId Browser tab identifier.
   * @returns {Promise<void>} Resolves after activation or after the tab has disappeared.
   */
  async function updateTab(tabId) {
    if (!Number.isInteger(tabId) || tabId < 0) return;
    try {
      const tab = await browser.tabs.get(tabId);
      if (isSupportedKomootUrl(tab.url)) await browser.action.enable(tabId);
      else await browser.action.disable(tabId);
    } catch {
      // Tabs can close between a browser event and the action update.
    }
  }

  /**
   * Recomputes action availability for all existing tabs after startup or installation.
   * @returns {Promise<void>} Resolves when every available tab has been synchronized.
   */
  async function refreshAllTabs() {
    try {
      const tabs = await browser.tabs.query({});
      await Promise.all(tabs.map((tab) => updateTab(tab.id)));
    } catch {
      // The manifest's disabled default remains in effect if tabs are unavailable.
    }
  }

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url !== undefined || changeInfo.status) return updateTab(tabId);
  });
  browser.tabs.onActivated.addListener(({ tabId }) => updateTab(tabId));
  browser.tabs.onCreated.addListener((tab) => updateTab(tab.id));
  browser.tabs.onReplaced.addListener((addedTabId) => updateTab(addedTabId));
  browser.runtime.onInstalled.addListener(refreshAllTabs);
  browser.runtime.onStartup.addListener(refreshAllTabs);
  return Object.freeze({ ready: refreshAllTabs(), updateTab, refreshAllTabs });
}
