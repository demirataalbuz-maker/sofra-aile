import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCommonPlan,validateCommonPlan,buildFamilyCatalog,preparedPortions,SHARED_SLOTS} from '../common-plan.mjs';
import {planningRequirements,requirementsStatus} from '../family-requirements.mjs';
import {personalFromCommon,isCommonSlot,createFamilyCloud} from '../family-cloud.mjs';
import {mergeCatalog} from '../catalog.mjs';
import {dateKey} from '../tracking.mjs';
import {SLOTS,mealItems,targetStatus} from '../planner.mjs';

const today=dateKey();
const full=mergeCatalog(JSON.parse(fs.readFileSync(new URL('../catalog.json',import.meta.url))),JSON.parse(fs.readFileSync(new URL('../daily-catalog.json',import.meta.url))));
const catalog=buildFamilyCatalog(full);
const seeded=(n=11)=>{let s=n;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}};
const req=(target,extra={})=>({mode:'calorie',target,allergies:[],seasonPreference:'auto',...extra});
const byId=new Map(Object.entries(catalog.recipes).map(([id,r])=>[id,{id,...r}]));
const run=(members,extra={})=>buildCommonPlan({catalog,members,today,recipes:full.recipes,ingredients:full.ingredients,random:seeded(),...extra});

test('published family-catalog.json is exactly what the build derives from catalog.json + daily-catalog.json',()=>{
 const published=JSON.parse(fs.readFileSync(new URL('../family-catalog.json',import.meta.url)));
 assert.deepEqual(published,catalog,'run: node scripts/build_family_catalog.mjs');
});

test('three different calorie targets: same lunch/dinner dishes for all, own breakfast/snack, each within ±10%',()=>{
 const members=[{id:'a',requirements:req(1400)},{id:'b',requirements:req(2100)},{id:'c',requirements:req(2900)}];
 const {plan,error}=run(members);assert.ok(plan,error);
 for(const slot of SHARED_SLOTS)for(const m of members)assert.deepEqual(mealItems(plan.entries[m.id][slot]).map(e=>e.id),plan.common[slot]);
 for(const m of members){
  assert.equal(mealItems(plan.entries[m.id].breakfast).length,1);assert.equal(mealItems(plan.entries[m.id].snack).length,1);
  const s=requirementsStatus(plan.entries[m.id],byId,m.requirements);assert.ok(s.ok);
  assert.ok(Math.abs(s.actual.kcal-m.requirements.target)<=m.requirements.target*.1+1e-6);
 }
 // Portions differ by person; targets are not averaged.
 assert.ok(new Set(members.map(m=>mealItems(plan.entries[m.id].lunch)[0].portion+mealItems(plan.entries[m.id].dinner)[0].portion)).size>1);
 const prep=preparedPortions(plan);
 for(const slot of SHARED_SLOTS)assert.equal(prep[slot][0].portion,members.reduce((n,m)=>n+mealItems(plan.entries[m.id][slot])[0].portion,0));
});

test('macro priority within ±10%, other macros at most +10%; allergens excluded for the whole kitchen',()=>{
 const members=[{id:'a',requirements:req(1800,{allergies:['milk']})},{id:'b',requirements:{mode:'macro',protein:150,carbs:220,fat:75,priority:'protein',allergies:['gluten'],seasonPreference:'auto'}}];
 const {plan,error}=run(members);assert.ok(plan,error);
 const s=requirementsStatus(plan.entries.b,byId,members[1].requirements);assert.ok(s.ok);
 assert.ok(s.actual.protein>=135-1e-6&&s.actual.protein<=165+1e-6);assert.ok(s.actual.carbs<=242+1e-6&&s.actual.fat<=82.5+1e-6);
 for(const e of Object.values(plan.entries).flatMap(x=>Object.values(x).flatMap(mealItems)))assert.ok(!catalog.recipes[e.id].allergens.some(a=>a==='milk'||a==='gluten'),e.id);
});

test('impossible targets fail clearly without relaxing anything; easy/time preference is respected',()=>{
 const r=run([{id:'a',requirements:req(1200)},{id:'b',requirements:{mode:'macro',protein:340,carbs:10,fat:10,priority:'protein',allergies:[],seasonPreference:'auto'}}]);
 assert.equal(r.plan,undefined);assert.match(r.error,/bulunamadı|yetersiz/);
 const easy=run([{id:'a',requirements:req(1700)},{id:'b',requirements:req(2300)}],{cooking:{style:'easy',maxMinutes:45}});assert.ok(easy.plan,easy.error);
 for(const e of Object.values(easy.plan.entries).flatMap(x=>Object.values(x).flatMap(mealItems)))assert.equal(catalog.recipes[e.id].difficulty,'easy');
 assert.deepEqual(easy.plan.cooking,{style:'easy',maxMinutes:45});
 // Default when nothing chosen: easy.
 assert.equal(run([{id:'a',requirements:req(1700)},{id:'b',requirements:req(2300)}]).plan.cooking.style,'easy');
});

test('deadline stops the search and keeps everything (cancel/timeout path)',()=>{
 const r=run([{id:'a',requirements:req(1700)},{id:'b',requirements:req(2300)}],{deadline:Date.now()-1});
 assert.equal(r.plan,undefined);assert.equal(r.timeout,true);
});

test('validation: one shared main+side for everyone; no tavuk→köfte or pilav→makarna per person',()=>{
 const members=[{id:'a',requirements:req(1300)},{id:'b',requirements:req(3400)}];
 const {plan,error}=run(members);assert.ok(plan,error);
 assert.deepEqual(validateCommonPlan(structuredClone(plan),members,catalog,{today}),plan);
 const otherMain=Object.keys(catalog.recipes).find(id=>catalog.recipes[id].category===catalog.recipes[plan.common.lunch[0]].category&&id!==plan.common.lunch[0]&&!catalog.recipes[id].allergens.length);
 const mixed=structuredClone(plan);mixed.entries.b.lunch.items[0].id=otherMain;
 assert.throws(()=>validateCommonPlan(mixed,members,catalog,{today}),/aynı yemekleri/);
 const side=Object.keys(catalog.recipes).filter(id=>catalog.recipes[id].category==='Salata').slice(0,2);
 // Only B gets a different (or an extra) side dish at dinner.
 const sides=structuredClone(plan),d=sides.entries.b.dinner.items;if(d.length>1)d[1].id=side.find(id=>id!==d[1].id);else d.push({id:side[0],portion:.5});
 assert.throws(()=>validateCommonPlan(sides,members,catalog,{today}),/aynı yemekleri/);
 assert.throws(()=>validateCommonPlan({...structuredClone(plan),date:'2000-01-01'},members,catalog,{today}),/bugüne/);
 const personalTwo=structuredClone(plan);personalTwo.entries.a.snack.items.push({id:personalTwo.entries.b.snack.items[0].id,portion:.5});
 assert.throws(()=>validateCommonPlan(personalTwo,members,catalog,{today}),/bir tarif/);
});

test('clinical profiles never get an automatic shared plan',()=>{
 const profile={age:40,height:170,weight:70,sex:'female',activity:'light',goal:'maintain',mode:'calorie',allergies:[],healthConditions:['kidney']};
 assert.throws(()=>planningRequirements(profile));
 assert.deepEqual(Object.keys(planningRequirements({...profile,healthConditions:[]})).sort(),['allergies','mode','seasonPreference','target']);
});

test('"Bugün menüme uygula": only my portions, re-checked against my current profile and allergies',()=>{
 const profile={age:34,height:168,weight:64,sex:'female',activity:'light',goal:'maintain',mode:'calorie',allergies:[],healthConditions:[]};
 const mine=planningRequirements(profile),members=[{id:'me',requirements:mine},{id:'other',requirements:req(2500)}];
 const {plan,error}=run(members);assert.ok(plan,error);
 const personal=personalFromCommon(plan,'me',profile,full,today,7);
 assert.equal(personal.source,'family-common');assert.equal(personal.hash,JSON.stringify(profile));assert.equal(personal.familyRevision,7);
 assert.ok(targetStatus(personal.entries,new Map(full.recipes.map(r=>[r.id,r])),profile).ok);
 assert.ok(!JSON.stringify(personal).includes('other'));
 assert.equal(isCommonSlot(personal,'lunch'),true);assert.equal(isCommonSlot(personal,'breakfast'),false);assert.equal(isCommonSlot({...personal,source:undefined},'lunch'),false);
 // Profile changed since the plan was made: refuse instead of writing an out-of-range menu.
 assert.throws(()=>personalFromCommon(plan,'me',{...profile,calorieTarget:3500},full,today,7),/hedefinle|1200–4500|aralığında/);
 const allergic=Object.values(plan.entries.me).flatMap(mealItems).flatMap(e=>full.recipes.find(r=>r.id===e.id).items.map(([id])=>full.ingredients[id].allergens||[])).flat()[0];
 if(allergic)assert.throws(()=>personalFromCommon(plan,'me',{...profile,allergies:[allergic]},full,today,7),/alerjen/);
 assert.throws(()=>personalFromCommon(plan,'nobody',profile,full,today,7),/porsiyonun yok/);
 assert.throws(()=>personalFromCommon({...plan,date:'2000-01-01'},'me',profile,full,today,7),/bugüne/);
 assert.throws(()=>personalFromCommon(plan,'me',{...profile,healthConditions:['diabetes']},full,today,7));
});

test('publish is pinned to the session, membership, group and day the computation started with',async()=>{
 let session={accountId:'A',token:'t-a'};const calls=[];
 const group=(planning=true)=>({id:'g1',commonRevision:3,members:[{id:'m-A',isSelf:true,planning:planning?req(1800):null,planningRevision:2,name:'A'},{id:'m-B',planning:req(2300),planningRevision:5,name:'B'}]});
 let current=group();
 const api=async(path,payload,{session:s})=>{calls.push({path,account:s.accountId,payload});if(path==='/family/get')return {group:structuredClone(current)};return {}};
 const cloud=createFamilyCloud({api,session:()=>session,getState:()=>({}),delay:1});
 await cloud.read();
 const ticket=cloud.commonTicket(today);
 assert.deepEqual(ticket.participants.map(p=>[p.id,p.revision]),[['m-A',2],['m-B',5]]);assert.equal(ticket.revision,3);
 await cloud.publishCommon(ticket,{date:today},today);
 assert.deepEqual(calls.filter(c=>c.path==='/family/common').map(c=>[c.account,c.payload.revision,c.payload.participants]),[['A',3,[{id:'m-A',revision:2},{id:'m-B',revision:5}]]]);
 assert.ok(!JSON.stringify(calls.at(-2).payload).includes('requirements'),'targets are not resent with the plan');
 // A→B while the Worker was computing: nothing is sent with either session.
 const t2=cloud.commonTicket(today);session={accountId:'B',token:'t-b'};calls.length=0;
 await assert.rejects(cloud.publishCommon(t2,{date:today},today),/değişti/);assert.equal(calls.length,0);
 // A→B→A with a new token is still a different session.
 session={accountId:'A',token:'t-a2'};await assert.rejects(cloud.publishCommon(t2,{date:today},today),/değişti/);assert.equal(calls.length,0);
 // Day changed during the computation.
 await cloud.read();const t3=cloud.commonTicket(today);
 await assert.rejects(cloud.publishCommon(t3,{date:today},'2099-01-01'),/Gün değişti/);
 // Reset (sign-out / leaving) voids pending tickets.
 const t4=cloud.commonTicket(today);cloud.reset();await assert.rejects(cloud.publishCommon(t4,{date:today},today),/değişti|yenile/);
 await cloud.read();const stale=cloud.commonTicket(today);current.commonRevision++;await cloud.read();calls.length=0;
 await assert.rejects(cloud.publishCommon(stale,{date:today},today),/değişti/);assert.equal(calls.length,0);
 // Fewer than two participants: no computation starts.
 current=group(false);await cloud.read();assert.throws(()=>cloud.commonTicket(today),/en az iki/);
});
