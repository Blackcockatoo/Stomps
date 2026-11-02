/**
 * Street School (P4): a first-run guided lesson, about a minute long.
 * Pure state + text so it can be unit-tested; arcade glue lives in engine/school.ts.
 * Every key name goes through the supplied label function so remapped keys read correctly.
 */
import type { Btn } from "./arcade-types";
import type { StreetId } from "./route";

export type SchoolStepId = "stride" | "stomp" | "style" | "chord" | "recover" | "quake";

export type SchoolStep = {
  id: SchoolStepId;
  title: string;
  /** Hits (or held seconds for stride) needed to clear the step. */
  goal: number;
  /** Street prop the step spawns, or null for steps without a target. */
  cue: StreetId | null;
  trigger: Btn[];
};

export const SCHOOL_STEPS: readonly SchoolStep[] = [
  { id: "stride", title: "STRIDE", goal: 1.2, cue: null, trigger: ["A"] },
  { id: "stomp", title: "STOMP ON THE SIGNAL", goal: 2, cue: "crossing_signal", trigger: ["B"] },
  { id: "style", title: "ADD STYLE", goal: 2, cue: "vape_cloud", trigger: ["C"] },
  { id: "chord", title: "CHORD", goal: 1, cue: "skateboard", trigger: ["A", "C"] },
  { id: "recover", title: "MISS, THEN RECOVER", goal: 1, cue: "puddle", trigger: ["A"] },
  { id: "quake", title: "MOSSQUAKE", goal: 1, cue: null, trigger: ["A", "B", "C"] },
];

export type SchoolState = {
  index: number;
  /** Progress within the step: hits, or seconds of A held for stride. */
  count: number;
  /** Recover step: the intentional miss has happened and recovery is open. */
  missed: boolean;
  /** Last thing that went wrong, for the instruction line. */
  slip: "none" | "missed" | "pressed" | "late";
  finished: boolean;
  skipped: boolean;
  /** Bumps every time the step changes so the glue can spawn fresh cues. */
  serial: number;
};

export type SchoolEvent =
  | { type: "hold"; dt: number }
  | { type: "hit"; id: StreetId }
  | { type: "miss"; id: StreetId }
  | { type: "recover" }
  | { type: "expire" }
  | { type: "quake" }
  | { type: "skip" };

export function newSchool(): SchoolState {
  return { index: 0, count: 0, missed: false, slip: "none", finished: false, skipped: false, serial: 0 };
}

export function schoolCurrent(state: SchoolState): SchoolStep | null {
  return state.finished ? null : SCHOOL_STEPS[state.index] ?? null;
}

function advance(state: SchoolState): SchoolState {
  const index = state.index + 1;
  return { ...state, index, count: 0, missed: false, slip: "none", serial: state.serial + 1,
    finished: index >= SCHOOL_STEPS.length };
}

/** Reducer. Never mutates; unknown or off-step events return the same state. */
export function schoolStep(state: SchoolState, event: SchoolEvent): SchoolState {
  if (state.finished) return state;
  if (event.type === "skip") return { ...state, finished: true, skipped: true, serial: state.serial + 1 };
  const step = SCHOOL_STEPS[state.index]!;
  switch (step.id) {
    case "stride":
      if (event.type !== "hold") return state;
      return state.count + event.dt >= step.goal ? advance(state) : { ...state, count: state.count + event.dt };
    case "stomp":
    case "style":
    case "chord":
      if (event.type === "hit" && event.id === step.cue) {
        const count = state.count + 1;
        return count >= step.goal ? advance(state) : { ...state, count, slip: "none" };
      }
      if (event.type === "miss" && event.id === step.cue) return { ...state, slip: "missed" };
      return state;
    case "recover":
      // The lesson is the miss: hitting the puddle means "let it pass this time".
      if (event.type === "hit" && event.id === step.cue && !state.missed) return { ...state, slip: "pressed" };
      if (event.type === "miss" && event.id === step.cue) return { ...state, missed: true, slip: "none" };
      if (event.type === "recover" && state.missed) return advance(state);
      if (event.type === "expire" && state.missed) return { ...state, missed: false, slip: "late" };
      return state;
    case "quake":
      return event.type === "quake" ? advance(state) : state;
  }
}

/** Fraction of the current step done, 0..1. */
export function schoolProgress(state: SchoolState): number {
  const step = schoolCurrent(state);
  if (!step) return 1;
  if (step.id === "recover") return state.missed ? 0.5 : 0;
  return Math.min(1, state.count / step.goal);
}

export type Label = (btn: Btn) => string;

export function schoolText(state: SchoolState, label: Label): { title: string; line: string } {
  const step = schoolCurrent(state);
  if (!step) {
    return state.skipped
      ? { title: "SCHOOL SKIPPED", line: "Replay Street School from the cabinet menu any time." }
      : { title: "SCHOOL'S OUT", line: "That's the whole kit. Now take the long way home." };
  }
  const [a, b, c] = [label("A"), label("B"), label("C")];
  const again = state.slip === "missed" ? "Missed it, no stress. Another one is coming. " : "";
  switch (step.id) {
    case "stride":
      return { title: step.title, line: `Hold ${a} to stride. Moss speeds up while it's held.` };
    case "stomp":
      return { title: step.title, line: `${again}A crossing signal is coming. Tap ${b} to stomp when its ring closes on the button.` };
    case "style":
      return { title: step.title, line: `${again}Smoke ahead. Tap ${c} for style when the ring closes.` };
    case "chord":
      return { title: step.title, line: `${again}Skateboard! Press ${a} and ${c} together, as one chord.` };
    case "recover":
      if (state.missed) return { title: "STUMBLED. NOW RECOVER", line: `A miss trips Moss, halves FLOW and drains 10% Quake. Tap any key on the beat, when the ring under Moss pulses, to win the flow back.` };
      if (state.slip === "pressed") return { title: step.title, line: "You hit that one. This time let the puddle pass: press nothing." };
      if (state.slip === "late") return { title: step.title, line: "The recovery window closed. Let the next puddle pass, then tap on the beat straight away." };
      return { title: step.title, line: "Let this puddle pass. Don't press anything. Then you'll learn how to recover." };
    case "quake":
      return { title: step.title, line: `Hits fill the Quake Drive. It's full now: press ${a}+${b}+${c} together, or tap the meter.` };
  }
}

/** One-line screen-reader announcement for the current step. */
export function schoolAnnouncement(state: SchoolState, label: Label): string {
  const text = schoolText(state, label);
  const step = schoolCurrent(state);
  const prefix = step ? `Street School, step ${state.index + 1} of ${SCHOOL_STEPS.length}: ` : "";
  return `${prefix}${text.title.toLowerCase()}. ${text.line}`;
}

export type SchoolSnapshot = {
  step: number;
  total: number;
  id: SchoolStepId | "done";
  title: string;
  line: string;
  progress: number;
  finished: boolean;
  skipped: boolean;
};

export function schoolSnapshot(state: SchoolState, label: Label): SchoolSnapshot {
  const text = schoolText(state, label);
  return { step: Math.min(state.index + 1, SCHOOL_STEPS.length), total: SCHOOL_STEPS.length,
    id: schoolCurrent(state)?.id ?? "done", title: text.title, line: text.line,
    progress: schoolProgress(state), finished: state.finished, skipped: state.skipped };
}
