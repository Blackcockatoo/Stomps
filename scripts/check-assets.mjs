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
assert.ok(readFileSync('dist/index.html','utf8').includes('/arcade.js'));
console.log(`PASS: ${urls.size} game/lab/stage assets exist and remain byte-identical in dist.`);
