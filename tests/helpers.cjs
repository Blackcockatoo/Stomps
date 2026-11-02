// Shared harness for the node:test suites. Bundles the TypeScript game modules
// into ONE CommonJS file per test process (so module-level state such as the
// key map is shared between the Arcade and the helpers under test) and stubs
// the few browser globals the engine touches.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');

const root = path.resolve(__dirname, '..');
let raf = null;
global.window = { matchMedia: () => ({ matches: false }) };
global.requestAnimationFrame = (fn) => ((raf = fn), 1);
global.cancelAnimationFrame = () => {};

/** In-memory localStorage; pass seed entries, inspect `.data`. */
function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { data, getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => void data.set(k, String(v)) };
}
const blockedStorage = () => ({ getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
global.localStorage = memoryStorage();

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moss-test-'));
const outfile = path.join(dir, 'game.cjs');
buildSync({
  stdin: {
    contents: [
      "export * as arcade from './src/game/arcade';",
      "export * as feel from './src/game/feel';",
      "export * as storage from './src/game/storage';",
      "export * as keys from './src/game/keys';",
      "export * as gamepad from './src/game/engine/gamepad';",
      "export * as rhythm from './src/game/engine/rhythm';",
      "export * as loader from './src/game/engine/loader';",
      "export * as chart from './src/game/chart';",
      "export * as route from './src/game/route';",
      "export * as skin from './src/game/skin';",
      "export * as bonus from './src/game/bonus';",
      "export * as audio from './src/game/audio';",
      "export * as report from './src/game/report';",
      "export * as view from './src/game/view';",
    ].join('\n'),
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  logLevel: 'error',
});
const game = require(outfile);
process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));

const hooks = { onMode() {}, onResult() {}, onReady() {}, onError() {}, onBest() {} };

function stubGroove() {
  return {
    running: false, beatDur: 60 / 104, t: 0,
    pump() {}, cue() {}, perfect() {}, miss() {}, unlock() {}, stomp() {}, style() {}, combo() {}, quake() {},
    suspend() {}, resume() {}, setLevel() {},
    start() { this.running = true; }, stop() { this.running = false; },
    now() { return this.t; },
  };
}

/** A ready Arcade in strut mode with silent audio and no drawing. */
function make(extraHooks = {}) {
  const a = new game.arcade.Arcade({ getContext: () => ({}) }, { ...hooks, ...extraHooks });
  a.groove = stubGroove();
  a.boot = async () => {};
  a.draw = () => {};
  a.ready = true;
  a.mode = 'strut';
  return a;
}

module.exports = { game, hooks, make, memoryStorage, blockedStorage, frame: (t) => raf(t) };
