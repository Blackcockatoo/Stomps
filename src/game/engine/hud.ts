/** In-canvas HUD (zone, route progress, lead trigger, callouts, popups) and the 30 Hz React HUD feed. */
import type { Arcade } from "../arcade";
import { ROUTE_PX, gradeAt, triggerLabel, zoneSample } from "../route";
import { cycleOf } from "../scenery";
import { BONUS_MULT } from "../bonus";
import { objectiveChips, type Chip } from "../objectives";
import { GROUND, H, MOSS_X, W } from "./types";

export function drawHud(g: Arcade) {
  const sample = zoneSample(g.routeScroll() + (g.mode === "menu" ? 240 : MOSS_X));
  const phase = gradeAt(cycleOf(g.now)).phase.toUpperCase();
  if (g.mode === "menu") {
    ctxLabel(g.ctx2d, `${sample.zone.name} · ${phase}`, 12, 22, "#f5c518", 8);
    return;
  }
  const ctx = g.ctx2d;
  const L = g.view.left + 12;
  const R = g.view.right - 12;
  /** Portrait phones crop the playfield; stack the bottom line and drop the cue label below the controls. */
  const narrow = R - L < W * 0.6;
  ctx.font = "bold 9px monospace";
  if (g.mode === "strut") {
    const lead = g.runKind === "practice" ? null : g.leadStreet();
    ctx.fillStyle = g.bonus ? "#ff3ea5" : "#b7a89a";
    ctx.fillText(g.bonus ? `BONUS WORLD ×${g.bonus.multiplier ?? BONUS_MULT}  ${phase}` : `${sample.zone.name}  ${phase}`, L, H - 12);
    if (g.runKind === "route") {
      const progress = Math.min(1, (g.routeScroll() + MOSS_X) / ROUTE_PX);
      ctx.fillStyle = "#192231"; ctx.fillRect(L, H - 27, R - L, 3);
      ctx.fillStyle = "#f5c518"; ctx.fillRect(L, H - 27, (R - L) * progress, 3);
      ctx.textAlign = "right"; ctx.fillText(`${Math.floor(g.now / 60)}:${String(Math.floor(g.now % 60)).padStart(2, "0")} / ${Math.floor(progress * 100)}% HOME`, R, narrow ? H - 33 : H - 12); ctx.textAlign = "left";
    }
    if (lead) {
      ctx.fillStyle = lead.hot ? "#f5c518" : "#f4efe6";
      ctx.textAlign = "right";
      ctx.fillText(triggerLabel(lead.spec.trigger), R, narrow ? 58 : 20);
      ctx.textAlign = "left";
    }
  }
  if (g.mode === "strut") {
    g.drawSk8Hud(L, R);
    drawChips(g, sample.zone.id, L, narrow);
    drawZoneCard(g);
  }
  if (g.mode === "strut" && g.flowState.recoveryUntil > g.now) {
    const remaining = (g.flowState.recoveryUntil - g.now) / 1.8;
    ctx.fillStyle = "#f5c518"; ctx.font = "bold 9px monospace";
    ctx.fillText("RECOVER ON THE BEAT", L, 64);
    ctx.fillStyle = "#273548"; ctx.fillRect(L, 69, R - L, 3);
    ctx.fillStyle = "#f5c518"; ctx.fillRect(L, 69, (R - L) * remaining, 3);
  }
  if (g.calloutLife > 0) {
    ctx.fillStyle = "#f5c518";
    ctx.font = "11px 'Press Start 2P', monospace";
    const width = ctx.measureText(g.callout).width;
    const fit = width > R - L ? Math.max(6, Math.floor(11 * (R - L) / width)) : 11;
    if (fit !== 11) ctx.font = `${fit}px 'Press Start 2P', monospace`;
    ctx.fillText(g.callout, L, 43);
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
    const x = Math.max(L,Math.min(R-ctx.measureText(popup.text).width,popup.x));
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
    ctx.textAlign = "center";
    ctx.fillText("HOLD UP", (g.view.left + g.view.right) / 2, 130);
    ctx.textAlign = "left";
  }
}

const CHIP_TONE: Record<Chip["tone"], string> = { gold: "#f5c518", cyan: "#64e2ed", pink: "#ff3ea5", lime: "#9dff5a" };

/** Objective strip (top-left): pops when a value changes, stamps ✓ when done. */
function drawChips(g: Arcade, zoneId: string, left: number, narrow: boolean) {
  const chips = objectiveChips({
    runKind: g.runKind, bonus: !!g.bonus, lapHits: g.lapHits, meter: g.meter, zoneId,
    pierPerfect: g.pierPerfect, pierMiss: g.pierMiss, techniques: g.techniques.size,
    trick: g.trickChip(zoneId),
  });
  if (!chips.length) return;
  const ctx = g.ctx2d;
  let x = left;
  const y = 6;
  ctx.save();
  ctx.font = "6px 'Press Start 2P', monospace";
  ctx.textBaseline = "middle";
  for (const chip of chips) {
    const text = narrow ? chip.short : chip.text;
    const seen = g.chips.get(chip.id);
    if (!seen || seen.value !== text) g.chips.set(chip.id, { value: text, at: seen ? g.now : -9 });
    const age = g.now - (g.chips.get(chip.id)?.at ?? -9);
    const tone = CHIP_TONE[chip.tone];
    const w = Math.ceil(ctx.measureText(text).width) + 10;
    const h = 12;
    const pop = g.reducedMotion || age > 0.3 ? 1 : 1 + Math.sin((age / 0.3) * Math.PI) * 0.22;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(pop, pop);
    ctx.fillStyle = chip.done ? tone : "rgba(8, 6, 10, 0.78)";
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = tone;
    ctx.lineWidth = 1;
    ctx.strokeRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1);
    if (!g.reducedMotion && age < 0.45) {
      ctx.globalAlpha = 1 - age / 0.45;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = chip.done ? "#0c0a0e" : "#f4efe6";
    ctx.textAlign = "center";
    ctx.fillText(text, 0, 1);
    ctx.restore();
    if (chip.done) {
      // Rubber-stamp tick lands on completion.
      const s = g.reducedMotion || age > 0.25 ? 1 : 2 - age / 0.25;
      ctx.save();
      ctx.translate(x + w - 2, y + 1);
      ctx.rotate(-0.25);
      ctx.scale(s, s);
      ctx.fillStyle = "#0c0a0e";
      ctx.fillRect(-5, -5, 10, 10);
      ctx.fillStyle = "#f5c518";
      ctx.textAlign = "center";
      ctx.fillText("✓", 0, 1);
      ctx.restore();
    }
    x += w + 6;
  }
  ctx.restore();
}

/** Zone title card on entry: slides in, holds, fades (1.8s). */
function drawZoneCard(g: Arcade) {
  const card = g.zoneCard;
  if (!card) return;
  const age = g.now - card.at;
  if (age < 0 || age > 1.8) return;
  const ctx = g.ctx2d;
  const cx = (g.view.left + g.view.right) / 2;
  const alpha = age < 0.2 ? age / 0.2 : age > 1.4 ? (1.8 - age) / 0.4 : 1;
  const slide = g.reducedMotion ? 0 : Math.max(0, 1 - age / 0.25) * 24;
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.font = "12px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  const w = Math.min(g.view.right - g.view.left - 16, ctx.measureText(card.name).width + 36);
  ctx.fillStyle = "rgba(8, 6, 10, 0.72)";
  ctx.fillRect(cx - w / 2 - slide, 76, w, 26);
  ctx.fillStyle = "#e10600";
  ctx.fillRect(cx - w / 2 - slide, 76, w, 2);
  ctx.fillStyle = "#f5c518";
  ctx.fillRect(cx - w / 2 - slide, 100, w, 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#120c14";
  ctx.lineJoin = "round";
  ctx.strokeText(card.name, cx + slide, 95);
  ctx.fillStyle = "#f4efe6";
  ctx.fillText(card.name, cx + slide, 95);
  ctx.restore();
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
    g.hooks.onHud?.({ score: Math.round(g.displayScore), meter: g.meter, streak: g.streak,
      gain: g.rewardLife > 0 ? g.gain : 0, serial: g.gainSerial, label: g.callout, bonus: !!g.bonus,
      flowLevel: g.flowState.level, flowChain: g.flowState.chain,
      recovering: g.mode === "strut" && g.flowState.recoveryUntil > g.now,
      bonusMultiplier: g.bonus?.multiplier });
  }
}
