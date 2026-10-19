import assert from 'node:assert/strict';
import { applyFitSensorMergePlan, createFitSensorMergePlan } from '../modules/fit-sensor-merge.js';

/**
 * Creates an ISO timestamp offset from a fixed reference time.
 * @param {number} seconds Offset in seconds.
 * @returns {string} ISO timestamp for the test sample.
 */
function testTime(seconds) {
  return new Date(Date.UTC(2026, 0, 1, 12, 0, seconds)).toISOString();
}

const track = {
  id: 'test-track',
  points: [
    { time: testTime(0), heartRateBpm: 120 },
    { time: testTime(10) },
    { time: testTime(20) },
    { time: testTime(90) },
  ],
};
const samples = [
  { time: testTime(1), heartRateBpm: 121, cadenceRpm: 81 },
  { time: testTime(11), heartRateBpm: 125, cadenceRpm: 85, temperatureC: 18 },
  { time: testTime(21), heartRateBpm: 128, cadenceRpm: 89, temperatureC: 19 },
];
const plan = await createFitSensorMergePlan(track.points, samples, 5000);

assert.equal(plan.fields.heartRateBpm.transferableCount, 2);
assert.equal(plan.fields.heartRateBpm.skippedExistingCount, 1);
assert.equal(plan.fields.cadenceRpm.transferableCount, 3);
assert.equal(plan.fields.temperatureC.transferableCount, 2);
assert.equal(plan.fields.cadenceRpm.assignments.some((assignment) => assignment.pointIndex === 3), false);
await assert.rejects(() => createFitSensorMergePlan([{ time: 'invalid' }], samples), /Zeitstempel/);

const timezoneTrack = [{ time: testTime(0) }, { time: testTime(10) }];
const timezoneSamples = [{ time: new Date(Date.parse(testTime(0)) - (2 * 60 * 60 * 1000)).toISOString(), cadenceRpm: 80 }];
const timezonePlan = await createFitSensorMergePlan(timezoneTrack, timezoneSamples, 5000);
assert.equal(timezonePlan.timeOffsetMs, 2 * 60 * 60 * 1000);
assert.equal(timezonePlan.fields.cadenceRpm.transferableCount, 1);

const positionTrack = [
  { time: testTime(0), lat: 51.5, lng: 7.4 },
  { time: testTime(10), lat: 51.5005, lng: 7.4005 },
  { time: testTime(20), lat: 51.501, lng: 7.401 },
  { time: testTime(30), lat: 51.5015, lng: 7.4015 },
];
const positionSamples = positionTrack.map((point) => ({
  time: new Date(Date.parse(point.time) - (20 * 60 * 60 * 1000)).toISOString(),
  lat: point.lat,
  lng: point.lng,
  temperatureC: 20,
}));
const positionPlan = await createFitSensorMergePlan(positionTrack, positionSamples, 5000);
assert.equal(positionPlan.timeOffsetMs, 0);
assert.equal(positionPlan.matchMode, 'position');
assert.equal(positionPlan.fields.temperatureC.transferableCount, 4);

const merged = applyFitSensorMergePlan(track, plan, ['heartRateBpm', 'cadenceRpm'], { fileName: 'sensor.fit', importedAt: testTime(30) });
assert.equal(merged.points[0].heartRateBpm, 120);
assert.equal(merged.points[1].heartRateBpm, 125);
assert.equal(merged.points[2].cadenceRpm, 89);
assert.equal(merged.points[3].cadenceRpm, undefined);
assert.equal(merged.sensorImports.length, 1);
assert.deepEqual(merged.sensorImports[0].fields, ['heartRateBpm', 'cadenceRpm']);

console.log('FIT sensor merge contract check passed.');
