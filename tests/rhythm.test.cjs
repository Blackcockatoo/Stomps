const test = require('node:test');
const assert = require('node:assert/strict');
const { game, make } = require('./helpers.cjs');

const { calibrateOffset, CALIBRATION_MIN_TAPS, CALIBRATION_WARMUP } = game.rhythm;
const BEAT = 60 / 104;
const taps = (count, late, jitter = () => 0) => Array.from({ length: count }, (_, i) => (i + 1) * BEAT + late + jitter(i));

test('rhythm result reports judgements', () => {
  let result;
  const rhythm = make({ onResult: (r) => (result = r) });
  rhythm.counts = { perfect: 4, fresh: 3, late: 2, stumble: 1 };
  rhythm.finishRhythm();
  assert.equal(result.kind, 'rhythm');
  assert.equal(result.perfect, 4);
});

test('calibration: consistent late taps shift the highway earlier', () => {
  const cal = calibrateOffset(taps(12, 0.045), BEAT);
  assert.equal(cal.offset, -0.045);
  assert.equal(cal.used, 12 - CALIBRATION_WARMUP);
  assert.ok(cal.reliable);
  assert.equal(calibrateOffset(taps(12, -0.03), BEAT).offset, 0.03, 'early taps shift later');
  assert.equal(calibrateOffset(taps(12, 0), BEAT).offset, 0);
});

test('calibration: robust to warm-up and a stray tap, clamps, flags noise', () => {
  const series = taps(12, 0.02);
  series[0] += 0.25; // warm-up taps are ignored
  series[7] += 0.2; // one outlier does not move the median
  assert.equal(calibrateOffset(series, BEAT).offset, -0.02);
  assert.equal(calibrateOffset(taps(12, 0.2), BEAT).offset, -0.12, 'clamped to ±120 ms');
  const noisy = calibrateOffset(taps(12, 0, (i) => (i % 2 ? 0.14 : -0.14)), BEAT);
  assert.equal(noisy.reliable, false);
  assert.equal(calibrateOffset(taps(CALIBRATION_WARMUP + CALIBRATION_MIN_TAPS - 1, 0), BEAT), null, 'too few taps');
});

test('arcade calibration session collects taps and does not auto-apply', () => {
  const counts = [];
  const a = make({ onCalTap: (n) => counts.push(n) });
  a.mode = 'menu';
  a.startCalibration();
  for (const t of taps(10, 0.03)) { a.groove.t = t; a.calibrationTap(); }
  assert.deepEqual(counts, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const cal = a.stopCalibration();
  assert.equal(cal.offset, -0.03);
  assert.equal(a.audioOffset, 0, 'result is offered, not applied');
  assert.equal(a.calibrationTap(), 0, 'taps after stop are ignored');
  a.setAudioOffset(cal.offset);
  assert.equal(a.audioOffset, -0.03);
});

test('a hook that ends calibration mid-tap does not crash', () => {
  let a;
  a = make({ onCalTap: (n) => n === 3 && a.stopCalibration() });
  a.mode = 'menu';
  a.startCalibration();
  assert.equal(a.calibrationTap(), 1);
  assert.equal(a.calibrationTap(), 2);
  assert.doesNotThrow(() => assert.equal(a.calibrationTap(), 3));
  assert.equal(a.calTaps, null);
});
