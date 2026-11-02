/**
 * Asset preload. Every sprite stays an individual, untouched PNG (the asset
 * check requires byte-identical files), so instead of packing sheets we load
 * in priority order through a small concurrency pool and report progress:
 *   1. stage layers + the strut cycle + rhythm notes  (first painted frame)
 *   2. the other move clips                            (first player input)
 *   3. effects and birds                               (cosmetic)
 * The game only reports ready when everything has loaded, so no clip can be
 * missing mid-run.
 */
import { BIRD_FRAMES, FX, PLAY_CLIPS, STAGE, UI, birdSrc, type ClipId } from "../clips";

export type LoadedArt = {
  clips: Map<ClipId, HTMLImageElement[]>;
  fx: Map<keyof typeof FX, HTMLImageElement[]>;
  stage: Map<string, HTMLImageElement>;
  birds: HTMLImageElement[];
  notes: HTMLImageElement[];
};

type Job = { src: string; priority: number; put: (img: HTMLImageElement) => void };

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Missing asset ${src}`));
    img.src = src;
  });
}

/** Ordered list of every runtime asset. Exported for tests and tooling. */
export function assetPlan(art: LoadedArt = emptyArt()): Job[] {
  const jobs: Job[] = [];
  const slot = <K>(map: Map<K, HTMLImageElement[]>, key: K, count: number) => {
    const arr: HTMLImageElement[] = new Array(count);
    map.set(key, arr);
    return (i: number) => (img: HTMLImageElement) => {
      arr[i] = img;
    };
  };
  for (const layer of STAGE) jobs.push({ src: layer.src, priority: 0, put: (img) => art.stage.set(layer.id, img) });
  for (const id of Object.keys(PLAY_CLIPS) as ClipId[]) {
    const clip = PLAY_CLIPS[id];
    const put = slot(art.clips, id, clip.frames);
    for (let i = 0; i < clip.frames; i++) jobs.push({ src: clip.src(i), priority: id === "strut" ? 0 : 1, put: put(i) });
  }
  [UI.noteA, UI.noteB, UI.noteC].forEach((src, i) => jobs.push({ src, priority: 0, put: (img) => (art.notes[i] = img) }));
  for (const kind of Object.keys(FX) as (keyof typeof FX)[]) {
    const put = slot(art.fx, kind, 8);
    for (let i = 0; i < 8; i++) jobs.push({ src: FX[kind](i), priority: 2, put: put(i) });
  }
  for (let i = 0; i < BIRD_FRAMES; i++) jobs.push({ src: birdSrc(i), priority: 2, put: (img) => (art.birds[i] = img) });
  // Stable sort keeps authored order inside a tier.
  return jobs.map((job, i) => ({ job, i })).sort((a, b) => a.job.priority - b.job.priority || a.i - b.i).map(({ job }) => job);
}

export function emptyArt(): LoadedArt {
  return { clips: new Map(), fx: new Map(), stage: new Map(), birds: [], notes: [] };
}

/** Loads every asset; `onProgress` fires after each one. Rejects on the first missing file. */
export async function loadArt(
  art: LoadedArt,
  onProgress?: (loaded: number, total: number) => void,
  concurrency = 6,
  load: (src: string) => Promise<HTMLImageElement> = loadImage,
): Promise<void> {
  const jobs = assetPlan(art);
  // Fonts count as one step so the bar never sits at 100% waiting on them.
  const total = jobs.length + 1;
  let loaded = 0;
  let next = 0;
  const bump = () => {
    loaded += 1;
    onProgress?.(loaded, total);
  };
  onProgress?.(0, total);
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++]!;
      job.put(await load(job.src));
      bump();
    }
  };
  await Promise.all([...Array.from({ length: Math.max(1, concurrency) }, worker), loadFonts().then(bump)]);
}

/** Waits for the self-hosted pixel fonts so canvas text never paints in a fallback face. Never rejects. */
export function loadFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
  const fonts = Promise.all([
    document.fonts.load("10px 'Press Start 2P'"),
    document.fonts.load("16px Silkscreen"),
  ]).then(() => document.fonts.ready).then(() => undefined, () => undefined);
  return Promise.race([fonts, timeout]);
}
