const test = require('node:test');
const assert = require('node:assert/strict');
const { game, make } = require('./helpers.cjs');
const { bonus, route } = game;

function nearDoor(kind = 'route') {
  const said = [];
  const a = make({ onAnnounce: (t) => said.push(t) });
  a.playStrut(kind);
  a.scroll = bonus.doorWorld(0) - a.mossX() - 200;
  return { a, said };
}
function run(a, seconds) {
  for (let i = 0; i < seconds * 120; i += 1) a.tick(1 / 120);
}
function runUntil(a, done, seconds = 30) {
  for (let i = 0; i < seconds * 120 && !done(); i += 1) a.tick(1 / 120);
}

test('door opens on a full Quake Drive or enough hits this lap', () => {
  assert.equal(bonus.doorOpen(0, 0), false);
  assert.equal(bonus.doorOpen(0.99, bonus.DOOR_HITS - 1), false);
  assert.equal(bonus.doorOpen(1, 0), true);
  assert.equal(bonus.doorOpen(0, bonus.DOOR_HITS), true);
});

test('door sits on the pier, before home, every lap', () => {
  const pier = route.ZONES.find((z) => z.id === 'pier');
  const x = bonus.doorWorld(0);
  assert.ok(x > pier.start && x < pier.start + pier.px);
  assert.ok(x < route.ROUTE_PX);
  assert.equal(bonus.doorWorld(2) - bonus.doorWorld(1), route.ROUTE_PX);
});

test('bonus segment is denser than the route and uses real street events', () => {
  const specs = bonus.bonusSpecs();
  assert.ok(specs.length >= 6);
  assert.equal(new Set(specs.map((s) => s.uid)).size, specs.length);
  for (const s of specs) {
    assert.equal(s.body, false);
    assert.ok(route.STREETS.some((t) => t.id === s.id));
  }
  const routeGap = route.ROUTE_PX / route.STREETS.length;
  assert.ok(bonus.BONUS_GAP < routeGap, `bonus gap ${bonus.BONUS_GAP} vs route ${routeGap}`);
});

test('an open door takes Moss into the bonus world and back to the pier', () => {
  const { a, said } = nearDoor();
  a.meter = 1;
  runUntil(a, () => !!a.bonus);
  assert.ok(a.bonus, 'entered bonus');
  assert.ok(said.some((t) => /door ahead is open/i.test(t)));
  assert.ok(said.some((t) => /bonus world/i.test(t)));
  const views = a.streetViews();
  assert.ok(views.length > 0 && views.every((v) => v.key.startsWith('bonus-')));
  const back = a.bonus.returnScroll;
  runUntil(a, () => !a.bonus, 60);
  assert.equal(a.bonus, null);
  assert.equal(a.bonusCleared, 1);
  assert.ok(a.scroll >= back && a.scroll < back + 10, `scroll ${a.scroll} near ${back}`);
  assert.ok(said.some((t) => /back on the pier/i.test(t)));
  assert.equal(a.mode, 'strut', 'route continues after the bonus');
  // The door does not reopen on the same lap.
  run(a, 1);
  assert.equal(a.bonus, null);
});

test('bonus hits score double', () => {
  const plain = make(); plain.playStrut('route');
  const boosted = make(); boosted.playStrut('route');
  boosted.bonus = { serial: 1, returnScroll: 0, start: 1e5, specs: bonus.bonusSpecs() };
  const spec = route.STREETS.find((s) => s.id === 'puddle');
  plain.settleStreet(spec, 'a', 0, 99);
  boosted.settleStreet(spec, 'a', 0, 99);
  assert.ok(plain.score > 0);
  assert.equal(boosted.score, plain.score * bonus.BONUS_MULT);
  assert.equal(plain.lapHits, 1);
  assert.equal(boosted.lapHits, 0, 'bonus hits do not count toward the door');
});

test('a shut door is announced and passed by', () => {
  const { a, said } = nearDoor();
  runUntil(a, () => a.doorDone.has(0));
  assert.equal(a.bonus, null);
  assert.ok(said.some((t) => /door ahead is shut/i.test(t)));
});

test('practice runs never show the door', () => {
  const { a, said } = nearDoor('practice');
  a.meter = 1;
  run(a, 4);
  assert.equal(a.bonus, null);
  assert.ok(!said.some((t) => /door/i.test(t)));
});

test('a new strut clears bonus state', () => {
  const { a } = nearDoor();
  a.meter = 1;
  runUntil(a, () => !!a.bonus);
  a.playStrut('route');
  assert.equal(a.bonus, null);
  assert.equal(a.bonusCleared, 0);
  assert.equal(a.doorDone.size, 0);
});

test('six perfect pier encounters unlock a golden gate without existing charge',()=>{
  const {a}=nearDoor();
  const pier=route.STREETS.filter((s)=>s.zone==='pier');
  assert.equal(pier.length,6);
  assert.equal(bonus.pierCrown(5,0),false);
  assert.equal(bonus.pierCrown(6,1),false);
  for(let i=0;i<pier.length;i++)a.settleStreet(pier[i],'pier-perfect-'+i,0,99);
  assert.equal(a.pierPerfect,6);
  assert.equal(a.pierMiss,0);
  assert.equal(bonus.pierCrown(a.pierPerfect,a.pierMiss),true);
  a.meter=0;
  assert.ok(a.lapHits<bonus.DOOR_HITS);
  a.scroll=bonus.doorWorld(0)-a.mossX()+1;
  bonus.tickDoor(a);
  assert.ok(a.bonus,'perfect pier run opens door');
  assert.equal(a.bonus.multiplier,bonus.GOLDEN_MULT);
  bonus.exitBonus(a);
  assert.equal(a.goldenCleared,1);
});

test('golden pier world pays triple while regular bonus pays double',()=>{
  const s=route.STREETS.find((x)=>x.id==='puddle');
  function run(multiplier){
    const a=make();a.playStrut('route');
    a.bonus={serial:1,returnScroll:0,start:50000,specs:bonus.bonusSpecs(),multiplier};
    a.settleStreet(s,'x',0,99);
    return a.score;
  }
  assert.equal(run(2)*3,run(3)*2);
});
