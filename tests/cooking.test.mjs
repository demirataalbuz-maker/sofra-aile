import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cookingInfo,cookingAllowed,cookingFits,cookingPreferences} from '../cooking.mjs';
import {SLOTS,buildPlan,replacementOptions,validReplacement,targetStatus,mealItems} from '../planner.mjs';
import {buildFamilyPlan,validFamilyPlan} from '../family.mjs';
const profile={age:35,height:170,weight:70,sex:'female',activity:'light',goal:'maintain',mode:'calorie',calorieTarget:1600,allergies:[]};
const ingredients={food:{allergens:[],nutrition:{verification:'source-checked'}}};
test('removing the duration limit retains a feasible quick menu even when fresh slow recipes dominate history',()=>{
 const now=Date.now(),history={},p={...profile,mode:'macro',priority:'protein',protein:120,carbs:100,fat:50};
 const pool=SLOTS.flatMap(([slot,,categories])=>{
  history[slot+'-quick']=now-60000;
  return [
   {id:slot+'-quick',category:categories[0],difficulty:'easy',minutes:15,steps:[],items:[],macros:{kcal:300,protein:30,carbs:20,fat:8}},
   {id:slot+'-slow',category:categories[0],difficulty:'easy',minutes:45,steps:[],items:[],macros:{kcal:300,protein:1,carbs:80,fat:20}}
  ];
 });
 const unlimited={style:'easy',maxMinutes:0},map=new Map(pool.map(r=>[r.id,r]));
 const quick=buildPlan(pool,{},p,()=>0,{},{},{history,now,cooking:{style:'easy',maxMinutes:20}});
 const broad=buildPlan(pool,{},p,()=>0,{},{},{history,now,cooking:unlimited});
 assert.ok(quick);assert.ok(broad);assert.ok(targetStatus(broad,map,p).ok);
 assert.ok(cookingFits(Object.values(broad).map(e=>mealItems(e).map(x=>map.get(x.id))),unlimited));
 assert.deepEqual(unlimited,{style:'easy',maxMinutes:0});
});
const recipes=SLOTS.flatMap(([slot,,categories])=>['easy','medium','hard'].map(difficulty=>({id:slot+'-'+difficulty,title:slot,category:categories[0],difficulty,minutes:difficulty==='easy'?15:difficulty==='medium'?25:40,steps:['Karıştır.'],equipment:['hob'],servings:1,items:[['food',100]],macros:{kcal:400,protein:30,carbs:40,fat:12}})));
const byId=new Map(recipes.map(r=>[r.id,r]));
const random=(seed=42)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const groups=(entries,map=byId)=>SLOTS.map(([slot])=>mealItems(entries[slot]).map(e=>map.get(e.id)));

test('difficulty follows technique rather than waiting time, overrides supported and unknown time is never fast',()=>{
 assert.equal(cookingInfo({steps:['Karıştır, fırına koy.'],minutes:90,equipment:['oven']}).difficulty,'easy');
 assert.equal(cookingInfo({steps:['Biberleri ağzında yaklaşık 1 cm boşluk kalacak şekilde doldur.'],minutes:60}).difficulty,'hard');
 assert.equal(cookingInfo({steps:['Köfte harcını yoğur.'],minutes:20}).difficulty,'medium');
 assert.equal(cookingInfo({difficulty:'medium',steps:['Karıştır.']}).difficulty,'medium');
 assert.equal(cookingInfo({steps:[]}).quick,false);
 assert.equal(cookingAllowed({steps:[]},{style:'easy',maxMinutes:20}),false);
 assert.deepEqual(cookingPreferences({style:'garbage',maxMinutes:-5}),{style:'mixed',maxMinutes:0});
});

test('easy/quick and mixed generation preserve nutrition; hard meals can appear without being forced',()=>{
 const quick={style:'easy',maxMinutes:20},mixed={style:'mixed',maxMinutes:0};
 const entries=buildPlan(recipes,ingredients,profile,random(),{},{},{cooking:quick});
 assert.ok(entries);assert.ok(targetStatus(entries,byId,profile).ok);assert.ok(cookingFits(groups(entries),quick));
 let withHard=0,withoutHard=0;
 for(let seed=1;seed<=16;seed++){
  const plan=buildPlan(recipes,ingredients,profile,random(seed*997),{},{},{cooking:mixed});assert.ok(plan);
  const hard=groups(plan).flat().filter(r=>r.difficulty==='hard').length;assert.ok(hard<=1);hard?withHard++:withoutHard++;
  assert.ok(targetStatus(plan,byId,profile).ok);
 }
 assert.ok(withHard>0&&withoutHard>0);
 assert.equal(buildPlan(recipes.filter(r=>r.difficulty==='hard'),ingredients,profile,random(),{},{},{cooking:quick}),null);
});

test('swaps and combos honor the saved daily cooking preference without accumulating hard dishes or minutes',()=>{
 const entries=Object.fromEntries(SLOTS.map(([slot])=>[slot,{id:slot+'-easy',portion:1}]));
 const p={style:'easy',maxMinutes:20};
 const options=replacementOptions(recipes,ingredients,profile,entries,'lunch',{cooking:p});
 for(const option of options)assert.ok(cookingFits(groups({...entries,lunch:option.entry}),p));
 assert.equal(validReplacement(entries,'lunch',{id:'lunch-hard',portion:1},recipes,ingredients,profile,p),false);
 // Combined durations exceed 20 although each dish individually fits.
 const combo={items:[{id:'lunch-easy',portion:.5},{id:'snack-easy',portion:.5}]};
 assert.ok(targetStatus({...entries,lunch:combo},byId,profile).ok);
 assert.equal(validReplacement(entries,'lunch',combo,recipes,ingredients,profile,p),false);
 const mixed={style:'mixed',maxMinutes:0},oneHard={...entries,dinner:{id:'dinner-hard',portion:1}};
 assert.equal(validReplacement(oneHard,'lunch',{id:'lunch-hard',portion:1},recipes,ingredients,profile,mixed),false);
 assert.ok(validReplacement(oneHard,'dinner',{id:'dinner-medium',portion:1},recipes,ingredients,profile,mixed));
});

test('family preferences apply to everyone and all side dishes, repeated portions are counted once',()=>{
 const members=[{id:'a',name:'A',profile},{id:'b',name:'B',profile:{...profile,calorieTarget:2200}}],cooking={style:'easy',maxMinutes:20};
 const {plan}=buildFamilyPlan(recipes,ingredients,members,{random:random(),cooking});assert.ok(plan);
 assert.ok(validFamilyPlan(plan,members,recipes,ingredients));assert.deepEqual(plan.cooking,cooking);
 assert.ok(cookingFits([[recipes[0],recipes[0]]],cooking));
 const other={...recipes[0],id:'extra'};assert.equal(cookingFits([[recipes[0],other]],cooking),false);
 const invalid=structuredClone(plan);invalid.entries.a.dinner={items:[{id:'dinner-easy',portion:.5},{id:'snack-easy',portion:.5}]};
 assert.equal(validFamilyPlan(invalid,members,recipes,ingredients),false);
 assert.ok(buildFamilyPlan(recipes.filter(r=>r.difficulty==='hard'),ingredients,members,{cooking}).error);
});

test('real catalog offers easy meals under 30 minutes with valid calorie and macro limits',()=>{
 const c=JSON.parse(fs.readFileSync(new URL('../catalog.json',import.meta.url))),map=new Map(c.recipes.map(r=>[r.id,r]));
 for(const p of [profile,{...profile,mode:'macro',priority:'protein',protein:130,carbs:180,fat:80}]){
  const cooking={style:'easy',maxMinutes:30};const result=buildPlan(c.recipes,c.ingredients,p,random(45),{},{},{cooking});
  assert.ok(result);assert.ok(targetStatus(result,map,p).ok);assert.ok(cookingFits(groups(result,map),cooking));
 }
});
