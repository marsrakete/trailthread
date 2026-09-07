/**
 * Creates the dormant legacy Komoot workspace controller.
 * The controller preserves proxy and tour-loading operations without registering UI events itself.
 * @param {object} dependencies Services supplied by Trailthread's main application module.
 * @returns {{proxyRequest: (path: string, options?: object) => Promise<object>, ensureAccountLogin: (account: object) => Promise<void>, checkProxy: () => Promise<boolean>}} Legacy Komoot API operations.
 */
export function createKomootWorkspaceController(dependencies) {
  /**
   * Requests the legacy local Komoot proxy and validates its JSON envelope.
   * @param {string} path Endpoint path below the local proxy base URL.
   * @param {object} [options={}] HTTP request options and optional JSON body.
   * @returns {Promise<object>} Valid proxy response payload.
   */
  async function proxyRequest(path, options = {}) {
    const url = `${dependencies.proxyBaseUrl()}${path}`;
    let response;
    try {
      const headers = {};
      let body;
      let targetAddressSpace;
      if (options.body) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(options.body);
      }
      if (dependencies.shouldRequestLoopbackAccess()) targetAddressSpace = 'loopback';
      response = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body,
        targetAddressSpace,
      });
    } catch (error) {
      throw new Error(dependencies.normalizeProxyError(error));
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
    return payload;
  }

  /**
   * Authenticates a stored legacy account with the local proxy.
   * @param {object} account Stored Komoot account with email and password.
   * @returns {Promise<void>} Resolves after the proxy accepted the account.
   */
  async function ensureAccountLogin(account) {
    if (!account) throw new Error(dependencies.translate('accountRequired'));
    await proxyRequest('/login', {
      method: 'POST',
      body: { email: account.email, password: account.password },
    });
  }

  /**
   * Checks the local proxy and records diagnostics without activating the legacy UI.
   * @returns {Promise<boolean>} Whether the proxy responded successfully.
   */
  async function checkProxy() {
    try {
      const payload = await proxyRequest('/health');
      dependencies.state.proxy = {
        ...dependencies.state.proxy,
        online: true,
        mode: payload.mode ?? null,
        lastCheckAt: payload.serverTime || new Date().toISOString(),
        lastError: null,
      };
      return true;
    } catch (error) {
      dependencies.state.proxy = {
        ...dependencies.state.proxy,
        online: false,
        lastCheckAt: new Date().toISOString(),
        lastError: dependencies.normalizeProxyError(error),
      };
      return false;
    }
  }

  return { proxyRequest, ensureAccountLogin, checkProxy };
}
