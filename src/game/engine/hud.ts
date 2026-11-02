/** In-canvas HUD (zone, route progress, lead trigger, callouts, popups) and the 30 Hz React HUD feed. */
import type { Arcade } from "../arcade";
import { ROUTE_PX, gradeAt, triggerLabel, zoneSample } from "../route";
import { cycleOf } from "../scenery";
import { GROUND, H, MOSS_X, W } from "./types";

export function drawHud(g: Arcade) {
  const sample = zoneSample(g.scroll + (g.mode === "menu" ? 240 : MOSS_X));
  const phase = gradeAt(cycleOf(g.now)).phase.toUpperCase();
  if (g.mode === "menu") {
    ctxLabel(g.ctx2d, `${sample.zone.name} · ${phase}`, 12, 22, "#f5c518", 8);
    return;
  }
  const ctx = g.ctx2d;
  ctx.font = "bold 9px monospace";
  if (g.mode === "strut") {
    const lead = g.runKind === "practice" ? null : g.leadStreet();
    ctx.fillStyle = "#b7a89a";
    ctx.fillText(`${sample.zone.name}  ${phase}`, 12, H - 12);
    if (g.runKind === "route") {
      const progress = Math.min(1, (g.scroll + MOSS_X) / ROUTE_PX);
      ctx.fillStyle = "#192231"; ctx.fillRect(12, H - 27, W - 24, 3);
      ctx.fillStyle = "#f5c518"; ctx.fillRect(12, H - 27, (W - 24) * progress, 3);
      ctx.textAlign = "right"; ctx.fillText(`${Math.floor(g.now / 60)}:${String(Math.floor(g.now % 60)).padStart(2, "0")} / ${Math.floor(progress * 100)}% HOME`, W - 12, H - 12); ctx.textAlign = "left";
    }
    if (lead) {
      ctx.fillStyle = lead.hot ? "#f5c518" : "#f4efe6";
      ctx.textAlign = "right";
      ctx.fillText(triggerLabel(lead.spec.trigger), W - 12, 20);
      ctx.textAlign = "left";
    }
  }
  if (g.calloutLife > 0) {
    ctx.fillStyle = "#f5c518";
    ctx.font = "11px 'Press Start 2P', monospace";
    ctx.fillText(g.callout, 12, 43);
  }
  for (const popup of g.popups) {
    ctx.globalAlpha = Math.max(0, Math.min(1, popup.life * 2));
    ctx.fillStyle = popup.gold ? "#f5c518" : "#f4efe6";
    const points = popup.text.startsWith("+");
    const size = points ? (popup.gold ? 35 : 27) : 12;
    ctx.font = `900 ${size}px monospace`;
    ctx.lineWidth = points ? 4 : 3;
    ctx.strokeStyle = "#080d12";
    ctx.lineJoin = "round";
    const x = Math.max(12,Math.min(W-ctx.measureText(popup.text).width-12,popup.x));
    const pop = g.reducedMotion ? 1 : 1 + Math.sin(Math.min(1, (1-popup.life)*5)*Math.PI)*.16;
    ctx.save();
    ctx.translate(x, popup.y);
    ctx.scale(pop,pop);
    ctx.strokeText(popup.text,0,0);
    ctx.fillText(popup.text,0,0);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  if (g.mode === "pause") {
    ctx.fillStyle = "rgba(8,6,10,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#f5c518";
    ctx.font = "14px 'Press Start 2P', monospace";
    ctx.fillText("HOLD UP", 150, 130);
  }
}

export function ctxLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  size: number,
) {
  ctx.fillStyle = color;
  ctx.font = `${size}px 'Press Start 2P', monospace`;
  ctx.fillText(text, x, y);
}

/** Score milestones announced to screen readers (Hyper Drive scale). */
export const MILESTONE_STEP = 25000;

/**
 * Reward feedback and the React HUD feed. Runs every unfrozen tick: turns new
 * points into one aggregated gain burst, eases the displayed score and emits
 * the live HUD at 30 Hz.
 */
export function tickRewards(g: Arcade, dt: number) {
  if (g.score > g.observedScore) {
    const earned = g.score - g.observedScore;
    g.gain = g.rewardWindow > 0 ? g.gain + earned : earned;
    if (g.rewardWindow <= 0) g.gainSerial++;
    g.rewardWindow = 0.16;
    g.rewardLife = 1.25;
    g.rewardPower = Math.min(1, g.rewardPower + earned / 16000);
    if (!g.reducedMotion) {
      const count = g.gain >= 4000 ? 24 : 9;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const speed = 28 + (i % 5) * 14;
        g.motes.push({ x: g.mossX() + 12, y: GROUND - 80, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 22, life: 0.65, max: 0.65, gold: g.gain >= 400 });
      }
      g.motes = g.motes.slice(-96);
    }
    if (g.score >= g.nextMilestone) {
      const reached = Math.floor(g.score / MILESTONE_STEP) * MILESTONE_STEP;
      g.nextMilestone = reached + MILESTONE_STEP;
      g.announce(`${reached.toLocaleString("en-AU")} points`);
    }
  }
  g.rewardWindow = Math.max(0, g.rewardWindow - dt);
  g.rewardLife = Math.max(0, g.rewardLife - dt);
  g.rewardPower = Math.max(0, g.rewardPower - dt * 1.8);
}

export function emitHud(g: Arcade, dt: number) {
  g.observedScore = g.score;
  g.displayScore += (g.score - g.displayScore) * (1 - Math.exp(-dt * 14));
  if (Math.abs(g.score - g.displayScore) < 1) g.displayScore = g.score;
  g.hudClock += dt;
  if (g.hudClock >= 1 / 30) {
    g.hudClock = 0;
    g.hooks.onHud?.({ score: Math.round(g.displayScore), meter: g.meter, streak: g.streak, gain: g.rewardLife > 0 ? g.gain : 0, serial: g.gainSerial, label: g.callout });
  }
}
