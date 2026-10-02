import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {profileError,estimate,allowed,buildPlan,totals,SLOTS,rememberRecommendations,matchingAllergens,targetStatus} from '../planner.mjs';
import {seasonFor,selectedSeason,seasonalAffinity} from '../seasons.mjs';

const catalog=JSON.parse(fs.readFileSync(new URL('../catalog.json',import.meta.url)));
const base={age:42,height:165,weight:75,sex:'female',activity:'light',goal:'lose',mode:'calorie',calorieTarget:'',allergies:['milk']};
const byId=new Map(catalog.recipes.map(r=>[r.id,r]));
const DAY=86400000;
const now=Date.UTC(2026,9,1,12);
function seeded(seed=17){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}

test('energy estimate changes with profile and goal',()=>{
  assert.equal(profileError(base),'');
  assert.ok(estimate(base).target<estimate({...base,goal:'maintain'}).target);
  assert.ok(estimate({...base,weight:85}).target>estimate(base).target);
  assert.ok(profileError({...base,age:15}));
});

test('18-year-old adults are accepted; age, height, sex and activity affect estimates, manual target stays fixed',()=>{
  assert.equal(profileError({...base,age:18}),'');
  assert.ok(profileError({...base,age:17}));assert.ok(profileError({...base,age:18.5}));
  assert.ok(estimate({...base,age:18}).maintenance>estimate({...base,age:58}).maintenance);
  assert.ok(estimate({...base,height:180}).maintenance>estimate(base).maintenance);
  assert.ok(estimate({...base,sex:'male'}).maintenance>estimate(base).maintenance);
  assert.ok(estimate({...base,activity:'high'}).maintenance>estimate(base).maintenance);
  assert.equal(estimate({...base,age:18,weight:90,calorieTarget:1700}).target,1700);
});

test('40 swaps preserve the 1700 kcal target, recompute totals, keep untouched meals and never exceed ±10%',()=>{
  const p={...base,allergies:[],calorieTarget:1700};const original=JSON.stringify(p);
  let entries=buildPlan(catalog.recipes,catalog.ingredients,p,seeded(31)),history={};
  let changes=0;
  for(let i=0;i<40;i++){
    const slot=SLOTS[i%4][0],locked={...entries};delete locked[slot];
    const next=buildPlan(catalog.recipes,catalog.ingredients,p,seeded(i+1),locked,{[slot]:entries[slot].id},{history,now:now+i*60000});
    if(!next)continue;
    changes++;assert.ok(targetStatus(next,byId,p).ok);assert.ok(totals(next,byId).kcal<=1870);assert.ok(totals(next,byId).kcal>=1530);
    for(const [key] of SLOTS)if(key!==slot)assert.deepEqual(next[key],entries[key]);
    const manual=Object.values(next).reduce((sum,e)=>sum+byId.get(e.id).macros.kcal*e.portion,0);
    assert.ok(Math.abs(totals(next,byId).kcal-manual)<1e-6);assert.equal(JSON.stringify(p),original);
    history=rememberRecommendations(history,{[slot]:next[slot]},now+i*60000);entries=next;
  }
  assert.ok(changes>=20);
});

test('impossible swap returns null and does not mutate existing meals or relax macro ceilings',()=>{
  const p={...base,calorieTarget:1700,allergies:[],seasonPreference:'off'};
  const recipes=SLOTS.map(([slot,,cats],i)=>({id:slot,category:cats[0],items:[],macros:{kcal:i===0?850:500,protein:25,carbs:40,fat:12}}));
  const locked={lunch:{id:'lunch',portion:1},dinner:{id:'dinner',portion:1},snack:{id:'snack',portion:1}};
  const before=JSON.stringify(locked);
  assert.equal(buildPlan(recipes,{},p,seeded(),locked),null);assert.equal(JSON.stringify(locked),before);
  const macro={...p,mode:'macro',protein:130,carbs:130,fat:80,priority:'protein'};
  let current=buildPlan(catalog.recipes,catalog.ingredients,macro,seeded(27));assert.ok(current);
  for(let i=0;i<12;i++){const slot=SLOTS[i%4][0],fixed={...current};delete fixed[slot];const next=buildPlan(catalog.recipes,catalog.ingredients,macro,seeded(i),fixed,{[slot]:current[slot].id});if(next){assert.ok(targetStatus(next,byId,macro).ok);current=next;}}
});

test('season preference follows Turkish dates, is optional, and never bypasses targets or allergies',()=>{
  assert.equal(seasonFor(new Date('2026-11-30T22:00:00Z')),'winter');
  assert.equal(selectedSeason('auto',Date.UTC(2026,6,1)),'summer');assert.equal(selectedSeason('off'),null);
  const winterDish={items:[['broccoli',200]]},summerDish={items:[['tomato',200]]};
  assert.equal(seasonalAffinity(winterDish,{},'winter'),1);assert.equal(seasonalAffinity(summerDish,{},'winter'),0);
  assert.equal(seasonalAffinity({items:[['tomato',10]]},{},'summer'),0);
  const recipes=SLOTS.flatMap(([slot,,cats])=>['winter','summer'].map(season=>({id:slot+'-'+season,category:cats[0],items:season==='winter'?winterDish.items:summerDish.items,macros:{kcal:400,protein:25,carbs:40,fat:12},allergens:[]})));
  const p={...base,calorieTarget:1600,allergies:[],seasonPreference:'winter'};
  const plan=buildPlan(recipes,{},p,seeded(8));assert.ok(plan);assert.ok(Object.values(plan).every(e=>e.id.endsWith('winter')));
  const summer=buildPlan(recipes,{}, {...p,seasonPreference:'summer'},seeded(8));assert.ok(Object.values(summer).every(e=>e.id.endsWith('summer')));
  const onlySummer=buildPlan(recipes.filter(r=>r.id.endsWith('summer')),{},p,seeded(8));assert.ok(onlySummer,'off-season meals remain available');
  const unsafe=recipes.map(r=>({...r,allergens:['milk']}));assert.equal(buildPlan(unsafe,{}, {...p,allergies:['milk']},seeded(8)),null);
});

test('generated day has four allergy-filtered meals near selected calories',()=>{
  const entries=buildPlan(catalog.recipes,catalog.ingredients,base,seeded());
  assert.ok(entries);
  assert.deepEqual(Object.keys(entries).sort(),SLOTS.map(([k])=>k).sort());
  for(const entry of Object.values(entries))assert.ok(allowed(byId.get(entry.id),catalog.ingredients,base.allergies));
  const actual=totals(entries,byId).kcal;
  assert.ok(Math.abs(actual-estimate(base).target)/estimate(base).target<.10);
});

test('macro mode honors priority and a swap avoids the current recipe',()=>{
  const p={...base,mode:'macro',protein:'130',carbs:'130',fat:'80',priority:'protein',allergies:[]};
  assert.equal(profileError(p),'');
  const current=buildPlan(catalog.recipes,catalog.ingredients,p,seeded());
  const locked={...current};delete locked.lunch;
  const next=buildPlan(catalog.recipes,catalog.ingredients,p,seeded(23),locked,{lunch:current.lunch.id});
  assert.notEqual(next.lunch.id,current.lunch.id);
  for(const [k] of SLOTS)if(k!=='lunch')assert.deepEqual(next[k],current[k]);
  assert.ok(Number.isFinite(totals(next,byId).protein));
});

test('a week of daily menus and rerolls stays varied after storage reloads',()=>{
  for(const p of [base,{...base,allergies:[]},{...base,allergies:[],mode:'macro',protein:130,carbs:130,fat:80,priority:'protein'}]){
    let history={};const shown=new Set();const random=seeded(123);
    for(let day=0;day<7;day++){
      for(let reroll=0;reroll<(p.allergies.length?1:2);reroll++){
        const time=now+day*DAY+reroll*60000;
        const entries=buildPlan(catalog.recipes,catalog.ingredients,p,random,{},{},{history,now:time});
        assert.ok(entries);
        const nutrients=totals(entries,byId);
        const key=p.mode==='macro'?p.priority:'kcal';
        const target=p.mode==='macro'?p[key]:estimate(p).target;
        assert.ok(Math.abs(nutrients[key]-target)/target<.10,`Target drift on day ${day}`);
        for(const e of Object.values(entries)){
          assert.ok(!shown.has(e.id),`Repeated ${e.id} on day ${day}`);
          assert.ok(allowed(byId.get(e.id),catalog.ingredients,p.allergies));
          shown.add(e.id);
        }
        history=JSON.parse(JSON.stringify(rememberRecommendations(history,entries,time)));
      }
    }
  }
});

test('repeated swaps do not alternate the same two meals or refresh locked history',()=>{
  const random=seeded(99);let history={};
  let entries=buildPlan(catalog.recipes,catalog.ingredients,base,random);
  history=rememberRecommendations(history,entries,now);
  const seen=new Set([entries.breakfast.id]);const lunchTime=history[entries.lunch.id];
  for(let i=1;i<=5;i++){
    const locked={...entries};delete locked.breakfast;
    const next=buildPlan(catalog.recipes,catalog.ingredients,base,random,locked,{breakfast:entries.breakfast.id},{history,now:now+i*60000});
    assert.ok(next);assert.ok(!seen.has(next.breakfast.id));seen.add(next.breakfast.id);
    for(const [k] of SLOTS)if(k!=='breakfast')assert.deepEqual(next[k],entries[k]);
    history=rememberRecommendations(history,{breakfast:next.breakfast},now+i*60000);
    assert.equal(history[next.lunch.id],lunchTime);entries=next;
  }
});

test('exhausted pools cycle oldest safe recipes and never relax allergies',()=>{
  const recipes=SLOTS.flatMap(([slot,,cats])=>[0,1,2].map(i=>({id:`${slot}-${i}`,category:cats[0],items:[],allergens:i===2?['milk']:[],macros:{kcal:400,protein:25,carbs:40,fat:12}})));
  const history=Object.fromEntries(recipes.filter(r=>!r.allergens.length).map(r=>[r.id,now-(r.id.endsWith('-0')?3:1)*DAY]));
  const entries=buildPlan(recipes,{},base,seeded(),{},{},{history,now});
  assert.ok(entries);
  for(const e of Object.values(entries))assert.ok(e.id.endsWith('-0'));
  const single=recipes.filter(r=>!r.id.endsWith('-1'));
  const noSwap=buildPlan(single,{},base,seeded(),{}, {breakfast:'breakfast-0'},{history,now});
  assert.equal(noSwap,null);
});

test('history expires and malformed persisted data is ignored',()=>{
  const history=rememberRecommendations({old:now-31*DAY,future:now+DAY,bad:'yesterday',recent:now-DAY}, {snack:{id:'new'}},now);
  assert.deepEqual(history,{new:now,recent:now-DAY});
  assert.deepEqual(rememberRecommendations(null,{},now),{});
});

test('allergen warnings include ingredient tags and deduplicate recipe tags',()=>{
  const r={allergens:['milk'],items:[['yogurt',100],['egg',1]],macros:{kcal:200}};
  const ingredients={yogurt:{allergens:['milk']},egg:{allergens:['egg']}};
  assert.deepEqual(matchingAllergens(r,ingredients,['milk','egg','soy']),['milk','egg']);
  assert.deepEqual(matchingAllergens(r,ingredients,['soy']),[]);
  assert.deepEqual(matchingAllergens(r,ingredients),[]);
  assert.equal(allowed(r,ingredients,['egg']),false);
  assert.equal(allowed(r,ingredients,['soy']),true);
  assert.deepEqual(matchingAllergens({...r,allergens:[]},ingredients,['egg']),['egg']);
});
