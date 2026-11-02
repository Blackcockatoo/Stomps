const test = require('node:test');
const assert = require('node:assert/strict');
const { game, hooks, make, frame } = require('./helpers.cjs');

test('travel distance is frame-rate independent (30/60/144 Hz)', () => {
  const runs = [30, 60, 144].map((hz) => {
    const a = make();
    a.keys.add('A');
    a.start();
    for (let i = 0; i <= hz * 2; i++) frame(1000 + (i * 1000) / hz);
    a.destroy();
    return { hz, scroll: a.scroll };
  });
  const scrolls = runs.map((x) => x.scroll);
  assert.ok(Math.max(...scrolls) - Math.min(...scrolls) < 1.2, JSON.stringify(runs));
});

test('stride phase, footfall impact, pause freeze and released controls', () => {
  const a = make();
  a.frame = 7;
  a.frameAcc = 0.03;
  a.down('A');
  assert.equal(a.frame, 7, 'stride tap must retain frame');
  assert.equal(a.frameAcc, 0.03, 'stride tap must retain subframe phase');
  a.up('A');
  a.down('B');
  assert.equal(a.impactLife, 0, 'impact must wait for footfall');
  for (let i = 0; i < 60; i++) a.tick(1 / 120);
  assert.ok(a.sparks.some((x) => x.kind === 'impact'), 'stomp footfall creates impact');
  a.togglePause();
  const now = a.now, scroll = a.scroll, fx = a.sparks.map((x) => x.t);
  a.tick(0.1);
  assert.equal(a.now, now);
  assert.equal(a.scroll, scroll);
  assert.deepEqual(a.sparks.map((x) => x.t), fx);
  assert.equal(a.keys.size, 0);
});

test('live score converges, one reward per gain, bounded particles, pause and reduced motion', () => {
  let hud;
  const live = make({ onHud: (v) => (hud = v) });
  live.score = 1200;
  live.tick(1 / 120);
  assert.equal(live.gain, 1200);
  assert.equal(live.gainSerial, 1);
  assert.ok(live.motes.length > 0);
  assert.equal(hud, undefined);
  for (let i = 0; i < 90; i++) live.tick(1 / 120);
  assert.equal(hud.score, 1200, 'score counter converges on earned score');
  assert.equal(hud.serial, 1, 'one celebration per score gain');
  for (let i = 0; i < 30; i++) { live.score += 100; live.tick(1 / 120); }
  assert.ok(live.motes.length <= 96, 'particle work is bounded');
  live.togglePause();
  const particles = JSON.stringify(live.motes), score = live.displayScore;
  live.tick(0.1);
  assert.equal(JSON.stringify(live.motes), particles);
  assert.equal(live.displayScore, score, 'counter freezes on pause');
  const reduced = make();
  reduced.reducedMotion = true;
  reduced.score = 500;
  reduced.tick(0.01);
  assert.equal(reduced.motes.length, 0, 'reduced motion omits particles');
});

test('spring settles and rank/points scale', () => {
  const { BodySpring, pointsFor, styleRank } = game.feel;
  const spring = new BodySpring();
  spring.kick(-40, 75);
  for (let i = 0; i < 300; i++) spring.step(1 / 120);
  assert.ok(Math.abs(spring.x) < 0.01 && Math.abs(spring.y) < 0.01, 'body settles without drift');
  assert.equal(pointsFor(420), 4200);
  assert.equal(styleRank(24), 'PAVEMENT ROYALTY');
});

test('reward aggregation/expiry and pause gate', () => {
  const reward = make();
  reward.score = 500;
  reward.tick(0.01);
  const serial = reward.gainSerial;
  reward.score += 700;
  reward.tick(0.01);
  assert.equal(reward.gain, 1200, 'rapid related gains aggregate');
  assert.equal(reward.gainSerial, serial, 'one readable celebration per burst');
  for (let i = 0; i < 160; i++) reward.tick(1 / 120);
  let latest;
  reward.hooks = { ...hooks, onHud: (x) => (latest = x) };
  reward.tick(0.04);
  assert.equal(latest.gain, 0, 'expired reward is removed');
  reward.togglePause();
  const meter = reward.meter;
  reward.unleash();
  assert.equal(reward.meter, meter, 'pause cannot trigger quake');
});

test('quake charge gate and single payout; grants refund exactly', () => {
  const announced = [];
  const quake = make({ onAnnounce: (t) => announced.push(t) });
  quake.meter = 0.99;
  quake.unleash();
  assert.equal(quake.score, 0, 'charge gate is enforced');
  quake.meter = 1;
  quake.unleash();
  assert.equal(quake.meter, 0);
  assert.equal(quake.score, 5000);
  assert.ok(announced.some((t) => /mossquake/i.test(t)), 'quake is announced to screen readers');
  quake.quakeImpact();
  assert.equal(quake.score, 25000);
  quake.quakeImpact();
  assert.equal(quake.score, 25000, 'one contact payout');
  const refund = make();
  refund.commitSingle('A');
  assert.ok(refund.grants[0].points > 0);
  refund.refundRecent();
  assert.equal(refund.score, 0, 'scaled grant refunds exactly');
});

test('gamepad: standard mapping, edge detection, multi-pad merge', () => {
  const { GamepadInput } = game.gamepad;
  const pad = (...down) => ({ connected: true, buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: down.includes(i) })) });
  const g = new GamepadInput();
  const edges = [];
  const log = (action, isDown) => edges.push(`${action}${isDown ? '+' : '-'}`);
  g.poll(log, [pad(0)]);
  g.poll(log, [pad(0)]);
  assert.deepEqual(edges, ['A+'], 'held button fires once');
  g.poll(log, [pad(), pad(0, 1)]);
  g.poll(log, [pad(2, 3, 9), null]);
  assert.deepEqual(edges, ['A+', 'B+', 'A-', 'B-', 'C+', 'quake+', 'pause+']);
  edges.length = 0;
  g.poll(log, null);
  assert.deepEqual(edges, [], 'no Gamepad API is a no-op');
  g.poll(log, [{ connected: false, buttons: [{ pressed: true }] }]);
  assert.deepEqual(edges, ['C-', 'quake-', 'pause-'], 'disconnected pad releases');
});

test('gamepad drives the arcade like the keyboard', () => {
  const held = [];
  const a = make({ onHeld: (btn, d) => held.push([btn, d]) });
  let script = [];
  a.pad = { poll: (edge) => script.forEach(([act, d]) => edge(act, d)), reset() {} };
  script = [['A', true]];
  a.pollPads();
  assert.ok(a.keys.has('A'), 'face button 0 holds STRIDE');
  script = [['A', false], ['pause', true]];
  a.pollPads();
  assert.equal(a.mode, 'pause', 'Start pauses');
  assert.deepEqual(held, [['A', true], ['A', false]]);
});

test('in the menu the gamepad drives focus, not the game', () => {
  const menu = [];
  const a = make({ onMenuPad: (action) => menu.push(action) });
  a.mode = 'menu';
  let script = [];
  a.pad = { poll: (edge) => script.forEach(([act, d]) => edge(act, d)), reset() {} };
  script = [['down', true], ['A', true]];
  a.pollPads();
  script = [['A', false], ['B', true]];
  a.pollPads();
  assert.deepEqual(menu, ['down', 'A', 'B'], 'presses (not releases) reach the menu');
  assert.ok(!a.keys.has('A'), 'no stride from the menu');
  assert.equal(a.mode, 'menu');
  assert.equal(game.gamepad.PAD_MAP[12], 'up');
  assert.equal(game.gamepad.PAD_MAP[15], 'right');
});

test('asset preload plan is priority ordered: stage + strut + notes first, fx last', () => {
  const plan = game.loader.assetPlan();
  const tiers = plan.map((j) => j.priority);
  assert.deepEqual(tiers, [...tiers].sort((x, y) => x - y), 'plan is sorted by priority');
  assert.equal(new Set(plan.map((j) => j.src)).size, plan.length, 'no asset is fetched twice');
  const first = plan.filter((j) => j.priority === 0).map((j) => j.src);
  assert.ok(first.some((s) => s.includes('strut')), 'strut frames are in the first tier');
  assert.ok(plan.at(-1).priority === 2);
});
