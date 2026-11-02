// Optional browser smoke test of the built site (run `npm run build` first).
//
//   npm run smoke                      # uses CHROME_PATH, then common system Chrome/Chromium paths
//   SMOKE_SHOTS=/tmp/shots npm run smoke   # also writes screenshots
//
// Serves dist/ with the headers from vercel.json (including the CSP), then drives
// the real bundle in headless Chrome: title screen → load progress → ready, menu arrow focus, live region, settings
// (mute, remap, persistence across reload), a remapped Street Strut run with pause,
// Rhythm Royalty (chart chooser), stage-card alt text, the soundtrack/synth switch, service-worker
// offline reload, phone viewports (390×844, 360×740), no console/CSP errors, and immutable hashed
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

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };
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
  // Every load opens on the title screen; any key dismisses it.
  const ready = async () => {
    await page.locator('.attract-gate').waitFor({ timeout: 20000 });
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /STREET STRUT/ }).and(page.locator(':enabled')).waitFor({ timeout: 20000 });
  };
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
    await page.getByRole('button', { name: /TAP TO START/ }).waitFor({ timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('.menu-hero img')?.complete && document.querySelector('.menu-hero img').naturalWidth > 0);
    await shot(page, '00-title');
    await ready();
    assert.equal(await page.locator('[role="status"][aria-live="polite"]').count(), 1, 'one polite live region');
    assert.equal(await page.locator('.mode-row .mode-tile').count(), 3, 'three primary mode tiles');
    assert.equal(await page.locator('.menu-secondary .cab-btn').count(), 7, 'seven secondary buttons (SCHOOL first)');
    await shot(page, '01-menu');
  });

  await step('arrow keys move a visible select cue across the menu', async () => {
    await page.waitForFunction(() => document.activeElement?.classList.contains('route-start'));
    await page.keyboard.press('ArrowRight');
    assert.match(await page.evaluate(() => document.activeElement?.textContent ?? ''), /STREET STRUT/);
    await page.keyboard.press('ArrowDown');
    assert.ok(await page.evaluate(() => !!document.activeElement?.closest('.menu-secondary')), 'down reaches the secondary row');
    await page.keyboard.press('ArrowUp');
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    assert.notEqual(outline, 'none', 'focused tile shows an outline');
    await page.keyboard.press('ArrowLeft');
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

  await step('first strut opens Street School; stride advances it, cues draw, SKIP hands over to the run', async () => {
    await page.getByRole('button', { name: /STREET STRUT/ }).click();
    await page.waitForFunction(() => window.__moss?.runKind === 'school');
    await page.locator('.school-card').waitFor();
    assert.match(await page.locator('.school-card').textContent(), /STEP 1 \/ 6/);
    await page.keyboard.down('KeyA');
    await page.waitForFunction(() => (window.__moss?.school?.step ?? 0) >= 1, null, { timeout: 8000 });
    await page.keyboard.up('KeyA');
    await page.waitForFunction(() => (window.__moss?.school?.cues ?? 0) >= 1, null, { timeout: 8000 });
    await page.waitForTimeout(700);
    assert.match(await page.locator('.school-card').textContent(), /STEP 2 \/ 6/);
    await page.waitForFunction(() => /Street School, step 2 of 6/.test(document.querySelector('[role="status"][aria-live="polite"]')?.textContent ?? ''), null, { timeout: 4000 });
    await shot(page, '03-school');
    const skip = await page.locator('.school-skip').boundingBox();
    assert.ok(skip && skip.height >= 44 && skip.width >= 44, 'skip is a ≥44px target');
    await page.locator('.school-skip').click();
    await page.waitForFunction(() => window.__moss?.runKind === 'free' && !window.__moss?.school);
    const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('moss-stomper-save')));
    assert.equal(saved.tutorialDone, true);
    assert.equal(await page.locator('.school-card').count(), 0);
  });

  await step('street strut runs on keyboard; Escape pauses and resumes', async () => {
    await page.waitForFunction(() => document.querySelector('.shell')?.className.includes('mode-strut'));
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(600);
    await page.keyboard.up('KeyA');
    await page.keyboard.press('KeyS');
    await shot(page, '04-strut');
    // Soundtrack: synth unless the build advertised public/audio/neon-strut.*.
    const advertised = readFileSync('dist/index.html', 'utf8').includes('name="moss-soundtrack"');
    await page.waitForFunction((want) => window.__moss?.soundtrack === want, advertised ? 'recorded' : 'synth', { timeout: 10000 });
    await page.keyboard.press('Escape');
    assert.match(await mode(), /mode-pause/);
    await page.keyboard.press('Escape');
    assert.match(await mode(), /mode-strut/);
  });

  await step('rhythm royalty chart chooser starts hard and remembers it', async () => {
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^(MENU|QUIT|EXIT)/ }).first().click().catch(() => {});
    await page.goto(origin + '/');
    await ready();
    await page.getByRole('button', { name: /RHYTHM ROYALTY/ }).click();
    await page.getByRole('button', { name: /^HARD/ }).click();
    await page.waitForFunction(() => document.querySelector('.shell')?.className.includes('mode-rhythm'));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('moss-stomper-save') ?? '{}').difficulty);
    assert.equal(saved, 'hard');
    await page.waitForTimeout(1500);
    await shot(page, '05-rhythm');
  });

  await step('service worker installs and the game reloads offline', async () => {
    await page.goto(origin + '/');
    await ready();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    });
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    assert.equal(manifestHref, '/manifest.webmanifest');
    await context.setOffline(true);
    await page.reload();
    await ready();
    await context.setOffline(false);
  });

  for (const [width, height] of [[390, 844], [360, 740]]) {
    await step(`phone ${width}×${height}: no sideways scroll, ≥44px pads clear of the HUD, canvas HUD inside the crop`, async () => {
      const phone = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const tab = await phone.newPage();
      tab.on('pageerror', (err) => problems.push(`phone ${width} pageerror: ` + (err.stack ?? err.message)));
      tab.on('response', (r) => r.status() >= 400 && problems.push(`phone ${width} http ${r.status()}: ${r.url()}`));
      tab.on('console', (msg) => msg.type() === 'error' && problems.push(`phone ${width} console: ` + msg.text()));
      await tab.goto(origin + '/');
      assert.match(await tab.locator('meta[name="viewport"]').getAttribute('content'), /viewport-fit=cover/);
      await tab.locator('.attract-gate').waitFor({ timeout: 20000 });
      await shot(tab, `06-phone-${width}-title`);
      await tab.locator('.attract-gate').tap();
      await tab.locator('.route-start').and(tab.locator(':enabled')).waitFor({ timeout: 20000 });
      await shot(tab, `07-phone-${width}-menu`);
      const targets = await tab.locator('.menu-card button').evaluateAll((els) => els.map((el) => { const b = el.getBoundingClientRect(); return [el.textContent, b.width, b.height, b.right, b.bottom]; }));
      for (const [label, w, h, r, b] of targets) {
        assert.ok(w >= 44 && h >= 44, `menu target ≥44px: ${label} ${w}×${h}`);
        assert.ok(r <= width && b <= height, `menu target on screen: ${label}`);
      }
      await tab.locator('.route-start').click();
      await tab.waitForFunction(() => window.__moss?.runKind === 'school');
      await tab.waitForTimeout(400);
      await shot(tab, `08-phone-${width}-school`);
      const skip = await tab.locator('.school-skip').boundingBox();
      assert.ok(skip && skip.width >= 44 && skip.height >= 44 && skip.x >= 0 && skip.x + skip.width <= width && skip.y + skip.height <= height, `school skip ≥44px and on screen (${JSON.stringify(skip)})`);
      await tab.locator('.school-skip').tap();
      await tab.waitForFunction(() => window.__moss?.mode === 'strut' && window.__moss?.runKind === 'route');
      await tab.waitForTimeout(600);
      const m = await tab.evaluate(() => {
        const box = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
        return {
          scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth,
          pads: [...document.querySelectorAll('.dock .pad')].map(box),
          huds: [...document.querySelectorAll('.live-hud, .topbar')].map(box),
          view: window.__moss.view,
        };
      });
      assert.ok(m.scroll <= m.client, `no horizontal overflow (${m.scroll} > ${m.client})`);
      assert.equal(m.pads.length, 3, 'three touch pads');
      for (const pad of m.pads) {
        assert.ok(pad.w >= 44 && pad.h >= 44, `pad ≥44px (${pad.w}×${pad.h})`);
        assert.ok(pad.r <= width && pad.b <= height && pad.l >= 0, 'pad fully on screen');
        for (const hud of m.huds) assert.ok(pad.r <= hud.l || pad.l >= hud.r || pad.b <= hud.t || pad.t >= hud.b, 'pad does not cover the HUD');
      }
      // The canvas HUD must lay out inside the visible slice (full span under object-fit: contain, a crop under cover).
      assert.ok(m.view.left >= 0 && m.view.right <= 480 && m.view.left < 132 && m.view.right > 132, `cropped view keeps Moss on screen (${JSON.stringify(m.view)})`);
      await shot(tab, `09-phone-${width}-route`);
      await phone.close();
    });
  }

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
