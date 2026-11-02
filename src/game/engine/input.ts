/** Button handling for Street Strut: chords, single actions and buffered input. Rhythm presses route to rhythm.ts. */
import type { Arcade } from "../arcade";
import type { Btn } from "../arcade-types";
import { ANIM } from "../clips";
import { COMBOS, tailMatch } from "./combos";
import { GROUND } from "./types";
import { canRecover, flowRecover } from "./flow";
import type { Step } from "./types";

/** Gameplay registers now; only presentation waits for committed animation. */
function action(g: Arcade, steps: Step[]) {
  if (ANIM[g.currentClip()].lock) {
    g.bufferedSteps = steps;
    g.bufferAt = g.now;
  } else g.play(steps);
}

export function down(g: Arcade, btn: Btn) {
  if (!g.ready || g.mode === "pause" || g.mode === "menu" || g.mode === "result") return;
  g.groove.unlock();
  if (g.keys.has(btn)) return;
  g.keys.add(btn);
  g.downAt.set(btn, g.now);
  if (g.mode === "rhythm") {
    g.rhythmDown(btn);
    return;
  }
  g.streetPending.set(btn, g.now);
  if (g.chordCheck()) {
    g.flushStreet();
    return;
  }
  g.commitSingle(btn);
  g.flushStreet();
}

export function up(g: Arcade, btn: Btn) {
  g.keys.delete(btn);
  if (g.mode === "rhythm") g.rhythmUp(btn);
}

export function chordCheck(g: Arcade) {
  const held = g.keys;
  const times = [...held].map((key) => g.downAt.get(key) ?? g.now);
  const span = times.length ? Math.max(...times) - Math.min(...times) : 99;
  const simultaneous = span <= 0.09;
  if (held.has("A") && held.has("B") && held.has("C") && simultaneous) {
    if (g.meter < 1) {
      g.callout = "NEED MORE STYLE";
      g.calloutLife = 0.7;
      g.announce("Need more style");
      return true;
    }
    g.refundRecent();
    if (g.meter < 1) g.meter = 1;
    g.doQuake(false);
    return true;
  }
  if (held.has("B") && held.has("C") && !held.has("A") && simultaneous) {
    g.refundRecent();
    g.seq = [];
    action(g, [{ clip: "spin", speed: 1.2, once: true, flip: false }]);
    g.burst("spin", g.mossX(), GROUND - 36);
    g.burst("dust", g.mossX() + 6, GROUND);
    g.award("SPIN STOMP", 350, 0.12, true);
    g.announce("Spin stomp");
    g.groove.combo();
    g.shake = Math.max(g.shake, 0.16);
    return true;
  }
  return false;
}

export function commitSingle(g: Arcade, btn: Btn) {
  const contested = g.streetViews().some((v) => !g.streetMarks.has(v.key) && Math.abs(v.dist) <= v.win.good);
  if (g.runKind !== "practice" && !contested && canRecover(g.flowState, g.now, g.beatJudge())) {
    g.flowState = flowRecover(g.flowState, g.now, g.beatJudge());
    // Recovery restores control, never awards points for making a mistake.
    g.callout = "FLOW RECOVERED";
    g.calloutLife = 0.9;
    g.announce("Flow recovered");
    g.groove.combo();
  }
  g.seq.push({ btn, t: g.now });
  g.seq = g.seq.filter((s) => g.now - s.t < 2.6);
  const found = COMBOS.find((combo) => tailMatch(g.seq, combo.keys));
  if (found) {
    g.seq = [];
    g.hooks.onPractice?.(found.name);
    g.lastTechnique = { name: found.name, at: g.now };
    g.refundRecent();
    action(g, found.steps);
    if (found.name === "HEEL-TOE HAMMER" || found.name === "DOUBLE TROUBLE" || found.name === "FRANKSTON SHUFFLE") {
      g.burst("dust", g.mossX() + 4, GROUND);
      g.burst("impact", g.mossX(), GROUND - 6);
    }
    if (found.name === "ROYAL SWAGGER" || found.name === "STREET CORONATION") {
      g.burst("sparks", g.mossX() + 14, GROUND - 70);
    }
    if (found.name === "FRANKSTON SHUFFLE") g.burst("dust", g.mossX() + 20, GROUND - 4);
    g.award(found.name, found.bonus, found.meter, true);
    g.announce(`Combo: ${found.name.toLowerCase()}`);
    g.groove.combo();
    g.shake = Math.max(g.shake, 0.12);
    return;
  }
  if (btn === "A") {
    action(g, [{ clip: "strut", speed: 1.35, once: false, flip: g.faceLeft }]);
    g.burst("dust", g.mossX() + 4, GROUND);
  } else if (btn === "B") {
    action(g, [{ clip: "stomp", speed: 1, once: true, flip: false }]);
    g.burst("dust", g.mossX() + 2, GROUND);

  } else {
    action(g, [{ clip: "style", speed: 1, once: true, flip: false }]);
    g.burst("sparks", g.mossX() + 16, GROUND - 68);
    g.groove.style();
  }
  g.award(btn === "A" ? "STRIDE" : btn === "B" ? "STOMP" : "STYLE", btn === "A" ? 70 : 110, 0.045, false);
}
