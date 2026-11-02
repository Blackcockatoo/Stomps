export const REPORT = {
  supplied: [
    "V0.4 is an asset pack, not a game. The cleaned 12-frame strut was cropped and torn, so it stays in the lab only.",
    "V0.6 is a route, lighting, and street-event schema. Its 640×360 layers are blockouts and its props are silhouettes, so they are not the playfield.",
    "Usable originals still in the cabinet: button faces, rhythm notes, foreshore plates, and the dust, impact, spin, and spark strips.",
    "No audio files were in either pack. The groove is still an original 104 BPM synth.",
  ],
  inspection: [
    "The strut already shared one foot line. The world did not: one sunset foreshore, no route, and no fail-soft events.",
    "A timing window that shrinks when Moss strides faster would punish the move the game is about. The schema's milliseconds had to survive a speed change.",
    "A single A press must not be held for a chord delay, or the 135ms perfect window is already gone.",
  ],
  made: [
    "The long way home is one scroll: van, crossing, station, strip, pier, home, then the van again. No loading cut. The pavement plate never changes height.",
    "Dawn, day, sunset, and night are a grade on that same geometry. This build cycles them in three minutes so the change is visible. Fourteen minutes is still the schema's long setting.",
    "Twelve street events use the pack's buttons, scores, and words. The window is the authored milliseconds times the live ground speed. A matching tap scores immediately. A chord waits only while a longer open event could still complete.",
    "A miss pays nothing and does not stumble. People and birds are never damage. A full loop calls the long way home and keeps the score.",
    "Combos, MOSSQUAKE, rhythm, and the foot-locked cycles are the same machine underneath.",
  ],
  limits: [
    "Zone buildings are engine-drawn pixel scenery, not the unfinished V0.6 blockouts and not a hand-painted mile of Frankston.",
    "The foreshore plates now only frame the pier approach. The pier itself is engine-drawn: deck boards over open water, pilings, a back rail and lamps. No zone has a hand-painted bay of its own yet.",
    "There is still no cream-hoodie skin, no recorded soundtrack, and no bonus-world door. This pass was not tapped on a physical phone.",
  ],
  tests: [
    "Route audit: event gaps stay wider than a sprint telegraph plus a good window.",
    "Street Strut leaves the van on the shared pavement. A crossing stomp on the beat scores ON THE BEAT. A+D on the skateboard scores SIDEWINDER. Heel-Toe Hammer still returns to the strut.",
    "Passing a station event without its button adds a miss, does not take points, and does not play the stumble.",
    "Heel-Toe Hammer still fires. Landscape and portrait were checked in the browser, not on a handset.",
  ],
};