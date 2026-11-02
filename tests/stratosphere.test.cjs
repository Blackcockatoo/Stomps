const test = require('node:test');
const assert = require('node:assert/strict');
const {game, make, memoryStorage} = require('./helpers.cjs');

test('real down/up combo inputs register during committed animations without replay payouts', () => {
  const a=make(); a.playStrut('route');
  a.play([{clip:'quake',speed:1,once:true,flip:false}]); a.quakeHit=true;
  let name; a.hooks.onPractice = n => name=n;
  for (const [button,time] of [['B',0],['B',0.2],['C',0.4]]) {
    a.now=time; a.groove.t=time; a.down(button); a.up(button);
  }
  assert.equal(name,'DOUBLE TROUBLE');
  assert.equal(a.currentClip(),'quake','committed contact is preserved');
  assert.ok(a.bufferedSteps);
  const score=a.score;
  for(let i=0;i<150;i++) a.advanceAnim(1/120);
  assert.equal(a.score,score,'animation dequeue cannot award a second time');
});

test('contact scoring is idempotent and rejects out-of-window or nonfinite claims',()=>{
 const a=make(), s=game.route.STREETS[0];
 a.settleStreet(s,'one',0,13); const score=a.score;
 for(let i=0;i<50;i++)a.settleStreet(s,'one',0,13);
 a.settleStreet(s,'far',100,13); a.settleStreet(s,'nan',NaN,13);
 assert.equal(a.score,score); assert.equal(a.flowState.chain,1);
});

test('empty-pavement spam has one small payout per musical beat',()=>{
 const a=make(); a.groove.running=true;
 a.commitSingle('B');const score=a.score;
 for(let i=0;i<30;i++){a.now+=.005;a.commitSingle(['A','B','C'][i%3]);}
 assert.equal(a.score,score);assert.equal(a.flowState.chain,0);
});

test('recovery awards no extra points and cannot restore the missed chain fully',()=>{
 const a=make(),b=make();let f=game.flow.newFlow();
 for(let i=0;i<10;i++)f=game.flow.flowHit(f);
 a.flowState=game.flow.flowMiss(f,0); a.now=b.now=.5;
 a.commitSingle('A');b.commitSingle('A');
 assert.equal(a.score,b.score);assert.equal(a.flowState.chain,8);
 assert.equal(game.flow.canRecover(a.flowState,.6,'PERFECT'),false);
});

test('pause discards pending chords, animation buffers and combo history',()=>{
 const a=make();a.down('B');a.now=.2;a.down('C');
 a.togglePause();assert.equal(a.bufferedSteps,null);assert.equal(a.streetPending.size,0);assert.equal(a.seq.length,0);
 const scroll=a.scroll;a.tick(.5);assert.equal(a.scroll,scroll);
});

test('mastery grades demand coverage, precision, techniques and Golden execution',()=>{
 const p={perfect:18,good:0,missed:0,expected:18,longest:18,techniques:5,bonus:1,golden:1};
 assert.equal(game.mastery.assess(p).grade,'S++');
 assert.equal(game.mastery.assess({...p,techniques:3}).grade,'S+');
 assert.equal(game.mastery.assess({...p,techniques:2}).grade,'S');
 assert.equal(game.mastery.assess({...p,techniques:0}).grade,'A');
 assert.equal(game.mastery.assess({...p,perfect:0}).grade,'D');
 assert.notEqual(game.mastery.assess({...p,perfect:17,missed:1}).grade,'S++');
});

test('variant records preserve old saves, sanitize corruption and reset cleanly',()=>{
 const old=game.storage.sanitize({best:{route:1234}});assert.deepEqual(old.routeRecords,{});assert.equal(old.best.route,1234);
 const store=memoryStorage();
 game.storage.updateSave(s=>s.routeRecords['stratosphere-1']={score:100,grade:'S'},store);
 assert.equal(game.storage.loadSave(store).routeRecords['stratosphere-1'].score,100);
 assert.deepEqual(game.storage.resetBests(store).routeRecords,{});
});

function replay(strategy,seed=0){
 let result;const a=make({onResult:r=>result=r});a.playStrut('route');a.runSeed=seed;
 for(let frame=0; frame<120*360 && a.mode==='strut';frame++){
  a.groove.t=a.now;
  if(strategy==='precise'){
   const v=a.streetViews().find(v=>!a.streetMarks.has(v.key)&&Math.abs(v.dist)<.8);
   if(v){for(const b of v.spec.trigger)a.down(b);for(const b of v.spec.trigger)a.up(b);}
  }else if(frame%10===0){const b=strategy==='repeat'?'B':['A','B','C'][Math.floor(frame/10)%3];a.down(b);a.up(b);}
  a.tick(1/120);
 }
 assert.ok(result,'route finishes within fixed replay budget');
 return {score:a.score,perfect:a.streetPerfect,missed:a.streetMiss,grade:result.mastery};
}
test('deterministic whole-route replay: accurate play beats repeat and varied mashing on both variants',()=>{
 for(const seed of [0,1]){
  const skilled=replay('precise',seed), repeated=replay('repeat',seed),mash=replay('mash',seed);
  assert.deepEqual(replay('precise',seed),skilled);
  assert.ok(skilled.score>repeated.score,JSON.stringify({skilled,repeated}));
  assert.ok(skilled.score>mash.score,JSON.stringify({skilled,mash}));
  assert.equal(skilled.missed,0);assert.ok(skilled.perfect>=18);
 }
});
