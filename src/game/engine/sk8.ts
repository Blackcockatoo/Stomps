/**
 * SK8 STOMP glue (P5): street toys, the board ride, the rival skater, stage
 * trick lists and hidden lines. Rules live in ../sk8 and ../stompables (pure);
 * this module owns the live state on the Arcade and turns outcomes into score,
 * callouts, sound, announcements and school events.
 */
import type { Arcade } from "../arcade";
import type { Btn } from "../arcade-types";
import { ANIM } from "../clips";
import { pointsFor } from "../feel";
import { ROUTE_PX, ZONES, zoneSample, type ZoneId } from "../route";
import * as K from "../sk8";
import * as S from "../stompables";
import { GROUND } from "./types";

export type Flyer = { kind: "coin" | "rubbish" | "feather" | "drop"; x: number; y: number; vx: number; vy: number; life: number; max: number; tone: number };

export type RivalRun = {
  lap: number;
  zone: ZoneId;
  startBeat: number;
  plan: [Btn[], Btn[]];
  marks: K.RivalMark[][];
  done: boolean;
  doneAt: number;
  result: K.RivalResult | null;
  /** Last call beat the rival has performed (for his trick animation + sound). */
  shownBeat: number;
  /** His latest trick: button and engine time. */
  trick: { btn: Btn; at: number } | null;
};

export type TrickAnim = { id: K.TrickId | "pop" | "bail"; grade: K.Grade | null; at: number };

export type P5 = {
  sk8: K.Sk8;
  stomps: Map<string, S.StompRun>;
  /** Key of the board prop being ridden. */
  rideKey: string | null;
  trick: TrickAnim | null;
  buffUntil: number;
  /** Tags per `${lap}:${zone}` for trick lists and hidden lines. */
  tags: Map<string, S.Tag[]>;
  challenges: Set<string>;
  lines: Set<string>;
  rival: RivalRun | null;
  rivalSeen: Set<number>;
  rivalWins: number;
  rivalPlayed: number;
  flyers: Flyer[];
  /** When the last ride ended, and how (for the HUD's fade-out). */
  landedAt: number;
  lastBank: number;
  lastLinks: K.Link[];
  lastBailed: boolean;
  /** Street School's own board. */
  school: S.StompRun[];
  schoolSerial: number;
  pops: number;
  squirts: number;
};

export function newP5(): P5 {
  return {
    sk8: K.newSk8(), stomps: new Map(), rideKey: null, trick: null, buffUntil: 0, tags: new Map(), challenges: new Set(),
    lines: new Set(), rival: null, rivalSeen: new Set(), rivalWins: 0, rivalPlayed: 0, flyers: [], landedAt: -99, lastBank: 0,
    lastLinks: [], lastBailed: false, school: [], schoolSerial: 0, pops: 0, squirts: 0,
  };
}

export type StompView = { run: S.StompRun; x: number; dist: number };

function propsLive(g: Arcade) {
  return g.runKind !== "practice" && !g.bonus;
}

/** Live stompable props near Moss (created lazily per lap). */
export function stompViews(g: Arcade): StompView[] {
  if (!propsLive(g)) return [];
  const moss = g.mossWorld();
  const views: StompView[] = [];
  if (g.runKind === "school" && g.mode !== "menu") {
    for (const run of g.p5.school) {
      const x = S.runX(run, g.now);
      views.push({ run, x, dist: x - moss });
    }
    return views;
  }
  const lap = Math.floor(moss / ROUTE_PX);
  for (const spec of S.STOMPABLES) {
    const local = S.stompX(spec);
    for (const lapK of [lap - 1, lap, lap + 1]) {
      if (lapK < 0) continue;
      const world = local + lapK * ROUTE_PX;
      if (world - moss > 900 || world - moss < -900) continue;
      const key = `${spec.uid}:${lapK}`;
      let run = g.p5.stomps.get(key);
      if (!run) {
        run = S.newRun(key, spec.kind, world, spec.len ?? 0);
        g.p5.stomps.set(key, run);
      }
      const x = S.runX(run, g.now);
      views.push({ run, x, dist: x - moss });
    }
  }
  return views;
}

export function riding(g: Arcade) {
  return !!g.p5.sk8.ride || !!(g.p5.rival && !g.p5.rival.done);
}

/** Ground speed override while on a board (null = normal strut speeds). */
export function rideSpeed(g: Arcade): number | null {
  if (g.p5.rival && !g.p5.rival.done) return 74;
  if (g.p5.sk8.ride) return 112;
  return null;
}

function contested(g: Arcade) {
  return g.streetViews().some((v) => !g.streetMarks.has(v.key) && Math.abs(v.dist) <= v.win.good);
}

function timingNow(g: Arcade): { timing: K.Timing; beat: number } {
  return { timing: K.gradeOf(g.beatJudge()), beat: K.nearestBeat(g.songTime(), g.groove.beatDur) };
}

export function buffMult(g: Arcade) {
  return g.p5.buffUntil > g.now ? S.BUFF_MULT : 1;
}

function clipFree(g: Arcade) {
  return !ANIM[g.currentClip()].lock;
}

/**
 * A press in Street Strut. Returns true when the board, the rival or a prop
 * used it. Riding into a live street encounter returns false so the encounter
 * is judged as usual (the caller then skips Moss's free moves).
 */
export function sk8Down(g: Arcade, btn: Btn): boolean {
  if (g.mode !== "strut" || !propsLive(g)) return false;
  const { timing, beat } = timingNow(g);
  const rival = g.p5.rival;
  if (rival && !rival.done) {
    rivalTap(g, rival, btn, timing, beat);
    return true;
  }
  if (g.p5.sk8.ride) {
    if (contested(g)) return false;
    const out = K.rideTap(g.p5.sk8, btn, timing, g.now, beat);
    if (out.kind === "bail") doBail(g, "OFF THE BEAT", out);
    else if (out.kind === "trick") showTrick(g, out.link, out.mult);
    return true;
  }
  if (contested(g)) return false;
  const views = stompViews(g)
    .filter((v) => S.inReach(v.run, v.dist))
    .sort((a, b) => rank(a) - rank(b));
  for (const view of views) {
    const res = S.stompProp(view.run, btn, timing, g.now, beat);
    if (!res) continue;
    applyResult(g, view.run, res, view.x);
    return true;
  }
  return false;
}

/** Props already in play (paying meters, rolling trolleys, open lids) take a press first. */
function rank(v: StompView) {
  const busy = v.run.state === "paying" || v.run.state === "rolling" || v.run.state === "open";
  return (busy ? 0 : 1000) + Math.abs(v.dist);
}

export function sk8Up(g: Arcade, btn: Btn) {
  if (g.mode !== "strut" || !g.p5.sk8.ride) return;
  const { timing } = timingNow(g);
  const out = K.rideRelease(g.p5.sk8, btn, timing, g.now, S.surfaceAt(g.mossWorld()));
  if (out.kind === "trick") showTrick(g, out.link, out.mult);
}

function showTrick(g: Arcade, link: K.Link, mult: number) {
  g.p5.trick = { id: link.id, grade: link.grade, at: g.now };
  g.callout = `${link.name} ${link.grade}`;
  g.calloutLife = 0.7;
  if (link.special) {
    g.groove.perfect();
    g.burst("sparks", g.mossX() + 6, GROUND - 30);
    g.shake = Math.max(g.shake, 0.1);
  } else g.groove.style();
  if (link.id === "grind" || link.id === "railgrind") g.burst("sparks", g.mossX(), GROUND - 4);
  g.announce(`${link.name.toLowerCase()}, ${link.grade.toLowerCase()}. Chain times ${mult}`);
}

/** Lose the chain: the board shoots off ahead and can be stomped again. */
export function doBail(g: Arcade, why: string, done?: K.TapOutcome) {
  const out = done ?? K.bail(g.p5.sk8);
  if (out.kind !== "bail") return;
  const board = findRun(g, g.p5.rideKey);
  if (board) {
    board.world = g.mossWorld() + S.SQUIRT_PX;
    board.state = "loose";
    board.at = g.now;
  }
  g.p5.rideKey = null;
  g.p5.trick = { id: "bail", grade: null, at: g.now };
  g.p5.landedAt = g.now;
  g.p5.lastBailed = true;
  g.p5.lastLinks = out.links;
  g.p5.lastBank = 0;
  if (g.currentClip() !== "quake") g.play([{ clip: "stumble", speed: 1.2, once: true, flip: false }]);
  g.groove.miss();
  g.callout = out.links.length ? `BAILED! CHAIN LOST (${why})` : `BAILED (${why})`;
  g.calloutLife = 1.1;
  g.announce(`Bailed, ${why.toLowerCase()}. Chain lost. The board shot ahead: stomp it on the beat to ride again.`);
  g.schoolEvent({ type: "bail" });
}

function findRun(g: Arcade, key: string | null) {
  if (!key) return null;
  return g.p5.stomps.get(key) ?? g.p5.school.find((run) => run.key === key) ?? null;
}

export function landRide(g: Arcade) {
  const { value, links } = K.land(g.p5.sk8, buffMult(g));
  const board = findRun(g, g.p5.rideKey);
  if (board) {
    board.state = "gone";
    board.at = g.now;
  }
  g.p5.rideKey = null;
  g.p5.landedAt = g.now;
  g.p5.lastBailed = false;
  g.p5.lastLinks = links;
  if (g.currentClip() === "idle" || g.currentClip() === "style") g.play([{ clip: "strut", speed: 1, once: false, flip: false }]);
  if (!links.length) {
    g.p5.lastBank = 0;
    g.callout = "ROLLED IT OUT";
    g.calloutLife = 0.8;
    g.schoolEvent({ type: "ride", tricks: 0 });
    return;
  }
  const points = pointsFor(value);
  g.p5.lastBank = points;
  g.score += points;
  g.meter = Math.min(1, g.meter + Math.min(0.2, 0.03 * links.length));
  g.popups.push({ text: `+${points}`, life: 1, x: g.mossX() + 14, y: GROUND - 118, gold: true });
  g.callout = `LANDED ×${K.chainMult(links.length)} · ${links.length} TRICK${links.length > 1 ? "S" : ""}`;
  g.calloutLife = 1.2;
  g.groove.combo();
  g.burst("dust", g.mossX() + 4, GROUND);
  g.announce(`Landed a ${links.length} trick chain for ${points} points.`);
  addTags(g, S.rideTags(links.map((link) => link.id)));
  g.schoolEvent({ type: "ride", tricks: links.length });
}

function applyResult(g: Arcade, run: S.StompRun, res: S.StompResult, x: number) {
  if (!res.label) return; // e.g. a second press on the same beat: swallowed, nothing happens
  const points = res.points > 0 ? pointsFor(res.points * buffMult(g)) : 0;
  g.score += points;
  if (res.good) g.meter = Math.min(1, g.meter + 0.03);
  g.callout = res.grade && points > 0 ? `${res.label} ${res.grade}` : res.label;
  g.calloutLife = 0.95;
  if (points > 0) g.popups.push({ text: `+${points}`, life: 0.9, x: g.mossX() + 18, y: GROUND - 108, gold: res.grade === "PERFECT" });
  g.announce(`${res.label.toLowerCase()}${res.grade ? `, ${res.grade.toLowerCase()}` : ""}`);
  if (!res.good) g.groove.miss();
  else if (res.grade === "PERFECT") g.groove.perfect();
  else g.groove.stomp();
  if (clipFree(g) && !res.ride) g.play([{ clip: "stomp", speed: 1.15, once: true, flip: false }]);
  g.burst("dust", g.mossX() + 2, GROUND);
  const screen = x - g.routeScroll();
  if (res.coin) spawn(g, "coin", screen, GROUND - 40, 2 + Math.min(4, res.coin));
  if (res.tags.includes("wheelie:launch")) spawn(g, "rubbish", screen, GROUND - 36, 7);
  if (res.tags.includes("pigeons:flight")) spawn(g, "feather", screen, GROUND - 14, 8);
  if (res.buff) {
    g.p5.buffUntil = g.now + res.buff;
    spawn(g, "drop", screen, GROUND - 10, 10);
  }
  if (run.kind === "board") {
    if (res.ride) {
      g.p5.pops += 1;
      K.startRide(g.p5.sk8, g.now, g.groove.beatDur, res.ride);
      g.p5.rideKey = run.key;
      g.p5.trick = { id: "pop", grade: res.ride, at: g.now };
      g.p5.landedAt = -99;
      g.play([{ clip: "idle", speed: 1, once: false, flip: false }]);
      g.announce(`Riding. Tap on each beat to flip the board. Off the beat bails.`);
    } else g.p5.squirts += 1;
  }
  if (res.tags.length) addTags(g, res.tags);
  if (res.knock) {
    for (const view of stompViews(g)) {
      if (view.run.kind !== "wheelie" || view.x < x || view.x - x > 420) continue;
      const knocked = S.knockWheelie(view.run, g.now);
      if (knocked) {
        applyResult(g, view.run, knocked, view.x);
        break;
      }
    }
  }
}

function spawn(g: Arcade, kind: Flyer["kind"], x: number, y: number, n: number) {
  if (g.reducedMotion) return;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / Math.max(1, n - 1) - 0.5) * 1.6;
    const speed = kind === "drop" ? 60 : 70 + (i % 3) * 22;
    g.p5.flyers.push({ kind, x, y, vx: Math.cos(a) * speed + (kind === "coin" ? -40 : 0), vy: Math.sin(a) * speed, life: 0.9, max: 0.9, tone: i % 3 });
  }
  if (g.p5.flyers.length > 64) g.p5.flyers.splice(0, g.p5.flyers.length - 64);
}

/** Records tags against the current stage, ticking trick lists and hidden lines. */
export function addTags(g: Arcade, tags: S.Tag[], zoneOverride?: ZoneId, lapOverride?: number) {
  if (g.runKind === "school") return;
  const moss = g.mossWorld();
  const zone = zoneOverride ?? zoneSample(moss).zone.id;
  const lap = lapOverride ?? Math.floor(moss / ROUTE_PX);
  const key = `${lap}:${zone}`;
  const seen = g.p5.tags.get(key) ?? [];
  seen.push(...tags);
  g.p5.tags.set(key, seen);
  const challenge = S.challengeFor(zone);
  if (challenge && !g.p5.challenges.has(key) && S.inOrder(seen, challenge.tags)) {
    g.p5.challenges.add(key);
    g.callout = `TRICK LIST ✓ ${challenge.text}`;
    g.calloutLife = 1.5;
    g.groove.perfect();
    g.announce(`Trick list done: ${challenge.text.toLowerCase()}`);
  }
  for (const line of S.LINES) {
    if (line.zone !== zone) continue;
    const id = `${lap}:${line.name}`;
    if (g.p5.lines.has(id) || !S.inOrder(seen, line.tags)) continue;
    g.p5.lines.add(id);
    const bonus = pointsFor(600 * buffMult(g));
    g.score += bonus;
    g.popups.push({ text: `+${bonus}`, life: 1.1, x: g.mossX() + 10, y: GROUND - 140, gold: true });
    g.callout = `SECRET LINE: ${line.name}!`;
    g.calloutLife = 1.8;
    g.flash = Math.max(g.flash, 0.3);
    g.groove.perfect();
    g.announce(`Secret line found: ${line.name.toLowerCase()}`);
  }
}

/** Trick-list chip for the current stage. */
export function trickChip(g: Arcade, zone: string): { text: string; short: string; done: boolean } | null {
  if (g.runKind !== "free" && g.runKind !== "route") return null;
  const challenge = S.challengeFor(zone);
  if (!challenge) return null;
  const lap = Math.floor(g.mossWorld() / ROUTE_PX);
  const key = `${lap}:${zone}`;
  const done = g.p5.challenges.has(key);
  const n = S.inOrderCount(g.p5.tags.get(key) ?? [], challenge.tags);
  const progress = challenge.tags.length > 1 && !done ? ` ${n}/${challenge.tags.length}` : "";
  return { text: `${challenge.text}${progress}`, short: `${challenge.short}${progress}`, done };
}

// ── Rival skater ─────────────────────────────────────────────────────────

const HOME = ZONES.find((z) => z.id === "caravan_return")!;

function startRival(g: Arcade, lap: number) {
  if (g.p5.sk8.ride) landRide(g);
  const bd = g.groove.beatDur;
  const beat = Math.floor(g.songTime() / bd);
  const startBeat = Math.ceil((beat + 3) / 4) * 4;
  g.p5.rival = {
    lap, zone: "caravan_return", startBeat, plan: K.rivalPlan(g.runSeed + lap),
    marks: [[null, null, null, null], [null, null, null, null]], done: false, doneAt: 0, result: null, shownBeat: -1, trick: null,
  };
  g.p5.rivalPlayed += 1;
  g.play([{ clip: "idle", speed: 1, once: false, flip: false }]);
  g.callout = "RIVAL SKATER! WATCH, THEN MATCH";
  g.calloutLife = 1.8;
  g.groove.combo();
  g.announce("A rival skater rolls up. He plays four tricks, one per beat. Then you answer the same buttons on the same beats. Two rounds.");
}

function rivalTap(g: Arcade, rival: RivalRun, btn: Btn, timing: K.Timing, beat: number) {
  const ph = K.rivalPhase(rival.startBeat, beat);
  if (ph.phase !== "response") {
    g.callout = ph.phase === "call" ? "WATCH HIS LINE…" : "GET READY…";
    g.calloutLife = 0.4;
    return;
  }
  const marks = rival.marks[ph.bar]!;
  if (marks[ph.slot] !== null) return;
  const want = rival.plan[ph.bar]![ph.slot]!;
  const mark: K.RivalMark = timing === "MISS" ? "MISS" : btn === want ? timing : "WRONG";
  marks[ph.slot] = mark;
  if (mark === "WRONG" || mark === "MISS") {
    g.callout = mark === "WRONG" ? "WRONG TRICK" : "OFF THE BEAT";
    g.calloutLife = 0.5;
    g.groove.miss();
    g.announce(mark === "WRONG" ? "Wrong trick" : "Off the beat");
    return;
  }
  g.p5.trick = { id: K.BTN_TRICK[btn], grade: mark, at: g.now };
  g.callout = `${K.TRICKS[K.BTN_TRICK[btn]].name} ${mark}`;
  g.calloutLife = 0.5;
  if (mark === "PERFECT") g.groove.perfect();
  else g.groove.style();
  g.announce(`${mark.toLowerCase()}`);
}

function tickRival(g: Arcade, rival: RivalRun) {
  const bd = g.groove.beatDur;
  const t = g.songTime();
  const beat = Math.floor(t / bd + 0.02);
  if (!rival.done) {
    const ph = K.rivalPhase(rival.startBeat, beat);
    if (ph.phase === "call" && beat !== rival.shownBeat) {
      rival.shownBeat = beat;
      rival.trick = { btn: rival.plan[ph.bar]![ph.slot]!, at: g.now };
      g.groove.style();
      if (ph.slot === 0) {
        g.callout = ph.bar === 0 ? "HIS LINE…" : "ROUND TWO. HARDER…";
        g.calloutLife = 0.9;
      }
    }
    if (ph.phase === "response" && ph.slot === 0 && beat !== rival.shownBeat) {
      rival.shownBeat = beat;
      g.callout = "YOUR TURN!";
      g.calloutLife = 0.6;
    }
    for (let bar = 0; bar < 2; bar++) {
      for (let slot = 0; slot < 4; slot++) {
        if (rival.marks[bar]![slot] !== null) continue;
        if (t > K.responseBeat(rival.startBeat, bar, slot) * bd + 0.2) rival.marks[bar]![slot] = "MISS";
      }
    }
    if (t > (rival.startBeat + 16) * bd + 0.2) finishRival(g, rival);
  } else if (g.now - rival.doneAt > 1.6) {
    g.p5.rival = null;
  }
}

function finishRival(g: Arcade, rival: RivalRun) {
  const result = K.rivalScore(rival.marks);
  rival.result = result;
  rival.done = true;
  rival.doneAt = g.now;
  const points = pointsFor(result.points * buffMult(g));
  g.score += points;
  if (points > 0) g.popups.push({ text: `+${points}`, life: 1.2, x: g.mossX() + 10, y: GROUND - 120, gold: result.win });
  g.callout = result.win ? (result.outTricked ? "OUT-TRICKED HIM!" : "RIVAL SCHOOLED!") : `RIVAL WINS ${result.matched}/${result.total}`;
  g.calloutLife = 1.8;
  if (result.win) {
    g.p5.rivalWins += 1;
    g.groove.perfect();
    g.flash = Math.max(g.flash, 0.35);
    addTags(g, ["rival:win"], rival.zone, rival.lap);
  } else g.groove.miss();
  g.announce(`${result.win ? "You beat the rival" : "The rival wins"}: ${result.matched} of ${result.total} beats matched, ${points} points.`);
  if (g.currentClip() === "idle" || g.currentClip() === "style") g.play([{ clip: "strut", speed: 1, once: false, flip: false }]);
}

/** Route finish waits for a rival meeting in progress. */
export function holdFinish(g: Arcade) {
  return !!(g.p5.rival && !g.p5.rival.done);
}

// ── Tick ─────────────────────────────────────────────────────────────────

export function tickSk8(g: Arcade, dt: number) {
  if (!propsLive(g)) {
    if (g.p5.sk8.ride) landRide(g);
    return;
  }
  const bd = g.groove.beatDur;
  const beat = Math.floor(g.songTime() / bd);
  const ride = g.p5.sk8.ride;
  if (ride && g.now >= ride.endsAt) landRide(g);
  for (const view of stompViews(g)) S.tickProp(view.run, g.now, beat, bd);
  if (g.runKind === "school") tickSchoolBoard(g);
  else if (g.runKind === "route" || g.runKind === "free") {
    const moss = g.mossWorld();
    const lap = Math.floor(moss / ROUTE_PX);
    const local = moss - lap * ROUTE_PX;
    if (!g.p5.rival && !g.p5.rivalSeen.has(lap) && local >= HOME.start + 40 && local < HOME.start + 400) {
      g.p5.rivalSeen.add(lap);
      startRival(g, lap);
    }
  }
  if (g.p5.rival) tickRival(g, g.p5.rival);
  for (const f of g.p5.flyers) {
    f.life -= dt;
    f.vy += (f.kind === "feather" ? 30 : 260) * dt;
    if (f.kind === "feather") f.vx *= 1 - dt * 1.5;
    f.x += (f.vx - g.flow) * dt;
    f.y += f.vy * dt;
  }
  g.p5.flyers = g.p5.flyers.filter((f) => f.life > 0);
  // Forget props well behind Moss.
  const moss = g.mossWorld();
  for (const [key, run] of g.p5.stomps) {
    if (key !== g.p5.rideKey && run.world < moss - 1600) g.p5.stomps.delete(key);
  }
}

/** Street School's board lesson: keep one board ahead of Moss until the step is cleared. */
function tickSchoolBoard(g: Arcade) {
  const step = g.school ? g.schoolStepId() : null;
  if (step !== "board") {
    if (g.p5.school.length && !g.p5.sk8.ride) g.p5.school = [];
    return;
  }
  const moss = g.mossWorld();
  const live = g.p5.school.some((run) => run.state === "idle" || run.state === "loose" || run.state === "riding");
  if (!live && !g.p5.sk8.ride) {
    g.p5.schoolSerial += 1;
    g.p5.school = [S.newRun(`school-board-${g.p5.schoolSerial}`, "board", moss + 330)];
  }
  // A loose board that slipped behind is put back ahead so the lesson never stalls.
  for (const run of g.p5.school) {
    if (run.state === "loose" && run.world - moss < -60) {
      run.world = moss + 260;
    }
  }
}
