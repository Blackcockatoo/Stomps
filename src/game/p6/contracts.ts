/**
 * P6 street-toy contracts (P6.2a). Pure data shapes and guards, no canvas,
 * audio or Arcade. The engine glue (engine/sk8.ts) owns live state and calls
 * `payFactor` before paying anything.
 *
 * Design rules carried over from the existing game:
 *  - Timing comes only from scoring.beatJudge() -> sk8.gradeOf() (the same
 *    60/110/160 ms windows as every other prop). No new timing windows.
 *  - An authored street encounter always wins a press (engine/sk8.ts contested()).
 *  - Props never touch FLOW, door hits, Quake Drive or the route grade, so
 *    ignoring them costs nothing.
 *  - Points are base values that go through feel.pointsFor().
 *  - Art is drawn in code (props.ts bakeArt, keys prefixed "p6/"); no sprite PNG.
 *
 * Implemented gestures in P6.2a: "tap" and "timed". Holds, releases, chords
 * and alternating sequences are proposed for later P6.2 PRs and are rejected
 * by auditPropDefs until the engine supports them.
 */
import type { Btn } from "../arcade-types";
import type { Grade, Timing } from "../sk8";
import type { ZoneId } from "../route";

export type P6PropKind = "cone";
export type P6State = "idle" | "airborne" | "toppled" | "spent";

/** Which beats a timed gesture accepts. Downbeat = sk8.isDownbeat (beat % 4 === 0). */
export type BeatFilter = "any" | "downbeat";

export type Gesture =
  /** Any press of the button works; the timing grade only scales the points (MISS pays 0). */
  | { kind: "tap"; btn: Btn }
  /** The press must reach `minGrade`; below it the prop takes its `fail` path. */
  | { kind: "timed"; btn: Btn; minGrade: Grade; beat: BeatFilter };

export type P6Tag = "cone:stepped" | "cone:launched" | "cone:spun";

export type PropInteraction = {
  /** Stable id, also the repeat-decay key, e.g. "cone.launch". */
  id: string;
  verb: string;
  gesture: Gesture;
  from: readonly P6State[];
  to: P6State;
  /** Base points before GRADE_MULT and pointsFor(). */
  base: number;
  emits?: readonly P6Tag[];
  /** Below minGrade (timed only): new state and the callout. Pays nothing. */
  fail?: { to: P6State; label: string };
  sound: "stomp" | "style";
};

export type PropDef = {
  kind: P6PropKind;
  label: string;
  /** bakeArt cache key; must start with "p6/". */
  art: `p6/${string}`;
  initial: P6State;
  interactions: readonly PropInteraction[];
  /** Time-driven transitions (sim seconds). */
  timers?: readonly { from: P6State; to: P6State; afterS: number }[];
  /** Short cue label drawn above the prop. */
  cue: string;
  /** Scoring uses per instance per lap. */
  maxScoringUses: number;
};

export type PropPlacement = { kind: P6PropKind; zone: ZoneId; at: number };

/** Hard bounds. Every number is enforced in pure code and pinned by a test. */
export const ANTI_FARM = {
  /**
   * Per-lap ceiling for ALL P6 prop points (base, before pointsFor) as a fraction of the lap's
   * authored encounter maximum (sum of STREETS scorePerfect). Excess pays 0.
   */
  lapBudgetFraction: 0.35,
  /** Repeat decay for the same interaction id inside one lap, across instances. */
  repeatDecay: [1, 0.5, 0.25, 0] as const,
  /** P6 props add no Quake Drive in P6.2a: a full meter opens the bonus door. */
  meterGain: 0,
  affectsGrade: false,
  affectsFlow: false,
} as const;

/** Multiplier (0..1) the glue applies to a proposed payout. */
export function payFactor(input: {
  usesThisLap: number; maxScoringUses: number; repeatIndex: number;
  lapPointsSoFar: number; lapBudget: number; proposed: number;
}): number {
  if (input.proposed <= 0) return 0;
  if (input.usesThisLap >= input.maxScoringUses) return 0;
  const decay = ANTI_FARM.repeatDecay[Math.min(Math.max(0, input.repeatIndex), ANTI_FARM.repeatDecay.length - 1)] ?? 0;
  const room = Math.max(0, input.lapBudget - input.lapPointsSoFar);
  if (room <= 0) return 0;
  return Math.min(decay, room / input.proposed);
}

const GRADE_RANK: Record<Timing, number> = { MISS: 0, OK: 1, GREAT: 2, PERFECT: 3 };

/** True when `timing` reaches `min`. */
export function meets(timing: Timing, min: Grade): boolean {
  return GRADE_RANK[timing] >= GRADE_RANK[min];
}

/** Problems with prop definitions; empty means the registry is usable. */
export function auditPropDefs(defs: readonly PropDef[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const def of defs) {
    if (!def.art.startsWith("p6/")) problems.push(`${def.kind}: art key must start with p6/`);
    if (def.maxScoringUses < 1) problems.push(`${def.kind}: needs at least one scoring use`);
    if (!def.interactions.length) problems.push(`${def.kind}: no interactions (decorative props are not allowed)`);
    const claimed = new Set<string>();
    for (const it of def.interactions) {
      if (ids.has(it.id)) problems.push(`duplicate interaction id ${it.id}`);
      ids.add(it.id);
      const g = it.gesture as { kind: string };
      if (g.kind !== "tap" && g.kind !== "timed") problems.push(`${it.id}: gesture ${g.kind} is not supported yet`);
      if (it.base < 0) problems.push(`${it.id}: negative points`);
      if (it.fail && it.gesture.kind !== "timed") problems.push(`${it.id}: only timed gestures can fail`);
      for (const from of it.from) {
        const slot = `${from}:${it.gesture.btn}`;
        if (claimed.has(slot)) problems.push(`${def.kind}: two interactions on ${it.gesture.btn} from ${from}`);
        claimed.add(slot);
      }
    }
  }
  return problems;
}
