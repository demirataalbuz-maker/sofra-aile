import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildFamilyPlan,validFamilyPlan,menuExport,readSharedMenu,familyIngredients,familyHash} from '../family.mjs';
import {SLOTS,totals,targetStatus,buildPlan,replacementOptions,validReplacement,mealItems} from '../planner.mjs';
import {planningBlock} from '../health.mjs';
import {localPayload} from '../sync.mjs';
const base={age:35,height:170,weight:70,sex:'female',activity:'light',goal:'maintain',mode:'calorie',calorieTarget:1600,allergies:[]};
const member=(id,kcal,extras={})=>({id,name:id,profile:{...base,calorieTarget:kcal,...extras}});
const ingredients={food:{allergens:[],nutrition:{verification:'source-checked'}}};
const recipes=SLOTS.map(([id,,cats])=>({id,category:cats[0],title:id,servings:2,items:[['food',200]],allergens:[],macros:{kcal:400,protein:25,carbs:45,fat:13}}));
const seeded=()=>{let s=32;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}};

test('three people share recipes with independently valid portions; no average target or input mutation',()=>{
 const members=[member('A',1200),member('B',1700),member('C',2600)],before=JSON.stringify(members);
 const {plan,error}=buildFamilyPlan(recipes,ingredients,members,{random:seeded()});assert.equal(error,undefined);
 assert.ok(validFamilyPlan(plan,members,recipes,ingredients));assert.equal(JSON.stringify(members),before);
 const byId=new Map(recipes.map(r=>[r.id,r]));
 for(const m of members){assert.ok(targetStatus(plan.entries[m.id],byId,m.profile).ok);for(const [slot]of SLOTS)assert.equal(plan.entries[m.id][slot].id,plan.common[slot]);}
 assert.ok(totals(plan.entries.A,byId).kcal<totals(plan.entries.C,byId).kcal);
 const changed=structuredClone(members);changed[0].profile.calorieTarget=4000;assert.equal(validFamilyPlan(plan,changed,recipes,ingredients),false);
});
test('family macro caps and calorie targets are both enforced, and impossible plans do not relax them',()=>{
 const members=[member('A',1700),member('B','',{mode:'macro',priority:'protein',protein:100,carbs:200,fat:60})];
 const {plan}=buildFamilyPlan(recipes,ingredients,members,{random:seeded()});assert.ok(plan);
 const byId=new Map(recipes.map(r=>[r.id,r]));assert.ok(targetStatus(plan.entries.B,byId,members[1].profile).ok);
 const impossible=[member('A',1600),member('B','',{mode:'macro',priority:'protein',protein:350,carbs:10,fat:10})];
 assert.ok(buildFamilyPlan(recipes,ingredients,impossible,{attempts:2}).error);
});
test('known allergens from recipes AND ingredients are excluded for the entire shared kitchen, including sides',()=>{
 const members=[member('A',1600),member('B',2000,{allergies:['milk']})];
 assert.ok(buildFamilyPlan(recipes,{food:{...ingredients.food,allergens:['milk']}},members).error);
 assert.ok(buildFamilyPlan(recipes.map(r=>({...r,allergens:['milk']})),ingredients,members).error);
 assert.ok(buildFamilyPlan(recipes,{food:{allergens:[],nutrition:{verification:'unverified'}}},members).error);
});
test('clinical profiles cannot generate individual or family plans or bypass restrictions via replacements',()=>{
 for(const condition of ['hypertension','kidney','diabetes','pregnancy','other']){
  const p={...base,healthConditions:[condition]};assert.ok(planningBlock(p));assert.equal(buildPlan(recipes,ingredients,p),null);
  assert.deepEqual(replacementOptions(recipes,ingredients,p,{},'lunch'),[]);assert.equal(validReplacement({},'lunch',{id:'lunch',portion:1},recipes,ingredients,p),false);
  assert.ok(buildFamilyPlan(recipes,ingredients,[member('A',1600),member('B',1600,{healthConditions:[condition]})]).error);
 }
 assert.ok(buildFamilyPlan(recipes,ingredients,[member('A',1600),member('B',1600,{age:17})]).error);
});
test('menu exports strip health, weight, allergies and targets; imported menus are bounded and never trusted as a profile',()=>{
 const members=[member('A',1600),member('B',2000)],{plan}=buildFamilyPlan(recipes,ingredients,members);plan.date='2026-10-12';
 const data=menuExport(plan,members,recipes,{}),text=JSON.stringify(data);for(const key of ['weight','healthConditions','allergies','calorieTarget','profile'])assert.ok(!text.includes(key));
 assert.deepEqual(readSharedMenu({...data,profile:base}),data);
 const bad=structuredClone(data);bad.members[0].meals.breakfast[0].portion=-1;assert.throws(()=>readSharedMenu(bad));
 assert.throws(()=>readSharedMenu({...data,date:'2026-02-30'}));
 assert.deepEqual(localPayload({profile:base,family:{members},reports:{},cloudSettings:{}}),{profile:base});
 const quantity=familyIngredients(plan,recipes)[0][1];const servings=Object.values(plan.entries).flatMap(e=>Object.values(e).flatMap(mealItems)).reduce((n,e)=>n+e.portion,0);assert.equal(quantity,servings*100);
});
test('optional side closes a gap without altering shared meals or daily bounds',()=>{
 const mains=recipes.map(r=>({...r,macros:{kcal:150,protein:10,carbs:15,fat:5}}));
 const side={id:'side',title:'side',category:'Salata',servings:1,items:[['food',100]],macros:{kcal:400,protein:20,carbs:30,fat:15}};
 const members=[member('A',1200),member('B',1600)],result=buildFamilyPlan([...mains,side],ingredients,members,{random:()=>0,attempts:1});
 assert.ok(result.plan);assert.ok(Object.values(result.plan.entries.B).some(e=>mealItems(e).length===2));
 assert.ok(validFamilyPlan(result.plan,members,[...mains,side],ingredients));
});
test('real catalog family of three finds a valid plan',()=>{
 const c=JSON.parse(fs.readFileSync(new URL('../catalog.json',import.meta.url)));
 const members=[member('A',1700),member('B',2200),member('C',1900,{allergies:['peanut']})];
 const {plan,error}=buildFamilyPlan(c.recipes,c.ingredients,members,{random:seeded()});assert.ok(plan,error);assert.ok(validFamilyPlan(plan,members,c.recipes,c.ingredients));
});
