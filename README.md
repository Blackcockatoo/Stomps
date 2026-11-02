# MOSS STOMPER — Neon Strut / Hyper Drive

A B$S arcade original, built in Frankston. Original character artwork and signature footwork, rebuilt around a 120 Hz game simulation and display-rate rendering.

## Play

- **The Long Way Home:** one complete street route, scorecard and local personal best.
- **Street Strut:** free play through the evolving streets and day/night cycle.
- **Rhythm Royalty:** timed notes, holds, chords, original synthesised music and sync calibration.
- **Footwork Practice:** learn and land the five named combos.
- Animation Lab, stage cards, field notes and combo guide remain included.

Hold **A** to stride, tap **S** to stomp, use **D** for style. On phones, use the three large pads. Mix actions and time street interactions to build Quake Drive. At full charge, tap the bar or press A+S+D to unleash MOSSQUAKE. Escape pauses. Controls release on focus loss and the game pauses when hidden.

## Hyper Drive

10× point values throughout the scoring system, readable aggregated reward bursts, animated total score, street-status ranks, full-width segmented Quake Drive, continuous body springs, actual previous-pose trails, speed streaks and contact-timed dust/shockwaves. The fixed simulation keeps scoring and timing independent of display refresh rate. Reduced-motion settings remove cosmetic springs, trails, particles and shake. Original sprite PNGs are retained without resampling or repainting. Previous best scores migrate to the new scale.

No account, trackers, payments or online leaderboard. Best scores and rhythm calibration stay in browser storage.

## Build and deploy

Node 22. `npm ci`, then `npm run check` (TypeScript, gameplay regressions, production build and asset integrity).

Import this repository into Vercel. `vercel.json` sets the build command and `dist` output; no environment variables or backend are needed. The production build is a standalone static site. For a local preview after building: `npx serve dist`.

The repository includes every referenced game, lab, UI and stage asset. The asset check verifies each shipped file is byte-identical in the build. The game is also published through the existing MOSS STOMPER Site.
