/**
 * Street props (P4): procedural pixel art baked once per prop into offscreen
 * canvases with a dark 1px outline, three-tone shading and a rim light, plus
 * four idle micro-loop frames. Hits squash (after a short hit-pause) and burst;
 * misses wobble. No sprite PNG is touched — everything here is drawn in code.
 */
import type { Btn } from "./arcade-types";
import { keyLabel } from "./keys";
import { RING_SPAN, cueLabel, cueState, pipGlyph } from "./cues";
import type { StreetId, WindowPx } from "./route";

type Ctx = CanvasRenderingContext2D;
export type PropKind = "open" | "perfect" | "good" | "miss" | "soon";
export type PropOptions = { reducedMotion?: boolean; birds?: readonly CanvasImageSource[];
  /** Launch power from the timing grade (PERFECT flies further, OK barely moves). */
  power?: number };

const OUTLINE = "#120c14";
const RIM = "#fff3cf";
const FRAMES = 4;
/** Idle loop rate (frames per second). */
const IDLE_FPS = 6;
/** Hit-pause: the prop holds perfectly still this long before reacting. */
export const HIT_PAUSE = 0.06;

export type Paint = (r: (x: number, y: number, w: number, h: number, c: string) => void, f: number) => void;
export type Art = { w: number; h: number; paint: Paint };

/** Coordinates are relative to the prop's ground anchor (x centred, y up = negative). */
const ART: Record<Exclude<StreetId, "seagull">, Art> = {
  puddle: { w: 40, h: 10, paint: (r, f) => {
    r(-17, -4, 34, 3, "#1d3f66");
    r(-15, -6, 30, 2, "#2c5d8c");
    r(-12, -7, 22, 1, "#2c5d8c");
    r(-9 + (f % 2), -6, 9, 1, "#bfe3ff");
    r(5 - (f % 2), -5, 4, 1, "#8cc4f0");
    r(-14 + f * 2, -3, 3, 1, "#4f86b8");
  } },
  skateboard: { w: 34, h: 12, paint: (r, f) => {
    r(-16, -11, 3, 2, "#d35a24"); r(13, -11, 3, 2, "#d35a24");
    r(-14, -10, 28, 3, "#d35a24");
    r(-13, -10, 26, 1, "#2a2026");
    r(-11, -9, 10, 1, "#ff8a4a");
    r(-13, -7, 26, 1, "#8a3416");
    r(-10, -6, 4, 1, "#9aa4ac"); r(6, -6, 4, 1, "#9aa4ac");
    r(-11, -5, 4, 4, "#f4efe6"); r(7, -5, 4, 4, "#f4efe6");
    const spin = [[0, 0], [2, 0], [2, 2], [0, 2]][f];
    r(-11 + spin[0], -5 + spin[1], 2, 2, "#b9b2a4"); r(7 + spin[0], -5 + spin[1], 2, 2, "#b9b2a4");
  } },
  sleeping_blanket: { w: 44, h: 24, paint: (r, f) => {
    const breathe = f === 1 || f === 2 ? 1 : 0;
    r(-18, -10 - breathe, 36, 9 + breathe, "#2f4366");
    r(-15, -12 - breathe, 28, 2, "#3f5a86");
    r(-18, -3, 36, 2, "#1d2a44");
    r(-10, -11 - breathe, 2, 9 + breathe, "#e0b04a"); r(2, -11 - breathe, 2, 9 + breathe, "#e0b04a");
    r(-21, -13, 10, 7, "#d8c8a4"); r(-21, -7, 10, 1, "#a8987a");
    r(-19, -17, 7, 5, "#3a2418"); r(-18, -17, 3, 1, "#5a3a28");
    if (f >= 2) r(12 + f, -20 - f * 1, 3, 1, "#cfd8ff");
  } },
  vape_cloud: { w: 40, h: 46, paint: (r, f) => {
    const d = f;
    r(-6, -20 - d, 14, 9, "#9c98a0"); r(-5, -21 - d, 12, 8, "#d6d2ce"); r(-4, -21 - d, 6, 2, "#ffffff");
    r(-12, -30 - d, 14, 10, "#9c98a0"); r(-11, -31 - d, 12, 9, "#d6d2ce"); r(-10, -31 - d, 5, 2, "#ffffff");
    r(2, -38 - d, 14, 10, "#9c98a0"); r(3, -39 - d, 12, 9, "#d6d2ce"); r(4, -39 - d, 6, 2, "#ffffff");
    r(-2, -44 - d, 6, 4, "#d6d2ce");
    r(10 - d, -16, 3, 3, "#bdb8b4");
  } },
  trolley: { w: 34, h: 40, paint: (r, f) => {
    r(-13, -29, 26, 2, "#d7dde2");
    r(-12, -27, 24, 15, "#8f99a1");
    for (let x = -10; x < 12; x += 4) r(x, -27, 1, 15, "#5f6971");
    r(-12, -21, 24, 1, "#5f6971");
    r(-12, -27, 2, 15, "#c3ccd2");
    r(11, -37, 2, 10, "#5f6971");
    r(8, -38, 7, 2, "#e10600");
    r(-11, -12, 22, 2, "#5f6971");
    const wob = f % 2;
    r(-10, -8, 4, 4, "#1a1420"); r(6 + wob, -8, 4, 4, "#1a1420");
    r(-9, -7, 1, 1, "#9aa4ac"); r(7 + wob, -7, 1, 1, "#9aa4ac");
  } },
  newspaper: { w: 26, h: 20, paint: (r, f) => {
    r(-10, -14, 20, 12, "#efe9dc");
    r(-10, -3, 20, 1, "#b9b2a4");
    r(-1, -14, 2, 12, "#c9c2b4");
    r(-8, -12, 6, 2, "#1a1420");
    r(-8, -9, 6, 1, "#7a746c"); r(-8, -7, 5, 1, "#7a746c"); r(-8, -5, 6, 1, "#7a746c");
    r(2, -12, 6, 1, "#7a746c"); r(2, -10, 6, 1, "#7a746c"); r(2, -8, 4, 3, "#e10600");
    r(7, -15 - (f % 2), 3, 2 + (f % 2), "#ffffff");
  } },
  busker: { w: 52, h: 48, paint: (r, f) => {
    r(-22, -4, 12, 4, "#2a1c18"); r(-21, -5, 10, 1, "#4a3428");
    if (f % 2) r(-19, -5, 2, 1, "#f5c518"); else r(-15, -5, 2, 1, "#f5c518");
    r(-10, -10, 16, 10, "#7a4a2a"); r(-10, -10, 16, 2, "#9a6a40"); r(-10, -2, 16, 2, "#5a341c");
    r(-8, -26, 13, 16, "#5a2f3a"); r(-8, -26, 2, 16, "#7e4552"); r(3, -26, 2, 16, "#3e1f28");
    r(-6, -34, 9, 8, "#d9a07a"); r(-6, -34, 2, 8, "#e9b894");
    r(-7, -37, 11, 4, "#e10600"); r(-7, -37, 11, 1, "#ff5a3a");
    r(2, -22, 10, 8, "#c4a060"); r(2, -22, 10, 2, "#e0c080"); r(6, -20, 2, 2, "#3a2418");
    r(12, -25, 12, 2, "#8a6a3c"); r(24, -27, 3, 4, "#5a3a20");
    r(4, -21 + (f % 2) * 2, 3, 2, "#d9a07a");
    r(14 + f, -40 - f * 2, 2, 3, "#f5c518"); r(16 + f, -40 - f * 2, 1, 1, "#f5c518");
  } },
  commuter: { w: 30, h: 48, paint: (r, f) => {
    const bob = f === 2 ? 1 : 0;
    r(-5, -14, 4, 14, "#2a2c38"); r(1, -14, 4, 14, "#2a2c38"); r(-6, -2, 5, 2, "#1a1420"); r(1, -2, 5, 2, "#1a1420");
    r(-7, -34, 14, 20, "#33415e"); r(-7, -34, 2, 20, "#4a5a80"); r(5, -34, 2, 20, "#222c42");
    r(-1, -34, 2, 8, "#d8c8a4");
    r(-4, -43 + bob, 8, 9, "#c98d6a"); r(-4, -43 + bob, 2, 9, "#dca684");
    r(-4, -44 + bob, 8, 3, "#2a1c14");
    r(3, -36, 3, 6, "#33415e");
    r(3, -41 + bob, 3, 4, f === 3 ? "#bff2ff" : "#7ee0ff");
    r(7, -26, 7, 9, "#6a5344"); r(7, -26, 7, 1, "#8a7360"); r(6, -33, 1, 7, "#3a2c24");
  } },
  crossing_signal: { w: 26, h: 84, paint: (r, f) => {
    r(-2, -80, 4, 78, "#3a3036"); r(-2, -80, 1, 78, "#6a5e66");
    r(-11, -80, 22, 14, "#f4efe6"); r(-11, -67, 22, 1, "#b9b2a4");
    r(-9, -78, 4, 10, "#e10600"); r(-1, -78, 4, 10, "#e10600"); r(7, -78, 2, 10, "#e10600");
    r(-10, -63, 20, 2, "#1a1416");
    const left = f % 2 === 0;
    r(-9, -61, 8, 8, left ? "#ff3a1a" : "#3a1012"); r(1, -61, 8, 8, left ? "#3a1012" : "#ff3a1a");
    r(left ? -7 : 3, -59, 3, 3, "#ffd0b0");
    r(-6, -4, 12, 4, "#2a2428"); r(-6, -4, 12, 1, "#4a4048");
  } },
  bin: { w: 28, h: 40, paint: (r, f) => {
    r(-10, -30, 20, 25, "#2f5a44"); r(-10, -30, 3, 25, "#4a7e62"); r(7, -30, 3, 25, "#1d3a2c");
    for (let y = -26; y < -6; y += 5) r(-7, y, 14, 1, "#24483a");
    r(-3, -21, 6, 6, "#f5c518"); r(-2, -20, 4, 4, "#2f5a44");
    const lid = f === 1 ? 1 : 0;
    r(-12, -34 - lid, 24, 4, "#1f3a2e"); r(-12, -34 - lid, 24, 1, "#5a9a78");
    r(-9, -5, 5, 5, "#1a1420"); r(4, -5, 5, 5, "#1a1420");
    const fly = [[6, -38], [9, -36], [7, -35], [4, -37]][f];
    r(fly[0], fly[1], 1, 1, "#1a1420");
  } },
  streetlight: { w: 40, h: 100, paint: (r, f) => {
    r(-2, -90, 4, 86, "#3a3428"); r(-2, -90, 1, 86, "#6a5e48");
    r(-2, -93, 14, 3, "#3a3428"); r(-2, -93, 14, 1, "#6a5e48");
    r(4, -97, 14, 5, "#2a2420"); r(4, -97, 14, 1, "#5a4e3c");
    r(-5, -6, 10, 6, "#2a2420"); r(-5, -6, 10, 1, "#5a4e3c");
    const moth = [[2, -86], [6, -84], [10, -85], [14, -87]][f];
    r(moth[0], moth[1], 1, 1, "#e8e0c8");
  } },
};

export type Baked = { frames: HTMLCanvasElement[]; ghost: HTMLCanvasElement[]; ax: number; ay: number };
const cache = new Map<string, Baked | null>();

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

/** Silhouette of `src` filled with one colour. */
function silhouette(src: HTMLCanvasElement, color: string) {
  const s = canvas(src.width, src.height);
  s.ctx.drawImage(src, 0, 0);
  s.ctx.globalCompositeOperation = "source-in";
  s.ctx.fillStyle = color;
  s.ctx.fillRect(0, 0, src.width, src.height);
  return s.c;
}

/** Outline + rim light + bottom-right shade, all from shifted silhouettes (no pixel reads). */
export function bakeOutlined(src: HTMLCanvasElement, rimAlpha = 0.55, shadeAlpha = 0.3) {
  const out = canvas(src.width, src.height);
  const dark = silhouette(src, OUTLINE);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) out.ctx.drawImage(dark, dx, dy);
  out.ctx.drawImage(src, 0, 0);
  // Rim: sprite pixels whose up-left neighbour is empty.
  const rim = canvas(src.width, src.height);
  rim.ctx.drawImage(silhouette(src, RIM), 0, 0);
  rim.ctx.globalCompositeOperation = "destination-out";
  rim.ctx.drawImage(src, 1, 1);
  out.ctx.globalAlpha = rimAlpha;
  out.ctx.drawImage(rim.c, 0, 0);
  // Shade: sprite pixels whose down-right neighbour is empty.
  const shade = canvas(src.width, src.height);
  shade.ctx.drawImage(dark, 0, 0);
  shade.ctx.globalCompositeOperation = "destination-out";
  shade.ctx.drawImage(src, -1, -1);
  out.ctx.globalAlpha = shadeAlpha;
  out.ctx.drawImage(shade.c, 0, 0);
  out.ctx.globalAlpha = 1;
  return out.c;
}

function bake(id: Exclude<StreetId, "seagull">): Baked | null {
  return bakeArt(id, ART[id]);
}

/** Bakes any 4-frame procedural art once (outline, rim, shade, white ghost), cached by key. */
export function bakeArt(key: string, art: Art): Baked | null {
  if (cache.has(key)) return cache.get(key) ?? null;
  let baked: Baked | null = null;
  try {
    const w = art.w + 4;
    const h = art.h + 4;
    const ax = Math.floor(w / 2);
    const ay = h - 2;
    const frames: HTMLCanvasElement[] = [];
    const ghost: HTMLCanvasElement[] = [];
    for (let f = 0; f < FRAMES; f++) {
      const raw = canvas(w, h);
      art.paint((x, y, rw, rh, c) => { raw.ctx.fillStyle = c; raw.ctx.fillRect(ax + x, ay + y, rw, rh); }, f);
      const done = bakeOutlined(raw.c);
      frames.push(done);
      ghost.push(silhouette(done, "#ffffff"));
    }
    baked = { frames, ghost, ax, ay };
  } catch {
    baked = null;
  }
  cache.set(key, baked);
  return baked;
}

/** Idle frame for a prop at `time` (frame 0 always under reduced motion). */
export function idleFrame(time: number, salt: number, reducedMotion: boolean) {
  if (reducedMotion) return 0;
  return Math.floor(time * IDLE_FPS + salt) % FRAMES;
}

/** Hit squash/stretch after the hit-pause; returns [scaleX, scaleY]. */
export function hitSquash(age: number, reducedMotion: boolean): [number, number] {
  if (reducedMotion || age < HIT_PAUSE) return [1, 1];
  const u = Math.min(1, (age - HIT_PAUSE) / 0.26);
  const k = Math.sin(u * Math.PI) * (1 - u * 0.4);
  return [1 + 0.22 * k, 1 - 0.28 * k];
}

/** Miss wobble rotation (radians), decaying. */
export function missWobble(age: number, reducedMotion: boolean) {
  if (reducedMotion) return 0;
  return Math.sin(age * 30) * 0.2 * Math.exp(-age * 3.2);
}

function salt(x: number) {
  return Math.abs(Math.round(x / 37)) % FRAMES;
}

/** Per-prop flight after a hit (the paper blows away, the trolley rolls...). */
function travel(id: StreetId, lift: number): [number, number, number] {
  switch (id) {
    case "newspaper": return [lift * 26, -lift * 20, lift * 0.6];
    case "trolley": return [lift * 14, 0, 0];
    case "commuter": return [-lift * 8, -lift * 2, 0];
    case "skateboard": return [lift * 22, -Math.sin(lift * Math.PI) * 10, -lift * 0.3];
    case "vape_cloud": return [lift * 6, -lift * 18, 0];
    default: return [0, 0, 0];
  }
}

export function paintProp(
  ctx: Ctx,
  id: StreetId,
  x: number,
  ground: number,
  age: number,
  kind: PropKind,
  time: number,
  opts: PropOptions = {},
) {
  const reduced = !!opts.reducedMotion;
  const hit = kind === "perfect" || kind === "good";
  const lift = hit ? Math.max(0, Math.min(1, (age - HIT_PAUSE) / 0.8)) : 0;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(ground));
  if (id === "seagull") {
    paintGulls(ctx, opts.birds ?? [], time, hit ? lift : 0, reduced);
    if (hit) burst(ctx, 0, -50, age, kind === "perfect", reduced);
    ctx.restore();
    return;
  }
  const baked = bake(id);
  if (!baked) {
    ctx.restore();
    return;
  }
  const f = hit || kind === "miss" ? 0 : idleFrame(time, salt(x), reduced);
  const img = baked.frames[f];
  const power = opts.power ?? 1;
  const [tx, ty, rot] = reduced ? [0, 0, 0] : travel(id, lift).map((v) => v * power) as [number, number, number];
  const [sx, sy] = hit ? hitSquash(age, reduced) : [1, 1];
  ctx.save();
  ctx.translate(tx, ty);
  if (rot) ctx.rotate(rot);
  if (kind === "miss") ctx.rotate(missWobble(age, reduced));
  ctx.scale(sx, sy);
  const alpha = id === "vape_cloud" ? (hit ? Math.max(0, 0.85 - lift) : 0.85)
    : kind === "miss" ? 0.72 : hit && age > 0.7 ? 0.8 : 1;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, -baked.ax, -baked.ay);
  // State overlays: white hit flash, red miss flash, soft "ready" glint while open.
  const flash = hit ? Math.max(0, 1 - age / 0.14) : kind === "miss" ? Math.max(0, 0.5 - age * 2.5) : 0;
  if (flash > 0) {
    ctx.globalAlpha = flash;
    ctx.drawImage(kind === "miss" ? tint(baked, f) : baked.ghost[f], -baked.ax, -baked.ay);
  } else if (kind === "open") {
    ctx.globalAlpha = reduced ? 0.14 : 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(time * 18));
    ctx.drawImage(baked.ghost[f], -baked.ax, -baked.ay);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  lights(ctx, id, kind, lift, time);
  if (hit) burst(ctx, 0, -Math.min(40, ART[id].h * 0.6), age, kind === "perfect", reduced);
  ctx.restore();
}

const missTint = new Map<string, HTMLCanvasElement>();
function tint(baked: Baked, f: number) {
  const key = `${baked.ax}:${baked.ay}:${f}:${baked.frames[f].width}`;
  let c = missTint.get(key);
  if (!c) {
    c = silhouette(baked.frames[f], "#ff3a1a");
    missTint.set(key, c);
  }
  return c;
}

/** Lamps that react to play: crossing lights go gold on a hit, the streetlight switches on. */
function lights(ctx: Ctx, id: StreetId, kind: PropKind, lift: number, time: number) {
  const hit = kind === "perfect" || kind === "good";
  if (id === "crossing_signal" && hit) {
    ctx.fillStyle = "#f5c518";
    ctx.fillRect(-9, -61, 8, 8);
    ctx.fillRect(1, -61, 8, 8);
  }
  if (id === "streetlight") {
    const on = kind === "open" || hit;
    ctx.fillStyle = on ? "#f5c518" : "#4a4232";
    ctx.fillRect(6, -92, 10, 2);
    if (on) {
      ctx.fillStyle = `rgba(245, 197, 24, ${0.16 + (hit ? 0.1 * (1 - lift) : 0.04 * Math.sin(time * 9))})`;
      ctx.beginPath();
      ctx.moveTo(6, -90);
      ctx.lineTo(16, -90);
      ctx.lineTo(30, -4);
      ctx.lineTo(-8, -4);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** Expanding ring + pixel shards on a hit (gold for PERFECT). */
export function burst(ctx: Ctx, x: number, y: number, age: number, perfect: boolean, reduced: boolean) {
  const t = age - HIT_PAUSE;
  if (t < 0 || t > 0.5) return;
  const u = t / 0.5;
  ctx.save();
  ctx.globalAlpha = 1 - u;
  ctx.strokeStyle = perfect ? "#f5c518" : "#64e2ed";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, (reduced ? 18 : 8 + 26 * u), 0, Math.PI * 2);
  ctx.stroke();
  if (!reduced) {
    ctx.fillStyle = perfect ? "#fff3cf" : "#bff2ff";
    const n = perfect ? 8 : 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4;
      const d = 10 + 30 * u;
      ctx.fillRect(Math.round(x + Math.cos(a) * d) - 1, Math.round(y + Math.sin(a) * d) - 1, 3, 3);
    }
  }
  ctx.restore();
}

/** Three gulls from the shared birds strip (28×16 frames); they take off on a hit. */
function paintGulls(ctx: Ctx, birds: readonly CanvasImageSource[], time: number, lift: number, reduced: boolean) {
  const flock: [number, number, number][] = [[-18, -46, 0], [0, -60, 1], [14, -42, 2]];
  for (const [bx, by, s] of flock) {
    const hover = reduced ? 0 : Math.sin(time * 3 + s * 1.7) * 2;
    const up = lift * (36 + s * 10);
    const x = bx + lift * (12 + s * 6);
    const y = by - up + hover;
    if (birds.length) {
      const frame = reduced ? 0 : Math.floor(time * (lift ? 14 : 7) + s) % birds.length;
      ctx.drawImage(birds[frame], Math.round(x - 14), Math.round(y - 8), 28, 16);
    } else {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(Math.round(x - 7), Math.round(y - 3), 14, 6);
      ctx.fillStyle = s === 1 ? "#f4efe6" : "#d8d2c8";
      ctx.fillRect(Math.round(x - 6), Math.round(y - 2), 12, 4);
    }
  }
}

const PIP_COLORS: Record<Btn, [string, string, string]> = {
  A: ["#0f4f99", "#1f8cff", "#9fd0ff"],
  B: ["#7a0a06", "#e10600", "#ff8a7a"],
  C: ["#8a6a08", "#f5c518", "#fff0a0"],
};
const PIP = 14;
const PIP_GAP = 4;

/**
 * Cue above a prop: pips with the bound key glyph, an approach ring that
 * shrinks onto the pip frame at PERFECT, and a short action label.
 */
export function paintCue(ctx: Ctx, trigger: readonly Btn[], x: number, y: number, dist: number, win: WindowPx, time: number, reducedMotion = false) {
  paintCueState(ctx, trigger, x, y, cueState(dist, win), time, reducedMotion);
}

/** Draws a cue from an explicit state (stompable toys close their ring on the beat instead of by distance). */
export function paintCueState(ctx: Ctx, trigger: readonly Btn[], x: number, y: number, state: ReturnType<typeof cueState>, time: number, reducedMotion = false, labelText?: string) {
  if (state.phase === "hidden") return;
  const total = trigger.length * PIP + (trigger.length - 1) * PIP_GAP;
  const hot = state.phase === "hot";
  const bounce = hot && !reducedMotion ? -Math.round(Math.abs(Math.sin(time * 16)) * 2) : 0;
  const cy = Math.round(y) + bounce;
  const left = Math.round(x - total / 2);
  ctx.save();
  ctx.globalAlpha = state.phase === "preview" ? 0.55 : 1;
  // Plate behind the pips keeps them readable over busy scenery.
  ctx.fillStyle = "rgba(8, 6, 10, 0.7)";
  ctx.fillRect(left - 3, cy - 3, total + 6, PIP + 6);
  let px = left;
  ctx.font = "7px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  for (const btn of trigger) {
    const [dark, base, light] = PIP_COLORS[btn];
    const lit = state.phase !== "preview";
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(px - 1, cy - 1, PIP + 2, PIP + 2);
    ctx.fillStyle = lit ? base : dark;
    ctx.fillRect(px, cy, PIP, PIP);
    ctx.fillStyle = lit ? light : base;
    ctx.fillRect(px, cy, PIP, 2);
    ctx.fillStyle = dark;
    ctx.fillRect(px, cy + PIP - 2, PIP, 2);
    const glyph = pipGlyph(keyLabel(btn));
    ctx.fillStyle = "#0c0a0e";
    ctx.font = glyph.length > 1 ? "5px 'Press Start 2P', monospace" : "7px 'Press Start 2P', monospace";
    ctx.fillText(glyph, px + PIP / 2, cy + (glyph.length > 1 ? 9 : 10));
    px += PIP + PIP_GAP;
  }
  // Approach ring: closes from wide to the pip frame; gold when PERFECT.
  const cx = x;
  const ry = cy + PIP / 2;
  const base = total / 2 + 5;
  const radius = base + RING_SPAN * state.ring;
  ctx.globalAlpha = state.phase === "preview" ? 0.45 : 0.95;
  ctx.strokeStyle = state.perfect ? "#f5c518" : hot ? "#f4efe6" : "#9fd0ff";
  ctx.lineWidth = state.perfect ? 3 : 2;
  ctx.beginPath();
  ctx.arc(cx, ry, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = "#f4efe6";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, ry, base, 0, Math.PI * 2);
  ctx.stroke();
  // Label.
  ctx.globalAlpha = state.phase === "preview" ? 0.6 : 1;
  const label = labelText ?? cueLabel(trigger);
  ctx.font = "6px 'Press Start 2P', monospace";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeStyle = OUTLINE;
  ctx.strokeText(label, cx, cy + PIP + 12);
  ctx.fillStyle = state.perfect ? "#f5c518" : "#f4efe6";
  ctx.fillText(label, cx, cy + PIP + 12);
  ctx.restore();
}

/** The street-prop art, shared with the SK8 STOMP toys (the trolley is the same trolley). */
export const PROP_ART = ART;
