/** SK8 STOMP drawing: toys and their beat cues, the board under Moss, the rival, flyers, drips and the trick HUD. */
import type { Arcade } from "../arcade";
import type { Btn } from "../arcade-types";
import { keyLabel } from "../keys";
import { pipGlyph } from "../cues";
import * as K from "../sk8";
import * as S from "../stompables";
import { BOARD_LIFT, paintBeatCue, paintBoard, paintDrips, paintFlyer, paintRival, paintStomp, type TrickPose } from "../stomp-art";
import { GROUND, W } from "./types";

const CUE: Partial<Record<S.StompKind, (run: S.StompRun) => string>> = {
  board: () => "STOMP TAIL",
  trolley: (run) => run.state === "rolling" ? "AGAIN ON BEAT" : "STOMP",
  wheelie: (run) => run.state === "open" ? "AGAIN!" : "STOMP LID",
  pigeons: () => "STOMP ON 1",
  sprinkler: () => "SPLASH",
  meter: (run) => run.state === "paying" ? `KEEP STOMPING ×${run.coins}` : "STOMP",
};

function beatPhase(g: Arcade, beats = 1) {
  if (!g.groove.running) return 0.5;
  const span = g.groove.beatDur * beats;
  const t = g.songTime();
  return (((t % span) + span) % span) / span;
}

export function drawStomps(g: Arcade) {
  const ctx = g.ctx2d;
  const views = g.stompViews();
  const order = [...views].sort((a, b) => (a.run.kind === "ledge" ? 0 : 1) - (b.run.kind === "ledge" ? 0 : 1));
  for (const view of order) {
    const screen = view.x - g.scroll;
    const span = view.run.kind === "ledge" ? view.run.len : 0;
    if (screen < -60 - span || screen > W + 60) continue;
    paintStomp(ctx, view.run, screen, GROUND, g.now, g.reducedMotion);
  }
  if (g.mode !== "strut" || g.riding()) return;
  for (const view of views) {
    const run = view.run;
    if (!S.wantsPress(run)) continue;
    if (run.state !== "paying" && (view.dist > 260 || view.dist < S.REACH_BEHIND)) continue;
    const label = CUE[run.kind]?.(run);
    if (!label) continue;
    const hot = S.inReach(run, view.dist);
    const screen = run.state === "paying" ? Math.max(g.mossX() + 30, view.x - g.scroll) : view.x - g.scroll;
    paintBeatCue(ctx, ["B"], screen, GROUND - 122, beatPhase(g, run.kind === "pigeons" ? 4 : 1), hot, g.now, g.reducedMotion, label);
  }
}

function pose(g: Arcade): TrickPose {
  const trick = g.p5.trick;
  if (!trick || trick.id === "bail") return null;
  return trick;
}

/** Board under Moss while riding; returns how far Moss stands above the street. */
export function drawRideBoard(g: Arcade, x: number) {
  if ((g.mode !== "strut" && g.mode !== "pause") || !g.riding()) return 0;
  const ride = g.p5.sk8.ride;
  let holding: "manual" | "grind" | null = null;
  if (ride?.holdBtn && g.now - ride.holdAt >= 0.15) holding = S.surfaceAt(g.mossWorld()) ? "grind" : "manual";
  const hop = paintBoard(g.ctx2d, x, GROUND, pose(g), g.now, g.reducedMotion, holding);
  return BOARD_LIFT + hop;
}

const PIP: Record<Btn, [string, string]> = { A: ["#0f4f99", "#1f8cff"], B: ["#7a0a06", "#e10600"], C: ["#8a6a08", "#f5c518"] };

function pip(ctx: CanvasRenderingContext2D, btn: Btn, x: number, y: number, lit: boolean, mark: K.RivalMark | "now") {
  const [dark, base] = PIP[btn];
  ctx.fillStyle = "#120c14";
  ctx.fillRect(x - 1, y - 1, 14, 14);
  ctx.fillStyle = lit ? base : dark;
  ctx.fillRect(x, y, 12, 12);
  ctx.fillStyle = "#0c0a0e";
  ctx.font = "6px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  ctx.fillText(pipGlyph(keyLabel(btn)), x + 6, y + 9);
  if (mark === "now") {
    ctx.strokeStyle = "#f4efe6";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 2.5, y - 2.5, 17, 17);
  } else if (mark) {
    const good = mark === "PERFECT" || mark === "GREAT" || mark === "OK";
    ctx.fillStyle = good ? (mark === "PERFECT" ? "#f5c518" : "#9dff5a") : "#ff3a1a";
    ctx.fillRect(x, y + 13, 12, 2);
  }
}

function drawRival(g: Arcade) {
  const rival = g.p5.rival;
  if (!rival) return;
  const ctx = g.ctx2d;
  const bd = g.groove.beatDur;
  const leave = rival.done ? (g.now - rival.doneAt) : 0;
  const rx = g.mossX() + 112 + (g.reducedMotion ? 0 : leave * leave * 160);
  const trick: TrickPose = rival.trick ? { id: K.BTN_TRICK[rival.trick.btn], grade: "PERFECT", at: rival.trick.at } : null;
  paintRival(ctx, rx, GROUND, trick, g.now, g.reducedMotion, rival.done ? Math.max(0, 1 - leave / 1.6) : 1);
  if (rival.done) return;
  const beat = Math.floor(g.songTime() / bd + 0.02);
  const ph = K.rivalPhase(rival.startBeat, beat);
  if (ph.phase === "done") return;
  const plan = rival.plan[ph.bar]!;
  const cx = g.mossX() + 56;
  const y = 76;
  ctx.save();
  ctx.fillStyle = "rgba(8, 6, 10, 0.78)";
  ctx.fillRect(cx - 44, y - 12, 88, 34);
  ctx.strokeStyle = ph.phase === "response" ? "#9dff5a" : "#ff3ea5";
  ctx.strokeRect(cx - 43.5, y - 11.5, 87, 33);
  ctx.font = "6px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = ph.phase === "response" ? "#9dff5a" : "#ff3ea5";
  ctx.fillText(ph.phase === "intro" ? "RIVAL · GET READY" : ph.phase === "call" ? `HIS LINE ${ph.bar + 1}/2` : `YOUR TURN ${ph.bar + 1}/2`, cx, y - 3);
  for (let i = 0; i < 4; i++) {
    const lit = ph.phase === "call" ? i <= ph.slot : ph.phase === "response";
    const mark: K.RivalMark | "now" = ph.phase === "response" ? (rival.marks[ph.bar]![i] ?? (i === ph.slot ? "now" : null)) : null;
    pip(ctx, plan[i]!, cx - 34 + i * 18, y + 3, ph.phase === "intro" ? false : lit, mark);
  }
  ctx.restore();
}

export function drawSk8Front(g: Arcade) {
  if (g.mode !== "strut" && g.mode !== "pause") return;
  const ctx = g.ctx2d;
  drawRival(g);
  for (const f of g.p5.flyers) paintFlyer(ctx, f.kind, f.x, f.y, f.life, f.max, f.tone, g.now);
  if (g.p5.buffUntil > g.now) paintDrips(ctx, g.mossX(), GROUND - 96, GROUND, g.now, g.reducedMotion);
}

/** Chain read-out above Moss while riding (and briefly after), plus the dripping buff timer. */
export function drawSk8Hud(g: Arcade, left: number, right: number) {
  const ctx = g.ctx2d;
  const sk8 = g.p5.sk8;
  const ride = sk8.ride;
  const since = g.now - g.p5.landedAt;
  ctx.save();
  if (ride || since < 1.4) {
    const links = ride ? ride.links : g.p5.lastLinks;
    const alpha = ride ? 1 : Math.max(0, 1 - since / 1.4);
    const w = 132;
    const x = Math.max(left, Math.min(right - w, g.mossX() - 48));
    const y = GROUND - 172;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(8, 6, 10, 0.72)";
    ctx.fillRect(x, y, w, 34);
    ctx.font = "6px 'Press Start 2P', monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#f4efe6";
    const text = links.length ? K.chainText(links, 2) : ride ? "FLIP ON THE BEAT" : "";
    ctx.fillText(text.length > 24 ? text.slice(0, 23) + "…" : text, x + 4, y + 9);
    ctx.font = "9px 'Press Start 2P', monospace";
    if (ride) {
      const value = K.chainValue(sk8, g.buffMult()) * 10;
      ctx.fillStyle = "#f5c518";
      ctx.fillText(`${value.toLocaleString("en-AU")} ×${K.chainMult(links.length) || 1}`, x + 4, y + 21);
      const left01 = Math.max(0, (ride.endsAt - g.now) / (ride.endsAt - ride.startedAt));
      ctx.fillStyle = "#273548";
      ctx.fillRect(x + 4, y + 30, w - 8, 2);
      ctx.fillStyle = "#64e2ed";
      ctx.fillRect(x + 4, y + 30, (w - 8) * left01, 2);
    } else {
      ctx.fillStyle = g.p5.lastBailed ? "#ff3a1a" : "#9dff5a";
      ctx.fillText(g.p5.lastBailed ? "BAILED" : `+${g.p5.lastBank.toLocaleString("en-AU")}`, x + 4, y + 21);
    }
    // Style meter: mixing tricks fills it, repeating drains it; it scales the landed chain.
    ctx.font = "5px 'Press Start 2P', monospace";
    ctx.fillStyle = "#ff3ea5";
    ctx.fillText("STYLE", x + 84, y + 21);
    ctx.fillStyle = "#273548";
    ctx.fillRect(x + 84, y + 24, 44, 3);
    ctx.fillStyle = "#ff3ea5";
    ctx.fillRect(x + 84, y + 24, 44 * sk8.style, 3);
    ctx.globalAlpha = 1;
  }
  if (g.p5.buffUntil > g.now) {
    const left01 = Math.min(1, (g.p5.buffUntil - g.now) / 8);
    ctx.font = "bold 9px monospace";
    ctx.fillStyle = "#8cc4f0";
    ctx.textAlign = "left";
    ctx.fillText(`DRIPPING ×${S.BUFF_MULT}`, left, 86);
    ctx.fillStyle = "#273548";
    ctx.fillRect(left, 90, 72, 2);
    ctx.fillStyle = "#8cc4f0";
    ctx.fillRect(left, 90, 72 * left01, 2);
  }
  ctx.restore();
}
