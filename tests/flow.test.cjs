const test = require('node:test');
const assert = require('node:assert/strict');
const { game, make } = require('./helpers.cjs');
const f = game.flow;
test('FLOW requires successful encounters and reaches level five after fourteen', () => {
  let s=f.newFlow();
  assert.equal(s.level,0);
  for(let i=1;i<=14;i++){s=f.flowHit(s);assert.equal(s.level,f.flowLevel(i));}
  assert.equal(s.level,5);
  assert.equal(s.longest,14);
  assert.equal(s.peak,5);
  assert.equal(f.flowMultiplier(s),1.6);
});
test('misses cut chain; beat timing within grace window restores some FLOW', () => {
  let s=f.newFlow();
  for(let i=0;i<10;i++)s=f.flowHit(s);
  s=f.flowMiss(s,4);
  assert.equal(s.chain,5);
  assert.equal(s.peak,4);
  assert.equal(f.canRecover(s,4.1,'PERFECT'),false);
  assert.equal(f.canRecover(s,4.4,'LATE'),false);
  assert.equal(f.canRecover(s,5.9,'PERFECT'),false);
  const recovered=f.flowRecover(s,4.5,'FRESH');
  assert.equal(recovered.chain,8);
  assert.equal(recovered.recoveryUntil,0);
  assert.deepEqual(f.flowRecover(recovered,4.6,'FRESH'),recovered);
});
test('successful street encounter replaces speculative press points', () => {
  const a=make(), spec=game.route.STREETS[0];
  a.commitSingle('B');
  assert.ok(a.score>0);
  a.settleStreet(spec,'one',0,13);
  assert.equal(a.flowState.chain,1);
  assert.equal(a.streetPerfect,1);
  assert.equal(a.grants.length,0);
  assert.ok(a.score>=3500);
  a.settleStreet(spec,'two',100,13);
  assert.equal(a.flowState.chain,2);
});
test('misses affect charge, cause stumble and allow recovery', () => {
  const a=make();
  let state=f.newFlow();
  for(let i=0;i<9;i++)state=f.flowHit(state);
  a.flowState=state;
  a.meter=0.8;
  const spec=game.route.STREETS[0];
  a.scroll=game.route.streetX(spec)-40-132;
  a.scanStreets(); // first warn the player; this is an actionable challenge
  a.scroll=game.route.streetX(spec)+70-132;
  a.scanStreets();
  assert.ok(a.streetMiss>=1);
  assert.equal(a.flowState.chain,4);
  assert.ok(a.meter<0.71);
  assert.equal(a.callout,'STUMBLED / RECOVER ON BEAT');
  a.now+=0.35;
  a.commitSingle('C');
  assert.ok(a.flowState.chain>=7);
  assert.equal(a.flowState.recoveryUntil,0);
});
test('button tapping without a street hit does not earn FLOW', () => {
  const a=make();
  for(let i=0;i<8;i++){a.now+=0.9;a.commitSingle('B');}
  assert.equal(a.flowState.chain,0);
  assert.equal(a.flowState.level,0);
});

test('jumping ahead of unannounced street events never penalises the player', () => {
  const a=make();
  const spec=game.route.STREETS[0];
  a.scroll=game.route.streetX(spec)+70-132;
  a.scanStreets();
  assert.equal(a.streetMiss,0);
  assert.equal(a.flowState.chain,0);
});
