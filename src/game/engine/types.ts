import type { SchoolSnapshot } from "../tutorial";
import type { PadAction } from "./gamepad";
import type { Btn } from "../arcade-types";
import type { ChartNote } from "../chart";
import type { ClipId, FX } from "../clips";

export type { Btn };
export type Mode = "menu" | "strut" | "rhythm" | "pause" | "result";
export type Judge = "PERFECT" | "FRESH" | "LATE" | "STUMBLED" | "OFF";
export type RunKind = "free" | "route" | "practice" | "school";

export type ResultStats = {
  kind?: "rhythm" | "route";
  difficulty?: "easy" | "normal" | "hard";
  /** Bonus-door segments cleared during the run. */
  bonus?: number;
  seconds?: number;
  personalBest?: number;
  newRecord?: boolean;
  score: number;
  perfect: number;
  fresh: number;
  late: number;
  stumble: number;
  maxCombo: number;
  flowPeak?: number;
  goldenBonus?: number;
  mastery?: import("../mastery").MasteryGrade;
  accuracy?: number;
  advice?: string;
  variant?: number;
  techniqueCount?: number;
  /** SK8 STOMP summary for route results. */
  sk8?: { tricks: number; landed: number; bails: number; bestChain: number; specials: number; rival: boolean | null; lines: number; linesTotal: number; challenges: number };
};

export type Step = {
  clip: ClipId;
  speed: number;
  once: boolean;
  flip: boolean;
  from?: number;
  to?: number;
  hold?: boolean;
};
export type Popup = { text: string; life: number; x: number; y: number; gold: boolean };
export type Spark = { kind: keyof typeof FX; t: number; x: number; y: number };
export type LiveNote = ChartNote & { hit: boolean; missed: boolean; holding: boolean; failed: boolean };
export type Wave = { x: number; r: number; life: number };
export type Bird = { x: number; y: number; t: number; vy: number; scare: number };
export type Grant = { points: number; meter: number; at: number };
export type StreetMark = { kind: "perfect" | "good" | "miss"; at: number; grade?: "PERFECT" | "GREAT" | "OK" };
export type Trail = { img: HTMLImageElement | HTMLCanvasElement; x: number; y: number; flip: boolean; life: number };
export type Mote = { x: number; y: number; vx: number; vy: number; life: number; max: number; gold: boolean };

export type LiveHud = { score: number; meter: number; streak: number; gain: number; serial: number; label: string; bonus?: boolean;
  flowLevel?: number; flowChain?: number; recovering?: boolean; bonusMultiplier?: number };
export type Best = { strut: number; rhythm: number };

export type Hooks = {
  onHud?: (hud: LiveHud) => void;
  onRouteBest?: (score: number) => void;
  onPractice?: (name: string) => void;
  /** Asset preload progress, 0..1 with counts. */
  onProgress?: (loaded: number, total: number) => void;
  /** Short screen-reader announcements (judgements, combos, score milestones). */
  onAnnounce?: (text: string) => void;
  /** A button changed state from a source other than the DOM (gamepad). */
  onHeld?: (btn: Btn, down: boolean) => void;
  /** A tap was recorded during tap-along calibration (keyboard, pad, touch or gamepad). */
  onCalTap?: (count: number) => void;
  /** Gamepad presses while a menu, result card or panel is up (focus + select, never gameplay). */
  onMenuPad?: (action: PadAction) => void;
  /** Street School step, instruction and progress changed (null when the lesson closes). */
  onSchool?: (snapshot: SchoolSnapshot | null) => void;
  /** Street School finished or was skipped; the engine continues into `then`. */
  onSchoolDone?: (then: Exclude<RunKind, "school"> | "menu", skipped: boolean) => void;
  onMode: (mode: Mode) => void;
  onResult: (stats: ResultStats) => void;
  onReady: () => void;
  onError: (message: string) => void;
  onBest: (best: Best) => void;
};

/** Logical playfield, in canvas pixels before device scaling. */
export const W = 480;
export const H = 270;
export const GROUND = 228;
export const MOSS_X = 132;
/** Fixed simulation step. Scoring and timing never depend on display refresh. */
export const SIM_DT = 1 / 120;
