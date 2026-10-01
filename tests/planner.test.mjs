import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {profileError,estimate,allowed,buildPlan,totals,SLOTS,rememberRecommendations,matchingAllergens} from '../planner.mjs';

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
