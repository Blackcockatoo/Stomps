/** Presentation math is independent of scoring, input windows and the audio clock. */
export const POINT_SCALE = 10;
export const pointsFor = (base: number) => Math.round(base * POINT_SCALE);
export const styleRank = (chain: number) => chain >= 24 ? 'PAVEMENT ROYALTY' : chain >= 12 ? 'UNTOUCHABLE' : chain >= 6 ? 'ELECTRIC' : chain >= 3 ? 'FINDING FLOW' : 'MAKE YOUR MARK';

export class BodySpring {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  kick(x: number, y: number) { this.vx += x; this.vy += y; }
  step(dt: number) {
    // Fixed 120 Hz integration; critically damped enough to settle between footfalls.
    this.vx += (-150 * this.x - 19 * this.vx) * dt;
    this.vy += (-190 * this.y - 21 * this.vy) * dt;
    this.x = Math.max(-7, Math.min(7, this.x + this.vx * dt));
    this.y = Math.max(-5, Math.min(5, this.y + this.vy * dt));
  }
}
