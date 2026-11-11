/**
 * SK8 STOMP (P5): pure rules for timing grades, the board ride, trick chains,
 * specials, the style meter and the rival skater's call-and-response.
 * No canvas, no audio, no Arcade: the engine glue (engine/sk8.ts) feeds it
 * button presses with a timing judgement and applies the outcomes.
 */
import type { Btn } from "./arcade-types";

/** Shared timing grades. PERFECT > GREAT > OK; MISS is outside the beat window. */
export type Grade = "PERFECT" | "GREAT" | "OK";
export type Timing = Grade | "MISS";

/** Maps the engine's beat judgement (PERFECT / FRESH / LATE / OFF) onto the shared grades. */
export function gradeOf(judge: string): Timing {
  if (judge === "PERFECT") return "PERFECT";
  if (judge === "FRESH") return "GREAT";
  if (judge === "LATE") return "OK";
  return "MISS";
}

/** Points multiplier per grade, used by street encounters, props and tricks alike. */
export const GRADE_MULT: Record<Grade, number> = { PERFECT: 1.5, GREAT: 1.2, OK: 1 };
/** Launch power per grade: how far a hit prop flies / how high a trick pops. */
export const GRADE_POWER: Record<Grade, number> = { PERFECT: 1.35, GREAT: 1, OK: 0.7 };
/** Pop height in px for a trick of each grade. */
export const GRADE_HOP: Record<Grade, number> = { PERFECT: 20, GREAT: 14, OK: 9 };

/**
 * Street encounters are judged by distance. Inside the authored PERFECT window
 * is PERFECT; the inner half of the remaining good window is GREAT; the rest OK.
 */
export function distGrade(dist: number, perfectPx: number, goodPx: number): Grade | null {
  const d = Math.abs(dist);
  if (!Number.isFinite(d) || d > goodPx) return null;
  if (d <= perfectPx) return "PERFECT";
  return d <= (perfectPx + goodPx) / 2 ? "GREAT" : "OK";
}

// ── Tricks ────────────────────────────────────────────────────────────────

export type TrickId = "kickflip" | "heelflip" | "shoveit" | "360flip" | "manual" | "grind" | "railgrind";
export type TrickDef = { id: TrickId; name: string; base: number; special: boolean };

export const TRICKS: Record<TrickId, TrickDef> = {
  kickflip: { id: "kickflip", name: "KICKFLIP", base: 60, special: false },
  heelflip: { id: "heelflip", name: "HEELFLIP", base: 65, special: false },
  shoveit: { id: "shoveit", name: "POP SHOVE-IT", base: 55, special: false },
  "360flip": { id: "360flip", name: "360 FLIP", base: 300, special: true },
  manual: { id: "manual", name: "MANUAL", base: 120, special: true },
  grind: { id: "grind", name: "50-50 GRIND", base: 200, special: true },
  railgrind: { id: "railgrind", name: "RAIL GRIND", base: 220, special: true },
};

/** Each button flips the board its own way: stride = kickflip, stomp = heelflip, style = shove-it. */
export const BTN_TRICK: Record<Btn, TrickId> = { A: "kickflip", B: "heelflip", C: "shoveit" };

/** PERFECT taps in a row that turn the next flip into a 360 flip. */
export const SPECIAL_RUN = 3;
/** A button held at least this long, then released, lands a manual (or a grind on a kerb/rail). */
export const HOLD_MIN = 0.4;
/** Beats a ride lasts after the pop; a PERFECT pop rolls longer. */
export const RIDE_BEATS = 8;
export const PERFECT_POP_BEATS = 2;
/** The chain multiplier grows by this per extra trick, capped. */
export const MULT_STEP = 0.5;
export const MULT_CAP = 4;
export const STYLE_START = 0.5;

export type Surface = "kerb" | "rail" | null;
export type Link = { id: TrickId; name: string; grade: Grade; points: number; special: boolean };

export type Ride = {
  startedAt: number;
  endsAt: number;
  pop: Grade;
  links: Link[];
  /** Consecutive PERFECT flips toward a 360. */
  perfectRun: number;
  /** Last beat index a flip was landed on (one flip per beat). */
  lastBeat: number;
  /** Button that started a possible manual / grind, and when it went down. */
  holdBtn: Btn | null;
  holdAt: number;
};

export type Sk8 = {
  ride: Ride | null;
  /** 0..1: mixing moves fills it, repeating drains it. Persists across rides. */
  style: number;
  /** Recent trick ids for the style meter. */
  recent: TrickId[];
  landed: number;
  bails: number;
  tricks: number;
  bestChain: number;
  specials: Set<TrickId>;
};

export function newSk8(): Sk8 {
  return { ride: null, style: STYLE_START, recent: [], landed: 0, bails: 0, tricks: 0, bestChain: 0, specials: new Set() };
}

export function startRide(s: Sk8, now: number, beatDur: number, pop: Grade): Ride {
  const beats = RIDE_BEATS + (pop === "PERFECT" ? PERFECT_POP_BEATS : 0);
  s.ride = { startedAt: now, endsAt: now + beats * beatDur, pop, links: [], perfectRun: 0, lastBeat: -999, holdBtn: null, holdAt: 0 };
  return s.ride;
}

/** Chain multiplier for `n` landed links: ×1, ×1.5, ×2 … capped at ×4. */
export function chainMult(n: number): number {
  if (n <= 0) return 0;
  return Math.min(MULT_CAP, 1 + (n - 1) * MULT_STEP);
}

export function chainBase(links: readonly Link[]): number {
  return links.reduce((sum, link) => sum + link.points, 0);
}

/** Style factor applied when a chain lands: 0.6 at an empty meter, 1.4 when full. */
export function styleFactor(style: number): number {
  return 0.6 + 0.8 * Math.max(0, Math.min(1, style));
}

/** Banked value (before the global point scale) of the current chain. */
export function chainValue(s: Sk8, buff = 1): number {
  const links = s.ride?.links ?? [];
  return Math.round(chainBase(links) * chainMult(links.length) * styleFactor(s.style) * buff);
}

/**
 * Style meter. Repeating the last move drains it, a move not seen in the last
 * three fills it, a special fills it more.
 */
export function styleAfter(style: number, recent: readonly TrickId[], id: TrickId): number {
  let next = style;
  const last = recent.at(-1);
  if (last === id) next -= 0.18;
  else if (!recent.slice(-3).includes(id)) next += 0.12;
  else next += 0.04;
  if (TRICKS[id].special) next += 0.12;
  return Math.max(0, Math.min(1, next));
}

function addLink(s: Sk8, id: TrickId, grade: Grade): Link {
  const def = TRICKS[id];
  const link: Link = { id, name: def.name, grade, points: Math.round(def.base * GRADE_MULT[grade]), special: def.special };
  s.ride!.links.push(link);
  s.style = styleAfter(s.style, s.recent, id);
  s.recent.push(id);
  if (s.recent.length > 6) s.recent.shift();
  s.tricks += 1;
  if (def.special) s.specials.add(id);
  return link;
}

export type TapOutcome =
  | { kind: "none" }
  | { kind: "repeat" }
  | { kind: "bail"; lost: number; links: Link[] }
  | { kind: "trick"; link: Link; mult: number };

/**
 * One tap while riding. On the beat = a flip (the button picks which), three
 * PERFECTs in a row = 360 flip. Off the beat = bail: the chain is lost.
 * A second tap on the same beat is ignored rather than punished.
 */
export function rideTap(s: Sk8, btn: Btn, timing: Timing, now: number, beat: number): TapOutcome {
  const ride = s.ride;
  if (!ride) return { kind: "none" };
  if (timing === "MISS") return bail(s);
  if (beat === ride.lastBeat) return { kind: "repeat" };
  ride.lastBeat = beat;
  ride.perfectRun = timing === "PERFECT" ? ride.perfectRun + 1 : 0;
  let id = BTN_TRICK[btn];
  if (ride.perfectRun >= SPECIAL_RUN) {
    id = "360flip";
    ride.perfectRun = 0;
  }
  ride.holdBtn = btn;
  ride.holdAt = now;
  const link = addLink(s, id, timing);
  return { kind: "trick", link, mult: chainMult(ride.links.length) };
}

/**
 * Releasing a held button. A hold of HOLD_MIN or longer that started on a
 * landed flip becomes a manual, or a grind on a kerb (50-50) or the pier rail.
 * A sloppy release still lands, at OK.
 */
export function rideRelease(s: Sk8, btn: Btn, timing: Timing, now: number, surface: Surface): TapOutcome {
  const ride = s.ride;
  if (!ride || ride.holdBtn !== btn) return { kind: "none" };
  const held = now - ride.holdAt;
  ride.holdBtn = null;
  if (held < HOLD_MIN) return { kind: "none" };
  const id: TrickId = surface === "rail" ? "railgrind" : surface === "kerb" ? "grind" : "manual";
  const link = addLink(s, id, timing === "MISS" ? "OK" : timing);
  return { kind: "trick", link, mult: chainMult(ride.links.length) };
}

export function bail(s: Sk8): TapOutcome {
  const ride = s.ride;
  if (!ride) return { kind: "none" };
  const lost = chainValue(s);
  s.ride = null;
  s.bails += 1;
  s.style = Math.max(0, s.style - 0.15);
  return { kind: "bail", lost, links: ride.links };
}

/** Lands the ride and returns the banked value (before the global point scale). */
export function land(s: Sk8, buff = 1): { value: number; links: Link[] } {
  const ride = s.ride;
  if (!ride) return { value: 0, links: [] };
  const value = chainValue(s, buff);
  s.ride = null;
  if (ride.links.length) {
    s.landed += 1;
    s.bestChain = Math.max(s.bestChain, ride.links.length);
  }
  return { value, links: ride.links };
}

/** Short chain read-out, newest last: "KICKFLIP + HEELFLIP + 360 FLIP". */
export function chainText(links: readonly Link[], max = 3): string {
  const tail = links.slice(-max).map((link) => link.name);
  return (links.length > max ? "… + " : "") + tail.join(" + ");
}

// ── Beat helpers ──────────────────────────────────────────────────────────

/** Index of the beat nearest to song time `t`. Beat 0 is a downbeat. */
export function nearestBeat(t: number, beatDur: number): number {
  return Math.round(t / beatDur);
}

export function isDownbeat(beat: number): boolean {
  return ((beat % 4) + 4) % 4 === 0;
}

// ── Rival skater: four bars of call and response ─────────────────────────

/** His lines. Two are picked per meeting: an easy opener, then a harder answer. */
export const RIVAL_LINES: readonly Btn[][] = [
  ["A", "B", "A", "C"],
  ["A", "A", "C", "C"],
  ["C", "A", "B", "A"],
  ["B", "C", "A", "B"],
  ["A", "C", "B", "C"],
  ["C", "C", "B", "A"],
];

export function rivalPlan(seed: number): [Btn[], Btn[]] {
  const n = Math.abs(Math.floor(seed));
  const first = RIVAL_LINES[n % 3]!;
  const second = RIVAL_LINES[3 + ((n + 1) % 3)]!;
  return [[...first], [...second]];
}

export type RivalPhase = { phase: "intro" | "call" | "response" | "done"; bar: number; slot: number };

/** Where beat `beat` falls, for a meeting whose first call starts on `startBeat`. */
export function rivalPhase(startBeat: number, beat: number): RivalPhase {
  const b = beat - startBeat;
  if (b < 0) return { phase: "intro", bar: 0, slot: 0 };
  if (b >= 16) return { phase: "done", bar: 1, slot: 3 };
  const bar = Math.floor(b / 8);
  const inBar = b % 8;
  return inBar < 4 ? { phase: "call", bar, slot: inBar } : { phase: "response", bar, slot: inBar - 4 };
}

/** Beat index of response slot `slot` in bar `bar`. */
export function responseBeat(startBeat: number, bar: number, slot: number): number {
  return startBeat + bar * 8 + 4 + slot;
}

export type RivalMark = Timing | "WRONG" | null;
export type RivalResult = { matched: number; total: number; points: number; outTricked: number; win: boolean };

export const RIVAL_WIN = 6;
export const RIVAL_WIN_BONUS = 2500;
export const RIVAL_OUT_BONUS = 1500;
const RIVAL_BEAT: Record<Grade, number> = { PERFECT: 300, GREAT: 200, OK: 100 };

/**
 * Scores the two response bars. A beat counts when the right button landed on
 * it. Six of eight beats beats him; a bar answered all PERFECT out-tricks him.
 */
export function rivalScore(marks: readonly (readonly RivalMark[])[]): RivalResult {
  let matched = 0;
  let points = 0;
  let outTricked = 0;
  let total = 0;
  for (const bar of marks) {
    let clean = bar.length > 0;
    for (const mark of bar) {
      total += 1;
      if (mark === "PERFECT" || mark === "GREAT" || mark === "OK") {
        matched += 1;
        points += RIVAL_BEAT[mark];
      }
      if (mark !== "PERFECT") clean = false;
    }
    if (clean) outTricked += 1;
  }
  const win = matched >= RIVAL_WIN;
  points += (win ? RIVAL_WIN_BONUS : 0) + outTricked * RIVAL_OUT_BONUS;
  return { matched, total, points, outTricked, win };
}
