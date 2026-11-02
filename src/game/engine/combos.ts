/** Footwork combos for Street Strut. Keys are internal buttons (A stride, B stomp, C style). */
import type { Btn } from "../arcade-types";
import type { Step } from "./types";

export const COMBOS: { name: string; keys: Btn[]; steps: Step[]; bonus: number; meter: number }[] = [
  {
    name: "STREET CORONATION",
    keys: ["A", "B", "C", "B"],
    steps: [
      { clip: "style", speed: 1.15, once: true, flip: false, from: 0, to: 4 },
      { clip: "stomp", speed: 1.2, once: true, flip: false, from: 1, to: 6 },
      { clip: "style", speed: 1, once: true, flip: false, from: 2, to: 6 },
    ],
    bonus: 800,
    meter: 0.18,
  },
  {
    name: "HEEL-TOE HAMMER",
    keys: ["A", "A", "B"],
    steps: [
      { clip: "strut", speed: 1.85, once: true, flip: false, from: 0, to: 6 },
      { clip: "stomp", speed: 1.25, once: true, flip: false },
    ],
    bonus: 420,
    meter: 0.12,
  },
  {
    name: "ROYAL SWAGGER",
    keys: ["A", "C", "A"],
    steps: [{ clip: "style", speed: 1.05, once: true, flip: true }],
    bonus: 460,
    meter: 0.13,
  },
  {
    name: "DOUBLE TROUBLE",
    keys: ["B", "B", "C"],
    steps: [
      { clip: "stomp", speed: 1.35, once: true, flip: false },
      { clip: "stomp", speed: 1.45, once: true, flip: false },
      { clip: "style", speed: 1.1, once: true, flip: false, from: 2, to: 6 },
    ],
    bonus: 520,
    meter: 0.14,
  },
  {
    name: "FRANKSTON SHUFFLE",
    keys: ["C", "A", "B"],
    steps: [
      { clip: "slide", speed: 1.05, once: true, flip: false },
      { clip: "stomp", speed: 1.15, once: true, flip: false, from: 2, to: 6 },
    ],
    bonus: 480,
    meter: 0.13,
  },
];

export function tailMatch(seq: { btn: Btn; t: number }[], keys: Btn[]) {
  if (seq.length < keys.length) return false;
  const tail = seq.slice(-keys.length);
  for (let i = 0; i < keys.length; i++) {
    if (tail[i]?.btn !== keys[i]) return false;
    if (i > 0) {
      const gap = (tail[i]?.t ?? 0) - (tail[i - 1]?.t ?? 0);
      if (gap < 0.09 || gap > 0.85) return false;
    }
  }
  return true;
}
