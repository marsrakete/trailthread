import FitParser, { FitBaseType, FitEncoder } from './vendor/fit-file-parser/fit-parser.js';

const SEMICIRCLES_PER_DEGREE = 2147483648 / 180;
const SPORT_TYPES = { cycling: 2, touringbicycle: 2, mountainbiking: 2, running: 1, hiking: 17, walking: 11 };

/**
 * Normalizes a decoded FIT coordinate to geographic degrees.
 * The bundled parser already returns degrees, while direct FIT decoders may return semicircles.
 * @param {number} value Decoded FIT coordinate in degrees or semicircles.
 * @param {number} limit Maximum absolute degree value for the coordinate axis.
 * @returns {number|null} Geographic degrees or null for an invalid value.
 */
function degreesFromFitCoordinate(value, limit) {
  if (!Number.isFinite(value)) return null;
  if (Math.abs(value) <= limit) return value;
  const degrees = value / SEMICIRCLES_PER_DEGREE;
  if (Math.abs(degrees) > limit) return null;
  return degrees;
}

/**
 * Converts geographic degrees into a FIT semicircle coordinate.
 * @param {number} value Geographic degrees.
 * @returns {number} FIT coordinate in semicircles.
 */
function semicirclesFromDegrees(value) {
  return Math.round(value * SEMICIRCLES_PER_DEGREE);
}

/**
 * Returns a finite sensor value without changing the source value.
 * @param {unknown} value Candidate sensor value.
 * @returns {number|null} Finite numeric value or null.
 */
function finiteValue(value) {
  if (Number.isFinite(value)) return Number(value);
  return null;
}

/**
 * Formats a point timestamp as ISO text for Trailthread's existing GPX parser.
 * @param {unknown} value FIT timestamp value.
 * @returns {string|null} ISO timestamp or null.
 */
function fitTimestampToIso(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date.toISOString();
  return null;
}

/**
 * Escapes text included in generated GPX XML.
 * @param {unknown} value Text to escape.
 * @returns {string} XML-safe text.
 */
function escapeXml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

/**
 * Converts decoded FIT record messages into Trailthread-compatible route points.
 * @param {object[]} records Decoded FIT record messages.
 * @returns {object[]} Route points with optional sensor values.
 */
function routePointsFromFitRecords(records) {
  const points = [];
  records.forEach((record) => {
    const lat = degreesFromFitCoordinate(record.position_lat, 90);
    const lng = degreesFromFitCoordinate(record.position_long, 180);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const point = { lat, lng, ele: finiteValue(record.altitude), time: fitTimestampToIso(record.timestamp) };
    const heartRate = finiteValue(record.heart_rate);
    const cadence = finiteValue(record.cadence);
    const temperature = finiteValue(record.temperature);
    if (heartRate != null) point.heartRateBpm = heartRate;
    if (cadence != null) point.cadenceRpm = cadence;
    if (temperature != null) point.temperatureC = temperature;
    points.push(point);
  });
  return points;
}

/**
 * Creates lean GPX XML so FIT imports use Trailthread's established track parser.
 * @param {string} name Track name.
 * @param {object[]} points Geographic track points.
 * @returns {string} GPX document.
 */
function gpxFromPoints(name, points) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<gpx version="1.1" creator="Trailthread" xmlns="http://www.topografix.com/GPX/1/1">', '  <trk>', `    <name>${escapeXml(name)}</name>`, '    <trkseg>'];
  points.forEach((point) => {
    lines.push(`      <trkpt lat="${point.lat.toFixed(6)}" lon="${point.lng.toFixed(6)}">`);
    if (point.ele != null) lines.push(`        <ele>${point.ele.toFixed(1)}</ele>`);
    if (point.time) lines.push(`        <time>${escapeXml(point.time)}</time>`);
    lines.push('      </trkpt>');
  });
  lines.push('    </trkseg>', '  </trk>', '</gpx>');
  return lines.join('\n');
}

/**
 * Decodes a FIT file and returns a normal Trailthread route import payload.
 * @param {File} file FIT activity file selected by the user.
 * @returns {Promise<{name: string, gpxText: string, points: object[], dateStart: string|null, sport: string|null}>} Decoded track payload.
 */
export async function importFitActivity(file) {
  const parser = new FitParser({ force: false, mode: 'list', temperatureUnit: 'celsius', lengthUnit: 'km' });
  const data = await parser.parseAsync(await file.arrayBuffer());
  const points = routePointsFromFitRecords(data.records || []);
  if (points.length < 2) throw new Error('Die FIT-Datei enthält keine GPS-Route mit mindestens zwei Punkten.');
  const session = data.sessions?.[0] || {};
  let name = file.name.replace(/\.fit$/i, '');
  if (session.name) name = String(session.name);
  const dateStart = points.find((point) => point.time)?.time || fitTimestampToIso(session.start_time);
  return { name, gpxText: gpxFromPoints(name, points), points, dateStart, sport: session.sport || null };
}

/**
 * Returns a valid FIT timestamp for an exported Trailthread point.
 * @param {object} track Trailthread track.
 * @param {object} point Track point.
 * @param {number} index Point position in the route.
 * @returns {Date} Timestamp used by the FIT encoder.
 */
function exportTimestamp(track, point, index) {
  const pointDate = new Date(point.time);
  if (!Number.isNaN(pointDate.getTime())) return pointDate;
  const trackDate = new Date(track.dateStart);
  if (!Number.isNaN(trackDate.getTime())) return new Date(trackDate.getTime() + (index * 1000));
  return new Date(Date.now() + (index * 1000));
}

/**
 * Builds a field descriptor for the generic FIT encoder.
 * @param {number} number FIT field number.
 * @param {number} size Byte size.
 * @param {number} baseType FIT base type.
 * @param {number} value Raw FIT value.
 * @returns {object} Encoder field descriptor.
 */
function field(number, size, baseType, value) {
  return { number, size, baseType, value };
}

/**
 * Encodes a Trailthread route as a standard FIT activity file.
 * @param {object} track Trailthread track with at least two route points.
 * @returns {Uint8Array} Encoded FIT activity bytes.
 */
export function exportFitActivity(track) {
  let points = [];
  if (Array.isArray(track.points)) {
    points = track.points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  }
  if (points.length < 2) throw new Error('Für den FIT-Export braucht ein Track mindestens zwei GPS-Punkte.');
  const encoder = new FitEncoder();
  const firstTime = exportTimestamp(track, points[0], 0);
  const lastTime = exportTimestamp(track, points.at(-1), points.length - 1);
  const durationMs = Math.max(1000, lastTime.getTime() - firstTime.getTime());
  const first = points[0];
  const last = points.at(-1);
  const sport = SPORT_TYPES[String(track.sport || '').toLowerCase()] || 0;
  encoder.writeMessage(0, [field(0, 1, FitBaseType.Enum, 4), field(1, 2, FitBaseType.Uint16, 255), field(2, 2, FitBaseType.Uint16, 1), field(4, 4, FitBaseType.Uint32, FitEncoder.toFitTimestamp(new Date()))]);
  points.forEach((point, index) => {
    const fields = [field(0, 4, FitBaseType.Sint32, semicirclesFromDegrees(point.lat)), field(1, 4, FitBaseType.Sint32, semicirclesFromDegrees(point.lng)), field(253, 4, FitBaseType.Uint32, FitEncoder.toFitTimestamp(exportTimestamp(track, point, index)))];
    if (Number.isFinite(point.ele)) fields.push(field(2, 2, FitBaseType.Uint16, Math.round((point.ele + 500) * 5)));
    if (Number.isFinite(point.heartRateBpm)) fields.push(field(3, 1, FitBaseType.Uint8, Math.round(point.heartRateBpm)));
    if (Number.isFinite(point.cadenceRpm)) fields.push(field(4, 1, FitBaseType.Uint8, Math.round(point.cadenceRpm)));
    if (Number.isFinite(point.temperatureC)) fields.push(field(13, 1, FitBaseType.Sint8, Math.round(point.temperatureC)));
    encoder.writeMessage(20, fields, 1);
  });
  const duration = Math.round(durationMs);
  const distance = Math.round((Number(last.cumulativeKm) || 0) * 100000);
  const summary = [field(2, 4, FitBaseType.Uint32, FitEncoder.toFitTimestamp(firstTime)), field(5, 1, FitBaseType.Enum, sport), field(7, 4, FitBaseType.Uint32, duration), field(8, 4, FitBaseType.Uint32, duration), field(9, 4, FitBaseType.Uint32, distance), field(253, 4, FitBaseType.Uint32, FitEncoder.toFitTimestamp(lastTime))];
  encoder.writeMessage(19, summary, 2);
  encoder.writeMessage(18, summary, 3);
  encoder.writeMessage(34, [field(0, 4, FitBaseType.Uint32, duration), field(1, 2, FitBaseType.Uint16, 1), field(2, 1, FitBaseType.Enum, 0), field(253, 4, FitBaseType.Uint32, FitEncoder.toFitTimestamp(lastTime))], 4);
  return encoder.close();
}
