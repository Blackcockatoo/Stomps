/**
 * Basic gamepad support via the standard mapping, polled once per animation
 * frame (the Gamepad API has no button events).
 *   bottom face (0)  → A / STRIDE      right face (1) → S / STOMP
 *   left face   (2)  → D / STYLE       top face   (3) → MOSSQUAKE
 *   Start       (9)  → pause / resume
 *   D-pad   (12–15)  → up / down / left / right (menu focus only)
 * Several pads are merged: an action is held while any pad holds it.
 */
import type { Btn } from "../arcade-types";

export type NavAction = "up" | "down" | "left" | "right";
export type PadAction = Btn | "quake" | "pause" | NavAction;
export const PAD_MAP: Readonly<Record<number, PadAction>> = {
  0: "A",
  1: "B",
  2: "C",
  3: "quake",
  9: "pause",
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};
const NAV = new Set<PadAction>(["up", "down", "left", "right"]);
export const isNav = (action: PadAction): action is NavAction => NAV.has(action);

type PadLike = { connected?: boolean; buttons: readonly { pressed: boolean }[] } | null;

export class GamepadInput {
  private held = new Set<PadAction>();

  /** Reads the pads and calls `edge` for each action that changed state. */
  poll(edge: (action: PadAction, down: boolean) => void, pads: readonly PadLike[] | null = readPads()) {
    if (!pads) return;
    const now = new Set<PadAction>();
    for (const pad of pads) {
      if (!pad || pad.connected === false) continue;
      for (const [index, action] of Object.entries(PAD_MAP)) {
        if (pad.buttons[Number(index)]?.pressed) now.add(action);
      }
    }
    for (const action of this.held) if (!now.has(action)) edge(action, false);
    for (const action of now) if (!this.held.has(action)) edge(action, true);
    this.held = now;
  }

  reset() {
    this.held.clear();
  }
}

function readPads(): readonly PadLike[] | null {
  try {
    if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return null;
    return navigator.getGamepads() as readonly PadLike[];
  } catch {
    return null;
  }
}
