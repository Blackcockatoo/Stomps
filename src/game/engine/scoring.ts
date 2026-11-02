/** Points, Style meter, beat timing, MOSSQUAKE and refunds. All scores pass through pointsFor (Hyper Drive scale). */
import type { Arcade } from "../arcade";
import { pointsFor } from "../feel";
import { ANIM } from "../clips";
import { GROUND, MOSS_X, type Judge } from "./types";

export function doQuake(g: Arcade, fromRhythm: boolean) {
  if (g.quakeLock > 0 && g.currentClip() === "quake") return;
  if (g.meter < 1) {
    g.callout = "NEED MORE STYLE";
    g.calloutLife = 0.7;
    g.announce("Need more style");
    return;
  }
  g.quakeLock = 1.15;
  g.quakeHit = false;
  g.meter = 0;
  g.buffered = null;
  g.bufferedSteps = null;
  g.play([{ clip: "quake", speed: 1, once: true, flip: false }]);
  g.shake = 0.08;
  g.groove.quake();
  g.score += pointsFor(fromRhythm ? 400 : 500);
  g.callout = "MOSSQUAKE";
  g.calloutLife = 1.4;
  g.announce("Mossquake!");
  g.seq = [];
  g.grants = [];
}

export function quakeImpact(g: Arcade) {
  if (g.quakeHit) return;
  g.quakeHit = true;
  g.impactLife = 0.24;
  if (!g.reducedMotion) g.body.kick(-40, 75);
  const x = g.mossX();
  g.burst("impact", x - 8, GROUND - 8);
  g.burst("dust", x - 18, GROUND);
  g.burst("dust", x + 16, GROUND);
  g.waves.push({ x, r: 10, life: 0.72 });
  g.waves.push({ x, r: 4, life: 0.95 });
  g.shake = 0.38;
  g.flash = 0.16;
  g.birds.forEach((bird) => {
    bird.scare = 0.8;
    bird.vy = -30;
  });
  const bonus = pointsFor(g.mode === "rhythm" ? 1400 : 2000);
  g.score += bonus;
  g.popups.push({ text: `+${bonus}`, life: 1, x: x - 10, y: GROUND - 120, gold: true });
  g.popups.push({ text: "MOSSQUAKE", life: 1, x: x - 20, y: GROUND - 96, gold: true });
}

export function award(g: Arcade, label: string, base: number, meterGain: number, combo: boolean) {
  const btn = g.seq.at(-1)?.btn ?? g.lastBtn;
  if (!combo && btn) {
    if (btn === g.lastBtn) g.sameRun += 1;
    else g.sameRun = 1;
    g.lastBtn = btn;
    g.recent.push(btn);
    if (g.recent.length > 4) g.recent.shift();
  }
  const spam = !combo && g.sameRun >= 6 ? 0.28 : !combo && g.sameRun >= 4 ? 0.45 : !combo && g.sameRun === 3 ? 0.7 : 1;
  const variety = new Set(g.recent).size >= 3 ? 1.5 : new Set(g.recent).size === 2 ? 1.15 : 1;
  const planted = ANIM[g.currentClip()].contacts.includes(g.frame);
  const flow = !combo && planted ? 1.12 : 1;
  const timing = g.beatJudge();
  // Empty-ground action spam cannot outperform precision street encounters.
  const strayAction = g.mode === "strut" ? (combo ? 0.08 : 0.18) : 1;
  // One empty-pavement reward per musical beat; holding/repeating cannot farm.
  const beat = Math.floor(g.songTime() / g.groove.beatDur);
  const eligible = g.runKind !== "practice" && g.runKind !== "route" && (g.mode !== "strut" || beat !== g.actionBeat);
  if (eligible) g.actionBeat = beat;
  const mult =
    (timing === "PERFECT" ? 1.6 : timing === "FRESH" ? 1.25 : timing === "LATE" ? 0.85 : 0.55) *
    spam *
    (combo ? 1 : variety) *
    flow * strayAction;
  const points = eligible ? pointsFor(base * mult) : 0;
  g.score += points;
  const before = g.meter;
  g.meter = Math.min(1, before + (eligible ? meterGain : 0) * spam * (timing === "OFF" ? 0.8 : 1) * strayAction);
  g.grants.push({ points, meter: g.meter - before, at: g.now });
  g.grants = g.grants.filter((grant) => g.now - grant.at < 0.2);
  if (
    g.meter >= 1 &&
    g.keys.has("A") &&
    g.keys.has("B") &&
    g.keys.has("C") &&
    g.currentClip() !== "quake"
  ) {
    g.doQuake(g.mode === "rhythm");
  }
  if (timing === "PERFECT" || timing === "FRESH") g.streak += 1;
  else g.streak = 0;
  if (g.mode !== "strut" && g.streak > 0 && g.streak % 4 === 0) g.score += pointsFor(50);
  g.callout = combo ? label : timing === "OFF" ? label : `${label} ${timing}`;
  g.calloutLife = combo ? 1.05 : 0.55;
  if (points > 0) g.popups.push({ text: `+${points}`, life: 1, x: MOSS_X + 20, y: GROUND - 120, gold: combo || timing === "PERFECT" });
}

export function beatJudge(g: Arcade): Judge  {
  if (!g.groove.running) return "FRESH";
  const beat = g.groove.beatDur;
  const phase = g.songTime() % beat;
  const dist = Math.min(phase, beat - phase);
  if (dist < 0.06) return "PERFECT";
  if (dist < 0.11) return "FRESH";
  if (dist < 0.16) return "LATE";
  return "OFF";
}

export function refundRecent(g: Arcade) {
  for (const grant of g.grants) {
    g.score = Math.max(0, g.score - grant.points);
    g.meter = Math.max(0, g.meter - grant.meter);
  }
  g.grants = [];
  g.popups = g.popups.filter((popup) => popup.life < 0.62);
}
