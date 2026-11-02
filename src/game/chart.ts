export type Lane = 0 | 1 | 2;

export type ChartNote = {
  time: number;
  lane: Lane;
  dur: number;
  id: number;
};

/** 104 BPM original chart. Times are seconds from the groove start. */
export function buildChart(beatDur: number): ChartNote[] {
  const b = (beat: number, lane: Lane, holdBeats = 0): Omit<ChartNote, "id"> => ({
    time: beat * beatDur,
    lane,
    dur: holdBeats * beatDur,
  });
  const raw: Omit<ChartNote, "id">[] = [
    b(4, 0),
    b(5, 1),
    b(6, 2),
    b(7, 1),
    b(8, 0),
    b(8, 2),
    b(9, 1),
    b(10, 0, 1),
    b(12, 1),
    b(12.5, 2),
    b(13, 0),
    b(14, 1),
    b(14, 2),
    b(15, 0),
    b(16, 2, 1),
    b(18, 0),
    b(18.5, 1),
    b(19, 2),
    b(19.5, 0),
    b(20, 1),
    b(20.5, 2),
    b(21, 0),
    b(21.5, 1),
    b(22, 0),
    b(22, 2),
    b(23, 1),
    b(24, 1, 2),
    b(27, 0),
    b(27.5, 1),
    b(28, 2),
    b(28.5, 1),
    b(29, 0),
    b(29.5, 2),
    b(30, 0),
    b(30, 1),
    b(30, 2),
    b(31, 2),
    b(31.5, 1),
    b(32, 0),
    b(33, 1, 1),
    b(35, 0),
    b(35.5, 2),
    b(36, 1),
    b(36.5, 0),
    b(37, 2),
    b(38, 0),
    b(38, 1),
    b(39, 2),
  ];
  return raw.map((note, id) => ({ ...note, id }));
}

export const CHART_END_BEAT = 42;
