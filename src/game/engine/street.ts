/** Street Strut: movement, the authored route (THE LONG WAY HOME), street windows and route results. */
import type { Arcade } from "../arcade";
import { pointsFor } from "../feel";
import { flowHit, flowMiss, flowMultiplier, flowName } from "./flow";
import { ROUTE_PX, STREETS, isPrefix, sameTrigger, streetX, windowsFor, type StreetSpec } from "../route";
import { GROUND, MOSS_X } from "./types";
import { BONUS_MULT, bonusViews, tickBonus, tickDoor } from "../bonus";

export function tickStrut(g: Arcade, dt: number) {
  const boosting = g.keys.has("A") && !g.keys.has("C");
  const speed = boosting ? 138 : g.idleFor > 2.4 ? 64 : 92;
  const heavy = g.currentClip() === "stomp" || g.currentClip() === "quake" || g.currentClip() === "slide";
  const flow = speed * (heavy ? 0.72 : 1);
  g.flow += (flow - g.flow) * (1 - Math.exp(-dt * 9));
  g.scroll += dt * g.flow;
  g.routeMaxChain = Math.max(g.routeMaxChain, g.streak);
  g.faceLeft = g.keys.has("A") && g.keys.has("C") && !g.keys.has("B");
  if (g.keys.size === 0) g.idleFor += dt;
  else g.idleFor = 0;

  const step = g.queue[g.stepIndex];
  if (step && step.clip === "strut" && !step.once) {
    step.speed = g.flow / 92;
    step.flip = g.faceLeft;
  }
  if (g.runKind !== "practice") g.scanStreets();
  g.flushStreet();
  if (g.bonus) {
    // Inside the bonus world the route (finish line, laps) is on hold.
    tickBonus(g);
    recordFreeBest(g);
    return;
  }
  tickDoor(g);
  if (g.bonus) return;
  if (g.runKind === "route" && g.scroll + MOSS_X >= ROUTE_PX) {
    g.finishRoute();
    return;
  }
  const lap = Math.floor((g.scroll + MOSS_X) / ROUTE_PX);
  if (lap > g.lap) {
    g.lap = lap;
    g.lapHits = 0;
    g.callout = "THE LONG WAY HOME";
    g.calloutLife = 1.5;
    g.groove.combo();
  }
  recordFreeBest(g);
}

function recordFreeBest(g: Arcade) {
  if (g.runKind === "free" && g.score > g.bestStrut) {
    g.bestStrut = g.score;
    g.recordStrutBest();
  }
}

export function finishRoute(g: Arcade) {
  g.mode = "result";
  g.keys.clear();
  g.groove.stop();
  const newRecord = g.score > g.bestRoute;
  if (newRecord) {
    g.bestRoute = g.score;
    g.recordRouteBest();
  }
  g.hooks.onResult({ kind: "route", seconds: g.now, score: g.score,
    personalBest: g.bestRoute, newRecord,
    perfect: g.streetPerfect, fresh: g.streetGood, late: 0,
    stumble: g.streetMiss, maxCombo: g.flowState.longest, bonus: g.bonusCleared,
    flowPeak: g.flowState.peak });
  g.hooks.onMode("result");
}

export function mossWorld(g: Arcade) {
  return g.scroll + g.mossX();
}

type View = {
  spec: StreetSpec;
  world: number;
  dist: number;
  key: string;
  win: { perfect: number; good: number; telegraph: number };
};

export function streetViews(g: Arcade) {
  const moss = g.mossWorld();
  const lap = Math.floor(moss / ROUTE_PX);
  const views: View[] = [];
  if (g.bonus) {
    for (const view of bonusViews(g)) {
      const win = windowsFor(g.flow, view.spec);
      if (view.dist > win.telegraph + 420 || view.dist < -win.good - 90) continue;
      views.push({ ...view, win });
    }
    return views;
  }
  for (const spec of STREETS) {
    const local = streetX(spec);
    for (const lapK of [lap - 1, lap, lap + 1]) {
      if (lapK < 0) continue;
      const world = local + lapK * ROUTE_PX;
      const dist = world - moss;
      const win = windowsFor(g.flow, spec);
      if (dist > win.telegraph + 420 || dist < -win.good - 90) continue;
      views.push({ spec, world, dist, key: `${spec.uid}:${lapK}`, win });
    }
  }
  return views;
}

export function scanStreets(g: Arcade) {
  if (g.bonus) {
    for (const view of bonusViews(g)) scanOne(g, view.key, view.dist, windowsFor(g.flow, view.spec));
    return;
  }
  const moss = g.mossWorld();
  const lap = Math.floor(moss / ROUTE_PX);
  for (const spec of STREETS) {
    const local = streetX(spec);
    for (const lapK of [lap - 1, lap, lap + 1]) {
      if (lapK < 0) continue;
      scanOne(g, `${spec.uid}:${lapK}`, local + lapK * ROUTE_PX - moss, windowsFor(g.flow, spec));
    }
  }
}

function scanOne(g: Arcade, key: string, dist: number, win: View["win"]) {
  if (g.streetMarks.has(key)) return;
  if (dist < win.telegraph && dist > -win.good && !g.streetCued.has(key)) {
    g.streetCued.add(key);
    g.groove.cue();
  }
  if (dist < -win.good && dist > -480) {
    g.streetMarks.set(key, { kind: "miss", at: g.now });
    g.streetMiss += 1;
    g.flowState = flowMiss(g.flowState, g.now);
    g.streak = 0;
    g.meter = Math.max(0, g.meter - 0.10);
    if (g.currentClip() !== "quake") g.play([{ clip: "stumble", speed: 1.25, once: true, flip: false }]);
    g.callout = "STUMBLED / RECOVER ON BEAT";
    g.calloutLife = 0.95;
    g.groove.miss();
    g.announce("Missed street move. Tap on beat to recover flow.");
  }
}

export function flushStreet(g: Arcade) {
  if (g.mode !== "strut" || !g.streetPending.size) return;
  const btns = [...g.streetPending.keys()];
  const age = g.now - Math.min(...g.streetPending.values());
  const open = g.streetViews().filter((view) => !g.streetMarks.has(view.key));
  const exact = open
    .filter((view) => sameTrigger(view.spec, btns) && Math.abs(view.dist) <= view.win.good)
    .sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist))[0];
  if (exact) {
    g.settleStreet(exact.spec, exact.key, exact.dist, exact.win.perfect);
    g.streetPending.clear();
    return;
  }
  const waiting = open.some(
    (view) => isPrefix(btns, view.spec.trigger) && view.dist < view.win.telegraph && view.dist > -view.win.good,
  );
  if (waiting && age < 0.09) return;
  g.streetPending.clear();
}

export function settleStreet(g: Arcade, spec: StreetSpec, key: string, dist: number, perfectPx: number) {
  const kind = Math.abs(dist) <= perfectPx ? "perfect" : "good";
  g.refundRecent(); // A button and its street encounter must never pay twice.
  const previousLevel = g.flowState.level;
  g.flowState = flowHit(g.flowState);
  g.streetMarks.set(key, { kind, at: g.now });
  if (kind === "perfect") g.streetPerfect += 1;
  else g.streetGood += 1;
  const variety = [1, 1.1, 1.4, 1.8][Math.min(3, new Set(g.recent).size)] ?? 1;
  const mult = g.bonus ? BONUS_MULT : 1;
  const points = pointsFor((kind === "perfect" ? spec.scorePerfect : spec.scoreGood) * variety * mult * flowMultiplier(g.flowState));
  g.score += points;
  if (!g.bonus) g.lapHits += 1;
  g.meter = Math.min(1, g.meter + (kind === "perfect" ? 0.07 : 0.04));
  g.callout = g.flowState.level > previousLevel ? flowName(g.flowState.level) : mult > 1 ? `${spec.feedback} ×${mult}` : spec.feedback;
  g.announce(`${kind === "perfect" ? "Perfect" : "Good"}: ${spec.feedback.toLowerCase()}${mult > 1 ? `, times ${mult}` : ""}`);
  g.calloutLife = 1.05;
  g.popups.push({
    text: `+${points}`,
    life: 0.85,
    x: g.mossX() + 18,
    y: GROUND - 108,
    gold: kind === "perfect",
  });
  if (kind === "perfect") g.groove.perfect();
  else g.groove.combo();
  if (spec.id === "seagull") {
    g.birds.forEach((bird) => {
      bird.scare = 0.75;
      bird.vy = -28;
    });
  } else if (!spec.body && spec.trigger.includes("B")) g.burst("dust", g.mossX(), GROUND);
  else if (!spec.body && spec.trigger.includes("C")) g.burst("sparks", g.mossX() + 12, GROUND - 64);
  if (
    g.meter >= 1 &&
    g.keys.has("A") &&
    g.keys.has("B") &&
    g.keys.has("C") &&
    g.currentClip() !== "quake"
  ) {
    g.doQuake(false);
  }
}

export function leadStreet(g: Arcade) {
  let best: { spec: StreetSpec; hot: boolean; dist: number } | null = null;
  for (const view of g.streetViews()) {
    if (g.streetMarks.has(view.key)) continue;
    if (view.dist > view.win.telegraph || view.dist < -view.win.good) continue;
    if (!best || view.dist < best.dist) {
      best = { spec: view.spec, dist: view.dist, hot: Math.abs(view.dist) <= view.win.good };
    }
  }
  return best;
}
