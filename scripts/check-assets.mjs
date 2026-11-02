// Post-build asset audit, run by `npm run check` after `npm run build`.
//
// 1. Every sprite/stage/UI URL the game can request exists in public/ AND is
//    byte-identical in dist/. Sprite packing (atlases) is deliberately NOT done:
//    it would rewrite these files and break this byte-identical guarantee, and
//    the loader already preloads in priority order (see src/game/engine/loader.ts).
// 2. The hashed JS/CSS bundles named in dist/assets/manifest.json exist, carry
//    external sourcemaps, and are the files dist/index.html actually references.
// 3. The CSS still loads the self-hosted fonts, and index.html keeps its meta.
import assert from 'node:assert/strict';
import { gameUrls } from './game-urls.mjs';
import { existsSync, readFileSync } from 'node:fs';

const urls = gameUrls();
for (const url of urls) {
  assert.ok(existsSync('public' + url), 'Missing public asset: ' + url);
  assert.ok(existsSync('dist' + url), 'Missing built asset: ' + url);
  assert.deepEqual(readFileSync('public' + url), readFileSync('dist' + url), 'Asset changed during build: ' + url);
}

const manifest = JSON.parse(readFileSync('dist/assets/manifest.json', 'utf8'));
const html = readFileSync('dist/index.html', 'utf8');
for (const name of ['arcade.js', 'arcade.css']) {
  const url = manifest[name];
  assert.match(url ?? '', /^\/assets\/arcade-[A-Z0-9]{8}\.(js|css)$/, `manifest ${name} is not a hashed /assets path: ${url}`);
  assert.ok(existsSync('dist' + url), 'Missing hashed bundle: ' + url);
  assert.ok(existsSync('dist' + url + '.map'), 'Missing sourcemap: ' + url + '.map');
  const base = url.split('/').pop();
  assert.ok(readFileSync('dist' + url, 'utf8').includes(`sourceMappingURL=${base}.map`), `${url} does not link its sourcemap`);
  assert.ok(html.includes(`"${url}"`), `index.html does not reference ${url}`);
  assert.ok(!html.includes(`"/${name}"`), `index.html still references unhashed /${name}`);
}
const css = readFileSync('dist' + manifest['arcade.css'], 'utf8');
assert.ok(!/@theme|@tailwind|@layer/.test(css), 'built CSS contains unprocessed at-rules');
for (const font of ['/fonts/press-start-2p-latin-400.woff2', '/fonts/silkscreen-latin-400.woff2']) {
  assert.ok(existsSync('dist' + font), 'Missing built font: ' + font);
  assert.ok(css.includes(font), 'CSS does not load ' + font);
}
for (const meta of ['og:image', 'twitter:card', 'rel="canonical"', 'apple-touch-icon']) assert.ok(html.includes(meta), 'index.html missing ' + meta);

const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const cacheFor = (source) => vercel.headers.find((h) => h.source === source)?.headers.find((h) => h.key === 'Cache-Control')?.value ?? '';
assert.match(cacheFor('/assets/(.*)'), /immutable/, 'hashed assets must be served immutable');
assert.match(cacheFor('/index.html'), /max-age=0/, 'index.html must revalidate');


// 4. The soundtrack meta matches what is actually in public/audio.
for (const ext of ['ogg', 'mp3']) {
  const url = `/audio/neon-strut.${ext}`;
  if (existsSync('public' + url)) {
    assert.ok(html.includes(url), 'index.html does not advertise ' + url);
    assert.deepEqual(readFileSync('public' + url), readFileSync('dist' + url), 'Soundtrack changed during build: ' + url);
  } else assert.ok(!html.includes(url), 'index.html advertises missing ' + url);
}
// 5. PWA: manifest + generated service worker whose precache list is all in dist/.
const webmanifest = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
assert.equal(webmanifest.start_url, '/');
for (const icon of webmanifest.icons) assert.ok(existsSync('dist' + icon.src), 'Missing manifest icon: ' + icon.src);
assert.ok(html.includes('rel="manifest" href="/manifest.webmanifest"'), 'index.html does not link the manifest');
assert.ok(html.includes('viewport-fit=cover'), 'viewport must allow safe-area insets');
const sw = readFileSync('dist/sw.js', 'utf8');
assert.ok(!sw.includes('__PRECACHE__') && !sw.includes('__VERSION__'), 'sw.js placeholders not filled');
const precache = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
for (const url of [manifest['arcade.js'], manifest['arcade.css'], '/', ...urls]) assert.ok(precache.includes(url), 'sw.js does not precache ' + url);
for (const url of precache) if (url !== '/') assert.ok(existsSync('dist' + url), 'sw.js precaches missing ' + url);
assert.match(cacheFor('/sw.js'), /max-age=0/, 'sw.js must revalidate');
const csp = vercel.headers.find((h) => h.source === '/(.*)').headers.find((h) => h.key === 'Content-Security-Policy').value;
for (const directive of ["worker-src 'self'", "manifest-src 'self'", "script-src 'self'"]) assert.ok(csp.includes(directive), 'CSP missing ' + directive);
console.log(`PASS: ${urls.size} game/lab/stage assets byte-identical in dist; hashed bundles ${manifest['arcade.js']} + ${manifest['arcade.css']} with sourcemaps; sw.js precaches ${precache.length} URLs.`);
