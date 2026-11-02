const test = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./helpers.cjs');
const { audio } = game;

test('soundtrack is only used when the build advertises one', () => {
  assert.deepEqual(audio.soundtrackUrls(), [], 'no document, no meta: synth');
  assert.equal(audio.pickTrack([], () => 'probably'), null);
});

test('soundtrack picks a format the browser can play', () => {
  const urls = ['/audio/neon-strut.ogg', '/audio/neon-strut.mp3'];
  assert.equal(audio.pickTrack(urls, () => 'maybe'), urls[0]);
  assert.equal(audio.pickTrack(urls, (m) => (m.includes('ogg') ? '' : 'maybe')), urls[1]);
  assert.equal(audio.pickTrack(urls, () => ''), urls[0]);
});

function fakeCtx() {
  const made = { sources: [], oscillators: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
  const node = () => ({ connect() {}, disconnect() {}, gain: param(), frequency: param() });
  const ctx = {
    currentTime: 10,
    state: 'running',
    destination: node(),
    createGain: node,
    createBiquadFilter: node,
    createOscillator() { made.oscillators += 1; return { ...node(), start() {}, stop() {} }; },
    createBufferSource() {
      const src = { ...node(), loop: false, started: null, stopped: false, start(when, offset) { this.started = [when, offset]; }, stop() { this.stopped = true; } };
      made.sources.push(src);
      return src;
    },
  };
  return { ctx, made };
}

test('recorded track loops in sync and replaces only the synth loop', () => {
  const g = new audio.Groove();
  const { ctx, made } = fakeCtx();
  g.ctx = ctx;
  g.track = { duration: 60 / 104 * 16 };
  g.start();
  const src = made.sources.at(-1);
  assert.ok(src.loop);
  assert.equal(src.started[0], g['startAt'], 'starts on the beat clock');
  assert.equal(src.started[1], 0);
  assert.ok(g.recorded);
  const before = made.oscillators;
  ctx.currentTime = 11;
  g.pump();
  assert.equal(made.oscillators, before, 'synth drums and bass are muted');
  g.stomp();
  assert.ok(made.oscillators > before, 'SFX stay synthesised');
  g.start(true);
  assert.ok(src.stopped, 'metronome calibration drops the track');
  assert.ok(!g.recorded);
  g.stop();
});

test('without a track the synth groove plays as before', () => {
  const g = new audio.Groove();
  const { ctx, made } = fakeCtx();
  ctx.createBufferSource = () => { made.sources.push(1); return { connect() {}, start() {}, stop() {} }; };
  g.ctx = ctx;
  g.noise = {};
  g.start();
  ctx.currentTime = 11;
  g.pump();
  assert.ok(made.oscillators > 0);
  assert.ok(!g.recorded);
});
