/** Street School glue: spawns lesson cues, feeds the pure reducer in ../tutorial and reports to React. */
import type { Arcade } from "../arcade";
import { keyLabel } from "../keys";
import { STREETS, type StreetSpec } from "../route";
import { updateSave } from "../storage";
import { newSchool, schoolAnnouncement, schoolCurrent, schoolSnapshot, schoolStep, type SchoolEvent, type SchoolState } from "../tutorial";
import type { RunKind } from "./types";

export type SchoolCue = { spec: StreetSpec; world: number; key: string };
export type SchoolThen = Exclude<RunKind, "school"> | "menu";

export type SchoolRun = {
  state: SchoolState;
  cues: SchoolCue[];
  spawnAt: number;
  seen: number;
  sent: string;
  doneAt: number | null;
  then: SchoolThen;
  cueSerial: number;
};

/** Cues spawn this far ahead of Moss, so the approach ring has time to read. */
export const SCHOOL_LEAD_PX = 330;

export function newSchoolRun(then: SchoolThen): SchoolRun {
  return { state: newSchool(), cues: [], spawnAt: 0, seen: -1, sent: "", doneAt: null, then, cueSerial: 0 };
}

function template(id: StreetSpec["id"]): StreetSpec {
  const base = STREETS.find((spec) => spec.id === id) ?? STREETS[0]!;
  return { ...base, zone: "caravan" };
}

export function schoolViews(g: Arcade) {
  const run = g.school;
  if (!run) return [];
  const moss = g.mossWorld();
  return run.cues.map((cue) => ({ spec: cue.spec, world: cue.world, dist: cue.world - moss, key: cue.key }));
}

export function schoolEvent(g: Arcade, event: SchoolEvent) {
  const run = g.school;
  if (!run || g.runKind !== "school") return;
  run.state = schoolStep(run.state, event);
}

export function tickSchool(g: Arcade, dt: number) {
  const run = g.school;
  if (!run) return;
  const step = schoolCurrent(run.state);
  if (step?.id === "stride" && g.keys.has("A")) schoolEvent(g, { type: "hold", dt });
  if (run.seen !== run.state.serial) {
    run.seen = run.state.serial;
    run.spawnAt = g.now + 0.9;
    const next = schoolCurrent(run.state);
    // The recovery lesson needs some flow to win back, whatever happened earlier.
    if (next?.id === "recover" && g.flowState.chain < 6) g.flowState = { ...g.flowState, chain: 6, level: 3 };
    if (!run.state.finished) {
      g.callout = next ? `STEP ${run.state.index + 1}: ${next.title}` : "";
      g.calloutLife = 1.2;
      if (run.state.serial > 0) g.groove.combo();
    }
    g.announce(schoolAnnouncement(run.state, keyLabel));
  }
  const now = schoolCurrent(run.state);
  if (now?.id === "quake" && g.meter < 1) g.meter = Math.min(1, g.meter + dt * 0.9);
  if (now?.id === "recover" && run.state.missed && g.flowState.recoveryUntil <= g.now && g.flowState.recoverTo > 0) {
    schoolEvent(g, { type: "expire" });
    run.spawnAt = g.now + 0.6;
  }
  const pendingRecovery = now?.id === "recover" && run.state.missed;
  if (now?.cue && !pendingRecovery) {
    const live = run.cues.some((cue) => !g.streetMarks.has(cue.key));
    if (!live && run.spawnAt === Infinity) run.spawnAt = g.now + 0.7;
    if (!live && g.now >= run.spawnAt) {
      run.cueSerial += 1;
      run.cues.push({ spec: { ...template(now.cue), uid: `school-${run.cueSerial}` }, world: g.mossWorld() + SCHOOL_LEAD_PX, key: `school-${run.cueSerial}` });
      run.spawnAt = Infinity;
    }
  }
  // Drop cues that are well behind Moss.
  const moss = g.mossWorld();
  run.cues = run.cues.filter((cue) => cue.world - moss > -500);
  const snap = schoolSnapshot(run.state, keyLabel);
  const sig = JSON.stringify(snap);
  if (sig !== run.sent) {
    run.sent = sig;
    g.hooks.onSchool?.(snap);
  }
  if (run.state.finished) {
    if (run.doneAt === null) {
      run.doneAt = g.now;
      g.save = updateSave((save) => { save.tutorialDone = true; });
      if (!run.state.skipped) {
        g.callout = "SCHOOL'S OUT";
        g.calloutLife = 2;
        g.groove.perfect();
        g.burst("sparks", g.mossX(), 150);
      }
    }
    if (run.state.skipped || g.now - run.doneAt > 2.4) finishSchool(g);
  }
}

export function finishSchool(g: Arcade) {
  const run = g.school;
  if (!run) return;
  g.school = null;
  g.hooks.onSchoolDone?.(run.then, run.state.skipped);
  if (run.then === "menu") g.menu();
  else g.playStrut(run.then);
}
