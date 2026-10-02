import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mealItems,mealTimes,orderedSlots,totals,targetStatus,replacementOptions,validReplacement,rememberRecommendations,buildPlan,SLOTS} from '../planner.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../catalog.json',import.meta.url)));
const byId=new Map(catalog.recipes.map(r=>[r.id,r]));
const p={age:18,height:165,weight:75,sex:'female',activity:'light',goal:'maintain',mode:'calorie',calorieTarget:1700,allergies:['milk']};
function seeded(seed=33){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}

test('editable schedule sorts meals chronologically and still has one snack regardless of portion count',()=>{
  assert.deepEqual(orderedSlots().map(([k])=>k),['breakfast','lunch','snack','dinner']);
  assert.deepEqual(orderedSlots({snack:'10:30'}).map(([k])=>k),['breakfast','snack','lunch','dinner']);
  assert.equal(mealTimes({snack:'25:00'}).snack,'16:00');
  assert.equal(mealTimes({breakfast:'7:00'}).breakfast,'08:00');
  assert.equal(orderedSlots().filter(([k])=>k==='snack').length,1);
  assert.equal(mealItems({id:'example',portion:2}).length,1);
});

test('single and combo previews preserve other meals and daily limits, cover images, and persist both foods',()=>{
  let entries=buildPlan(catalog.recipes,catalog.ingredients,p,seeded());
  const original=JSON.stringify(entries);
  for(const kind of ['single','combo'])for(const [slot] of SLOTS){
    const options=replacementOptions(catalog.recipes,catalog.ingredients,p,entries,slot,{kind});
    assert.ok(options.length>0,`${slot} ${kind} should have options`);assert.ok(options.length<=8);
    for(const option of options){
      assert.equal(mealItems(option.entry).length,kind==='combo'?2:1);
      assert.ok(validReplacement(entries,slot,option.entry,catalog.recipes,catalog.ingredients,p));
      for(const e of mealItems(option.entry))assert.ok(fs.existsSync(new URL('../'+byId.get(e.id).image,import.meta.url)));
      const next={...entries,[slot]:option.entry};
      assert.deepEqual(option.daily,totals(next,byId));assert.ok(targetStatus(next,byId,p).ok);
      for(const [key] of SLOTS)if(key!==slot)assert.deepEqual(next[key],entries[key]);
    }
  }
  assert.equal(JSON.stringify(entries),original);
  const chosen=replacementOptions(catalog.recipes,catalog.ingredients,p,entries,'lunch',{kind:'combo'})[0];
  entries=JSON.parse(JSON.stringify({...entries,lunch:chosen.entry}));
  assert.deepEqual(totals(entries,byId),chosen.daily);
  const history=rememberRecommendations({},entries,1000);
  for(const item of mealItems(entries.lunch))assert.equal(history[item.id],1000);
  const locked={...entries};delete locked.breakfast;
  const next=buildPlan(catalog.recipes,catalog.ingredients,p,seeded(),locked,{breakfast:entries.breakfast.id});
  assert.ok(next);assert.deepEqual(next.lunch,entries.lunch);
});

test('repeated mixed replacements never compound tolerance or relax macro ceilings',()=>{
  for(const profile of [p,{...p,mode:'macro',protein:130,carbs:130,fat:80,priority:'protein',allergies:[]}]){
    let entries=buildPlan(catalog.recipes,catalog.ingredients,profile,seeded());let history={};let changes=0;
    for(let i=0;i<20;i++){
      const slot=SLOTS[i%4][0];
      const option=replacementOptions(catalog.recipes,catalog.ingredients,profile,entries,slot,{kind:i%2?'combo':'single',history})[0];
      if(!option)continue;
      entries={...entries,[slot]:option.entry};changes++;
      assert.ok(targetStatus(entries,byId,profile).ok);
      history=rememberRecommendations(history,{[slot]:option.entry});
    }
    assert.ok(changes>=10);
  }
});

test('released calorie budget can transfer across meals without changing the fixed daily target',()=>{
  const recipes=[['a',400],['b',400],['c',600],['d',300],['less',360],['more',440],['tooMuch',800]].map(([id,kcal])=>({id,macros:{kcal,protein:20,carbs:40,fat:10},items:[]}));
  const map=new Map(recipes.map(r=>[r.id,r]));
  const entries={breakfast:{id:'a',portion:1},lunch:{id:'b',portion:1},dinner:{id:'c',portion:1},snack:{id:'d',portion:1}};
  assert.equal(totals(entries,map).kcal,1700);
  const less={id:'less',portion:1};assert.ok(validReplacement(entries,'breakfast',less,recipes,{},p));
  const next={...entries,breakfast:less};assert.equal(totals(next,map).kcal,1660);
  assert.ok(validReplacement(next,'lunch',{id:'more',portion:1},recipes,{},p));
  assert.equal(totals({...next,lunch:{id:'more',portion:1}},map).kcal,1700);
  assert.equal(validReplacement(next,'lunch',{id:'tooMuch',portion:1},recipes,{},p),false);
  assert.equal(p.calorieTarget,1700);
});

test('confirmation rejects invalid portion, duplicate food, missing meal and allergenic combo component',()=>{
  const entries=buildPlan(catalog.recipes,catalog.ingredients,p,seeded());
  const option=replacementOptions(catalog.recipes,catalog.ingredients,p,entries,'lunch',{kind:'combo'})[0];
  const items=mealItems(option.entry);
  assert.equal(validReplacement(entries,'lunch',{items:[items[0],items[0]]},catalog.recipes,catalog.ingredients,p),false);
  assert.equal(validReplacement(entries,'lunch',{items:[{...items[0],portion:-1},items[1]]},catalog.recipes,catalog.ingredients,p),false);
  assert.equal(validReplacement({...entries,snack:null},'lunch',option.entry,catalog.recipes,catalog.ingredients,p),false);
  const altered=catalog.recipes.map(r=>r.id===items[1].id?{...r,allergens:['milk']}:r);
  assert.equal(validReplacement(entries,'lunch',option.entry,altered,catalog.ingredients,p),false);
});
