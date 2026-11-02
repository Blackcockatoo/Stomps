const test = require('node:test');
const assert = require('node:assert/strict');
const { hooks, make } = require('./helpers.cjs');

test('route completion freezes and reports', () => {
  let result, mode;
  const route = make({ onResult: (r) => (result = r), onMode: (m) => (mode = m) });
  route.runKind = 'route';
  route.scroll = 1e6;
  route.streetPerfect = 3;
  route.streetGood = 2;
  route.streetMiss = 1;
  route.tick(1 / 120);
  assert.equal(mode, 'result');
  assert.equal(result.kind, 'route');
  assert.equal(result.perfect, 3);
  assert.equal(result.stumble, 1);
  assert.equal(route.keys.size, 0);
  const frozen = route.scroll;
  route.tick(0.1);
  assert.equal(route.scroll, frozen, 'finished route freezes');
});

test('practice is isolated from bests and recognises combos', () => {
  const practice = make();
  practice.runKind = 'practice';
  practice.score = 99999;
  practice.tick(0.01);
  assert.equal(practice.bestStrut, 0, 'practice must not overwrite free strut best');
  let move;
  practice.hooks = { ...hooks, onPractice: (name) => (move = name) };
  practice.commitSingle('A');
  practice.now += 0.25;
  practice.commitSingle('A');
  practice.now += 0.25;
  practice.commitSingle('B');
  assert.equal(move, 'HEEL-TOE HAMMER');
});
