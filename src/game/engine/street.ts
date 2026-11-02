/** Street Strut: movement, the authored route (THE LONG WAY HOME), street windows and route results. */
import type { Arcade } from "../arcade";
import { pointsFor } from "../feel";
import { flowHit, flowMiss, flowMultiplier, flowName } from "./flow";
import { ROUTE_PX, STREETS, streetForLap, streetPrefix, streetSolution, streetTechnique, streetX, windowsFor, type StreetQuality, type StreetSpec } from "../route";
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
      const live = streetForLap(spec, lapK, g.runSeed);
      const win = windowsFor(g.flow, live);
      if (dist > win.telegraph + 420 || dist < -win.good - 90) continue;
      views.push({ spec: live, world, dist, key: `${spec.uid}:${lapK}`, win });
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
      scanOne(g, `${spec.uid}:${lapK}`, local + lapK * ROUTE_PX - moss, windowsFor(g.flow, streetForLap(spec, lapK, g.runSeed)));
    }
  }
}

function scanOne(g: Arcade, key: string, dist: number, win: View["win"]) {
  if (g.streetMarks.has(key)) return;
  if (dist < win.telegraph && dist > -win.good && !g.streetCued.has(key)) {
    g.streetCued.add(key);
    g.groove.cue();
  }
  // Only an encounter that was actually telegraphed can be missed. This
  // prevents phantom penalties after a seek, a saved jump or a skipped zone.
  if (dist < -win.good && dist > -480 && g.streetCued.has(key)) {
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
  // Completing a named combo at the encounter earns a special technique
  // outcome. Ordinary presses have one signposted move and learned fallbacks.
  const technique = g.lastTechnique && g.now - g.lastTechnique.at < 0.13
    ? open.filter((view) => streetTechnique(view.spec, g.lastTechnique!.name) && Math.abs(view.dist) <= view.win.good)
      .sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist))[0]
    : null;
  if (technique) {
    g.settleStreet(technique.spec, technique.key, technique.dist, technique.win.perfect, "technique", technique.win.good);
    g.lastTechnique = null;
    g.streetPending.clear();
    return;
  }
  const exact = open
    .map((view) => ({ ...view, solution: streetSolution(view.spec, btns) }))
    .filter((view) => view.solution && Math.abs(view.dist) <= view.win.good)
    .sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist))[0];
  // A single-button fallback must not steal a valid two-button primary move.
  // Give a potential chord 90ms to complete, regardless of button order.
  const chordPending = open.some((view) => streetPrefix(view.spec, btns) && Math.abs(view.dist) <= view.win.good);
  if (exact && chordPending && age < 0.09) return;
  if (exact) {
    g.settleStreet(exact.spec, exact.key, exact.dist, exact.win.perfect, exact.solution!, exact.win.good);
    g.streetPending.clear();
    return;
  }
  const waiting = open.some(
    (view) => streetPrefix(view.spec, btns) && view.dist < view.win.telegraph && view.dist > -view.win.good,
  );
  if (waiting && age < 0.09) return;
  g.streetPending.clear();
}

export function settleStreet(g: Arcade, spec: StreetSpec, key: string, dist: number, perfectPx: number,
  quality: StreetQuality = "main", goodPx = perfectPx * 1.85) {
  const kind = Math.abs(dist) <= perfectPx ? "perfect" : "good";
  // A controlled late dodge is a close call, not a random payout for misses.
  const closeCall = !spec.body && dist < -perfectPx && Math.abs(dist) >= goodPx * 0.8 && Math.abs(dist) <= goodPx;
  g.refundRecent(); // A button and its street encounter must never pay twice.
  const previousLevel = g.flowState.level;
  g.flowState = flowHit(g.flowState);
  g.streetMarks.set(key, { kind, at: g.now });
  if (kind === "perfect") g.streetPerfect += 1;
  else g.streetGood += 1;
  const variety = [1, 1.1, 1.4, 1.8][Math.min(3, new Set(g.recent).size)] ?? 1;
  const mult = g.bonus ? BONUS_MULT : 1;
  const execution = quality === "technique" ? 1.5 : quality === "alternative" ? 0.72 : 1;
  const points = pointsFor((kind === "perfect" ? spec.scorePerfect : spec.scoreGood) * variety * mult *
    flowMultiplier(g.flowState) * execution * (closeCall ? 1.35 : 1));
  g.score += points;
  if (!g.bonus) g.lapHits += 1;
  g.meter = Math.min(1, g.meter + (kind === "perfect" ? 0.07 : 0.04));
  g.callout = closeCall ? "CLOSE CALL!" : quality === "technique" ? "SIGNATURE TECHNIQUE!" :
    g.flowState.level > previousLevel ? flowName(g.flowState.level) : mult > 1 ? `${spec.feedback} ×${mult}` : spec.feedback;
  g.announce(`${kind === "perfect" ? "Perfect" : "Good"}: ${spec.feedback.toLowerCase()}${mult > 1 ? `, times ${mult}` : ""}`);
  g.calloutLife = 1.05;
  g.popups.push({
    text: `+${points}`,
    life: 0.85,
    x: g.mossX() + 18,
    y: GROUND - 108,
    gold: kind === "perfect",
  });
  if (kind === "perfect" || closeCall || quality === "technique") g.groove.perfect();
  else g.groove.combo();
  if (closeCall || quality === "technique") {
    g.burst("sparks", g.mossX() + 12, GROUND - 56);
    g.shake = Math.max(g.shake, 0.13);
  }
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
