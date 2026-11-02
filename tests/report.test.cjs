const test = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./helpers.cjs');

const { report } = game;

test('report limits no longer claim shipped features are missing', () => {
  const limits = report.REPORT.limits.join(' ');
  assert.doesNotMatch(limits, /no cream-hoodie skin|no bonus-world door|not tapped on a physical phone\./);
  assert.match(limits, /cream hoodie/i);
  assert.match(limits, /bonus-world door/i);
  assert.match(limits, /checked at phone viewports in the browser/);
});

test('report is honest that no recorded soundtrack ships', () => {
  assert.match(report.REPORT.limits.join(' '), /No recorded soundtrack ships/);
});

test('coaching copy matches the P3.1 miss rules (no give-way, misses stumble)', () => {
  const all = [...report.REPORT.made, ...report.REPORT.tests].join(' ');
  assert.doesNotMatch(all, /give-way|does not stumble|does not play the stumble/);
  assert.match(all, /halves FLOW/);
  assert.match(all, /10% (of the )?Quake/);
  assert.match(all, /Street School/);
});
