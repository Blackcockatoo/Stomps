/** Canvas renderer. Reads engine state; never changes gameplay (scroll is interpolated then restored). */
import type { Arcade } from "../arcade";
import { CELL, PLAY_CLIPS, STAGE } from "../clips";
import { gradeAt, plateWeight } from "../route";
import { cycleOf, paintBackdrop, paintGlow, paintMarks, paintPips, paintProp, paintStreet } from "../scenery";
import { GROUND, H, W } from "./types";

export function draw(g: Arcade) {
  const ctx = g.ctx2d;
  const cssW = g.canvas.clientWidth || W;
  const cssH = g.canvas.clientHeight || H;
  const scale = Math.min(3, Math.max(1, Math.ceil(Math.min(cssW / W, cssH / H) * (window.devicePixelRatio || 1))));
  if (g.canvas.width !== W * scale || g.canvas.height !== H * scale) {
    g.canvas.width = W * scale;
    g.canvas.height = H * scale;
  }
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const ox = g.reducedMotion ? 0 : Math.sin(g.now * 103) * g.shake * 7;
  const oy = g.reducedMotion ? 0 : Math.cos(g.now * 89) * g.shake * 4;
  const actualScroll = g.scroll;
  if (g.mode === "strut") g.scroll += g.flow * g.accumulator;
  if (g.mode === "menu") g.scroll += 70 * g.accumulator;
  if (g.mode === "rhythm") g.scroll += 48 * g.accumulator;
  ctx.save();
  ctx.translate(ox, oy);
  drawWorld(g, false);
  if (g.mode === "strut" || g.mode === "menu") drawStreets(g);
  drawBirds(g);
  drawWaves(g);
  drawMomentum(g);
  drawMoss(g);
  drawWorld(g, true);
  drawFx(g);
  for (const mote of g.motes) {
    ctx.globalAlpha=Math.max(0,mote.life/mote.max);
    ctx.fillStyle=mote.gold ? "#f5c518" : "#64e2ed";
    const size=mote.gold ? 3 : 2;
    ctx.fillRect(mote.x,mote.y,size,size);
  }
  ctx.globalAlpha=1;
  if (g.mode === "rhythm") drawHighway(g);
  ctx.restore();
  if (g.flash > 0) {
    ctx.fillStyle = `rgba(255, 236, 180, ${Math.min(0.18, g.flash)})`;
    ctx.fillRect(0, 0, W, H);
  }
  g.scroll = actualScroll;
  g.drawHud();
  if (!g.ready) {
    ctx.fillStyle = "#f4efe6";
    ctx.font = "10px 'Press Start 2P', monospace";
    ctx.fillText(g.loadError ? "ASSET ERROR" : "LOADING THE BLOCK", 16, H / 2);
    if (!g.loadError && g.loadTotal > 0) {
      const p = g.loadDone / g.loadTotal;
      ctx.fillStyle = "#192231";
      ctx.fillRect(16, H / 2 + 10, 200, 4);
      ctx.fillStyle = "#64e2ed";
      ctx.fillRect(16, H / 2 + 10, Math.round(200 * p), 4);
      ctx.fillStyle = "#f4efe6";
      ctx.font = "8px 'Press Start 2P', monospace";
      ctx.fillText(`${Math.floor(p * 100)}%`, 224, H / 2 + 15);
    }
    if (g.loadError) {
      ctx.font = "16px Silkscreen, monospace";
      ctx.fillText(g.loadError.slice(0, 42), 16, H / 2 + 22);
    }
  }
}

export function drawWorld(g: Arcade, front: boolean) {
  const ctx = g.ctx2d;
  if (!g.world) {
    for (const layer of STAGE) {
      if (!!layer.front !== front) continue;
      const img = g.stage.get(layer.id);
      if (!img) continue;
      blit(ctx, img, g.scroll * layer.speed, layer.y, layer.h);
    }
    return;
  }
  if (front) {
    const weight = plateWeight(g.scroll + W / 2);
    const fore = g.stage.get("fore");
    if (fore && weight > 0.4) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, weight);
      blit(ctx, fore, g.scroll * 1.25, 214, 56);
      ctx.restore();
    }
    return;
  }
  const cycle = cycleOf(g.now);
  const grade = gradeAt(cycle);
  paintBackdrop(ctx, grade, cycle, g.now, g.scroll, g.world);
  const weight = plateWeight(g.scroll + W / 2);
  if (weight > 0.02) {
    ctx.save();
    ctx.globalAlpha = weight;
    for (const id of ["far", "mid"] as const) {
      const layer = STAGE.find((item) => item.id === id);
      const img = layer ? g.stage.get(layer.id) : undefined;
      if (!layer || !img) continue;
      blit(ctx, img, g.scroll * layer.speed, layer.y, layer.h);
    }
    ctx.restore();
  }
  paintStreet(ctx, g.world, g.scroll);
  if (grade.lamp > 0.45) {
    ctx.fillStyle = `rgba(6, 8, 18, ${grade.phase === "night" ? 0.16 : 0.1})`;
    ctx.fillRect(0, 96, W, 124);
  }
  paintGlow(ctx, g.world, g.scroll, grade);
  const ground = g.stage.get("ground");
  if (ground) blit(ctx, ground, g.scroll, 196, 74);
  ctx.fillStyle = grade.veil;
  ctx.fillRect(0, 196, W, 74);
  paintMarks(ctx, g.world, g.scroll);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(g.mossX(), GROUND + 3, 28, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawStreets(g: Arcade) {
  const ctx = g.ctx2d;
  for (const view of g.streetViews()) {
    const mark = g.streetMarks.get(view.key);
    const screen = view.world - g.scroll;
    if (screen < -48 || screen > W + 48) continue;
    let kind: "open" | "perfect" | "good" | "miss" | "soon" = "soon";
    let age = 0;
    if (mark) {
      kind = mark.kind;
      age = g.now - mark.at;
    } else if (Math.abs(view.dist) <= view.win.good) kind = "open";
    paintProp(ctx, view.spec.id, screen, GROUND, age, kind, g.now);
    if (!mark && view.dist < view.win.telegraph && view.dist > -view.win.good) {
      paintPips(ctx, view.spec.trigger, screen, GROUND - 112, Math.abs(view.dist) <= view.win.good);
    }
  }
}

export function drawBirds(g: Arcade) {
  const ctx = g.ctx2d;
  if (!g.birdsImg.length) return;
  for (const bird of g.birds) {
    const frame = Math.floor(bird.t * 8) % g.birdsImg.length;
    const img = g.birdsImg[frame];
    if (!img) continue;
    const x = bird.x - g.scroll * 0.16;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round(x), Math.round(bird.y), 28, 16);
  }
}

export function drawWaves(g: Arcade) {
  const ctx = g.ctx2d;
  for (const wave of g.waves) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, wave.life);
    ctx.strokeStyle = "#f5c518";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(wave.x, GROUND + 2, wave.r, Math.max(3, wave.r * 0.18), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#ff6a1a";
    ctx.globalAlpha = Math.max(0, wave.life * 0.45);
    ctx.beginPath();
    ctx.ellipse(wave.x, GROUND + 2, wave.r * 0.62, Math.max(2, wave.r * 0.1), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawMomentum(g: Arcade) {
  if (g.reducedMotion) return;
  const ctx = g.ctx2d;
  for (const trail of g.trails) {
    ctx.save();
    ctx.globalAlpha = trail.life / .16 * .16;
    ctx.translate(trail.x + (trail.life - .16) * g.flow, trail.y);
    if (trail.flip) ctx.scale(-1, 1);
    ctx.drawImage(trail.img, -trail.img.width / 2, -trail.img.height);
    ctx.restore();
  }
  if (g.rewardPower > 0.08 && g.mode === "strut") {
    ctx.save();
    ctx.strokeStyle = "#64e2ed";
    ctx.lineWidth = 1;
    for (let i=0; i<12; i++) {
      const x = ((i*89 - g.scroll*1.8) % W + W) % W;
      const y = 38 + (i*43)%174;
      ctx.globalAlpha = g.rewardPower * .22;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+12+g.rewardPower*28,y); ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawMoss(g: Arcade) {
  const step = g.queue[g.stepIndex];
  if (!step) return;
  const frames = g.mossFrames(step.clip);
  const img = frames?.[Math.min(g.frame, (frames?.length ?? 1) - 1)];
  if (!img) return;
  const ctx = g.ctx2d;
  const x = g.mossX();
  const flip = step.flip || (step.clip === "strut" && g.faceLeft);
  ctx.save();
  // Continuous sub-frame body motion keeps original pixel poses crisp.
  const phase=(g.frame + (g.frameAcc + g.accumulator * step.speed) * PLAY_CLIPS[step.clip].fps)*Math.PI/4;
  const moving=step.clip === "strut";
  const bob=g.reducedMotion || !moving ? 0 : Math.sin(phase*2)*.65;
  const lateral = g.reducedMotion ? 0 : g.body.x;
  const lift = g.reducedMotion ? 0 : g.body.y;
  ctx.translate(x + lateral, GROUND + CELL.solePad + bob + lift);
  if (!g.reducedMotion && moving) ctx.rotate(Math.sin(phase)*.006);
  if (!g.reducedMotion && g.impactLife > 0) {
    const squash = Math.sin(g.impactLife / 0.24 * Math.PI) * 0.035;
    ctx.scale(1 + squash, 1 - squash);
  }
  if (flip) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, -img.width / 2, -img.height);
  ctx.restore();
}

export function drawFx(g: Arcade) {
  const ctx = g.ctx2d;
  for (const spark of g.sparks) {
    const frames = g.fx.get(spark.kind);
    if (!frames?.length) continue;
    const index = Math.min(frames.length - 1, Math.floor((spark.t / 0.5) * frames.length));
    const img = frames[index];
    if (!img) continue;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, spark.x - 32, spark.y - 48, 64, 64);
  }
}

export function drawHighway(g: Arcade) {
  const ctx = g.ctx2d;
  const t = g.groove.running ? g.songTime() : 0;
  const hitX = 78;
  const lanes = [86, 132, 178];
  ctx.fillStyle = "rgba(8,6,12,0.45)";
  ctx.fillRect(8, 62, 250, 150);
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = i === 0 ? "#1f8cff" : i === 1 ? "#e10600" : "#f5c518";
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(20, lanes[i] ?? 0);
    ctx.lineTo(250, lanes[i] ?? 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = "#f4efe6";
  ctx.beginPath();
  ctx.moveTo(hitX, 68);
  ctx.lineTo(hitX, 200);
  ctx.stroke();
  const pxPerSec = 210;
  for (const note of g.chart) {
    if (note.missed) continue;
    const x = hitX + (note.time - t) * pxPerSec;
    if (x < -40 || x > W + 40) continue;
    const y = (lanes[note.lane] ?? 100) - 10;
    const img = g.notesImg[note.lane];
    if (note.dur > 0) {
      const tail = note.dur * pxPerSec;
      ctx.fillStyle = note.lane === 0 ? "#1f8cff" : note.lane === 1 ? "#e10600" : "#f5c518";
      ctx.globalAlpha = note.hit ? 0.35 : 0.8;
      ctx.fillRect(x, y + 6, tail, 8);
      ctx.globalAlpha = 1;
    }
    if (note.hit && note.dur <= 0) continue;
    if (img && (!note.hit || note.holding)) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, x - 8, y, 48, 20);
    }
  }
  if (g.judgeLife > 0) {
    ctx.fillStyle = g.judgeText === "STUMBLED" ? "#ff6a1a" : "#f5c518";
    ctx.font = "12px 'Press Start 2P', monospace";
    ctx.fillText(g.judgeText, 88, 58);
  }
}

export function blit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  scroll: number,
  y: number,
  height: number,
) {
  const w = img.width * (height / img.height);
  const shift = ((scroll % w) + w) % w;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, -shift, y, w, height);
  ctx.drawImage(img, -shift + w, y, w, height);
  if (-shift + w * 2 < W) ctx.drawImage(img, -shift + w * 2, y, w, height);
}
