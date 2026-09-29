import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {profileError,estimate,allowed,buildPlan,totals,SLOTS} from '../planner.mjs';

const catalog=JSON.parse(fs.readFileSync(new URL('../catalog.json',import.meta.url)));
const base={age:42,height:165,weight:75,sex:'female',activity:'light',goal:'lose',mode:'calorie',calorieTarget:'',allergies:['milk']};
const byId=new Map(catalog.recipes.map(r=>[r.id,r]));

test('energy estimate changes with profile and goal',()=>{
  assert.equal(profileError(base),'');
  assert.ok(estimate(base).target<estimate({...base,goal:'maintain'}).target);
  assert.ok(estimate({...base,weight:85}).target>estimate(base).target);
  assert.ok(profileError({...base,age:15}));
});

test('generated day has four allergy-filtered meals near selected calories',()=>{
  const entries=buildPlan(catalog.recipes,catalog.ingredients,base);
  assert.ok(entries);
  assert.deepEqual(Object.keys(entries).sort(),SLOTS.map(([k])=>k).sort());
  for(const entry of Object.values(entries))assert.ok(allowed(byId.get(entry.id),catalog.ingredients,base.allergies));
  const actual=totals(entries,byId).kcal;
  assert.ok(Math.abs(actual-estimate(base).target)/estimate(base).target<.10);
});

test('macro mode honors priority and a swap avoids the current recipe',()=>{
  const p={...base,mode:'macro',protein:'130',carbs:'130',fat:'80',priority:'protein',allergies:[]};
  assert.equal(profileError(p),'');
  const current=buildPlan(catalog.recipes,catalog.ingredients,p);
  const locked={...current};delete locked.lunch;
  const next=buildPlan(catalog.recipes,catalog.ingredients,p,Math.random,locked,{lunch:current.lunch.id});
  assert.notEqual(next.lunch.id,current.lunch.id);
  for(const [k] of SLOTS)if(k!=='lunch')assert.deepEqual(next[k],current[k]);
  assert.ok(Number.isFinite(totals(next,byId).protein));
});
