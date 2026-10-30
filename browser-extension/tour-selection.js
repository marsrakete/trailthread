/** Tour query construction and additive pagination for the Komoot export helper. */
globalThis.TrailthreadTourSelection = (() => {
  const scopes = ['all', 'recorded', 'planned', 'filtered'];
  const supportedParameters = new Set([
    'type', 'search', 'name', 'sort', 'sort_field', 'sort_direction', 'page', 'limit',
    'date', 'location', 'visibility', 'min_uphill', 'max_uphill',
    'min_length', 'max_length', 'min_duration', 'max_duration', 'filter_by_duration',
    'sport', 'include_ebike',
  ]);

  /**
   * Converts selected sports and the observed E-bike expansion into API sport types.
   * @param {URLSearchParams} source Overview parameters with comma-separated or repeated sports.
   * @param {URLSearchParams} target API parameters receiving a deduplicated sport_types list.
   * @returns {void} Rejects malformed sports and unverified E-bike expansions.
   */
  function applySportFilter(source, target) {
    const includeEbike = source.get('include_ebike');
    if (includeEbike !== null && includeEbike !== 'true' && includeEbike !== 'false') throw new Error('invalid-filters');
    const sports = new Set();
    for (const value of source.getAll('sport')) {
      for (const sport of value.split(',')) {
        if (!/^[a-z][a-z0-9_]*$/.test(sport)) throw new Error('invalid-filters');
        sports.add(sport);
        if (includeEbike !== 'true' || sport.startsWith('e_')) continue;
        if (!['mtb_easy', 'racebike'].includes(sport)) throw new Error('unsupported-ebike-sport');
        sports.add(`e_${sport}`);
      }
    }
    if (sports.size) target.set('sport_types', [...sports].join(','));
  }

  /**
   * Parses one calendar day at local midnight without accepting normalized invalid dates.
   * @param {string} value Calendar date in YYYY-MM-DD form.
   * @returns {Date} Local midnight; throws for malformed or nonexistent dates.
   */
  function parseCalendarDay(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) throw new Error('invalid-filters');
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(0);
    date.setHours(0, 0, 0, 0);
    date.setFullYear(year, month, day);
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) throw new Error('invalid-filters');
    return date;
  }

  /**
   * Maps an inclusive local calendar interval to UTC API boundaries, respecting DST.
   * @param {URLSearchParams} source Overview parameters.
   * @param {URLSearchParams} target API parameters receiving start_date and end_date.
   * @returns {void} Leaves boundaries absent when no date filter was set.
   */
  function applyDateFilter(source, target) {
    if (!source.has('date')) return;
    const parts = source.get('date').split(',');
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('invalid-filters');
    const start = parseCalendarDay(parts[0]);
    const end = parseCalendarDay(parts[1]);
    if (start > end) throw new Error('invalid-filters');
    end.setHours(23, 59, 59, 999);
    target.set('start_date', start.toISOString());
    target.set('end_date', end.toISOString());
  }

  /**
   * Maps a center and kilometer radius from the overview to the meter-based API filter.
   * @param {URLSearchParams} source Overview parameters.
   * @param {URLSearchParams} target API parameters receiving center and max_distance.
   * @returns {void} Rejects malformed coordinates or a nonpositive radius.
   */
  function applyLocationFilter(source, target) {
    if (!source.has('location')) return;
    const match = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?)r$/.exec(source.get('location'));
    if (!match) throw new Error('invalid-filters');
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    const distance = Number(match[3]) * 1000;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || !Number.isFinite(distance) || distance <= 0) throw new Error('invalid-filters');
    target.set('center', `${latitude},${longitude}`);
    target.set('max_distance', String(distance));
  }

  /**
   * Copies a valid nonnegative numeric interval while rejecting inverted bounds.
   * @param {URLSearchParams} source Overview parameters.
   * @param {URLSearchParams} target API parameters receiving active bounds.
   * @param {string} field Interval suffix: uphill, length, or duration.
   * @returns {void} Preserves explicit zero; omits Komoot's observed unbounded 10-hour maximum.
   */
  function applyNumericRange(source, target, field) {
    const minimumKey = `min_${field}`;
    const maximumKey = `max_${field}`;
    for (const key of [minimumKey, maximumKey]) {
      if (!source.has(key)) continue;
      const raw = source.get(key);
      if (!/^\d+(?:\.\d+)?$/.test(raw)) throw new Error('invalid-filters');
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error('invalid-filters');
      if (field === 'duration' && key === maximumKey && value === 36000) continue;
      target.set(key, String(value));
    }
    if (target.has(minimumKey) && target.has(maximumKey) && Number(target.get(minimumKey)) > Number(target.get(maximumKey))) throw new Error('invalid-filters');
  }

  /**
   * Applies the observed date, location, visibility and active numeric filters.
   * @param {URLSearchParams} source Overview parameters.
   * @param {URLSearchParams} target API parameters receiving translated filters.
   * @returns {void} Rejects invalid filter combinations before any API request.
   */
  function applyOverviewFilters(source, target) {
    applySportFilter(source, target);
    applyDateFilter(source, target);
    applyLocationFilter(source, target);
    if (source.has('visibility')) {
      const visibility = source.get('visibility');
      if (!/^[A-Z_]+(?:,[A-Z_]+)*$/.test(visibility)) throw new Error('invalid-filters');
      target.set('visibilities', visibility);
    }
    applyNumericRange(source, target, 'uphill');
    const durationMode = source.get('filter_by_duration');
    if (durationMode !== null && durationMode !== 'true' && durationMode !== 'false') throw new Error('invalid-filters');
    if (durationMode !== 'true') applyNumericRange(source, target, 'length');
    if (durationMode !== 'false') applyNumericRange(source, target, 'duration');
  }

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
   * Builds a tour query for one bulk action, translating all observed overview filters.
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
        // Overview sorting does not affect which tours belong to the selection.
        if (key === 'order') continue;
        if (value && !supportedParameters.has(key)) throw Object.assign(new Error('unsupported-filters'), { parameter: key });
        if (key !== 'sport' && overview.searchParams.getAll(key).length !== 1) throw new Error('invalid-filters');
      }
      const rawType = overview.searchParams.get('type');
      if (rawType && normalizeTourType(rawType) === 'unknown') throw new Error('unsupported-filters');
      type = listType(href);
      const search = overview.searchParams.get('search') || overview.searchParams.get('name') || '';
      const name = overview.searchParams.get('name');
      if (name && overview.searchParams.get('search') && name !== search) throw new Error('unsupported-filters');
      if (search.trim()) request.searchParams.set('name', search.trim());
      applyOverviewFilters(overview.searchParams, request.searchParams);
    }
    request.searchParams.set('limit', '24');
    request.searchParams.set('sort_field', 'date');
    request.searchParams.set('sort_direction', 'desc');
    if (type !== 'all') request.searchParams.set('type', `tour_${type}`);
    return { href: request.href, type };
  }

  /**
   * Identifies the collection currently shown in a localized Komoot page URL.
   * @param {string} href Current page URL.
   * @returns {string|null} Numeric collection identifier or null outside collection pages.
   */
  function collectionId(href) {
    try {
      const url = new URL(href);
      const match = url.pathname.match(/^(?:\/[a-z]{2}(?:-[a-z]{2})?)?\/collection\/(\d+)(?:\/|$)/i);
      if (match) return match[1];
    } catch {
      // Invalid URLs cannot identify a collection.
    }
    return null;
  }

  /**
   * Builds the paginated compilation request for the active collection.
   * @param {string} href Collection page URL, including its optional title slug.
   * @param {string} [name=''] Collection title captured from the page.
   * @returns {{href:string,type:string,kind:string,collection:object}} Collection query and selection provenance.
   */
  function buildCollectionRequest(href, name = '') {
    const id = collectionId(href);
    if (!id) throw new Error('invalid-collection');
    const overview = new URL(href);
    const url = new URL(`/api/v007/collections/${id}/compilation/`, overview.origin);
    url.searchParams.set('limit', '24');
    return { href: url.href, type: 'all', kind: 'collection', collection: { id, name } };
  }

  /**
   * Adds matching tours from every linked result page while preserving prior selections.
   * @param {{href:string,type:string,kind?:string}} request Profile or collection query.
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
      let tours = payload?._embedded?.tours;
      if (request.kind === 'collection') tours = payload?._embedded?.items;
      if (!Array.isArray(tours)) throw new Error('invalid-tour-response');
      for (const tour of tours) {
        if (request.kind === 'collection' && normalizeTourType(tour?.type) === 'unknown') continue;
        const descriptor = describeTour(tour);
        if (!descriptor) continue;
        if (request.type !== 'all' && descriptor.type !== request.type) continue;
        if (selection.has(descriptor.tourId)) continue;
        if (request.kind === 'collection') descriptor.collection = { ...request.collection };
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
      // Reapply all original filters if a next-page link omits or changes them.
      for (const [key, value] of initial.searchParams) next.searchParams.set(key, value);
      next.protocol = initial.protocol;
      next.host = initial.host;
      next.pathname = initial.pathname;
      next.searchParams.sort();
      pageUrl = next.href;
    }
    return { added, total: selection.size };
  }

  return Object.freeze({ normalizeTourType, listType, buildRequest, collectionId, buildCollectionRequest, addTours });
})();
