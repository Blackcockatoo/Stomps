/**
 * Spatial focus for the menu (arrow keys / D-pad). Pure so it can be unit tested:
 * given the focused rect and candidate rects, pick the nearest one in a direction.
 * Candidates must lie on that side of the current centre; distance along the axis
 * counts once, drift across it counts double, so rows and columns feel straight.
 */
export type NavDir = "up" | "down" | "left" | "right";
export type Box = { x: number; y: number; w: number; h: number };

export function nearest(from: Box, boxes: readonly Box[], dir: NavDir): number {
  const cx = from.x + from.w / 2;
  const cy = from.y + from.h / 2;
  let best = -1;
  let bestScore = Infinity;
  boxes.forEach((b, i) => {
    const bx = b.x + b.w / 2;
    const by = b.y + b.h / 2;
    const dx = bx - cx;
    const dy = by - cy;
    const along = dir === "left" ? -dx : dir === "right" ? dx : dir === "up" ? -dy : dy;
    const across = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    if (along <= 1) return;
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}
