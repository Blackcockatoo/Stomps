/**
 * P6 prop art (P6.2a): the traffic cone, drawn in code with the same recipe
 * as props.ts / stomp-art.ts (4 idle frames, baked once with the dark outline
 * and rim light). Nothing here loads or touches an image file.
 */
import { bakeArt, burst, hitSquash, idleFrame, type Art } from "../props";
import type { StompRun } from "../stompables";

type Ctx = CanvasRenderingContext2D;

const ORANGE: [string, string, string] = ["#b8400a", "#ff6a13", "#ffb070"];

export const CONE_ART: Art = { w: 18, h: 22, paint: (r, f) => {
  const [dark, base, light] = ORANGE;
  const sway = f === 2 ? 1 : 0;
  // Square rubber base.
  r(-9, -3, 18, 3, "#2a2026"); r(-9, -3, 18, 1, "#4a3e44");
  // Tapered body, 2 px narrower every 3 rows.
  for (let i = 0; i < 6; i++) {
    const half = 7 - i;
    const y = -6 - i * 3;
    const dx = i > 3 ? sway : 0;
    r(-half + dx, y, half * 2, 3, base);
    r(-half + dx, y, 2, 3, light);
    r(half - 2 + dx, y, 2, 3, dark);
  }
  // Two reflective white bands.
  r(-6, -11, 12, 2, "#f4efe6"); r(-6, -11, 2, 2, "#ffffff");
  r(-4, -17, 8, 2, "#f4efe6");
  // Tip.
  r(-1 + sway, -22, 2, 2, light);
} };

function blitCone(ctx: Ctx, frame: number, alpha = 1) {
  const baked = bakeArt("p6/cone", CONE_ART);
  if (!baked) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(baked.frames[frame % baked.frames.length]!, -baked.ax, -baked.ay);
  ctx.globalAlpha = 1;
}

/** One P6 prop in its current state. `x` is the screen x of its ground anchor. */
export function paintP6(ctx: Ctx, run: StompRun, x: number, ground: number, now: number, reduced: boolean) {
  if (run.kind !== "cone") return;
  const age = now - run.at;
  const f = idleFrame(now, Math.abs(Math.round(x / 43)) % 4, reduced);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(ground));
  switch (run.state) {
    case "idle":
      blitCone(ctx, f);
      break;
    case "airborne": {
      // Launched forward in an arc and spinning (short hop under reduced motion).
      const u = Math.min(1, age / 0.9);
      const reach = reduced ? 40 : 150;
      ctx.translate(u * reach, -Math.sin(u * Math.PI) * (reduced ? 10 : 46));
      if (!reduced) ctx.rotate(u * Math.PI * 3);
      blitCone(ctx, 0);
      break;
    }
    case "toppled":
      ctx.rotate(Math.PI / 2 * Math.min(1, reduced ? 1 : age / 0.18));
      blitCone(ctx, 0, 0.9);
      break;
    case "spent":
      if (run.act === "cone.spin") {
        if (age < 0.6 && !reduced) ctx.scale(Math.cos(age * 26), 1);
        blitCone(ctx, 0);
        if (age < 0.5) burst(ctx, 0, -14, age, run.grade === "PERFECT", reduced);
      } else if (run.act === "cone.step") {
        const [sx, sy] = hitSquash(age, reduced);
        ctx.scale(sx, sy);
        blitCone(ctx, f);
      }
      // Launched cones have flown off: nothing left to draw.
      break;
    default:
      break;
  }
  ctx.restore();
}
