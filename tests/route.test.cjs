const test = require('node:test');
const assert = require('node:assert/strict');
const { game, hooks, make } = require('./helpers.cjs');

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

test('foreshore plates only frame the pier approach; the deck is its own scenery', () => {
  const { plateWeight, ZONES, PIER_DECK, ROUTE_CARDS } = game.route;
  const at = (id, f) => { const z = ZONES.find((x) => x.id === id); return z.start + z.px * f; };
  assert.equal(plateWeight(at('shops', 0.2)), 0);
  assert.ok(plateWeight(at('shops', 0.999)) > 0.9, 'fades in at the end of the strip');
  assert.equal(plateWeight(at('pier', 0.1)), 1);
  assert.equal(plateWeight(at('pier', PIER_DECK - 0.01)), 1);
  assert.equal(plateWeight(at('pier', 0.6)), 0, 'out over the water the plates are gone');
  assert.equal(plateWeight(at('caravan_return', 0.01)), 0);
  const withArt = ROUTE_CARDS.filter((c) => c.src);
  assert.ok(withArt.length >= 3);
  assert.ok(withArt.every((c) => c.src.startsWith('/moss/source/04_STREET_BACKGROUNDS/')));
});
