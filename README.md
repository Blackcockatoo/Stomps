# MOSS STOMPER — Neon Strut / Hyper Drive

A B$S arcade original, built in Frankston. Original character artwork and signature footwork, rebuilt around a 120 Hz game simulation and display-rate rendering.

## Play

- **The Long Way Home:** one complete street route, scorecard and local personal best.
- **Street Strut:** free play through the evolving streets and day/night cycle.
- **Rhythm Royalty:** timed notes, holds, chords, original synthesised music and sync calibration.
- **Footwork Practice:** learn and land the five named combos.
- Animation Lab, stage cards, field notes and combo guide remain included.

Hold **A** to stride, tap **S** to stomp, use **D** for style. On phones, use the three large pads. Mix actions and time street interactions to build Quake Drive. At full charge, tap the bar or press A+S+D to unleash MOSSQUAKE. Escape pauses. Controls release on focus loss and the game pauses when hidden.

**Sound, sync & keys** (menu): volume and mute (also the SOUND toggle in the top bar), a tap-along that measures your audio/visual delay and offers a rhythm offset (SYNC −/+ still fine-tune it), and remappable keys. A **gamepad** (standard mapping) also works: bottom face button strides, right stomps, left styles, top unleashes MOSSQUAKE, Start pauses. Screen readers get short announcements for judgements, combos and milestones through a polite live region.

## Hyper Drive

10× point values throughout the scoring system, readable aggregated reward bursts, animated total score, street-status ranks, full-width segmented Quake Drive, continuous body springs, actual previous-pose trails, speed streaks and contact-timed dust/shockwaves. The fixed simulation keeps scoring and timing independent of display refresh rate. Reduced-motion settings remove cosmetic springs, trails, particles and shake. Original sprite PNGs are retained without resampling or repainting. Previous best scores migrate to the new scale.

No account, trackers, payments or online leaderboard. Bests, sync, sound and key settings live in one versioned browser save (`moss-stomper-save`, see `src/game/storage.ts`); the three older keys migrate into it automatically and are left in place. **Reset bests** is in Sound, sync & keys.

## Build and deploy

Node 22. `npm ci`, then `npm run check`: TypeScript, the unit suites, the production build and the asset audit.

- `npm test` runs the `node:test` suites in `tests/` (`feel`, `route`, `rhythm`, `storage`), which also cover calibration, gamepad mapping, key remapping and save migration.
- `npm run build` writes `dist/`: `index.html` references content-hashed `/assets/arcade-<hash>.js` and `.css` (with external sourcemaps and `assets/manifest.json`); everything in `public/` is copied byte-for-byte. `vercel.json` serves `/assets/*` immutable for a year and `index.html` with `max-age=0, must-revalidate`, so deploys are picked up immediately.
- The CSS is plain modern CSS bundled and minified by esbuild (no Tailwind step).
- `npm run smoke` (optional, after a build) drives the built site in headless Chrome under the production CSP. It uses `CHROME_PATH` or a system Chrome/Chromium and skips if none is found; `SMOKE_SHOTS=dir` saves screenshots. CI deliberately stays unit-only (`npm run check`) so browser and audio timing on shared runners cannot make it flaky.

Import this repository into Vercel. `vercel.json` sets the build command and `dist` output; no environment variables or backend are needed. The production build is a standalone static site. For a local preview after building: `npx serve dist`.

The repository includes every referenced game, lab, UI and stage asset, and the asset check verifies each one is byte-identical in the build. Sprites are deliberately **not** packed into atlases: that would break this guarantee. Instead the loader fetches in priority order (stage, strut frames and notes first, then the other moves, then effects and birds) and reports progress. The world-pack layout stills behind the route stage cards were never committed, so those cards are text-only until the art is added. The game is also published through the existing MOSS STOMPER Site.
