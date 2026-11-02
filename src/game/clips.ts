export type ClipId =
  | "strut"
  | "idle"
  | "stomp"
  | "style"
  | "spin"
  | "quake"
  | "stumble"
  | "slide";

export type ClipInfo = {
  id: ClipId | "supplied-strut" | "phase1-strut";
  label: string;
  frames: number;
  fps: number;
  note: string;
  src: (index: number) => string;
};

/** Shared grounding contract. Every play frame is pasted into the same cell with feet on `footY`. */
export const CELL = { w: 120, h: 116, footY: 111, solePad: 4 };

export type AnimMeta = {
  fps: number;
  /** Frames where a foot is planted. Dust and flow bonuses key off these. */
  contacts: number[];
  /** Safe frames to enter the clip without a pose pop. */
  entries: number[];
  /** Ultimate and other locked moves ignore new body input until they finish. */
  lock: boolean;
  /** Optional per-frame playback multiplier. */
  frameSpeed?: number[];
};

export const ANIM: Record<ClipId, AnimMeta> = {
  strut: { fps: 12, contacts: [0, 4, 8], entries: [0, 4, 8], lock: false },
  idle: { fps: 8, contacts: [0, 2], entries: [0], lock: false },
  stomp: { fps: 13, contacts: [3], entries: [0], lock: false, frameSpeed: [0.75, 1.05, 1.2, 1.45, 1, 0.85] },
  style: { fps: 11, contacts: [0, 5], entries: [0], lock: false },
  spin: { fps: 13, contacts: [0, 5], entries: [0], lock: false },
  slide: { fps: 11, contacts: [1, 2], entries: [0], lock: false },
  quake: {
    fps: 12,
    contacts: [5],
    entries: [0],
    lock: true,
    frameSpeed: [0.5, 0.65, 0.8, 0.42, 1.7, 1.35, 0.95, 0.8],
  },
  stumble: { fps: 12, contacts: [2, 3], entries: [0], lock: false },
};

const play = (id: string, index: number) =>
  `/moss/play/${id}/${String(index).padStart(2, "0")}.png`;

export const PLAY_CLIPS: Record<ClipId, ClipInfo> = {
  strut: {
    id: "strut",
    label: "Signature Strut",
    frames: 12,
    fps: 12,
    note: "Phase II 12-frame swagger. Feet share one baseline. Contacts on frames 1, 5 and 9.",
    src: (i) => play("strut", i),
  },
  idle: {
    id: "idle",
    label: "Idle Swagger",
    frames: 4,
    fps: 8,
    note: "Weight shift in place. Street Strut does not idle — Moss keeps walking.",
    src: (i) => play("idle", i),
  },
  stomp: {
    id: "stomp",
    label: "Heavy Stomp",
    frames: 6,
    fps: 13,
    note: "Chamber, slam on frame 4, settle. Impact dust is a separate effect.",
    src: (i) => play("stomp", i),
  },
  style: {
    id: "style",
    label: "Point / Style",
    frames: 6,
    fps: 11,
    note: "Single pointing hand. Frame 6 returns toward the walk.",
    src: (i) => play("style", i),
  },
  spin: {
    id: "spin",
    label: "Spin Step",
    frames: 6,
    fps: 13,
    note: "Profile, turn, back view, return. S+D.",
    src: (i) => play("spin", i),
  },
  slide: {
    id: "slide",
    label: "Slide",
    frames: 4,
    fps: 11,
    note: "Low slide used by the Frankston Shuffle and held rhythm notes.",
    src: (i) => play("slide", i),
  },
  quake: {
    id: "quake",
    label: "MOSSQUAKE",
    frames: 8,
    fps: 12,
    note: "Plant, rise, slam on frame 6, recover into the strut. Shockwave is drawn in-engine.",
    src: (i) => play("quake", i),
  },
  stumble: {
    id: "stumble",
    label: "Recovery",
    frames: 4,
    fps: 12,
    note: "Short trip. Rhythm misses play it once, then the song continues.",
    src: (i) => play("stumble", i),
  },
};

export const SUPPLIED_STRUT: ClipInfo = {
  id: "supplied-strut",
  label: "Supplied strut (broken)",
  frames: 12,
  fps: 12,
  note: "Original V0.4 extraction. Torn silhouettes. Lab only.",
  src: (i) =>
    `/moss/source/02_MOVEMENT_SPRITES/strut_12_frame_cleaned/strut_${String(i).padStart(2, "0")}.png`,
};

export const PHASE1_STRUT: ClipInfo = {
  id: "phase1-strut",
  label: "Phase I strut",
  frames: 12,
  fps: 12,
  note: "Previous playable cycle, kept for side-by-side comparison.",
  src: (i) => `/moss/play-v1/strut/${String(i).padStart(2, "0")}.png`,
};

export const LAB_CLIPS: ClipInfo[] = [...Object.values(PLAY_CLIPS), PHASE1_STRUT, SUPPLIED_STRUT];

export const FX = {
  dust: (i: number) => `/moss/source/07_VISUAL_EFFECTS/dust_${String(i).padStart(2, "0")}.png`,
  impact: (i: number) => `/moss/source/07_VISUAL_EFFECTS/impact_${String(i).padStart(2, "0")}.png`,
  sparks: (i: number) => `/moss/source/07_VISUAL_EFFECTS/style_sparks_${String(i).padStart(2, "0")}.png`,
  spin: (i: number) => `/moss/source/07_VISUAL_EFFECTS/spin_${String(i).padStart(2, "0")}.png`,
};

export type StageLayer = {
  id: string;
  src: string;
  speed: number;
  y: number;
  h: number;
  front?: boolean;
};

/** Frankston foreshore. Plates are mirrored so the horizontal join is seamless. */
export const STAGE: StageLayer[] = [
  { id: "sky", src: "/moss/stage/frankston/sky.png", speed: 0.05, y: -36, h: 236 },
  { id: "far", src: "/moss/stage/frankston/far.png", speed: 0.16, y: 108, h: 74 },
  { id: "mid", src: "/moss/stage/frankston/mid.png", speed: 0.38, y: 90, h: 116 },
  { id: "ground", src: "/moss/stage/frankston/ground.png", speed: 1, y: 196, h: 74 },
  { id: "fore", src: "/moss/stage/frankston/fore.png", speed: 1.25, y: 214, h: 56, front: true },
];

export const BIRD_FRAMES = 4;
export const birdSrc = (i: number) => `/moss/stage/frankston/birds/${String(i).padStart(2, "0")}.png`;

export const UI = {
  aIdle: "/moss/source/06_ARCADE_UI/button_A_idle.png",
  aDown: "/moss/source/06_ARCADE_UI/button_A_pressed.png",
  bIdle: "/moss/source/06_ARCADE_UI/button_B_idle.png",
  bDown: "/moss/source/06_ARCADE_UI/button_B_pressed.png",
  cIdle: "/moss/source/06_ARCADE_UI/button_C_idle.png",
  cDown: "/moss/source/06_ARCADE_UI/button_C_pressed.png",
  noteA: "/moss/source/06_ARCADE_UI/note_A.png",
  noteB: "/moss/source/06_ARCADE_UI/note_B.png",
  noteC: "/moss/source/06_ARCADE_UI/note_C.png",
};

export const STAGE_CONCEPTS = [
  {
    id: "foreshore",
    name: "Frankston Foreshore",
    src: "/moss/source/04_STREET_BACKGROUNDS/stage_01_foreshore_concept.png",
    note: "Reference card. The scrolling stage is a separate pier, water, promenade and pavement set.",
  },
  {
    id: "strip",
    name: "Frankston Strip",
    src: "/moss/source/04_STREET_BACKGROUNDS/stage_02_strip_concept.png",
    note: "Reference only. Not a scrolling layer.",
  },
  {
    id: "station",
    name: "Train Station",
    src: "/moss/source/04_STREET_BACKGROUNDS/stage_03_station_concept.png",
    note: "Reference only. Not a scrolling layer.",
  },
  {
    id: "oval",
    name: "Footy Oval",
    src: "/moss/source/04_STREET_BACKGROUNDS/stage_04_footy_concept.png",
    note: "Reference only. Not a scrolling layer.",
  },
  {
    id: "vic",
    name: "Old Vic State",
    src: "/moss/source/04_STREET_BACKGROUNDS/stage_05_old_vic_concept.png",
    note: "Reference only. Not a scrolling layer.",
  },
];
