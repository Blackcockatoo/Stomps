import type { Arcade } from "../arcade";
import type { Btn } from "../arcade-types";
import { gradeAt, zoneSample } from "../route";
import { cycleOf } from "../scenery";
import { MOSS_X } from "./types";

/**
 * Debug/test probe on window.__moss. Only installed in development (localhost)
 * or when the page URL carries ?debug, and built once: snapshot fields are
 * live getters, so nothing is allocated per frame.
 */
export function installProbe(g: Arcade) {
  if (!debugEnabled()) return;
  const self = g;
  const probe = {
    get mode() { return self.mode; },
    get runKind() { return self.runKind; },
    /** Street School progress, or null outside the lesson. */
    get school() { return self.school ? { step: self.school.state.index, finished: self.school.state.finished, cues: self.school.cues.length } : null; },
    get score() { return self.score; },
    get meter() { return self.meter; },
    get clip() { return self.currentClip(); },
    get frame() { return self.frame; },
    get callout() { return self.callout; },
    get ready() { return self.ready; },
    get quakeLock() { return self.quakeLock; },
    get held() { return [...self.keys]; },
    get downAt() { return Object.fromEntries([...self.downAt].map(([key, time]) => [key, Number(time.toFixed(3))])); },
    get now() { return Number(self.now.toFixed(3)); },
    /** "recorded" while the soundtrack file is playing, "loading" before it decodes, else "synth". */
    get soundtrack() { return self.groove.recorded ? "recorded" : self.groove.trackUrl && !self.groove.track ? "loading" : "synth"; },
    /** Visible slice of the 480-wide playfield; narrower than full on portrait phones (canvas cropped). */
    get view() { return { ...self.view }; },
    press: (btn: Btn) => {
      g.down(btn);
      window.setTimeout(() => g.up(btn), 90);
    },
    hold: (btn: Btn, down: boolean) => (down ? g.down(btn) : g.up(btn)),
    state: () => ({
      mode: g.mode,
      runKind: g.runKind,
      score: g.score,
      meter: Number(g.meter.toFixed(3)),
      clip: g.currentClip(),
      frame: g.frame,
      callout: g.callout,
      ready: g.ready,
      faceLeft: g.faceLeft,
      streak: g.streak,
      quakeLock: Number(g.quakeLock.toFixed(3)),
      held: [...g.keys],
      zone: zoneSample(g.scroll + MOSS_X).zone.id,
      phase: gradeAt(cycleOf(g.now)).phase,
      streetPerfect: g.streetPerfect,
      streetGood: g.streetGood,
      streetMiss: g.streetMiss,
      flowLevel: g.flowState.level,
      flowChain: g.flowState.chain,
      flowPeak: g.flowState.peak,
      recovering: g.flowState.recoveryUntil > g.now,
      scroll: Math.round(g.scroll),
      flow: Number(g.flow.toFixed(2)),
      simulationHz: 120,
    }),
    seek: (px: number) => {
      g.scroll = Math.max(0, px);
    },
    seekTime: (seconds: number) => {
      g.now = Math.max(0, seconds);
    },
  };
  g.probe = probe;
  (window as unknown as { __moss?: unknown }).__moss = probe;
}

export function removeProbe(g: Arcade) {
  if (!g.probe || typeof window === "undefined") return;
  const w = window as unknown as { __moss?: unknown };
  if (w.__moss === g.probe) delete w.__moss;
  g.probe = null;
}

/** Debug tooling: localhost dev builds, or any build opened with ?debug. */
export function debugEnabled(): boolean {
  try {
    if (typeof window === "undefined" || !window.location) return false;
    const { hostname, search } = window.location;
    if (new URLSearchParams(search).has("debug")) return true;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}
