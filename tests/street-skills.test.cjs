const test=require('node:test');
const assert=require('node:assert/strict');
const {game,make}=require('./helpers.cjs');
const route=game.route;
const item=(name)=>route.STREETS.find((s)=>s.id===name);

test('primary and alternate street moves plus named technique mapping',()=>{
  const p=item('puddle');
  assert.equal(route.streetSolution(p,['A']),'main');
  assert.equal(route.streetSolution(p,['C']),'alternative');
  assert.equal(route.streetSolution(p,['B']),null);
  assert.equal(route.streetTechnique(p,'FRANKSTON SHUFFLE'),true);
  assert.equal(route.streetTechnique(p,'DOUBLE TROUBLE'),false);
  assert.equal(route.streetPrefix(item('trolley'),['A']),true);
});

test('an alternate move is valid but pays less than the signposted move',()=>{
  const p=item('puddle');
  function run(btn){
    const a=make();a.playStrut('route');
    a.scroll=route.streetX(p)-a.mossX();
    a.streetPending.set(btn,a.now);a.flushStreet();return a;
  }
  const main=run('A'),alt=run('C');
  assert.equal(main.streetPerfect,1);
  assert.equal(alt.streetPerfect,1);
  assert.equal(alt.flowState.chain,1);
  assert.ok(main.score>alt.score);
});

test('named technique earns the special context-sensitive bonus',()=>{
  const p=item('puddle');
  function run(tech){
    const a=make();a.playStrut('route');
    a.scroll=route.streetX(p)-a.mossX();
    if(tech)a.lastTechnique={name:'FRANKSTON SHUFFLE',at:a.now};
    a.streetPending.set('C',a.now);a.flushStreet();return a;
  }
  const basic=run(false),pro=run(true);
  assert.ok(pro.score>basic.score);
  assert.equal(pro.streetPerfect,1);
  assert.equal(pro.lastTechnique,null);
  assert.equal(pro.callout,'SIGNATURE TECHNIQUE!');
});

test('late precision pays a close-call bonus only on non-person objects',()=>{
  const s=item('skateboard');
  function run(dist){
    const a=make();a.settleStreet(s,'x',dist,12,'main',30);return a;
  }
  const safe=run(-20),close=run(-27);
  assert.ok(close.score>safe.score);
  assert.equal(close.callout,'CLOSE CALL!');
  const person=make();person.settleStreet(item('commuter'),'x',-27,12,'main',30);
  assert.notEqual(person.callout,'CLOSE CALL!');
});

test('second run varies authored objects while preserving positions and human encounters',()=>{
  const p=item('puddle'), encore=route.streetForLap(p,1,0);
  assert.equal(route.streetForLap(p,0,0),p);
  assert.equal(encore.id,'newspaper');
  assert.equal(encore.uid,p.uid);
  assert.equal(encore.zone,p.zone);
  assert.equal(encore.at,p.at);
  assert.equal(route.streetForLap(item('commuter'),1,0),item('commuter'));
  assert.deepEqual(route.auditRoute(),[]);
  const a=make();
  a.playStrut('route');assert.equal(a.runSeed,0);
  a.playStrut('route');assert.equal(a.runSeed,1);
  a.playStrut('route');assert.equal(a.runSeed,0);
});
