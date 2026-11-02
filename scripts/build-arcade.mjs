// Static production build: content-hashed JS/CSS with linked external sourcemaps.
//
//   dist/index.html                  (refs rewritten to the hashed files; served no-cache)
//   dist/assets/arcade-<hash>.js     (+ .js.map)   immutable, 1 year
//   dist/assets/arcade-<hash>.css    (+ .css.map)  immutable, 1 year
//   dist/assets/manifest.json        (logical name → hashed path, used by check-assets)
//   dist/<everything in public/>     (copied byte-for-byte; sprites keep their own paths)
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = 'dist';
const ASSETS = `${OUT}/assets`;

await rm(OUT, { recursive: true, force: true });
await mkdir(ASSETS, { recursive: true });
await cp('public', OUT, { recursive: true });

const shared = {
  bundle: true,
  minify: true,
  sourcemap: 'linked',
  metafile: true,
  outdir: ASSETS,
  entryNames: '[name]-[hash]',
  logLevel: 'warning',
};

const js = await build({
  ...shared,
  entryPoints: { arcade: 'src/arcade-entry.tsx' },
  format: 'esm',
  target: 'es2022',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: { '@': './src' },
});

const css = await build({
  ...shared,
  entryPoints: { arcade: 'src/styles.css' },
  // Fonts are served from public/fonts with their own immutable cache rule.
  external: ['/fonts/*'],
});

/** Public URL of the single entry output with the given extension. */
function entryUrl(result, ext) {
  const outs = Object.entries(result.metafile.outputs).filter(([file, meta]) => meta.entryPoint && file.endsWith(ext));
  if (outs.length !== 1) throw new Error(`expected one ${ext} entry output, got ${outs.length}`);
  return '/' + path.relative(OUT, outs[0][0]).split(path.sep).join('/');
}

const manifest = { 'arcade.js': entryUrl(js, '.js'), 'arcade.css': entryUrl(css, '.css') };
await writeFile(`${ASSETS}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');

let html = await readFile('arcade.html', 'utf8');
for (const [name, url] of Object.entries(manifest)) {
  const ref = `"/${name}"`;
  if (!html.includes(ref)) throw new Error(`arcade.html does not reference ${ref}`);
  html = html.replace(ref, `"${url}"`);
}
// Optional recorded soundtrack (see src/game/audio.ts). Advertised with a meta tag
// so the game never probes for a file that is not there.
const tracks = ['ogg', 'mp3'].map((ext) => `/audio/neon-strut.${ext}`).filter((url) => existsSync('public' + url));
if (tracks.length) html = html.replace('</head>', `<meta name="moss-soundtrack" content="${tracks.join(',')}">\n</head>`);
await writeFile(`${OUT}/index.html`, html);

const kb = (file) => (Object.values(file.metafile.outputs).find((o) => o.entryPoint)?.bytes ?? 0) / 1024;
console.log(`Arcade built: ${manifest['arcade.js']} (${kb(js).toFixed(1)} kB), ${manifest['arcade.css']} (${kb(css).toFixed(1)} kB).`);
console.log(tracks.length ? `Soundtrack: ${tracks.join(', ')}` : 'Soundtrack: none (synth groove)');
