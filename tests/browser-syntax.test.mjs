import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('browser entry points and lazy UI modules all parse before publishing',()=>{
 const root=new URL('../',import.meta.url);
 for(const name of fs.readdirSync(root).filter(name=>/\.(mjs|js)$/.test(name))){
  const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL(name,root))],{encoding:'utf8'});
  assert.equal(result.status,0,`${name}: ${result.stderr}`);
 }
});
