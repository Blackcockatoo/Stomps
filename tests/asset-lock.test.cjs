// Asset lock (P6.2a): the original sprites, stages, UI and promo art must never
// change. check-assets proves public/ and dist/ match each other; this proves
// public/ still matches the originals, by SHA-256, file by file.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'original-assets.sha256.json'), 'utf8'));
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('asset lock: the fixture covers all 138 originals', () => {
  assert.equal(lock.count, 138);
  assert.equal(Object.keys(lock.files).length, lock.count);
  for (const [url, hash] of Object.entries(lock.files)) {
    assert.match(url, /^\/(moss|promo)\//, `unexpected path ${url}`);
    assert.match(hash, /^[0-9a-f]{64}$/, `bad hash for ${url}`);
    assert.ok(!url.startsWith('/moss/expansion/'), 'expansion art is additive, never locked as an original');
  }
});

test('asset lock: every original file is byte-for-byte unchanged in public/', () => {
  const changed = [];
  for (const [url, hash] of Object.entries(lock.files)) {
    const file = path.join(root, 'public', url);
    if (!fs.existsSync(file)) changed.push(`${url} is missing`);
    else if (sha(file) !== hash) changed.push(`${url} was modified`);
  }
  assert.deepEqual(changed, [], 'original assets must never be overwritten; add new art under public/moss/expansion/');
});

test('asset lock: the game requests exactly the locked originals', async () => {
  const cwd = process.cwd();
  process.chdir(root); // game-urls.mjs resolves ./src from the working directory
  try {
    const { gameUrls } = await import(path.join(root, 'scripts', 'game-urls.mjs'));
    const urls = [...gameUrls()].sort();
    assert.deepEqual(urls, Object.keys(lock.files).sort());
  } finally {
    process.chdir(cwd);
  }
});
