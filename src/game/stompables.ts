/**
 * Stompable props (P5): optional street toys that sit between the authored
 * encounters. Ignoring one never costs anything; playing it well pays. Each
 * has a small state machine driven by a press, its timing grade and the beat.
 * Pure: the engine glue (engine/sk8.ts) owns the live map and applies results.
 */
import type { Btn } from "./arcade-types";
import { GRADE_MULT, isDownbeat, type Grade, type Timing } from "./sk8";
import { DOOR_AT } from "./bonus";
import { ROUTE_PX, STREETS, ZONES, streetX, type ZoneId } from "./route";

export type StompKind = "board" | "trolley" | "wheelie" | "pigeons" | "sprinkler" | "meter" | "ledge";

export type StompSpec = { uid: string; kind: StompKind; zone: ZoneId; at: number; len?: number };

/** Layout. Every prop keeps clear of the authored encounters (see auditStompables). */
const RAW: Omit<StompSpec, "uid">[] = [
  { kind: "board", zone: "caravan", at: 0.35 },
  { kind: "meter", zone: "tracks", at: 0.18 },
  { kind: "pigeons", zone: "tracks", at: 0.58 },
  { kind: "pigeons", zone: "station", at: 0.08 },
  { kind: "meter", zone: "station", at: 0.68 },
  { kind: "sprinkler", zone: "shops", at: 0.065 },
  { kind: "board", zone: "shops", at: 0.2 },
  { kind: "ledge", zone: "shops", at: 0.225, len: 170 },
  { kind: "trolley", zone: "shops", at: 0.38 },
  { kind: "wheelie", zone: "shops", at: 0.425 },
  { kind: "pigeons", zone: "shops", at: 0.57 },
  { kind: "board", zone: "pier", at: 0.3 },
  { kind: "pigeons", zone: "pier", at: 0.585 },
];

export const STOMPABLES: StompSpec[] = RAW.map((spec, i) => ({ ...spec, uid: `${spec.zone}-${spec.kind}-${i}` }));

export function stompX(spec: Pick<StompSpec, "zone" | "at">): number {
  const zone = ZONES.find((z) => z.id === spec.zone);
  return zone ? zone.start + spec.at * zone.px : 0;
}

/** Surface under world x on lap-local terms: the pier deck is a rail, ledges are kerbs. */
export function surfaceAt(worldX: number): "kerb" | "rail" | null {
  const x = ((worldX % ROUTE_PX) + ROUTE_PX) % ROUTE_PX;
  for (const spec of STOMPABLES) {
    if (spec.kind !== "ledge") continue;
    const s = stompX(spec);
    if (x >= s - 10 && x <= s + (spec.len ?? 120) + 10) return "kerb";
  }
  const pier = ZONES.find((z) => z.id === "pier")!;
  if (x >= pier.start + pier.px * 0.3 && x <= pier.start + pier.px * (DOOR_AT - 0.03)) return "rail";
  return null;
}

/** Problems with the layout; empty means every prop is clear of encounters and the door. */
export function auditStompables(minGap = 100): string[] {
  const problems: string[] = [];
  const hits = STREETS.map(streetX);
  const pier = ZONES.find((z) => z.id === "pier")!;
  const door = pier.start + pier.px * DOOR_AT;
  for (const spec of STOMPABLES) {
    if (spec.kind === "ledge") continue;
    const x = stompX(spec);
    const near = hits.find((h) => Math.abs(h - x) < minGap);
    if (near !== undefined) problems.push(`${spec.uid} is ${Math.round(Math.abs(near - x))}px from an encounter`);
    if (Math.abs(door - x) < 200) problems.push(`${spec.uid} crowds the bonus door`);
    if (spec.at <= 0 || spec.at >= 1) problems.push(`${spec.uid} sits outside its zone`);
  }
  if (new Set(STOMPABLES.map((s) => s.uid)).size !== STOMPABLES.length) problems.push("duplicate prop ids");
  return problems;
}

// ── Live state machines ──────────────────────────────────────────────────

export type StompState =
  | "idle" | "riding" | "loose" | "gone"
  | "rolling" | "skittled"
  | "open" | "launched" | "closed"
  | "scattered" | "flight"
  | "splashed"
  | "paying" | "paid";

export type StompRun = {
  key: string;
  kind: StompKind;
  /** Current world x (trolleys roll, squirted boards move). */
  world: number;
  state: StompState;
  /** When the state last changed (engine seconds). */
  at: number;
  grade: Grade | null;
  /** Meter: coins paid and the last beat that paid. */
  coins: number;
  lastBeat: number;
  /** Trolley: x where it started rolling. */
  rollFrom: number;
  /** Ledge length in px (0 for everything else). */
  len: number;
};

export type Tag =
  | "board:land" | "board:kickflip" | "board:360" | "board:grind" | "board:manual"
  | "trolley:skittle" | "wheelie:launch" | "pigeons:flight" | "splash" | "meter:coins" | "rival:win";

export type StompResult = {
  label: string;
  /** Base points before the global point scale. */
  points: number;
  grade: Grade | null;
  tags: Tag[];
  /** Board: start a ride with this pop grade. */
  ride?: Grade;
  /** Sprinkler: seconds of the dripping score buff. */
  buff?: number;
  /** Trolley skittle: knock the next wheelie bin ahead. */
  knock?: boolean;
  /** Meter: coin number just paid. */
  coin?: number;
  good: boolean;
};

export const REACH_BEHIND = -36;
export const REACH_AHEAD = 44;
/** Seconds a rolling trolley keeps rolling before it is gone. */
export const ROLL_TIME = 2.4;
export const ROLL_SPEED = 104;
/** Beats an open wheelie bin waits for its second stomp. */
export const OPEN_BEATS = 2;
export const SQUIRT_PX = 150;
export const METER_JACKPOT = 4;
export const METER_MAX = 6;
export const BUFF_MULT = 1.25;
export const BUFF_SECONDS: Record<Timing, number> = { PERFECT: 8, GREAT: 6, OK: 4, MISS: 3 };

export function newRun(key: string, kind: StompKind, world: number, len = 0): StompRun {
  return { key, kind, world, state: "idle", at: -99, grade: null, coins: 0, lastBeat: -999, rollFrom: world, len };
}

/** Live x of a prop (rolling trolleys move on their own). */
export function runX(p: StompRun, now: number): number {
  if (p.kind === "trolley") {
    if (p.state === "rolling" || p.state === "gone") return p.rollFrom + Math.max(0, now - p.at) * ROLL_SPEED;
    if (p.state === "skittled") return p.world + Math.min(0.6, Math.max(0, now - p.at)) * 260;
  }
  return p.world;
}

/** True when a press can reach the prop at distance `dist` (prop minus Moss, px). */
export function inReach(p: StompRun, dist: number): boolean {
  if (p.kind === "ledge") return false;
  if (p.state === "paying") return true; // the meter locks on once it starts paying
  if (p.state === "rolling") return dist >= REACH_BEHIND && dist <= REACH_AHEAD + 90;
  if (p.state === "open") return dist >= REACH_BEHIND - 30 && dist <= REACH_AHEAD;
  if (p.state !== "idle" && p.state !== "loose") return false;
  return dist >= REACH_BEHIND && dist <= REACH_AHEAD;
}

/** True while the prop is still asking for a press (drives its cue). */
export function wantsPress(p: StompRun): boolean {
  return p.kind !== "ledge" && (p.state === "idle" || p.state === "loose" || p.state === "rolling" || p.state === "open" || p.state === "paying");
}

function result(label: string, points: number, grade: Grade | null, extra: Partial<StompResult> = {}): StompResult {
  return { label, points, grade, tags: [], good: points > 0, ...extra };
}

function set(p: StompRun, state: StompState, now: number) {
  p.state = state;
  p.at = now;
}

/**
 * A press on a prop in reach. Returns null when the prop ignores that button
 * (the press then falls through to Moss's normal moves).
 */
export function stompProp(p: StompRun, btn: Btn, timing: Timing, now: number, beat: number): StompResult | null {
  const grade: Grade | null = timing === "MISS" ? null : timing;
  const mult = grade ? GRADE_MULT[grade] : 0.5;
  switch (p.kind) {
    case "board":
      if (btn !== "B" || (p.state !== "idle" && p.state !== "loose")) return null;
      if (!grade) {
        p.world += SQUIRT_PX;
        set(p, "loose", now);
        return result("SQUIRTED! STOMP IT ON THE BEAT", 0, null);
      }
      set(p, "riding", now);
      p.grade = grade;
      return result(grade === "PERFECT" ? "PERFECT POP!" : "POP!", Math.round(60 * mult), grade, { ride: grade });
    case "trolley":
      if (btn !== "B") return null;
      if (p.state === "idle") {
        p.rollFrom = p.world;
        set(p, "rolling", now);
        p.grade = grade;
        return result("TROLLEY ROLL", Math.round(80 * mult), grade);
      }
      if (p.state === "rolling") {
        if (grade === "PERFECT" || grade === "GREAT") {
          p.world = runX(p, now);
          set(p, "skittled", now);
          p.grade = grade;
          return result("SKITTLED!", Math.round(450 * mult), grade, { tags: ["trolley:skittle"], knock: true });
        }
        p.state = "gone"; // keeps rolling from where it was, out of reach
        return result("TROLLEY GOT AWAY", 0, grade);
      }
      return null;
    case "wheelie":
      if (btn !== "B") return null;
      if (p.state === "idle") {
        set(p, "open", now);
        p.lastBeat = beat;
        p.grade = grade;
        return result("LID FLIP", Math.round(90 * mult), grade);
      }
      if (p.state === "open") {
        if ((grade === "PERFECT" || grade === "GREAT") && beat !== p.lastBeat) {
          set(p, "launched", now);
          p.grade = grade;
          return result("RUBBISH RAIN!", Math.round(400 * mult), grade, { tags: ["wheelie:launch"] });
        }
        if (beat === p.lastBeat) return result("", 0, grade); // same beat as the lid flip: wait for the next one
        set(p, "closed", now);
        return result("LID SLAM", Math.round(40 * mult), grade);
      }
      return null;
    case "pigeons":
      if (p.state !== "idle") return null;
      if (btn === "B" && isDownbeat(beat) && (grade === "PERFECT" || grade === "GREAT")) {
        set(p, "flight", now);
        p.grade = grade;
        return result("FLOCK FLIGHT!", Math.round(500 * mult), grade, { tags: ["pigeons:flight"] });
      }
      set(p, "scattered", now);
      p.grade = grade;
      return result(btn === "B" ? "SCATTER (STOMP THE DOWNBEAT)" : "SCATTER", Math.round(60 * (grade ? GRADE_MULT[grade] : 0.5)), grade);
    case "sprinkler":
      if (btn !== "B" || p.state !== "idle") return null;
      set(p, "splashed", now);
      p.grade = grade;
      return result(`SPLASH! DRIPPING ×${BUFF_MULT}`, Math.round(50 * mult), grade, { tags: ["splash"], buff: BUFF_SECONDS[timing] });
    case "meter":
      if (btn !== "B") return null;
      if (p.state === "idle") {
        if (!grade) {
          set(p, "paid", now);
          return result("JAMMED", 0, null);
        }
        set(p, "paying", now);
        p.coins = 1;
        p.lastBeat = beat;
        return result("COIN!", Math.round(60 * mult), grade, { coin: 1 });
      }
      if (p.state === "paying") {
        if (beat === p.lastBeat) return result("", 0, grade);
        if (!grade || beat > p.lastBeat + 2) {
          set(p, "paid", now);
          return result(`PAID OUT ×${p.coins}`, 0, grade);
        }
        p.coins += 1;
        p.lastBeat = beat;
        const tags: Tag[] = p.coins === METER_JACKPOT ? ["meter:coins"] : [];
        if (p.coins >= METER_MAX) set(p, "paid", now);
        return result(p.coins === METER_JACKPOT ? "JACKPOT!" : `COIN ×${p.coins}`, Math.round(60 * p.coins * GRADE_MULT[grade]), grade, { tags, coin: p.coins });
      }
      return null;
    case "ledge":
      return null;
  }
}

/** Time-driven transitions: trolleys roll away, open lids drop, meters stop paying. */
export function tickProp(p: StompRun, now: number, beat: number, beatDur: number): StompState {
  if (p.state === "rolling" && now - p.at > ROLL_TIME) {
    p.state = "gone";
  } else if (p.state === "open" && now - p.at > OPEN_BEATS * beatDur + 0.2) {
    set(p, "closed", now);
  } else if (p.state === "paying" && beat > p.lastBeat + 2) {
    set(p, "paid", now);
  }
  return p.state;
}

/** A skittled trolley knocks an idle or open wheelie bin into launch. */
export function knockWheelie(p: StompRun, now: number): StompResult | null {
  if (p.kind !== "wheelie" || (p.state !== "idle" && p.state !== "open")) return null;
  set(p, "launched", now);
  p.grade = "GREAT";
  return result("SKITTLES! BINS DOWN", 300, "GREAT", { tags: ["wheelie:launch"] });
}

// ── Stage trick lists (shown) and hidden best lines (S-rank) ─────────────

export type Challenge = { zone: ZoneId; text: string; short: string; tags: Tag[] };

/** One visible trick-list challenge per stage, shown as an objective chip. */
export const CHALLENGES: Challenge[] = [
  { zone: "caravan", text: "LAND A KICKFLIP", short: "KICKFLIP", tags: ["board:kickflip"] },
  { zone: "tracks", text: `METER ${METER_JACKPOT} COINS`, short: "COINS", tags: ["meter:coins"] },
  { zone: "station", text: "DOWNBEAT FLOCK", short: "FLOCK", tags: ["pigeons:flight"] },
  { zone: "shops", text: "BOARD → TROLLEY → BINS", short: "B→T→B", tags: ["board:land", "trolley:skittle", "wheelie:launch"] },
  { zone: "pier", text: "360 FLIP ON THE PIER", short: "360 PIER", tags: ["board:360"] },
  { zone: "caravan_return", text: "SCHOOL THE RIVAL", short: "RIVAL", tags: ["rival:win"] },
];

/** Hidden best lines: never shown until found. Each one found counts toward S-rank. */
export const LINES: { zone: ZoneId; name: string; tags: Tag[] }[] = [
  { zone: "tracks", name: "COIN-OP COO", tags: ["meter:coins", "pigeons:flight"] },
  { zone: "shops", name: "WET WHEELS", tags: ["splash", "board:grind", "trolley:skittle"] },
  { zone: "pier", name: "RAIL TO THE GULLS", tags: ["board:grind", "pigeons:flight"] },
];

/** True when `want` appears in order (not necessarily adjacent) inside `seen`. */
export function inOrder(seen: readonly Tag[], want: readonly Tag[]): boolean {
  let i = 0;
  for (const tag of seen) {
    if (tag === want[i]) i += 1;
    if (i >= want.length) return true;
  }
  return want.length === 0;
}

/** How far through `want` the player is (in order), for the chip read-out. */
export function inOrderCount(seen: readonly Tag[], want: readonly Tag[]): number {
  let i = 0;
  for (const tag of seen) if (tag === want[i]) i += 1;
  return Math.min(i, want.length);
}

export function challengeFor(zone: string): Challenge | null {
  return CHALLENGES.find((c) => c.zone === zone) ?? null;
}

/** Tags a landed board chain contributes. */
export function rideTags(ids: readonly string[]): Tag[] {
  const tags: Tag[] = ["board:land"];
  if (ids.includes("kickflip")) tags.push("board:kickflip");
  if (ids.includes("360flip")) tags.push("board:360");
  if (ids.includes("grind") || ids.includes("railgrind")) tags.push("board:grind");
  if (ids.includes("manual")) tags.push("board:manual");
  return tags;
}
