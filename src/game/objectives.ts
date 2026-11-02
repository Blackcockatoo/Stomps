/**
 * Objective strip (P4): the lap goals as small chips — door hits / Quake,
 * pier Golden ★ and signature techniques. Pure so the HUD and tests agree.
 */
import { DOOR_HITS, PIER_CROWN_HITS, doorOpen, pierCrown } from "./bonus";

export const TECHNIQUES_TOTAL = 5;

export type ObjectiveInput = {
  runKind: string;
  bonus: boolean;
  lapHits: number;
  meter: number;
  zoneId: string;
  pierPerfect: number;
  pierMiss: number;
  techniques: number;
};

export type Chip = { id: "door" | "pier" | "tech"; text: string; short: string; done: boolean; tone: "gold" | "cyan" | "pink" };

export function objectiveChips(s: ObjectiveInput): Chip[] {
  if (s.bonus || (s.runKind !== "free" && s.runKind !== "route")) return [];
  const chips: Chip[] = [];
  const open = doorOpen(s.meter, s.lapHits);
  const hits = Math.min(DOOR_HITS, s.lapHits);
  chips.push(open
    ? { id: "door", text: "DOOR OPEN", short: "DOOR ✓", done: true, tone: "gold" }
    : { id: "door", text: `DOOR ${hits}/${DOOR_HITS} OR QUAKE`, short: `DOOR ${hits}/${DOOR_HITS}`, done: false, tone: "gold" });
  if (s.zoneId === "pier" || s.pierPerfect > 0 || s.pierMiss > 0) {
    const crown = pierCrown(s.pierPerfect, s.pierMiss);
    const lost = s.pierMiss > 0 && !crown;
    chips.push({
      id: "pier",
      text: crown ? "★ GOLDEN" : lost ? "★ PIER LOST" : `★ PIER ${Math.min(PIER_CROWN_HITS, s.pierPerfect)}/${PIER_CROWN_HITS}`,
      short: crown ? "★ ✓" : lost ? "★ ✗" : `★ ${Math.min(PIER_CROWN_HITS, s.pierPerfect)}/${PIER_CROWN_HITS}`,
      done: crown, tone: "pink",
    });
  }
  const tech = Math.min(TECHNIQUES_TOTAL, s.techniques);
  chips.push({ id: "tech", text: `TECH ${tech}/${TECHNIQUES_TOTAL}`, short: `T ${tech}/${TECHNIQUES_TOTAL}`, done: tech >= TECHNIQUES_TOTAL, tone: "cyan" });
  return chips;
}
