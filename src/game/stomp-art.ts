/**
 * SK8 STOMP art (P5): the board, wheelie bin, pigeons, sprinkler, parking
 * meter, coins, ledge and the rival skater. Same recipe as props.ts: 4-frame
 * procedural pixel art, three tones per material, baked once with the dark
 * outline, rim light and shade. Nothing here loads or touches an image file.
 */
import type { Btn } from "./arcade-types";
import { PROP_ART, bakeArt, burst, hitSquash, idleFrame, paintCueState, type Art } from "./props";
import { GRADE_HOP, type Grade, type TrickId } from "./sk8";
import type { StompRun } from "./stompables";

type Ctx = CanvasRenderingContext2D;

const OUT = "#120c14";
const DECK: [string, string, string] = ["#0d6b63", "#1fb5a8", "#7ff0e0"];
const RIVAL_DECK: [string, string, string] = ["#8a1858", "#ff3ea5", "#ffb0dc"];

function boardArt(deck: [string, string, string]): Art {
  const [dark, base, light] = deck;
  return { w: 34, h: 12, paint: (r, f) => {
    r(-16, -11, 3, 2, base); r(13, -11, 3, 2, base);
    r(-14, -10, 28, 3, base);
    r(-13, -10, 26, 1, "#2a2026");
    r(-11, -9, 10, 1, light);
    r(-13, -7, 26, 1, dark);
    r(-10, -6, 4, 1, "#9aa4ac"); r(6, -6, 4, 1, "#9aa4ac");
    r(-11, -5, 4, 4, "#f5c518"); r(7, -5, 4, 4, "#f5c518");
    r(-11, -2, 4, 1, "#b98f10"); r(7, -2, 4, 1, "#b98f10");
    const spin = [[0, 0], [2, 0], [2, 2], [0, 2]][f]!;
    r(-11 + spin[0]!, -5 + spin[1]!, 1, 1, "#fff0a0"); r(7 + spin[0]!, -5 + spin[1]!, 1, 1, "#fff0a0");
  } };
}

const ART: Record<string, Art> = {
  board: boardArt(DECK),
  rivalBoard: boardArt(RIVAL_DECK),
  /** Board lying tail-down, nose up: the tail is the stomp target. */
  boardTail: { w: 38, h: 18, paint: (r, f) => {
    const nod = f === 1 || f === 2 ? 1 : 0;
    for (let i = 0; i < 8; i++) {
      const y = -4 - Math.floor(i * 1.3) - (i > 4 ? nod : 0);
      r(-16 + i * 4, y, 5, 3, DECK[1]);
      r(-16 + i * 4, y, 5, 1, "#2a2026");
      r(-16 + i * 4, y + 2, 5, 1, DECK[0]);
    }
    r(-15, -4, 6, 1, DECK[2]);
    r(-10, -3, 4, 3, "#f5c518"); r(-10, -1, 4, 1, "#b98f10");
    r(7, -12 - nod, 4, 3, "#f5c518"); r(7, -10 - nod, 4, 1, "#b98f10");
    r(-17, -2, 4, 2, "#e10600"); // the tail's kick: a red grip mark to aim at
  } },
  wheelie: { w: 28, h: 42, paint: (r, f) => {
    const lid = f === 1 ? 1 : 0;
    r(-10, -34, 20, 32, "#2f6b3a"); r(-10, -34, 3, 32, "#4f9a5a"); r(7, -34, 3, 32, "#1d4424");
    r(-11, -34, 22, 3, "#2f6b3a");
    for (let y = -28; y < -6; y += 6) r(-6, y, 12, 1, "#24542e");
    r(-3, -24, 6, 4, "#f4efe6"); r(-2, -23, 4, 2, "#1d4424");
    r(-12, -38 - lid, 24, 4, "#f5c518"); r(-12, -38 - lid, 24, 1, "#fff0a0"); r(-12, -35 - lid, 24, 1, "#b98f10");
    r(-13, -37, 2, 7, "#1d4424");
    r(-12, -6, 6, 6, "#1a1420"); r(-11, -5, 2, 2, "#6a6a72");
    r(6, -2, 4, 2, "#1d4424");
  } },
  wheelieOpen: { w: 30, h: 56, paint: (r, f) => {
    r(-10, -34, 20, 32, "#2f6b3a"); r(-10, -34, 3, 32, "#4f9a5a"); r(7, -34, 3, 32, "#1d4424");
    r(-11, -34, 22, 3, "#2f6b3a");
    for (let y = -28; y < -6; y += 6) r(-6, y, 12, 1, "#24542e");
    r(-3, -24, 6, 4, "#f4efe6"); r(-2, -23, 4, 2, "#1d4424");
    r(-15, -54, 4, 20, "#f5c518"); r(-15, -54, 1, 20, "#fff0a0"); r(-12, -54, 1, 20, "#b98f10");
    r(-7, -37 - (f % 2), 4, 3, "#e10600"); r(-1, -38, 5, 3, "#efe9dc"); r(5, -36 - ((f + 1) % 2), 3, 2, "#7ee0ff");
    r(-12, -6, 6, 6, "#1a1420"); r(-11, -5, 2, 2, "#6a6a72");
    r(6, -2, 4, 2, "#1d4424");
  } },
  /** One pigeon. Frames 0-1: stand and peck. Frames 2-3: wings up / down. */
  pigeon: { w: 16, h: 18, paint: (r, f) => {
    const fly = f >= 2;
    const y0 = fly ? -4 : 0;
    r(-5, -7 + y0, 10, 5, "#8a8f9c"); r(-5, -7 + y0, 10, 1, "#b8bcc6"); r(-4, -3 + y0, 8, 1, "#5a5e6a");
    r(-8, -6 + y0, 3, 2, "#5a5e6a");
    if (!fly) {
      r(-3, -6, 6, 2, "#9ca0ab"); r(-2, -5, 1, 1, "#3a3c44"); r(1, -5, 1, 1, "#3a3c44");
      r(-2, -2, 1, 2, "#e0705a"); r(1, -2, 1, 2, "#e0705a");
    } else if (f === 2) {
      r(-4, -14, 7, 7, "#b8bcc6"); r(-4, -14, 7, 1, "#e4e6ea"); r(-3, -8, 5, 1, "#5a5e6a");
    } else {
      r(-4, -5, 7, 5, "#5a5e6a"); r(-4, -5, 7, 1, "#8a8f9c");
    }
    if (f === 1) {
      r(4, -5, 3, 3, "#3f8f6a"); r(5, -4, 1, 1, "#7a4a8f"); r(6, -3, 2, 1, "#d8c8a4");
    } else {
      r(3, -10 + y0, 3, 3, "#8a8f9c"); r(3, -8 + y0, 3, 2, "#3f8f6a"); r(4, -7 + y0, 2, 1, "#7a4a8f");
      r(5, -10 + y0, 1, 1, "#f08a24"); r(6, -9 + y0, 2, 1, "#d8c8a4");
    }
  } },
  sprinkler: { w: 30, h: 22, paint: (r, f) => {
    r(-13, -2, 26, 2, "#2c5d8c"); r(-10, -3, 8, 1, "#4f86b8"); r(4, -2, 6, 1, "#8cc4f0");
    r(-9, -4, 18, 3, "#3a3036"); r(-9, -4, 18, 1, "#6a5e66");
    r(-1, -10, 3, 6, "#9aa4ac"); r(-1, -10, 1, 6, "#d7dde2");
    r(-3, -13, 7, 3, "#e10600"); r(-3, -13, 7, 1, "#ff5a3a");
    r(-4 - f, -15 - (f % 2), 1, 1, "#8cc4f0"); r(4 + f, -15 - ((f + 1) % 2), 1, 1, "#8cc4f0");
    r(-6 - f * 2, -13 + f, 1, 1, "#bfe3ff"); r(6 + f * 2, -13 + f, 1, 1, "#bfe3ff");
  } },
  meter: { w: 18, h: 50, paint: (r, f) => {
    r(-1, -34, 3, 31, "#3a3036"); r(-1, -34, 1, 31, "#6a5e66");
    r(-4, -3, 9, 3, "#2a2428"); r(-4, -3, 9, 1, "#4a4048");
    r(-6, -46, 13, 12, "#9aa4ac"); r(-6, -46, 13, 2, "#d7dde2"); r(-6, -36, 13, 2, "#5f6971");
    r(-4, -43, 9, 5, "#1a1420");
    r(-3, -42, 3 + (f % 2), 3, "#e10600");
    r(2, -42, 2, 1, f >= 2 ? "#ff5a3a" : "#5a1010");
    r(1, -37, 3, 1, "#1a1420");
    r(-5, -48, 11, 2, "#5f6971");
  } },
  meterPaying: { w: 18, h: 50, paint: (r, f) => {
    r(-1, -34, 3, 31, "#3a3036"); r(-1, -34, 1, 31, "#6a5e66");
    r(-4, -3, 9, 3, "#2a2428"); r(-4, -3, 9, 1, "#4a4048");
    r(-6, -46, 13, 12, "#9aa4ac"); r(-6, -46, 13, 2, "#d7dde2"); r(-6, -36, 13, 2, "#5f6971");
    r(-4, -43, 9, 5, f % 2 ? "#f5c518" : "#fff0a0");
    r(-3, -42, 7, 3, "#b98f10");
    r(1, -37, 3, 1, "#1a1420");
    r(-5, -48, 11, 2, "#5f6971");
  } },
  coin: { w: 6, h: 7, paint: (r, f) => {
    const w = [4, 3, 1, 3][f]!;
    r(-Math.floor(w / 2), -6, w, 6, "#f5c518");
    r(-Math.floor(w / 2), -6, Math.max(1, w - 2), 1, "#fff0a0");
    r(-Math.floor(w / 2), -1, w, 1, "#b98f10");
  } },
  /** The rival: blue hoodie, cap on backwards. He brings his own pink board. */
  rival: { w: 26, h: 52, paint: (r, f) => {
    const swing = f % 2;
    r(-6, -20, 4, 13, "#2a2c38"); r(2, -20, 4, 13, "#2a2c38"); r(-6, -20, 1, 13, "#3e4252");
    r(-7, -8, 6, 2, "#f4efe6"); r(2, -8, 6, 2, "#f4efe6"); r(-7, -7, 6, 1, "#b9b2a4"); r(2, -7, 6, 1, "#b9b2a4");
    r(-7, -38, 14, 18, "#1f8cff"); r(-7, -38, 2, 18, "#9fd0ff"); r(5, -38, 2, 18, "#0f4f99");
    r(-4, -26, 8, 3, "#0f4f99");
    r(-10, -36 + swing, 3, 10, "#1f8cff"); r(7, -36 - swing, 3, 10, "#1f8cff");
    r(-10, -27 + swing, 3, 2, "#c98d6a"); r(7, -27 - swing, 3, 2, "#c98d6a");
    r(-4, -47, 8, 9, "#c98d6a"); r(-4, -47, 2, 9, "#dca684");
    r(-5, -49, 9, 3, "#1a1420"); r(-8, -48, 3, 2, "#1a1420"); r(-5, -49, 9, 1, "#3a3440");
    r(1, -44, 1, 1, "#1a1420"); r(1, -41, 2, 1, "#8a5a44");
  } },
};

export function art(key: string) {
  const a = key === "trolley" ? PROP_ART.trolley : ART[key];
  return a ? bakeArt(`p5-${key}`, a) : null;
}

function blit(ctx: Ctx, key: string, frame: number, x: number, y: number, alpha = 1, ghost = 0) {
  const baked = art(key);
  if (!baked) return;
  const img = baked.frames[frame % baked.frames.length]!;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, Math.round(x - baked.ax), Math.round(y - baked.ay));
  if (ghost > 0) {
    ctx.globalAlpha = ghost;
    ctx.drawImage(baked.ghost[frame % baked.ghost.length]!, Math.round(x - baked.ax), Math.round(y - baked.ay));
  }
  ctx.globalAlpha = 1;
}

/** Concrete ledge with a yellow safety edge: a kerb to grind. */
export function paintLedge(ctx: Ctx, x: number, ground: number, len: number) {
  const L = Math.round(x);
  ctx.fillStyle = OUT;
  ctx.fillRect(L - 1, ground - 11, len + 2, 11);
  ctx.fillStyle = "#8a847a";
  ctx.fillRect(L, ground - 8, len, 8);
  ctx.fillStyle = "#b9b2a4";
  ctx.fillRect(L, ground - 10, len, 2);
  ctx.fillStyle = "#f5c518";
  ctx.fillRect(L, ground - 10, len, 1);
  ctx.fillStyle = OUT;
  for (let i = 0; i < len; i += 8) ctx.fillRect(L + i, ground - 10, 3, 1);
  ctx.fillStyle = "#6a645c";
  for (let i = 5; i < len; i += 23) ctx.fillRect(L + i, ground - 6, 2, 1);
}

/** Squash after the shared hit-pause, then settle. */
function squash(ctx: Ctx, age: number, reduced: boolean) {
  const [sx, sy] = hitSquash(age, reduced);
  ctx.scale(sx, sy);
}

/** One stompable prop in its current state. `x` is screen x of its anchor. */
export function paintStomp(ctx: Ctx, run: StompRun, x: number, ground: number, now: number, reduced: boolean) {
  const age = now - run.at;
  const f = idleFrame(now, Math.abs(Math.round(x / 41)) % 4, reduced);
  const perfect = run.grade === "PERFECT";
  ctx.save();
  ctx.translate(Math.round(x), Math.round(ground));
  switch (run.kind) {
    case "ledge":
      ctx.restore();
      paintLedge(ctx, x, ground, run.len || 120);
      return;
    case "board": {
      if (run.state === "riding" || run.state === "gone") break;
      if (run.state === "loose" && age < 0.45 && !reduced) {
        // Squirting away from the bail.
        const u = age / 0.45;
        ctx.translate(-150 * (1 - u) * (1 - u), -Math.sin(u * Math.PI) * 18);
        ctx.rotate(u * Math.PI * 4);
        blit(ctx, "board", 0, 0, 0);
        break;
      }
      blit(ctx, "boardTail", f, 0, 0, 1, run.state === "loose" ? 0.15 + 0.15 * Math.sin(now * 14) : 0);
      break;
    }
    case "trolley": {
      const crashed = run.state === "skittled";
      if (crashed && !reduced) ctx.rotate(Math.min(1, age / 0.5) * 1.2);
      if (run.state === "rolling" && !reduced) ctx.rotate(Math.sin(now * 22) * 0.03);
      blit(ctx, "trolley", run.state === "idle" ? f : Math.floor(now * 12) % 4, 0, 0, crashed && age > 1.2 ? 0.7 : 1, run.state !== "idle" && age < 0.12 ? 0.8 : 0);
      if (crashed) burst(ctx, 0, -24, age, perfect, reduced);
      break;
    }
    case "wheelie": {
      if (run.state === "launched") {
        if (!reduced) ctx.rotate(Math.min(1, age / 0.35) * -1.45);
        blit(ctx, "wheelieOpen", 0, 0, 0, 1, age < 0.12 ? 0.8 : 0);
        ctx.rotate(0);
        burst(ctx, 0, -30, age, perfect, reduced);
      } else if (run.state === "open") {
        squash(ctx, age, reduced);
        blit(ctx, "wheelieOpen", f, 0, 0, 1, age < 0.12 ? 0.8 : 0);
      } else blit(ctx, "wheelie", run.state === "closed" ? 0 : f, 0, 0, 1, run.state === "closed" && age < 0.12 ? 0.6 : 0);
      break;
    }
    case "pigeons": {
      const flock: [number, number][] = [[-16, 0], [-6, -1], [5, 0], [14, -1], [-1, 2]];
      flock.forEach(([bx, by], i) => {
        if (run.state === "idle") {
          blit(ctx, "pigeon", reduced ? 0 : (Math.floor(now * 3 + i * 1.7) % 3 === 0 ? 1 : 0), bx, by);
          return;
        }
        const flight = run.state === "flight";
        if (!flight && i % 2 === 1 && age > 0.6) {
          blit(ctx, "pigeon", 0, bx + 26 + i * 4, by); // scattered birds settle a bit further on
          return;
        }
        const u = Math.min(1.6, age);
        const lift = reduced ? (flight ? 30 : 10) : u * (flight ? 90 + i * 14 : 30 + i * 6);
        const drift = reduced ? 0 : u * (flight ? 30 + i * 12 : 18 + i * 8);
        blit(ctx, "pigeon", reduced ? 2 : 2 + (Math.floor(now * 14 + i) % 2), bx + drift, by - lift, Math.max(0, 1 - u * 0.5));
      });
      if (run.state === "flight") burst(ctx, 0, -20, age, perfect, reduced);
      break;
    }
    case "sprinkler": {
      blit(ctx, "sprinkler", f, 0, 0);
      if (run.state === "splashed" && age < 1.4) {
        const u = age / 1.4;
        ctx.globalAlpha = 1 - u;
        ctx.fillStyle = "#8cc4f0";
        const n = reduced ? 4 : 10;
        for (let i = 0; i < n; i++) {
          const a = Math.PI + (i / (n - 1)) * Math.PI;
          const d = (reduced ? 18 : 10 + 34 * Math.min(1, u * 3)) * (1 + (i % 3) * 0.2);
          ctx.fillRect(Math.round(Math.cos(a) * d), Math.round(-14 + Math.sin(a) * d * 0.9 + (reduced ? 0 : u * 30)), 2, 3);
        }
        ctx.globalAlpha = 1;
        burst(ctx, 0, -14, age, perfect, reduced);
      }
      break;
    }
    case "meter": {
      const paying = run.state === "paying";
      if (paying && !reduced) ctx.translate(Math.sin(now * 40) * 1, 0);
      blit(ctx, paying ? "meterPaying" : "meter", paying ? Math.floor(now * 8) % 4 : f, 0, 0, run.state === "paid" ? 0.85 : 1, paying && now - run.at < 0.1 ? 0.7 : 0);
      if (run.state === "paid" && age < 0.6) burst(ctx, 0, -40, age, run.coins >= 4, reduced);
      break;
    }
  }
  ctx.restore();
}

export type TrickPose = { id: TrickId | "pop" | "bail"; grade: Grade | null; at: number } | null;
export const TRICK_TIME = 0.36;
/** Board height under Moss's soles, in px. */
export const BOARD_LIFT = 10;

/** Hop height for the current trick (0 when settled or under reduced motion). */
export function trickHop(trick: TrickPose, now: number, reduced: boolean) {
  if (!trick || reduced || trick.id === "bail") return 0;
  const u = (now - trick.at) / TRICK_TIME;
  if (u < 0 || u > 1) return 0;
  const h = trick.id === "manual" || trick.id === "grind" || trick.id === "railgrind" ? 3 : GRADE_HOP[trick.grade ?? "OK"];
  return Math.sin(u * Math.PI) * h;
}

/**
 * The board under a rider at (x, ground), animated through the current trick.
 * kickflip / heelflip roll the deck, shove-it spins it flat, a 360 flip does both.
 * `holding` tilts the nose up for a manual (or drops sparks on a grind).
 */
export function paintBoard(ctx: Ctx, x: number, ground: number, trick: TrickPose, now: number, reduced: boolean, holding: "manual" | "grind" | null, rival = false) {
  const hop = trickHop(trick, now, reduced);
  const u = trick ? Math.max(0, Math.min(1, (now - trick.at) / TRICK_TIME)) : 1;
  let sx = 1;
  let sy = 1;
  let rot = 0;
  if (trick && !reduced && u < 1) {
    const turn = Math.cos(u * Math.PI * 2);
    if (trick.id === "kickflip") sy = turn;
    if (trick.id === "heelflip") { sy = turn; rot = -0.12 * Math.sin(u * Math.PI); }
    if (trick.id === "shoveit") sx = turn;
    if (trick.id === "360flip") { sx = turn; sy = Math.cos(u * Math.PI * 4); }
    if (trick.id === "pop") rot = -0.35 * Math.sin(u * Math.PI);
  }
  if (holding === "manual") rot = -0.18;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(ground - hop));
  if (rot) ctx.rotate(rot);
  ctx.scale(sx, Math.abs(sy) < 0.12 ? 0.12 * Math.sign(sy || 1) : sy);
  blit(ctx, rival ? "rivalBoard" : "board", Math.floor(now * 14) % 4, 0, 0);
  ctx.restore();
  if (holding === "grind" && !reduced) {
    ctx.fillStyle = "#f5c518";
    for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(x - 14 - ((now * 90 + i * 9) % 26)), Math.round(ground - 2 - (i % 2) * 2), 2, 1);
  }
  return hop;
}

/** The rival on his board. `trick` animates his board like Moss's. */
export function paintRival(ctx: Ctx, x: number, ground: number, trick: TrickPose, now: number, reduced: boolean, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const hop = paintBoard(ctx, x, ground, trick, now, reduced, null, true);
  const f = reduced ? 0 : Math.floor(now * 4) % 4;
  ctx.globalAlpha = alpha;
  blit(ctx, "rival", f, x, ground - BOARD_LIFT - hop, alpha);
  ctx.restore();
}

export function paintFlyer(ctx: Ctx, kind: "coin" | "rubbish" | "feather" | "drop", x: number, y: number, life: number, max: number, tone: number, now: number) {
  ctx.globalAlpha = Math.max(0, Math.min(1, life / max * 1.5));
  if (kind === "coin") blit(ctx, "coin", Math.floor(now * 16 + tone) % 4, x, y, ctx.globalAlpha);
  else {
    const colors = kind === "rubbish" ? ["#e10600", "#efe9dc", "#7ee0ff"] : kind === "feather" ? ["#d8d2c8", "#b8bcc6", "#8a8f9c"] : ["#8cc4f0", "#bfe3ff", "#4f86b8"];
    ctx.fillStyle = OUT;
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, kind === "drop" ? 3 : 5, kind === "drop" ? 4 : 4);
    ctx.fillStyle = colors[tone % 3]!;
    ctx.fillRect(Math.round(x), Math.round(y), kind === "drop" ? 1 : 3, kind === "drop" ? 2 : 2);
  }
  ctx.globalAlpha = 1;
}

/** Water dripping off Moss while the splash buff is on. */
export function paintDrips(ctx: Ctx, x: number, top: number, ground: number, now: number, reduced: boolean) {
  ctx.fillStyle = "#8cc4f0";
  for (let i = 0; i < 6; i++) {
    const dx = x - 12 + ((i * 9) % 26);
    const fall = reduced ? (i * 13) % 40 : (now * 70 + i * 23) % (ground - top);
    ctx.globalAlpha = reduced ? 0.8 : 0.9 - fall / (ground - top) * 0.6;
    ctx.fillRect(Math.round(dx), Math.round(top + fall), 1, 2);
  }
  ctx.globalAlpha = 1;
}

/**
 * Cue over a toy: the same pips as street cues, but the ring closes on every
 * beat (or every downbeat) instead of by distance, because toys are played
 * on the music.
 */
export function paintBeatCue(ctx: Ctx, trigger: readonly Btn[], x: number, y: number, phase01: number, hot: boolean, now: number, reduced: boolean, label: string) {
  const ring = reduced ? 0.35 : Math.max(0, Math.min(1, 1 - phase01));
  const perfect = phase01 < 0.1 || phase01 > 0.92;
  paintCueState(ctx, trigger, x, y, { phase: hot ? "hot" : "preview", ring: hot ? ring : Math.min(1, ring + 0.2), perfect: hot && perfect }, now, reduced, label);
}
