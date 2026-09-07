const OSM_OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const OSM_ANALYSIS_SAMPLE_DISTANCE_M = 160;
const OSM_ANALYSIS_MAX_SAMPLES = 300;
const OSM_ANALYSIS_QUERY_CHUNK_SIZE = 60;
const OSM_ANALYSIS_MATCH_DISTANCE_M = 55;
const OSM_ANALYSIS_RETRY_DELAY_MS = 30000;

/**
 * Builds evenly spaced reference points so a long track does not create one OSM request per GPX point.
 * @param {Array<object>} points Track points with latitude and longitude values.
 * @param {(from: object, to: object) => number} haversine Calculates the distance between two track points in kilometers.
 * @returns {Array<{pointIndex: number, lat: number, lng: number}>} Bounded set of valid route reference points.
 */
function buildOsmAnalysisSamples(points, haversine) {
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
 * @param {(key: string, values?: object) => string} translate Resolves a translated user-facing message.
 * @returns {string} Localized explanation with a safe next action.
 */
function osmWayTypesRequestError(status, translate) {
  if (status === 429) return translate('osmWayTypesRateLimited');
  if (status === 406) return translate('osmWayTypesRequestRejected');
  if (status >= 500) return translate('osmWayTypesServiceUnavailable');
  return translate('osmWayTypesRequestFailed', { status });
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
 * @param {(key: string, values?: object) => string} translate Resolves a translated user-facing message.
 * @param {(message: string, error?: boolean, persistent?: boolean) => void} setStatus Displays analysis feedback.
 * @returns {Promise<Array<object>>} OSM way elements with tags and geometry.
 */
async function fetchOsmWayTypeWays(samples, translate, setStatus) {
  const url = `${OSM_OVERPASS_ENDPOINT}?data=${encodeURIComponent(buildOsmWayTypeQuery(samples))}`;
  let retryAvailable = true;
  while (true) {
    const response = await fetch(url, { cache: 'no-store' });
    if (response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        throw new Error(translate('osmWayTypesInvalidResponse'));
      }
      if (!Array.isArray(payload?.elements)) throw new Error(translate('osmWayTypesInvalidResponse'));
      return payload.elements.filter((element) => element?.type === 'way' && element?.tags?.highway && Array.isArray(element?.geometry));
    }
    const canRetry = response.status === 429 || response.status === 406;
    if (!canRetry || !retryAvailable) throw new Error(osmWayTypesRequestError(response.status, translate));
    retryAvailable = false;
    setStatus(translate('osmWayTypesWaitingToRetry'), false, true);
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
 * @param {(value: unknown) => string} cleanText Normalizes the OSM highway tag.
 * @returns {string|null} OSM highway value, or null when no way is close enough.
 */
function closestOsmWayType(sample, ways, cleanText) {
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
 * @param {(segments: object[]) => object[]} normalizeRangeSegments Normalizes track segment ranges.
 * @returns {Array<object>} Normalized point-indexed way-type segments.
 */
function buildOsmWayTypeSegments(matches, pointCount, complete, normalizeRangeSegments) {
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
 * Persists complete or partial OSM way-type segments and refreshes the affected Trailthread views.
 * @param {object} dependencies Services supplied by Trailthread's main application module.
 * @param {object} track Track receiving the derived OSM data.
 * @param {Array<object>} samples All reference points planned for the analysis.
 * @param {Array<{pointIndex: number, value: string|null}>} matches Successfully processed OSM matches.
 * @param {number} totalGroups Number of query groups planned for the analysis.
 * @param {boolean} complete Whether all query groups completed.
 * @returns {Promise<{track: object, segments: Array<object>}|null>} Stored result, or null without usable segments.
 */
async function persistOsmWayTypeAnalysis(dependencies, track, samples, matches, totalGroups, complete) {
  const wayTypeSegments = buildOsmWayTypeSegments(matches, track.points.length, complete, dependencies.normalizeRangeSegments);
  if (!wayTypeSegments.length) return null;
  const updatedTrack = dependencies.touchTrack(track, {
    wayTypes: dependencies.segmentValues(wayTypeSegments),
    wayTypeSegments,
    osmWayTypeAnalysis: {
      source: 'openstreetmap',
      analyzedAt: dependencies.isoNow(),
      sampledPoints: samples.length,
      matchedPoints: matches.filter((match) => !!match.value).length,
      processedGroups: Math.ceil(matches.length / OSM_ANALYSIS_QUERY_CHUNK_SIZE),
      totalGroups,
      complete,
    },
  });
  await dependencies.putTrack(updatedTrack);
  dependencies.state.tracks = dependencies.state.tracks.map((item) => {
    if (item.id === updatedTrack.id) return updatedTrack;
    return item;
  });
  dependencies.state.selectedTrackIds.add(updatedTrack.id);
  dependencies.state.highlightedTrackId = updatedTrack.id;
  if (!dependencies.state.settings.segmentOverlayMode) {
    dependencies.state.settings.segmentOverlayMode = true;
  }
  await dependencies.saveSettings();
  dependencies.renderAll();
  dependencies.syncMapForSelectionChange();
  if (dependencies.state.trackDetailUi.trackId === updatedTrack.id) dependencies.renderTrackDetailDialog();
  return { track: updatedTrack, segments: wayTypeSegments };
}

/**
 * Loads OSM highway types for one local track and persists complete or useful partial segment data.
 * @param {object} dependencies Services supplied by Trailthread's main application module.
 * @param {string} trackId Identifier of the track selected in the library.
 * @returns {Promise<void>} Resolves after the analysis result or error state is rendered.
 */
export async function analyseTrackWayTypesFromOsm(dependencies, trackId) {
  const track = dependencies.state.tracks.find((item) => item.id === trackId);
  if (!track) return;
  const samples = buildOsmAnalysisSamples(track.points, dependencies.haversine);
  if (samples.length < 2) {
    dependencies.setStatus(dependencies.translate('osmWayTypesNeedsTrack'), true);
    return;
  }
  dependencies.setOsmAnalysisTrackId(trackId);
  dependencies.renderLibrary();
  dependencies.renderTrackDetailDialog();
  const matches = [];
  const chunks = splitOsmAnalysisSamples(samples);
  try {
    for (let index = 0; index < chunks.length; index += 1) {
      dependencies.setStatus(dependencies.translate('osmWayTypesProgress', { current: index + 1, total: chunks.length }), false, true);
      const ways = await fetchOsmWayTypeWays(chunks[index], dependencies.translate, dependencies.setStatus);
      chunks[index].forEach((sample) => {
        matches.push({ pointIndex: sample.pointIndex, value: closestOsmWayType(sample, ways, dependencies.cleanText) });
      });
    }
    const result = await persistOsmWayTypeAnalysis(dependencies, track, samples, matches, chunks.length, true);
    if (!result) {
      dependencies.setStatus(dependencies.translate('osmWayTypesNoMatch'), true);
      return;
    }
    dependencies.setStatus(dependencies.translate('osmWayTypesDone', {
      count: result.track.wayTypes.length,
      segments: result.segments.length,
      matched: result.track.osmWayTypeAnalysis.matchedPoints,
      sampled: result.track.osmWayTypeAnalysis.sampledPoints,
    }));
  } catch (error) {
    const hasCompleteExistingAnalysis = !!track.osmWayTypeAnalysis && track.osmWayTypeAnalysis.complete !== false;
    let partialResult = null;
    if (!hasCompleteExistingAnalysis) partialResult = await persistOsmWayTypeAnalysis(dependencies, track, samples, matches, chunks.length, false);
    if (partialResult) {
      dependencies.setStatus(dependencies.translate('osmWayTypesPartialSaved', {
        count: partialResult.track.wayTypes.length,
        segments: partialResult.segments.length,
        processed: partialResult.track.osmWayTypeAnalysis.processedGroups,
        total: partialResult.track.osmWayTypeAnalysis.totalGroups,
      }), true);
      return;
    }
    dependencies.setStatus(error?.message || dependencies.translate('osmWayTypesFailed'), true);
  } finally {
    dependencies.setOsmAnalysisTrackId(null);
    dependencies.renderLibrary();
    dependencies.renderTrackDetailDialog();
  }
}
