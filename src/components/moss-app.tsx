import { styleRank } from "@/game/feel";
import { flowName } from "@/game/engine/flow";
import { useEffect, useRef, useState } from "react";
import { positionX, visibleSpan } from "@/game/view";
import { Arcade, COMBOS, CALIBRATION_MIN_TAPS, CALIBRATION_WARMUP, type Btn, type Calibration, type Mode, type ResultStats, type LiveHud } from "@/game/arcade";
import { ANIM, CELL, LAB_CLIPS, PHASE1_STRUT, STAGE_CONCEPTS, UI, type ClipId, type ClipInfo } from "@/game/clips";
import { ROUTE_CARDS } from "@/game/route";
import { PROMO } from "@/game/promo";
import { nearest, type Box, type NavDir } from "@/game/menu-nav";
import { LANGS, LANG_LABEL, MENU_COPY, detectLang, saveLang, type Lang } from "@/game/i18n";
import type { PadAction } from "@/game/engine/gamepad";
import { REPORT } from "@/game/report";
import { RESERVED_CODES, codeLabel, keyBtn, keyLabel, keysLabel, rebind } from "@/game/keys";
import { DEFAULT_KEYS, type KeyMap, type Skin } from "@/game/storage";
import { DIFFICULTIES, DIFFICULTY_INFO, type Difficulty } from "@/game/chart";
import type { SchoolSnapshot } from "@/game/tutorial";

type Panel = "none" | "lab" | "notes" | "hints" | "stages" | "settings" | "rhythm";
type AudioPrefs = { volume: number; muted: boolean };
/** Taps collected per calibration attempt (the first CALIBRATION_WARMUP are ignored). */
const CAL_TAPS = 12;
const ALL: Btn[] = ["A", "B", "C"];
const ARROWS: Record<string, NavDir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

/** Focusable controls in whatever menu surface is up (a panel wins over the card). */
function navTargets(): HTMLElement[] {
  const scope =
    document.querySelector<HTMLElement>(".stage .sheet") ??
    document.querySelector<HTMLElement>(".stage .overlay") ??
    document.querySelector<HTMLElement>(".stage .attract-screen");
  if (!scope) return [];
  return Array.from(scope.querySelectorAll<HTMLElement>("button:not(:disabled), input, select")).filter((el) => el.getClientRects().length > 0);
}

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

/** Arrow keys / D-pad: move focus to the nearest control that way, with a visible cue. */
function moveFocus(dir: NavDir) {
  document.documentElement.dataset.nav = "on";
  const items = navTargets();
  if (!items.length) return;
  const current = document.activeElement;
  const index = current instanceof HTMLElement ? items.indexOf(current) : -1;
  if (index < 0) {
    items[0]!.focus();
    return;
  }
  const others = items.filter((_, i) => i !== index);
  const pick = nearest(boxOf(current as HTMLElement), others.map(boxOf), dir);
  if (pick < 0) return;
  others[pick]!.focus();
  others[pick]!.scrollIntoView({ block: "nearest", inline: "nearest" });
}

const PADS: { id: Btn; name: string; idle: string; down: string; cls: string }[] = [
  { id: "A", name: "STRIDE", idle: UI.aIdle, down: UI.aDown, cls: "a" },
  { id: "B", name: "STOMP", idle: UI.bIdle, down: UI.bDown, cls: "b" },
  { id: "C", name: "STYLE", idle: UI.cIdle, down: UI.cDown, cls: "c" },
];

export function MossApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const measureRef = useRef<() => void>(() => {});
  const arcadeRef = useRef<Arcade | null>(null);
  const [hud, setHud] = useState<LiveHud>({score:0,meter:0,streak:0,gain:0,serial:0,label:""});
  const [mode, setMode] = useState<Mode>("menu");
  const [scene, setScene] = useState<"strut" | "rhythm">("strut");
  const [panel, setPanel] = useState<Panel>("none");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [held, setHeld] = useState<Record<Btn, boolean>>({ A: false, B: false, C: false });
  const [best, setBest] = useState<{ strut: number; rhythm: number }>({ strut: 0, rhythm: 0 });
  const [routeBest, setRouteBest] = useState(0);
  const [runKind, setRunKind] = useState<"free" | "route" | "practice" | "school">("free");
  const [school, setSchool] = useState<SchoolSnapshot | null>(null);
  const [lesson, setLesson] = useState(0);
  const [landed, setLanded] = useState<string | null>(null);
  const [mastered, setMastered] = useState<string[]>([]);
  const [result, setResult] = useState<ResultStats | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [announcement, setAnnouncement] = useState("");
  const [audio, setAudio] = useState<AudioPrefs>({ volume: 0.8, muted: false });
  const [keymap, setKeymap] = useState<KeyMap>({ ...DEFAULT_KEYS });
  const [offset, setOffset] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [skin, setSkin] = useState<Skin>("classic");
  /** Title screen: shown once per load, dismissed by any tap, key or pad button. */
  const [attract, setAttract] = useState(true);
  const [lang, setLang] = useState<Lang>(() => detectLang());
  const t = MENU_COPY[lang];
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const pickLang = (next: Lang) => { setLang(next); saveLang(next); };
  const uiRef = useRef({ attract: true, panel: "none" as Panel, onPad: (_action: PadAction) => {}, dismiss: () => {}, close: () => {} });
  /** Which action is waiting for a new key (key remap), if any. */
  const [capture, setCapture] = useState<Btn | null>(null);
  const captureRef = useRef<Btn | null>(null);
  captureRef.current = capture;
  const [calTaps, setCalTaps] = useState<number | null>(null);
  const calRef = useRef(false);
  calRef.current = calTaps !== null;
  const [calResult, setCalResult] = useState<Calibration | "short" | null>(null);
  const announceRef = useRef({ last: 0, timer: 0, flip: false });

  /** Screen-reader announcements, coalesced so fast play never floods the queue. */
  const announce = (text: string) => {
    const state = announceRef.current;
    window.clearTimeout(state.timer);
    const wait = Math.max(0, 450 - (performance.now() - state.last));
    state.timer = window.setTimeout(() => {
      state.last = performance.now();
      // Alternate a trailing no-break space so a repeated phrase is still re-read.
      state.flip = !state.flip;
      setAnnouncement(text + (state.flip ? "\u00a0" : ""));
    }, wait);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const arcade = new Arcade(canvas, {
      onMode: (next) => { setMode(next); if (next === "strut" || next === "rhythm") setScene(next); },
      onHud: setHud,
      onRouteBest: setRouteBest,
      onPractice: (name) => { setLanded(name); setMastered((old) => old.includes(name) ? old : [...old, name]); },
      onResult: setResult,
      onReady: () => setReady(true),
      onError: setError,
      onBest: setBest,
      onProgress: (done, total) => setProgress({ done, total }),
      onAnnounce: announce,
      onHeld: (btn, down) => setHeld((prev) => ({ ...prev, [btn]: down })),
      onCalTap: (count) => onCalTap(count),
      onMenuPad: (action) => uiRef.current.onPad(action),
      onSchool: setSchool,
      onSchoolDone: (then) => { setSchool(null); if (then !== "menu") setRunKind(then); },
    });
    arcadeRef.current = arcade;
    const measure = () => {
      const style = getComputedStyle(canvas);
      const box = canvas.getBoundingClientRect();
      const scale = Math.max(box.width / 480, box.height / 270);
      const overflow = Math.max(0, 480 * scale - box.width);
      arcade.setView(visibleSpan(box.width, box.height, style.objectFit, positionX(style.objectPosition, overflow)));
    };
    measureRef.current = measure;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(canvas);
    setAudio({ ...arcade.save.audio });
    setKeymap({ ...arcade.save.keys });
    setOffset(arcade.audioOffset);
    setDifficulty(arcade.difficulty);
    setSkin(arcade.skin);
    arcade.start();
    const onKey = (event: KeyboardEvent) => {
      const waiting = captureRef.current;
      if (waiting) {
        // Key remap capture: the next key binds; Escape cancels.
        if (event.type !== "keydown") return;
        event.preventDefault();
        if (event.code !== "Escape" && !RESERVED_CODES.has(event.code)) {
          arcade.setKeys(rebind(arcade.save.keys, waiting, event.code));
          setKeymap({ ...arcade.save.keys });
        }
        setCapture(null);
        return;
      }
      const btn = keyBtn(event.code);
      if (calRef.current && btn) {
        event.preventDefault();
        if (event.type === "keydown" && !event.repeat) tapCalibration();
        return;
      }
      if (event.type === "keydown" && (arcade.mode === "menu" || arcade.mode === "result")) {
        const ui = uiRef.current;
        if (ui.attract && arcade.mode === "menu" && ui.panel === "none") {
          if (!["Tab", "Shift", "Control", "Alt", "Meta"].includes(event.key)) {
            event.preventDefault();
            ui.dismiss();
          }
          return;
        }
        const dir = ARROWS[event.code];
        const el = document.activeElement;
        if (dir && !(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) {
          event.preventDefault();
          moveFocus(dir);
          return;
        }
        if (event.code === "Escape" && ui.panel !== "none") {
          event.preventDefault();
          ui.close();
          return;
        }
      }
      if (event.type === "keydown") {
        if (event.code === "Escape") {
          event.preventDefault();
          arcade.togglePause();
          return;
        }
        if (!btn || event.repeat) return;
        event.preventDefault();
        arcade.down(btn);
        setHeld((prev) => ({ ...prev, [btn]: true }));
      } else if (btn) {
        arcade.up(btn);
        setHeld((prev) => ({ ...prev, [btn]: false }));
      }
    };
    const release = () => {
      (["A", "B", "C"] as Btn[]).forEach((btn) => arcade.up(btn));
      setHeld({ A: false, B: false, C: false });
    };
    const onVisibility = () => {
      if (document.hidden) {
        release();
        if (arcade.mode === "strut" || arcade.mode === "rhythm") arcade.togglePause();
      }
    };
    const onPointer = () => { delete document.documentElement.dataset.nav; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", release);
    return () => {
      observer?.disconnect();
      window.clearTimeout(announceRef.current.timer);
      arcade.destroy();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", release);
    };
  }, []);

  // Layout (and so the visible slice of the playfield) changes with the mode classes.
  useEffect(() => {
    const frame = requestAnimationFrame(() => measureRef.current());
    return () => cancelAnimationFrame(frame);
  }, [mode, scene]);

  const playing = mode === "strut" || mode === "rhythm" || mode === "pause";
  const loadPct = progress.total ? Math.floor((progress.done / progress.total) * 100) : 0;
  const allKeys = keysLabel(ALL, " + ");

  function tapCalibration() {
    arcadeRef.current?.calibrationTap();
  }

  /** Every recorded tap (any input) lands here; the attempt ends after CAL_TAPS. */
  function onCalTap(count: number) {
    const arcade = arcadeRef.current;
    if (!arcade) return;
    setCalTaps(count);
    if (count >= CAL_TAPS) {
      const measured = arcade.stopCalibration();
      setCalTaps(null);
      setCalResult(measured ?? "short");
      announce(measured ? `Measured ${ms(measured.offset)}` : "Not enough taps");
    }
  }

  function startCalibration() {
    setCalResult(null);
    arcadeRef.current?.startCalibration();
    setCalTaps(0);
  }

  function cancelCalibration() {
    arcadeRef.current?.stopCalibration();
    setCalTaps(null);
  }

  function changeAudio(next: AudioPrefs) {
    arcadeRef.current?.setAudio(next.volume, next.muted);
    setAudio(next);
  }

  function changeOffset(seconds: number) {
    arcadeRef.current?.setAudioOffset(seconds);
    setOffset(arcadeRef.current?.audioOffset ?? 0);
  }

  // autoFocus is skipped while the first tile is still disabled (loading), so land focus once it can take it.
  useEffect(() => {
    if (attract || !ready || mode !== "menu" || panel !== "none") return;
    const active = document.activeElement;
    if (active && active !== document.body && active.closest(".menu-card")) return;
    document.querySelector<HTMLButtonElement>(".menu-card .route-start")?.focus();
  }, [attract, ready, mode, panel]);

  function closePanel() {
    if (calRef.current) cancelCalibration();
    setCapture(null);
    setPanel("none");
  }

  function dismissAttract() {
    arcadeRef.current?.groove.unlock();
    setAttract(false);
  }

  /** Gamepad while a menu is up: D-pad moves focus, A / Start selects, B backs out of a panel. */
  function onMenuPad(action: PadAction) {
    if (attract && mode === "menu" && panel === "none") {
      dismissAttract();
      return;
    }
    if (action === "up" || action === "down" || action === "left" || action === "right") {
      moveFocus(action);
      return;
    }
    if (action === "A" || action === "pause") {
      const el = document.activeElement;
      if (el instanceof HTMLButtonElement && el.closest(".stage") && !el.disabled) el.click();
      else {
        document.documentElement.dataset.nav = "on";
        navTargets()[0]?.focus();
      }
      return;
    }
    if (action === "B" && panel !== "none") closePanel();
  }
  uiRef.current = { attract, panel, onPad: onMenuPad, dismiss: dismissAttract, close: closePanel };

  function go(next: "strut" | "rhythm", kind: "free" | "route" | "practice" | "school" = "free", chart: Difficulty = difficulty) {
    const arcade = arcadeRef.current;
    setLanded(null);
    setPanel("none");
    setResult(null);
    // First strut ever (or SCHOOL from the menu): run Street School, then carry on into the pick.
    if (next === "strut" && arcade && (kind === "school" || arcade.needsSchool)) {
      setRunKind("school");
      arcade.playSchool(kind === "school" ? "menu" : kind);
      return;
    }
    setRunKind(kind);
    if (next === "strut") arcade?.playStrut(kind);
    else {
      setDifficulty(chart);
      arcadeRef.current?.playRhythm(chart);
    }
  }

  return (
    <div className={`shell mode-${mode} scene-${scene}`}>
      <header className="cabinet-header"><span><b>B$S</b> / MOSS STOMPER</span><span className="signal">● NEON STRUT / HYPER DRIVE</span></header>
      {playing ? <section className={`live-hud ${hud.meter >= 1 ? "charged" : ""} ${hud.bonus ? "bonus" : ""}`} aria-label="Live score and style">
        <div className="score-block"><span className="hud-label">TOTAL RESPECT{hud.bonus ? <b className="bonus-badge">BONUS ×{hud.bonusMultiplier ?? 2}</b> : null}</span><strong>{hud.score.toLocaleString()}</strong></div>
        <div className="rank-block"><span className="hud-label">{mode === "strut" ? "STREET FLOW" : "STREET STATUS"}</span><strong>{mode === "strut" ? (hud.recovering ? "RECOVER ON BEAT" : flowName(hud.flowLevel ?? 0)) : styleRank(hud.streak)}</strong></div>
        <div className="chain-block"><span className="hud-label">{mode === "strut" ? "FLOW CHAIN" : "ON BEAT"}</span><strong>×{mode === "strut" ? (hud.flowChain ?? 0) : hud.streak}</strong></div>
        <button type="button" className="style-block" disabled={hud.meter < 1 || mode === "pause"} onClick={() => arcadeRef.current?.unleash()} aria-label={hud.meter >= 1 ? "Unleash Mossquake" : "Build style to unlock Mossquake"}>
          <div className="meter-caption"><span>{hud.meter >= 1 ? "MOSSQUAKE / TAP TO UNLEASH" : "QUAKE DRIVE / CHARGE YOUR STYLE"}</span><b>{Math.round(hud.meter*100)}<small>%</small></b></div>
          <div className="style-track" role="progressbar" aria-label="Quake drive" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.meter*100)}><div className="meter-fill" style={{transform:`scaleX(${hud.meter})`}} /><div className="meter-grid" /></div>
          <div className="meter-footer"><span>STRIDE + STOMP + ATTITUDE</span><span>{hud.meter >= 1 ? `${allKeys} / OR TAP` : "KEEP IT VARIED. KEEP IT MOVING."}</span></div>
        </button>
      </section> : null}
      <div className="stage">
        <canvas ref={canvasRef} width={480} height={270} aria-label="Moss Stomper arcade playfield" />
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
        {playing && hud.gain > 0 ? <div key={hud.serial} className={`reward-burst ${hud.gain >= 10000 ? "massive" : ""}`} aria-hidden="true"><span>{hud.gain >= 10000 ? "BLOCK SHAKER" : hud.gain >= 4000 ? "BIG ENERGY" : "RESPECT EARNED"}</span><strong>+{hud.gain.toLocaleString()}</strong><small>{hud.label || "STAY IN THE GROOVE"}</small></div> : null}
        <div className="crt" aria-hidden="true" />
        {playing ? <>
          <div className="portrait-title"><span>B$S / STREET SYSTEMS</span><strong>{mode === "rhythm" ? "FIND YOUR FREQUENCY." : "OWN THE PAVEMENT."}</strong></div>
          <div className={`playguide ${runKind === "practice" || runKind === "school" ? "practice-hidden" : ""}`}><span className="eyebrow">{mode === "rhythm" ? "STAY IN THE POCKET" : "BUILD YOUR SIGNATURE"}</span><p>{mode === "rhythm" ? "Match each note at the line. Hold the long notes. Keep the groove." : `Hold ${keyLabel("A")} to stride. Tap ${keyLabel("B")} to plant it. Add ${keyLabel("C")} for attitude.`}</p><div><span>{keysLabel(["A", "A", "B"], " · ")}<b>HEEL-TOE HAMMER</b></span><span>{keyLabel("B")} ON THE BOARD TAIL<b>SK8 STOMP · FLIP ON THE BEAT</b></span></div><small>{allKeys} / FULL STYLE = MOSSQUAKE</small></div>
        </> : null}
        <div className="topbar">
          {playing ? (
            <>
              <button type="button" className="icon-btn" onClick={() => arcadeRef.current?.togglePause()}>
                {mode === "pause" ? t.go : t.hold}
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  arcadeRef.current?.menu();
                  setResult(null);
                }}
              >
                {t.exit}
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="icon-btn"
            aria-pressed={audio.muted}
            aria-label={audio.muted ? t.unmute : t.mute}
            onClick={() => changeAudio({ ...audio, muted: !audio.muted })}
          >
            {audio.muted ? t.muted : t.sound}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              const root = document.documentElement;
              if (!document.fullscreenElement) void root.requestFullscreen?.().catch(() => {});
              else void document.exitFullscreen?.().catch(() => {});
            }}
          >
            {t.full}
          </button>
        </div>

        {mode === "menu" ? (
          <div className={`menu-hero ${attract ? "attract" : ""}`} aria-hidden="true">
            <picture>
              <source media="(orientation: portrait)" srcSet={PROMO.splash} />
              <img src={PROMO.pier} alt="" />
            </picture>
          </div>
        ) : null}

        {mode === "menu" && panel === "none" && attract ? (
          <div className="attract-screen">
            <h1 className="brand attract-title">
              MOSS STOMPER
              <small>BLUE $NAKE STUDIO · FRANKSTON AFTER HOURS</small>
            </h1>
            <button type="button" className="attract-gate" autoFocus onClick={dismissAttract}>
              <span className="attract-pulse">{t.tapToStart}</span>
              <small>{t.anyKey}</small>
            </button>
            {!ready && !error ? <p className="attract-load" aria-live="polite">{t.loading(loadPct)}</p> : null}
            {error ? <p className="attract-load">{error}</p> : null}
          </div>
        ) : null}

        {mode === "menu" && panel === "none" && !attract ? (
          <div className="overlay menu-card">
            <div>
              <p className="eyebrow">{t.eyebrow}</p>
              <h1 className="brand">
                MOSS STOMPER
                <small>BLUE $NAKE STUDIO</small>
                <em>{t.tagline}</em>
              </h1>
              {!ready && !error ? (
                <div className="load-row">
                  <p className="hint-row">{t.loading(loadPct)}</p>
                  <div className="load-bar" role="progressbar" aria-label="Loading assets" aria-valuemin={0} aria-valuemax={100} aria-valuenow={loadPct}>
                    <div style={{ transform: `scaleX(${loadPct / 100})` }} />
                  </div>
                </div>
              ) : null}
              {error ? <p className="hint-row">{error}</p> : null}
              <div className="mode-row" role="group" aria-label={t.playGroup}>
                <button type="button" className="mode-tile route-start" autoFocus disabled={!ready} onClick={() => go("strut", "route")}>
                  <img src={PROMO.pier} alt="" />
                  <span className="mode-name">THE LONG WAY HOME</span>
                  <small>{t.routeSub}</small>
                  {routeBest ? <b className="best-badge">{t.best} {routeBest.toLocaleString()}</b> : null}
                </button>
                <button type="button" className="mode-tile" disabled={!ready} onClick={() => go("strut")}>
                  <img src={PROMO.strip} alt="" />
                  <span className="mode-name">STREET STRUT</span>
                  <small>{t.strutSub}</small>
                  {best.strut ? <b className="best-badge">{t.best} {best.strut.toLocaleString()}</b> : null}
                </button>
                <button type="button" className="mode-tile gold" disabled={!ready} onClick={() => setPanel("rhythm")}>
                  <img src={PROMO.royalRave} alt="" />
                  <span className="mode-name">RHYTHM ROYALTY</span>
                  <small>{DIFFICULTY_INFO[difficulty].label} · 104 BPM</small>
                  {best.rhythm ? <b className="best-badge">{t.best} {best.rhythm.toLocaleString()}</b> : null}
                </button>
              </div>
              <div className="menu-secondary" role="group" aria-label={t.moreGroup}>
                <button type="button" className="cab-btn" disabled={!ready} onClick={() => go("strut", "school")}>{t.school}<span className="sr-only">{t.schoolSr}</span></button>
                <button type="button" className="cab-btn" disabled={!ready} onClick={() => go("strut", "practice")}>{t.practice}</button>
                <button type="button" className="cab-btn" onClick={() => setPanel("hints")}>{t.combos}</button>
                <button type="button" className="cab-btn" onClick={() => setPanel("stages")}>{t.stages}</button>
                <button type="button" className="cab-btn" onClick={() => setPanel("lab")}>{t.lab}</button>
                <button type="button" className="cab-btn" onClick={() => setPanel("notes")}>{t.notes}</button>
                <button type="button" className="cab-btn" onClick={() => setPanel("settings")}>
                  {t.settings}<span className="sr-only">{t.settingsSr}</span>
                </button>
              </div>
              <div className="lang-row" role="group" aria-label={t.language}>
                {LANGS.map((code) => (
                  <button key={code} type="button" lang={code} className="lang-btn" aria-pressed={lang === code} onClick={() => pickLang(code)}>
                    {LANG_LABEL[code]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {mode === "result" && result ? (
          <div className="overlay">
            <div>
              <h2 className="brand">
                {result.kind === "route" ? `HOME IN STYLE / ${result.mastery ?? "D"}` : `ROYALTY / ${DIFFICULTY_INFO[result.difficulty ?? difficulty].label}`}
                <em>
                  {result.score} · perfect {result.perfect} · fresh {result.fresh} · late {result.late} · stumbled{" "}
                  {result.stumble} · chain {result.maxCombo}{result.kind === "route" ? ` · FLOW ${result.flowPeak ?? 0}/5 · GOLD ${result.goldenBonus ?? 0}` : ""}
                </em>
              </h2>
              <div className="result-detail">
                <strong>{result.newRecord ? "PERSONAL BEST / " : ""}{result.perfect + result.fresh === 0 ? "FIND YOUR FEET" : result.stumble === 0 ? "CLEAN FOOTWORK" : "KEEP YOUR FLOW"}</strong>
                <p>{result.kind === "route" ? `${result.perfect} perfect encounters · ${result.fresh} clean · ${result.stumble} missed.${result.bonus ? ` ${result.bonus} bonus world${result.bonus > 1 ? "s" : ""} cleared.` : ""} Home in ${Math.floor((result.seconds ?? 0) / 60)}m ${Math.floor((result.seconds ?? 0) % 60)}s.` : "Hit notes as they reach the line. Keep long notes held until their tail clears."}</p>
                {result.kind === "route" && result.sk8 ? <p className="sk8-line">SK8 · {result.sk8.tricks} trick{result.sk8.tricks === 1 ? "" : "s"} · best chain {result.sk8.bestChain} · {result.sk8.bails} bail{result.sk8.bails === 1 ? "" : "s"} · {result.sk8.rival === null ? "no rival" : result.sk8.rival ? "rival schooled" : "rival won"} · trick lists {result.sk8.challenges} · secret lines {result.sk8.lines}/{result.sk8.linesTotal}</p> : null}
                <small>{result.kind === "route" ? `${result.accuracy ?? 0}% execution · ${result.techniqueCount ?? 0}/5 signature techniques · Route ${(result.variant ?? 0) + 1}. ${result.advice ?? "Watch the next cue."}` : result.stumble ? "Next run: watch the cue, then plant the action as it reaches you." : "Next run: link your signature moves between the cues."}</small>
              </div>
              <div className="menu-actions">
                <button type="button" className="cab-btn primary" autoFocus onClick={() => result.kind === "route" ? go("strut", "route") : go("rhythm")}>
                  {t.runItBack}
                </button>
                <button type="button" className="cab-btn" onClick={() => arcadeRef.current?.menu()}>
                  {t.cabinet}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {playing && runKind === "school" && school ? <div className={`practice-card school-card ${school.finished ? "done" : ""}`}>
          <span className="eyebrow">STREET SCHOOL · {school.finished ? "DONE" : `STEP ${school.step} / ${school.total}`}</span>
          <h2 key={school.title}>{school.title}</h2>
          <p className="school-line">{school.line}</p>
          <div className="school-pips" aria-hidden="true">
            {Array.from({ length: school.total }, (_, i) => <span key={i} className={i < school.step - 1 || school.finished ? "on" : i === school.step - 1 ? "now" : ""}>{i === school.step - 1 && !school.finished ? <i style={{ transform: `scaleX(${school.progress})` }} /> : null}</span>)}
          </div>
          {school.finished ? null : <button type="button" className="cab-btn school-skip" onClick={() => arcadeRef.current?.skipSchool()}>SKIP SCHOOL</button>}
        </div> : null}
        {playing && runKind === "practice" ? <div className="practice-card" aria-live="polite">
          <span className="eyebrow">FOOTWORK / {mastered.length} OF {COMBOS.length} MOVES LANDED</span>
          <h2>{COMBOS[lesson].name}</h2>
          <p className="practice-keys">{keysLabel(COMBOS[lesson].keys, " → ")}</p>
          <p>Tap in order. Release between taps. Finish the sequence within 2.6 seconds.</p>
          <strong>{landed === COMBOS[lesson].name ? "LANDED. THAT’S THE ONE." : landed ? `Landed ${landed.toLowerCase()}. Try the pattern above.` : "Take your time finding the pattern."}</strong>
          <button type="button" className="cab-btn" onClick={() => { setLesson((lesson + 1) % COMBOS.length); setLanded(null); }}>NEXT MOVE →</button>
        </div> : null}
        {panel !== "none" ? (
          <div className="sheet">
            <button type="button" className="cab-btn" onClick={closePanel}>
              {t.back}
            </button>
            {panel === "lab" ? <Lab /> : null}
            {panel === "hints" ? <Hints /> : null}
            {panel === "notes" ? <Notes /> : null}
            {panel === "stages" ? <Stages /> : null}
            {panel === "rhythm" ? <Chooser current={difficulty} ready={ready} onPick={(chart) => go("rhythm", "free", chart)} /> : null}
            {panel === "settings" ? (
              <Settings
                audio={audio}
                onAudio={changeAudio}
                keymap={keymap}
                capture={capture}
                onCapture={setCapture}
                onResetKeys={() => {
                  arcadeRef.current?.setKeys({ ...DEFAULT_KEYS });
                  setKeymap({ ...DEFAULT_KEYS });
                }}
                offset={offset}
                onOffset={changeOffset}
                calTaps={calTaps}
                calResult={calResult}
                onCalStart={startCalibration}
                onCalTap={tapCalibration}
                onCalCancel={cancelCalibration}
                onCalApply={(value) => {
                  changeOffset(value);
                  setCalResult(null);
                  announce(`Sync set to ${ms(value)}`);
                }}
                onResetBests={() => {
                  arcadeRef.current?.resetBests();
                  announce("Best scores reset");
                }}
                skin={skin}
                onSkin={(next) => {
                  arcadeRef.current?.setSkin(next);
                  setSkin(next);
                  announce(next === "cream" ? "Cream hoodie on" : "Red hoodie on");
                }}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {playing ? (
        <div className="dock">
          {mode === "rhythm" ? (
            <div className="sync">
              <button type="button" className="cab-btn" onClick={() => arcadeRef.current?.nudgeSync(-1)}>
                SYNC −
              </button>
              <button type="button" className="cab-btn" onClick={() => arcadeRef.current?.nudgeSync(1)}>
                SYNC +
              </button>
            </div>
          ) : null}
          {PADS.map((pad) => (
            <button
              key={pad.id}
              type="button"
              className={`pad ${pad.cls} ${held[pad.id] ? "on" : ""}`}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                arcadeRef.current?.down(pad.id);
                setHeld((prev) => ({ ...prev, [pad.id]: true }));
              }}
              onPointerUp={(event) => {
                arcadeRef.current?.up(pad.id);
                setHeld((prev) => ({ ...prev, [pad.id]: false }));
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
              }}
              onPointerCancel={() => {
                arcadeRef.current?.up(pad.id);
                setHeld((prev) => ({ ...prev, [pad.id]: false }));
              }}
              onLostPointerCapture={() => {
                arcadeRef.current?.up(pad.id);
                setHeld((prev) => ({ ...prev, [pad.id]: false }));
              }}
              onClick={(event) => {
                if (event.detail === 0) { arcadeRef.current?.down(pad.id); arcadeRef.current?.up(pad.id); }
              }}
              onContextMenu={(event) => event.preventDefault()}
            >
              <img src={held[pad.id] ? pad.down : pad.idle} alt="" />
              <span>
                {keyLabel(pad.id)} / {pad.name}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="dock">
          <p className="hint-row">{keyLabel("A")} / {t.stride}　 {keyLabel("B")} / {t.stomp}　 {keyLabel("C")} / {t.style} · {t.builtIn}</p>
        </div>
      )}
    </div>
  );
}

function Hints() {
  const combo = (keys: Btn[]) => keysLabel(keys, " ");
  return (
    <>
      <h2>THREE BUTTONS</h2>
      <p>
        {keyLabel("A")} is stride, {keyLabel("B")} is stomp, {keyLabel("C")} is style — on the keyboard or the three
        pads. Hold {keyLabel("A")} to push the scroll. Hold {keysLabel(["A", "C"], " and ")} together to face back
        while the street keeps moving.
      </p>
      <h3>COMBOS</h3>
      <ul>
        {COMBOS.map((item) => (
          <li key={item.name}>
            {combo(item.keys)} — {titleCase(item.name)}
          </li>
        ))}
        <li>{keysLabel(["B", "C"], " + ")} together — Spin Stomp</li>
        <li>{keysLabel(["A", "B", "C"], " + ")} with a full meter — MOSSQUAKE</li>
      </ul>
      <img className="hint-art" src={PROMO.mossquake} alt="Mossquake: Moss stomps and a shock ring cracks the pavement" />
      <p>
        On-beat hits pay more. Repeating one button pays less each time, and the street does not stop. Chords only
        count when the buttons land together. Rhythm has SYNC − / + if the notes feel early or late, and Sound, Sync
        &amp; Keys has a tap-along calibration and key remapping. A gamepad works too: bottom face button strides, right
        stomps, left styles, top unleashes MOSSQUAKE, Start pauses. In menus the D-pad moves focus, bottom face or Start selects, right backs out.
      </p>
      <h3>SK8 STOMP</h3>
      <p>
        Boards lie in the street, tail down. Stomp the tail with {keyLabel("B")} on the beat to pop it under Moss (off
        the beat and it squirts ahead: chase it and try again). While riding, tap once per beat to flip it:{" "}
        {keyLabel("A")} kickflip, {keyLabel("B")} heelflip, {keyLabel("C")} pop shove-it. Off the beat you bail and lose
        the chain. Street cues still count while you ride: hit them with their usual buttons, and missing one bails.
      </p>
      <ul>
        <li>Three PERFECT flips in a row — 360 FLIP</li>
        <li>Hold a flip button, then let go — MANUAL (50-50 GRIND on a yellow-edged ledge, RAIL GRIND on the pier)</li>
        <li>Each trick adds to the chain multiplier (up to ×4). The chain banks when the ride rolls out.</li>
        <li>STYLE meter: mix your tricks to fill it, repeat one and it drains. It scales every chain you land.</li>
        <li>PERFECT / GREAT / OK: cleaner timing pays more, pops higher and launches props further, everywhere.</li>
      </ul>
      <h3>STREET TOYS</h3>
      <p>Optional, never penalised: ignore them and nothing happens. Play them on the beat (the ring closes on each beat) and they pay.</p>
      <ul>
        <li>Shopping trolley — stomp to roll it, stomp again on the beat to skittle it into the wheelie bins</li>
        <li>Wheelie bin — stomp to flip the lid, stomp again on the next beat for RUBBISH RAIN</li>
        <li>Pigeons — any tap scatters them; a {keyLabel("B")} stomp on the downbeat (the "1") sends the whole flock</li>
        <li>Sprinkler — splash for DRIPPING ×1.25 on everything for a few seconds (longer on a PERFECT)</li>
        <li>Parking meter — keep stomping on each beat for escalating coins; four is the jackpot</li>
        <li>Rival skater (on the way home) — he plays four tricks, one per beat, then you answer with the same buttons on the same beats. Two rounds. Six of eight beats beats him; an all-PERFECT answer out-tricks him.</li>
      </ul>
      <p>
        Every stage has a TRICK LIST goal on the lime chip (e.g. a 360 flip on the pier, or board → trolley → bins on the
        strip), and some stages hide a secret best line: the right toys in the right order. Route S ranks need at least
        one secret line; S++ needs all of them.
      </p>
      <h3>THE LONG WAY HOME</h3>
      <p>
        Every strut starts at the van and walks the crossing, the station, the strip, the pier, then home. A gold pip
        means the window is open: hit it as the ring closes on the button. A missed event stumbles Moss, halves FLOW and drains 10% Quake. Tap on the beat straight after to recover. People and birds are not targets.
      </p>
      <ul>
        <li>Crossing and gulls — {keyLabel("B")}</li>
        <li>Blanket, puddle, commuter — {keyLabel("A")}</li>
        <li>Paper, bin, cloud, lamp — {keyLabel("C")}</li>
        <li>Busker and skateboard — {keysLabel(["A", "C"])}</li>
        <li>Trolley — {keysLabel(["A", "B"])}</li>
      </ul>
    </>
  );
}

/** Rhythm Royalty pre-start: one press picks the chart and starts it; the last pick has focus. */
function Chooser(props: { current: Difficulty; ready: boolean; onPick: (difficulty: Difficulty) => void }) {
  return (
    <div className="chooser">
      <h2>RHYTHM ROYALTY</h2>
      <p>Pick a chart. Your pick is remembered for next time. Same groove, same 104 BPM.</p>
      <div className="chart-cards" role="group" aria-label="Chart difficulty">
        {DIFFICULTIES.map((level, index) => (
          <button
            key={level}
            type="button"
            className={`chart-card chart-${level} ${level === props.current ? "picked" : ""}`}
            disabled={!props.ready}
            autoFocus={level === props.current}
            aria-describedby={`chart-${level}`}
            onClick={() => props.onPick(level)}
          >
            <span className="chart-name">{DIFFICULTY_INFO[level].label}</span>
            <span className="chart-pips" aria-hidden="true">
              {DIFFICULTIES.map((_, pip) => <i key={pip} className={pip <= index ? "on" : ""} />)}
            </span>
            {level === props.current ? <b className="best-badge">LAST PICK</b> : null}
            <small id={`chart-${level}`}>{DIFFICULTY_INFO[level].blurb}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function ms(seconds: number) {
  const value = Math.round(seconds * 1000);
  return `${value > 0 ? "+" : ""}${value} ms`;
}

const ACTION_NAME: Record<Btn, string> = { A: "STRIDE", B: "STOMP", C: "STYLE" };

function Settings(props: {
  audio: AudioPrefs;
  onAudio: (next: AudioPrefs) => void;
  keymap: KeyMap;
  capture: Btn | null;
  onCapture: (btn: Btn | null) => void;
  onResetKeys: () => void;
  offset: number;
  onOffset: (seconds: number) => void;
  calTaps: number | null;
  calResult: Calibration | "short" | null;
  onCalStart: () => void;
  onCalTap: () => void;
  onCalCancel: () => void;
  onCalApply: (seconds: number) => void;
  onResetBests: () => void;
  skin: Skin;
  onSkin: (skin: Skin) => void;
}) {
  const { audio, keymap, capture, calTaps, calResult } = props;
  const [confirmReset, setConfirmReset] = useState(false);
  const volume = Math.round(audio.volume * 100);
  return (
    <div className="settings">
      <h2>SOUND, SYNC &amp; KEYS</h2>
      <h3>SOUND</h3>
      <div className="setting-row">
        <label htmlFor="moss-volume">VOLUME {volume}%</label>
        <input
          id="moss-volume"
          type="range"
          min={0}
          max={100}
          step={5}
          value={volume}
          onChange={(event) => props.onAudio({ ...audio, volume: Number(event.target.value) / 100 })}
        />
        <button type="button" className="cab-btn" aria-pressed={audio.muted} onClick={() => props.onAudio({ ...audio, muted: !audio.muted })}>
          {audio.muted ? "UNMUTE" : "MUTE"}
        </button>
      </div>

      <h3>LOOK</h3>
      <p>
        Moss&apos;s hoodie. Cream is recoloured live from the original red frames. The previews are promo art; in play
        Moss keeps the sprite frames.
      </p>
      <div className="look-row" role="group" aria-label="Hoodie">
        {(["classic", "cream"] as const).map((option) => (
          <button key={option} type="button" className="look-card" aria-pressed={props.skin === option} onClick={() => props.onSkin(option)}>
            <img src={option === "classic" ? PROMO.damoRed : PROMO.damoCream} alt="" />
            <span>{option === "classic" ? "RED HOODIE" : "CREAM HOODIE"}</span>
          </button>
        ))}
      </div>

      <h3>RHYTHM SYNC</h3>
      <p>
        Current offset {ms(props.offset)}. If notes feel early or late, run the tap-along: listen to the click and tap
        any game key, or the TAP pad, on every beat. The first {CALIBRATION_WARMUP} taps are ignored.
      </p>
      {calTaps !== null ? (
        <div className="calibrate" aria-live="polite">
          <button type="button" className="cab-btn gold tap-pad" onPointerDown={(event) => { event.preventDefault(); props.onCalTap(); }} onClick={(event) => { if (event.detail === 0) props.onCalTap(); }}>
            TAP ON THE BEAT <small>{calTaps} / {CAL_TAPS}</small>
          </button>
          <button type="button" className="cab-btn" onClick={props.onCalCancel}>CANCEL</button>
        </div>
      ) : (
        <div className="setting-row">
          <button type="button" className="cab-btn gold" onClick={props.onCalStart}>START TAP-ALONG</button>
          <button type="button" className="cab-btn" onClick={() => props.onOffset(props.offset - 0.01)}>SYNC −</button>
          <button type="button" className="cab-btn" onClick={() => props.onOffset(props.offset + 0.01)}>SYNC +</button>
          <button type="button" className="cab-btn" onClick={() => props.onOffset(0)}>ZERO</button>
        </div>
      )}
      {calResult === "short" ? <p>Not enough taps to measure (need {CALIBRATION_MIN_TAPS} after the warm-up). Try again.</p> : null}
      {calResult && calResult !== "short" ? (
        <div className="setting-row">
          <p>
            Measured {ms(calResult.offset)}{" "}
            {calResult.reliable ? "· steady taps." : "· taps were uneven, so this is a rough guess. Try again for a better read."}
          </p>
          <button type="button" className="cab-btn primary" onClick={() => props.onCalApply(calResult.offset)}>USE {ms(calResult.offset)}</button>
        </div>
      ) : null}

      <h3>KEYS</h3>
      <p>Pick an action, then press the key you want. Escape cancels. Binding a key that is in use swaps the two.</p>
      <div className="setting-row">
        {ALL.map((btn) => (
          <button
            key={btn}
            type="button"
            className={`cab-btn ${capture === btn ? "gold" : ""}`}
            aria-label={capture === btn ? `Press a key for ${ACTION_NAME[btn]}` : `${ACTION_NAME[btn]} is ${codeLabel(keymap[btn])}. Change`}
            onClick={() => props.onCapture(capture === btn ? null : btn)}
          >
            {ACTION_NAME[btn]}: {capture === btn ? "PRESS A KEY…" : codeLabel(keymap[btn])}
          </button>
        ))}
        <button type="button" className="cab-btn" onClick={props.onResetKeys}>DEFAULT (A S D)</button>
      </div>
      <p>Gamepad: bottom face button strides, right stomps, left styles, top unleashes MOSSQUAKE, Start pauses.</p>

      <h3>SAVED BESTS</h3>
      <p>Bests, sync, sound and keys are saved in this browser only.</p>
      <div className="setting-row">
        {confirmReset ? (
          <>
            <button type="button" className="cab-btn primary" onClick={() => { props.onResetBests(); setConfirmReset(false); }}>
              YES, RESET BESTS
            </button>
            <button type="button" className="cab-btn" onClick={() => setConfirmReset(false)}>KEEP THEM</button>
          </>
        ) : (
          <button type="button" className="cab-btn" onClick={() => setConfirmReset(true)}>RESET BESTS…</button>
        )}
      </div>
    </div>
  );
}

function titleCase(name: string) {
  return name.toLowerCase().replace(/(^|[\s-])\S/g, (m) => m.toUpperCase());
}

function Notes() {
  return (
    <>
      <h2>FIELD NOTES</h2>
      <h3>SUPPLIED</h3>
      {REPORT.supplied.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <h3>INSPECTION</h3>
      {REPORT.inspection.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <h3>IN THIS BUILD</h3>
      {REPORT.made.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <h3>STILL OPEN</h3>
      {REPORT.limits.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <h3>CHECKS</h3>
      {REPORT.tests.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </>
  );
}

function Stages() {
  return (
    <>
      <h2>STAGE CARDS</h2>
      <p>
        The route is one continuous pavement: van, crossing, station, strip, pier, home. Time of day is a separate
        grade. The first stills are promo art; the world pack concepts follow. The playfield is drawn by the engine from
        the same layout.
      </p>
      <div className="stage-gallery">
        {ROUTE_CARDS.map((stage) => (
          <figure key={stage.id} className={stage.src ? "" : "text-card"}>
            {stage.src ? <img className="stage-card" src={stage.src} alt={`${stage.name}: promo still`} loading="lazy" /> : null}
            <figcaption>
              <h3>{stage.name}</h3>
              <p>{stage.note}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      <h2>WORLD PACK CONCEPTS</h2>
      <div className="stage-gallery">
        {STAGE_CONCEPTS.filter((stage) => !ROUTE_CARDS.some((card) => card.src === stage.src)).map((stage) => (
          <figure key={stage.id}>
            <img className="stage-card" src={stage.src} alt={`${stage.name}: world pack concept still`} loading="lazy" />
            <figcaption>
              <h3>{stage.name}</h3>
              <p>{stage.note}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}

function Lab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [clipId, setClipId] = useState(LAB_CLIPS[0]?.id ?? "strut");
  const clip = LAB_CLIPS.find((item) => item.id === clipId) ?? LAB_CLIPS[0]!;
  // The animation loop owns the frame in a ref; React only mirrors it for the stat line.
  const frameRef = useRef(0);
  const [frame, setFrameView] = useState(0);
  const setFrame = (update: number | ((value: number) => number)) => {
    const next = typeof update === "function" ? update(frameRef.current) : update;
    frameRef.current = next;
    setFrameView(next);
  };
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [flip, setFlip] = useState(false);
  const [guide, setGuide] = useState(true);
  const [compare, setCompare] = useState(clip.id === "strut");
  const loopFlashRef = useRef(0);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const phaseRef = useRef<HTMLImageElement[]>([]);
  const playRef = useRef({
    playing: true,
    speed: 1,
    flip: false,
    guide: true,
    compare: true,
    fps: clip.fps,
    count: clip.frames,
    id: clip.id,
  });
  playRef.current = {
    playing,
    speed,
    flip,
    guide,
    compare,
    fps: clip.fps,
    count: clip.frames,
    id: clip.id,
  };

  useEffect(() => {
    framesRef.current = Array.from({ length: clip.frames }, (_, index) => {
      const img = new Image();
      img.src = clip.src(index);
      return img;
    });
    phaseRef.current = Array.from({ length: PHASE1_STRUT.frames }, (_, index) => {
      const img = new Image();
      img.src = PHASE1_STRUT.src(index);
      return img;
    });
    setFrame(0);
    loopFlashRef.current = 0;
  }, [clip]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Size the backing store once when the loop starts, not every frame.
    const scale = 2;
    canvas.width = 360 * scale;
    canvas.height = 200 * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    let raf = 0;
    let acc = 0;
    let last = 0;
    let shown = -1;
    const draw = (now: number) => {
      const state = playRef.current;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      if (state.playing) {
        acc += dt * state.speed;
        const step = 1 / state.fps;
        while (acc >= step) {
          acc -= step;
          const next = (frameRef.current + 1) % state.count;
          if (next === 0) loopFlashRef.current = 0.25;
          frameRef.current = next;
        }
      }
      const frame = frameRef.current % state.count;
      // Mirror into React only when the visible frame changes (fps, not rAF rate).
      if (frame !== shown) {
        shown = frame;
        setFrameView(frame);
      }
      if (loopFlashRef.current > 0) loopFlashRef.current = Math.max(0, loopFlashRef.current - dt);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#241428";
      ctx.fillRect(0, 0, 360, 200);
      ctx.strokeStyle = "#3a2832";
      for (let x = 0; x < 360; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 200);
        ctx.stroke();
      }
      const meta = ANIM[state.id as ClipId];
      const showCompare = state.compare && state.id === "strut";
      const ground = 168;
      const slots = showCompare
        ? [
            { img: phaseRef.current[frame % PHASE1_STRUT.frames], x: 100, label: "PHASE I", pad: 0 },
            { img: framesRef.current[frame], x: 250, label: "PHASE II", pad: CELL.solePad },
          ]
        : [
            {
              img: framesRef.current[frame],
              x: 180,
              label: "",
              pad: state.id === "supplied-strut" || state.id === "phase1-strut" ? 0 : CELL.solePad,
            },
          ];
      if (state.guide) {
        ctx.strokeStyle = "#f5c518";
        ctx.beginPath();
        ctx.moveTo(0, ground);
        ctx.lineTo(360, ground);
        ctx.stroke();
      }
      for (const slot of slots) {
        const img = slot.img;
        if (!img || !img.complete || !img.naturalWidth) continue;
        const y = ground + slot.pad;
        ctx.save();
        ctx.translate(slot.x, y);
        if (state.flip) ctx.scale(-1, 1);
        ctx.drawImage(img, -img.width / 2, -img.height);
        ctx.restore();
        if (state.guide) {
          ctx.strokeStyle = "#1f8cff";
          ctx.strokeRect(slot.x - img.width / 2, y - img.height, img.width, img.height);
        }
        if (slot.label) {
          ctx.fillStyle = "#b7a89a";
          ctx.font = "8px 'Press Start 2P', monospace";
          ctx.fillText(slot.label, slot.x - 36, 16);
        }
      }
      const contact = meta?.contacts.includes(frame) ?? false;
      ctx.fillStyle = contact ? "#f5c518" : "#6a5a62";
      ctx.fillRect(8, ground - 6, 10, 10);
      ctx.fillStyle = "#f4efe6";
      ctx.font = "10px Silkscreen, monospace";
      const ms = Math.round(1000 / state.fps / Math.max(0.25, state.speed));
      ctx.fillText(`F ${frame + 1}/${state.count}  ${ms}ms  ${contact ? "FOOT" : "MOVE"}`, 8, 32);
      if (loopFlashRef.current > 0) {
        ctx.strokeStyle = "#e10600";
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, 356, 196);
        ctx.lineWidth = 1;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [clip]);

  const meta = ANIM[clip.id as ClipId];
  const ms = Math.round(1000 / clip.fps);

  return (
    <div className="lab">
      <h2>ANIMATION LAB</h2>
      <div className="lab-canvas-wrap">
        <canvas ref={canvasRef} />
      </div>
      <p className="stat">
        {clip.label} · frame {frame + 1}/{clip.frames} · {ms}ms source · cell {CELL.w}×{CELL.h} · sole y{CELL.footY}
        {meta ? ` · contacts ${meta.contacts.map((index) => index + 1).join(",")}` : ""}
        {meta?.lock ? " · locked until recover" : ""}
      </p>
      <p>{clip.note}</p>
      <div className="lab-controls">
        <select
          value={clip.id}
          onChange={(event) => {
            setClipId(event.target.value as ClipInfo["id"]);
            setPlaying(true);
            setCompare(event.target.value === "strut");
          }}
        >
          {LAB_CLIPS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <button type="button" className="cab-btn" onClick={() => setPlaying((value) => !value)}>
          {playing ? "PAUSE" : "PLAY"}
        </button>
        <button
          type="button"
          className="cab-btn"
          onClick={() => {
            setPlaying(false);
            setFrame((value) => (value - 1 + clip.frames) % clip.frames);
          }}
        >
          STEP -
        </button>
        <button
          type="button"
          className="cab-btn"
          onClick={() => {
            setPlaying(false);
            setFrame((value) => (value + 1) % clip.frames);
          }}
        >
          STEP +
        </button>
        <button
          type="button"
          className="cab-btn"
          onClick={() => setSpeed((value) => (value === 0.25 ? 0.5 : value === 0.5 ? 1 : value === 1 ? 2 : 0.25))}
        >
          SPEED {speed}x
        </button>
        <button type="button" className="cab-btn" onClick={() => setFlip((value) => !value)}>
          {flip ? "FACE LEFT" : "FACE RIGHT"}
        </button>
        <button type="button" className="cab-btn" onClick={() => setGuide((value) => !value)}>
          {guide ? "HIDE GUIDES" : "GUIDES"}
        </button>
        <button type="button" className="cab-btn" onClick={() => setCompare((value) => !value)}>
          {compare ? "COMPARE ON" : "COMPARE"}
        </button>
      </div>
    </div>
  );
}
