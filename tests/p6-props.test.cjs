// P6.2a: the prop registry, the traffic cone and the board re-pop cap.
const test = require('node:test');
const assert = require('node:assert/strict');
const { game, make } = require('./helpers.cjs');

const S = game.stompables;
const C = game.p6;
const P = game.p6Props;
const E = game.engineSk8;
const { pointsFor } = game.feel;
const { GRADE_MULT } = game.sk8;
const BD = 60 / 104;

const tap = (a, b) => { a.down(b); a.up(b); };
const tick = (a, s) => { for (let i = 0; i < Math.round(s * 120); i++) a.tick(1 / 120); };
const coneSpec = () => S.PROP_SPECS.find((s) => s.kind === 'cone');
const coneRun = (a) => [...a.p5.stomps.values()].find((r) => r.kind === 'cone');

function atCone(lap = 0) {
  const a = make();
  a.playStrut('free');
  a.scroll = S.stompX(coneSpec()) + lap * game.route.ROUTE_PX - a.mossX();
  a.groove.t = 4 * BD;
  return a;
}

// ── Registry ──────────────────────────────────────────────────────────────

test('registry: the cone definition is valid, playable on all three buttons and drawn in code', () => {
  assert.deepEqual(C.auditPropDefs(Object.values(P.P6_PROPS)), []);
  const cone = P.P6_PROPS.cone;
  assert.equal(cone.art, 'p6/cone');
  assert.deepEqual(cone.interactions.map((i) => i.gesture.btn).sort(), ['A', 'B', 'C']);
  assert.deepEqual(cone.interactions.map((i) => i.gesture.kind), ['tap', 'timed', 'timed']);
  assert.equal(cone.maxScoringUses, 1);
  assert.ok(P.isP6Kind('cone'));
  assert.ok(!P.isP6Kind('board') && !P.isP6Kind('toString'));
});

test('registry: the audit rejects decorative props, unsupported gestures and clashing buttons', () => {
  const base = { kind: 'cone', label: 'X', art: 'p6/x', initial: 'idle', cue: 'X', maxScoringUses: 1 };
  assert.match(C.auditPropDefs([{ ...base, interactions: [] }]).join(), /decorative/);
  assert.match(C.auditPropDefs([{ ...base, art: 'cone', interactions: P.CONE.interactions }]).join(), /p6\//);
  const hold = { id: 'x.hold', verb: 'H', gesture: { kind: 'hold', btn: 'A', beats: 1 }, from: ['idle'], to: 'spent', base: 1, sound: 'style' };
  assert.match(C.auditPropDefs([{ ...base, interactions: [hold] }]).join(), /not supported/);
  const a1 = { id: 'x.a', verb: 'A', gesture: { kind: 'tap', btn: 'A' }, from: ['idle'], to: 'spent', base: 1, sound: 'style' };
  assert.match(C.auditPropDefs([{ ...base, interactions: [a1, { ...a1, id: 'x.b' }] }]).join(), /two interactions on A/);
});

test('registry: the cone sits in THE VAN, clear of encounters, the board and the door; P5 layout unchanged', () => {
  const spec = coneSpec();
  assert.equal(spec.zone, 'caravan');
  assert.equal(spec.uid, 'p6-caravan-cone-0');
  assert.deepEqual(S.auditStompables(), []);
  const board = S.STOMPABLES.find((s) => s.kind === 'board' && s.zone === 'caravan');
  assert.ok(S.stompX(spec) - S.stompX(board) >= 300, 'far enough past the van board');
  assert.equal(S.STOMPABLES.length, 13, 'the seven P5 kinds keep their 13 placements and ids');
  assert.deepEqual(S.PROP_SPECS.slice(0, 13), S.STOMPABLES);
  assert.equal(S.PROP_SPECS.length, 14);
});

// ── Pure gesture path ─────────────────────────────────────────────────────

test('gesture path: STRIDE steps over, STOMP launches on the beat, STYLE spins on a GREAT', () => {
  const step = S.newRun('c', 'cone', 0);
  const r1 = S.stompProp(step, 'A', 'PERFECT', 1, 4);
  assert.equal(step.state, 'spent');
  assert.equal(r1.points, Math.round(15 * GRADE_MULT.PERFECT));
  assert.deepEqual(r1.tags, ['cone:stepped']);
  assert.equal(r1.interaction, 'cone.step');

  const launch = S.newRun('c', 'cone', 0);
  const r2 = S.stompProp(launch, 'B', 'OK', 1, 4);
  assert.equal(launch.state, 'airborne');
  assert.equal(r2.points, 70);
  assert.deepEqual(r2.tags, ['cone:launched']);

  const spin = S.newRun('c', 'cone', 0);
  const r3 = S.stompProp(spin, 'C', 'GREAT', 1, 4);
  assert.equal(spin.state, 'spent');
  assert.equal(spin.act, 'cone.spin');
  assert.equal(r3.points, Math.round(80 * GRADE_MULT.GREAT));
});

test('gesture path: off-beat presses topple the cone for nothing; STRIDE off the beat still steps over for 0', () => {
  const b = S.newRun('c', 'cone', 0);
  const rb = S.stompProp(b, 'B', 'MISS', 1, 4);
  assert.equal(b.state, 'toppled');
  assert.equal(rb.points, 0);
  assert.deepEqual(rb.tags, []);
  assert.match(rb.label, /STOMP ON THE BEAT/);
  const c = S.newRun('c', 'cone', 0);
  assert.equal(S.stompProp(c, 'C', 'OK', 1, 4).points, 0, 'a spin needs GREAT or better');
  assert.equal(c.state, 'toppled');
  const a = S.newRun('c', 'cone', 0);
  const ra = S.stompProp(a, 'A', 'MISS', 1, 4);
  assert.equal(a.state, 'spent');
  assert.equal(ra.points, 0);
  assert.equal(ra.good, false);
});

test('gesture path: a played cone ignores further presses and a launched cone lands out of play', () => {
  const run = S.newRun('c', 'cone', 0);
  S.stompProp(run, 'B', 'PERFECT', 1, 4);
  for (const btn of ['A', 'B', 'C']) assert.equal(S.stompProp(run, btn, 'PERFECT', 1.1, 5), null);
  assert.equal(S.inReach(run, 0), false);
  assert.equal(S.wantsPress(run), false);
  S.tickProp(run, 1.5, 6, BD);
  assert.equal(run.state, 'airborne');
  S.tickProp(run, 1.95, 6, BD);
  assert.equal(run.state, 'spent');
  assert.equal(S.inReach(S.newRun('c', 'cone', 0), 0), true, 'an idle cone is in reach like any toy');
});

// ── Anti-farming guard ────────────────────────────────────────────────────

test('payFactor: one scoring use per instance, repeat decay per lap, and a hard lap budget', () => {
  const base = { usesThisLap: 0, maxScoringUses: 1, repeatIndex: 0, lapPointsSoFar: 0, lapBudget: 1000, proposed: 100 };
  assert.equal(C.payFactor(base), 1);
  assert.equal(C.payFactor({ ...base, usesThisLap: 1 }), 0);
  assert.deepEqual([0, 1, 2, 3, 9].map((repeatIndex) => C.payFactor({ ...base, repeatIndex })), [1, 0.5, 0.25, 0, 0]);
  assert.equal(C.payFactor({ ...base, lapPointsSoFar: 950 }), 0.5);
  assert.equal(C.payFactor({ ...base, lapPointsSoFar: 1000 }), 0);
  assert.equal(C.payFactor({ ...base, proposed: 0 }), 0);
  assert.equal(P.P6_LAP_BUDGET, Math.round(0.35 * game.route.STREETS.reduce((n, s) => n + s.scorePerfect, 0)));
  assert.equal(C.ANTI_FARM.meterGain, 0);
});

// ── Engine ────────────────────────────────────────────────────────────────

test('engine: STOMP on the beat launches the cone and pays once; the next press falls through to Moss', () => {
  const a = atCone();
  const score = a.score;
  const meter = a.meter;
  tap(a, 'B');
  const run = coneRun(a);
  assert.equal(run.state, 'airborne');
  assert.equal(a.score - score, pointsFor(70 * GRADE_MULT.PERFECT));
  assert.equal(a.meter, meter, 'props add no Quake Drive');
  assert.equal(a.flowState.chain, 0, 'props never touch FLOW');
  assert.ok(a.p5.tags.get('0:caravan').includes('cone:launched'));
  const after = a.score;
  a.groove.t = 5 * BD; tap(a, 'B');
  assert.equal(coneRun(a).state, 'airborne');
  assert.equal(a.currentClip(), 'stomp', 'the press played Moss instead');
  assert.ok(a.score - after < pointsFor(70), 'no second cone payout');
  tick(a, 1);
  assert.equal(coneRun(a).state, 'spent');
});

test('engine: STRIDE steps over and STYLE spins, through the real input path', () => {
  const a = atCone();
  tap(a, 'A');
  assert.equal(coneRun(a).state, 'spent');
  assert.equal(coneRun(a).act, 'cone.step');
  const b = atCone();
  const score = b.score;
  tap(b, 'C');
  assert.equal(coneRun(b).act, 'cone.spin');
  assert.equal(b.score - score, pointsFor(80 * GRADE_MULT.PERFECT));
});

test('engine: an authored street encounter in its window wins the press over the cone', () => {
  const a = atCone();
  a.stompViews();
  a.streetViews = () => [{ key: 'fake', dist: 0, win: { good: 30 } }];
  assert.equal(E.sk8Down(a, 'B'), false);
  assert.equal(coneRun(a).state, 'idle');
});

test('engine: cone pay respects the lap budget and repeat decay, and resets on the next lap', () => {
  const full = atCone();
  full.p5.p6.lapBase.set(0, P.P6_LAP_BUDGET);
  const s0 = full.score;
  tap(full, 'B');
  assert.equal(coneRun(full).state, 'airborne', 'still playable when maxed');
  assert.equal(full.score, s0, 'nothing paid over the budget');
  assert.equal(full.p5.p6.capped, 1);

  const near = atCone();
  near.p5.p6.lapBase.set(0, P.P6_LAP_BUDGET - 10);
  const s1 = near.score;
  tap(near, 'B');
  assert.equal(near.score - s1, pointsFor(10));

  const repeat = atCone();
  repeat.p5.p6.repeats.set('0:cone.launch', 1);
  const s2 = repeat.score;
  tap(repeat, 'B');
  assert.equal(repeat.score - s2, pointsFor(70 * GRADE_MULT.PERFECT * 0.5));

  const lap1 = atCone(1);
  lap1.p5.p6.lapBase.set(0, P.P6_LAP_BUDGET);
  const s3 = lap1.score;
  tap(lap1, 'B');
  assert.equal(lap1.score - s3, pointsFor(70 * GRADE_MULT.PERFECT), 'a new lap has its own budget and its own cone');
});

test('engine: practice, Street School and the bonus world have no cone', () => {
  const a = make();
  a.playStrut('practice');
  a.scroll = S.stompX(coneSpec()) - a.mossX();
  assert.equal(a.stompViews().filter((v) => v.run.kind === 'cone').length, 0);
});

// ── Board re-pop cap (Tom's decision: a board pays for a pop once per board per lap) ──

function onVanBoard(lap = 0) {
  const a = make();
  a.playStrut('route');
  const board = S.STOMPABLES.find((s) => s.kind === 'board' && s.zone === 'caravan');
  a.scroll = S.stompX(board) + lap * game.route.ROUTE_PX - a.mossX();
  a.groove.t = 0;
  return a;
}

test('board: the first pop pays; pop → bail → re-pop loops still ride but pay nothing more', () => {
  const a = onVanBoard();
  const s0 = a.score;
  tap(a, 'B');
  assert.ok(a.p5.sk8.ride);
  const firstPop = a.score - s0;
  assert.equal(firstPop, pointsFor(60 * GRADE_MULT.PERFECT));
  const meterAfterFirst = a.meter;
  let t = 0;
  // Five cycles keep the squirted board inside the van/crossing view window (stompViews looks ±900 px from its spot).
  for (let cycle = 0; cycle < 5; cycle++) {
    t += BD * 1.45; a.groove.t = t; tap(a, 'C'); // off the beat: bail, board shoots ahead
    assert.equal(a.p5.sk8.ride, null);
    const board = [...a.p5.stomps.values()].find((r) => r.kind === 'board' && r.state === 'loose');
    a.scroll += board.world - a.mossWorld();
    t = Math.ceil(t / BD + 1) * BD; a.groove.t = t; tap(a, 'B');
    assert.ok(a.p5.sk8.ride, 'the loose board can still be popped and ridden');
  }
  assert.equal(a.score - s0, firstPop, 'five re-pops added nothing (each paid 900 before the cap)');
  assert.equal(a.meter, meterAfterFirst, 're-pops add no Quake Drive either');
  assert.equal(a.p5.repops, 5);
  assert.equal(a.p5.pops, 6);
  assert.equal(a.callout, 'RE-POP! (PAYS ONCE A LAP)');
});

test('board: the cap is per board per lap: other boards and the next lap pay their first pop', () => {
  const a = onVanBoard(1);
  a.p5.boardPaid.add('caravan-board-0:0'); // lap 0's van board already paid
  const s0 = a.score;
  tap(a, 'B');
  assert.equal(a.score - s0, pointsFor(60 * GRADE_MULT.PERFECT));
  assert.ok(a.p5.boardPaid.has('caravan-board-0:1'));
});

test('board: landed chains still bank after a re-pop, so riding stays worth it', () => {
  const a = onVanBoard();
  tap(a, 'B');
  a.groove.t = BD * 1.45; tap(a, 'C');
  const board = [...a.p5.stomps.values()].find((r) => r.kind === 'board' && r.state === 'loose');
  a.scroll += board.world - a.mossWorld();
  a.groove.t = BD * 3; tap(a, 'B');
  a.groove.t = BD * 4; tap(a, 'A');
  const before = a.score;
  a.p5.sk8.ride.endsAt = a.now + 0.01;
  tick(a, 0.05);
  assert.ok(a.score > before, 'the trick chain pays as before');
});

// ── Ignoring the cone ─────────────────────────────────────────────────────

function routeReplay(playCone) {
  let result;
  const a = make({ onResult: (r) => (result = r) });
  a.playStrut('route');
  a.runSeed = 0;
  for (let frame = 0; frame < 120 * 360 && a.mode === 'strut'; frame++) {
    a.groove.t = a.now;
    const v = a.streetViews().find((v) => !a.streetMarks.has(v.key) && Math.abs(v.dist) < 0.8);
    if (v) { for (const b of v.spec.trigger) a.down(b); for (const b of v.spec.trigger) a.up(b); }
    else if (playCone) {
      const cone = a.stompViews().find((s) => s.run.kind === 'cone' && s.run.state === 'idle' && S.inReach(s.run, s.dist));
      if (cone && a.now % BD < 1 / 120) tap(a, 'B');
    }
    a.tick(1 / 120);
  }
  assert.ok(result, 'route finishes');
  return { a, result };
}

test('route: ignoring the cone costs nothing, and playing it never changes the grade', () => {
  const ignored = routeReplay(false);
  const played = routeReplay(true);
  assert.equal(coneRun(ignored.a)?.state ?? 'idle', 'idle');
  assert.equal(ignored.a.p5.p6.plays, 0);
  assert.equal(played.a.p5.p6.plays, 1);
  assert.deepEqual(played.result.mastery, ignored.result.mastery, 'same grade');
  assert.equal(played.a.streetPerfect, ignored.a.streetPerfect);
  assert.equal(played.a.streetMiss, ignored.a.streetMiss);
  assert.equal(played.a.score - ignored.a.score, pointsFor(70 * GRADE_MULT.PERFECT), 'the cone is pure bonus');
});
