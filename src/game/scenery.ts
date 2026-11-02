import { bakeOutlined } from "./props";
import {
  CYCLE_SEC,
  PIER_DECK,
  ROUTE_PX,
  ZONES,
  mod,
  rgb,
  type Grade,
  type StreetId,
  type ZoneId,
} from "./route";

const MID_H = 132;
const FAR_W = 640;
const FAR_H = 70;

export type WorldArt = {
  mid: Record<ZoneId, HTMLCanvasElement>;
  glow: Record<ZoneId, HTMLCanvasElement>;
  marks: Record<ZoneId, HTMLCanvasElement>;
  far: HTMLCanvasElement;
};

type Ctx = CanvasRenderingContext2D;

function make(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function r(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function bakeWorld(): WorldArt {
  const mid = {} as WorldArt["mid"];
  const glow = {} as WorldArt["glow"];
  const marks = {} as WorldArt["marks"];
  for (const zone of ZONES) {
    const painted = paintZone(zone.id, zone.px);
    mid[zone.id] = painted.mid;
    glow[zone.id] = painted.glow;
    marks[zone.id] = painted.marks;
  }
  const far = make(FAR_W, FAR_H);
  paintSkyline(far.ctx, FAR_W, FAR_H);
  return { mid, glow, marks, far: far.canvas };
}

function paintZone(id: ZoneId, width: number) {
  const mid = make(width, MID_H);
  const glow = make(width, MID_H);
  const marks = make(width, 74);
  const base = MID_H - 2;
  if (id === "caravan" || id === "caravan_return") paintCaravan(mid.ctx, glow.ctx, marks.ctx, width, base);
  else if (id === "tracks") paintTracks(mid.ctx, glow.ctx, marks.ctx, width, base);
  else if (id === "station") paintStation(mid.ctx, glow.ctx, marks.ctx, width, base);
  else if (id === "shops") paintShops(mid.ctx, glow.ctx, marks.ctx, width, base);
  else paintPier(mid.ctx, glow.ctx, marks.ctx, width, base);
  r(mid.ctx, 0, base, width, 2, "#1a1420");
  detailZone(mid.ctx, id, width, base);
  // P4: bake a 1px dark outline, rim light and edge shade onto the scenery so
  // the blocky silhouettes read as drawn shapes. Falls back to flat art.
  let lit: HTMLCanvasElement = mid.canvas;
  try { lit = bakeOutlined(mid.canvas, 0.38, 0.22); } catch { lit = mid.canvas; }
  return { mid: lit, glow: glow.canvas, marks: marks.canvas };
}

/** Small hand-placed detail per zone: weeds, bolts, cables, bricks. */
function detailZone(ctx: Ctx, id: ZoneId, width: number, base: number) {
  for (let x = 6; x < width; x += 23) {
    const h = hash(x * 7 + id.length);
    if (h > 0.55) r(ctx, x, base - 2 - Math.round(h * 4), 1, 2 + Math.round(h * 4), "#3f5a2c");
    if (h > 0.8) r(ctx, x + 2, base - 3, 2, 3, "#567a3a");
  }
  if (id === "tracks" || id === "station") {
    for (let x = 30; x < width; x += 210) {
      r(ctx, x, base - 128, 1, 6, "#1a1420");
      r(ctx, x, base - 124, 210, 1, "rgba(26, 20, 32, 0.7)");
    }
  }
  if (id === "shops") {
    for (let x = 0; x < width; x += 12) r(ctx, x + ((x / 12) % 2) * 6, base - 6, 5, 1, "rgba(0, 0, 0, 0.25)");
  }
}

function paintCaravan(ctx: Ctx, glow: Ctx, marks: Ctx, width: number, base: number) {
  for (let x = 0; x < width; x += 48) r(marks, x + 4, 20, 36, 22, "rgba(232, 220, 196, 0.4)");
  r(ctx, 0, base - 22, width, 22, "#3a342c");
  for (let x = 18; x < width; x += 36) r(ctx, x, base - 40, 4, 20, "#2a2420");
  for (const vx of [220, width * 0.62]) {
    r(ctx, vx, base - 108, 156, 86, "#d8c8a4");
    r(ctx, vx, base - 116, 156, 10, "#e10600");
    r(ctx, vx + 12, base - 92, 44, 32, "#1a2434");
    r(ctx, vx + 104, base - 86, 36, 26, "#1a2434");
    r(ctx, vx + 64, base - 78, 26, 56, "#c4b494");
    r(ctx, vx + 20, base - 24, 26, 24, "#14120f");
    r(ctx, vx + 112, base - 24, 26, 24, "#14120f");
    r(ctx, vx + 26, base - 18, 12, 12, "#8a8680");
    r(ctx, vx + 118, base - 18, 12, 12, "#8a8680");
    r(ctx, vx - 22, base - 28, 24, 6, "#4a4038");
    for (let i = 0; i < 9; i++) r(glow, vx + 8 + i * 16, base - 128, 6, 6, i % 2 ? "#f5c518" : "#fff4d0");
  }
}

function paintTracks(ctx: Ctx, glow: Ctx, marks: Ctx, width: number, base: number) {
  r(marks, 0, 2, width, 6, "rgba(245, 197, 24, 0.9)");
  r(ctx, 0, base - 28, width, 14, "#3a3834");
  for (let x = 0; x < width; x += 18) r(ctx, x, base - 32, 8, 18, "#4a3828");
  r(ctx, 0, base - 26, width, 3, "#c8bfb2");
  r(ctx, 0, base - 16, width, 3, "#c8bfb2");
  for (const tx of [width * 0.16, width * 0.62]) {
    r(ctx, tx, base - 92, 240, 52, "#c8c4bc");
    r(ctx, tx, base - 100, 240, 10, "#e10600");
    for (let i = 0; i < 5; i++) r(ctx, tx + 16 + i * 42, base - 82, 26, 18, "#1a2838");
    r(ctx, tx + 210, base - 78, 18, 28, "#2a241c");
  }
  for (const gx of [width * 0.4, width * 0.74]) {
    r(ctx, gx, base - 124, 6, 122, "#241c20");
    r(ctx, gx + 64, base - 124, 6, 122, "#241c20");
    r(ctx, gx, base - 124, 70, 6, "#241c20");
    r(glow, gx + 26, base - 112, 14, 14, "#e10600");
    r(glow, gx + 26, base - 92, 14, 14, "#f4efe6");
  }
}

function paintStation(ctx: Ctx, glow: Ctx, marks: Ctx, width: number, base: number) {
  for (let x = 0; x < width; x += 14) r(marks, x + 2, 6, 4, 4, "rgba(245, 197, 24, 0.7)");
  r(ctx, 0, base - 118, width, 70, "#2c343c");
  r(ctx, 16, base - 128, width - 32, 12, "#3e4a56");
  for (let x = 36; x < width - 20; x += 84) {
    r(ctx, x, base - 116, 8, 116, "#4a4038");
    r(ctx, x + 18, base - 96, 34, 36, "#141820");
    r(glow, x + 22, base - 90, 26, 22, "#f5c518");
  }
  const clock = width * 0.48;
  r(ctx, clock, 2, 30, 30, "#14120f");
  r(ctx, clock + 4, 6, 22, 22, "#f4efe6");
  r(ctx, clock + 13, 9, 3, 10, "#1a1420");
  r(ctx, clock + 13, 16, 8, 3, "#1a1420");
}

function paintShops(ctx: Ctx, glow: Ctx, marks: Ctx, width: number, base: number) {
  const awnings = ["#e10600", "#f5c518", "#1f8cff", "#f4efe6", "#c44820"];
  for (let x = 0; x < width; x += 24) r(marks, x, 18, 20, 30, "rgba(40, 32, 36, 0.28)");
  let x = 16;
  let i = 0;
  while (x < width - 24) {
    const aw = awnings[i % awnings.length]!;
    r(ctx, x, base - 112, 84, 96, "#262228");
    r(ctx, x - 6, base - 122, 96, 14, aw);
    r(ctx, x + 10, base - 96, 30, 40, "#10141c");
    r(ctx, x + 48, base - 84, 24, 68, "#1a1418");
    r(glow, x + 14, base - 90, 22, 26, "#f0d090");
    // Neon shop sign over every other awning.
    if (i % 2 === 0) {
      r(ctx, x + 18, base - 106, 48, 9, "#120e14");
      r(glow, x + 20, base - 105, 44, 2, aw);
      r(glow, x + 20, base - 100, 44, 2, aw);
    }
    x += 108;
    i += 1;
  }
}

function paintPier(ctx: Ctx, glow: Ctx, marks: Ctx, width: number, base: number) {
  const deck = Math.round(width * PIER_DECK);
  // Promenade approach: the foreshore plates sit behind these lamps and benches.
  for (let x = 0; x < deck; x += 20) r(marks, x, 22, 14, 3, "rgba(60, 48, 36, 0.45)");
  for (let x = 28; x < deck - 16; x += 64) {
    r(ctx, x, base - 108, 4, 106, "#241c18");
    r(glow, x - 6, base - 116, 16, 10, "#f5c518");
    r(ctx, x - 18, base - 28, 40, 4, "#3a342c");
    r(ctx, x - 18, base - 18, 4, 16, "#3a342c");
    r(ctx, x + 18, base - 18, 4, 16, "#3a342c");
  }
  // The pier proper: open water behind and under the boards.
  const span = width - deck;
  r(ctx, deck, base - 66, span, 66, "#0d2738");
  r(ctx, deck, base - 66, span, 3, "#2c5f78");
  for (let i = 0; i < span / 9; i++) {
    const x = deck + hash(i * 31 + 7) * span;
    const y = base - 60 + hash(i * 77 + 3) * 50;
    r(ctx, x, y, 6 + hash(i * 13 + 1) * 14, 1, i % 3 ? "#1f4a62" : "#4c86a0");
  }
  // Back rail and its posts, then the lamps along it.
  r(ctx, deck, base - 34, span, 3, "#4a3828");
  r(ctx, deck, base - 22, span, 2, "#3a2c20");
  for (let x = deck; x < width; x += 22) r(ctx, x, base - 34, 3, 34, "#3a2c20");
  for (let x = deck + 40; x < width - 8; x += 96) {
    r(ctx, x, base - 104, 4, 104, "#1c1612");
    r(ctx, x - 8, base - 108, 20, 5, "#1c1612");
    r(glow, x - 10, base - 104, 24, 8, "#f5c518");
    r(glow, x - 2, base - 66, 8, 40, "rgba(245, 197, 24, 0.35)");
  }
  r(ctx, deck, base - 8, span, 8, "#4a3626");

  // Deck boards (marks layer is drawn over the pavement plate at screen y 196).
  r(marks, deck - 6, 0, 6, 54, "#2a1e16");
  r(marks, deck, 0, span, 52, "#5c4430");
  r(marks, deck, 0, span, 3, "#7a5c40");
  for (let x = deck; x < width; x += 11) {
    r(marks, x, 0, 1, 52, "#2a1e16");
    if (hash(x) > 0.6) r(marks, x + 3, 6 + hash(x * 13 + 5) * 36, 4, 1, "#6c5038");
  }
  r(marks, deck, 50, span, 6, "#2e2018");
  r(marks, width - 5, 0, 5, 56, "#2a1e16");
  r(ctx, width - 6, base - 40, 6, 40, "#2a1e16");
  // Water under the deck with pilings and cross-bracing.
  r(marks, deck, 56, span, 18, "#0b2233");
  for (let i = 0; i < span / 14; i++) r(marks, deck + hash(i * 53 + 11) * span, 60 + hash(i * 29 + 2) * 12, 8, 1, "#2c5f78");
  marks.strokeStyle = "#24180f";
  marks.lineWidth = 2;
  for (let x = deck + 12; x < width; x += 48) {
    r(marks, x, 56, 6, 18, "#2a1e16");
    r(marks, x, 70, 6, 2, "#4c86a0");
    if (x + 48 < width) {
      marks.beginPath();
      marks.moveTo(x + 6, 57);
      marks.lineTo(x + 48, 69);
      marks.moveTo(x + 6, 69);
      marks.lineTo(x + 48, 57);
      marks.stroke();
    }
  }
}

function paintSkyline(ctx: Ctx, width: number, height: number) {
  const base = height - 1;
  r(ctx, 0, base - 18, width, 18, "#141018");
  const blocks = [18, 40, 28, 52, 22, 36, 16, 44, 26, 38, 20, 48];
  let x = 0;
  let i = 0;
  while (x < width) {
    const h = blocks[i % blocks.length]!;
    const w = 28 + (i % 4) * 10;
    r(ctx, x, base - 18 - h, w, h, "#100c14");
    if (i % 5 === 0) r(ctx, x + w * 0.4, base - 18 - h - 10, 4, 10, "#100c14");
    x += w + 8;
    i += 1;
  }
}

export function paintBackdrop(ctx: Ctx, grade: Grade, cycle: number, time: number, scroll: number, art: WorldArt) {
  const sky = ctx.createLinearGradient(0, 0, 0, 168);
  sky.addColorStop(0, rgb(grade.skyTop));
  sky.addColorStop(0.55, rgb(grade.skyMid));
  sky.addColorStop(1, rgb(grade.skyHorizon));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 480, 168);

  const night = grade.phase === "night" ? 1 : grade.phase === "sunset" ? 0.35 : grade.phase === "dawn" ? 0.2 : 0;
  if (night > 0.15) {
    ctx.fillStyle = `rgba(244, 239, 230, ${0.85 * night})`;
    for (let i = 0; i < 28; i++) {
      const sx = mod(hash(i) * 480 + scroll * 0.01, 480);
      const sy = 8 + hash(i + 40) * 70;
      ctx.fillRect(Math.round(sx), Math.round(sy), hash(i + 9) > 0.8 ? 2 : 1, 1);
    }
  }

  const across = cycle < 0.8 ? cycle / 0.72 : (cycle - 0.8) / 0.2;
  const sunX = cycle < 0.8 ? 36 + across * 400 : 420 - across * 360;
  const sunY = cycle < 0.8 ? 108 - Math.sin(across * Math.PI) * 78 : 46 + across * 20;
  ctx.fillStyle = rgb(grade.sun);
  ctx.globalAlpha = cycle < 0.8 ? 1 : 0.9;
  const body = cycle < 0.8 ? 16 : 12;
  ctx.fillRect(Math.round(sunX), Math.round(sunY), body, body);
  if (cycle >= 0.8) {
    ctx.fillStyle = "#141828";
    ctx.fillRect(Math.round(sunX) + 3, Math.round(sunY) - 2, 8, 8);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = rgb(grade.water);
  ctx.fillRect(0, 150, 480, 48);
  ctx.fillStyle = rgb(grade.waterHi);
  const shift = Math.floor(scroll * 0.12 + time * 18);
  for (let x = -20; x < 500; x += 28) {
    const y = 162 + Math.sin((x + shift) * 0.08) * 2;
    ctx.fillRect(Math.round(x + (shift % 28)), Math.round(y), 16, 2);
  }

  const farX = -mod(scroll * 0.16, FAR_W);
  ctx.drawImage(art.far, Math.round(farX), 96, FAR_W, FAR_H);
  ctx.drawImage(art.far, Math.round(farX + FAR_W), 96, FAR_W, FAR_H);
}

export function paintStreet(ctx: Ctx, art: WorldArt, scroll: number) {
  blitRoute(ctx, scroll, (id) => art.mid[id], 88);
}

export function paintGlow(ctx: Ctx, art: WorldArt, scroll: number, grade: Grade) {
  ctx.save();
  ctx.globalAlpha = Math.max(0.05, grade.lamp);
  ctx.globalCompositeOperation = "lighter";
  blitRoute(ctx, scroll, (id) => art.glow[id], 88);
  ctx.restore();
}

export function paintMarks(ctx: Ctx, art: WorldArt, scroll: number) {
  ctx.save();
  ctx.globalAlpha = 0.9;
  blitRoute(ctx, scroll, (id) => art.marks[id], 196);
  ctx.restore();
}

function blitRoute(ctx: Ctx, scroll: number, pick: (id: ZoneId) => HTMLCanvasElement, y: number) {
  const base = -mod(scroll, ROUTE_PX);
  for (let copy = 0; copy < 2; copy++) {
    for (const zone of ZONES) {
      const img = pick(zone.id);
      const x = base + zone.start + copy * ROUTE_PX;
      if (x > 480 || x + zone.px < 0) continue;
      ctx.drawImage(img, Math.round(x), y);
    }
  }
}

function hash(n: number) {
  let x = Math.imul(n, 374761393) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}

export function cycleOf(now: number) {
  return mod(now / CYCLE_SEC, 1);
}

// ── Bonus world ──────────────────────────────────────────────────────────

const BONUS_W = 480;

/** Neon backdrop for the bonus-world segment: night sky, sun bands, pillars, grid floor. */
export function paintBonusWorld(ctx: Ctx, scroll: number, now: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, 196);
  sky.addColorStop(0, "#090418");
  sky.addColorStop(0.7, "#2a0b3d");
  sky.addColorStop(1, "#5a1450");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, BONUS_W, 196);
  // Banded sun.
  ctx.save();
  ctx.fillStyle = "#f5c518";
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(BONUS_W / 2, 150, 54, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#2a0b3d";
  for (let i = 0; i < 6; i += 1) ctx.fillRect(BONUS_W / 2 - 60, 108 + i * 7, 120, 1 + i * 0.6);
  ctx.restore();
  // Parallax neon pillars.
  const pulse = 0.55 + 0.45 * Math.sin(now * 6);
  for (let i = -1; i < 7; i += 1) {
    const x = Math.round(i * 90 - ((scroll * 0.5) % 90));
    r(ctx, x, 70, 10, 126, "#14081f");
    ctx.fillStyle = i % 2 ? `rgba(255,62,165,${0.5 + 0.4 * pulse})` : `rgba(64,224,255,${0.5 + 0.4 * pulse})`;
    ctx.fillRect(x + 4, 74, 2, 118);
  }
  // Grid floor.
  r(ctx, 0, 196, BONUS_W, 74, "#120720");
  ctx.strokeStyle = "rgba(255,62,165,0.65)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = 196, step = 3; y < 270; y += step, step += 2) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(BONUS_W, y + 0.5);
  }
  const off = scroll % 40;
  for (let x = -400; x < BONUS_W + 400; x += 40) {
    const top = x - off;
    ctx.moveTo(BONUS_W / 2 + (top - BONUS_W / 2) * 0.25, 196);
    ctx.lineTo(BONUS_W / 2 + (top - BONUS_W / 2) * 2.2, 270);
  }
  ctx.stroke();
  r(ctx, 0, 195, BONUS_W, 2, "#40e0ff");
}

/** The bonus door prop on the pier: a lit arch when open, boarded when shut. */
export function paintDoor(ctx: Ctx, x: number, ground: number, open: boolean, now: number) {
  const left = Math.round(x - 20);
  const top = ground - 86;
  r(ctx, left - 4, top - 6, 48, 92, "#1a1220");
  if (open) {
    const pulse = 0.6 + 0.4 * Math.sin(now * 8);
    ctx.save();
    ctx.globalAlpha = 0.35 * pulse;
    r(ctx, left - 14, top - 16, 68, 112, "#ff3ea5");
    ctx.restore();
    const glow = ctx.createLinearGradient(0, top, 0, ground);
    glow.addColorStop(0, "#40e0ff");
    glow.addColorStop(1, "#ff3ea5");
    ctx.fillStyle = glow;
    ctx.fillRect(left, top, 40, 86);
    r(ctx, left + 6, top + 6, 28, 74, `rgba(255,255,255,${0.25 + 0.25 * pulse})`);
  } else {
    r(ctx, left, top, 40, 86, "#3a2a22");
    for (let i = 0; i < 4; i += 1) r(ctx, left - 2, top + 10 + i * 20, 44, 5, "#6b4a32");
  }
  r(ctx, left - 6, top - 14, 52, 9, open ? "#f5c518" : "#4a4048");
  ctx.fillStyle = open ? "#080d12" : "#b7a89a";
  ctx.font = "bold 7px monospace";
  ctx.textAlign = "center";
  ctx.fillText(open ? "BONUS ×2" : "BONUS", left + 20, top - 7);
  ctx.textAlign = "left";
}
