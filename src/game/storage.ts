import type { Btn } from "./arcade-types";

/**
 * One versioned save for everything the cabinet remembers locally.
 *
 * Before P1 the game used three loose keys:
 *   moss-stomper-best              {version?:1|2, strut, rhythm}  (v1 values were 1/10 of the Hyper Drive scale)
 *   moss-stomper-route-best[-hyper] number (the un-suffixed key is the pre-Hyper scale)
 *   moss-stomper-offset            number (seconds)
 * They are read once, folded into SAVE_KEY and left in place (never deleted), so
 * rolling back to an older build still finds its data. Every read and write is
 * wrapped: blocked or corrupt storage falls back to defaults and never throws.
 */
export const SAVE_KEY = "moss-stomper-save";
export const SAVE_VERSION = 1;
export const LEGACY_KEYS = {
  best: "moss-stomper-best",
  routeHyper: "moss-stomper-route-best-hyper",
  route: "moss-stomper-route-best",
  offset: "moss-stomper-offset",
} as const;

export type KeyMap = Record<Btn, string>;
export const DEFAULT_KEYS: KeyMap = { A: "KeyA", B: "KeyS", C: "KeyD" };
export const OFFSET_LIMIT = 0.12;

export type SaveData = {
  version: typeof SAVE_VERSION;
  best: { strut: number; rhythm: number; route: number };
  /** Rhythm highway shift in seconds, clamped to ±OFFSET_LIMIT. */
  audioOffset: number;
  audio: { volume: number; muted: boolean };
  keys: KeyMap;
};

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    best: { strut: 0, rhythm: 0, route: 0 },
    audioOffset: 0,
    audio: { volume: 0.8, muted: false },
    keys: { ...DEFAULT_KEYS },
  };
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function store(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function get(s: StorageLike | null, key: string): string | null {
  if (!s) return null;
  try {
    return s.getItem(key);
  } catch {
    return null;
  }
}

const num = (value: unknown, fallback = 0) => {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
};
const score = (value: unknown) => Math.max(0, Math.round(num(value)));
export const clampOffset = (value: unknown) => Math.max(-OFFSET_LIMIT, Math.min(OFFSET_LIMIT, num(value)));
const clamp01 = (value: unknown, fallback: number) => Math.max(0, Math.min(1, num(value, fallback)));

function cleanKeys(raw: unknown): KeyMap {
  const keys = { ...DEFAULT_KEYS };
  if (!raw || typeof raw !== "object") return keys;
  const r = raw as Record<string, unknown>;
  for (const btn of ["A", "B", "C"] as Btn[]) {
    const code = r[btn];
    if (typeof code === "string" && code && code !== "Escape" && code.length <= 32) keys[btn] = code;
  }
  // A key bound to two actions would make one of them unreachable.
  if (new Set(Object.values(keys)).size !== 3) return { ...DEFAULT_KEYS };
  return keys;
}

/** Normalises any parsed save (current or future-proofed) into a valid SaveData. */
export function sanitize(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, any>;
  return {
    version: SAVE_VERSION,
    best: { strut: score(r.best?.strut), rhythm: score(r.best?.rhythm), route: score(r.best?.route) },
    audioOffset: clampOffset(r.audioOffset),
    audio: { volume: clamp01(r.audio?.volume, base.audio.volume), muted: r.audio?.muted === true },
    keys: cleanKeys(r.keys),
  };
}

/** Reads the three pre-P1 keys into a fresh save. */
export function migrateLegacy(s: StorageLike | null = store()): SaveData {
  const save = defaultSave();
  try {
    const raw = get(s, LEGACY_KEYS.best);
    if (raw) {
      const parsed = JSON.parse(raw) as { version?: number; strut?: number; rhythm?: number };
      const scale = parsed.version === 2 ? 1 : 10;
      save.best.strut = score(num(parsed.strut) * scale);
      save.best.rhythm = score(num(parsed.rhythm) * scale);
    }
  } catch {}
  save.best.route = score(num(get(s, LEGACY_KEYS.routeHyper))) || score(num(get(s, LEGACY_KEYS.route)) * 10);
  const offset = get(s, LEGACY_KEYS.offset);
  if (offset) save.audioOffset = clampOffset(offset);
  return save;
}

export function loadSave(s: StorageLike | null = store()): SaveData {
  const raw = get(s, SAVE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { version?: number };
      // Unknown future versions are read defensively rather than discarded.
      if (parsed && typeof parsed === "object") return sanitize(parsed);
    } catch {}
  }
  return migrateLegacy(s);
}

export function writeSave(save: SaveData, s: StorageLike | null = store()): boolean {
  if (!s) return false;
  try {
    s.setItem(SAVE_KEY, JSON.stringify(sanitize(save)));
    return true;
  } catch {
    return false;
  }
}

/** Read-modify-write helper. Returns the saved (sanitised) data. */
export function updateSave(change: (save: SaveData) => void, s: StorageLike | null = store()): SaveData {
  const save = loadSave(s);
  change(save);
  const clean = sanitize(save);
  writeSave(clean, s);
  return clean;
}

export function resetBests(s: StorageLike | null = store()): SaveData {
  return updateSave((save) => {
    save.best = { strut: 0, rhythm: 0, route: 0 };
  }, s);
}
