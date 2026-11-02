import type { Btn } from "./arcade-types";
import { keysLabel } from "./keys";

/**
 * THE LONG WAY HOME.
 * Distances and timings follow the V0.6 route schema.
 * Window milliseconds are the authority. They become pixels using the live
 * ground speed, so a faster stride still gets the authored warning and the
 * authored perfect beat. People and animals are never damage targets.
 */

export const PX_PER_UNIT = 10;
export const CYCLE_SEC = 180;
export const OVERLAP_PX = 160;
export const CRUISE_PX = 92;

export type ZoneId = "caravan" | "tracks" | "station" | "shops" | "pier" | "caravan_return";
export type PhaseName = "dawn" | "day" | "sunset" | "night";
export type StreetId =
  | "seagull"
  | "puddle"
  | "skateboard"
  | "sleeping_blanket"
  | "vape_cloud"
  | "trolley"
  | "newspaper"
  | "busker"
  | "commuter"
  | "crossing_signal"
  | "bin"
  | "streetlight";

export type RGB = [number, number, number];

export type Grade = {
  phase: PhaseName;
  skyTop: RGB;
  skyMid: RGB;
  skyHorizon: RGB;
  water: RGB;
  waterHi: RGB;
  veil: string;
  lamp: number;
  sun: RGB;
};

export type StreetSpec = {
  uid: string;
  id: StreetId;
  zone: ZoneId;
  at: number;
  trigger: Btn[];
  telegraphMs: number;
  perfectMs: number;
  goodMs: number;
  scorePerfect: number;
  scoreGood: number;
  feedback: string;
  body: boolean;
};

export type ZoneDef = {
  id: ZoneId;
  name: string;
  units: number;
  px: number;
  start: number;
};

const RAW: Omit<StreetSpec, "uid">[] = [
  { id: "crossing_signal", zone: "tracks", at: 0.4, trigger: ["B"], telegraphMs: 850, perfectMs: 135, goodMs: 250, scorePerfect: 350, scoreGood: 192, feedback: "ON THE BEAT", body: false },
  { id: "crossing_signal", zone: "tracks", at: 0.74, trigger: ["B"], telegraphMs: 850, perfectMs: 135, goodMs: 250, scorePerfect: 350, scoreGood: 192, feedback: "ON THE BEAT", body: false },
  { id: "sleeping_blanket", zone: "station", at: 0.22, trigger: ["A"], telegraphMs: 850, perfectMs: 135, goodMs: 250, scorePerfect: 500, scoreGood: 275, feedback: "RESPECT", body: true },
  { id: "vape_cloud", zone: "station", at: 0.4, trigger: ["C"], telegraphMs: 850, perfectMs: 135, goodMs: 250, scorePerfect: 240, scoreGood: 132, feedback: "CLEAR AIR", body: false },
  { id: "commuter", zone: "station", at: 0.58, trigger: ["A"], telegraphMs: 850, perfectMs: 135, goodMs: 250, scorePerfect: 260, scoreGood: 143, feedback: "GOOD FORM", body: true },
  { id: "busker", zone: "station", at: 0.8, trigger: ["A", "C"], telegraphMs: 850, perfectMs: 135, goodMs: 250, scorePerfect: 450, scoreGood: 247, feedback: "BUSKER DUET", body: true },
  { id: "puddle", zone: "shops", at: 0.14, trigger: ["A"], telegraphMs: 850, perfectMs: 135, goodMs: 250, scorePerfect: 220, scoreGood: 121, feedback: "CLEAN SOLES", body: false },
  { id: "newspaper", zone: "shops", at: 0.32, trigger: ["C"], telegraphMs: 850, perfectMs: 135, goodMs: 250, scorePerfect: 180, scoreGood: 99, feedback: "PAPER TRAIL", body: false },
  { id: "skateboard", zone: "shops", at: 0.48, trigger: ["A", "C"], telegraphMs: 850, perfectMs: 135, goodMs: 250, scorePerfect: 350, scoreGood: 192, feedback: "SIDEWINDER", body: false },
  { id: "bin", zone: "shops", at: 0.66, trigger: ["C"], telegraphMs: 850, perfectMs: 135, goodMs: 250, scorePerfect: 160, scoreGood: 88, feedback: "TIDY FOOTWORK", body: false },
  { id: "trolley", zone: "shops", at: 0.84, trigger: ["A", "B"], telegraphMs: 850, perfectMs: 135, goodMs: 250, scorePerfect: 400, scoreGood: 220, feedback: "TROLLEY DODGE", body: false },
  { id: "seagull", zone: "pier", at: 0.26, trigger: ["B"], telegraphMs: 850, perfectMs: 135, goodMs: 250, scorePerfect: 300, scoreGood: 165, feedback: "FLOCK FLIGHT", body: false },
  { id: "streetlight", zone: "pier", at: 0.52, trigger: ["C"], telegraphMs: 850, perfectMs: 135, goodMs: 250, scorePerfect: 250, scoreGood: 137, feedback: "SPOTLIGHT", body: false },
  { id: "seagull", zone: "pier", at: 0.78, trigger: ["B"], telegraphMs: 850, perfectMs: 135, goodMs: 250, scorePerfect: 300, scoreGood: 165, feedback: "FLOCK FLIGHT", body: false },
];

const ZONE_SRC: { id: ZoneId; name: string; units: number }[] = [
  { id: "caravan", name: "THE VAN", units: 120 },
  { id: "tracks", name: "THE CROSSING", units: 240 },
  { id: "station", name: "STATION", units: 300 },
  { id: "shops", name: "THE STRIP", units: 420 },
  { id: "pier", name: "THE PIER", units: 300 },
  { id: "caravan_return", name: "HOME", units: 120 },
];

function buildZones(): ZoneDef[] {
  let start = 0;
  return ZONE_SRC.map((zone) => {
    const px = zone.units * PX_PER_UNIT;
    const built = { ...zone, px, start };
    start += px;
    return built;
  });
}

export const ZONES: ZoneDef[] = buildZones();
export const ROUTE_PX = ZONES.reduce((sum, zone) => sum + zone.px, 0);

export const STREETS: StreetSpec[] = RAW.map((spec, index) => ({
  ...spec,
  uid: `${spec.zone}-${spec.id}-${index}`,
}));

export function streetX(spec: StreetSpec): number {
  const zone = ZONES.find((item) => item.id === spec.zone);
  if (!zone) return 0;
  return zone.start + spec.at * zone.px;
}

const PHASE_GRADE: Record<PhaseName, Grade> = {
  dawn: {
    phase: "dawn",
    skyTop: [22, 32, 62],
    skyMid: [196, 106, 74],
    skyHorizon: [244, 186, 130],
    water: [48, 62, 88],
    waterHi: [232, 160, 112],
    veil: "rgba(255, 150, 80, 0.12)",
    lamp: 0.35,
    sun: [255, 214, 150],
  },
  day: {
    phase: "day",
    skyTop: [46, 118, 196],
    skyMid: [126, 184, 228],
    skyHorizon: [214, 232, 242],
    water: [32, 104, 150],
    waterHi: [210, 232, 244],
    veil: "rgba(180, 210, 230, 0.06)",
    lamp: 0.08,
    sun: [255, 244, 210],
  },
  sunset: {
    phase: "sunset",
    skyTop: [36, 18, 40],
    skyMid: [176, 52, 36],
    skyHorizon: [245, 150, 48],
    water: [36, 28, 64],
    waterHi: [240, 130, 60],
    veil: "rgba(120, 40, 16, 0.1)",
    lamp: 0.62,
    sun: [255, 170, 70],
  },
  night: {
    phase: "night",
    skyTop: [6, 8, 16],
    skyMid: [16, 22, 40],
    skyHorizon: [24, 36, 56],
    water: [8, 14, 28],
    waterHi: [40, 64, 96],
    veil: "rgba(6, 8, 20, 0.22)",
    lamp: 1,
    sun: [220, 230, 245],
  },
};

const KEYS: { at: number; phase: PhaseName }[] = [
  { at: 0, phase: "dawn" },
  { at: 0.25, phase: "day" },
  { at: 0.55, phase: "sunset" },
  { at: 0.8, phase: "night" },
  { at: 1, phase: "dawn" },
];

export function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function rgb(c: RGB) {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function gradeAt(cycle01: number): Grade {
  const t = mod(cycle01, 1);
  let index = 0;
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (t >= KEYS[i]!.at && t <= KEYS[i + 1]!.at) {
      index = i;
      break;
    }
  }
  const a = KEYS[index]!;
  const b = KEYS[index + 1]!;
  const span = b.at - a.at || 1;
  const local = (t - a.at) / span;
  const from = PHASE_GRADE[a.phase];
  const to = PHASE_GRADE[b.phase];
  const phase = local < 0.5 ? a.phase : b.phase;
  return {
    phase,
    skyTop: mix(from.skyTop, to.skyTop, local),
    skyMid: mix(from.skyMid, to.skyMid, local),
    skyHorizon: mix(from.skyHorizon, to.skyHorizon, local),
    water: mix(from.water, to.water, local),
    waterHi: mix(from.waterHi, to.waterHi, local),
    veil: local < 0.5 ? from.veil : to.veil,
    lamp: from.lamp + (to.lamp - from.lamp) * local,
    sun: mix(from.sun, to.sun, local),
  };
}

export type ZoneSample = {
  zone: ZoneDef;
  index: number;
  local: number;
  startFade: number;
  endFade: number;
  next: ZoneDef;
  prev: ZoneDef;
};

export function zoneSample(worldX: number): ZoneSample {
  const x = mod(worldX, ROUTE_PX);
  let acc = 0;
  for (let i = 0; i < ZONES.length; i++) {
    const zone = ZONES[i]!;
    if (x < acc + zone.px || i === ZONES.length - 1) {
      const local = Math.max(0, x - acc);
      return {
        zone,
        index: i,
        local,
        startFade: clamp(local / OVERLAP_PX, 0, 1),
        endFade: clamp(1 - (zone.px - local) / OVERLAP_PX, 0, 1),
        next: ZONES[(i + 1) % ZONES.length]!,
        prev: ZONES[(i + ZONES.length - 1) % ZONES.length]!,
      };
    }
    acc += zone.px;
  }
  const zone = ZONES[0]!;
  return { zone, index: 0, local: 0, startFade: 1, endFade: 0, next: ZONES[1]!, prev: ZONES[ZONES.length - 1]! };
}

/** Share of the pier that is foreshore promenade before the boards start over the water. */
export const PIER_DECK = 0.3;
/** Share of the pier over which the foreshore plates fade out once the deck begins. */
export const PIER_DECK_FADE = 0.06;

/**
 * Opacity of the supplied foreshore plates. They frame the approach to the
 * pier (fading in at the end of the strip) and fade out once the engine-drawn
 * deck takes over, so the pier no longer borrows the foreshore for its length.
 */
export function plateWeight(worldX: number) {
  const sample = zoneSample(worldX);
  if (sample.zone.id === "pier") {
    const at = sample.local / sample.zone.px;
    return clamp(1 - (at - PIER_DECK) / PIER_DECK_FADE, 0, 1);
  }
  if (sample.next.id === "pier") return sample.endFade;
  return 0;
}

export type WindowPx = { perfect: number; good: number; telegraph: number };

export function windowsFor(flowPx: number, spec: StreetSpec): WindowPx {
  const v = Math.max(48, flowPx);
  return {
    perfect: v * (spec.perfectMs / 1000),
    good: v * (spec.goodMs / 1000),
    telegraph: v * (spec.telegraphMs / 1000),
  };
}

export function sameTrigger(spec: StreetSpec, btns: Btn[]) {
  if (spec.trigger.length !== btns.length) return false;
  const want = triggerKey(spec.trigger);
  return want === triggerKey(btns);
}

export function isPrefix(btns: Btn[], trigger: Btn[]) {
  if (btns.length >= trigger.length) return false;
  const have = new Set(btns);
  return [...have].every((btn) => trigger.includes(btn));
}

export function triggerKey(btns: Btn[]) {
  return [...btns].sort().join("+");
}

/** Player-facing label for a trigger, using physical keys (A/S/D). */
export function triggerLabel(btns: Btn[]) {
  return keysLabel(btns, "+");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Returns human-readable problems. Empty means the route can be played fairly. */
export function auditRoute(): string[] {
  const problems: string[] = [];
  const maxV = 150;
  const need = maxV * 0.85 + maxV * 0.25 + 64;
  const placed = STREETS.map((spec) => ({ spec, x: streetX(spec) })).sort((a, b) => a.x - b.x);
  for (let i = 1; i < placed.length; i++) {
    const gap = placed[i]!.x - placed[i - 1]!.x;
    if (gap < need) problems.push(`${placed[i]!.spec.uid} is ${Math.round(gap)}px after ${placed[i - 1]!.spec.uid}, need ${Math.round(need)}`);
  }
  for (const spec of STREETS) {
    if (!spec.trigger.length) problems.push(`${spec.uid} has no trigger`);
    if (spec.goodMs < spec.perfectMs) problems.push(`${spec.uid} good window inside perfect`);
    if (spec.body && spec.trigger.includes("B") && spec.trigger.length === 1) {
      problems.push(`${spec.uid} asks for a stomp on a person`);
    }
  }
  if (ROUTE_PX < 8000) problems.push("route is too short to read");
  const ids = new Set(STREETS.map((spec) => spec.uid));
  if (ids.size !== STREETS.length) problems.push("duplicate street ids");
  return problems;
}

export type RouteCard = { id: string; name: string; note: string; src?: string };

/**
 * Layout notes for the Stage Cards panel. The world-pack stills these described
 * (/moss/world/ui/*.png) were never committed, so the cards are text-only until
 * the art ships; add `src` back then (check-assets verifies any src exists).
 */
export const ROUTE_CARDS: RouteCard[] = [
  {
    id: "hud-caravan",
    name: "Layout · the van",
    note: "V0.6 composition reference. The playable van is drawn on the shared pavement.",
  },
  {
    id: "hud-station",
    name: "Layout · station",
    src: "/moss/source/04_STREET_BACKGROUNDS/stage_03_station_concept.png",
    note: "World-pack station still. In play the station is engine-drawn pixel scenery; its events are give-way, never collisions.",
  },
  {
    id: "hud-shops",
    name: "Layout · the strip",
    src: "/moss/source/04_STREET_BACKGROUNDS/stage_02_strip_concept.png",
    note: "World-pack strip still. In play the shopfronts are engine-drawn; shop props are timed footwork.",
  },
  {
    id: "hud-pier",
    name: "Layout · the pier",
    src: "/moss/source/04_STREET_BACKGROUNDS/stage_01_foreshore_concept.png",
    note: "World-pack foreshore still. The foreshore plates now only frame the pier approach; the pier itself is its own deck over the water, with pilings, rail and lamps.",
  },
  {
    id: "atlas",
    name: "Lighting atlas",
    note: "Dawn, day, sunset, night. This build cycles them in three minutes so the grade is visible. The schema's fourteen minutes is the long setting.",
  },
];
