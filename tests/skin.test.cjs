const test = require('node:test');
const assert = require('node:assert/strict');
const { game, make, memoryStorage } = require('./helpers.cjs');

const { isHoodieRed, remapHoodie, CREAM } = game.skin;

test('hoodie key: reds become shaded cream; skin, jacket, shoes and alpha are kept', () => {
  assert.ok(isHoodieRed(200, 20, 40), 'hoodie red');
  assert.ok(isHoodieRed(120, 14, 30), 'shaded hoodie');
  assert.ok(!isHoodieRed(226, 150, 110), 'orange skin tone is not hoodie');
  assert.ok(!isHoodieRed(24, 20, 22), 'near-black jacket');
  assert.ok(!isHoodieRed(240, 240, 240), 'white sneakers');
  assert.ok(!isHoodieRed(40, 6, 8), 'too dark to be the hoodie (outline)');
  const px = new Uint8ClampedArray([200, 20, 40, 255, 100, 10, 20, 255, 226, 150, 110, 255, 200, 20, 40, 0]);
  assert.equal(remapHoodie(px), 2);
  assert.ok(px[0] > px[4], 'brighter red stays brighter cream (shading kept)');
  assert.ok(px[0] >= px[1] && px[1] >= px[2], 'cream is warm');
  assert.ok(px[0] <= CREAM[0]);
  assert.deepEqual([...px.slice(8, 12)], [226, 150, 110, 255], 'skin untouched');
  assert.deepEqual([...px.slice(12)], [200, 20, 40, 0], 'transparent pixels untouched');
});

test('skin choice persists and falls back to the source frames when pixels are unavailable', () => {
  global.localStorage = memoryStorage();
  const a = make();
  assert.equal(a.skin, 'classic');
  const frames = [{ width: 0, height: 0 }];
  a.clips.set('strut', frames);
  assert.equal(a.mossFrames('strut'), frames);
  a.setSkin('cream');
  assert.equal(game.storage.loadSave().skin, 'cream');
  assert.deepEqual(a.mossFrames('strut'), frames, 'no canvas in node: classic frames are used');
  assert.equal(make().skin, 'cream', 'reload keeps the skin');
  a.setSkin('neon');
  assert.equal(a.skin, 'cream');
  assert.equal(game.storage.sanitize({ skin: 'gold' }).skin, 'classic');
});
