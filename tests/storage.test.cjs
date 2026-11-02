const test = require('node:test');
const assert = require('node:assert/strict');
const { game, make, memoryStorage, blockedStorage } = require('./helpers.cjs');

const { SAVE_KEY, loadSave, sanitize, resetBests, DEFAULT_KEYS } = game.storage;
const { rebind, codeLabel, keyBtn, keyLabel } = game.keys;

test('legacy v1 bests are scaled x10 into the versioned save', () => {
  global.localStorage = memoryStorage({ 'moss-stomper-best': JSON.stringify({ version: 1, strut: 90, rhythm: 80 }), 'moss-stomper-route-best': '70', 'moss-stomper-offset': '0.05' });
  const a = make();
  assert.equal(a.bestStrut, 900);
  assert.equal(a.bestRhythm, 800);
  assert.equal(a.bestRoute, 700);
  assert.equal(a.audioOffset, 0.05);
});

test('legacy v2 / hyper keys are not multiplied again; legacy keys are kept', () => {
  const s = memoryStorage({ 'moss-stomper-best': JSON.stringify({ version: 2, strut: 900, rhythm: 800 }), 'moss-stomper-route-best-hyper': '700' });
  global.localStorage = s;
  const a = make();
  assert.equal(a.bestStrut, 900, 'new scale is not multiplied again');
  assert.equal(a.bestRoute, 700);
  a.setAudio(0.5, true);
  const saved = JSON.parse(s.data.get(SAVE_KEY));
  assert.equal(saved.version, 1);
  assert.deepEqual(saved.best, { strut: 900, rhythm: 800, route: 700 });
  assert.deepEqual(saved.audio, { volume: 0.5, muted: true });
  assert.ok(s.data.has('moss-stomper-best'), 'legacy keys are left for rollback');
  s.data.set('moss-stomper-best', JSON.stringify({ version: 2, strut: 1, rhythm: 1 }));
  assert.equal(loadSave(s).best.strut, 900, 'versioned save wins over legacy keys');
});

test('blocked or corrupt storage never throws', () => {
  global.localStorage = blockedStorage();
  assert.doesNotThrow(() => make().setAudio(0.2, false));
  assert.deepEqual(loadSave(memoryStorage({ [SAVE_KEY]: '{not json' })).best, { strut: 0, rhythm: 0, route: 0 });
  assert.equal(loadSave(memoryStorage({ 'moss-stomper-best': 'garbage' })).best.strut, 0);
});

test('sanitize clamps values and rejects duplicate or reserved keys', () => {
  const s = sanitize({ best: { strut: -5, rhythm: '12.4', route: 'x' }, audioOffset: 9, audio: { volume: 4, muted: 'yes' }, keys: { A: 'KeyJ', B: 'KeyJ', C: 'KeyL' } });
  assert.deepEqual(s.best, { strut: 0, rhythm: 12, route: 0 });
  assert.equal(s.audioOffset, 0.12);
  assert.deepEqual(s.audio, { volume: 1, muted: false });
  assert.deepEqual(s.keys, DEFAULT_KEYS, 'a key bound twice falls back to defaults');
  assert.deepEqual(sanitize({ keys: { A: 'Escape', B: 'KeyK', C: 'KeyL' } }).keys, { A: 'KeyA', B: 'KeyK', C: 'KeyL' });
});

test('reset bests clears scores but keeps settings', () => {
  const s = memoryStorage();
  global.localStorage = s;
  const bests = [];
  const a = make({ onBest: (b) => bests.push(b) });
  a.setKeys({ A: 'KeyJ', B: 'KeyK', C: 'KeyL' });
  a.setAudioOffset(0.04);
  a.resetBests();
  assert.equal(a.bestStrut, 0);
  assert.deepEqual(bests.at(-1), { strut: 0, rhythm: 0 });
  const saved = loadSave(s);
  assert.deepEqual(saved.best, { strut: 0, rhythm: 0, route: 0 });
  assert.equal(saved.audioOffset, 0.04);
  assert.equal(saved.keys.A, 'KeyJ');
  assert.deepEqual(resetBests(blockedStorage()).best, { strut: 0, rhythm: 0, route: 0 });
});

test('key remapping swaps clashes, refuses reserved keys, persists and relabels', () => {
  const s = memoryStorage();
  global.localStorage = s;
  let map = rebind(DEFAULT_KEYS, 'A', 'KeyJ');
  assert.deepEqual(map, { A: 'KeyJ', B: 'KeyS', C: 'KeyD' });
  map = rebind(map, 'B', 'KeyJ');
  assert.deepEqual(map, { A: 'KeyS', B: 'KeyJ', C: 'KeyD' }, 'clash swaps the two actions');
  assert.equal(rebind(map, 'C', 'Escape'), map, 'Escape stays pause');
  const a = make();
  a.setKeys(map);
  assert.equal(keyBtn('KeyJ'), 'B');
  assert.equal(keyBtn('KeyA'), null);
  assert.equal(keyLabel('B'), 'J');
  assert.deepEqual(make().save.keys, map, 'bindings survive a reload');
  assert.equal(codeLabel('Space'), 'SPACE');
  assert.equal(codeLabel('Digit7'), '7');
  assert.equal(codeLabel('ArrowLeft'), '←');
});
