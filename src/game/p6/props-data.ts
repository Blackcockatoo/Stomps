/**
 * P6 prop registry (P6.2a): definitions and placements. Data only.
 * One prop so far, the traffic cone in THE VAN; more P6.2 props add entries here.
 */
import { STREETS } from "../route";
import { ANTI_FARM, type P6PropKind, type PropDef, type PropPlacement } from "./contracts";

export const CONE: PropDef = {
  kind: "cone",
  label: "TRAFFIC CONE",
  art: "p6/cone",
  initial: "idle",
  cue: "STEP·LAUNCH·SPIN",
  maxScoringUses: 1,
  interactions: [
    { id: "cone.step", verb: "STEP OVER", gesture: { kind: "tap", btn: "A" }, from: ["idle"], to: "spent", base: 15, emits: ["cone:stepped"], sound: "style" },
    {
      id: "cone.launch", verb: "CONE LAUNCH!", gesture: { kind: "timed", btn: "B", minGrade: "OK", beat: "any" }, from: ["idle"], to: "airborne", base: 70,
      emits: ["cone:launched"], fail: { to: "toppled", label: "KNOCKED IT OVER (STOMP ON THE BEAT)" }, sound: "stomp",
    },
    {
      id: "cone.spin", verb: "CONE SPIN!", gesture: { kind: "timed", btn: "C", minGrade: "GREAT", beat: "any" }, from: ["idle"], to: "spent", base: 80,
      emits: ["cone:spun"], fail: { to: "toppled", label: "WOBBLED OVER (STYLE ON THE BEAT)" }, sound: "style",
    },
  ],
  timers: [{ from: "airborne", to: "spent", afterS: 0.9 }],
};

export const P6_PROPS: Record<P6PropKind, PropDef> = { cone: CONE };

/** Layout. Every placement keeps clear of encounters and the door (auditStompables covers these too). */
export const P6_PLACEMENTS: readonly PropPlacement[] = [
  { kind: "cone", zone: "caravan", at: 0.7 },
];

/** Base points all P6 props together may pay per lap. */
export const P6_LAP_BUDGET = Math.round(ANTI_FARM.lapBudgetFraction * STREETS.reduce((sum, s) => sum + s.scorePerfect, 0));

export function isP6Kind(kind: string): kind is P6PropKind {
  return Object.prototype.hasOwnProperty.call(P6_PROPS, kind);
}
