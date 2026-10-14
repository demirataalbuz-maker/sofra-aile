import {SLOTS,profileError,allowed,mealItems,mealTimes} from './planner.mjs?v=11';
import {planningBlock} from './health.mjs?v=11';
import {selectedSeason,seasonalAffinity} from './seasons.mjs?v=6';
import {validDate} from './tracking.mjs?v=9';
import {cookingAllowed,cookingFits,cookingPreferences} from './cooking.mjs?v=11';

import {memberRequirements,requirementsError,requirementsStatus} from './family-requirements.mjs?v=18';
const KEYS=['kcal','protein','carbs','fat'], PORTIONS=[.5,.75,1,1.25,1.5,2];
export function familyState(value){
  return {members:Array.isArray(value?.members)?value.members.filter(m=>typeof m?.id==='string'&&typeof m.name==='string'&&m.profile).slice(0,6):[],plan:value?.plan||null,history:value?.history||{}};
}
export const participating=family=>family.members.filter(m=>m.included!==false);
export const familyHash=members=>JSON.stringify(members.map(({id,name,profile,requirements})=>requirements?{id,name,requirements}:{id,name,profile}));
export function familyError(members){
  if(members.length<2||members.length>6)return 'Ortak menü için 2–6 yetişkin seç.';
  if(new Set(members.map(m=>m.id)).size!==members.length)return 'Aile profilleri tekrar ediyor.';
  for(const m of members){
    if(!m.name?.trim())return 'Her aile üyesine bir ad veya takma ad ver.';
    const error=m.requirements?requirementsError(m.requirements):profileError(m.profile)||planningBlock(m.profile);if(error)return m.name+': '+error;
  }
  return '';
}
function verified(r,ingredients,allergies){
  return allowed(r,ingredients,allergies)&&r.macros.kcal>=50&&r.macros.kcal<=850&&KEYS.every(k=>Number.isFinite(r.macros[k])&&r.macros[k]>=0)
    &&r.items?.length>0&&r.items.every(([id])=>ingredients[id]?.nutrition?.verification==='source-checked');
}
const vector=r=>KEYS.map(k=>r.macros[k]);
function bounds(p){return p.mode==='macro'?[1,2,3].map(i=>({i,min:KEYS[i]===p.priority?p[KEYS[i]]*.9:0,max:p[KEYS[i]]*1.1})): [{i:0,min:p.target*.9,max:p.target*1.1}];}
function distance(v,p){const i=p.mode==='macro'?KEYS.indexOf(p.priority):0,t=p.mode==='macro'?+p[p.priority]:p.target;return Math.abs(v[i]-t)/Math.max(t,1);}
function fitMember(mains,sides,p){
  const vs=mains.map(vector),checks=bounds(p),valid=v=>checks.every(c=>v[c.i]>=c.min-1e-6&&v[c.i]<=c.max+1e-6);
  let best=null,bestScore=Infinity;const near=[];
  // Enumerate portions independently: never average family members' targets.
  for(const a of PORTIONS)for(const b of PORTIONS)for(const c of PORTIONS)for(const d of PORTIONS){
    const portions=[a,b,c,d],v=KEYS.map((_,k)=>vs.reduce((sum,r,j)=>sum+r[k]*portions[j],0));
    const score=distance(v,p);
    if(valid(v)&&score<bestScore){best={portions,v};bestScore=score;}
    if(checks.every(q=>v[q.i]<=q.max+1e-6)){
      near.push({portions,v,score});near.sort((x,y)=>x.score-y.score);if(near.length>8)near.pop();
    }
  }
  if(!best)for(const candidate of near)for(const side of sides)for(const portion of [.5,.75,1]){
    const v=candidate.v.map((n,k)=>n+side.macros[KEYS[k]]*portion),score=distance(v,p);
    if(valid(v)&&score<bestScore){best={...candidate,v,side:{id:side.id,portion}};bestScore=score;}
  }
  if(!best)return null;
  const entries=Object.fromEntries(SLOTS.map(([slot],i)=>[slot,{id:mains[i].id,portion:best.portions[i]}]));
  if(best.side)entries.dinner={items:[entries.dinner,best.side]};
  return {entries,score:bestScore};
}
export function validFamilyPlan(plan,members,recipes,ingredients){
  if(familyError(members)||!plan||plan.hash!==familyHash(members))return false;
  const byId=new Map(recipes.map(r=>[r.id,r])),allergies=[...new Set(members.flatMap(m=>memberRequirements(m).allergies))];
  const shared=plan.sharedSlots||SLOTS.map(([slot])=>slot);
  if(!Array.isArray(shared)||!shared.includes('lunch')||!shared.includes('dinner')||shared.some(s=>!SLOTS.some(([slot])=>slot===s)))return false;
  if(!cookingFits(SLOTS.flatMap(([slot])=>shared.includes(slot)?[members.flatMap(m=>mealItems(plan.entries?.[m.id]?.[slot]).map(e=>byId.get(e.id)))]:members.map(m=>mealItems(plan.entries?.[m.id]?.[slot]).map(e=>byId.get(e.id)))),plan.cooking))return false;
  return members.every(m=>{
    const entries=plan.entries?.[m.id];
    return SLOTS.every(([slot])=>{const items=mealItems(entries?.[slot]);return items.length>=1&&items.length<=2&&(!shared.includes(slot)||items[0].id===plan.common?.[slot])&&(!plan.commonOnly||items.length===1)&&new Set(items.map(x=>x.id)).size===items.length&&items.every(e=>Number.isFinite(e.portion)&&e.portion>=.5&&e.portion<=2&&verified(byId.get(e.id),ingredients,allergies));})&&requirementsStatus(entries,byId,memberRequirements(m)).ok;
  });
}
export function buildFamilyPlan(recipes,ingredients,members,{random=Math.random,history={},now=Date.now(),attempts=90,cooking,sharedSlots=SLOTS.map(([slot])=>slot),commonOnly=false}={}){
  const error=familyError(members);if(error)return {error};
  const allergies=[...new Set(members.flatMap(m=>memberRequirements(m).allergies))];
  const safe=recipes.filter(r=>verified(r,ingredients,allergies)&&cookingAllowed(r,cooking));
  const rank=r=>members.reduce((sum,m)=>sum+seasonalAffinity(r,ingredients,selectedSeason(memberRequirements(m).seasonPreference,now)),0)*.1-(history[r.id]>now-7*86400000?1:0)+random();
  const ranked=safe.map(r=>({r,rank:rank(r)})).sort((a,b)=>b.rank-a.rank).map(x=>x.r);
  const pools=SLOTS.map(([, ,cats])=>ranked.filter(r=>cats.includes(r.category)));
  if(pools.some(pool=>!pool.length))return {error:'Süre, zorluk, alerjen ve besin kaynağı koşullarını birlikte sağlayan ortak tarifler yetersiz. Kısıtlar değiştirilmedi; süre veya zorluk tercihini değiştirebilirsin.'};
  for(let attempt=0;attempt<attempts;attempt++){
    const mains=pools.map(pool=>pool[Math.floor(random()*Math.min(pool.length,attempt<30?12:pool.length))]);
    if(new Set(mains.map(r=>r.id)).size!==SLOTS.length)continue;
    if(!cookingFits(mains.map(r=>[r]),cooking))continue;
    const sides=ranked.filter(r=>['Salata','Sebze','Çorba','Ara öğün'].includes(r.category)&&!mains.some(main=>main.id===r.id)).slice(0,35);
    const entries={};let ok=true;
    for(const member of members){
      let fit=null;
      for(let trial=0;trial<(sharedSlots.length===4?1:16)&&!fit;trial++){
        const personal=mains.map((r,i)=>sharedSlots.includes(SLOTS[i][0])?r:pools[i][Math.floor(random()*Math.min(pools[i].length,24))]);
        if(new Set(personal.map(r=>r.id)).size!==4)continue;
        fit=fitMember(personal,commonOnly?[]:sides,memberRequirements(member));
      }
      if(!fit){ok=false;break}entries[member.id]=fit.entries;
    }
    if(ok){const plan={hash:familyHash(members),common:Object.fromEntries(SLOTS.filter(([slot])=>sharedSlots.includes(slot)).map(([slot])=>[slot,mains[SLOTS.findIndex(([s])=>s===slot)].id])),entries,sharedSlots,commonOnly,...(cooking?{cooking:cookingPreferences(cooking)}:{})};if(validFamilyPlan(plan,members,recipes,ingredients))return {plan};}
  }
  return {error:'Bu aramada herkesin günlük sınırını koruyan ortak menü bulunamadı. Hedefler ve alerjenler değiştirilmedi. Tekrar deneyebilir veya katılımcıları kendin değiştirebilirsin.'};
}
// Explicit export contains menus only. Profiles, allergies, goals and diaries never leave here.
export function menuExport(plan,members,recipes,times){
  if(!validDate(plan?.date))throw Error('Geçerli günlük menü yok.');
  const byId=new Map(recipes.map(r=>[r.id,r]));
  return {type:'porsiva-family-menu',version:1,date:plan.date,times:mealTimes(times),members:members.map(m=>({name:m.name,meals:Object.fromEntries(SLOTS.map(([slot])=>[slot,mealItems(plan.entries[m.id][slot]).map(e=>({id:e.id,title:byId.get(e.id)?.title||e.id,portion:e.portion}))]))}))};
}
export function readSharedMenu(data){
  if(data?.type!=='porsiva-family-menu'||data.version!==1||!validDate(data.date)||!Array.isArray(data.members)||data.members.length<1||data.members.length>6)throw Error('Bu dosya geçerli bir Porsiva aile menüsü değil.');
  return {type:data.type,version:1,date:data.date,times:mealTimes(data.times),members:data.members.map(m=>{
    if(typeof m.name!=='string'||!m.name.trim()||m.name.length>40)throw Error('Menüdeki ad geçersiz.');
    return {name:m.name,meals:Object.fromEntries(SLOTS.map(([slot])=>{
      const parts=m.meals?.[slot];if(!Array.isArray(parts)||parts.length<1||parts.length>2)throw Error('Menü öğünleri eksik.');
      return [slot,parts.map(e=>{if(typeof e.id!=='string'||e.id.length>200||typeof e.title!=='string'||e.title.length>160||!Number.isFinite(e.portion)||e.portion<.5||e.portion>2)throw Error('Menü porsiyonu veya tarif bilgisi geçersiz.');return {id:e.id,title:e.title,portion:e.portion}})];
    }))};
  })};
}
export function familyIngredients(plan,recipes){
  const byId=new Map(recipes.map(r=>[r.id,r])),sum=new Map();
  for(const entries of Object.values(plan.entries))for(const [slot] of SLOTS)for(const e of mealItems(entries[slot])){
    const r=byId.get(e.id);if(!r)throw Error('Tarif artık katalogda bulunmuyor.');
    for(const [id,qty] of r.items)sum.set(id,(sum.get(id)||0)+qty*e.portion/r.servings);
  }
  return [...sum];
}
