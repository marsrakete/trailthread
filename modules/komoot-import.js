/**
 * Validates the current Komoot import selection and returns its required context.
 * @param {object} state Trailthread application state containing Komoot tours and accounts.
 * @param {() => object|null} activeAccount Returns the selected Komoot account.
 * @param {(key: string) => string} translate Resolves a translated user-facing message.
 * @param {(message: string, error?: boolean) => void} setKomootStatus Displays Komoot workspace feedback.
 * @returns {{account: object, tourIds: string[]}|null} Import context, or null after displaying a validation message.
 */
function getKomootImportContext(state, activeAccount, translate, setKomootStatus) {
  if (!state.komootTours.length) {
    setKomootStatus(translate('loadToursFirst'), true);
    return null;
  }

  const tourIds = [...state.selectedKomootTourIds];
  if (!tourIds.length) {
    setKomootStatus(translate('selectToursFirst'), true);
    return null;
  }

  const account = activeAccount();
  if (!account) {
    setKomootStatus(translate('accountRequired'), true);
    return null;
  }

  return { account, tourIds };
}

/**
 * Converts one Komoot proxy response item into Trailthread's internal track format.
 * @param {object} item Imported tour data returned by the Komoot proxy.
 * @param {Map<string, object>} toursById Loaded Komoot tour summaries indexed by ID.
 * @param {object} account Active account associated with the imported track.
 * @param {(options: object) => object} buildTrackRecord Builds Trailthread's normalized track record.
 * @returns {object} Normalized Trailthread track record.
 */
function buildKomootImportTrackRecord(item, toursById, account, buildTrackRecord) {
  const summary = toursById.get(item.id);
  let type = 'unknown';

  if (summary?.type) {
    type = summary.type;
  }

  return buildTrackRecord({
    gpxText: item.gpx,
    fileName: item.fileName,
    source: 'komoot',
    type,
    account: { ...account, sourceTrackId: item.id },
    description: item.description || null,
    photos: item.photos || null,
    meta: {
      dateStart: item.dateStart || summary?.dateStart || summary?.date || null,
      durationHours: item.durationHours ?? null,
      sport: item.sport || summary?.sport || null,
      surfaces: item.surfaces || null,
      wayTypes: item.wayTypes || null,
      surfaceSegments: item.surfaceSegments || null,
      wayTypeSegments: item.wayTypeSegments || null,
      directions: item.directions || null,
    },
  });
}

/**
 * Displays a failed Komoot import and preserves its diagnostic error message.
 * @param {Error} error Error raised while importing Komoot tours.
 * @param {object} state Trailthread application state containing proxy diagnostics.
 * @param {() => void} clearKomootProgress Hides the import progress indicator.
 * @param {() => void} renderProxy Refreshes the proxy diagnostics.
 * @param {(message: string, error?: boolean) => void} setKomootStatus Displays Komoot workspace feedback.
 * @returns {void} Does not return a value.
 */
function handleKomootImportError(error, state, clearKomootProgress, renderProxy, setKomootStatus) {
  clearKomootProgress();
  state.proxy.lastError = error.message;
  renderProxy();
  setKomootStatus(error.message, true);
}

/**
 * Imports selected Komoot tours through the legacy local proxy into Trailthread's library.
 * @param {object} dependencies Services supplied by Trailthread's main application module.
 * @param {object} dependencies.state Trailthread application state.
 * @param {() => object|null} dependencies.activeAccount Returns the selected Komoot account.
 * @param {() => Promise<boolean>} dependencies.checkProxy Confirms that the local proxy is available.
 * @param {(account: object) => Promise<void>} dependencies.ensureProxyAccountLogin Authenticates the selected account.
 * @param {(path: string, options: object) => Promise<object>} dependencies.proxyRequest Requests the legacy proxy.
 * @param {(options: object) => object} dependencies.buildTrackRecord Builds Trailthread's normalized track record.
 * @param {(records: object[], replaceExisting: boolean) => Promise<{imported: number}>} dependencies.importTrackRecords Stores imported records.
 * @param {() => string} dependencies.language Returns the active language code.
 * @param {() => {importing: string, done: string}} dependencies.progressText Resolves translated progress labels.
 * @param {(label: string, value?: number, indeterminate?: boolean) => void} dependencies.setKomootProgress Displays import progress.
 * @param {() => void} dependencies.clearKomootProgress Hides the import progress indicator.
 * @param {(message: string, error?: boolean) => void} dependencies.setKomootStatus Displays Komoot workspace feedback.
 * @param {(key: string, values?: object) => string} dependencies.translate Resolves a translated user-facing message.
 * @param {() => void} dependencies.renderProxy Refreshes the proxy diagnostics.
 * @returns {Promise<void>} Resolves after import feedback has been rendered.
 */
export async function importKomootSelection(dependencies) {
  const {
    state,
    activeAccount,
    checkProxy,
    ensureProxyAccountLogin,
    proxyRequest,
    buildTrackRecord,
    importTrackRecords,
    language,
    progressText,
    setKomootProgress,
    clearKomootProgress,
    setKomootStatus,
    translate,
    renderProxy,
  } = dependencies;
  const context = getKomootImportContext(state, activeAccount, translate, setKomootStatus);

  if (!context) {
    return;
  }

  const proxyIsAvailable = await checkProxy();
  if (!proxyIsAvailable) {
    return;
  }

  try {
    setKomootProgress(progressText().importing, 15, false);
    await ensureProxyAccountLogin(context.account);

    setKomootProgress(progressText().importing, 35, false);
    const payload = await proxyRequest('/import', {
      method: 'POST',
      body: {
        language: language(),
        tourIds: context.tourIds,
      },
    });

    setKomootProgress(progressText().importing, 80, false);
    const toursById = new Map(state.komootTours.map((tour) => [tour.id, tour]));
    const records = payload.items.map((item) => buildKomootImportTrackRecord(item, toursById, context.account, buildTrackRecord));
    const result = await importTrackRecords(records, true);

    setKomootProgress(progressText().done, 100, false);
    setKomootStatus(translate('komootImported', { count: result.imported }));
    window.setTimeout(clearKomootProgress, 500);
  } catch (error) {
    handleKomootImportError(error, state, clearKomootProgress, renderProxy, setKomootStatus);
  }
}
