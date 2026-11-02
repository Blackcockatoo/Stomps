/** Animation queue, foot contacts and cosmetic effects (dust, waves, birds, trails, particles). */
import { ANIM, CELL, FX, PLAY_CLIPS, type ClipId } from "../clips";
import type { Arcade } from "../arcade";
import { GROUND, MOSS_X, type Step } from "./types";

export const STRUT: Step = { clip: "strut", speed: 1, once: false, flip: false };

export function mossX(g: Arcade) {
  if (g.mode === "rhythm") return 392;
  if (g.mode === "menu") return 360;
  return MOSS_X;
}

export function currentClip(g: Arcade): ClipId {
  return g.queue[g.stepIndex]?.clip ?? "strut";
}

export function burst(g: Arcade, kind: keyof typeof FX, x: number, y: number) {
  g.sparks.push({ kind, t: 0, x, y });
}

export function play(g: Arcade, steps: Step[]) {
  const key = steps
    .map((step) => `${step.clip}:${step.speed}:${step.from ?? 0}:${step.to ?? ""}:${step.flip ? 1 : 0}`)
    .join("|");
  if (key === g.lastPlayKey && g.now - g.lastPlayAt < 0.045) return;
  g.lastPlayKey = key;
  g.lastPlayAt = g.now;
  const prior = g.queue[g.stepIndex];
  const keepStride = prior?.clip === "strut" && steps[0]?.clip === "strut";
  const priorFrame = g.frame;
  const priorAcc = g.frameAcc;
  g.queue = steps;
  g.stepIndex = 0;
  g.frame = keepStride ? Math.max(steps[0]?.from ?? 0, Math.min(priorFrame, (steps[0]?.to ?? 12) - 1)) : steps[0]?.from ?? 0;
  g.frameAcc = keepStride ? priorAcc : 0;
  g.lastPlantFrame = -1;
  g.animWatch = 0;
}

export function advanceAnim(g: Arcade, dt: number) {
  const step = g.queue[g.stepIndex];
  if (!step) {
    play(g, [{ ...STRUT, flip: g.faceLeft }]);
    return;
  }
  const clip = PLAY_CLIPS[step.clip];
  const meta = ANIM[step.clip];
  const start = step.from ?? 0;
  const end = step.to ?? clip.frames;
  if (g.frame < start) g.frame = start;
  const rate = meta.frameSpeed?.[Math.min(g.frame, (meta.frameSpeed?.length ?? 1) - 1)] ?? 1;
  g.frameAcc += dt * Math.max(0.2, step.speed) * rate;
  const dur = 1 / clip.fps;
  let guard = 0;
  while (g.frameAcc >= dur && guard < 6) {
    guard += 1;
    g.frameAcc -= dur;
    g.frame += 1;
    if (step.clip === "quake" && g.frame === (meta.contacts[0] ?? 5)) g.quakeImpact();
    if (meta.contacts.includes(g.frame) && step.clip !== "quake") plant(g, step.clip);
    if (g.frame >= end) {
      if (!step.once) {
        g.frame = start;
      } else if (g.stepIndex < g.queue.length - 1) {
        g.stepIndex += 1;
        g.frame = g.queue[g.stepIndex]?.from ?? 0;
        g.frameAcc = 0;
        return;
      } else {
        const buffered = g.buffered && g.now - g.bufferAt < 0.22 ? g.buffered : null;
        g.buffered = null;
        play(g, [{ ...STRUT, flip: g.faceLeft }]);
        if (buffered && g.mode === "strut") g.commitSingle(buffered);
        return;
      }
    }
  }
  if (g.frame === g.lastFrameSeen) g.animWatch += dt;
  else {
    g.animWatch = 0;
    g.lastFrameSeen = g.frame;
  }
  if (g.animWatch > 2.4 && step.clip !== "strut") {
    play(g, [{ ...STRUT, flip: g.faceLeft }]);
  }
}

function plant(g: Arcade, clip: ClipId) {
  if (clip !== "strut" && clip !== "stomp" && clip !== "slide") return;
  if (!g.reducedMotion) g.body.kick(clip === "slide" ? 38 : -9, clip === "stomp" ? 42 : -12);
  burst(g, "dust", mossX(g) + (g.faceLeft ? -6 : 8), GROUND);
  if (clip === "stomp") {
    g.impactLife = 0.16;
    burst(g, "impact", mossX(g), GROUND - 4);
    g.waves.push({ x: mossX(g), r: 4, life: 0.24 });
    g.shake = Math.max(g.shake, 0.1);
    g.groove.stomp();
  }
}

/** Per-tick decay of springs, trails, particles, popups, sparks, waves and birds. */
export function tickEffects(g: Arcade, dt: number) {
  g.body.step(dt);
  g.trailClock += dt;
  for (const trail of g.trails) trail.life -= dt;
  g.trails = g.trails.filter((trail) => trail.life > 0);
  if (!g.reducedMotion && g.trailClock >= 1 / 30) {
    g.trailClock = 0;
    const step = g.queue[g.stepIndex];
    const img = step && g.mossFrames(step.clip)?.[g.frame];
    if (img && (step.clip === "slide" || step.clip === "spin" || g.rewardPower > 0.3)) {
      g.trails.push({ img, x: mossX(g) + g.body.x, y: GROUND + CELL.solePad + g.body.y, flip: step.flip || g.faceLeft, life: 0.16 });
      g.trails = g.trails.slice(-6);
    }
  }
}

export function tickParticles(g: Arcade, dt: number) {
  for (const mote of g.motes) {
    mote.life -= dt;
    mote.x += mote.vx * dt;
    mote.y += mote.vy * dt;
    mote.vy += 70 * dt;
  }
  g.motes = g.motes.filter((m) => m.life > 0);
  g.impactLife = Math.max(0, g.impactLife - dt);
  g.calloutLife = Math.max(0, g.calloutLife - dt);
  g.judgeLife = Math.max(0, g.judgeLife - dt);
  g.shake = Math.max(0, g.shake - dt * 2.4);
  g.flash = Math.max(0, g.flash - dt);
  g.quakeLock = Math.max(0, g.quakeLock - dt);
  g.popups.forEach((p) => {
    p.life -= dt;
    if (!g.reducedMotion) p.y -= dt * 25;
  });
  g.popups = g.popups.filter((p) => p.life > 0).slice(-8);
  g.sparks.forEach((s) => {
    s.t += dt;
  });
  g.sparks = g.sparks.filter((s) => s.t < 0.45);
  g.waves.forEach((w) => {
    w.life -= dt;
    w.r += dt * 220;
  });
  g.waves = g.waves.filter((w) => w.life > 0);
  g.birds.forEach((bird) => {
    bird.t += dt;
    if (bird.scare > 0) {
      bird.scare -= dt;
      bird.vy -= dt * 90;
      bird.y += bird.vy * dt;
    } else {
      bird.vy = 0;
      bird.y += Math.sin(bird.t * 2.4) * dt * 10;
      if (bird.y < 24) bird.y = 24;
      if (bird.y > 70) bird.y = 70;
    }
    if (bird.x - g.scroll * 0.16 < -40) bird.x += 1200;
  });
}

export function scareBirds(g: Arcade, time: number, vy: number) {
  g.birds.forEach((bird) => {
    bird.scare = time;
    bird.vy = vy;
  });
}
