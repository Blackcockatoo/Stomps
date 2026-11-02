# MOSS STOMPER — Neon Strut / Hyper Drive

A B$S arcade original, built in Frankston. Original character artwork and signature footwork, rebuilt around a 120 Hz game simulation and display-rate rendering.

## Play

- **The Long Way Home:** one complete street route, scorecard and local personal best.
- **Street Strut:** free play through the evolving streets and day/night cycle.
- **Rhythm Royalty:** timed notes, holds, chords, original synthesised music and sync calibration. Three charts: **EASY** (on the beat, no chords), **NORMAL** (the original chart) and **HARD** (eighth-note runs, hold-and-tap, triple chords). The last pick is remembered.
- **Footwork Practice:** learn and land the five named combos.
- Title screen and menu dressed with promo pixel art: TAP TO START, three mode tiles with BEST badges, a secondary row, arrow-key / D-pad focus. Animation Lab, stage cards, field notes and combo guide remain included.

Hold **A** to stride, tap **S** to stomp, use **D** for style. On phones, use the three large pads. Mix actions and time street interactions to build Quake Drive. At full charge, tap the bar or press A+S+D to unleash MOSSQUAKE. Escape pauses. Controls release on focus loss and the game pauses when hidden.

**Bonus world:** near the end of the pier a door opens once you fill Quake Drive or land eight hits in that lap. Strut through it for a short neon segment where every hit scores ×2, then you are dropped back on the pier and the route carries on. One door per lap; it stays boarded if you have not earned it.

**Cream hoodie** (Sound, sync & keys → LOOK): no new art. The red hoodie pixels of the original frames are recoloured to shaded cream on a canvas at load time (cached per frame); skin, jacket, sneakers and outlines are left alone and the PNGs on disk are untouched, so the byte-identical asset check still holds.

**Sound, sync & keys** (menu): volume and mute (also the SOUND toggle in the top bar), a tap-along that measures your audio/visual delay and offers a rhythm offset (SYNC −/+ still fine-tune it), and remappable keys. A **gamepad** (standard mapping) also works: bottom face button strides, right stomps, left styles, top unleashes MOSSQUAKE, Start pauses. In the menu the D-pad (or arrow keys) moves focus, bottom face / Start selects and right backs out of a panel. Screen readers get short announcements for judgements, combos and milestones through a polite live region.

## P3.3 — Pier Gauntlet

Six authored challenges now span the pier approach and deck. A flawless six-PERFECT sequence, with no misses, unlocks the Golden Bonus Door even without full Quake Drive; Golden Bonus events score triple rather than the standard double. The game displays the multiplier on the door, during the bonus and on the result screen. Pier mastery resets per lap, and all extra objects reuse existing assets. Tests cover threshold logic and scoring parity.

## P3.2 — Street Skills

Street interactions now support a signposted move and learned alternatives. Matching named combos at an encounter earn a signature technique reward. Precisely delayed actions can earn a close-call reward on non-person objects. Repeated journeys vary some existing shop and pier interactions deterministically without changing their positions or cue windows, so all challenges remain learnable. No new art or controls.

## Project Stratosphere — verified foundation release

- Inputs continue registering during the committed MOSSQUAKE animation. The newest presentation action gets a 220 ms handoff window; it is never scored again on dequeue. Combo gaps below 90 ms are rejected as accidental chords.
- Route points and Quake charge come from encounters and earned specials. Empty-pavement flourishes still animate, but cannot farm a route record. Free-play flourish rewards are limited to one per beat. Recovery restores a reduced chain without a bonus payout; settled encounters reject duplicates and out-of-window claims.
- D/C/B/A/S/S+/S++ grades use coverage, precision, longest FLOW, distinct contextual techniques and Golden execution. Advice appears on the result. New records are separate for the two canonical arrangements and this ruleset; legacy scores/settings stay readable.
- The original 104 BPM clock schedules FLOW percussion, melodic accents, high-FLOW flourishes and a celebratory bonus layer. Arrangement changes enter at bar boundaries; movement accents coalesce on eighth notes. MOSSQUAKE receives a grid-aligned accent. Recorded soundtrack support, calibration, mute and volume remain available.
- FLOW trails begin at level two, effects remain bounded, finished synth nodes disconnect, and stalled audio scheduling skips stale notes.
- Portrait play shows the entire street. Pause clears pending chords and buffered presentation actions.
- Whole-route deterministic input replays test both arrangements against repeated and varied mashing, including bonus transitions and completion. See `tests/stratosphere.test.cjs` and `tests/audio.test.cjs`.

Scope still open: performance-adaptive encounter composition, additional authored street sequences, new character transition artwork, full device battery/memory profiling, and physical Android/iPhone validation. Existing authored route variants, pier gauntlet, Golden World and environmental responses are retained, not presented as newly implemented features.

## P3.1 — MOSS FLOW (skill foundation)

Street encounters build a separate five-tier FLOW chain, from THE STRUT to PAVEMENT ROYALTY. Each clean encounter advances the chain; a missed encounter halves it, drains 10% Quake Drive and briefly stumbles Moss. A beat-accurate move during a visible 1.8-second recovery window restores most, not all, of the lost momentum. Plain movement earns modest flourish points and cannot build FLOW. Confirmed encounters replace rather than double-pay their button scores. The live HUD displays FLOW, route results show peak FLOW, and Rhythm Royalty and the local save schema remain unaffected. New unit tests exercise the skill rules.

## Hyper Drive

10× point values throughout the scoring system, readable aggregated reward bursts, animated total score, street-status ranks, full-width segmented Quake Drive, continuous body springs, actual previous-pose trails, speed streaks and contact-timed dust/shockwaves. The fixed simulation keeps scoring and timing independent of display refresh rate. Reduced-motion settings remove cosmetic springs, trails, particles and shake. Original sprite PNGs are retained without resampling or repainting. Previous best scores migrate to the new scale.

No account, trackers, payments or online leaderboard. Bests, sync, sound and key settings live in one versioned browser save (`moss-stomper-save`, see `src/game/storage.ts`); the three older keys migrate into it automatically and are left in place. **Reset bests** is in Sound, sync & keys.

## Soundtrack (optional)

The default groove is an original 104 BPM synth. To replace the synth with a recorded track, drop a file at `public/audio/neon-strut.ogg` (or `public/audio/neon-strut.mp3`) and rebuild. It must be **104 BPM with its first downbeat at 0 s**, because it is looped on the same beat clock the game judges against, and it must be original or properly licensed (no commercial samples). The build advertises it with a `<meta name="moss-soundtrack">` tag, the asset check verifies it is copied byte-for-byte, and the game decodes it after the first tap and loops it in sync; the synth drums and bass then mute while the sound effects stay. If the file is missing or fails to decode, the synth plays as before. No audio file ships in this repository.

## Install and offline (PWA)

The site has a web manifest and a build-generated service worker (`dist/sw.js`). On a phone, use **Add to Home Screen** (iOS Safari share sheet, or the Android Chrome install prompt) to get a full-screen MOSS STOMPER icon. After the first visit over HTTPS every game asset is precached, so it loads and plays offline; saves stay in the browser as before.

- The service worker only registers on secure contexts (HTTPS or `localhost`).
- Updates: the page is fetched network-first and the cache name is versioned by a hash of the build, so a new deploy is picked up on the next load after it lands (offline you keep the cached build). `sw.js` itself is served `no-cache`.
- Layout respects safe-area insets (`viewport-fit=cover`); portrait street play contains the full 480×270 playfield, preserving upcoming objects and timing cues.

## Build and deploy

Node 22. `npm ci`, then `npm run check`: TypeScript, the unit suites, the production build and the asset audit.

- `npm test` runs the `node:test` suites in `tests/` (`feel`, `route` (including promo art and menu focus), `rhythm`, `storage`, `skin`, `bonus`, `audio`, `view`, `report`), which also cover calibration, gamepad mapping, key remapping, save migration, difficulties, the bonus door and the soundtrack switch.
- `npm run build` writes `dist/`: `index.html` references content-hashed `/assets/arcade-<hash>.js` and `.css` (with external sourcemaps and `assets/manifest.json`); everything in `public/` is copied byte-for-byte. `vercel.json` serves `/assets/*` immutable for a year and `index.html` with `max-age=0, must-revalidate`, so deploys are picked up immediately.
- The CSS is plain modern CSS bundled and minified by esbuild (no Tailwind step).
- `npm run smoke` (optional, after a build) drives the built site in headless Chrome under the production CSP, including the service-worker offline reload and phone viewports at 390×844 and 360×740. It uses `CHROME_PATH` or a system Chrome/Chromium and skips if none is found; `SMOKE_SHOTS=dir` saves screenshots. CI deliberately stays unit-only (`npm run check`) so browser and audio timing on shared runners cannot make it flaky.

Import this repository into Vercel. `vercel.json` sets the build command and `dist` output; no environment variables or backend are needed. The production build is a standalone static site. For a local preview after building: `npx serve dist`.

The repository includes every referenced game, lab, UI and stage asset, and the asset check verifies each one is byte-identical in the build. Sprites are deliberately **not** packed into atlases: that would break this guarantee. Instead the loader fetches in priority order (stage, strut frames and notes first, then the other moves, then effects and birds) and reports progress. The station, strip and pier route cards (plus the Royal Rave door and Mossquake cards) use the promo stills below; the committed 04_STREET_BACKGROUNDS concept stills follow them in Stage Cards as "world pack concepts". The van and lighting-atlas cards stay text-only until matching art is added. The game is also published through the existing MOSS STOMPER Site.

## Promo art

`public/moss/promo/` holds pixel-art stills for the menu and promo surfaces, listed in `src/game/promo.ts`: `splash` (portrait title backdrop), `pier` (landscape title backdrop and Long Way Home tile), `strip`, `station`, `royal-rave` (Rhythm Royalty tile and the bonus-door card), `mossquake`, `damo-red` / `damo-cream` (LOOK previews) and `poster`. They are WebP, downscaled nearest-neighbour from the 720–1280 px renders, and each stays under 200 KB (a unit test enforces this). Like every other game asset they are copied byte-for-byte, byte-checked by `check-assets` and precached by the service worker. `og.jpg` (1200×630), `x-banner.jpg` (1200×264) and the PWA icons (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`) are made from the same set. Video clips are not shipped or precached.

Style note: the promo "Damo" (cap, black puffer, red or cream hoodie) is key art only. Moss in play is still the original sprite frames, and the cream hoodie is still a live recolour of the red frames, so the LOOK previews show the vibe rather than the exact in-game pixels. Do not swap promo art into the `public/moss/` sprite folders.
