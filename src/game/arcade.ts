import { BodySpring, pointsFor } from "./feel";
import { Groove } from "./audio";
import type { Btn } from "./arcade-types";
import { CHART_END_BEAT, buildChart, type ChartNote, type Lane } from "./chart";
import { ANIM, BIRD_FRAMES, CELL, FX, PLAY_CLIPS, STAGE, UI, birdSrc, type ClipId } from "./clips";
import {
  CRUISE_PX,
  ROUTE_PX,
  STREETS,
  auditRoute,
  gradeAt,
  isPrefix,
  plateWeight,
  sameTrigger,
  streetX,
  triggerLabel,
  windowsFor,
  zoneSample,
  type StreetSpec,
} from "./route";
import {
  bakeWorld,
  cycleOf,
  paintBackdrop,
  paintGlow,
  paintMarks,
  paintPips,
  paintProp,
  paintStreet,
  type WorldArt,
} from "./scenery";

export type { Btn };
export type Mode = "menu" | "strut" | "rhythm" | "pause" | "result";
export type Judge = "PERFECT" | "FRESH" | "LATE" | "STUMBLED" | "OFF";

export type ResultStats = {
  kind?: "rhythm" | "route";
  seconds?: number;
  personalBest?: number;
  newRecord?: boolean;
  score: number;
  perfect: number;
  fresh: number;
  late: number;
  stumble: number;
  maxCombo: number;
};

type Step = {
  clip: ClipId;
  speed: number;
  once: boolean;
  flip: boolean;
  from?: number;
  to?: number;
  hold?: boolean;
};
type Popup = { text: string; life: number; x: number; y: number; gold: boolean };
type Spark = { kind: keyof typeof FX; t: number; x: number; y: number };
type LiveNote = ChartNote & { hit: boolean; missed: boolean; holding: boolean; failed: boolean };
type Wave = { x: number; r: number; life: number };
type Bird = { x: number; y: number; t: number; vy: number; scare: number };
type Grant = { points: number; meter: number; at: number };
type StreetMark = { kind: "perfect" | "good" | "miss"; at: number };

const W = 480;
const H = 270;
const GROUND = 228;
const MOSS_X = 132;

export const COMBOS: { name: string; keys: Btn[]; steps: Step[]; bonus: number; meter: number }[] = [
  {
    name: "STREET CORONATION",
    keys: ["A", "B", "C", "B"],
    steps: [
      { clip: "style", speed: 1.15, once: true, flip: false, from: 0, to: 4 },
      { clip: "stomp", speed: 1.2, once: true, flip: false, from: 1, to: 6 },
      { clip: "style", speed: 1, once: true, flip: false, from: 2, to: 6 },
    ],
    bonus: 800,
    meter: 0.18,
  },
  {
    name: "HEEL-TOE HAMMER",
    keys: ["A", "A", "B"],
    steps: [
      { clip: "strut", speed: 1.85, once: true, flip: false, from: 0, to: 6 },
      { clip: "stomp", speed: 1.25, once: true, flip: false },
    ],
    bonus: 420,
    meter: 0.12,
  },
  {
    name: "ROYAL SWAGGER",
    keys: ["A", "C", "A"],
    steps: [{ clip: "style", speed: 1.05, once: true, flip: true }],
    bonus: 460,
    meter: 0.13,
  },
  {
    name: "DOUBLE TROUBLE",
    keys: ["B", "B", "C"],
    steps: [
      { clip: "stomp", speed: 1.35, once: true, flip: false },
      { clip: "stomp", speed: 1.45, once: true, flip: false },
      { clip: "style", speed: 1.1, once: true, flip: false, from: 2, to: 6 },
    ],
    bonus: 520,
    meter: 0.14,
  },
  {
    name: "FRANKSTON SHUFFLE",
    keys: ["C", "A", "B"],
    steps: [
      { clip: "slide", speed: 1.05, once: true, flip: false },
      { clip: "stomp", speed: 1.15, once: true, flip: false, from: 2, to: 6 },
    ],
    bonus: 480,
    meter: 0.13,
  },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Missing asset ${src}`));
    img.src = src;
  });
}

export type LiveHud = { score: number; meter: number; streak: number; gain: number; serial: number; label: string };

type Hooks = {
  onHud?: (hud: LiveHud) => void;
  onRouteBest?: (score: number) => void;
  onPractice?: (name: string) => void;
  onMode: (mode: Mode) => void;
  onResult: (stats: ResultStats) => void;
  onReady: () => void;
  onError: (message: string) => void;
  onBest: (best: { strut: number; rhythm: number }) => void;
};

export class Arcade {
  private ctx2d: CanvasRenderingContext2D;
  private groove = new Groove();
  private raf = 0;
  private last = 0;
  private accumulator = 0;
  private readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private impactLife = 0;
  private hudClock = 0;
  private displayScore = 0;
  private body = new BodySpring();
  private rewardLife = 0;
  private rewardWindow = 0;
  private rewardPower = 0;
  private trailClock = 0;
  private trails: { img: HTMLImageElement; x: number; y: number; flip: boolean; life: number }[] = [];
  private observedScore = 0;
  private gain = 0;
  private gainSerial = 0;
  private motes: { x:number; y:number; vx:number; vy:number; life:number; max:number; gold:boolean }[] = [];
  private bestRoute = 0;
  private routeMaxChain = 0;
  private dead = false;
  private probe: object | null = null;
  private keys = new Set<Btn>();
  mode: Mode = "menu";
  runKind: "free" | "route" | "practice" = "free";
  private pausedFrom: Mode = "strut";

  private clips = new Map<ClipId, HTMLImageElement[]>();
  private fx = new Map<keyof typeof FX, HTMLImageElement[]>();
  private stage = new Map<string, HTMLImageElement>();
  private birdsImg: HTMLImageElement[] = [];
  private notesImg: HTMLImageElement[] = [];
  private world: WorldArt | null = null;
  ready = false;
  private loadError = "";

  private queue: Step[] = [{ clip: "strut", speed: 1, once: false, flip: false }];
  private stepIndex = 0;
  private frame = 0;
  private frameAcc = 0;
  private scroll = 0;
  private shake = 0;
  private flash = 0;
  private callout = "";
  private calloutLife = 0;
  private popups: Popup[] = [];
  private sparks: Spark[] = [];
  private waves: Wave[] = [];
  private birds: Bird[] = [
    { x: 40, y: 46, t: 0.2, vy: 0, scare: 0 },
    { x: 210, y: 34, t: 1.1, vy: 0, scare: 0 },
    { x: 430, y: 52, t: 0.6, vy: 0, scare: 0 },
    { x: 690, y: 38, t: 1.8, vy: 0, scare: 0 },
    { x: 980, y: 28, t: 0.4, vy: 0, scare: 0 },
  ];

  score = 0;
  meter = 0;
  streak = 0;
  bestStrut = 0;
  bestRhythm = 0;
  /** Rhythm highway shift in seconds. Positive draws notes sooner. */
  audioOffset = 0;
  private lastBtn: Btn | null = null;
  private sameRun = 0;
  private recent: Btn[] = [];
  private seq: { btn: Btn; t: number }[] = [];
  private now = 0;
  private idleFor = 0;
  faceLeft = false;
  private quakeLock = 0;
  private quakeHit = false;
  private buffered: Btn | null = null;
  private bufferAt = 0;
  private grants: Grant[] = [];
  private downAt = new Map<Btn, number>();
  private streetPending = new Map<Btn, number>();
  private streetMarks = new Map<string, StreetMark>();
  private streetCued = new Set<string>();
  private flow = CRUISE_PX;
  private lap = 0;
  streetPerfect = 0;
  streetGood = 0;
  streetMiss = 0;
  private lastPlayKey = "";
  private lastPlayAt = -1;
  private animWatch = 0;
  private lastFrameSeen = 0;

  private chart: LiveNote[] = [];
  private rhythmCombo = 0;
  private maxCombo = 0;
  private counts = { perfect: 0, fresh: 0, late: 0, stumble: 0 };
  private judgeText = "";
  private judgeLife = 0;
  private songDur = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private hooks: Hooks,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    this.ctx2d = ctx;
    try { this.bestRoute = Math.max(0, Number(localStorage.getItem("moss-stomper-route-best-hyper")) || pointsFor(Number(localStorage.getItem("moss-stomper-route-best")) || 0)); } catch {}
    this.hooks.onRouteBest?.(this.bestRoute);
    this.bestStrut = readBest().strut;
    this.bestRhythm = readBest().rhythm;
    this.hooks.onBest({ strut: this.bestStrut, rhythm: this.bestRhythm });
    let saved: string | null = null;
    try { saved = localStorage.getItem("moss-stomper-offset"); } catch {}
    const parsed = saved ? Number(saved) : 0;
    if (Number.isFinite(parsed)) this.audioOffset = Math.max(-0.12, Math.min(0.12, parsed));
  }

  start() {
    void this.boot();
    const loop = (t: number) => {
      if (this.dead) return;
      const dt = Math.min(0.1, this.last ? (t - this.last) / 1000 : 0);
      this.last = t;
      this.accumulator += dt;
      while (this.accumulator >= 1 / 120) {
        this.tick(1 / 120);
        this.accumulator -= 1 / 120;
      }
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.installProbe();
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.groove.stop();
    this.removeProbe();
  }

  private async boot() {
    try {
      const jobs: Promise<void>[] = [];
      (Object.keys(PLAY_CLIPS) as ClipId[]).forEach((id) => {
        jobs.push(
          Promise.all(Array.from({ length: PLAY_CLIPS[id].frames }, (_, i) => loadImage(PLAY_CLIPS[id].src(i)))).then(
            (frames) => {
              this.clips.set(id, frames);
            },
          ),
        );
      });
      (Object.keys(FX) as (keyof typeof FX)[]).forEach((kind) => {
        jobs.push(
          Promise.all(Array.from({ length: 8 }, (_, i) => loadImage(FX[kind](i)))).then((frames) => {
            this.fx.set(kind, frames);
          }),
        );
      });
      STAGE.forEach((layer) => {
        jobs.push(
          loadImage(layer.src).then((img) => {
            this.stage.set(layer.id, img);
          }),
        );
      });
      jobs.push(
        Promise.all(Array.from({ length: BIRD_FRAMES }, (_, i) => loadImage(birdSrc(i)))).then((frames) => {
          this.birdsImg = frames;
        }),
      );
      jobs.push(
        Promise.all([loadImage(UI.noteA), loadImage(UI.noteB), loadImage(UI.noteC)]).then((imgs) => {
          this.notesImg = imgs;
        }),
      );
      jobs.push(loadFonts());
      await Promise.all(jobs);
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

  nudgeSync(dir: number) {
    this.audioOffset = Math.max(-0.12, Math.min(0.12, Math.round((this.audioOffset + dir * 0.01) * 1000) / 1000));
    try { localStorage.setItem("moss-stomper-offset", String(this.audioOffset)); } catch {}
  }

  private songTime() {
    return Math.max(0, this.groove.now() + this.audioOffset);
  }

  menu() {
    this.mode = "menu";
    this.groove.stop();
    this.hooks.onMode("menu");
  }

  playStrut(kind: "free" | "route" | "practice" = "free") {
    this.runKind = kind;
    this.resetRound();
    this.scroll = 0;
    this.lap = 0;
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

  playRhythm() {
    this.resetRound();
    this.mode = "rhythm";
    this.counts = { perfect: 0, fresh: 0, late: 0, stumble: 0 };
    this.rhythmCombo = 0;
    this.maxCombo = 0;
    this.groove.start();
    this.songDur = CHART_END_BEAT * this.groove.beatDur;
    this.chart = buildChart(this.groove.beatDur).map((note) => ({
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

  down(btn: Btn) {
    if (!this.ready || this.mode === "pause" || this.mode === "menu" || this.mode === "result") return;
    this.groove.unlock();
    if (this.keys.has(btn)) return;
    this.keys.add(btn);
    this.downAt.set(btn, this.now);
    if (this.mode === "rhythm") {
      this.rhythmDown(btn);
      return;
    }
    this.streetPending.set(btn, this.now);
    if (ANIM[this.currentClip()].lock) {
      this.buffered = btn;
      this.bufferAt = this.now;
      return;
    }
    if (this.chordCheck()) {
      this.flushStreet();
      return;
    }
    this.commitSingle(btn);
    this.flushStreet();
  }

  up(btn: Btn) {
    this.keys.delete(btn);
    if (this.mode === "rhythm") this.rhythmUp(btn);
  }

  /** A single action for touch, keyboard assistive activation and the full-style HUD. */
  unleash() {
    if (!this.ready || (this.mode !== "strut" && this.mode !== "rhythm")) return;
    this.doQuake(this.mode === "rhythm");
  }

  private resetRound() {
    this.score = 0;
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
    this.routeMaxChain = 0;
    this.meter = 0;
    this.streak = 0;
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

  private tick(dt: number) {
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
    if (this.score > this.observedScore) {
      const earned = this.score - this.observedScore;
      this.gain = this.rewardWindow > 0 ? this.gain + earned : earned;
      if (this.rewardWindow <= 0) this.gainSerial++;
      this.rewardWindow = 0.16;
      this.rewardLife = 1.25;
      this.rewardPower = Math.min(1, this.rewardPower + earned / 16000);
      if (!this.reducedMotion) {
        const count = this.gain >= 4000 ? 24 : 9;
        for (let i=0;i<count;i++) {
          const angle = i / count * Math.PI * 2;
          const speed = 28 + (i % 5) * 14;
          this.motes.push({x:this.mossX()+12,y:GROUND-80,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-22,life:.65,max:.65,gold:this.gain>=400});
        }
        this.motes = this.motes.slice(-96);
      }
    }
    this.rewardWindow = Math.max(0, this.rewardWindow - dt);
    this.rewardLife = Math.max(0, this.rewardLife - dt);
    this.rewardPower = Math.max(0, this.rewardPower - dt * 1.8);
    this.body.step(dt);
    this.trailClock += dt;
    for (const trail of this.trails) trail.life -= dt;
    this.trails = this.trails.filter(trail => trail.life > 0);
    if (!this.reducedMotion && this.trailClock >= 1/30) {
      this.trailClock = 0;
      const step = this.queue[this.stepIndex];
      const img = step && this.clips.get(step.clip)?.[this.frame];
      if (img && (step.clip === "slide" || step.clip === "spin" || this.rewardPower > 0.3)) {
        this.trails.push({img, x:this.mossX()+this.body.x, y:GROUND+CELL.solePad+this.body.y, flip:step.flip || this.faceLeft, life:.16});
        this.trails = this.trails.slice(-6);
      }
    }
    this.observedScore = this.score;
    this.displayScore += (this.score-this.displayScore) * (1-Math.exp(-dt*14));
    if (Math.abs(this.score-this.displayScore)<1) this.displayScore=this.score;
    this.hudClock += dt;
    if (this.hudClock >= 1/30) {
      this.hudClock = 0;
      this.hooks.onHud?.({score:Math.round(this.displayScore),meter:this.meter,streak:this.streak,gain:this.rewardLife > 0 ? this.gain : 0,serial:this.gainSerial,label:this.callout});
    }
    for (const mote of this.motes) { mote.life-=dt; mote.x+=mote.vx*dt; mote.y+=mote.vy*dt; mote.vy+=70*dt; }
    this.motes=this.motes.filter(m=>m.life>0);
    this.impactLife = Math.max(0, this.impactLife - dt);
    this.calloutLife = Math.max(0, this.calloutLife - dt);
    this.judgeLife = Math.max(0, this.judgeLife - dt);
    this.shake = Math.max(0, this.shake - dt * 2.4);
    this.flash = Math.max(0, this.flash - dt);
    this.quakeLock = Math.max(0, this.quakeLock - dt);
    this.popups.forEach((p) => {
      p.life -= dt;
      if (!this.reducedMotion) p.y -= dt * 25;
    });
    this.popups = this.popups.filter((p) => p.life > 0).slice(-8);
    this.sparks.forEach((s) => {
      s.t += dt;
    });
    this.sparks = this.sparks.filter((s) => s.t < 0.45);
    this.waves.forEach((w) => {
      w.life -= dt;
      w.r += dt * 220;
    });
    this.waves = this.waves.filter((w) => w.life > 0);
    this.birds.forEach((bird) => {
      bird.t += dt;
      if (bird.scare > 0) {
        bird.scare -= dt;
        bird.vy -= dt * 90;
        bird.y += bird.vy * dt;
      } else {
        bird.vy = 0;
        bird.y += Math.sin(bird.t * 2.4) * dt * 10;
        if (bird.y < 24) bird.y = 24;
        if (bird.y > 70) bird.y = 70;
      }
      if (bird.x - this.scroll * 0.16 < -40) bird.x += 1200;
    });
    if (!frozen) this.advanceAnim(dt);
  }

  private tickAttract(dt: number) {
    this.scroll += dt * 70;
    this.faceLeft = false;
  }

  private tickStrut(dt: number) {
    const boosting = this.keys.has("A") && !this.keys.has("C");
    const speed = boosting ? 138 : this.idleFor > 2.4 ? 64 : 92;
    const heavy = this.currentClip() === "stomp" || this.currentClip() === "quake" || this.currentClip() === "slide";
    const flow = speed * (heavy ? 0.72 : 1);
    this.flow += (flow - this.flow) * (1 - Math.exp(-dt * 9));
    this.scroll += dt * this.flow;
    this.routeMaxChain = Math.max(this.routeMaxChain, this.streak);
    this.faceLeft = this.keys.has("A") && this.keys.has("C") && !this.keys.has("B");
    if (this.keys.size === 0) this.idleFor += dt;
    else this.idleFor = 0;

    const step = this.queue[this.stepIndex];
    if (step && step.clip === "strut" && !step.once) {
      step.speed = this.flow / 92;
      step.flip = this.faceLeft;
    }
    if (this.runKind !== "practice") this.scanStreets();
    this.flushStreet();
    if (this.runKind === "route" && this.scroll + MOSS_X >= ROUTE_PX) {
      this.finishRoute();
      return;
    }
    const lap = Math.floor((this.scroll + MOSS_X) / ROUTE_PX);
    if (lap > this.lap) {
      this.lap = lap;
      this.callout = "THE LONG WAY HOME";
      this.calloutLife = 1.5;
      this.groove.combo();
    }
    if (this.runKind === "free" && this.score > this.bestStrut) {
      this.bestStrut = this.score;
      writeBest({ strut: this.bestStrut, rhythm: this.bestRhythm });
      this.hooks.onBest({ strut: this.bestStrut, rhythm: this.bestRhythm });
    }
  }

  private finishRoute() {
    this.mode = "result";
    this.keys.clear();
    this.groove.stop();
    const newRecord = this.score > this.bestRoute;
    if (newRecord) {
      this.bestRoute = this.score;
      try { localStorage.setItem("moss-stomper-route-best-hyper", String(this.bestRoute)); } catch {}
      this.hooks.onRouteBest?.(this.bestRoute);
    }
    this.hooks.onResult({ kind: "route", seconds: this.now, score: this.score,
      personalBest: this.bestRoute, newRecord,
      perfect: this.streetPerfect, fresh: this.streetGood, late: 0,
      stumble: this.streetMiss, maxCombo: this.routeMaxChain });
    this.hooks.onMode("result");
  }

  private tickRhythm(dt: number) {
    this.scroll += dt * 48;
    const t = this.songTime();
    for (const note of this.chart) {
      if (note.hit || note.missed) continue;
      if (t > note.time + 0.17) {
        note.missed = true;
        this.failRhythm("STUMBLED");
      }
    }
    for (const note of this.chart) {
      if (!note.holding || note.failed) continue;
      if (t > note.time + note.dur + 0.06) {
        note.holding = false;
        if (this.keys.has(laneBtn(note.lane))) this.scoreRhythm("FRESH", 140);
        else this.failRhythm("STUMBLED");
      }
    }
    if (t >= this.songDur) this.finishRhythm();
  }

  private rhythmDown(btn: Btn) {
    if (this.meter >= 1 && this.keys.has("A") && this.keys.has("B") && this.keys.has("C")) {
      this.doQuake(true);
      return;
    }
    const t = this.songTime();
    const lane = btnLane(btn);
    let best: LiveNote | null = null;
    let bestDist = 99;
    for (const note of this.chart) {
      if (note.lane !== lane || note.hit || note.missed) continue;
      const dist = Math.abs(note.time - t);
      if (dist < bestDist) {
        best = note;
        bestDist = dist;
      }
    }
    if (!best || bestDist > 0.17) {
      this.failRhythm("STUMBLED");
      return;
    }
    best.hit = true;
    const judge = judgeDist(bestDist);
    this.scoreRhythm(judge, judge === "PERFECT" ? 300 : judge === "FRESH" ? 180 : 80);
    if (best.dur > 0) best.holding = true;
    const mates = this.chart.filter(
      (note) =>
        note !== best &&
        !note.hit &&
        !note.missed &&
        Math.abs(note.time - best.time) < 0.05 &&
        this.keys.has(laneBtn(note.lane)),
    );
    mates.forEach((note) => {
      note.hit = true;
      if (note.dur > 0) note.holding = true;
    });
    const chord = mates.length > 0;
    this.play(hitSteps(btn, best.dur > 0, chord));
    if (btn === "B" || best.dur > 0 || chord) this.burst("dust", this.mossX() + 8, GROUND);
    if (btn === "C" || chord) this.burst("sparks", this.mossX() + 18, GROUND - 64);
  }

  private rhythmUp(btn: Btn) {
    const t = this.songTime();
    const lane = btnLane(btn);
    for (const note of this.chart) {
      if (note.lane !== lane || !note.holding) continue;
      note.holding = false;
      if (t < note.time + note.dur - 0.08) this.failRhythm("STUMBLED");
      else this.scoreRhythm("FRESH", 120);
    }
    if (!this.chart.some((note) => note.holding)) {
      const step = this.queue[this.stepIndex];
      if (step?.hold) this.play([{ clip: "strut", speed: 1, once: false, flip: false }]);
    }
  }

  private finishRhythm() {
    this.mode = "result";
    this.groove.stop();
    if (this.score > this.bestRhythm) {
      this.bestRhythm = this.score;
      writeBest({ strut: this.bestStrut, rhythm: this.bestRhythm });
      this.hooks.onBest({ strut: this.bestStrut, rhythm: this.bestRhythm });
    }
    this.hooks.onResult({
      kind: "rhythm",
      score: this.score,
      perfect: this.counts.perfect,
      fresh: this.counts.fresh,
      late: this.counts.late,
      stumble: this.counts.stumble,
      maxCombo: this.maxCombo,
    });
    this.hooks.onMode("result");
  }

  private mossWorld() {
    return this.scroll + this.mossX();
  }

  private streetViews() {
    const moss = this.mossWorld();
    const lap = Math.floor(moss / ROUTE_PX);
    const views: {
      spec: StreetSpec;
      world: number;
      dist: number;
      key: string;
      win: { perfect: number; good: number; telegraph: number };
    }[] = [];
    for (const spec of STREETS) {
      const local = streetX(spec);
      for (const lapK of [lap - 1, lap, lap + 1]) {
        if (lapK < 0) continue;
        const world = local + lapK * ROUTE_PX;
        const dist = world - moss;
        const win = windowsFor(this.flow, spec);
        if (dist > win.telegraph + 420 || dist < -win.good - 90) continue;
        views.push({ spec, world, dist, key: `${spec.uid}:${lapK}`, win });
      }
    }
    return views;
  }

  private scanStreets() {
    const moss = this.mossWorld();
    const lap = Math.floor(moss / ROUTE_PX);
    for (const spec of STREETS) {
      const local = streetX(spec);
      for (const lapK of [lap - 1, lap, lap + 1]) {
        if (lapK < 0) continue;
        const dist = local + lapK * ROUTE_PX - moss;
        const win = windowsFor(this.flow, spec);
        const key = `${spec.uid}:${lapK}`;
        if (this.streetMarks.has(key)) continue;
        if (dist < win.telegraph && dist > -win.good && !this.streetCued.has(key)) {
          this.streetCued.add(key);
          this.groove.cue();
        }
        if (dist < -win.good && dist > -480) {
          this.streetMarks.set(key, { kind: "miss", at: this.now });
          this.streetMiss += 1;
        }
      }
    }
  }

  private flushStreet() {
    if (this.mode !== "strut" || !this.streetPending.size) return;
    const btns = [...this.streetPending.keys()];
    const age = this.now - Math.min(...this.streetPending.values());
    const open = this.streetViews().filter((view) => !this.streetMarks.has(view.key));
    const exact = open
      .filter((view) => sameTrigger(view.spec, btns) && Math.abs(view.dist) <= view.win.good)
      .sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist))[0];
    if (exact) {
      this.settleStreet(exact.spec, exact.key, exact.dist, exact.win.perfect);
      this.streetPending.clear();
      return;
    }
    const waiting = open.some(
      (view) => isPrefix(btns, view.spec.trigger) && view.dist < view.win.telegraph && view.dist > -view.win.good,
    );
    if (waiting && age < 0.09) return;
    this.streetPending.clear();
  }

  private settleStreet(spec: StreetSpec, key: string, dist: number, perfectPx: number) {
    const kind = Math.abs(dist) <= perfectPx ? "perfect" : "good";
    this.streetMarks.set(key, { kind, at: this.now });
    if (kind === "perfect") this.streetPerfect += 1;
    else this.streetGood += 1;
    const variety = [1, 1.1, 1.4, 1.8][Math.min(3, new Set(this.recent).size)] ?? 1;
    const points = pointsFor((kind === "perfect" ? spec.scorePerfect : spec.scoreGood) * variety);
    this.score += points;
    this.meter = Math.min(1, this.meter + (kind === "perfect" ? 0.07 : 0.04));
    this.callout = spec.feedback;
    this.calloutLife = 1.05;
    this.popups.push({
      text: `+${points}`,
      life: 0.85,
      x: this.mossX() + 18,
      y: GROUND - 108,
      gold: kind === "perfect",
    });
    if (kind === "perfect") this.groove.perfect();
    else this.groove.combo();
    if (spec.id === "seagull") {
      this.birds.forEach((bird) => {
        bird.scare = 0.75;
        bird.vy = -28;
      });
    } else if (!spec.body && spec.trigger.includes("B")) this.burst("dust", this.mossX(), GROUND);
    else if (!spec.body && spec.trigger.includes("C")) this.burst("sparks", this.mossX() + 12, GROUND - 64);
    if (
      this.meter >= 1 &&
      this.keys.has("A") &&
      this.keys.has("B") &&
      this.keys.has("C") &&
      this.currentClip() !== "quake"
    ) {
      this.doQuake(false);
    }
  }

  private leadStreet() {
    let best: { spec: StreetSpec; hot: boolean; dist: number } | null = null;
    for (const view of this.streetViews()) {
      if (this.streetMarks.has(view.key)) continue;
      if (view.dist > view.win.telegraph || view.dist < -view.win.good) continue;
      if (!best || view.dist < best.dist) {
        best = { spec: view.spec, dist: view.dist, hot: Math.abs(view.dist) <= view.win.good };
      }
    }
    return best;
  }

  private chordCheck() {
    const held = this.keys;
    const times = [...held].map((key) => this.downAt.get(key) ?? this.now);
    const span = times.length ? Math.max(...times) - Math.min(...times) : 99;
    const simultaneous = span <= 0.09;
    if (held.has("A") && held.has("B") && held.has("C") && simultaneous) {
      if (this.meter < 1) {
        this.callout = "NEED MORE STYLE";
        this.calloutLife = 0.7;
        return true;
      }
      this.refundRecent();
      if (this.meter < 1) this.meter = 1;
      this.doQuake(false);
      return true;
    }
    if (held.has("B") && held.has("C") && !held.has("A") && simultaneous) {
      this.refundRecent();
      this.seq = [];
      this.play([{ clip: "spin", speed: 1.2, once: true, flip: false }]);
      this.burst("spin", this.mossX(), GROUND - 36);
      this.burst("dust", this.mossX() + 6, GROUND);
      this.award("SPIN STOMP", 350, 0.12, true);
      this.groove.combo();
      this.shake = Math.max(this.shake, 0.16);
      return true;
    }
    return false;
  }

  private commitSingle(btn: Btn) {
    this.seq.push({ btn, t: this.now });
    this.seq = this.seq.filter((s) => this.now - s.t < 2.6);
    const found = COMBOS.find((combo) => tailMatch(this.seq, combo.keys));
    if (found) {
      this.seq = [];
      this.hooks.onPractice?.(found.name);
      this.refundRecent();
      this.play(found.steps);
      if (found.name === "HEEL-TOE HAMMER" || found.name === "DOUBLE TROUBLE" || found.name === "FRANKSTON SHUFFLE") {
        this.burst("dust", this.mossX() + 4, GROUND);
        this.burst("impact", this.mossX(), GROUND - 6);
      }
      if (found.name === "ROYAL SWAGGER" || found.name === "STREET CORONATION") {
        this.burst("sparks", this.mossX() + 14, GROUND - 70);
      }
      if (found.name === "FRANKSTON SHUFFLE") this.burst("dust", this.mossX() + 20, GROUND - 4);
      this.award(found.name, found.bonus, found.meter, true);
      this.groove.combo();
      this.shake = Math.max(this.shake, 0.12);
      return;
    }
    if (btn === "A") {
      this.play([{ clip: "strut", speed: 1.35, once: false, flip: this.faceLeft }]);
      this.burst("dust", this.mossX() + 4, GROUND);
    } else if (btn === "B") {
      this.play([{ clip: "stomp", speed: 1, once: true, flip: false }]);
      this.burst("dust", this.mossX() + 2, GROUND);

    } else {
      this.play([{ clip: "style", speed: 1, once: true, flip: false }]);
      this.burst("sparks", this.mossX() + 16, GROUND - 68);
      this.groove.style();
    }
    this.award(btn === "A" ? "STRIDE" : btn === "B" ? "STOMP" : "STYLE", btn === "A" ? 70 : 110, 0.045, false);
  }

  private doQuake(fromRhythm: boolean) {
    if (this.quakeLock > 0 && this.currentClip() === "quake") return;
    if (this.meter < 1) {
      this.callout = "NEED MORE STYLE";
      this.calloutLife = 0.7;
      return;
    }
    this.quakeLock = 1.15;
    this.quakeHit = false;
    this.meter = 0;
    this.buffered = null;
    this.play([{ clip: "quake", speed: 1, once: true, flip: false }]);
    this.shake = 0.08;
    this.groove.quake();
    this.score += pointsFor(fromRhythm ? 400 : 500);
    this.callout = "MOSSQUAKE";
    this.calloutLife = 1.4;
    this.seq = [];
    this.grants = [];
  }

  private quakeImpact() {
    if (this.quakeHit) return;
    this.quakeHit = true;
    this.impactLife = 0.24;
    if (!this.reducedMotion) this.body.kick(-40, 75);
    const x = this.mossX();
    this.burst("impact", x - 8, GROUND - 8);
    this.burst("dust", x - 18, GROUND);
    this.burst("dust", x + 16, GROUND);
    this.waves.push({ x, r: 10, life: 0.72 });
    this.waves.push({ x, r: 4, life: 0.95 });
    this.shake = 0.38;
    this.flash = 0.16;
    this.birds.forEach((bird) => {
      bird.scare = 0.8;
      bird.vy = -30;
    });
    const bonus = pointsFor(this.mode === "rhythm" ? 1400 : 2000);
    this.score += bonus;
    this.popups.push({ text: `+${bonus}`, life: 1, x: x - 10, y: GROUND - 120, gold: true });
    this.popups.push({ text: "MOSSQUAKE", life: 1, x: x - 20, y: GROUND - 96, gold: true });
  }

  private award(label: string, base: number, meterGain: number, combo: boolean) {
    const btn = this.seq.at(-1)?.btn ?? this.lastBtn;
    if (!combo && btn) {
      if (btn === this.lastBtn) this.sameRun += 1;
      else this.sameRun = 1;
      this.lastBtn = btn;
      this.recent.push(btn);
      if (this.recent.length > 4) this.recent.shift();
    }
    const spam = !combo && this.sameRun >= 6 ? 0.28 : !combo && this.sameRun >= 4 ? 0.45 : !combo && this.sameRun === 3 ? 0.7 : 1;
    const variety = new Set(this.recent).size >= 3 ? 1.5 : new Set(this.recent).size === 2 ? 1.15 : 1;
    const planted = ANIM[this.currentClip()].contacts.includes(this.frame);
    const flow = !combo && planted ? 1.12 : 1;
    const timing = this.beatJudge();
    const mult =
      (timing === "PERFECT" ? 1.6 : timing === "FRESH" ? 1.25 : timing === "LATE" ? 0.85 : 0.55) *
      spam *
      (combo ? 1 : variety) *
      flow;
    const points = pointsFor(base * mult);
    this.score += points;
    const before = this.meter;
    this.meter = Math.min(1, before + meterGain * spam * (timing === "OFF" ? 0.8 : 1));
    if (!combo) this.grants.push({ points, meter: this.meter - before, at: this.now });
    this.grants = this.grants.filter((grant) => this.now - grant.at < 0.2);
    if (
      this.meter >= 1 &&
      this.keys.has("A") &&
      this.keys.has("B") &&
      this.keys.has("C") &&
      this.currentClip() !== "quake"
    ) {
      this.doQuake(this.mode === "rhythm");
    }
    if (timing === "PERFECT" || timing === "FRESH") this.streak += 1;
    else this.streak = 0;
    if (this.streak > 0 && this.streak % 4 === 0) this.score += pointsFor(50);
    this.callout = combo ? label : timing === "OFF" ? label : `${label} ${timing}`;
    this.calloutLife = combo ? 1.05 : 0.55;
    this.popups.push({ text: `+${points}`, life: 1, x: MOSS_X + 20, y: GROUND - 120, gold: combo || timing === "PERFECT" });
  }

  private beatJudge(): Judge {
    if (!this.groove.running) return "FRESH";
    const beat = this.groove.beatDur;
    const phase = this.songTime() % beat;
    const dist = Math.min(phase, beat - phase);
    if (dist < 0.06) return "PERFECT";
    if (dist < 0.11) return "FRESH";
    if (dist < 0.16) return "LATE";
    return "OFF";
  }

  private scoreRhythm(judge: Exclude<Judge, "OFF" | "STUMBLED"> | "FRESH", points: number) {
    if (judge === "PERFECT") this.counts.perfect += 1;
    else if (judge === "LATE") this.counts.late += 1;
    else this.counts.fresh += 1;
    this.rhythmCombo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.rhythmCombo);
    const mult = 1 + Math.min(2, this.rhythmCombo * 0.05);
    const gained = pointsFor(points * mult);
    this.score += gained;
    this.meter = Math.min(1, this.meter + (judge === "PERFECT" ? 0.05 : 0.03));
    this.judgeText = judge;
    this.judgeLife = 0.45;
    this.popups.push({ text: `+${gained}`, life: 0.85, x: 190, y: 92, gold: judge === "PERFECT" });
    if (judge === "PERFECT") this.groove.perfect();
    this.streak = this.rhythmCombo;
  }

  private failRhythm(label: "STUMBLED") {
    this.counts.stumble += 1;
    this.rhythmCombo = 0;
    this.judgeText = label;
    this.judgeLife = 0.45;
    if (this.currentClip() !== "stumble") this.play([{ clip: "stumble", speed: 1.15, once: true, flip: false }]);
    this.groove.miss();
    this.streak = 0;
  }

  private refundRecent() {
    for (const grant of this.grants) {
      this.score = Math.max(0, this.score - grant.points);
      this.meter = Math.max(0, this.meter - grant.meter);
    }
    this.grants = [];
    this.popups = this.popups.filter((popup) => popup.life < 0.62);
  }

  private play(steps: Step[]) {
    const key = steps
      .map((step) => `${step.clip}:${step.speed}:${step.from ?? 0}:${step.to ?? ""}:${step.flip ? 1 : 0}`)
      .join("|");
    if (key === this.lastPlayKey && this.now - this.lastPlayAt < 0.045) return;
    this.lastPlayKey = key;
    this.lastPlayAt = this.now;
    const prior = this.queue[this.stepIndex];
    const keepStride = prior?.clip === "strut" && steps[0]?.clip === "strut";
    const priorFrame = this.frame;
    const priorAcc = this.frameAcc;
    this.queue = steps;
    this.stepIndex = 0;
    this.frame = keepStride ? Math.max(steps[0]?.from ?? 0, Math.min(priorFrame, (steps[0]?.to ?? 12) - 1)) : steps[0]?.from ?? 0;
    this.frameAcc = keepStride ? priorAcc : 0;
    this.lastPlantFrame = -1;
    this.animWatch = 0;
  }

  private mossX() {
    if (this.mode === "rhythm") return 392;
    if (this.mode === "menu") return 360;
    return MOSS_X;
  }

  private currentClip(): ClipId {
    return this.queue[this.stepIndex]?.clip ?? "strut";
  }

  private lastPlantFrame = -1;

  private advanceAnim(dt: number) {
    const step = this.queue[this.stepIndex];
    if (!step) {
      this.play([{ clip: "strut", speed: 1, once: false, flip: this.faceLeft }]);
      return;
    }
    const clip = PLAY_CLIPS[step.clip];
    const meta = ANIM[step.clip];
    const start = step.from ?? 0;
    const end = step.to ?? clip.frames;
    if (this.frame < start) this.frame = start;
    const rate = meta.frameSpeed?.[Math.min(this.frame, (meta.frameSpeed?.length ?? 1) - 1)] ?? 1;
    this.frameAcc += dt * Math.max(0.2, step.speed) * rate;
    const dur = 1 / clip.fps;
    let guard = 0;
    while (this.frameAcc >= dur && guard < 6) {
      guard += 1;
      this.frameAcc -= dur;
      this.frame += 1;
      if (step.clip === "quake" && this.frame === (meta.contacts[0] ?? 5)) this.quakeImpact();
      if (meta.contacts.includes(this.frame) && step.clip !== "quake") this.plant(step.clip);
      if (this.frame >= end) {
        if (!step.once) {
          this.frame = start;
        } else if (this.stepIndex < this.queue.length - 1) {
          this.stepIndex += 1;
          this.frame = this.queue[this.stepIndex]?.from ?? 0;
          this.frameAcc = 0;
          return;
        } else {
          const buffered = this.buffered && this.now - this.bufferAt < 0.22 ? this.buffered : null;
          this.buffered = null;
          this.play([{ clip: "strut", speed: 1, once: false, flip: this.faceLeft }]);
          if (buffered && this.mode === "strut") this.commitSingle(buffered);
          return;
        }
      }
    }
    if (this.frame === this.lastFrameSeen) this.animWatch += dt;
    else {
      this.animWatch = 0;
      this.lastFrameSeen = this.frame;
    }
    if (this.animWatch > 2.4 && step.clip !== "strut") {
      this.play([{ clip: "strut", speed: 1, once: false, flip: this.faceLeft }]);
      return;
    }
  }

  private plant(clip: ClipId) {
    if (clip !== "strut" && clip !== "stomp" && clip !== "slide") return;
    if (!this.reducedMotion) this.body.kick(clip === "slide" ? 38 : -9, clip === "stomp" ? 42 : -12);
    this.burst("dust", this.mossX() + (this.faceLeft ? -6 : 8), GROUND);
    if (clip === "stomp") {
      this.impactLife = 0.16;
      this.burst("impact", this.mossX(), GROUND - 4);
      this.waves.push({ x: this.mossX(), r: 4, life: 0.24 });
      this.shake = Math.max(this.shake, 0.1);
      this.groove.stomp();
    }
  }

  private burst(kind: keyof typeof FX, x: number, y: number) {
    this.sparks.push({ kind, t: 0, x, y });
  }

  private draw() {
    const ctx = this.ctx2d;
    const cssW = this.canvas.clientWidth || W;
    const cssH = this.canvas.clientHeight || H;
    const scale = Math.min(3, Math.max(1, Math.ceil(Math.min(cssW / W, cssH / H) * (window.devicePixelRatio || 1))));
    if (this.canvas.width !== W * scale || this.canvas.height !== H * scale) {
      this.canvas.width = W * scale;
      this.canvas.height = H * scale;
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const ox = this.reducedMotion ? 0 : Math.sin(this.now * 103) * this.shake * 7;
    const oy = this.reducedMotion ? 0 : Math.cos(this.now * 89) * this.shake * 4;
    const actualScroll = this.scroll;
    if (this.mode === "strut") this.scroll += this.flow * this.accumulator;
    if (this.mode === "menu") this.scroll += 70 * this.accumulator;
    if (this.mode === "rhythm") this.scroll += 48 * this.accumulator;
    ctx.save();
    ctx.translate(ox, oy);
    this.drawWorld(false);
    if (this.mode === "strut" || this.mode === "menu") this.drawStreets();
    this.drawBirds();
    this.drawWaves();
    this.drawMomentum();
    this.drawMoss();
    this.drawWorld(true);
    this.drawFx();
    for (const mote of this.motes) {
      ctx.globalAlpha=Math.max(0,mote.life/mote.max);
      ctx.fillStyle=mote.gold ? "#f5c518" : "#64e2ed";
      const size=mote.gold ? 3 : 2;
      ctx.fillRect(mote.x,mote.y,size,size);
    }
    ctx.globalAlpha=1;
    if (this.mode === "rhythm") this.drawHighway();
    ctx.restore();
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 236, 180, ${Math.min(0.18, this.flash)})`;
      ctx.fillRect(0, 0, W, H);
    }
    this.scroll = actualScroll;
    this.drawHud();
    if (!this.ready) {
      ctx.fillStyle = "#f4efe6";
      ctx.font = "10px 'Press Start 2P', monospace";
      ctx.fillText(this.loadError ? "ASSET ERROR" : "LOADING THE BLOCK", 16, H / 2);
      if (this.loadError) {
        ctx.font = "16px Silkscreen, monospace";
        ctx.fillText(this.loadError.slice(0, 42), 16, H / 2 + 22);
      }
    }
  }

  private drawWorld(front: boolean) {
    const ctx = this.ctx2d;
    if (!this.world) {
      for (const layer of STAGE) {
        if (!!layer.front !== front) continue;
        const img = this.stage.get(layer.id);
        if (!img) continue;
        blit(ctx, img, this.scroll * layer.speed, layer.y, layer.h);
      }
      return;
    }
    if (front) {
      const weight = plateWeight(this.scroll + W / 2);
      const fore = this.stage.get("fore");
      if (fore && weight > 0.4) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, weight);
        blit(ctx, fore, this.scroll * 1.25, 214, 56);
        ctx.restore();
      }
      return;
    }
    const cycle = cycleOf(this.now);
    const grade = gradeAt(cycle);
    paintBackdrop(ctx, grade, cycle, this.now, this.scroll, this.world);
    const weight = plateWeight(this.scroll + W / 2);
    if (weight > 0.02) {
      ctx.save();
      ctx.globalAlpha = weight;
      for (const id of ["far", "mid"] as const) {
        const layer = STAGE.find((item) => item.id === id);
        const img = layer ? this.stage.get(layer.id) : undefined;
        if (!layer || !img) continue;
        blit(ctx, img, this.scroll * layer.speed, layer.y, layer.h);
      }
      ctx.restore();
    }
    paintStreet(ctx, this.world, this.scroll);
    if (grade.lamp > 0.45) {
      ctx.fillStyle = `rgba(6, 8, 18, ${grade.phase === "night" ? 0.16 : 0.1})`;
      ctx.fillRect(0, 96, W, 124);
    }
    paintGlow(ctx, this.world, this.scroll, grade);
    const ground = this.stage.get("ground");
    if (ground) blit(ctx, ground, this.scroll, 196, 74);
    ctx.fillStyle = grade.veil;
    ctx.fillRect(0, 196, W, 74);
    paintMarks(ctx, this.world, this.scroll);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(this.mossX(), GROUND + 3, 28, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawStreets() {
    const ctx = this.ctx2d;
    for (const view of this.streetViews()) {
      const mark = this.streetMarks.get(view.key);
      const screen = view.world - this.scroll;
      if (screen < -48 || screen > W + 48) continue;
      let kind: "open" | "perfect" | "good" | "miss" | "soon" = "soon";
      let age = 0;
      if (mark) {
        kind = mark.kind;
        age = this.now - mark.at;
      } else if (Math.abs(view.dist) <= view.win.good) kind = "open";
      paintProp(ctx, view.spec.id, screen, GROUND, age, kind, this.now);
      if (!mark && view.dist < view.win.telegraph && view.dist > -view.win.good) {
        paintPips(ctx, view.spec.trigger, screen, GROUND - 112, Math.abs(view.dist) <= view.win.good);
      }
    }
  }

  private drawBirds() {
    const ctx = this.ctx2d;
    if (!this.birdsImg.length) return;
    for (const bird of this.birds) {
      const frame = Math.floor(bird.t * 8) % this.birdsImg.length;
      const img = this.birdsImg[frame];
      if (!img) continue;
      const x = bird.x - this.scroll * 0.16;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, Math.round(x), Math.round(bird.y), 28, 16);
    }
  }

  private drawWaves() {
    const ctx = this.ctx2d;
    for (const wave of this.waves) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, wave.life);
      ctx.strokeStyle = "#f5c518";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(wave.x, GROUND + 2, wave.r, Math.max(3, wave.r * 0.18), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#ff6a1a";
      ctx.globalAlpha = Math.max(0, wave.life * 0.45);
      ctx.beginPath();
      ctx.ellipse(wave.x, GROUND + 2, wave.r * 0.62, Math.max(2, wave.r * 0.1), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawMomentum() {
    if (this.reducedMotion) return;
    const ctx = this.ctx2d;
    for (const trail of this.trails) {
      ctx.save();
      ctx.globalAlpha = trail.life / .16 * .16;
      ctx.translate(trail.x + (trail.life - .16) * this.flow, trail.y);
      if (trail.flip) ctx.scale(-1, 1);
      ctx.drawImage(trail.img, -trail.img.width / 2, -trail.img.height);
      ctx.restore();
    }
    if (this.rewardPower > 0.08 && this.mode === "strut") {
      ctx.save();
      ctx.strokeStyle = "#64e2ed";
      ctx.lineWidth = 1;
      for (let i=0; i<12; i++) {
        const x = ((i*89 - this.scroll*1.8) % W + W) % W;
        const y = 38 + (i*43)%174;
        ctx.globalAlpha = this.rewardPower * .22;
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+12+this.rewardPower*28,y); ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawMoss() {
    const step = this.queue[this.stepIndex];
    if (!step) return;
    const frames = this.clips.get(step.clip);
    const img = frames?.[Math.min(this.frame, (frames?.length ?? 1) - 1)];
    if (!img) return;
    const ctx = this.ctx2d;
    const x = this.mossX();
    const flip = step.flip || (step.clip === "strut" && this.faceLeft);
    ctx.save();
    // Continuous sub-frame body motion keeps original pixel poses crisp.
    const phase=(this.frame + (this.frameAcc + this.accumulator * step.speed) * PLAY_CLIPS[step.clip].fps)*Math.PI/4;
    const moving=step.clip === "strut";
    const bob=this.reducedMotion || !moving ? 0 : Math.sin(phase*2)*.65;
    const lateral = this.reducedMotion ? 0 : this.body.x;
    const lift = this.reducedMotion ? 0 : this.body.y;
    ctx.translate(x + lateral, GROUND + CELL.solePad + bob + lift);
    if (!this.reducedMotion && moving) ctx.rotate(Math.sin(phase)*.006);
    if (!this.reducedMotion && this.impactLife > 0) {
      const squash = Math.sin(this.impactLife / 0.24 * Math.PI) * 0.035;
      ctx.scale(1 + squash, 1 - squash);
    }
    if (flip) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }

  private drawFx() {
    const ctx = this.ctx2d;
    for (const spark of this.sparks) {
      const frames = this.fx.get(spark.kind);
      if (!frames?.length) continue;
      const index = Math.min(frames.length - 1, Math.floor((spark.t / 0.5) * frames.length));
      const img = frames[index];
      if (!img) continue;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, spark.x - 32, spark.y - 48, 64, 64);
    }
  }

  private drawHighway() {
    const ctx = this.ctx2d;
    const t = this.groove.running ? this.songTime() : 0;
    const hitX = 78;
    const lanes = [86, 132, 178];
    ctx.fillStyle = "rgba(8,6,12,0.45)";
    ctx.fillRect(8, 62, 250, 150);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = i === 0 ? "#1f8cff" : i === 1 ? "#e10600" : "#f5c518";
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(20, lanes[i] ?? 0);
      ctx.lineTo(250, lanes[i] ?? 0);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = "#f4efe6";
    ctx.beginPath();
    ctx.moveTo(hitX, 68);
    ctx.lineTo(hitX, 200);
    ctx.stroke();
    const pxPerSec = 210;
    for (const note of this.chart) {
      if (note.missed) continue;
      const x = hitX + (note.time - t) * pxPerSec;
      if (x < -40 || x > W + 40) continue;
      const y = (lanes[note.lane] ?? 100) - 10;
      const img = this.notesImg[note.lane];
      if (note.dur > 0) {
        const tail = note.dur * pxPerSec;
        ctx.fillStyle = note.lane === 0 ? "#1f8cff" : note.lane === 1 ? "#e10600" : "#f5c518";
        ctx.globalAlpha = note.hit ? 0.35 : 0.8;
        ctx.fillRect(x, y + 6, tail, 8);
        ctx.globalAlpha = 1;
      }
      if (note.hit && note.dur <= 0) continue;
      if (img && (!note.hit || note.holding)) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, x - 8, y, 48, 20);
      }
    }
    if (this.judgeLife > 0) {
      ctx.fillStyle = this.judgeText === "STUMBLED" ? "#ff6a1a" : "#f5c518";
      ctx.font = "12px 'Press Start 2P', monospace";
      ctx.fillText(this.judgeText, 88, 58);
    }
  }

  private drawHud() {
    const sample = zoneSample(this.scroll + (this.mode === "menu" ? 240 : MOSS_X));
    const phase = gradeAt(cycleOf(this.now)).phase.toUpperCase();
    if (this.mode === "menu") {
      ctxLabel(this.ctx2d, `${sample.zone.name} · ${phase}`, 12, 22, "#f5c518", 8);
      return;
    }
    const ctx = this.ctx2d;
    ctx.font = "bold 9px monospace";
    if (this.mode === "strut") {
      const lead = this.runKind === "practice" ? null : this.leadStreet();
      ctx.fillStyle = "#b7a89a";
      ctx.fillText(`${sample.zone.name}  ${phase}`, 12, H - 12);
      if (this.runKind === "route") {
        const progress = Math.min(1, (this.scroll + MOSS_X) / ROUTE_PX);
        ctx.fillStyle = "#192231"; ctx.fillRect(12, H - 27, W - 24, 3);
        ctx.fillStyle = "#f5c518"; ctx.fillRect(12, H - 27, (W - 24) * progress, 3);
        ctx.textAlign = "right"; ctx.fillText(`${Math.floor(this.now / 60)}:${String(Math.floor(this.now % 60)).padStart(2, "0")} / ${Math.floor(progress * 100)}% HOME`, W - 12, H - 12); ctx.textAlign = "left";
      }
      if (lead) {
        ctx.fillStyle = lead.hot ? "#f5c518" : "#f4efe6";
        ctx.textAlign = "right";
        ctx.fillText(triggerLabel(lead.spec.trigger), W - 12, 20);
        ctx.textAlign = "left";
      }
    }
    if (this.calloutLife > 0) {
      ctx.fillStyle = "#f5c518";
      ctx.font = "11px 'Press Start 2P', monospace";
      ctx.fillText(this.callout, 12, 43);
    }
    for (const popup of this.popups) {
      ctx.globalAlpha = Math.max(0, Math.min(1, popup.life * 2));
      ctx.fillStyle = popup.gold ? "#f5c518" : "#f4efe6";
      const points = popup.text.startsWith("+");
      const size = points ? (popup.gold ? 35 : 27) : 12;
      ctx.font = `900 ${size}px monospace`;
      ctx.lineWidth = points ? 4 : 3;
      ctx.strokeStyle = "#080d12";
      ctx.lineJoin = "round";
      const x = Math.max(12,Math.min(W-ctx.measureText(popup.text).width-12,popup.x));
      const pop = this.reducedMotion ? 1 : 1 + Math.sin(Math.min(1, (1-popup.life)*5)*Math.PI)*.16;
      ctx.save();
      ctx.translate(x, popup.y);
      ctx.scale(pop,pop);
      ctx.strokeText(popup.text,0,0);
      ctx.fillText(popup.text,0,0);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (this.mode === "pause") {
      ctx.fillStyle = "rgba(8,6,10,0.55)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#f5c518";
      ctx.font = "14px 'Press Start 2P', monospace";
      ctx.fillText("HOLD UP", 150, 130);
    }
  }

  /**
   * Debug/test probe on window.__moss. Only installed in development (localhost)
   * or when the page URL carries ?debug, and built once: snapshot fields are
   * live getters, so nothing is allocated per frame.
   */
  private installProbe() {
    if (!debugEnabled()) return;
    const self = this;
    const probe = {
      get mode() { return self.mode; },
      get score() { return self.score; },
      get meter() { return self.meter; },
      get clip() { return self.currentClip(); },
      get frame() { return self.frame; },
      get callout() { return self.callout; },
      get ready() { return self.ready; },
      get quakeLock() { return self.quakeLock; },
      get held() { return [...self.keys]; },
      get downAt() { return Object.fromEntries([...self.downAt].map(([key, time]) => [key, Number(time.toFixed(3))])); },
      get now() { return Number(self.now.toFixed(3)); },
      press: (btn: Btn) => {
        this.down(btn);
        window.setTimeout(() => this.up(btn), 90);
      },
      hold: (btn: Btn, down: boolean) => (down ? this.down(btn) : this.up(btn)),
      state: () => ({
        mode: this.mode,
        runKind: this.runKind,
        score: this.score,
        meter: Number(this.meter.toFixed(3)),
        clip: this.currentClip(),
        frame: this.frame,
        callout: this.callout,
        ready: this.ready,
        faceLeft: this.faceLeft,
        streak: this.streak,
        quakeLock: Number(this.quakeLock.toFixed(3)),
        held: [...this.keys],
        zone: zoneSample(this.scroll + MOSS_X).zone.id,
        phase: gradeAt(cycleOf(this.now)).phase,
        streetPerfect: this.streetPerfect,
        streetGood: this.streetGood,
        streetMiss: this.streetMiss,
        scroll: Math.round(this.scroll),
        flow: Number(this.flow.toFixed(2)),
        simulationHz: 120,
      }),
      seek: (px: number) => {
        this.scroll = Math.max(0, px);
      },
      seekTime: (seconds: number) => {
        this.now = Math.max(0, seconds);
      },
    };
    this.probe = probe;
    (window as unknown as { __moss?: unknown }).__moss = probe;
  }

  private removeProbe() {
    if (!this.probe || typeof window === "undefined") return;
    const w = window as unknown as { __moss?: unknown };
    if (w.__moss === this.probe) delete w.__moss;
    this.probe = null;
  }
}

/** Waits for the self-hosted pixel fonts so canvas text never paints in a fallback face. Never rejects. */
function loadFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
  const fonts = Promise.all([
    document.fonts.load("10px 'Press Start 2P'"),
    document.fonts.load("16px Silkscreen"),
  ]).then(() => document.fonts.ready).then(() => undefined, () => undefined);
  return Promise.race([fonts, timeout]);
}

/** Debug tooling: localhost dev builds, or any build opened with ?debug. */
export function debugEnabled(): boolean {
  try {
    if (typeof window === "undefined" || !window.location) return false;
    const { hostname, search } = window.location;
    if (new URLSearchParams(search).has("debug")) return true;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

function tailMatch(seq: { btn: Btn; t: number }[], keys: Btn[]) {
  if (seq.length < keys.length) return false;
  const tail = seq.slice(-keys.length);
  for (let i = 0; i < keys.length; i++) {
    if (tail[i]?.btn !== keys[i]) return false;
    if (i > 0 && (tail[i]?.t ?? 0) - (tail[i - 1]?.t ?? 0) > 0.85) return false;
  }
  return true;
}

function judgeDist(dist: number): "PERFECT" | "FRESH" | "LATE" {
  if (dist < 0.055) return "PERFECT";
  if (dist < 0.1) return "FRESH";
  return "LATE";
}

function btnLane(btn: Btn): Lane {
  if (btn === "A") return 0;
  if (btn === "B") return 1;
  return 2;
}

function laneBtn(lane: Lane): Btn {
  return lane === 0 ? "A" : lane === 1 ? "B" : "C";
}

function hitSteps(btn: Btn, hold: boolean, chord: boolean): Step[] {
  if (chord) return [{ clip: "spin", speed: 1.2, once: true, flip: false }];
  if (hold && btn === "A") return [{ clip: "strut", speed: 0.72, once: false, flip: false, hold: true }];
  if (hold && btn === "B") return [{ clip: "stomp", speed: 0.4, once: false, flip: false, hold: true, from: 3, to: 5 }];
  if (hold) return [{ clip: "style", speed: 0.35, once: false, flip: false, hold: true, from: 2, to: 5 }];
  if (btn === "A") return [{ clip: "strut", speed: 1.55, once: true, flip: false, from: 0, to: 6 }];
  if (btn === "B") return [{ clip: "stomp", speed: 1.1, once: true, flip: false }];
  return [{ clip: "style", speed: 1.05, once: true, flip: false }];
}

function blit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  scroll: number,
  y: number,
  height: number,
) {
  const w = img.width * (height / img.height);
  const shift = ((scroll % w) + w) % w;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, -shift, y, w, height);
  ctx.drawImage(img, -shift + w, y, w, height);
  if (-shift + w * 2 < W) ctx.drawImage(img, -shift + w * 2, y, w, height);
}

function ctxLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  size: number,
) {
  ctx.fillStyle = color;
  ctx.font = `${size}px 'Press Start 2P', monospace`;
  ctx.fillText(text, x, y);
}

function readBest() {
  try {
    const raw = localStorage.getItem("moss-stomper-best");
    if (!raw) return { strut: 0, rhythm: 0 };
    const parsed = JSON.parse(raw) as { version?: number; strut?: number; rhythm?: number };
    const scale = parsed.version === 2 ? 1 : 10;
    return { strut: (parsed.strut ?? 0) * scale, rhythm: (parsed.rhythm ?? 0) * scale };
  } catch {
    return { strut: 0, rhythm: 0 };
  }
}

function writeBest(best: { strut: number; rhythm: number }) {
  try { localStorage.setItem("moss-stomper-best", JSON.stringify({ version: 2, ...best })); } catch {}
}
