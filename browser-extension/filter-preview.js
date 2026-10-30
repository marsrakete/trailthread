/** Template-based preview of the actual API filters, shared by every toolbar refresh. */
globalThis.TrailthreadFilterPreview = (() => {
  const labels = Object.freeze({
    name: 'Suchtext', type: 'Tourtyp', sport_types: 'Sportarten', date: 'Zeitraum',
    center: 'Umkreis', visibilities: 'Sichtbarkeit', uphill: 'Bergauf', length: 'Länge', duration: 'Dauer',
    include_ebike: 'E-Bike-Varianten', search: 'Suchtext', sport: 'Sportarten', location: 'Umkreis',
    visibility: 'Sichtbarkeit', min_uphill: 'Bergauf ab', max_uphill: 'Bergauf bis',
    min_length: 'Länge ab', max_length: 'Länge bis', min_duration: 'Dauer ab', max_duration: 'Dauer bis',
    filter_by_duration: 'Nach Dauer filtern',
  });
  const values = Object.freeze({
    tour_recorded: 'Gemachte Touren', tour_planned: 'Geplante Touren', all: 'Alle Touren',
    mtb_easy: 'Mountainbike', racebike: 'Rennrad', e_mtb_easy: 'E-Mountainbike', e_racebike: 'E-Rennrad',
    PUBLIC: 'Öffentlich', PRIVATE: 'Privat', true: 'Ja', false: 'Nein',
  });
  const messages = Object.freeze({
    'unsupported-filters': 'Nicht unterstützter Filter',
    'invalid-filters': 'Ungültige Filterwerte. Bitte die Einstellungen in Komoot prüfen.',
    'unsupported-ebike-sport': 'Die E-Bike-Erweiterung ist bisher nur für Mountainbike und Rennrad bestätigt.',
    invalid: 'Die Filter konnten nicht gelesen werden.',
    prefix: 'Es wird nichts hinzugefügt: ',
    raw: 'Einstellungen aus der URL – noch nicht übernommen',
    validTitle: 'Übernommene Filter',
    invalidTitle: 'Filter bitte prüfen',
  });

  /**
   * Formats a bounded or one-sided numeric interval in the selected locale.
   * @param {URLSearchParams} params Effective API parameters.
   * @param {string} field Numeric interval name.
   * @param {number} divisor Unit conversion factor.
   * @param {string} unit Display unit.
   * @param {string} locale Display locale.
   * @returns {string|null} Interval label or null when no bound exists.
   */
  function formatRange(params, field, divisor, unit, locale) {
    const minimum = params.get(`min_${field}`);
    const maximum = params.get(`max_${field}`);
    if (minimum === null && maximum === null) return null;
    const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    let text = '';
    if (minimum !== null && maximum !== null) text = `${format.format(Number(minimum) / divisor)} – ${format.format(Number(maximum) / divisor)}`;
    else if (minimum !== null) text = `ab ${format.format(Number(minimum) / divisor)}`;
    else text = `bis ${format.format(Number(maximum) / divisor)}`;
    return `${text} ${unit}`;
  }

  /**
   * Describes the actual request without fetching tours; invalid input produces explicit warnings.
   * @param {string} href Current overview URL.
   * @param {Function} buildRequest Existing query builder used by the actual selection action.
   * @param {string} [locale='de-DE'] Display locale for numbers and dates.
   * @returns {{valid:boolean, rows:Array<object>, warning:string}} Readable effective filters or raw invalid settings.
   */
  function describe(href, buildRequest, locale = 'de-DE') {
    const rows = [];
    let warning = '';
    try {
      const request = buildRequest(href, 'preview', 'filtered');
      const params = new URL(request.href).searchParams;
      rows.push({ label: labels.type, value: values[params.get('type') || 'all'] });
      if (params.has('name')) rows.push({ label: labels.name, value: params.get('name') });
      if (params.has('sport_types')) rows.push({ label: labels.sport_types, value: params.get('sport_types').split(',').map((sport) => values[sport] || sport).join(', ') });
      const overview = new URL(href);
      if (overview.searchParams.has('include_ebike')) {
        let value = 'Keine zusätzlichen E-Bike-Varianten';
        if (overview.searchParams.get('include_ebike') === 'true') value = 'E-Bike-Varianten einschließen';
        if (!params.has('sport_types')) value = 'Ohne Sportauswahl keine zusätzliche Einschränkung';
        rows.push({ label: labels.include_ebike, value });
      }
      if (params.has('start_date')) {
        const format = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
        rows.push({ label: labels.date, value: `${format.format(new Date(params.get('start_date')))} – ${format.format(new Date(params.get('end_date')))}` });
      }
      if (params.has('center')) rows.push({ label: labels.center, value: `${new Intl.NumberFormat(locale).format(Number(params.get('max_distance')) / 1000)} km um ${params.get('center')}` });
      if (params.has('visibilities')) rows.push({ label: labels.visibilities, value: params.get('visibilities').split(',').map((value) => values[value] || value).join(', ') });
      for (const [field, divisor, unit] of [['uphill', 1, 'm'], ['length', 1000, 'km'], ['duration', 3600, 'h']]) {
        const value = formatRange(params, field, divisor, unit, locale);
        if (value) rows.push({ label: labels[field], value });
      }
      return { valid: true, rows, warning };
    } catch (error) {
      let detail = messages[error.message] || messages.invalid;
      if (error.parameter) detail = `${detail}: ${error.parameter}`;
      warning = `${messages.prefix}${detail}`;
      try {
        for (const [key, value] of new URL(href).searchParams) rows.push({ label: labels[key] || key, value: values[value] || value });
      } catch {
        // A malformed page URL has no settings that can be listed safely.
      }
      return { valid: false, rows, warning };
    }
  }

  /**
   * Creates a cached DOM renderer for the preview to avoid observer feedback loops.
   * @param {{container:HTMLElement,rowTemplate:HTMLTemplateElement,buildRequest:Function,locale?:string}} options Explicit DOM, template and query-builder dependencies.
   * @returns {{update:Function}} Controller whose update(href) returns the current preview model.
   */
  function createController({ container, rowTemplate, buildRequest, locale = 'de-DE' }) {
    let previousHref = null;
    let model = null;
    /**
     * Updates preview rows only after the page URL changes.
     * @param {string} href Current overview URL.
     * @returns {object} Current validation and filter description model.
     */
    function update(href) {
      if (previousHref === href) return model;
      previousHref = href;
      model = describe(href, buildRequest, locale);
      const list = container.querySelector('.trailthread-komoot-filter-rows');
      const warning = container.querySelector('.trailthread-komoot-filter-warning');
      let title = messages.validTitle;
      if (!model.valid) title = messages.invalidTitle;
      container.querySelector('.trailthread-komoot-filter-title').textContent = title;
      const fragment = container.ownerDocument.createDocumentFragment();
      for (const row of model.rows) {
        const node = rowTemplate.content.cloneNode(true);
        node.querySelector('dt').textContent = row.label;
        node.querySelector('dd').textContent = row.value;
        fragment.append(node);
      }
      list.replaceChildren(fragment);
      warning.textContent = model.warning;
      warning.hidden = model.valid;
      list.setAttribute('aria-label', messages.raw);
      if (model.valid) list.removeAttribute('aria-label');
      return model;
    }
    return Object.freeze({ update });
  }

  return Object.freeze({ describe, createController });
})();
