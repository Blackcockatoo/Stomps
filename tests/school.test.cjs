const test = require('node:test');
const assert = require('node:assert/strict');
const { game, make, memoryStorage } = require('./helpers.cjs');

const T = game.tutorial;
const plain = (b) => b;

test('street school reducer walks all six steps in order', () => {
  let s = T.newSchool();
  assert.equal(T.SCHOOL_STEPS.length, 6);
  assert.deepEqual(T.SCHOOL_STEPS.map((x) => x.id), ['stride', 'stomp', 'style', 'chord', 'recover', 'quake']);
  s = T.schoolStep(s, { type: 'hit', id: 'crossing_signal' });
  assert.equal(s.index, 0, 'hits do nothing during the stride step');
  s = T.schoolStep(s, { type: 'hold', dt: 0.7 });
  assert.equal(s.index, 0);
  assert.ok(T.schoolProgress(s) > 0.5);
  s = T.schoolStep(s, { type: 'hold', dt: 0.7 });
  assert.equal(s.index, 1);
  s = T.schoolStep(s, { type: 'miss', id: 'crossing_signal' });
  assert.equal(s.slip, 'missed');
  assert.match(T.schoolText(s, plain).line, /Missed it/);
  for (const id of ['crossing_signal', 'crossing_signal', 'vape_cloud', 'vape_cloud', 'skateboard']) s = T.schoolStep(s, { type: 'hit', id });
  assert.equal(T.schoolCurrent(s).id, 'recover');
  s = T.schoolStep(s, { type: 'recover' });
  assert.equal(s.index, 4, 'recovery only counts after the intentional miss');
  s = T.schoolStep(s, { type: 'hit', id: 'puddle' });
  assert.equal(s.slip, 'pressed');
  s = T.schoolStep(s, { type: 'miss', id: 'puddle' });
  assert.equal(s.missed, true);
  s = T.schoolStep(s, { type: 'expire' });
  assert.equal(s.missed, false);
  assert.equal(s.slip, 'late');
  s = T.schoolStep(T.schoolStep(s, { type: 'miss', id: 'puddle' }), { type: 'recover' });
  assert.equal(T.schoolCurrent(s).id, 'quake');
  const before = s;
  s = T.schoolStep(s, { type: 'quake' });
  assert.notEqual(before, s);
  assert.equal(s.finished, true);
  assert.equal(s.skipped, false);
  assert.equal(T.schoolStep(s, { type: 'skip' }), s, 'finished schools ignore events');
  assert.equal(T.schoolSnapshot(s, plain).title, "SCHOOL'S OUT");
});

test('skip ends the school and copy uses the bound keys', () => {
  const s = T.schoolStep(T.newSchool(), { type: 'skip' });
  assert.equal(s.finished, true);
  assert.equal(s.skipped, true);
  assert.equal(T.schoolText(s, plain).title, 'SCHOOL SKIPPED');
  const remap = { A: 'J', B: 'K', C: 'L' };
  const chord = { ...T.newSchool(), index: 3 };
  assert.match(T.schoolText(chord, (b) => remap[b]).line, /J and L together/);
  const quake = { ...T.newSchool(), index: 5 };
  assert.match(T.schoolText(quake, (b) => remap[b]).line, /J\+K\+L/);
  const say = T.schoolAnnouncement({ ...T.newSchool(), index: 1 }, (b) => remap[b]);
  assert.match(say, /^Street School, step 2 of 6:/);
  assert.match(say, /Tap K to stomp/);
  const recover = { ...T.newSchool(), index: 4, missed: true };
  assert.match(T.schoolText(recover, plain).line, /halves FLOW and drains 10% Quake/);
});

test('tutorialDone: fresh saves need school, legacy players and explicit flags are respected', () => {
  const { sanitize, loadSave, SAVE_KEY } = game.storage;
  assert.equal(sanitize({}).tutorialDone, false);
  assert.equal(sanitize({ best: { strut: 1200, rhythm: 0, route: 0 } }).tutorialDone, true, 'existing players skip the first-run school');
  assert.equal(sanitize({ best: { strut: 1200 }, tutorialDone: false }).tutorialDone, false, 'explicit flag wins');
  assert.equal(sanitize({ tutorialDone: true }).tutorialDone, true);
  assert.equal(sanitize({ tutorialDone: 'yes' }).tutorialDone, false);
  assert.equal(loadSave(memoryStorage({ 'moss-stomper-best': JSON.stringify({ version: 2, strut: 900, rhythm: 0 }) })).tutorialDone, true, 'legacy best migrates as done');
  assert.equal(loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify({ version: 1 }) })).tutorialDone, false);
});

function schoolArcade(extra = {}) {
  const storage = memoryStorage();
  global.localStorage = storage;
  const said = [];
  const snaps = [];
  const done = [];
  const a = make({ onSchool: (s) => snaps.push(s), onSchoolDone: (then, skipped) => done.push({ then, skipped }), ...extra });
  a.announce = (text) => said.push(text);
  return { a, storage, said, snaps, done };
}
const run = (a, s) => { for (let i = 0; i < Math.round(s * 120); i++) a.tick(1 / 120); };
function hitNext(a, btns) {
  run(a, 1.2);
  const cue = a.school.cues.find((c) => !a.streetMarks.has(c.key));
  assert.ok(cue, 'a lesson cue spawned');
  assert.ok(cue.world - a.mossWorld() > 200, 'cues spawn well ahead so the ring can read');
  a.scroll += cue.world - a.mossWorld();
  for (const b of btns) a.streetPending.set(b, a.now);
  a.flushStreet();
  run(a, 0.05);
}

test('a full street school run teaches every step and saves tutorialDone', () => {
  const { a, storage, said, snaps, done } = schoolArcade();
  assert.equal(a.needsSchool, true);
  a.playSchool('free');
  assert.equal(a.runKind, 'school');
  run(a, 0.02);
  assert.match(said[0], /Street School, step 1 of 6/);
  a.keys.add('A'); run(a, 1.4); a.keys.delete('A');
  assert.equal(a.school.state.index, 1);
  hitNext(a, ['B']); hitNext(a, ['B']);
  assert.equal(a.school.state.index, 2);
  hitNext(a, ['C']); hitNext(a, ['C']);
  hitNext(a, ['A', 'C']);
  assert.equal(T.schoolCurrent(a.school.state).id, 'recover');
  assert.ok(a.flowState.chain >= 6, 'recover step tops up flow to win back');
  // Let the puddle pass.
  run(a, 1.2);
  const puddle = a.school.cues.find((c) => !a.streetMarks.has(c.key));
  a.scroll += puddle.world - a.mossWorld() - 30;
  run(a, 0.02);
  a.scroll += 90;
  run(a, 0.3);
  assert.equal(a.school.state.missed, true, 'the intentional miss registers');
  assert.ok(a.flowState.recoveryUntil > a.now);
  a.commitSingle('B');
  assert.equal(T.schoolCurrent(a.school.state).id, 'quake');
  run(a, 1.5);
  assert.equal(a.meter, 1, 'quake step fills the drive');
  a.doQuake(false);
  run(a, 0.05);
  assert.equal(a.school.state.finished, true);
  assert.equal(JSON.parse(storage.data.get(game.storage.SAVE_KEY)).tutorialDone, true);
  assert.equal(a.needsSchool, false);
  assert.equal(a.bestStrut, 0, 'school never writes bests');
  assert.equal(a.lapHits, 0, 'school hits never open the door');
  run(a, 2.6);
  assert.deepEqual(done, [{ then: 'free', skipped: false }]);
  assert.equal(a.runKind, 'free', 'hands over to the run the player asked for');
  assert.ok(snaps.some((s) => s && s.id === 'chord'));
});

test('skip school saves tutorialDone and returns to the menu', () => {
  const { a, storage, done } = schoolArcade();
  a.playSchool('menu');
  run(a, 0.1);
  a.skipSchool();
  assert.deepEqual(done, [{ then: 'menu', skipped: true }]);
  assert.equal(a.mode, 'menu');
  assert.equal(a.school, null);
  assert.equal(JSON.parse(storage.data.get(game.storage.SAVE_KEY)).tutorialDone, true);
});

test('practice hides street props entirely', () => {
  const a = make();
  a.playStrut('practice');
  a.scroll = 2000;
  assert.deepEqual(a.streetViews(), []);
  a.playStrut('free');
  a.scroll = 2000;
  assert.ok(a.streetViews().length > 0);
});

test('cue maths: ring closes to the button at PERFECT and labels follow remaps', () => {
  const { cueState, cueLabel, pipGlyph, CUE_PREVIEW_PX } = game.cues;
  const win = { perfect: 12, good: 23, telegraph: 78 };
  assert.equal(cueState(78 + CUE_PREVIEW_PX + 1, win).phase, 'hidden');
  assert.equal(cueState(78 + 20, win).phase, 'preview');
  assert.equal(cueState(60, win).phase, 'telegraph');
  const hot = cueState(5, win);
  assert.equal(hot.phase, 'hot');
  assert.equal(hot.perfect, true);
  assert.ok(cueState(0, win).ring === 0);
  assert.ok(cueState(100, win).ring > cueState(50, win).ring, 'ring shrinks as the cue approaches');
  assert.equal(cueState(-30, win).phase, 'hidden');
  assert.equal(cueLabel(['B']), 'STOMP');
  assert.equal(cueLabel(['C']), 'STYLE');
  assert.equal(cueLabel(['A']), 'STRIDE');
  assert.equal(cueLabel(['A', 'C']), 'A+D');
  assert.equal(cueLabel(['A', 'C'], (b) => b.map((x) => ({ A: 'J', C: 'L' })[x]).join('+')), 'J+L');
  assert.equal(pipGlyph('SPACE'), 'SPC');
  assert.equal(pipGlyph('←'), '←');
  assert.equal(pipGlyph('d'), 'D');
});

test('prop reactions: hit-pause then squash, decaying miss wobble, still under reduced motion', () => {
  const { hitSquash, missWobble, idleFrame, HIT_PAUSE } = game.props;
  assert.deepEqual(hitSquash(HIT_PAUSE / 2, false), [1, 1], 'hit-pause holds still');
  const [sx, sy] = hitSquash(HIT_PAUSE + 0.13, false);
  assert.ok(sx > 1 && sy < 1);
  assert.deepEqual(hitSquash(0.2, true), [1, 1]);
  assert.ok(Math.abs(missWobble(0.05, false)) > Math.abs(missWobble(1.55, false)));
  assert.equal(missWobble(0.05, true), 0);
  assert.equal(idleFrame(12.3, 2, true), 0);
  assert.ok(new Set([0, 0.17, 0.34, 0.51].map((t) => idleFrame(t, 0, false))).size > 1);
});

test('objective chips track door, pier and technique goals', () => {
  const { objectiveChips } = game.objectives;
  const base = { runKind: 'free', bonus: false, lapHits: 3, meter: 0.2, zoneId: 'tracks', pierPerfect: 0, pierMiss: 0, techniques: 1 };
  assert.deepEqual(objectiveChips({ ...base, runKind: 'practice' }), []);
  assert.deepEqual(objectiveChips({ ...base, runKind: 'school' }), []);
  assert.deepEqual(objectiveChips({ ...base, bonus: true }), []);
  const chips = objectiveChips(base);
  assert.deepEqual(chips.map((c) => c.id), ['door', 'tech']);
  assert.equal(chips[0].text, 'DOOR 3/8 OR QUAKE');
  assert.equal(objectiveChips({ ...base, lapHits: 8 })[0].done, true);
  assert.equal(objectiveChips({ ...base, meter: 1 })[0].text, 'DOOR OPEN');
  const pier = objectiveChips({ ...base, zoneId: 'pier', pierPerfect: 2 });
  assert.equal(pier[1].text, '★ PIER 2/6');
  assert.equal(objectiveChips({ ...base, pierPerfect: 6 })[1].done, true);
  assert.equal(objectiveChips({ ...base, pierPerfect: 3, pierMiss: 1 })[1].text, '★ PIER LOST');
  assert.equal(objectiveChips({ ...base, techniques: 7 }).at(-1).text, 'TECH 5/5');
});
