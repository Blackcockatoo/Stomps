/**
 * Pure street-cue maths (P4 readability): when a cue shows, how far its
 * approach ring has closed, and the short action label under the pips.
 * The renderer draws from these; the tests pin them.
 */
import type { Btn } from "./arcade-types";
import { keysLabel } from "./keys";
import type { WindowPx } from "./route";

/** Extra lead (px) before the telegraph where a dim cue + wide ring appear. */
export const CUE_PREVIEW_PX = 160;
/** Ring radius beyond the pip frame when the ring first appears. */
export const RING_SPAN = 24;

export type CuePhase = "hidden" | "preview" | "telegraph" | "hot";

export type CueState = {
  phase: CuePhase;
  /** 1 = ring just appeared, 0 = ring sits on the pip frame (PERFECT). */
  ring: number;
  /** Inside the PERFECT window right now. */
  perfect: boolean;
};

/** dist = how far the cue still is ahead of Moss (px; negative once passed). */
export function cueState(dist: number, win: WindowPx): CueState {
  const approach = win.telegraph + CUE_PREVIEW_PX;
  if (dist > approach || dist < -win.good) return { phase: "hidden", ring: 0, perfect: false };
  const ring = Math.max(0, Math.min(1, dist / approach));
  const perfect = Math.abs(dist) <= win.perfect;
  const phase: CuePhase = Math.abs(dist) <= win.good ? "hot" : dist <= win.telegraph ? "telegraph" : "preview";
  return { phase, ring, perfect };
}

const SINGLE: Record<Btn, string> = { A: "STRIDE", B: "STOMP", C: "STYLE" };

/** Short prop label: STOMP / STYLE / STRIDE for singles, bound keys (e.g. "A+D") for chords. */
export function cueLabel(trigger: readonly Btn[], label: (btns: readonly Btn[]) => string = (b) => keysLabel(b, "+")): string {
  if (trigger.length === 1) return SINGLE[trigger[0]] ?? label(trigger);
  return label(trigger);
}

/** A pip glyph: the bound key, trimmed to fit (Space → SPC, ArrowLeft → ←). */
export function pipGlyph(key: string): string {
  const k = key.trim();
  if (k.length <= 2) return k.toUpperCase();
  const map: Record<string, string> = { SPACE: "SPC", LEFT: "←", RIGHT: "→", UP: "↑", DOWN: "↓", ENTER: "ENT", SHIFT: "SHF" };
  const up = k.toUpperCase().replace(/^ARROW/, "");
  return map[up] ?? up.slice(0, 3);
}
