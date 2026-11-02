/** Route grades assess execution, never raw score or time spent farming. */
export const GRADES = ['D', 'C', 'B', 'A', 'S', 'S+', 'S++'] as const;
export type MasteryGrade = typeof GRADES[number];
export type Performance = { perfect: number; good: number; missed: number; expected: number; longest: number; techniques: number; bonus: number; golden: number };
export function assess(p: Performance): { grade: MasteryGrade; accuracy: number; advice: string } {
  const expected = Math.max(1, p.expected, p.perfect + p.good + p.missed);
  const coverage = (p.perfect + p.good) / expected;
  const accuracy = Math.min(1, (p.perfect + p.good * 0.65) / expected);
  let grade: MasteryGrade = accuracy >= 0.88 ? 'A' : accuracy >= 0.7 ? 'B' : accuracy >= 0.45 ? 'C' : 'D';
  if (accuracy >= 0.94 && coverage === 1 && p.longest >= 14 && p.techniques >= 2) grade = 'S';
  if (accuracy >= 0.98 && coverage === 1 && p.longest >= 14 && p.techniques >= 3 && p.bonus >= 1) grade = 'S+';
  if (p.perfect >= expected && p.good === 0 && p.missed === 0 && p.longest >= 14 && p.techniques >= 5 && p.golden >= 1) grade = 'S++';
  const advice = coverage < 1 ? 'Watch each warning and land a move at every encounter.' : accuracy < 0.98 ? 'Plant closer to the centre of the cue for more PERFECTs.' : p.techniques < 5 ? 'Land different signature techniques at matching street objects.' : p.golden < 1 ? 'Perfect all six pier encounters to reach the Golden World.' : 'Pavement royalty. Try the other route arrangement.';
  return { grade, accuracy: Math.round(accuracy * 100), advice };
}
