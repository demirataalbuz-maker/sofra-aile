import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mergeCatalog} from '../catalog.mjs';
const base=JSON.parse(fs.readFileSync(new URL('../catalog.json',import.meta.url)));
const daily=JSON.parse(fs.readFileSync(new URL('../daily-catalog.json',import.meta.url)));
test('published daily recipes have valid ingredients, macros and local images',()=>{
  const merged=mergeCatalog(base,daily);
  assert.ok(merged.recipes.length>=base.recipes.length);
  for(const r of daily.recipes)assert.ok(fs.existsSync(new URL('../'+r.image,import.meta.url)));
});
test('Android refresh preserves daily additions and does not duplicate migrated recipes',()=>{
  const r={...base.recipes[0],id:'daily-test',title:'Daily test'};
  const extra={recipes:[r],ingredients:{}};
  const merged=mergeCatalog(base,extra);
  assert.equal(merged.recipes[0].id,r.id);
  assert.equal(merged.recipes.length,base.recipes.length+1);
  assert.equal(mergeCatalog(merged,extra).recipes.length,merged.recipes.length);
  assert.throws(()=>mergeCatalog(base,{...extra,recipes:[{...r,items:[['missing-ingredient',100]]}]}));
});
