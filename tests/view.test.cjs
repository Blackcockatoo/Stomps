const test = require('node:test');
const assert = require('node:assert/strict');
const { game, make } = require('./helpers.cjs');

const { visibleSpan, positionX, FULL_VIEW } = game.view;

test('contain/fill layouts show the whole playfield', () => {
  assert.deepEqual(visibleSpan(800, 450, 'contain', 0.5), FULL_VIEW);
  assert.deepEqual(visibleSpan(800, 450, 'fill'), FULL_VIEW);
  assert.deepEqual(visibleSpan(0, 0, 'cover'), FULL_VIEW);
});

test('portrait cover crop at 390×844 matches the browser (Moss at x=132 stays visible)', () => {
  const span = visibleSpan(372, 519, 'cover', 0.24);
  assert.deepEqual(span, { left: 69, right: 262 });
  assert.ok(span.left < 132 && span.right > 132);
  const narrow = visibleSpan(342, 415, 'cover', 0.24);
  assert.deepEqual(narrow, { left: 62, right: 284 });
});

test('object-position parsing', () => {
  assert.equal(positionX('24% 50%', 500), 0.24);
  assert.equal(positionX('left center', 500), 0);
  assert.equal(positionX('right', 500), 1);
  assert.equal(positionX('center', 500), 0.5);
  assert.equal(positionX('-100px 0px', 400), 0.25);
});

test('arcade starts with the full view and accepts a cropped one', () => {
  const g = make();
  assert.deepEqual(g.view, FULL_VIEW);
  g.setView({ left: 69, right: 262 });
  assert.deepEqual(g.view, { left: 69, right: 262 });
});
