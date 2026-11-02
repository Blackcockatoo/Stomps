import type { Btn } from "./arcade-types";
import { DEFAULT_KEYS, type KeyMap } from "./storage";

/**
 * Internal buttons are A/B/C. The physical keys are remappable (default A/S/D)
 * and every label a player sees goes through these helpers, so on-screen text
 * always matches the current bindings.
 */
let current: KeyMap = { ...DEFAULT_KEYS };

export function setKeyMap(map: KeyMap) {
  current = { ...map };
}

export function getKeyMap(): KeyMap {
  return { ...current };
}

/** Short label for a KeyboardEvent.code. */
export function codeLabel(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return "NUM" + code.slice(6);
  const named: Record<string, string> = {
    Space: "SPACE", ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓",
    ShiftLeft: "LSHIFT", ShiftRight: "RSHIFT", ControlLeft: "LCTRL", ControlRight: "RCTRL",
    AltLeft: "LALT", AltRight: "RALT", Enter: "ENTER", Semicolon: ";", Quote: "'", Comma: ",",
    Period: ".", Slash: "/", BracketLeft: "[", BracketRight: "]", Backslash: "\\", Minus: "-", Equal: "=",
  };
  return named[code] ?? code.toUpperCase().slice(0, 8);
}

export function keyLabel(btn: Btn): string {
  return codeLabel(current[btn]);
}

export function keysLabel(btns: readonly Btn[], sep = "+"): string {
  return btns.map(keyLabel).join(sep);
}

export function keyBtn(code: string, map: KeyMap = current): Btn | null {
  if (code === map.A) return "A";
  if (code === map.B) return "B";
  if (code === map.C) return "C";
  return null;
}

/** Codes that can never be bound: they drive pause, focus and browser chrome. */
export const RESERVED_CODES = new Set(["Escape", "Tab", "F5", "F11", "F12", "MetaLeft", "MetaRight"]);

/** Binds `btn` to `code`; if another action already uses it, the two swap. */
export function rebind(map: KeyMap, btn: Btn, code: string): KeyMap {
  if (RESERVED_CODES.has(code)) return map;
  const next = { ...map };
  const clash = (Object.keys(next) as Btn[]).find((other) => other !== btn && next[other] === code);
  if (clash) next[clash] = map[btn];
  next[btn] = code;
  return next;
}
