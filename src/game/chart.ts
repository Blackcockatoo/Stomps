export type Lane = 0 | 1 | 2;

export type ChartNote = {
  time: number;
  lane: Lane;
  dur: number;
  id: number;
};

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];
export const DIFFICULTY_INFO: Record<Difficulty, { label: string; blurb: string }> = {
  easy: { label: "EASY", blurb: "On the beat. No chords. Find the pocket." },
  normal: { label: "NORMAL", blurb: "The original chart. Off-beats, chords and holds." },
  hard: { label: "HARD", blurb: "Eighth-note runs, hold-and-tap, triple chords." },
};

export function isDifficulty(value: unknown): value is Difficulty {
  return value === "easy" || value === "normal" || value === "hard";
}

/** Every chart ends before this beat; the song (and the result screen) lands here. */
export const CHART_END_BEAT = 42;

/** [beat, lane, holdBeats]. */
type Raw = readonly [number, Lane, number?];

/** 104 BPM original chart (unchanged from the first release). */
const NORMAL: Raw[] = [
  [4, 0], [5, 1], [6, 2], [7, 1], [8, 0], [8, 2], [9, 1], [10, 0, 1],
  [12, 1], [12.5, 2], [13, 0], [14, 1], [14, 2], [15, 0], [16, 2, 1],
  [18, 0], [18.5, 1], [19, 2], [19.5, 0], [20, 1], [20.5, 2], [21, 0], [21.5, 1], [22, 0], [22, 2], [23, 1],
  [24, 1, 2],
  [27, 0], [27.5, 1], [28, 2], [28.5, 1], [29, 0], [29.5, 2], [30, 0], [30, 1], [30, 2],
  [31, 2], [31.5, 1], [32, 0], [33, 1, 1],
  [35, 0], [35.5, 2], [36, 1], [36.5, 0], [37, 2], [38, 0], [38, 1], [39, 2],
];

/** Eighth-note run: each lane recurs a full beat apart, so taps are never ambiguous. */
const RUN: Lane[] = [0, 1, 2, 1, 0, 2, 1, 2];
function run(from: number, count: number, offset = 0): Raw[] {
  return Array.from({ length: count }, (_, i) => [from + i * 0.5, RUN[(i + offset) % RUN.length]!] as Raw);
}

const HARD: Raw[] = [
  ...run(4, 8),
  [8, 0], [8, 2], [8.5, 1], [9, 0, 1], [9.5, 2], [10, 1], [10.5, 2],
  [11, 0], [11.5, 1], [12, 1], [12, 2], [12.5, 0], [13, 2, 1], [13.5, 1], [14, 0], [14.5, 1],
  [15, 0], [15, 1], [15, 2],
  // Hold-and-tap: keep the stride lane held while the other hands work.
  [16, 0, 2], [16.5, 1], [17, 2], [17.5, 1], [18, 2],
  [18.5, 0], [19, 1], [19.5, 2], [20, 0], [20, 2],
  ...run(20.5, 7, 1),
  [24, 1, 2], [24.5, 0], [25, 2], [25.5, 0], [26, 2],
  [27, 0], [27, 2], [27.5, 1], [28, 0], [28.5, 2], [29, 1], [29.5, 0], [30, 0], [30.5, 1], [30.5, 2],
  [31.5, 0], [31.5, 1], [31.5, 2],
  [32.5, 2, 2], [33, 0], [33.5, 1], [34, 0], [34.5, 1],
  ...run(35, 6, 2),
  [38, 0], [38, 1], [38.5, 2], [39, 0, 1], [39, 2], [39.5, 1], [40.5, 0], [40.5, 1], [40.5, 2],
];

/**
 * Easy: the Normal chart's on-beat notes only, chords collapsed to one lane,
 * holds kept, and at least one beat between notes.
 */
function easyFrom(normal: Raw[]): Raw[] {
  const out: Raw[] = [];
  let lastEnd = -Infinity;
  for (const note of normal) {
    const [beat, , hold = 0] = note;
    if (!Number.isInteger(beat)) continue;
    if (beat - lastEnd < 1) continue;
    out.push(note);
    lastEnd = beat + hold;
  }
  return out;
}

const RAW: Record<Difficulty, Raw[]> = { easy: easyFrom(NORMAL), normal: NORMAL, hard: HARD };

/** Builds the chart for one difficulty. Times are seconds from the groove start. */
export function buildChart(beatDur: number, difficulty: Difficulty = "normal"): ChartNote[] {
  return RAW[difficulty]
    .map(([beat, lane, hold = 0]) => ({ time: beat * beatDur, lane, dur: hold * beatDur }))
    .sort((a, b) => a.time - b.time || a.lane - b.lane)
    .map((note, id) => ({ ...note, id }));
}

/**
 * Fairness audit used by the tests: a lane never repeats inside the judge
 * window of its previous note (or hold tail), chords are at most three lanes,
 * and everything ends before the song does. Returns human-readable problems.
 */
export function auditChart(notes: ChartNote[], beatDur: number, minGapBeats = 0.5): string[] {
  const problems: string[] = [];
  const free: number[] = [-Infinity, -Infinity, -Infinity];
  const seen = new Set<string>();
  for (const note of [...notes].sort((a, b) => a.time - b.time)) {
    const key = `${note.lane}@${note.time.toFixed(4)}`;
    if (seen.has(key)) problems.push(`duplicate ${key}`);
    seen.add(key);
    if (note.time - free[note.lane]! < minGapBeats * beatDur - 1e-9) {
      problems.push(`lane ${note.lane} crowded at beat ${(note.time / beatDur).toFixed(2)}`);
    }
    free[note.lane] = note.time + note.dur;
    if (note.time + note.dur > (CHART_END_BEAT - 1) * beatDur) problems.push(`note past the end at ${note.time}`);
  }
  return problems;
}
