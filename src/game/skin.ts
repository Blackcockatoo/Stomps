/**
 * Cream-hoodie skin, made at runtime from the supplied red-hoodie frames.
 *
 * The PNGs on disk are never touched (check-assets requires them byte-identical).
 * When the cream skin is first needed for a clip, each frame is drawn once onto
 * an offscreen canvas, its pixels are remapped, and the canvas is cached and drawn
 * in place of the image from then on. Frames are same-origin, so getImageData is
 * allowed; if it ever is not (tainted canvas), the classic frames are used.
 *
 * The remap is a hue key: saturated reds (hue 335°–14°) are the hoodie, hood and
 * drawstrings. Moss's skin is orange (hue ~20°–30°) and the jacket is near-black,
 * so neither is caught. Each red pixel becomes cream scaled by its own brightness,
 * so the sprite's shading and outlines survive.
 */
import type { ClipId } from "./clips";

export const CREAM: readonly [number, number, number] = [240, 228, 200];

/** True for the hoodie's saturated red (hue 335°–14°, saturation > 0.5, not near-black). */
export function isHoodieRed(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max !== r || max < 46) return false;
  const delta = max - min;
  if (delta / max <= 0.5) return false;
  // Hue in degrees with red at 0: positive towards yellow (g), negative towards magenta (b).
  const hue = (60 * (g - b)) / delta;
  return hue <= 14 && hue >= -25;
}

/** Remaps hoodie-red RGBA pixels to shaded cream in place. Returns how many changed. */
export function remapHoodie(data: Uint8ClampedArray) {
  let changed = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (!isHoodieRed(r, g, b)) continue;
    const k = Math.min(1, 0.42 + 0.7 * Math.min(1, (r / 255) * 1.08));
    data[i] = Math.round(CREAM[0] * k);
    data[i + 1] = Math.round(CREAM[1] * k);
    data[i + 2] = Math.round(CREAM[2] * k * 0.97);
    changed++;
  }
  return changed;
}

/** One frame through the remap. Returns null when pixels cannot be read. */
export function creamFrame(img: HTMLImageElement): HTMLCanvasElement | null {
  if (typeof document === "undefined" || !img.width || !img.height) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    remapHoodie(pixels.data);
    ctx.putImageData(pixels, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

export type Frame = HTMLImageElement | HTMLCanvasElement;

/** Lazily bakes and caches cream frames per clip; falls back to the source frames. */
export class SkinCache {
  private cache = new Map<ClipId, Frame[]>();

  frames(clip: ClipId, source: HTMLImageElement[] | undefined): Frame[] | undefined {
    if (!source?.length) return source;
    const hit = this.cache.get(clip);
    if (hit && hit.length === source.length) return hit;
    const baked: Frame[] = source.map((img) => creamFrame(img) ?? img);
    this.cache.set(clip, baked);
    return baked;
  }

  clear() {
    this.cache.clear();
  }
}
