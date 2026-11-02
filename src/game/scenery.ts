import type { Btn } from "./arcade-types";
import { keyLabel } from "./keys";
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
  return { mid: mid.canvas, glow: glow.canvas, marks: marks.canvas };
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

export function paintProp(
  ctx: Ctx,
  id: StreetId,
  x: number,
  ground: number,
  age: number,
  kind: "open" | "perfect" | "good" | "miss" | "soon",
  time: number,
) {
  const lift = kind === "perfect" || kind === "good" ? Math.min(1, age) : 0;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(ground));
  if (id === "seagull") {
    const up = lift * 36;
    bird(ctx, -16, -46 - up, 0);
    bird(ctx, 0, -58 - up * 1.2, 1);
    bird(ctx, 14, -42 - up * 0.8, 2);
  } else if (id === "puddle") {
    ctx.fillStyle = "rgba(40, 90, 140, 0.85)";
    ctx.fillRect(-16, -6, 32, 6);
    ctx.fillStyle = "rgba(210, 230, 244, 0.8)";
    ctx.fillRect(-8, -5, 10, 2);
    if (lift) {
      ctx.fillStyle = "#f4efe6";
      ctx.fillRect(-10, -10 - lift * 10, 3, 3);
      ctx.fillRect(6, -14 - lift * 12, 3, 3);
    }
  } else if (id === "skateboard") {
    ctx.fillStyle = "#c44820";
    ctx.fillRect(-14, -8, 28, 4);
    ctx.fillStyle = "#1a1420";
    ctx.fillRect(-10, -4, 5, 4);
    ctx.fillRect(6, -4, 5, 4);
  } else if (id === "sleeping_blanket") {
    ctx.fillStyle = "#243044";
    ctx.fillRect(-18, -12, 36, 10);
    ctx.fillStyle = "#8a4030";
    ctx.fillRect(-14, -16, 22, 6);
    ctx.fillStyle = "#d8c8a4";
    ctx.fillRect(-6, -18, 8, 4);
  } else if (id === "vape_cloud") {
    ctx.globalAlpha = Math.max(0.15, 0.75 - lift);
    ctx.fillStyle = "#c8c4c0";
    const drift = time * 10 + lift * 16;
    ctx.fillRect(-8, -28 - drift * 0.2, 14, 10);
    ctx.fillRect(4, -36 - drift * 0.35, 12, 8);
    ctx.fillRect(-2, -20, 10, 8);
  } else if (id === "trolley") {
    const roll = lift * 10;
    ctx.translate(roll, 0);
    ctx.fillStyle = "#8a9298";
    ctx.fillRect(-12, -28, 24, 18);
    ctx.fillStyle = "#d0d4d8";
    ctx.fillRect(-10, -26, 20, 8);
    ctx.fillStyle = "#1a1420";
    ctx.fillRect(-10, -8, 5, 5);
    ctx.fillRect(5, -8, 5, 5);
    ctx.fillRect(8, -36, 3, 16);
  } else if (id === "newspaper") {
    ctx.translate(lift * 22, -lift * 16);
    ctx.fillStyle = "#f4efe6";
    ctx.fillRect(-10, -16, 18, 12);
    ctx.fillStyle = "#8a847c";
    ctx.fillRect(-7, -13, 12, 2);
    ctx.fillRect(-7, -9, 8, 2);
  } else if (id === "busker") {
    ctx.fillStyle = "#3a2428";
    ctx.fillRect(-8, -22, 14, 16);
    ctx.fillStyle = "#1a1420";
    ctx.fillRect(-4, -30, 10, 8);
    ctx.fillStyle = "#c4a060";
    ctx.fillRect(6, -28, 16, 3);
    ctx.fillRect(18, -32, 3, 10);
    if (lift) {
      ctx.fillStyle = "#f5c518";
      ctx.fillRect(10, -40 - lift * 8, 3, 3);
      ctx.fillRect(16, -46 - lift * 6, 2, 2);
    }
  } else if (id === "commuter") {
    ctx.translate(lift * -8, lift * -4);
    ctx.fillStyle = "#243044";
    ctx.fillRect(-6, -36, 12, 22);
    ctx.fillStyle = "#1a1420";
    ctx.fillRect(-4, -44, 10, 8);
    ctx.fillStyle = "#6a5344";
    ctx.fillRect(6, -24, 8, 10);
    ctx.fillStyle = "#2a2428";
    ctx.fillRect(-5, -14, 5, 12);
    ctx.fillRect(2, -14, 5, 12);
  } else if (id === "crossing_signal") {
    ctx.fillStyle = "#241c20";
    ctx.fillRect(-2, -78, 4, 76);
    ctx.fillStyle = "#f4efe6";
    ctx.fillRect(-10, -78, 20, 16);
    const blink = Math.sin(time * 8) > 0;
    ctx.fillStyle = blink ? "#e10600" : "#4a1814";
    ctx.fillRect(-6, -62, 12, 12);
    if (kind === "perfect" || kind === "good") {
      ctx.fillStyle = "#f5c518";
      ctx.fillRect(-6, -62, 12, 12);
    }
  } else if (id === "bin") {
    ctx.fillStyle = "#2a4034";
    ctx.fillRect(-10, -32, 20, 26);
    ctx.fillStyle = "#1a1420";
    ctx.fillRect(-12, -34, 24, 4);
    ctx.fillRect(-8, -6, 5, 5);
    ctx.fillRect(3, -6, 5, 5);
  } else if (id === "streetlight") {
    ctx.fillStyle = "#241c18";
    ctx.fillRect(-2, -92, 4, 90);
    const on = kind !== "soon" && kind !== "miss";
    ctx.fillStyle = on || lift ? "#f5c518" : "#3a3428";
    ctx.fillRect(-8, -98, 18, 8);
    if (on || lift) {
      ctx.fillStyle = "rgba(245, 197, 24, 0.25)";
      ctx.fillRect(-18, -90, 40, 70);
    }
  }
  ctx.restore();
}

function bird(ctx: Ctx, x: number, y: number, salt: number) {
  ctx.fillStyle = salt === 1 ? "#f4efe6" : "#d8d2c8";
  ctx.fillRect(x, y, 12, 4);
  ctx.fillRect(x - 4, y - 2, 6, 2);
  ctx.fillRect(x + 8, y - 1, 6, 2);
}

export function paintPips(ctx: Ctx, trigger: string[], x: number, y: number, hot: boolean) {
  const colors: Record<string, string> = { A: "#1f8cff", B: "#e10600", C: "#f5c518" };
  const total = trigger.length * 12 - 4;
  let px = Math.round(x - total / 2);
  for (const btn of trigger) {
    ctx.fillStyle = hot ? (colors[btn] ?? "#fff") : "#2a2428";
    ctx.fillRect(px, Math.round(y), 8, 8);
    ctx.fillStyle = "#0c0a0e";
    ctx.font = "6px 'Press Start 2P', monospace";
    // Pips are 8px wide: show the first glyph of the bound key.
    ctx.fillText((btn === "A" || btn === "B" || btn === "C" ? keyLabel(btn as Btn) : btn).slice(0, 1), px + 1, y + 7);
    px += 12;
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
