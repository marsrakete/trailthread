/** Filename policies for individual tours and collection backups. */
globalThis.TrailthreadBackupFilenames = (() => {
  /**
   * Creates the existing date-prefixed GPX name from tour metadata.
   * @param {string|null} dateStart Tour start date, optionally with time.
   * @param {string} title Tour title.
   * @returns {string} Name in YYYYMMDD_HHMM_Title.gpx form.
   */
  function gpxFileName(dateStart, title) {
    let prefix = '00000000_0000';
    if (typeof dateStart === 'string') {
      const match = dateStart.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
      if (match) {
        let hours = '00';
        let minutes = '00';
        if (match[4]) hours = match[4];
        if (match[5]) minutes = match[5];
        prefix = `${match[1]}${match[2]}${match[3]}_${hours}${minutes}`;
      }
    }
    return `${prefix}_${title}.gpx`;
  }

  /**
   * Resolves a common collection name only when every selected tour has the same origin.
   * @param {Array<object>} tours Selected descriptors with optional collection metadata.
   * @returns {string|null} Shared collection name, or null for empty, unnamed or mixed selections.
   */
  function collectionNameForSelection(tours) {
    if (!Array.isArray(tours) || !tours.length) return null;
    const first = tours[0]?.collection;
    if (!first?.id || typeof first.name !== 'string' || !first.name.trim()) return null;
    if (!tours.every((tour) => tour?.collection?.id === first.id)) return null;
    return first.name.trim();
  }

  /**
   * Chooses a safe collection filename, a single-tour GPX basename or the collection fallback.
   * @param {Array<object>} entries Successfully included export entries.
   * @param {string|null} [collectionName=null] Collection name captured when export started.
   * @returns {string} Suggested compressed JSON filename.
   */
  function backupFileName(entries, collectionName = null) {
    if (typeof collectionName === 'string' && collectionName.trim()) {
      let name = collectionName.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
      name = Array.from(name).slice(0, 180).join('').replace(/[. ]+$/g, '');
      if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name)) name = `_${name}`;
      if (name) return `${name}.json.gz`;
    }
    if (Array.isArray(entries) && entries.length === 1) {
      const entry = entries[0];
      let fileName = gpxFileName(entry.dateStart, entry.name);
      if (typeof entry.gpxFileName === 'string' && entry.gpxFileName.trim()) fileName = entry.gpxFileName.trim();
      return `${fileName.replace(/\.gpx$/i, '')}.json.gz`;
    }
    return 'trailthread-komoot-touren.json.gz';
  }

  return Object.freeze({ gpxFileName, collectionNameForSelection, backupFileName });
})();
