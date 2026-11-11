const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildSync } = require('esbuild');

const out = buildSync({ entryPoints: [path.resolve(__dirname, '../src/game/i18n.ts')], bundle: true, format: 'cjs', platform: 'node', write: false });
const mod = { exports: {} };
new Function('module', 'exports', 'require', out.outputFiles[0].text)(mod, mod.exports, require);
const { MENU_COPY, LANGS, detectLang } = mod.exports;

test('every language has every menu string', () => {
  const keys = Object.keys(MENU_COPY.en).sort();
  for (const lang of LANGS) {
    assert.deepEqual(Object.keys(MENU_COPY[lang]).sort(), keys, lang);
    for (const key of keys) {
      const value = MENU_COPY[lang][key];
      const text = typeof value === 'function' ? value(42) : value;
      assert.ok(typeof text === 'string' && text.trim().length > 0, `${lang}.${key}`);
    }
  }
  assert.match(MENU_COPY.ja.loading(7), /7%/);
  assert.match(MENU_COPY.hi.loading(7), /7%/);
});

test('language detection: query, then saved, then browser, then English', () => {
  assert.equal(detectLang('?lang=hi', 'ja', ['en-AU']), 'hi');
  assert.equal(detectLang('?lang=xx', 'ja', ['hi-IN']), 'ja');
  assert.equal(detectLang('', null, ['fr-FR', 'ja-JP']), 'ja');
  assert.equal(detectLang('', null, ['hi-IN']), 'hi');
  assert.equal(detectLang('', 'de', ['en-AU']), 'en');
  assert.equal(detectLang('', null, []), 'en');
});
