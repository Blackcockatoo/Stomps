/**
 * Arcade: the game engine hub. It owns all run state and the fixed-step loop;
 * the behaviour lives in ./engine modules, which take the Arcade as their first
 * argument:
 *   engine/input     Street Strut buttons, chords, buffered presses
 *   engine/scoring   points, Style meter, beat timing, MOSSQUAKE, refunds
 *   engine/street    movement and the authored street route
 *   engine/rhythm    rhythm chart judging, results, calibration math
 *   engine/motion    animation queue, foot contacts, cosmetic effects
 *   engine/renderer  canvas drawing
 *   engine/hud       in-canvas HUD and the React HUD feed
 *   engine/loader    prioritised asset preload with progress
 * Engine modules call each other through the hub's methods (never by importing
 * one another), so the dependency graph stays a star and tests can stub any step.
 * Fields are public for those modules and the unit tests; they are not an API.
 */
import { BodySpring } from "./feel";
import { newFlow, type FlowState } from "./engine/flow";
import { Groove, pickTrack, soundtrackUrls } from "./audio";
import type { Btn } from "./arcade-types";
import { CHART_END_BEAT, buildChart, isDifficulty, type Difficulty } from "./chart";
import type { ClipId, FX } from "./clips";
import { SkinCache, type Frame } from "./skin";
import type { BonusRun } from "./bonus";
import { FULL_VIEW, type ViewSpan } from "./view";
import { CRUISE_PX, auditRoute, type StreetQuality, type StreetSpec } from "./route";
import { bakeWorld, type WorldArt } from "./scenery";
import { loadSave, resetBests as clearBests, updateSave, clampOffset, type SaveData, type Skin } from "./storage";
import { setKeyMap } from "./keys";
import * as input from "./engine/input";
import * as scoring from "./engine/scoring";
import * as street from "./engine/street";
import * as rhythm from "./engine/rhythm";
import * as motion from "./engine/motion";
import * as renderer from "./engine/renderer";
import * as hud from "./engine/hud";
import { installProbe, removeProbe } from "./engine/probe";
import { emptyArt, loadArt } from "./engine/loader";
import { GamepadInput, type PadAction } from "./engine/gamepad";
import {
  SIM_DT,
  type Bird,
  type Grant,
  type Hooks,
  type Judge,
  type LiveNote,
  type Mode,
  type Mote,
  type Popup,
  type RunKind,
  type Spark,
  type Step,
  type StreetMark,
  type Trail,
  type Wave,
} from "./engine/types";

export type { Btn };
export type { Mode, Judge, ResultStats, LiveHud, Hooks } from "./engine/types";
export { COMBOS } from "./engine/combos";
export { debugEnabled } from "./engine/probe";
export { calibrateOffset, CALIBRATION_MIN_TAPS, CALIBRATION_WARMUP, type Calibration } from "./engine/rhythm";

export class Arcade {
  ctx2d: CanvasRenderingContext2D;
  groove = new Groove();
  raf = 0;
  last = 0;
  accumulator = 0;
  readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  impactLife = 0;
  hudClock = 0;
  displayScore = 0;
  body = new BodySpring();
  rewardLife = 0;
  rewardWindow = 0;
  rewardPower = 0;
  trailClock = 0;
  trails: Trail[] = [];
  observedScore = 0;
  gain = 0;
  gainSerial = 0;
  motes: Mote[] = [];
  nextMilestone = hud.MILESTONE_STEP;
  bestRoute = 0;
  routeMaxChain = 0;
  dead = false;
  probe: object | null = null;
  keys = new Set<Btn>();
  pad = new GamepadInput();
  mode: Mode = "menu";
  runKind: RunKind = "free";
  runSeed = 0;
  private routeStarts = 0;
  lastTechnique: { name: string; at: number } | null = null;
  pausedFrom: Mode = "strut";
  save: SaveData;

  clips = new Map<ClipId, HTMLImageElement[]>();
  skin: Skin = "classic";
  readonly skinCache = new SkinCache();
  fx = new Map<keyof typeof FX, HTMLImageElement[]>();
  stage = new Map<string, HTMLImageElement>();
  birdsImg: HTMLImageElement[] = [];
  notesImg: HTMLImageElement[] = [];
  world: WorldArt | null = null;
  ready = false;
  loadError = "";
  loadDone = 0;
  loadTotal = 0;

  queue: Step[] = [{ clip: "strut", speed: 1, once: false, flip: false }];
  stepIndex = 0;
  frame = 0;
  frameAcc = 0;
  scroll = 0;
  shake = 0;
  flash = 0;
  callout = "";
  calloutLife = 0;
  popups: Popup[] = [];
  sparks: Spark[] = [];
  waves: Wave[] = [];
  birds: Bird[] = [
    { x: 40, y: 46, t: 0.2, vy: 0, scare: 0 },
    { x: 210, y: 34, t: 1.1, vy: 0, scare: 0 },
    { x: 430, y: 52, t: 0.6, vy: 0, scare: 0 },
    { x: 690, y: 38, t: 1.8, vy: 0, scare: 0 },
    { x: 980, y: 28, t: 0.4, vy: 0, scare: 0 },
  ];

  score = 0;
  flowState: FlowState = newFlow();
  meter = 0;
  streak = 0;
  bestStrut = 0;
  bestRhythm = 0;
  /** Rhythm highway shift in seconds. Positive draws notes sooner. */
  audioOffset = 0;
  lastBtn: Btn | null = null;
  sameRun = 0;
  recent: Btn[] = [];
  seq: { btn: Btn; t: number }[] = [];
  now = 0;
  idleFor = 0;
  faceLeft = false;
  quakeLock = 0;
  quakeHit = false;
  buffered: Btn | null = null;
  bufferAt = 0;
  grants: Grant[] = [];
  downAt = new Map<Btn, number>();
  streetPending = new Map<Btn, number>();
  streetMarks = new Map<string, StreetMark>();
  streetCued = new Set<string>();
  flow = CRUISE_PX;
  lap = 0;
  /** Street hits landed this lap (opens the bonus door at DOOR_HITS). */
  lapHits = 0;
  /** Pier gauntlet: six precision opportunities before the bonus door. */
  pierPerfect = 0;
  pierMiss = 0;
  goldenCleared = 0;
  /** On-screen slice of the playfield (portrait phones crop the sides). */
  view: ViewSpan = FULL_VIEW;
  /** Active bonus-world segment, if Moss went through the door. */
  bonus: BonusRun | null = null;
  bonusSerial = 0;
  bonusCleared = 0;
  /** Laps whose door has been passed (entered or shut) / announced. */
  doorDone = new Set<number>();
  doorHinted = new Set<number>();
  streetPerfect = 0;
  streetGood = 0;
  streetMiss = 0;
  lastPlayKey = "";
  lastPlayAt = -1;
  animWatch = 0;
  lastFrameSeen = 0;
  lastPlantFrame = -1;

  chart: LiveNote[] = [];
  rhythmCombo = 0;
  maxCombo = 0;
  counts = { perfect: 0, fresh: 0, late: 0, stumble: 0 };
  judgeText = "";
  judgeLife = 0;
  songDur = 0;
  difficulty: Difficulty = "normal";
  /** Tap-along calibration taps (groove seconds); null when not calibrating. */
  calTaps: number[] | null = null;

  constructor(
    public canvas: HTMLCanvasElement,
    public hooks: Hooks,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    this.ctx2d = ctx;
    this.save = loadSave();
    this.bestRoute = this.save.best.route;
    this.bestStrut = this.save.best.strut;
    this.bestRhythm = this.save.best.rhythm;
    this.audioOffset = this.save.audioOffset;
    this.difficulty = this.save.difficulty;
    this.skin = this.save.skin;
    this.groove.setLevel(this.save.audio.volume, this.save.audio.muted);
    setKeyMap(this.save.keys);
    this.hooks.onRouteBest?.(this.bestRoute);
    this.hooks.onBest({ strut: this.bestStrut, rhythm: this.bestRhythm });
  }

  start() {
    void this.boot();
    const loop = (t: number) => {
      if (this.dead) return;
      const dt = Math.min(0.1, this.last ? (t - this.last) / 1000 : 0);
      this.last = t;
      this.pollPads();
      this.accumulator += dt;
      while (this.accumulator >= SIM_DT) {
        this.tick(SIM_DT);
        this.accumulator -= SIM_DT;
      }
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    installProbe(this);
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.groove.stop();
    removeProbe(this);
  }

  async boot() {
    if (typeof document !== "undefined") {
      this.groove.trackUrl = pickTrack(soundtrackUrls(), (mime) => document.createElement("audio").canPlayType(mime));
    }
    try {
      const art = emptyArt();
      this.clips = art.clips;
      this.fx = art.fx;
      this.stage = art.stage;
      this.birdsImg = art.birds;
      this.notesImg = art.notes;
      await loadArt(art, (done, total) => {
        this.loadDone = done;
        this.loadTotal = total;
        this.hooks.onProgress?.(done, total);
      });
      this.warmSkin();
      const problems = auditRoute();
      if (problems.length) {
        this.loadError = problems[0] ?? "Route audit failed";
        this.hooks.onError(this.loadError);
        return;
      }
      this.world = bakeWorld();
      this.ready = true;
      this.hooks.onReady();
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : "Asset load failed";
      this.hooks.onError(this.loadError);
    }
  }

  // ── Settings (persisted in the versioned save) ─────────────────────────

  nudgeSync(dir: number) {
    this.setAudioOffset(Math.round((this.audioOffset + dir * 0.01) * 1000) / 1000);
  }

  setAudioOffset(seconds: number) {
    this.audioOffset = clampOffset(seconds);
    this.save = updateSave((save) => {
      save.audioOffset = this.audioOffset;
    });
  }

  setAudio(volume: number, muted: boolean) {
    this.save = updateSave((save) => {
      save.audio = { volume, muted };
    });
    this.groove.setLevel(this.save.audio.volume, this.save.audio.muted);
  }

  setKeys(keys: SaveData["keys"]) {
    this.save = updateSave((save) => {
      save.keys = keys;
    });
    setKeyMap(this.save.keys);
  }

  resetBests() {
    this.save = clearBests();
    this.bestStrut = 0;
    this.bestRhythm = 0;
    this.bestRoute = 0;
    this.hooks.onBest({ strut: 0, rhythm: 0 });
    this.hooks.onRouteBest?.(0);
  }

  // ── Tap-along calibration (menu only; the groove plays a plain click) ──

  startCalibration() {
    if (this.mode !== "menu") return;
    this.groove.start(true);
    this.calTaps = [];
  }

  calibrationTap(): number {
    if (!this.calTaps || !this.groove.running) return 0;
    const count = this.calTaps.push(this.groove.now());
    // The hook may end the session (auto-stop at the target count), so report a local count.
    this.hooks.onCalTap?.(count);
    return count;
  }

  /** Stops the click. Returns the measured result (not yet applied) or null if too few taps. */
  stopCalibration(): rhythm.Calibration | null {
    const taps = this.calTaps;
    this.calTaps = null;
    if (this.mode === "menu") this.groove.stop();
    return taps ? rhythm.calibrateOffset(taps, this.groove.beatDur) : null;
  }

  songTime() {
    return Math.max(0, this.groove.now() + this.audioOffset);
  }

  // ── Modes ──────────────────────────────────────────────────────────────

  menu() {
    this.mode = "menu";
    this.calTaps = null;
    this.groove.stop();
    this.hooks.onMode("menu");
  }

  playStrut(kind: RunKind = "free") {
    this.calTaps = null;
    this.runKind = kind;
    this.runSeed = kind === "practice" ? 0 : this.routeStarts++ % 2;
    this.resetRound();
    this.scroll = 0;
    this.lap = 0;
    this.lapHits = 0;
    this.pierPerfect = 0;
    this.pierMiss = 0;
    this.goldenCleared = 0;
    this.bonus = null;
    this.bonusCleared = 0;
    this.doorDone.clear();
    this.doorHinted.clear();
    this.flow = CRUISE_PX;
    this.streetMarks.clear();
    this.streetCued.clear();
    this.streetPending.clear();
    this.streetPerfect = 0;
    this.streetGood = 0;
    this.streetMiss = 0;
    this.mode = "strut";
    this.groove.start();
    this.hooks.onMode("strut");
    this.play([{ clip: "strut", speed: 1, once: false, flip: false }]);
    this.callout = kind === "route" ? "ONE LAP. MAKE IT YOURS." : kind === "practice" ? "FIND YOUR FOOTWORK" : "DEPARTURE";
    this.calloutLife = 1.3;
  }

  /** Moss's frames for a clip in the chosen skin (cream frames are baked on first use). */
  mossFrames(clip: ClipId): Frame[] | undefined {
    const source = this.clips.get(clip);
    return this.skin === "cream" ? this.skinCache.frames(clip, source) : source;
  }

  /** Switches the hoodie skin and remembers it in the save. */
  setSkin(skin: Skin) {
    if (skin !== "classic" && skin !== "cream") return;
    this.skin = skin;
    this.save = updateSave((save) => {
      save.skin = skin;
    });
    this.warmSkin();
  }

  /** Bakes cream frames one clip per task so the first quake or spin never hitches. */
  warmSkin() {
    if (this.skin !== "cream" || typeof document === "undefined") return;
    const ids = [...this.clips.keys()];
    const next = () => {
      const id = ids.shift();
      if (id === undefined || this.dead || this.skin !== "cream") return;
      this.mossFrames(id);
      setTimeout(next, 0);
    };
    next();
  }

  /** Remembers the Rhythm Royalty difficulty in the save. */
  setDifficulty(difficulty: Difficulty) {
    if (!isDifficulty(difficulty)) return;
    this.difficulty = difficulty;
    this.save = updateSave((save) => {
      save.difficulty = difficulty;
    });
  }

  playRhythm(difficulty: Difficulty = this.difficulty) {
    if (difficulty !== this.difficulty) this.setDifficulty(difficulty);
    this.calTaps = null;
    this.resetRound();
    this.mode = "rhythm";
    this.counts = { perfect: 0, fresh: 0, late: 0, stumble: 0 };
    this.rhythmCombo = 0;
    this.maxCombo = 0;
    this.groove.start();
    this.songDur = CHART_END_BEAT * this.groove.beatDur;
    this.chart = buildChart(this.groove.beatDur, this.difficulty).map((note) => ({
      ...note,
      hit: false,
      missed: false,
      holding: false,
      failed: false,
    }));
    this.hooks.onMode("rhythm");
    this.play([{ clip: "strut", speed: 1, once: false, flip: false }]);
  }

  togglePause() {
    if (this.mode === "pause") {
      this.keys.clear();
      this.last = 0;
      this.accumulator = 0;
      this.mode = this.pausedFrom;
      this.groove.resume();
      this.hooks.onMode(this.mode);
      return;
    }
    if (this.mode !== "strut" && this.mode !== "rhythm") return;
    this.keys.clear();
    this.pausedFrom = this.mode;
    this.mode = "pause";
    this.groove.suspend();
    this.hooks.onMode("pause");
  }

  // ── Input ──────────────────────────────────────────────────────────────

  down(btn: Btn) {
    input.down(this, btn);
  }

  up(btn: Btn) {
    input.up(this, btn);
  }

  /** A single action for touch, keyboard assistive activation and the full-style HUD. */
  unleash() {
    if (!this.ready || (this.mode !== "strut" && this.mode !== "rhythm")) return;
    this.doQuake(this.mode === "rhythm");
  }

  pollPads() {
    this.pad.poll((action: PadAction, isDown: boolean) => {
      if (action === "pause") {
        if (isDown) this.togglePause();
        return;
      }
      if (action === "quake") {
        if (isDown) this.unleash();
        return;
      }
      if (isDown) {
        if (this.calTaps) this.calibrationTap();
        else this.down(action);
      } else this.up(action);
      this.hooks.onHeld?.(action, isDown);
    });
  }

  chordCheck() {
    return input.chordCheck(this);
  }

  commitSingle(btn: Btn) {
    input.commitSingle(this, btn);
  }

  announce(text: string) {
    this.hooks.onAnnounce?.(text);
  }

  // ── Simulation (fixed 120 Hz) ──────────────────────────────────────────

  resetRound() {
    this.score = 0;
    this.flowState = newFlow();
    this.displayScore = 0;
    this.observedScore = 0;
    this.gain = 0;
    this.rewardLife = 0;
    this.rewardWindow = 0;
    this.rewardPower = 0;
    this.trails = [];
    this.body = new BodySpring();
    this.motes = [];
    this.hudClock = 1;
    this.nextMilestone = hud.MILESTONE_STEP;
    this.routeMaxChain = 0;
    this.meter = 0;
    this.streak = 0;
    this.lastTechnique = null;
    this.seq = [];
    this.keys.clear();
    this.downAt.clear();
    this.shake = 0;
    this.flash = 0;
    this.callout = "";
    this.popups = [];
    this.sparks = [];
    this.faceLeft = false;
    this.quakeLock = 0;
    this.quakeHit = false;
    this.buffered = null;
    this.grants = [];
    this.waves = [];
    this.sameRun = 0;
    this.lastBtn = null;
    this.recent = [];
    this.now = 0;
    this.streetPending.clear();
  }

  tick(dt: number) {
    if (!this.ready) return;
    const frozen = this.mode === "pause" || this.mode === "result";
    if (!frozen) {
      this.now += dt;
      if (this.mode === "strut" || this.mode === "rhythm" || this.mode === "menu") {
        this.groove.pump();
      }
    }
    if (this.mode === "strut") this.tickStrut(dt);
    if (this.mode === "rhythm") this.tickRhythm(dt);
    if (this.mode === "menu") this.tickAttract(dt);
    if (frozen) return;
    hud.tickRewards(this, dt);
    motion.tickEffects(this, dt);
    hud.emitHud(this, dt);
    motion.tickParticles(this, dt);
    this.advanceAnim(dt);
  }

  tickAttract(dt: number) {
    this.scroll += dt * 70;
    this.faceLeft = false;
  }

  // ── Street route ───────────────────────────────────────────────────────

  tickStrut(dt: number) {
    street.tickStrut(this, dt);
  }

  /** Free-run best is saved whenever it is beaten. */
  recordStrutBest() {
    this.save = updateSave((save) => {
      save.best.strut = Math.max(save.best.strut, this.bestStrut);
    });
    this.hooks.onBest({ strut: this.bestStrut, rhythm: this.bestRhythm });
  }

  recordRouteBest() {
    this.save = updateSave((save) => {
      save.best.route = Math.max(save.best.route, this.bestRoute);
    });
    this.hooks.onRouteBest?.(this.bestRoute);
  }

  recordRhythmBest() {
    this.save = updateSave((save) => {
      save.best.rhythm = Math.max(save.best.rhythm, this.bestRhythm);
    });
    this.hooks.onBest({ strut: this.bestStrut, rhythm: this.bestRhythm });
  }

  finishRoute() {
    street.finishRoute(this);
  }

  mossWorld() {
    return street.mossWorld(this);
  }

  setView(view: ViewSpan) {
    this.view = view;
  }

  /** Scroll on the route itself: frozen at the door while in the bonus world. */
  routeScroll() {
    return this.bonus ? this.bonus.returnScroll : this.scroll;
  }

  streetViews() {
    return street.streetViews(this);
  }

  scanStreets() {
    street.scanStreets(this);
  }

  flushStreet() {
    street.flushStreet(this);
  }

  settleStreet(spec: StreetSpec, key: string, dist: number, perfectPx: number,
    quality: StreetQuality = "main", goodPx?: number) {
    street.settleStreet(this, spec, key, dist, perfectPx, quality, goodPx);
  }

  leadStreet() {
    return street.leadStreet(this);
  }

  // ── Rhythm ─────────────────────────────────────────────────────────────

  tickRhythm(dt: number) {
    rhythm.tickRhythm(this, dt);
  }

  rhythmDown(btn: Btn) {
    rhythm.rhythmDown(this, btn);
  }

  rhythmUp(btn: Btn) {
    rhythm.rhythmUp(this, btn);
  }

  finishRhythm() {
    rhythm.finishRhythm(this);
  }

  scoreRhythm(judge: Exclude<Judge, "OFF" | "STUMBLED"> | "FRESH", points: number) {
    rhythm.scoreRhythm(this, judge, points);
  }

  failRhythm(label: "STUMBLED") {
    rhythm.failRhythm(this, label);
  }

  // ── Scoring ────────────────────────────────────────────────────────────

  doQuake(fromRhythm: boolean) {
    scoring.doQuake(this, fromRhythm);
  }

  quakeImpact() {
    scoring.quakeImpact(this);
  }

  award(label: string, base: number, meterGain: number, combo: boolean) {
    scoring.award(this, label, base, meterGain, combo);
  }

  beatJudge(): Judge {
    return scoring.beatJudge(this);
  }

  refundRecent() {
    scoring.refundRecent(this);
  }

  // ── Animation ──────────────────────────────────────────────────────────

  play(steps: Step[]) {
    motion.play(this, steps);
  }

  mossX() {
    return motion.mossX(this);
  }

  currentClip(): ClipId {
    return motion.currentClip(this);
  }

  advanceAnim(dt: number) {
    motion.advanceAnim(this, dt);
  }

  burst(kind: keyof typeof FX, x: number, y: number) {
    motion.burst(this, kind, x, y);
  }

  // ── Rendering ──────────────────────────────────────────────────────────

  draw() {
    renderer.draw(this);
  }

  drawHud() {
    hud.drawHud(this);
  }
}
