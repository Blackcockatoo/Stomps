/** Rhythm mode: chart judging, holds, chords, results, plus tap-along calibration math. */
import type { Arcade } from "../arcade";
import type { Btn } from "../arcade-types";
import type { Lane } from "../chart";
import { pointsFor } from "../feel";
import { GROUND, type Judge, type LiveNote, type Step } from "./types";

export function tickRhythm(g: Arcade, dt: number) {
  g.scroll += dt * 48;
  const t = g.songTime();
  for (const note of g.chart) {
    if (note.hit || note.missed) continue;
    if (t > note.time + 0.17) {
      note.missed = true;
      g.failRhythm("STUMBLED");
    }
  }
  for (const note of g.chart) {
    if (!note.holding || note.failed) continue;
    if (t > note.time + note.dur + 0.06) {
      note.holding = false;
      if (g.keys.has(laneBtn(note.lane))) g.scoreRhythm("FRESH", 140);
      else g.failRhythm("STUMBLED");
    }
  }
  if (t >= g.songDur) g.finishRhythm();
}

export function rhythmDown(g: Arcade, btn: Btn) {
  if (g.meter >= 1 && g.keys.has("A") && g.keys.has("B") && g.keys.has("C")) {
    g.doQuake(true);
    return;
  }
  const t = g.songTime();
  const lane = btnLane(btn);
  let best: LiveNote | null = null;
  let bestDist = 99;
  for (const note of g.chart) {
    if (note.lane !== lane || note.hit || note.missed) continue;
    const dist = Math.abs(note.time - t);
    if (dist < bestDist) {
      best = note;
      bestDist = dist;
    }
  }
  if (!best || bestDist > 0.17) {
    g.failRhythm("STUMBLED");
    return;
  }
  best.hit = true;
  const judge = judgeDist(bestDist);
  g.scoreRhythm(judge, judge === "PERFECT" ? 300 : judge === "FRESH" ? 180 : 80);
  if (best.dur > 0) best.holding = true;
  const mates = g.chart.filter(
    (note) =>
      note !== best &&
      !note.hit &&
      !note.missed &&
      Math.abs(note.time - best.time) < 0.05 &&
      g.keys.has(laneBtn(note.lane)),
  );
  mates.forEach((note) => {
    note.hit = true;
    if (note.dur > 0) note.holding = true;
  });
  const chord = mates.length > 0;
  g.play(hitSteps(btn, best.dur > 0, chord));
  if (btn === "B" || best.dur > 0 || chord) g.burst("dust", g.mossX() + 8, GROUND);
  if (btn === "C" || chord) g.burst("sparks", g.mossX() + 18, GROUND - 64);
}

export function rhythmUp(g: Arcade, btn: Btn) {
  const t = g.songTime();
  const lane = btnLane(btn);
  for (const note of g.chart) {
    if (note.lane !== lane || !note.holding) continue;
    note.holding = false;
    if (t < note.time + note.dur - 0.08) g.failRhythm("STUMBLED");
    else g.scoreRhythm("FRESH", 120);
  }
  if (!g.chart.some((note) => note.holding)) {
    const step = g.queue[g.stepIndex];
    if (step?.hold) g.play([{ clip: "strut", speed: 1, once: false, flip: false }]);
  }
}

export function finishRhythm(g: Arcade) {
  g.mode = "result";
  g.groove.stop();
  if (g.score > g.bestRhythm) {
    g.bestRhythm = g.score;
    g.recordRhythmBest();
  }
  g.hooks.onResult({
    kind: "rhythm",
    score: g.score,
    perfect: g.counts.perfect,
    fresh: g.counts.fresh,
    late: g.counts.late,
    stumble: g.counts.stumble,
    maxCombo: g.maxCombo,
  });
  g.hooks.onMode("result");
}

export function scoreRhythm(g: Arcade, judge: Exclude<Judge, "OFF" | "STUMBLED"> | "FRESH", points: number) {
  if (judge === "PERFECT") g.counts.perfect += 1;
  else if (judge === "LATE") g.counts.late += 1;
  else g.counts.fresh += 1;
  g.rhythmCombo += 1;
  g.maxCombo = Math.max(g.maxCombo, g.rhythmCombo);
  const mult = 1 + Math.min(2, g.rhythmCombo * 0.05);
  const gained = pointsFor(points * mult);
  g.score += gained;
  g.meter = Math.min(1, g.meter + (judge === "PERFECT" ? 0.05 : 0.03));
  g.judgeText = judge;
  g.announce(judge === "PERFECT" ? "Perfect" : judge === "FRESH" ? "Fresh" : "Late");
  g.judgeLife = 0.45;
  g.popups.push({ text: `+${gained}`, life: 0.85, x: 190, y: 92, gold: judge === "PERFECT" });
  if (judge === "PERFECT") g.groove.perfect();
  g.streak = g.rhythmCombo;
}

export function failRhythm(g: Arcade, label: "STUMBLED") {
  g.counts.stumble += 1;
  g.rhythmCombo = 0;
  g.judgeText = label;
  g.announce("Stumbled");
  g.judgeLife = 0.45;
  if (g.currentClip() !== "stumble") g.play([{ clip: "stumble", speed: 1.15, once: true, flip: false }]);
  g.groove.miss();
  g.streak = 0;
}

export function judgeDist(dist: number): "PERFECT" | "FRESH" | "LATE" {
  if (dist < 0.055) return "PERFECT";
  if (dist < 0.1) return "FRESH";
  return "LATE";
}

export function btnLane(btn: Btn): Lane {
  if (btn === "A") return 0;
  if (btn === "B") return 1;
  return 2;
}

export function laneBtn(lane: Lane): Btn {
  return lane === 0 ? "A" : lane === 1 ? "B" : "C";
}

export function hitSteps(btn: Btn, hold: boolean, chord: boolean): Step[] {
  if (chord) return [{ clip: "spin", speed: 1.2, once: true, flip: false }];
  if (hold && btn === "A") return [{ clip: "strut", speed: 0.72, once: false, flip: false, hold: true }];
  if (hold && btn === "B") return [{ clip: "stomp", speed: 0.4, once: false, flip: false, hold: true, from: 3, to: 5 }];
  if (hold) return [{ clip: "style", speed: 0.35, once: false, flip: false, hold: true, from: 2, to: 5 }];
  if (btn === "A") return [{ clip: "strut", speed: 1.55, once: true, flip: false, from: 0, to: 6 }];
  if (btn === "B") return [{ clip: "stomp", speed: 1.1, once: true, flip: false }];
  return [{ clip: "style", speed: 1.05, once: true, flip: false }];
}

export type Calibration = { offset: number; spread: number; used: number; reliable: boolean };
/** Taps discarded at the start while the player locks on to the click. */
export const CALIBRATION_WARMUP = 2;
export const CALIBRATION_MIN_TAPS = 6;

/**
 * Tap-along calibration. `taps` are groove times (seconds since beat 0) of
 * presses made on the metronome click. Each tap's signed distance to its
 * nearest beat is taken, the median is used (robust to a stray double-tap),
 * and the offset that cancels it is returned, clamped to ±limit.
 * Positive audioOffset draws notes sooner, so a player who taps late (audio
 * reaches them late) needs a negative offset.
 */
export function calibrateOffset(taps: readonly number[], beatDur: number, limit = 0.12): Calibration | null {
  const used = taps.slice(CALIBRATION_WARMUP).filter((t) => Number.isFinite(t) && t > 0);
  if (used.length < CALIBRATION_MIN_TAPS || !(beatDur > 0)) return null;
  const devs = used.map((t) => {
    const phase = ((t % beatDur) + beatDur) % beatDur;
    return phase > beatDur / 2 ? phase - beatDur : phase;
  });
  const median = medianOf(devs);
  const spread = medianOf(devs.map((d) => Math.abs(d - median)));
  const offset = Math.max(-limit, Math.min(limit, Math.round(-median * 1000) / 1000));
  return { offset: Object.is(offset, -0) ? 0 : offset, spread, used: used.length, reliable: spread <= 0.06 };
}

function medianOf(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}
