export const FIT_SENSOR_FIELDS = Object.freeze([
  'heartRateBpm',
  'cadenceRpm',
  'temperatureC',
]);

/**
 * Parses a timestamp into milliseconds since the Unix epoch.
 * @param {unknown} value ISO timestamp or Date-compatible value.
 * @returns {number|null} Parsed timestamp, or null when it is invalid.
 */
function timestampMs(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return timestamp;
}

/**
 * Returns a finite numeric sensor value.
 * @param {unknown} value Candidate sensor value.
 * @returns {number|null} Numeric value, or null when it is unavailable.
 */
function sensorValue(value) {
  if (!Number.isFinite(value)) return null;
  return Number(value);
}

/**
 * Collects and orders usable sensor samples for one sensor field.
 * @param {object[]} samples Decoded FIT samples with time and sensor values.
 * @param {string} field Sensor field to collect.
 * @param {number} timeOffsetMs Detected source-time offset to apply before matching.
 * @returns {Array<{timeMs: number, value: number}>} Chronologically ordered samples.
 */
function samplesForField(samples, field, timeOffsetMs) {
  const result = [];
  samples.forEach((sample) => {
    const timeMs = timestampMs(sample?.time);
    const value = sensorValue(sample?.[field]);
    if (timeMs == null || value == null) return;
    result.push({ timeMs: timeMs + timeOffsetMs, value });
  });
  result.sort((first, second) => first.timeMs - second.timeMs);
  return result;
}

/**
 * Detects a likely whole-hour timezone offset between a track and FIT sensor samples.
 * @param {Array<{timeMs: number}>} targetPoints Timestamped target track points.
 * @param {object[]} samples Decoded FIT sensor samples.
 * @returns {number} Offset in milliseconds, or zero without a clear timezone pattern.
 */
function detectedTimezoneOffset(targetPoints, samples) {
  const sourceTimes = samples.map((sample) => timestampMs(sample?.time)).filter((timeMs) => timeMs != null);
  if (!sourceTimes.length) return 0;
  const targetStart = targetPoints[0].timeMs;
  const sourceStart = Math.min(...sourceTimes);
  const rawOffset = targetStart - sourceStart;
  const hourMs = 60 * 60 * 1000;
  const roundedOffset = Math.round(rawOffset / hourMs) * hourMs;
  if (Math.abs(roundedOffset) > 14 * hourMs) return 0;
  if (Math.abs(roundedOffset) < hourMs) return 0;
  if (Math.abs(rawOffset - roundedOffset) > 10 * 60 * 1000) return 0;
  return roundedOffset;
}

/**
 * Estimates the distance between two geographic points for route matching.
 * @param {object} first First point with latitude and longitude.
 * @param {object} second Second point with latitude and longitude.
 * @returns {number} Approximate distance in meters.
 */
function geographicDistanceMeters(first, second) {
  const latitudeScale = 111320;
  const averageLatitude = ((first.lat + second.lat) / 2) * (Math.PI / 180);
  const latitudeDelta = (first.lat - second.lat) * latitudeScale;
  const longitudeDelta = (first.lng - second.lng) * latitudeScale * Math.cos(averageLatitude);
  return Math.hypot(latitudeDelta, longitudeDelta);
}

/**
 * Yields long-running matching work so browser status updates can render.
 * @returns {Promise<void>} Resolves on the next animation frame or timer turn.
 */
function yieldToRendering() {
  return new Promise((resolve) => {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => resolve());
      return;
    }
    globalThis.setTimeout(resolve, 0);
  });
}

/**
 * Determines a timestamp offset from matching FIT and track GPS positions.
 * @param {Array<{timeMs: number, point: object}>} targetPoints Timestamped target route points.
 * @param {object[]} samples Decoded FIT sensor samples with optional coordinates.
 * @param {(progress: {phase: string, current: number, total: number}) => void} [onProgress] Optional progress callback.
 * @returns {number|null} Median position-derived offset, or null without enough close matches.
 */
async function offsetFromMatchingPositions(targetPoints, samples, onProgress) {
  const offsets = [];
  const stride = Math.max(1, Math.floor(samples.length / 250));
  const total = Math.ceil(samples.length / stride);
  let current = 0;
  for (let index = 0; index < samples.length; index += stride) {
    current += 1;
    if (onProgress) onProgress({ phase: 'gps', current, total });
    const sample = samples[index];
    const sourceTime = timestampMs(sample?.time);
    if (sourceTime == null || !Number.isFinite(sample?.lat) || !Number.isFinite(sample?.lng)) continue;
    let nearest = null;
    targetPoints.forEach((target) => {
      if (!Number.isFinite(target.point?.lat) || !Number.isFinite(target.point?.lng)) return;
      const distance = geographicDistanceMeters(sample, target.point);
      if (!nearest || distance < nearest.distance) nearest = { distance, timeMs: target.timeMs };
    });
    if (nearest && nearest.distance <= 100) offsets.push(nearest.timeMs - sourceTime);
    if (current % 8 === 0) await yieldToRendering();
  }
  if (offsets.length < 4) return null;
  offsets.sort((first, second) => first - second);
  return offsets[Math.floor(offsets.length / 2)];
}

/**
 * Finds the nearest chronologically ordered sample for one target timestamp.
 * @param {Array<{timeMs: number, value: number}>} samples Ordered sensor samples.
 * @param {number} targetTimeMs Timestamp to match.
 * @returns {{timeMs: number, value: number}|null} Nearest sample, or null without samples.
 */
function nearestSample(samples, targetTimeMs) {
  if (!samples.length) return null;
  let low = 0;
  let high = samples.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (samples[middle].timeMs < targetTimeMs) low = middle + 1;
    else high = middle;
  }
  const after = samples[low] || null;
  const before = samples[low - 1] || null;
  if (!before) return after;
  if (!after) return before;
  if (Math.abs(before.timeMs - targetTimeMs) <= Math.abs(after.timeMs - targetTimeMs)) return before;
  return after;
}

/**
 * Creates a compact spatial index for quickly finding nearby track points.
 * @param {Array<{index: number, point: object}>} targetPoints Track points available for spatial matching.
 * @returns {Map<string, Array<{index: number, point: object}>>} Grid cells containing nearby points.
 */
function createTrackPointGrid(targetPoints) {
  const grid = new Map();
  targetPoints.forEach((target) => {
    if (!Number.isFinite(target.point?.lat) || !Number.isFinite(target.point?.lng)) return;
    const latitudeCell = Math.floor(target.point.lat * 1000);
    const longitudeCell = Math.floor(target.point.lng * 1000);
    const key = `${latitudeCell}:${longitudeCell}`;
    const entries = grid.get(key) || [];
    entries.push(target);
    grid.set(key, entries);
  });
  return grid;
}

/**
 * Finds the closest indexed track point around one FIT GPS sample.
 * @param {object} sample FIT sample with latitude and longitude.
 * @param {Map<string, Array<{index: number, point: object}>>} grid Spatial track-point index.
 * @returns {{index: number, point: object, distance: number}|null} Closest candidate within nearby grid cells.
 */
function nearestTrackPointByPosition(sample, grid) {
  if (!Number.isFinite(sample?.lat) || !Number.isFinite(sample?.lng)) return null;
  const latitudeCell = Math.floor(sample.lat * 1000);
  const longitudeCell = Math.floor(sample.lng * 1000);
  let nearest = null;
  for (let latitudeOffset = -1; latitudeOffset <= 1; latitudeOffset += 1) {
    for (let longitudeOffset = -1; longitudeOffset <= 1; longitudeOffset += 1) {
      const entries = grid.get(`${latitudeCell + latitudeOffset}:${longitudeCell + longitudeOffset}`) || [];
      entries.forEach((target) => {
        const distance = geographicDistanceMeters(sample, target.point);
        if (!nearest || distance < nearest.distance) nearest = { ...target, distance };
      });
    }
  }
  return nearest;
}

/**
 * Builds non-overwriting sensor assignments by matching FIT and track GPS positions.
 * @param {Array<{index: number, point: object}>} targetPoints Existing track points.
 * @param {object[]} samples Decoded FIT sensor samples.
 * @param {(progress: {phase: string, current: number, total: number}) => void} [onProgress] Optional progress callback.
 * @returns {Promise<object>} Per-field assignments and the count of spatially matched source samples.
 */
async function positionSensorAssignments(targetPoints, samples, onProgress) {
  const grid = createTrackPointGrid(targetPoints);
  const candidates = {};
  FIT_SENSOR_FIELDS.forEach((field) => {
    candidates[field] = new Map();
  });
  let positionMatchCount = 0;
  for (let index = 0; index < samples.length; index += 1) {
    if (onProgress && (index === 0 || (index + 1) % 100 === 0 || index + 1 === samples.length)) onProgress({ phase: 'gps', current: index + 1, total: samples.length });
    const sample = samples[index];
    const target = nearestTrackPointByPosition(sample, grid);
    if (!target || target.distance > 100) continue;
    positionMatchCount += 1;
    FIT_SENSOR_FIELDS.forEach((field) => {
      const value = sensorValue(sample[field]);
      if (value == null || sensorValue(target.point[field]) != null) return;
      const current = candidates[field].get(target.index);
      if (!current || target.distance < current.distance) candidates[field].set(target.index, { pointIndex: target.index, value, sourceTime: sample.time, distance: target.distance });
    });
    if ((index + 1) % 200 === 0) await yieldToRendering();
  }
  const fields = {};
  FIT_SENSOR_FIELDS.forEach((field) => {
    const sourceCount = samplesForField(samples, field, 0).length;
    let skippedExistingCount = 0;
    targetPoints.forEach((target) => {
      if (sensorValue(target.point[field]) != null) skippedExistingCount += 1;
    });
    const assignments = [...candidates[field].values()].sort((first, second) => first.pointIndex - second.pointIndex);
    fields[field] = { sourceCount, matchedCount: assignments.length + skippedExistingCount, skippedExistingCount, transferableCount: assignments.length, assignments };
  });
  return { positionMatchCount, fields };
}

/**
 * Creates a non-destructive plan for adding FIT sensor values to existing track points.
 * @param {object[]} trackPoints Existing Trailthread route points with timestamps.
 * @param {object[]} samples Decoded FIT samples with timestamps and optional sensor values.
 * @param {number} [toleranceMs=30000] Maximum permitted timestamp difference per value.
 * @param {(progress: {phase: string, current: number, total: number}) => void} [onProgress] Optional progress callback.
 * @returns {Promise<object>} Field summaries and point assignments that never overwrite existing values.
 */
export async function createFitSensorMergePlan(trackPoints, samples, toleranceMs = 30000, onProgress) {
  const targetPoints = [];
  trackPoints.forEach((point, index) => {
    const timeMs = timestampMs(point?.time);
    targetPoints.push({ index, timeMs, point });
  });
  if (!targetPoints.length) throw new Error('Der ausgewählte Track enthält keine Punkte.');
  const positionPlan = await positionSensorAssignments(targetPoints, samples, onProgress);
  if (positionPlan.positionMatchCount >= 4) {
    return { toleranceMs, timeOffsetMs: 0, timeOffsetSource: 'position', matchMode: 'position', targetPointCount: targetPoints.length, fields: positionPlan.fields };
  }
  const timedTargetPoints = targetPoints.filter((target) => target.timeMs != null);
  if (!timedTargetPoints.length) throw new Error('Der ausgewählte Track enthält keine gültigen Zeitstempel oder passenden GPS-Positionen.');
  let timeOffsetMs = await offsetFromMatchingPositions(timedTargetPoints, samples, onProgress);
  let timeOffsetSource = 'position';
  if (timeOffsetMs == null) {
    timeOffsetMs = detectedTimezoneOffset(timedTargetPoints, samples);
    timeOffsetSource = 'timezone';
  }
  const fields = {};
  FIT_SENSOR_FIELDS.forEach((field) => {
    const sourceSamples = samplesForField(samples, field, timeOffsetMs);
    const assignments = [];
    let matched = 0;
    let skippedExisting = 0;
    timedTargetPoints.forEach((target) => {
      const source = nearestSample(sourceSamples, target.timeMs);
      if (!source) return;
      if (Math.abs(source.timeMs - target.timeMs) > toleranceMs) return;
      matched += 1;
      if (sensorValue(target.point[field]) != null) {
        skippedExisting += 1;
        return;
      }
      assignments.push({ pointIndex: target.index, value: source.value, sourceTime: new Date(source.timeMs).toISOString() });
    });
    fields[field] = {
      sourceCount: sourceSamples.length,
      matchedCount: matched,
      skippedExistingCount: skippedExisting,
      transferableCount: assignments.length,
      assignments,
    };
  });
  return { toleranceMs, timeOffsetMs, timeOffsetSource, matchMode: 'time', targetPointCount: timedTargetPoints.length, fields };
}

/**
 * Applies selected sensor assignments to a copy of one track and records local provenance.
 * @param {object} track Existing Trailthread track.
 * @param {object} plan Merge plan from createFitSensorMergePlan.
 * @param {string[]} fields Sensor fields selected by the user.
 * @param {object} source Local FIT source metadata for the import history.
 * @returns {object} Updated track copy with sensor values and one import-history entry.
 */
export function applyFitSensorMergePlan(track, plan, fields, source) {
  const points = (track.points || []).map((point) => ({ ...point }));
  const applied = {};
  fields.forEach((field) => {
    const assignments = plan?.fields?.[field]?.assignments || [];
    let count = 0;
    assignments.forEach((assignment) => {
      const point = points[assignment.pointIndex];
      if (!point || sensorValue(point[field]) != null) return;
      point[field] = assignment.value;
      count += 1;
    });
    applied[field] = count;
  });
  const importedFields = fields.filter((field) => applied[field] > 0);
  const sensorImports = Array.isArray(track.sensorImports) ? [...track.sensorImports] : [];
  if (importedFields.length) {
    sensorImports.push({
      source: 'fit',
      fileName: String(source?.fileName || ''),
      importedAt: String(source?.importedAt || new Date().toISOString()),
      toleranceMs: plan.toleranceMs,
      timeOffsetMs: plan.timeOffsetMs,
      fields: importedFields,
      pointsUpdated: applied,
    });
  }
  return { ...track, points, sensorImports, sensorMergeApplied: applied };
}
