const test = require('node:test');
const assert = require('node:assert/strict');
const { game, make } = require('./helpers.cjs');

const K = game.sk8;
const S = game.stompables;
const BD = 60 / 104;

test('timing grades: beat judgements and street distances share PERFECT / GREAT / OK', () => {
  assert.equal(K.gradeOf('PERFECT'), 'PERFECT');
  assert.equal(K.gradeOf('FRESH'), 'GREAT');
  assert.equal(K.gradeOf('LATE'), 'OK');
  assert.equal(K.gradeOf('OFF'), 'MISS');
  assert.equal(K.distGrade(5, 12, 30), 'PERFECT');
  assert.equal(K.distGrade(-18, 12, 30), 'GREAT');
  assert.equal(K.distGrade(26, 12, 30), 'OK');
  assert.equal(K.distGrade(31, 12, 30), null);
  assert.ok(K.GRADE_MULT.PERFECT > K.GRADE_MULT.GREAT && K.GRADE_MULT.GREAT > K.GRADE_MULT.OK);
  assert.ok(K.GRADE_POWER.PERFECT > K.GRADE_POWER.OK, 'a cleaner hit launches further');
  assert.ok(K.GRADE_HOP.PERFECT > K.GRADE_HOP.OK, 'a cleaner trick pops higher');
});

test('street encounters pay PERFECT > GREAT > OK and remember the grade', () => {
  const spec = game.route.STREETS.find((s) => s.id === 'crossing_signal');
  const at = (dist) => { const a = make(); a.settleStreet(spec, 'k', dist, 12, 'main', 30); return a; };
  const p = at(0), g = at(15), o = at(28);
  assert.ok(p.score > g.score && g.score > o.score, JSON.stringify([p.score, g.score, o.score]));
  assert.equal(g.streetMarks.get('k').grade, 'GREAT');
  assert.equal(o.streetMarks.get('k').grade, 'OK');
  assert.equal(o.streetGood, 1, 'GREAT and OK both count as clean hits for mastery');
});

test('ride: each on-beat tap flips the board by button, one flip per beat', () => {
  const s = K.newSk8();
  K.startRide(s, 0, BD, 'GREAT');
  assert.equal(K.rideTap(s, 'A', 'GREAT', 0.1, 1).link.name, 'KICKFLIP');
  assert.equal(K.rideTap(s, 'A', 'GREAT', 0.12, 1).kind, 'repeat', 'a second tap on the same beat is ignored, not punished');
  assert.equal(K.rideTap(s, 'B', 'OK', 0.7, 2).link.name, 'HEELFLIP');
  assert.equal(K.rideTap(s, 'C', 'PERFECT', 1.3, 3).link.name, 'POP SHOVE-IT');
  assert.equal(s.ride.links.length, 3);
  assert.equal(K.chainMult(3), 2);
  assert.equal(K.chainMult(20), K.MULT_CAP);
  const ride = K.startRide(K.newSk8(), 5, BD, 'PERFECT');
  assert.ok(ride.endsAt - 5 > K.RIDE_BEATS * BD, 'a PERFECT pop rides longer');
});

test('three PERFECT taps in a row land a 360 flip; anything less resets the run', () => {
  const s = K.newSk8();
  K.startRide(s, 0, BD, 'OK');
  K.rideTap(s, 'A', 'PERFECT', 0, 1);
  K.rideTap(s, 'B', 'PERFECT', 0, 2);
  const third = K.rideTap(s, 'C', 'PERFECT', 0, 3);
  assert.equal(third.link.id, '360flip');
  assert.equal(third.link.special, true);
  assert.equal(s.ride.perfectRun, 0);
  K.rideTap(s, 'A', 'PERFECT', 0, 4);
  K.rideTap(s, 'A', 'GREAT', 0, 5);
  assert.equal(K.rideTap(s, 'A', 'PERFECT', 0, 6).link.id, 'kickflip', 'a GREAT broke the run');
  assert.ok(s.specials.has('360flip'));
});

test('hold then release: manual on flat ground, 50-50 on a kerb, rail grind on the pier', () => {
  for (const [surface, id] of [[null, 'manual'], ['kerb', 'grind'], ['rail', 'railgrind']]) {
    const s = K.newSk8();
    K.startRide(s, 0, BD, 'GREAT');
    K.rideTap(s, 'A', 'GREAT', 1, 2);
    const out = K.rideRelease(s, 'A', 'MISS', 1 + K.HOLD_MIN + 0.05, surface);
    assert.equal(out.kind, 'trick');
    assert.equal(out.link.id, id);
    assert.equal(out.link.grade, 'OK', 'a sloppy release still lands, at OK');
  }
  const s = K.newSk8();
  K.startRide(s, 0, BD, 'GREAT');
  K.rideTap(s, 'B', 'GREAT', 1, 2);
  assert.equal(K.rideRelease(s, 'B', 'GREAT', 1.1, null).kind, 'none', 'a tap is not a manual');
  assert.equal(K.rideRelease(s, 'C', 'GREAT', 3, null).kind, 'none', 'only the button that flipped can hold');
});

test('an off-beat tap bails: the chain is lost and style drops', () => {
  const s = K.newSk8();
  K.startRide(s, 0, BD, 'GREAT');
  K.rideTap(s, 'A', 'PERFECT', 0, 1);
  K.rideTap(s, 'B', 'PERFECT', 0, 2);
  const style = s.style;
  const out = K.rideTap(s, 'C', 'MISS', 0, 3);
  assert.equal(out.kind, 'bail');
  assert.ok(out.lost > 0);
  assert.equal(s.ride, null);
  assert.equal(s.bails, 1);
  assert.ok(s.style < style);
  assert.equal(K.land(s).value, 0, 'nothing left to bank');
});

test('style meter: repeats drain it, mixing fills it, and it scales the banked chain', () => {
  let style = 0.5;
  style = K.styleAfter(style, ['kickflip'], 'kickflip');
  assert.ok(style < 0.5, 'repeat drains');
  const mixed = K.styleAfter(0.5, ['kickflip', 'heelflip'], 'shoveit');
  assert.ok(mixed > 0.5, 'a fresh move fills');
  assert.ok(K.styleAfter(0.5, [], '360flip') > mixed, 'specials fill more');
  const bank = (btns) => {
    const s = K.newSk8();
    K.startRide(s, 0, BD, 'GREAT');
    btns.forEach((b, i) => K.rideTap(s, b, 'GREAT', 0, i + 1));
    return K.land(s).value;
  };
  assert.ok(bank(['A', 'B', 'C', 'A']) > bank(['A', 'A', 'A', 'A']), 'variety banks more than spam');
  const s = K.newSk8();
  K.startRide(s, 0, BD, 'OK');
  K.rideTap(s, 'A', 'GREAT', 0, 1);
  const landed = K.land(s, 1.25);
  assert.equal(s.landed, 1);
  assert.equal(s.bestChain, 1);
  assert.ok(landed.value > 0);
});

test('board prop: on-beat stomp pops a ride, an off-beat stomp squirts it ahead', () => {
  const p = S.newRun('b', 'board', 100);
  assert.equal(S.stompProp(p, 'A', 'GREAT', 0, 0), null, 'only a stomp pops the tail');
  const miss = S.stompProp(p, 'B', 'MISS', 0, 0);
  assert.equal(p.state, 'loose');
  assert.equal(p.world, 100 + S.SQUIRT_PX);
  assert.equal(miss.ride, undefined);
  const pop = S.stompProp(p, 'B', 'PERFECT', 1, 2);
  assert.equal(pop.ride, 'PERFECT');
  assert.equal(p.state, 'riding');
});

test('trolley: stomp rolls it, an on-beat second stomp skittles it into the bins', () => {
  const t = S.newRun('t', 'trolley', 0);
  S.stompProp(t, 'B', 'OK', 0, 0);
  assert.equal(t.state, 'rolling');
  assert.ok(S.runX(t, 1) > 0, 'it rolls ahead on its own');
  const hit = S.stompProp(t, 'B', 'GREAT', 1, 2);
  assert.equal(t.state, 'skittled');
  assert.deepEqual(hit.tags, ['trolley:skittle']);
  assert.equal(hit.knock, true);
  const w = S.newRun('w', 'wheelie', 300);
  const knocked = S.knockWheelie(w, 1);
  assert.equal(w.state, 'launched');
  assert.deepEqual(knocked.tags, ['wheelie:launch']);
  const sloppy = S.newRun('t2', 'trolley', 0);
  S.stompProp(sloppy, 'B', 'GREAT', 0, 0);
  assert.equal(S.stompProp(sloppy, 'B', 'OK', 1, 2).points, 0);
  assert.equal(sloppy.state, 'gone', 'an OK second stomp lets it get away');
  const idle = S.newRun('t3', 'trolley', 0);
  S.stompProp(idle, 'B', 'GREAT', 0, 0);
  S.tickProp(idle, S.ROLL_TIME + 0.1, 5, BD);
  assert.equal(idle.state, 'gone');
});

test('wheelie bin: lid flips, a timed second stomp launches the rubbish', () => {
  const w = S.newRun('w', 'wheelie', 0);
  S.stompProp(w, 'B', 'GREAT', 0, 4);
  assert.equal(w.state, 'open');
  assert.equal(S.stompProp(w, 'B', 'PERFECT', 0.05, 4).label, '', 'same beat as the flip waits');
  const out = S.stompProp(w, 'B', 'PERFECT', 0.6, 5);
  assert.equal(w.state, 'launched');
  assert.deepEqual(out.tags, ['wheelie:launch']);
  const slow = S.newRun('w2', 'wheelie', 0);
  S.stompProp(slow, 'B', 'GREAT', 0, 4);
  S.tickProp(slow, 5, 12, BD);
  assert.equal(slow.state, 'closed', 'the lid drops if you wait');
});

test('pigeons: a light tap scatters for small points, a downbeat stomp sends the whole flock', () => {
  const light = S.newRun('p', 'pigeons', 0);
  const scatter = S.stompProp(light, 'A', 'PERFECT', 0, 4);
  assert.equal(light.state, 'scattered');
  const off = S.newRun('p2', 'pigeons', 0);
  S.stompProp(off, 'B', 'PERFECT', 0, 5);
  assert.equal(off.state, 'scattered', 'beat 2 is not the downbeat');
  const big = S.newRun('p3', 'pigeons', 0);
  const flight = S.stompProp(big, 'B', 'GREAT', 0, 8);
  assert.equal(big.state, 'flight');
  assert.ok(flight.points > scatter.points * 4);
  assert.deepEqual(flight.tags, ['pigeons:flight']);
  assert.equal(K.isDownbeat(-4), true);
});

test('sprinkler splash buffs longer on a cleaner stomp; parking meter pays on rhythm', () => {
  const sp = (timing) => S.stompProp(S.newRun('s', 'sprinkler', 0), 'B', timing, 0, 0).buff;
  assert.ok(sp('PERFECT') > sp('GREAT') && sp('GREAT') > sp('OK'));
  const m = S.newRun('m', 'meter', 0);
  assert.equal(S.stompProp(m, 'B', 'GREAT', 0, 10).coin, 1);
  assert.equal(S.stompProp(m, 'B', 'GREAT', 0.1, 10).label, '', 'one coin per beat');
  let last;
  for (let b = 11; b <= 13; b++) last = S.stompProp(m, 'B', 'PERFECT', b, b);
  assert.equal(m.coins, S.METER_JACKPOT);
  assert.deepEqual(last.tags, ['meter:coins']);
  assert.ok(last.points > 60, 'coins escalate');
  S.stompProp(m, 'B', 'MISS', 14, 14);
  assert.equal(m.state, 'paid', 'an off-beat stomp ends the payout');
  const skip = S.newRun('m2', 'meter', 0);
  S.stompProp(skip, 'B', 'GREAT', 0, 10);
  S.tickProp(skip, 3, 13, BD);
  assert.equal(skip.state, 'paid', 'skipping beats ends it too');
  const jam = S.newRun('m3', 'meter', 0);
  S.stompProp(jam, 'B', 'MISS', 0, 0);
  assert.equal(jam.state, 'paid');
});

test('rival: four bars of call and response, scored by matched beats with an out-trick bonus', () => {
  assert.deepEqual(K.rivalPhase(8, 7), { phase: 'intro', bar: 0, slot: 0 });
  assert.deepEqual(K.rivalPhase(8, 9), { phase: 'call', bar: 0, slot: 1 });
  assert.deepEqual(K.rivalPhase(8, 13), { phase: 'response', bar: 0, slot: 1 });
  assert.deepEqual(K.rivalPhase(8, 16), { phase: 'call', bar: 1, slot: 0 });
  assert.equal(K.rivalPhase(8, 24).phase, 'done');
  assert.equal(K.responseBeat(8, 1, 2), 22);
  const clean = K.rivalScore([['PERFECT', 'PERFECT', 'PERFECT', 'PERFECT'], ['GREAT', 'OK', 'GREAT', 'WRONG']]);
  assert.equal(clean.matched, 7);
  assert.equal(clean.win, true);
  assert.equal(clean.outTricked, 1);
  const lose = K.rivalScore([['GREAT', 'MISS', 'WRONG', 'GREAT'], ['GREAT', 'OK', 'MISS', null]]);
  assert.equal(lose.win, false);
  assert.ok(clean.points > lose.points + K.RIVAL_WIN_BONUS);
  assert.deepEqual(K.rivalPlan(3), K.rivalPlan(3), 'deterministic per seed');
  assert.notDeepEqual(K.rivalPlan(0)[0], K.rivalPlan(0)[1], 'round two is a different line');
});

test('layout: toys stay clear of encounters and the door; kerbs and the pier rail are grindable', () => {
  assert.deepEqual(S.auditStompables(), []);
  const ledge = S.STOMPABLES.find((s) => s.kind === 'ledge');
  assert.equal(S.surfaceAt(S.stompX(ledge) + 20), 'kerb');
  const pierBoard = S.STOMPABLES.find((s) => s.kind === 'board' && s.zone === 'pier');
  assert.equal(S.surfaceAt(S.stompX(pierBoard) + 200), 'rail');
  assert.equal(S.surfaceAt(S.stompX(S.STOMPABLES[0])), null);
  for (const zone of ['caravan', 'tracks', 'station', 'shops', 'pier', 'caravan_return']) assert.ok(S.challengeFor(zone), `${zone} has a trick list`);
});

test('trick lists and hidden lines match tags in order, not just in any order', () => {
  assert.equal(S.inOrder(['board:land', 'splash', 'trolley:skittle', 'wheelie:launch'], ['board:land', 'trolley:skittle', 'wheelie:launch']), true);
  assert.equal(S.inOrder(['trolley:skittle', 'board:land', 'wheelie:launch'], ['board:land', 'trolley:skittle', 'wheelie:launch']), false);
  assert.equal(S.inOrderCount(['board:land', 'wheelie:launch'], ['board:land', 'trolley:skittle', 'wheelie:launch']), 1);
  assert.deepEqual(S.rideTags(['kickflip', 'railgrind', '360flip']), ['board:land', 'board:kickflip', 'board:360', 'board:grind']);
});

test('mastery: when lines count, S needs a hidden line and S++ needs all of them', () => {
  const p = { perfect: 18, good: 0, missed: 0, expected: 18, longest: 18, techniques: 5, bonus: 1, golden: 1 };
  assert.equal(game.mastery.assess(p).grade, 'S++', 'old callers are unchanged');
  assert.equal(game.mastery.assess({ ...p, lines: 0, linesTotal: 3 }).grade, 'A');
  assert.match(game.mastery.assess({ ...p, lines: 0, linesTotal: 3 }).advice, /hidden best lines/);
  assert.equal(game.mastery.assess({ ...p, lines: 1, linesTotal: 3 }).grade, 'S+');
  assert.equal(game.mastery.assess({ ...p, lines: 3, linesTotal: 3 }).grade, 'S++');
});

test('objective strip shows the stage trick list with progress and a tick', () => {
  const { objectiveChips } = game.objectives;
  const base = { runKind: 'free', bonus: false, lapHits: 3, meter: 0.2, zoneId: 'shops', pierPerfect: 0, pierMiss: 0, techniques: 1 };
  const chips = objectiveChips({ ...base, trick: { text: 'BOARD → TROLLEY → BINS 1/3', short: 'B→T→B 1/3', done: false } });
  assert.deepEqual(chips.map((c) => c.id), ['door', 'trick', 'tech']);
  assert.match(chips[1].text, /^TRICK: BOARD/);
  const done = objectiveChips({ ...base, trick: { text: 'LAND A KICKFLIP', short: 'KICKFLIP', done: true } });
  assert.equal(done[1].done, true);
  assert.match(done[1].text, /^✓/);
});

// ── Engine integration ────────────────────────────────────────────────────

function onBoard(kind = 'board', zone = 'caravan') {
  const a = make();
  a.playStrut('free');
  const spec = S.STOMPABLES.find((s) => s.kind === kind && s.zone === zone);
  a.scroll = S.stompX(spec) - a.mossX();
  a.groove.t = 0;
  return a;
}
const tap = (a, b) => { a.down(b); a.up(b); };
const tick = (a, s) => { for (let i = 0; i < Math.round(s * 120); i++) a.tick(1 / 120); };

test('engine: pop, flip on the beat, land: the chain banks and the trick list ticks', () => {
  const a = onBoard();
  tap(a, 'B');
  assert.ok(a.p5.sk8.ride, 'riding');
  assert.equal(a.rideSpeed(), 112);
  a.groove.t = BD; tap(a, 'A');
  a.groove.t = BD * 2; tap(a, 'B');
  a.groove.t = BD * 3; tap(a, 'C');
  assert.equal(a.p5.sk8.ride.links.length, 3);
  const before = a.score;
  tick(a, 6.5);
  assert.equal(a.p5.sk8.ride, null);
  assert.ok(a.score > before, 'landing banks the chain');
  assert.equal(a.p5.sk8.landed, 1);
  assert.ok(a.p5.challenges.has('0:caravan'), 'LAND A KICKFLIP ticked');
  assert.equal(a.trickChip('caravan').done, true);
});

test('engine: bailing loses the chain and the board shoots ahead to stomp again', () => {
  const a = onBoard();
  tap(a, 'B');
  a.groove.t = BD; tap(a, 'A');
  const score = a.score;
  a.groove.t = BD * 1.45; tap(a, 'C');
  assert.equal(a.p5.sk8.ride, null, 'off the beat bails');
  assert.equal(a.score, score, 'no payout for a bail');
  const board = [...a.p5.stomps.values()].find((r) => r.kind === 'board' && r.state === 'loose');
  assert.ok(board && board.world > a.mossWorld() + 100, 'board squirted ahead');
  assert.equal(a.currentClip(), 'stumble');
  a.scroll += board.world - a.mossWorld();
  a.groove.t = BD * 4; tap(a, 'B');
  assert.ok(a.p5.sk8.ride, 'the loose board can be popped again');
});

test('engine: an off-beat stomp squirts the board; presses on empty ground still play Moss', () => {
  const a = onBoard();
  a.groove.t = BD * 0.45; tap(a, 'B');
  assert.equal(a.p5.sk8.ride, null);
  assert.equal(a.p5.squirts, 1);
  const b = make(); b.playStrut('free'); b.scroll = 50; tap(b, 'B');
  assert.equal(b.currentClip(), 'stomp');
});

test('engine: missing a street encounter while riding bails', () => {
  const a = onBoard('board', 'pier');
  tap(a, 'B');
  assert.ok(a.p5.sk8.ride);
  const next = game.route.STREETS.filter((s) => s.zone === 'pier').map((s) => game.route.streetX(s)).find((x) => x > a.mossWorld());
  for (let i = 0; i < 400 && a.p5.sk8.ride && a.mossWorld() < next + 120; i++) a.tick(1 / 120);
  assert.equal(a.p5.sk8.ride, null);
  assert.equal(a.p5.sk8.bails, 1);
  assert.ok(a.streetMiss >= 1);
});

test('engine: trolley skittles into the wheelie bin and the shops trick list completes in order', () => {
  const a = onBoard('board', 'shops');
  tap(a, 'B');
  a.groove.t = BD; tap(a, 'A');
  a.p5.sk8.ride.endsAt = a.now + 0.05; // land before the paper on the strip
  tick(a, 0.1);
  assert.ok(a.p5.tags.get('0:shops').includes('board:land'));
  const trolley = S.STOMPABLES.find((s) => s.kind === 'trolley');
  a.scroll = S.stompX(trolley) - a.mossX();
  a.groove.t = BD * 20; tap(a, 'B');
  a.groove.t = BD * 21; tap(a, 'B');
  const run = [...a.p5.stomps.values()].find((r) => r.kind === 'trolley' && r.state !== 'idle');
  assert.equal(run.state, 'skittled');
  const bin = [...a.p5.stomps.values()].find((r) => r.kind === 'wheelie');
  assert.equal(bin.state, 'launched');
  assert.ok(a.p5.challenges.has('0:shops'), 'BOARD → TROLLEY → BINS');
});

test('engine: the rival meets you at home, you answer his line, and the route waits for it', () => {
  let result = null;
  const a = make({ onResult: (r) => (result = r) });
  a.playStrut('route');
  const home = game.route.ZONES.find((z) => z.id === 'caravan_return');
  a.scroll = home.start + 60 - a.mossX();
  a.groove.t = BD * 10;
  a.tick(1 / 120);
  const rival = a.p5.rival;
  assert.ok(rival, 'rival rolls up');
  assert.equal(a.rideSpeed(), 74);
  assert.equal(rival.startBeat % 4, 0);
  a.groove.t = rival.startBeat * BD; tap(a, 'A');
  assert.equal(rival.marks[0][0], null, 'pressing during his call does nothing');
  for (let bar = 0; bar < 2; bar++) for (let slot = 0; slot < 4; slot++) {
    a.groove.t = K.responseBeat(rival.startBeat, bar, slot) * BD;
    tap(a, rival.plan[bar][slot]);
  }
  assert.deepEqual(rival.marks.flat().filter((m) => m === 'PERFECT').length, 8);
  a.scroll = game.route.ROUTE_PX;
  a.tick(1 / 120);
  assert.equal(a.mode, 'strut', 'the finish line waits for the rival');
  const before = a.score;
  a.groove.t = (rival.startBeat + 16) * BD + 0.3;
  a.tick(1 / 120);
  assert.equal(rival.done, true);
  assert.equal(rival.result.win, true);
  assert.equal(rival.result.outTricked, 2);
  assert.ok(a.score > before);
  a.tick(1 / 120);
  assert.equal(a.mode, 'result');
  assert.equal(result.sk8.rival, true);
  assert.equal(result.sk8.linesTotal, S.LINES.length);
});

test('engine: a hidden line pays and is counted once per lap', () => {
  const a = make();
  a.playStrut('free');
  const tracks = game.route.ZONES.find((z) => z.id === 'tracks');
  a.scroll = tracks.start + 100 - a.mossX();
  const score = a.score;
  // Drive the glue's tag path through real props: pay a meter to the jackpot, then a downbeat flock.
  const meter = S.STOMPABLES.find((s) => s.kind === 'meter' && s.zone === 'tracks');
  a.scroll = S.stompX(meter) - a.mossX();
  for (let b = 4; b < 4 + S.METER_JACKPOT; b++) { a.groove.t = b * BD; tap(a, 'B'); }
  const birds = S.STOMPABLES.find((s) => s.kind === 'pigeons' && s.zone === 'tracks');
  a.scroll = S.stompX(birds) - a.mossX();
  a.groove.t = 12 * BD; tap(a, 'B');
  assert.ok(a.p5.lines.has('0:COIN-OP COO'));
  assert.ok(a.p5.challenges.has('0:tracks'));
  assert.ok(a.score > score);
});

test('practice and the bonus world hide the toys', () => {
  const a = make();
  a.playStrut('practice');
  a.scroll = 400;
  assert.deepEqual(a.stompViews(), []);
  a.playStrut('free');
  a.scroll = 400;
  assert.ok(a.stompViews().length > 0);
});

test('reduced motion: tricks never hop the rider; a cleaner trick pops higher otherwise', () => {
  const { trickHop, TRICK_TIME } = game.stompArt;
  const perfect = { id: 'kickflip', grade: 'PERFECT', at: 0 };
  const ok = { id: 'kickflip', grade: 'OK', at: 0 };
  assert.equal(trickHop(perfect, TRICK_TIME / 2, true), 0);
  assert.ok(trickHop(perfect, TRICK_TIME / 2, false) > trickHop(ok, TRICK_TIME / 2, false));
  assert.equal(trickHop(perfect, TRICK_TIME * 2, false), 0, 'settles after the trick');
  assert.equal(trickHop({ id: 'bail', grade: null, at: 0 }, 0.1, false), 0);
});
