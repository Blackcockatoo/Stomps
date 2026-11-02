// Every sprite/stage/UI URL the game can request, read straight from the game's
// own tables (clips.ts, route.ts, promo.ts). Shared by check-assets (byte-identical audit)
// and the build (service-worker precache list).
import { buildSync } from 'esbuild';
import vm from 'node:vm';

export function gameUrls() {
  const code = buildSync({ stdin: { contents: "export * from './src/game/clips'; export { ROUTE_CARDS } from './src/game/route'; export { PROMO } from './src/game/promo';", resolveDir: '.', loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(code, sandbox);
  const { LAB_CLIPS, FX, STAGE, STAGE_CONCEPTS, UI, birdSrc, ROUTE_CARDS, PROMO } = sandbox.module.exports;
  const urls = new Set();
  for (const c of LAB_CLIPS) for (let i = 0; i < c.frames; i++) urls.add(c.src(i));
  for (const fx of Object.values(FX)) for (let i = 0; i < 8; i++) urls.add(fx(i));
  for (const s of [...STAGE, ...STAGE_CONCEPTS, ...ROUTE_CARDS]) if (s.src) urls.add(s.src);
  for (const url of Object.values(UI)) urls.add(url);
  for (const url of Object.values(PROMO)) urls.add(url);
  for (let i = 0; i < 4; i++) urls.add(birdSrc(i));
  return urls;
}
