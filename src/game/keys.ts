import type { Btn } from "./arcade-types";

/**
 * Internal buttons are A/B/C; the physical keyboard keys (and every label a
 * player sees) are A/S/D. Always go through these helpers for on-screen text.
 */
export const KEY_LABEL: Record<Btn, string> = { A: "A", B: "S", C: "D" };

export function keyLabel(btn: Btn): string {
  return KEY_LABEL[btn];
}

export function keysLabel(btns: readonly Btn[], sep = "+"): string {
  return btns.map(keyLabel).join(sep);
}

export function keyBtn(code: string): Btn | null {
  if (code === "KeyA") return "A";
  if (code === "KeyS") return "B";
  if (code === "KeyD") return "C";
  return null;
}
