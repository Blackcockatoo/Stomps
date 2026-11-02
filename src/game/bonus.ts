/**
 * Bonus-world door on THE LONG WAY HOME / Street Strut.
 *
 * A door stands near the end of the pier, just before home. It is open when the
 * Quake Drive is full or Moss has landed DOOR_HITS street events this lap. If it
 * is open as he passes, he steps through into a short, denser neon segment where
 * every street event pays BONUS_MULT×. When the last bonus event has passed he
 * is put back on the pier just past the door and the route carries on.
 * Practice runs never show the door. Pure helpers are exported for the tests.
 */
import type { Arcade } from "./arcade";
import { ROUTE_PX, STREETS, ZONES, type StreetId, type StreetSpec } from "./route";

export const DOOR_AT = 0.93;
export const DOOR_HITS = 8;
export const BONUS_MULT = 2;
export const GOLDEN_MULT = 3;
export const PIER_CROWN_HITS = 6;
/** All six pier encounters must be judged PERFECT; a missed one cancels the crown. */
export function pierCrown(perfect: number, missed: number): boolean {
  return perfect >= PIER_CROWN_HITS && missed === 0;
}
/** Gap between bonus events; the route audit needs > ~165px at a 150px/s sprint. */
export const BONUS_GAP = 190;
/** Distance from the door to the first bonus event. */
export const BONUS_LEAD = 300;
/** How far ahead of Moss the door is announced. */
export const DOOR_HINT_PX = 320;

const BONUS_SET: StreetId[] = [
  "crossing_signal",
  "streetlight",
  "puddle",
  "newspaper",
  "skateboard",
  "trolley",
  "vape_cloud",
  "bin",
];

export type BonusRun = {
  serial: number;
  /** Scroll to restore when the segment ends (just past the door). */
  returnScroll: number;
  /** World x of the first bonus event. */
  start: number;
  specs: StreetSpec[];
  /** Standard 2x or skill-earned Golden 3x; optional for old test fixtures. */
  multiplier?: number;
};

export type BonusView = {
  spec: StreetSpec;
  world: number;
  dist: number;
  key: string;
};

export function doorOpen(meter: number, lapHits: number) {
  return meter >= 1 || lapHits >= DOOR_HITS;
}

/** World x of the door on a given lap. */
export function doorWorld(lap: number) {
  const pier = ZONES.find((zone) => zone.id === "pier")!;
  return pier.start + pier.px * DOOR_AT + lap * ROUTE_PX;
}

/** The bonus segment's events, copied from the route's own non-body events. */
export function bonusSpecs(): StreetSpec[] {
  return BONUS_SET.map((id, i) => {
    const template = STREETS.find((spec) => spec.id === id && !spec.body) ?? STREETS.find((spec) => !spec.body)!;
    return { ...template, uid: `bonus-${i}` };
  });
}

export function bonusLength(run: Pick<BonusRun, "specs">) {
  return BONUS_LEAD + (run.specs.length - 1) * BONUS_GAP + 200;
}

export function bonusWorldX(run: BonusRun, index: number) {
  return run.start + index * BONUS_GAP;
}

/** Called each strut tick on route laps (not practice, not inside the bonus). */
export function tickDoor(g: Arcade) {
  if (g.bonus || g.runKind === "practice") return;
  const moss = g.mossWorld();
  const lap = Math.floor(moss / ROUTE_PX);
  const door = doorWorld(lap);
  const dist = door - moss;
  if (g.doorDone.has(lap)) return;
  const open = doorOpen(g.meter, g.lapHits) || pierCrown(g.pierPerfect, g.pierMiss);
  if (dist <= DOOR_HINT_PX && dist > 0 && !g.doorHinted.has(lap)) {
    g.doorHinted.add(lap);
    g.callout = open ? "BONUS DOOR OPEN" : "DOOR SHUT";
    g.calloutLife = 1.4;
    g.announce(open ? "Bonus door ahead is open. Keep strutting to go through." : `Bonus door ahead is shut. Fill Quake Drive or land ${DOOR_HITS} hits this lap.`);
  }
  if (dist <= 0) {
    g.doorDone.add(lap);
    if (open) enterBonus(g, lap);
  }
}

export function enterBonus(g: Arcade, lap: number) {
  const serial = ++g.bonusSerial;
  const moss = g.mossWorld();
  const multiplier = pierCrown(g.pierPerfect, g.pierMiss) ? GOLDEN_MULT : BONUS_MULT;
  g.bonus = {
    serial,
    returnScroll: doorWorld(lap) - g.mossX() + 24,
    start: moss + BONUS_LEAD,
    specs: bonusSpecs(),
    multiplier,
  };
  g.callout = multiplier === GOLDEN_MULT ? "GOLDEN BONUS ×3" : `BONUS WORLD ×${BONUS_MULT}`;
  g.calloutLife = 1.6;
  g.announce(`Through the door. ${multiplier === GOLDEN_MULT ? "Golden " : ""}Bonus world: every hit scores times ${multiplier}.`);
  g.groove.combo();
  g.flash = Math.max(g.flash, 0.6);
}

export function bonusViews(g: Arcade): BonusView[] {
  const run = g.bonus;
  if (!run) return [];
  const moss = g.mossWorld();
  return run.specs.map((spec, i) => {
    const world = bonusWorldX(run, i);
    return { spec, world, dist: world - moss, key: `${spec.uid}:${run.serial}` };
  });
}

/** Ends the segment once its last event is well behind Moss. Returns true on exit. */
export function tickBonus(g: Arcade) {
  const run = g.bonus;
  if (!run) return false;
  if (g.mossWorld() < run.start - BONUS_LEAD + bonusLength(run)) return false;
  exitBonus(g);
  return true;
}

export function exitBonus(g: Arcade) {
  const run = g.bonus;
  if (!run) return;
  g.bonus = null;
  g.bonusCleared += 1;
  if (run.multiplier === GOLDEN_MULT) g.goldenCleared += 1;
  g.scroll = run.returnScroll;
  g.callout = "BACK ON THE PIER";
  g.calloutLife = 1.3;
  g.announce("Bonus world cleared. Back on the pier.");
}
