import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWeek,validWeekDay} from '../weekly.mjs';
import {localPayload} from '../sync.mjs';
import {SLOTS,buildPlan,allowed} from '../planner.mjs';
const profile={age:30,height:175,weight:80,sex:'male',activity:'low',goal:'maintain',mode:'macro',priority:'protein',protein:120,carbs:100,fat:50,allergies:[]};
const recipes=SLOTS.flatMap(([slot,,categories])=>['easy','hard'].map(difficulty=>({id:slot+'-'+difficulty,category:categories[0],difficulty,minutes:15,steps:[],items:[],macros:{kcal:300,protein:30,carbs:20,fat:8}})));
test('known unverified ingredient values never enter automatic daily or weekly suggestions',()=>{
 const recipe={...recipes[0],items:[['unverified',100]]};
 assert.equal(allowed(recipe,{unverified:{allergens:[],nutrition:{verification:'unverified'}}}),false);
 assert.equal(allowed(recipe,{unverified:{allergens:[],nutrition:{verification:'source-checked'}}}),true);
});
test('mixed cooking can fall back to feasible easy meals without weakening targets',()=>{
 const now=Date.now(),history=Object.fromEntries(recipes.filter(r=>r.difficulty==='easy').map(r=>[r.id,now-1000]));
 const plan=buildPlan(recipes,{},profile,()=>.99,{},{},{history,now,cooking:{style:'mixed',maxMinutes:0}});
 assert.ok(plan);assert.ok(Object.values(plan).every(e=>e.id.endsWith('-easy')));
});
test('weekly plans span seven dates and each day validates independently; profile changes invalidate use',()=>{
 const week=buildWeek(recipes,{},profile,{start:'2026-10-30',cooking:{style:'easy',maxMinutes:20},random:()=>0});
 assert.equal(week.days.length,7);assert.deepEqual(week.missing,[]);
 assert.equal(week.days[0].date,'2026-10-30');assert.equal(week.days[6].date,'2026-11-05');
 for(const day of week.days)assert.ok(validWeekDay(day,week,recipes,profile));
 assert.equal(validWeekDay(week.days[0],week,recipes,{...profile,protein:200}),false);
 assert.equal(validWeekDay(week.days[0],week,[],profile),false);
 assert.throws(()=>buildWeek(recipes,{},profile,{start:'2026-02-30'}));
 assert.throws(()=>buildWeek(recipes,{}, {...profile,age:17},{start:'2026-10-14'}));
});
test('an infeasible week reports missing days and never invents menus; local drafts stay out of account uploads',()=>{
 const week=buildWeek([],{},profile,{start:'2026-10-14'});assert.equal(week.days.length,0);assert.equal(week.missing.length,7);
 assert.deepEqual(localPayload({weekly:week,profile}),{profile});
});
