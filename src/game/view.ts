/**
 * Which slice of the 480×270 playfield is actually on screen. Portrait phones
 * show the street with `object-fit: cover`, which crops the sides, so the
 * canvas HUD (callouts, cue label, route progress) is laid out inside this span
 * instead of the full width.
 */
import { H, W } from "./engine/types";

export type ViewSpan = { left: number; right: number };

export const FULL_VIEW: ViewSpan = { left: 0, right: W };

/** `posX` is the object-position x as a 0..1 fraction (CSS default 0.5). */
export function visibleSpan(boxW: number, boxH: number, fit: string, posX = 0.5): ViewSpan {
  if (fit !== "cover" || boxW <= 0 || boxH <= 0) return FULL_VIEW;
  const scale = Math.max(boxW / W, boxH / H);
  const shown = Math.min(W, boxW / scale);
  const left = (W - shown) * Math.max(0, Math.min(1, posX));
  return { left: Math.round(left), right: Math.round(left + shown) };
}

/** Parses the x part of a computed `object-position` ("24% 50%", "left center", "12px 0"). */
export function positionX(value: string, overflowPx: number): number {
  const first = value.trim().split(/\s+/)[0] ?? "50%";
  if (first === "left") return 0;
  if (first === "right") return 1;
  if (first === "center") return 0.5;
  if (first.endsWith("%")) return Number.parseFloat(first) / 100;
  if (first.endsWith("px") && overflowPx > 0) return -Number.parseFloat(first) / overflowPx;
  return 0.5;
}
