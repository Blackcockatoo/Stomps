// Optional browser smoke test of the built site (run `npm run build` first).
//
//   npm run smoke                      # uses CHROME_PATH, then common system Chrome/Chromium paths
//   SMOKE_SHOTS=/tmp/shots npm run smoke   # also writes screenshots
//
// Serves dist/ with the headers from vercel.json (including the CSP), then drives
// the real bundle in headless Chrome: load progress → ready, live region, settings
// (mute, remap, persistence across reload), a remapped Street Strut run with pause,
// Rhythm Royalty, stage-card alt text, no console/CSP errors, and immutable hashed
// assets. If no browser is found it prints SKIP and exits 0.
//
// CI stays unit-only (`npm run check`): a headless browser + audio/timing on shared
// runners is the kind of thing that flakes, and the unit suites cover the logic.
import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const candidates = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const chrome = candidates.find((p) => existsSync(p));
if (!chrome) {
  console.log('SKIP: no Chrome/Chromium found (set CHROME_PATH to run the smoke test).');
  process.exit(0);
}
if (!existsSync('dist/index.html')) {
  console.error('dist/ is missing: run `npm run build` first.');
  process.exit(1);
}
const { chromium } = await import('playwright-core');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const rules = JSON.parse(readFileSync('vercel.json', 'utf8')).headers.map((rule) => ({ re: new RegExp('^' + rule.source + '$'), headers: rule.headers }));
const server = http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  const file = path.join('dist', url === '/' ? 'index.html' : url);
  if (!path.resolve(file).startsWith(path.resolve('dist'))) return res.writeHead(403).end();
  const headers = { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' };
  for (const rule of rules) if (rule.re.test(url)) for (const h of rule.headers) headers[h.key] = h.value; // later rules win, like Vercel
  try {
    const body = await readFile(file);
    res.writeHead(200, headers).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const shots = process.env.SMOKE_SHOTS;
if (shots) await mkdir(shots, { recursive: true });
const shot = async (page, name) => shots && page.screenshot({ path: path.join(shots, name + '.png') });

const browser = await chromium.launch({ executablePath: chrome, args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const problems = [];
let passed = 0;
const step = async (name, fn) => {
  await fn();
  passed++;
  console.log('ok -', name);
};

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.on('pageerror', (err) => problems.push('pageerror: ' + (err.stack ?? err.message)));
  page.on('response', (r) => r.status() >= 400 && problems.push(`http ${r.status()}: ${r.url()}`));
  page.on('console', (msg) => msg.type() === 'error' && problems.push('console: ' + msg.text()));
  const ready = () => page.getByRole('button', { name: /STREET STRUT/ }).and(page.locator(':enabled')).waitFor({ timeout: 20000 });
  const mode = () => page.locator('.shell').getAttribute('class');

  await step('hashed bundles are immutable, index revalidates', async () => {
    const manifest = JSON.parse(readFileSync('dist/assets/manifest.json', 'utf8'));
    const js = await fetch(origin + manifest['arcade.js']);
    assert.match(js.headers.get('cache-control') ?? '', /immutable/);
    const index = await fetch(origin + '/');
    assert.match(index.headers.get('cache-control') ?? '', /max-age=0/);
    assert.match(index.headers.get('content-security-policy') ?? '', /script-src 'self'/);
  });

  await step('boots under the production CSP and reaches ready', async () => {
    await page.goto(origin + '/');
    await ready();
    assert.equal(await page.locator('[role="status"][aria-live="polite"]').count(), 1, 'one polite live region');
    await shot(page, '01-menu');
  });

  await step('stage cards carry alt text', async () => {
    await page.getByRole('button', { name: 'STAGE CARDS' }).click();
    const alts = await page.locator('img.stage-card').evaluateAll((imgs) => imgs.map((i) => i.alt));
    assert.ok(alts.length > 0, 'stage card images render');
    assert.ok(alts.every((a) => a.trim().length > 8), 'every stage card has descriptive alt: ' + JSON.stringify(alts));
    await page.getByRole('button', { name: 'BACK' }).first().click();
  });

  await step('settings: mute + remap persist across reload', async () => {
    await page.getByRole('button', { name: /SOUND, SYNC/ }).click();
    await shot(page, '02-settings');
    await page.locator('.settings').getByRole('button', { name: /^MUTE$/ }).click();
    await page.getByRole('button', { name: /STRIDE is A/ }).click();
    await page.keyboard.press('KeyJ');
    await page.getByRole('button', { name: /STRIDE is J/ }).waitFor();
    await page.reload();
    await ready();
    const save = JSON.parse(await page.evaluate(() => localStorage.getItem('moss-stomper-save')));
    assert.equal(save.audio.muted, true);
    assert.equal(save.keys.A, 'KeyJ');
    assert.ok(await page.getByRole('button', { name: /MUTED|Unmute/i }).count(), 'topbar shows muted state');
  });

  await step('tap-along calibration measures and offers an offset', async () => {
    await page.getByRole('button', { name: /SOUND, SYNC/ }).click();
    await page.getByRole('button', { name: 'START TAP-ALONG' }).click();
    const pad = page.locator('.tap-pad');
    await pad.waitFor();
    await shot(page, '03-calibrate');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('KeyJ');
      await page.waitForTimeout(577);
    }
    await page.getByRole('button', { name: /^USE / }).or(page.getByText(/Not enough taps/)).first().waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: /DEFAULT \(A S D\)/ }).click();
    await page.getByRole('button', { name: /STRIDE is A/ }).waitFor();
    await page.getByRole('button', { name: 'BACK' }).first().click();
  });

  await step('street strut runs on keyboard; Escape pauses and resumes', async () => {
    await page.getByRole('button', { name: /STREET STRUT/ }).click();
    await page.waitForFunction(() => document.querySelector('.shell')?.className.includes('mode-strut'));
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(600);
    await page.keyboard.up('KeyA');
    await page.keyboard.press('KeyS');
    await shot(page, '04-strut');
    await page.keyboard.press('Escape');
    assert.match(await mode(), /mode-pause/);
    await page.keyboard.press('Escape');
    assert.match(await mode(), /mode-strut/);
  });

  await step('rhythm royalty starts', async () => {
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^(MENU|QUIT|EXIT)/ }).first().click().catch(() => {});
    await page.goto(origin + '/');
    await ready();
    await page.getByRole('button', { name: /RHYTHM ROYALTY/ }).click();
    await page.waitForFunction(() => document.querySelector('.shell')?.className.includes('mode-rhythm'));
    await page.waitForTimeout(1500);
    await shot(page, '05-rhythm');
  });

  await step('no console, page or CSP errors', async () => {
    assert.deepEqual(problems, []);
  });
  await context.close();
  console.log(`PASS: smoke ${passed} steps (${chrome})`);
} catch (error) {
  console.error('FAIL:', error.message);
  if (problems.length) console.error(problems.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
