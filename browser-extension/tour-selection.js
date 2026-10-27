/** Tour query construction and additive pagination for the Komoot export helper. */
globalThis.TrailthreadTourSelection = (() => {
  const scopes = ['all', 'recorded', 'planned', 'filtered'];
  const supportedParameters = new Set(['type', 'search', 'name', 'sort', 'sort_field', 'sort_direction', 'page', 'limit']);

  /**
   * Normalizes a Komoot tour type to the extension's stable selection type.
   * @param {unknown} value API or overview tour type.
   * @returns {'recorded'|'planned'|'unknown'} Normalized tour type.
   */
  function normalizeTourType(value) {
    if (typeof value !== 'string') return 'unknown';
    const type = value.trim().toLowerCase();
    if (type === 'recorded' || type === 'tour_recorded') return 'recorded';
    if (type === 'planned' || type === 'tour_planned') return 'planned';
    return 'unknown';
  }

  /**
   * Resolves the overview's tour type using its query or activities/routes path.
   * @param {string} href Current page URL.
   * @returns {'recorded'|'planned'|'all'} Preferred tour selection type.
   */
  function listType(href) {
    const url = new URL(href);
    const type = normalizeTourType(url.searchParams.get('type'));
    if (type !== 'unknown') return type;
    if (/\/activities\/?$/i.test(url.pathname)) return 'recorded';
    if (/\/routes\/?$/i.test(url.pathname)) return 'planned';
    return 'all';
  }

  /**
   * Builds a tour query for one bulk action, translating overview search into API name.
   * @param {string} href Overview URL captured when the user clicked the action.
   * @param {string} userId Komoot profile identifier.
   * @param {'all'|'recorded'|'planned'|'filtered'} scope Requested selection scope.
   * @returns {{href:string, type:string}} API URL and local type guard; throws a coded error for unsupported filters.
   */
  function buildRequest(href, userId, scope) {
    if (!scopes.includes(scope)) throw new Error('invalid-scope');
    if (typeof userId !== 'string' || !userId.trim()) throw new Error('missing-user');
    const overview = new URL(href);
    const request = new URL(`/api/v007/users/${encodeURIComponent(userId)}/tours/`, overview.origin);
    let type = scope;
    if (scope === 'filtered') {
      for (const [key, value] of overview.searchParams) {
        if (value && !supportedParameters.has(key)) throw new Error('unsupported-filters');
      }
      const rawType = overview.searchParams.get('type');
      if (rawType && normalizeTourType(rawType) === 'unknown') throw new Error('unsupported-filters');
      type = listType(href);
      const search = overview.searchParams.get('search') || overview.searchParams.get('name') || '';
      const name = overview.searchParams.get('name');
      if (name && overview.searchParams.get('search') && name !== search) throw new Error('unsupported-filters');
      if (search.trim()) request.searchParams.set('name', search.trim());
    }
    request.searchParams.set('limit', '24');
    request.searchParams.set('sort_field', 'date');
    request.searchParams.set('sort_direction', 'desc');
    if (type !== 'all') request.searchParams.set('type', `tour_${type}`);
    return { href: request.href, type };
  }

  /**
   * Adds matching tours from every linked result page while preserving prior selections.
   * @param {{href:string,type:string}} request Query returned by buildRequest.
   * @param {{selection:Map,loadPage:Function,describeTour:Function,onProgress:Function}} dependencies Explicit state, API loader, descriptor adapter and progress callback.
   * @returns {Promise<{added:number,total:number}>} New unique tours and complete package size; partial results survive errors.
   */
  async function addTours(request, { selection, loadPage, describeTour, onProgress }) {
    const initial = new URL(request.href);
    initial.searchParams.sort();
    const pages = new Set();
    let pageUrl = initial.href;
    let added = 0;
    while (pageUrl) {
      if (pages.has(pageUrl)) throw new Error('repeated-page');
      pages.add(pageUrl);
      onProgress({ page: pages.size, added, total: selection.size });
      const payload = await loadPage(pageUrl);
      const tours = payload?._embedded?.tours;
      if (!Array.isArray(tours)) throw new Error('invalid-tour-response');
      for (const tour of tours) {
        const descriptor = describeTour(tour);
        if (!descriptor) continue;
        if (request.type !== 'all' && descriptor.type !== request.type) continue;
        if (selection.has(descriptor.tourId)) continue;
        selection.set(descriptor.tourId, descriptor);
        added += 1;
      }
      onProgress({ page: pages.size, added, total: selection.size });
      const nextHref = payload?._links?.next?.href;
      if (!nextHref) break;
      const next = new URL(nextHref, pageUrl);
      const expectedPath = initial.pathname.replace(/^\/api/, '');
      if (next.protocol !== 'https:' || !['www.komoot.com', 'komoot.com', 'www.komoot.de', 'komoot.de', 'api.komoot.de'].includes(next.hostname)) throw new Error('invalid-next-page');
      if (next.pathname.replace(/^\/api/, '') !== expectedPath) throw new Error('invalid-next-page');
      // Reapply the original search/type if a next-page link omits or changes them.
      for (const [key, value] of initial.searchParams) next.searchParams.set(key, value);
      next.protocol = initial.protocol;
      next.host = initial.host;
      next.pathname = initial.pathname;
      next.searchParams.sort();
      pageUrl = next.href;
    }
    return { added, total: selection.size };
  }

  return Object.freeze({ normalizeTourType, listType, buildRequest, addTours });
})();
