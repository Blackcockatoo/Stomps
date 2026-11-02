import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
const code=buildSync({entryPoints:['src/game/clips.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const sandbox={module:{exports:{}}};vm.runInNewContext(code,sandbox);
const {PLAY_CLIPS,LAB_CLIPS,FX,STAGE,STAGE_CONCEPTS,UI,birdSrc}=sandbox.module.exports;
const urls=new Set();
for(const c of LAB_CLIPS)for(let i=0;i<c.frames;i++)urls.add(c.src(i));
for(const fx of Object.values(FX))for(let i=0;i<8;i++)urls.add(fx(i));
for(const s of [...STAGE,...STAGE_CONCEPTS])urls.add(s.src);
for(const url of Object.values(UI))urls.add(url);
for(let i=0;i<4;i++)urls.add(birdSrc(i));
for(const url of urls){assert.ok(existsSync('public'+url),'Missing public asset: '+url);assert.ok(existsSync('dist'+url),'Missing built asset: '+url);assert.deepEqual(readFileSync('public'+url),readFileSync('dist'+url),'Asset changed during build: '+url);}
const html=readFileSync('dist/index.html','utf8');
assert.ok(html.includes('/arcade.js'));
for(const font of ['/fonts/press-start-2p-latin-400.woff2','/fonts/silkscreen-latin-400.woff2']){assert.ok(existsSync('dist'+font),'Missing built font: '+font);assert.ok(readFileSync('dist/arcade.css','utf8').includes(font),'CSS does not load '+font);}
for(const meta of ['og:image','twitter:card','rel="canonical"','apple-touch-icon']){assert.ok(html.includes(meta),'index.html missing '+meta);}
console.log(`PASS: ${urls.size} game/lab/stage assets exist and remain byte-identical in dist.`);
