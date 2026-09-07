/**
 * Creates the controller for Trailthread's Replay workspace.
 * @param {object} dependencies Shared state, DOM elements and application helpers.
 * @param {object} dependencies.state Trailthread application state.
 * @param {object} dependencies.el Replay-related document elements.
 * @param {string} dependencies.tileUrl OpenStreetMap tile URL for the 2D replay map.
 * @param {number} dependencies.replayTimeScale Replay speed multiplier for time-based tracks.
 * @param {number} dependencies.replayDistanceSeconds Target seconds for one distance-based replay.
 * @param {(track: object) => string} dependencies.trackSourceLabel Resolves an imported track source label.
 * @param {(value: unknown) => number | null} dependencies.parsePointTime Parses a track point timestamp.
 * @param {(left: object, right: object) => number} dependencies.haversine Calculates point distance in kilometres.
 * @param {(previous: object, next: object) => number} dependencies.bearingDegrees Calculates a route bearing.
 * @param {(points: object[], index: number) => number} dependencies.profileGradeAtPoint Calculates local track grade.
 * @param {(value: number, minimum: number, maximum: number) => number} dependencies.clamp Limits a numeric value.
 * @param {(photo: object) => number[] | null} dependencies.photoLatLng Resolves photo coordinates.
 * @param {(directions: object[]) => object[]} dependencies.normalizeDirections Normalizes imported directions.
 * @param {(value: number) => string} dependencies.fmtNum Formats a number.
 * @param {(seconds: number) => string} dependencies.fmtElapsedShort Formats elapsed time.
 * @param {(kilometres: number) => string} dependencies.fmtKm Formats a distance.
 * @param {(metres: number) => string} dependencies.fmtMeters Formats elevation values.
 * @param {(kilometresPerHour: number) => string} dependencies.fmtHours Formats speed values.
 * @param {(percent: number) => string} dependencies.fmtGrade Formats gradient values.
 * @param {(value: string) => string} dependencies.fmtDate Formats a track date.
 * @param {(key: string, values?: object) => string} dependencies.translate Resolves translated copy.
 * @param {(track: object) => object | null} dependencies.trackBounds Builds map bounds for a track.
 * @param {(bearing: number) => string} dependencies.replayMarkerIconHtml Creates the replay marker content.
 * @param {(mode: string, view: string) => void} dependencies.applyReplayModeDefaults Applies compatible replay defaults.
 * @param {(view: string, mode: string) => number} dependencies.replayDefaultSpeed Resolves the default replay speed.
 * @param {() => void} dependencies.scheduleMapLayoutRefresh Refreshes map dimensions after layout changes.
 * @param {() => Promise<void>} dependencies.saveSettings Persists application settings.
 * @param {() => void} dependencies.renderWorkspace Renders the active workspace.
 * @returns {object} Replay operations used by the main application module.
 */
export function createReplayWorkspaceController(dependencies) {
  const {
    state, el, tileUrl, replayTimeScale, replayDistanceSeconds,
    trackSourceLabel, parsePointTime, haversine, bearingDegrees, profileGradeAtPoint,
    clamp, photoLatLng, normalizeDirections, fmtNum, fmtElapsedShort, fmtKm,
    fmtMeters, fmtHours, fmtGrade, fmtDate, translate: t, trackBounds,
    replayMarkerIconHtml, applyReplayModeDefaults, replayDefaultSpeed,
    scheduleMapLayoutRefresh, saveSettings, renderWorkspace,
  } = dependencies;
  const TILE_URL = tileUrl;
  const REPLAY_TIME_SCALE = replayTimeScale;
  const REPLAY_DISTANCE_SECONDS = replayDistanceSeconds;
function replayTrackSourceLabel(track) {
  return track?.accountLabel || trackSourceLabel(track?.source);
}
function buildReplayTrack(track) {
  if (!track?.points?.length) return null;
  const samples = track.points.map((point, index, points) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    let timeMs = null;
    if (point.time) timeMs = parsePointTime(point.time);
    let cumulativeKm = point.cumulativeKm;
    if (cumulativeKm == null) {
      cumulativeKm = 0;
      if (index) cumulativeKm = previous.cumulativeKm + haversine(previous, point);
    }
    return {
      index,
      lat: point.lat,
      lng: point.lng,
      ele: point.ele ?? null,
      cumulativeKm,
      timeMs,
      elapsedSec: null,
      bearing: bearingDegrees(previous, next),
      gradePercent: profileGradeAtPoint(points, index),
      pointIndex: index
    };
  });
  const firstTime = samples.find((sample) => sample.timeMs != null)?.timeMs ?? null;
  const rawHasTime = firstTime != null && samples.some((sample) => sample.timeMs != null && sample.timeMs !== firstTime);
  const totalDistanceKm = samples.at(-1)?.cumulativeKm ?? 0;
  let rawDurationSec = null;
  if (rawHasTime) rawDurationSec = Math.max(0, ((samples.at(-1)?.timeMs ?? firstTime) - firstTime) / 1000);
  let fallbackDurationSec = null;
  if (Number.isFinite(track?.durationHours) && track.durationHours > 0) fallbackDurationSec = track.durationHours * 3600;
  const shouldUseFallbackDuration = Number.isFinite(fallbackDurationSec) && fallbackDurationSec > 0 && (
    !rawHasTime ||
    !Number.isFinite(rawDurationSec) ||
    rawDurationSec <= 0 ||
    rawDurationSec > 172800 ||
    rawDurationSec > fallbackDurationSec * 4
  );
  const hasTime = rawHasTime || shouldUseFallbackDuration;
  if (shouldUseFallbackDuration && totalDistanceKm > 0) {
    samples.forEach((sample) => {
      sample.elapsedSec = (sample.cumulativeKm / totalDistanceKm) * fallbackDurationSec;
    });
  } else if (rawHasTime) {
    const knownTimedIndexes = samples
      .map((sample, index) => ({ sample, index }))
      .filter(({ sample }) => sample.timeMs != null)
      .map(({ index }) => index);
    samples.forEach((sample) => {
      sample.elapsedSec = null;
      if (sample.timeMs != null) sample.elapsedSec = Math.max(0, (sample.timeMs - firstTime) / 1000);
    });
    for (let anchorIndex = 0; anchorIndex < knownTimedIndexes.length - 1; anchorIndex += 1) {
      const startIndex = knownTimedIndexes[anchorIndex];
      const endIndex = knownTimedIndexes[anchorIndex + 1];
      const startSample = samples[startIndex];
      const endSample = samples[endIndex];
      const distanceSpan = Math.max(0.000001, (endSample.cumulativeKm ?? 0) - (startSample.cumulativeKm ?? 0));
      const timeSpan = Math.max(0, (endSample.elapsedSec ?? 0) - (startSample.elapsedSec ?? 0));
      for (let index = startIndex + 1; index < endIndex; index += 1) {
        const ratio = ((samples[index].cumulativeKm ?? 0) - (startSample.cumulativeKm ?? 0)) / distanceSpan;
        samples[index].elapsedSec = (startSample.elapsedSec ?? 0) + (timeSpan * clamp(ratio, 0, 1));
      }
    }
    const firstKnownIndex = knownTimedIndexes[0];
    for (let index = 0; index < firstKnownIndex; index += 1) {
      samples[index].elapsedSec = samples[firstKnownIndex].elapsedSec ?? 0;
    }
    const lastKnownIndex = knownTimedIndexes.at(-1);
    for (let index = lastKnownIndex + 1; index < samples.length; index += 1) {
      samples[index].elapsedSec = samples[lastKnownIndex].elapsedSec ?? 0;
    }
    let lastElapsed = 0;
    samples.forEach((sample) => {
      sample.elapsedSec = Math.max(lastElapsed, sample.elapsedSec ?? lastElapsed);
      lastElapsed = sample.elapsedSec;
    });
  } else {
    samples.forEach((sample) => {
      sample.elapsedSec = sample.cumulativeKm;
    });
  }
  const photoMarkers = (track.photos ?? []).map((photo, photoIndex) => {
    const latLng = photoLatLng(photo);
    if (!latLng) return null;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    samples.forEach((sample, sampleIndex) => {
      const delta = Math.hypot(sample.lat - latLng[0], sample.lng - latLng[1]);
      if (delta < bestDistance) {
        bestDistance = delta;
        bestIndex = sampleIndex;
      }
    });
    return { photoIndex, sampleIndex: bestIndex, distanceKm: samples[bestIndex]?.cumulativeKm ?? 0 };
  }).filter(Boolean);
  const normalizedDirections = normalizeDirections(track.directions);
  let cumulativeDirectionKm = 0;
  const directionMarkers = normalizedDirections.map((direction, directionIndex) => {
    if (Number.isFinite(direction.prefixDistanceM) && direction.prefixDistanceM > 0) {
      cumulativeDirectionKm += Number(direction.prefixDistanceM) / 1000;
    }
    const distanceKm = clamp(cumulativeDirectionKm, 0, totalDistanceKm);
    if (Number.isFinite(direction.distanceM)) {
      cumulativeDirectionKm += Math.max(0, Number(direction.distanceM)) / 1000;
    } else if (totalDistanceKm) {
      cumulativeDirectionKm = ((directionIndex + 1) / Math.max(1, normalizedDirections.length + 1)) * totalDistanceKm;
    }
    const sampleIndex = samples.reduce((best, sample, index) => {
      if (Math.abs((sample.cumulativeKm ?? 0) - distanceKm) < Math.abs((samples[best]?.cumulativeKm ?? 0) - distanceKm)) return index;
      return best;
    }, 0);
    return {
      directionIndex,
      sampleIndex,
      distanceKm,
      instruction: direction.instruction,
      type: direction.type || null
    };
  }).filter(Boolean);
  const replayTrack = {
    trackId: track.id,
    track,
    samples,
    totalDistanceKm,
    totalDurationSec: totalDistanceKm,
    totalAscentM: track.elevationGainM ?? 0,
    totalDescentM: track.elevationLossM ?? 0,
    modeAvailable: { time: hasTime, distance: true },
    photoMarkers,
    directionMarkers
  };
  if (hasTime) replayTrack.totalDurationSec = samples.at(-1)?.elapsedSec ?? 0;
  return replayTrack;
}
function nextReplayDirection(replayTrack, frame) {
  if (!replayTrack?.directionMarkers?.length || !frame) return null;
  return replayTrack.directionMarkers.find((item) => item.distanceKm >= ((frame.cumulativeKm ?? 0) - 0.02)) ?? replayTrack.directionMarkers.at(-1) ?? null;
}
function replayDirectionText(replayTrack, frame) {
  const nextDirection = nextReplayDirection(replayTrack, frame);
  if (!nextDirection?.instruction) return '-';
  const remainingKm = Math.max(0, (nextDirection.distanceKm ?? 0) - (frame?.cumulativeKm ?? 0));
  const remainingMeters = Math.round(remainingKm * 1000);
  if (remainingMeters > 30) return `${nextDirection.instruction} · ${t('replayDirectionIn', { distance: `${fmtNum(remainingMeters)} m` })}`;
  return nextDirection.instruction;
}
function interpolateReplaySample(left, right, ratio) {
  const safeRatio = clamp(ratio, 0, 1);
  const lerp = (a, b) => a + (b - a) * safeRatio;
  let elevation = left.ele ?? right.ele ?? null;
  if (left.ele != null && right.ele != null) elevation = lerp(left.ele, right.ele);
  return {
    lat: lerp(left.lat, right.lat),
    lng: lerp(left.lng, right.lng),
    ele: elevation,
    cumulativeKm: lerp(left.cumulativeKm, right.cumulativeKm),
    elapsedSec: lerp(left.elapsedSec ?? 0, right.elapsedSec ?? 0),
    bearing: lerp(left.bearing ?? 0, right.bearing ?? 0),
    gradePercent: lerp(left.gradePercent ?? 0, right.gradePercent ?? 0),
    pointIndex: right.pointIndex,
    sampleIndex: left.index
  };
}
function replayFrameAtCursor(replayTrack, mode, cursor) {
  if (!replayTrack?.samples?.length) return null;
  let metric = 'cumulativeKm';
  if (mode === 'time' && replayTrack.modeAvailable.time) metric = 'elapsedSec';
  const samples = replayTrack.samples;
  const clampedCursor = clamp(cursor, 0, replayMetricMax(replayTrack, mode));
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    if (clampedCursor <= current[metric]) {
      const span = (current[metric] - previous[metric]) || 1;
      const ratio = (clampedCursor - previous[metric]) / span;
      return interpolateReplaySample(previous, current, ratio);
    }
  }
  const last = samples.at(-1);
  return { ...last, sampleIndex: last.index };
}
function replayMetricMax(replayTrack, mode = state.replay.mode) {
  if (!replayTrack) return 0;
  if (mode === 'time' && replayTrack.modeAvailable.time) return replayTrack.totalDurationSec;
  return replayTrack.totalDistanceKm;
}
function replayMetricLabel(replayTrack, cursor, mode = state.replay.mode) {
  if (mode === 'time' && replayTrack?.modeAvailable.time) return fmtElapsedShort(cursor);
  return `${fmtKm(cursor)} km`;
}
function replayCursorForMode(replayTrack, targetMode, referenceFrame) {
  if (!replayTrack || !referenceFrame) return 0;
  if (targetMode === 'time' && replayTrack.modeAvailable.time) return clamp(referenceFrame.elapsedSec ?? 0, 0, replayTrack.totalDurationSec);
  return clamp(referenceFrame.cumulativeKm ?? 0, 0, replayTrack.totalDistanceKm);
}
/**
 * Selects the most suitable track for opening the replay workspace.
 * @returns {object|null} Highlighted, favorite, selected, active, or first stored track.
 */
function replayCandidateTrack() {
  const highlighted = state.tracks.find((track) => track.id === state.highlightedTrackId) ?? null;
  if (highlighted) return highlighted;
  const favorite = state.tracks.find((track) => track.favorite) ?? null;
  if (favorite) return favorite;
  const selected = state.tracks.find((track) => state.selectedTrackIds.has(track.id)) ?? null;
  if (selected) return selected;
  if (state.replay.activeTrackId) return state.tracks.find((track) => track.id === state.replay.activeTrackId) ?? null;
  return state.tracks[0] ?? null;
}
function replaySeekValueFromDistance(distanceKm) {
  if (!state.replay.replayTrack) return 0;
  if (state.replay.mode !== 'time' || !state.replay.replayTrack.modeAvailable.time) return distanceKm;
  const sample = state.replay.replayTrack.samples.reduce((best, current) => {
    const currentDistance = Math.abs(current.cumulativeKm - distanceKm);
    const bestDistance = Math.abs(best.cumulativeKm - distanceKm);
    if (currentDistance < bestDistance) return current;
    return best;
  }, state.replay.replayTrack.samples[0]);
  return sample?.elapsedSec ?? 0;
}
function replayDistanceFromProfileEvent(event) {
  const replayTrack = state.replay.replayTrack;
  if (!replayTrack?.samples?.length || !el.replayProfileChart) return null;
  const rect = el.replayProfileChart.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  return ratio * (replayTrack.totalDistanceKm || 0);
}
function clearReplay2DScene() {
  if (!state.replay.layers2d) return;
  Object.values(state.replay.layers2d).forEach((layer) => {
    if (!layer) return;
    try {
      layer.remove?.();
    } catch {}
  });
  state.replay.layers2d = {};
}
function clearReplay3DScene() {
  if (state.replayMap3dReady && state.replayMap3d) {
    state.replayMap3d.getSource('replay-route')?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
    state.replayMap3d.getSource('replay-played')?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
    state.replayMap3d.getSource('replay-photos')?.setData({ type: 'FeatureCollection', features: [] });
  }
  state.replay.marker3d?.setLngLat([10.4, 51.2]);
}
function clearReplayScene() {
  clearReplay2DScene();
  clearReplay3DScene();
}
function ensureReplayMaps() {
  if (!state.replayMap2d && el.replayMap2d) {
    state.replayMap2d = L.map(el.replayMap2d, { zoomControl: true, attributionControl: true }).setView([51.2, 10.4], 6);
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(state.replayMap2d);
  }
  if (!state.replayMap3d && el.replayMap3d && window.maplibregl) {
    state.replayMap3d = new window.maplibregl.Map({
      container: el.replayMap3d,
      center: [10.4, 51.2],
      zoom: 6,
      pitch: 62,
      bearing: 0,
      maxZoom: 18,
      maxPitch: 85,
      style: {
        version: 8,
        sources: {
          osm: { type: 'raster', tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '&copy; OpenStreetMap Contributors', maxzoom: 19 },
          terrainSource: { type: 'raster-dem', url: 'https://tiles.mapterhorn.com/tilejson.json', attribution: '<a href="https://mapterhorn.com/attribution" target="_blank" rel="noopener noreferrer">&copy; Mapterhorn</a>' },
          hillshadeSource: { type: 'raster-dem', url: 'https://tiles.mapterhorn.com/tilejson.json', attribution: '<a href="https://mapterhorn.com/attribution" target="_blank" rel="noopener noreferrer">&copy; Mapterhorn</a>' }
        },
        layers: [
          { id: 'osm', type: 'raster', source: 'osm' },
          { id: 'hills', type: 'hillshade', source: 'hillshadeSource', layout: { visibility: 'visible' }, paint: { 'hillshade-shadow-color': '#473B24' } }
        ],
        terrain: { source: 'terrainSource', exaggeration: 1.55 },
        sky: {}
      }
    });
    state.replayMap3d.addControl(new window.maplibregl.NavigationControl({ visualizePitch: true, showZoom: true, showCompass: true }));
    state.replayMap3d.on('load', () => {
      state.replayMap3dReady = true;
      ensureReplay3DSources();
      updateReplayScene();
    });
  } else if (!window.maplibregl && el.replayMap3d && !el.replayMap3d.textContent.trim()) {
    const template = document.querySelector('#replay-3d-placeholder-template');
    const fragment = template.content.cloneNode(true);
    fragment.querySelector('.replay-placeholder-note').textContent = t('replayUnavailable3d');
    el.replayMap3d.append(fragment);
  }
}
function ensureReplay3DSources() {
  if (!state.replayMap3dReady || !state.replayMap3d) return;
  const map = state.replayMap3d;
  if (!map.getSource('replay-route')) {
    map.addSource('replay-route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });
    map.addLayer({ id: 'replay-route', type: 'line', source: 'replay-route', paint: { 'line-color': '#9ed5b0', 'line-width': 4.5, 'line-opacity': 0.78 } });
  }
  if (!map.getSource('replay-played')) {
    map.addSource('replay-played', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });
    map.addLayer({ id: 'replay-played', type: 'line', source: 'replay-played', paint: { 'line-color': '#ff2a1a', 'line-width': 6, 'line-opacity': 1 } });
  }
  if (!map.getSource('replay-photos')) {
    map.addSource('replay-photos', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'replay-photos', type: 'circle', source: 'replay-photos', paint: { 'circle-radius': 4, 'circle-color': '#f8fbfa', 'circle-stroke-width': 2, 'circle-stroke-color': '#14201d' } });
  }
  if (!state.replay.marker3d) {
    const markerEl = document.createElement('div');
    markerEl.className = 'replay-maplibre-marker';
    state.replay.marker3d = new window.maplibregl.Marker({ element: markerEl }).setLngLat([10.4, 51.2]).addTo(map);
  }
}
function fitReplayMaps(replayTrack) {
  const bounds = trackBounds(replayTrack?.track);
  if (bounds && state.replayMap2d) state.replayMap2d.fitBounds(bounds.pad(0.08));
  if (replayTrack?.samples?.length && state.replayMap3dReady && state.replayMap3d) {
    const coordinates = replayTrack.samples.map((sample) => [sample.lng, sample.lat]);
    const lngLatBounds = coordinates.reduce((acc, coordinate) => acc.extend(coordinate), new window.maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
    state.replayMap3d.fitBounds(lngLatBounds, { padding: 56, pitch: 70, bearing: 12, duration: 0 });
  }
}
function replayPlayedLatLngs(replayTrack, frame) {
  if (!replayTrack || !frame) return [];
  const points = replayTrack.track.points.filter((point) => (point.cumulativeKm ?? 0) <= frame.cumulativeKm).map((point) => [point.lat, point.lng]);
  points.push([frame.lat, frame.lng]);
  return points;
}
function replayRouteCoordinates(replayTrack) {
  return replayTrack?.track?.points?.map((point) => [point.lng, point.lat]) ?? [];
}
function replay2DTarget(replayTrack, frame) {
  if (!replayTrack || !frame) return null;
  if (state.replay.cameraMode2d === 'overview') {
    const bounds = trackBounds(replayTrack.track);
    let center = L.latLng(frame.lat, frame.lng);
    if (bounds) center = bounds.getCenter();
    return { center, zoom: null, bounds };
  }
  if (state.replay.cameraMode2d === 'ahead') {
    const frameIndex = Math.max(0, Math.round(frame.sampleIndex ?? frame.pointIndex ?? 0));
    const lookAheadIndex = Math.min(replayTrack.samples.length - 1, frameIndex + 64);
    const lookAheadSample = replayTrack.samples[lookAheadIndex] ?? frame;
    return {
      center: L.latLng(
        frame.lat + ((lookAheadSample.lat ?? frame.lat) - frame.lat) * 0.9,
        frame.lng + ((lookAheadSample.lng ?? frame.lng) - frame.lng) * 0.9
      ),
      zoom: 13.2,
      bounds: null
    };
  }
  return { center: L.latLng(frame.lat, frame.lng), zoom: 17.5, bounds: null };
}
function applyReplay2DCamera(replayTrack = state.replay.replayTrack, frame = replayFrameAtCursor(state.replay.replayTrack, state.replay.mode, state.replay.cursor), options = {}) {
  const force = !!options.force;
  const animate = !!options.animate;
  if (!state.replayMap2d || !replayTrack || !frame) return;
  if (state.settings.activeWorkspace !== 'replay' || state.replay.view !== '2d') return;
  if (!force && !state.replay.followCamera) return;
  const target = replay2DTarget(replayTrack, frame);
  if (!target) return;
  if (target.bounds) {
    if (!force && state.replay.lastApplied2DMode === 'overview') return;
    let duration = 0;
    if (animate) duration = 0.45;
    state.replayMap2d.fitBounds(target.bounds.pad(0.22), { animate, duration });
    state.replay.lastApplied2DMode = 'overview';
    return;
  }
  const map = state.replayMap2d;
  const zoomTarget = target.zoom ?? state.replayMap2d.getZoom();
  const currentZoom = map.getZoom();
  state.replay.lastApplied2DMode = state.replay.cameraMode2d;
  if (force || Math.abs(currentZoom - zoomTarget) > 0.12) {
    let duration = 0;
    if (animate) duration = 0.45;
    map.setView(target.center, zoomTarget, { animate, duration });
    return;
  }
  const size = map.getSize();
  const markerPoint = map.latLngToContainerPoint([frame.lat, frame.lng]);
  let desiredX = size.x * 0.5;
  if (state.replay.cameraMode2d === 'ahead') desiredX = size.x * 0.34;
  const desiredY = size.y * 0.56;
  const deltaX = markerPoint.x - desiredX;
  const deltaY = markerPoint.y - desiredY;
  let deadZoneX = Math.max(40, size.x * 0.06);
  if (state.replay.cameraMode2d === 'ahead') deadZoneX = Math.max(56, size.x * 0.09);
  const deadZoneY = Math.max(28, size.y * 0.08);
  if (!force && Math.abs(deltaX) <= deadZoneX && Math.abs(deltaY) <= deadZoneY) return;
  map.panBy([deltaX, deltaY], { animate: false, duration: 0 });
}
function refreshReplay2DCamera(options = {}) {
  const replayTrack = state.replay.replayTrack;
  const frame = replayFrameAtCursor(replayTrack, state.replay.mode, state.replay.cursor);
  if (!state.replayMap2d || !replayTrack || !frame || state.replay.view !== '2d') return;
  state.replayMap2d.invalidateSize(false);
  applyReplay2DCamera(replayTrack, frame, options);
  window.requestAnimationFrame(() => {
    if (!state.replayMap2d || state.replay.view !== '2d') return;
    state.replayMap2d.invalidateSize(false);
    applyReplay2DCamera(replayTrack, replayFrameAtCursor(replayTrack, state.replay.mode, state.replay.cursor), { ...options, animate: false, force: true });
  });
}
function setReplayCameraMode2d(mode, options = {}) {
  if (!mode) return;
  state.replay.cameraMode2d = mode;
  state.replay.lastApplied2DMode = null;
  state.replay.last2DCameraAppliedAt = 0;
  renderReplayControls();
  refreshReplay2DCamera({ force: true, animate: options.animate !== false });
}
function syncReplay2DScene(replayTrack, frame) {
  if (!state.replayMap2d || !replayTrack || !frame) return;
  const map = state.replayMap2d;
  const routeLatLngs = replayTrack.track.points.map((point) => [point.lat, point.lng]);
  if (!state.replay.layers2d.route) {
    state.replay.layers2d.route = L.polyline(routeLatLngs, { color: '#9ed5b0', weight: 5, opacity: 0.66, lineCap: 'round', lineJoin: 'round' }).addTo(map);
    state.replay.layers2d.played = L.polyline(replayPlayedLatLngs(replayTrack, frame), { color: '#ff2a1a', weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(map);
      state.replay.layers2d.marker = L.marker([frame.lat, frame.lng], { icon: L.divIcon({ className: 'replay-marker-wrap', html: replayMarkerIconHtml(frame.bearing), iconSize: [22, 22], iconAnchor: [11, 11] }), zIndexOffset: 1000 }).addTo(map);
      state.replay.layers2d.photos = L.layerGroup().addTo(map);
    } else {
      state.replay.layers2d.route.setLatLngs(routeLatLngs);
      state.replay.layers2d.played.setLatLngs(replayPlayedLatLngs(replayTrack, frame));
      state.replay.layers2d.marker.setLatLng([frame.lat, frame.lng]);
      state.replay.layers2d.marker.setIcon(L.divIcon({ className: 'replay-marker-wrap', html: replayMarkerIconHtml(frame.bearing), iconSize: [22, 22], iconAnchor: [11, 11] }));
    }
  state.replay.layers2d.route?.bringToBack?.();
  state.replay.layers2d.played?.bringToFront?.();
  state.replay.layers2d.photos?.bringToFront?.();
  state.replay.layers2d.marker?.setZIndexOffset?.(1000);
  state.replay.layers2d.photos.clearLayers();
  if (state.replay.showPhotos) {
    (replayTrack.track.photos ?? []).forEach((photo) => {
      const latLng = photoLatLng(photo);
      if (!latLng) return;
      L.circleMarker(latLng, { radius: 4, color: '#14201d', weight: 2, fillColor: '#f8fbfa', fillOpacity: 1 }).addTo(state.replay.layers2d.photos);
    });
  }
  applyReplay2DCamera(replayTrack, frame, { animate: false });
}
function replay3DCamera(frame) {
  if (!frame) return { pitch: 70, zoom: 13.8, bearing: 0 };
  if (state.replay.cameraMode3d === 'top') return { pitch: 32, zoom: 13.45, bearing: 0 };
  if (state.replay.cameraMode3d === 'orbit') {
    let stableBearing = ((frame.bearing ?? 0) + 32) % 360;
    if (Number.isFinite(state.replay.replayTrack?.orbitBearing)) stableBearing = state.replay.replayTrack.orbitBearing;
    return { pitch: 72, zoom: 14.05, bearing: stableBearing };
  }
  return { pitch: 79, zoom: 14.85, bearing: frame.bearing ?? 0 };
}
function syncReplay3DScene(replayTrack, frame) {
  if (!state.replayMap3dReady || !state.replayMap3d || !replayTrack || !frame) return;
  ensureReplay3DSources();
  const map = state.replayMap3d;
  map.getSource('replay-route')?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: replayRouteCoordinates(replayTrack) } });
  map.getSource('replay-played')?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: replayPlayedLatLngs(replayTrack, frame).map(([lat, lng]) => [lng, lat]) } });
  let photoFeatures = [];
  if (state.replay.showPhotos) {
    photoFeatures = (replayTrack.track.photos ?? []).map((photo) => {
      const latLng = photoLatLng(photo);
      if (!latLng) return null;
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [latLng[1], latLng[0]] }, properties: {} };
    }).filter(Boolean);
  }
  map.getSource('replay-photos')?.setData({ type: 'FeatureCollection', features: photoFeatures });
  state.replay.marker3d?.setLngLat([frame.lng, frame.lat]);
  if (state.settings.activeWorkspace === 'replay' && state.replay.view === '3d' && state.replay.followCamera) {
    const camera = replay3DCamera(frame);
    map.jumpTo({ center: [frame.lng, frame.lat], bearing: camera.bearing, pitch: camera.pitch, zoom: camera.zoom });
  }
}
/**
 * Renders Replay control states, including the single Play/Pause toggle action.
 * @returns {void}
 */
function renderReplayControls() {
  const replayTrack = state.replay.replayTrack;
  const hasTrack = !!replayTrack;
  const canUseTime = !!replayTrack?.modeAvailable.time;
  const is2d = state.replay.view === '2d';
  const isPlaying = !!state.replay.playing;
  const hasPhotos = !!replayTrack?.photoMarkers?.length;
  const hasElevation = !!replayTrack?.samples?.some((sample) => Number.isFinite(sample?.ele));
  el.replayViewButtons?.forEach((button) => {
    const active = button.dataset.replayView === state.replay.view;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (el.replaySpeedSelect) el.replaySpeedSelect.value = String(state.replay.speed);
  el.replayModeButtons?.forEach((button) => {
    const isTime = button.dataset.replayMode === 'time';
    const active = button.dataset.replayMode === state.replay.mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    button.disabled = !hasTrack || (isTime && !canUseTime);
  });
  if (el.replayCamera2dRow) el.replayCamera2dRow.hidden = !is2d;
  if (el.replayCamera3dRow) el.replayCamera3dRow.hidden = is2d;
  el.replayCamera2dButtons?.forEach((button) => {
    const mode = button.getAttribute('data-replay-camera-2d') || 'center';
    const active = mode === state.replay.cameraMode2d;
    button.classList.toggle('is-active', active);
    button.dataset.active = String(active);
    button.setAttribute('aria-pressed', String(active));
    button.style.background = '';
    button.style.borderColor = '';
    button.style.color = '';
    button.style.boxShadow = '';
    if (active) {
      button.style.background = 'linear-gradient(135deg, rgba(185, 224, 196, 0.98), rgba(142, 198, 160, 0.82))';
      button.style.borderColor = 'rgba(185, 224, 196, 0.9)';
      button.style.color = '#18302a';
      button.style.boxShadow = 'inset 0 0 0 1px rgba(255, 255, 255, 0.16), 0 10px 20px rgba(8, 16, 14, 0.22)';
    }
  });
  el.replayCameraButtons?.forEach((button) => {
    const active = button.dataset.replayCamera === state.replay.cameraMode3d;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  [el.replayRestartButton, el.replayPlayButton, el.replayBackButton, el.replayForwardButton, ...el.replayViewButtons, ...el.replayCamera2dButtons, ...el.replayCameraButtons].forEach((button) => {
    if (!button) return;
    button.disabled = !hasTrack;
  });
  if (el.replayJumpStartButton) el.replayJumpStartButton.disabled = !hasTrack;
  if (el.replayJumpEndButton) el.replayJumpEndButton.disabled = !hasTrack;
  if (el.replayJumpHighButton) el.replayJumpHighButton.disabled = !hasTrack || !hasElevation;
  if (el.replayJumpPhotoButton) el.replayJumpPhotoButton.disabled = !hasTrack || !hasPhotos;
  if (el.replayPlayButton) {
    const playIcon = el.replayPlayButton.querySelector('.replay-transport-icon-play');
    const pauseIcon = el.replayPlayButton.querySelector('.replay-transport-icon-pause');
    const toggleLabel = el.replayPlayButton.querySelector('.replay-playback-toggle-label');
    let actionLabel = t('replayPlay');
    if (isPlaying) actionLabel = t('replayPause');
    playIcon.hidden = isPlaying;
    pauseIcon.hidden = !isPlaying;
    toggleLabel.textContent = actionLabel;
    el.replayPlayButton.classList.toggle('is-playing', isPlaying);
    el.replayPlayButton.setAttribute('aria-pressed', String(isPlaying));
    el.replayPlayButton.setAttribute('aria-label', actionLabel);
    el.replayPlayButton.setAttribute('title', actionLabel);
  }
  if (el.replaySpeedSelect) el.replaySpeedSelect.disabled = !hasTrack;
  if (el.replayFollowCameraInput) el.replayFollowCameraInput.checked = !!state.replay.followCamera;
  if (el.replayShowPhotosInput) el.replayShowPhotosInput.checked = !!state.replay.showPhotos;
  if (el.replayShowProfileInput) el.replayShowProfileInput.checked = !!state.replay.showProfile;
  if (el.replayFollowCameraInput) el.replayFollowCameraInput.disabled = !hasTrack;
  if (el.replayShowPhotosInput) el.replayShowPhotosInput.disabled = !hasTrack;
  if (el.replayShowProfileInput) el.replayShowProfileInput.disabled = !hasTrack;
}
function buildReplayProfileGeometry(replayTrack) {
  const samples = replayTrack.samples;
  const width = 1000;
  const height = 260;
  const padding = { top: 10, right: 18, bottom: 18, left: 18 };
  const elevations = samples.map((sample) => sample.ele ?? replayTrack.track.elevationMinM ?? 0);
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const span = Math.max(1, max - min);
  let exaggeration = 1.12;
  if (span < 180) exaggeration = 1.3;
  if (span < 80) exaggeration = 1.55;
  if (span < 35) exaggeration = 1.85;
  const mid = (min + max) / 2;
  const midY = padding.top + ((height - padding.top - padding.bottom) / 2);
  const halfPlotHeight = (height - padding.top - padding.bottom) / 2;
  const xFor = (km) => padding.left + (km / Math.max(0.001, replayTrack.totalDistanceKm || 0.001)) * (width - padding.left - padding.right);
  const yFor = (ele) => {
    const normalized = ((ele - mid) / Math.max(span / 2, 1)) * exaggeration;
    const rawY = midY - (normalized * halfPlotHeight);
    return clamp(rawY, padding.top, height - padding.bottom);
  };
  return {
    key: `${replayTrack.track.id}:${replayTrack.samples.length}:${replayTrack.totalDistanceKm}:${replayTrack.track.color || ''}`,
    width,
    height,
    padding,
    min,
    xFor,
    yFor,
    polyline: samples.map((sample) => `${xFor(sample.cumulativeKm)},${yFor(sample.ele ?? min)}`).join(' ')
  };
}
function ensureReplayProfileGeometry(replayTrack) {
  if (!replayTrack) return null;
  const current = state.replay.profileRender;
  const nextKey = `${replayTrack.track.id}:${replayTrack.samples.length}:${replayTrack.totalDistanceKm}:${replayTrack.track.color || ''}`;
  if (current.key === nextKey && current.geometry) return current.geometry;
  const geometry = buildReplayProfileGeometry(replayTrack);
  state.replay.profileRender = { key: geometry.key, geometry };
  return geometry;
}
/**
 * Renders the static elevation-profile SVG elements from the replay chart template.
 * @param {object} replayTrack Replay data containing the track color.
 * @param {object} geometry Precalculated dimensions and profile coordinates.
 * @returns {void}
 */
function renderReplayProfileStaticChart(replayTrack, geometry) {
  const startX = geometry.padding.left;
  const startY = geometry.yFor(geometry.min);
  const fragment = el.replayProfileChartTemplate.content.cloneNode(true);
  const chartTemplate = fragment.querySelector('svg');
  const gridLine = chartTemplate.querySelector('.profile-grid-line');
  const profileLine = chartTemplate.querySelector('.profile-line');
  const hoverLine = chartTemplate.querySelector('.profile-hover-line');
  const hoverDot = chartTemplate.querySelector('.profile-hover-dot');
  const chartBottom = geometry.height - geometry.padding.bottom;
  const chartRight = geometry.width - geometry.padding.right;
  let trackColor = '#9ed5b0';
  if (replayTrack.track.color) trackColor = replayTrack.track.color;
  gridLine.setAttribute('x1', `${geometry.padding.left}`);
  gridLine.setAttribute('y1', `${chartBottom}`);
  gridLine.setAttribute('x2', `${chartRight}`);
  gridLine.setAttribute('y2', `${chartBottom}`);
  profileLine.setAttribute('points', geometry.polyline);
  profileLine.setAttribute('stroke', trackColor);
  hoverLine.setAttribute('x1', `${startX}`);
  hoverLine.setAttribute('y1', `${geometry.padding.top}`);
  hoverLine.setAttribute('x2', `${startX}`);
  hoverLine.setAttribute('y2', `${chartBottom}`);
  hoverDot.setAttribute('cx', `${startX}`);
  hoverDot.setAttribute('cy', `${startY}`);
  el.replayProfileChart.replaceChildren(...chartTemplate.children);
  el.replayProfileChart.dataset.geometryKey = geometry.key;
}
function updateReplayProfileCursor(geometry, frame) {
  let cursorX = geometry.padding.left;
  let cursorY = geometry.yFor(geometry.min);
  if (frame) {
    cursorX = geometry.xFor(frame.cumulativeKm);
    cursorY = geometry.yFor(frame.ele ?? geometry.min);
  }
  const cursorLine = el.replayProfileChart.querySelector('.profile-hover-line');
  const cursorDot = el.replayProfileChart.querySelector('.profile-hover-dot');
  if (cursorLine) {
    cursorLine.setAttribute('x1', `${cursorX}`);
    cursorLine.setAttribute('x2', `${cursorX}`);
  }
  if (cursorDot) {
    cursorDot.setAttribute('cx', `${cursorX}`);
    cursorDot.setAttribute('cy', `${cursorY}`);
  }
}
function renderReplayProfile() {
  const replayTrack = state.replay.replayTrack;
  const frame = replayFrameAtCursor(replayTrack, state.replay.mode, state.replay.cursor);
  const visible = !!(replayTrack && replayTrack.track.hasElevation && state.replay.showProfile);
  el.replayProfilePanel.hidden = !state.replay.showProfile;
  el.replayWorkspace?.classList.toggle('is-profile-collapsed', !state.replay.showProfile);
  if (el.replayProfileTrackName) el.replayProfileTrackName.textContent = replayTrack?.track?.name || '-';
  el.replayAscentValue.textContent = '-';
  el.replayDescentValue.textContent = '-';
  if (replayTrack?.track?.hasElevation) {
    el.replayAscentValue.textContent = fmtMeters(replayTrack.track.elevationGainM);
    el.replayDescentValue.textContent = fmtMeters(replayTrack.track.elevationLossM);
  }
  el.replaySpeedValue.textContent = '-';
  if (frame?.elapsedSec > 0 && frame?.cumulativeKm > 0) el.replaySpeedValue.textContent = fmtHours((frame.cumulativeKm / frame.elapsedSec) * 3600);
  el.replayPointValue.textContent = '-';
  if (replayTrack && frame) el.replayPointValue.textContent = `${fmtNum(Math.min(replayTrack.samples.length, Math.round(frame.pointIndex ?? 0) + 1))} / ${fmtNum(replayTrack.samples.length)}`;
  el.replayProfileEmpty.hidden = visible;
  el.replayProfileChartShell.hidden = !visible;
  if (!visible) {
    el.replayProfileEmpty.textContent = t('replayProfileHint');
    if (replayTrack && !replayTrack.track.hasElevation) el.replayProfileEmpty.textContent = t('profileHintNoElevation');
    el.replayProfileChart.replaceChildren();
    state.replay.profileRender = { key: null, geometry: null };
    return;
  }
  const geometry = ensureReplayProfileGeometry(replayTrack);
  if (!geometry) return;
  if (el.replayProfileChart.dataset.geometryKey !== geometry.key) renderReplayProfileStaticChart(replayTrack, geometry);
  updateReplayProfileCursor(geometry, frame);
}
function renderReplayTimeline() {}
function updateReplayReadouts(replayTrack, frame) {
  el.replayDistanceValue.textContent = '0.0 km';
  el.replayAltitudeValue.textContent = '-';
  el.replayGradeValue.textContent = '-';
  el.replayTimeValue.textContent = '--:--:--';
  if (frame) {
    el.replayDistanceValue.textContent = `${fmtKm(frame.cumulativeKm)} km`;
    el.replayGradeValue.textContent = fmtGrade(frame.gradePercent);
    el.replayTimeValue.textContent = fmtElapsedShort(frame.elapsedSec);
    if (frame.ele != null) el.replayAltitudeValue.textContent = fmtMeters(frame.ele);
  }
  if (el.replayDirectionValue) el.replayDirectionValue.textContent = replayDirectionText(replayTrack, frame);
}
function renderReplayDirectionOverlay(replayTrack, frame) {
  if (!el.replayDirectionOverlay || !el.replayDirectionOverlayIcon || !el.replayDirectionOverlayToggle) return;
  const collapsed = !!state.settings.replayDirectionOverlayCollapsed;
  el.replayDirectionOverlay.hidden = collapsed;
  el.replayDirectionOverlayIcon.hidden = !collapsed;
  let directionToggleLabel = t('replayDirectionHide');
  el.replayDirectionOverlayToggle.textContent = '–';
  if (collapsed) {
    el.replayDirectionOverlayToggle.textContent = '+';
    directionToggleLabel = t('replayDirectionShow');
  }
  el.replayDirectionOverlayToggle.setAttribute('aria-label', directionToggleLabel);
  el.replayDirectionOverlayToggle.setAttribute('title', directionToggleLabel);
  el.replayDirectionOverlayIcon.setAttribute('aria-label', t('replayDirectionShow'));
  el.replayDirectionOverlayIcon.setAttribute('title', t('replayDirectionShow'));
}
function renderReplayWorkspace() {
  const replayTrack = state.replay.replayTrack;
  const frame = replayFrameAtCursor(replayTrack, state.replay.mode, state.replay.cursor);
  el.replayMap2d.hidden = state.replay.view !== '2d';
  el.replayMap3d.hidden = state.replay.view !== '3d';
  renderReplayControls();
  if (!replayTrack || !frame) {
    state.replay.playing = false;
    cancelReplayLoop();
    el.replayTrackTitle.textContent = t('replayEmptyTitle');
    el.replayTrackSubtitle.textContent = t('replayEmptySubtitle');
    updateReplayReadouts(null, null);
    renderReplayDirectionOverlay(null, null);
    renderReplayTimeline();
    renderReplayProfile();
    clearReplayScene();
    return;
  }
  el.replayTrackTitle.textContent = replayTrack?.track?.name || t('replayEmptyTitle');
  if (replayTrack) {
    const sourceLabel = replayTrackSourceLabel(replayTrack.track);
    const accountLabel = replayTrack.track.accountLabel || '';
    const subtitleParts = [sourceLabel, fmtDate(replayTrack.track.dateStart)];
    if (accountLabel && accountLabel !== sourceLabel) subtitleParts.push(accountLabel);
    el.replayTrackSubtitle.textContent = subtitleParts.filter(Boolean).join(' · ');
  } else {
    el.replayTrackSubtitle.textContent = t('replayEmptySubtitle');
  }
  updateReplayReadouts(replayTrack, frame);
  renderReplayDirectionOverlay(replayTrack, frame);
  renderReplayTimeline();
  renderReplayProfile();
  updateReplayScene();
}
function updateReplayScene() {
  const replayTrack = state.replay.replayTrack;
  const frame = replayFrameAtCursor(replayTrack, state.replay.mode, state.replay.cursor);
  if (!replayTrack || !frame) {
    clearReplayScene();
    return;
  }
  if (state.replay.view === '2d') syncReplay2DScene(replayTrack, frame);
  if (state.replay.view === '3d') syncReplay3DScene(replayTrack, frame);
}
function cancelReplayLoop() {
  if (state.replay.rafId) cancelAnimationFrame(state.replay.rafId);
  state.replay.rafId = null;
  state.replay.lastFrameAt = 0;
}
function replayTick(timestamp) {
  if (!state.replay.playing || !state.replay.replayTrack) return;
  if (!state.replay.lastFrameAt) state.replay.lastFrameAt = timestamp;
  const deltaSec = (timestamp - state.replay.lastFrameAt) / 1000;
  state.replay.lastFrameAt = timestamp;
  const metricMax = replayMetricMax(state.replay.replayTrack, state.replay.mode);
  const distanceScale = Math.max(0.05, (state.replay.replayTrack.totalDistanceKm || 1) / REPLAY_DISTANCE_SECONDS);
  let increment = deltaSec * state.replay.speed * distanceScale;
  if (state.replay.mode === 'time') increment = deltaSec * state.replay.speed * REPLAY_TIME_SCALE;
  state.replay.cursor = clamp(state.replay.cursor + increment, 0, metricMax);
  if (state.replay.cursor >= metricMax) {
    state.replay.playing = false;
    renderReplayWorkspace();
    cancelReplayLoop();
    return;
  }
  const frame = replayFrameAtCursor(state.replay.replayTrack, state.replay.mode, state.replay.cursor);
  updateReplayReadouts(state.replay.replayTrack, frame);
  renderReplayProfile();
  updateReplayScene();
  state.replay.rafId = requestAnimationFrame(replayTick);
}
function setReplayPlaying(playing) {
  if (playing && !state.replay.replayTrack) return;
  state.replay.playing = playing;
  if (!playing) {
    cancelReplayLoop();
    renderReplayControls();
    return;
  }
  cancelReplayLoop();
  renderReplayControls();
  state.replay.rafId = requestAnimationFrame(replayTick);
}
function setReplayCursor(value) {
  state.replay.cursor = clamp(value, 0, replayMetricMax(state.replay.replayTrack, state.replay.mode));
  renderReplayWorkspace();
}
function jumpReplayTo(kind) {
  const replayTrack = state.replay.replayTrack;
  if (!replayTrack?.samples?.length) return;
  let targetFrame = replayTrack.samples[0];
  if (kind === 'end') {
    targetFrame = replayTrack.samples.at(-1);
  } else if (kind === 'highest') {
    targetFrame = replayTrack.samples.reduce((best, sample) => {
      const bestElevation = best.ele ?? Number.NEGATIVE_INFINITY;
      const sampleElevation = sample.ele ?? Number.NEGATIVE_INFINITY;
      if (sampleElevation > bestElevation) return sample;
      return best;
    }, replayTrack.samples[0]);
  } else if (kind === 'photo') {
    const currentFrame = replayFrameAtCursor(replayTrack, state.replay.mode, state.replay.cursor);
    const currentDistance = currentFrame?.cumulativeKm ?? 0;
    const marker = replayTrack.photoMarkers.find((item) => item.distanceKm >= currentDistance) ?? replayTrack.photoMarkers[0];
    if (marker) targetFrame = replayTrack.samples[marker.sampleIndex] ?? targetFrame;
  }
  setReplayPlaying(false);
  setReplayCursor(replayCursorForMode(replayTrack, state.replay.mode, targetFrame));
}
function resetReplayToStart() {
  setReplayPlaying(false);
  setReplayCursor(0);
}
function setReplayMode(mode) {
  const replayTrack = state.replay.replayTrack;
  const referenceFrame = replayFrameAtCursor(replayTrack, state.replay.mode, state.replay.cursor);
  state.replay.mode = 'distance';
  if (mode === 'time' && replayTrack?.modeAvailable.time) state.replay.mode = 'time';
  applyReplayModeDefaults(state.replay.mode, state.replay.view);
  state.replay.cursor = replayCursorForMode(replayTrack, state.replay.mode, referenceFrame);
  renderReplayWorkspace();
}
function setReplayView(view) {
  state.replay.view = '2d';
  if (view === '3d') state.replay.view = '3d';
  state.replay.mode = 'distance';
  applyReplayModeDefaults(state.replay.mode, state.replay.view);
  if (state.replay.view === '3d') {
    state.replay.cameraMode3d = 'follow';
  }
  el.replayMap2d.hidden = state.replay.view !== '2d';
  el.replayMap3d.hidden = state.replay.view !== '3d';
  ensureReplayMaps();
  scheduleMapLayoutRefresh();
  renderReplayWorkspace();
}
async function openReplayTrack(trackId) {
  const track = state.tracks.find((item) => item.id === trackId) ?? replayCandidateTrack();
  if (!track) return;
  ensureReplayMaps();
  state.replay.activeTrackId = trackId;
  state.replay.replayTrack = buildReplayTrack(track);
  if (!state.replay.replayTrack) return;
  state.replay.replayTrack.orbitBearing = (((state.replay.replayTrack.samples ?? []).find((sample) => Number.isFinite(sample?.bearing))?.bearing ?? 0) + 32) % 360;
  state.replay.activeTrackId = track.id;
  state.replay.mode = 'distance';
  state.replay.speed = replayDefaultSpeed(state.replay.view, state.replay.mode);
  state.replay.cameraMode3d = 'follow';
  state.replay.cursor = 0;
  state.replay.playing = false;
  cancelReplayLoop();
  state.settings.activeWorkspace = 'replay';
  await saveSettings();
  renderWorkspace();
  scheduleMapLayoutRefresh();
  fitReplayMaps(state.replay.replayTrack);
  renderReplayWorkspace();
}
/**
 * Renders the active Trailthread workspaces and their shared library state.
 * @returns {void} Does not return a value.
 */
  return {
    buildReplayTrack,
    cancelReplayLoop,
    ensureReplayMaps,
    jumpReplayTo,
    openReplayTrack,
    refreshReplay2DCamera,
    renderReplayControls,
    renderReplayWorkspace,
    replayDistanceFromProfileEvent,
    replayFrameAtCursor,
    replayMetricMax,
    replayCandidateTrack,
    replaySeekValueFromDistance,
    resetReplayToStart,
    setReplayCameraMode2d,
    setReplayCursor,
    setReplayMode,
    setReplayPlaying,
    setReplayView,
    updateReplayScene,
  };
}
