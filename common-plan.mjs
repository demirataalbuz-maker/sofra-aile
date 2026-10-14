// Shared family meal plan for one kitchen. The same file runs in the browser Worker (search + check) and on the
// account Worker (check only), so both sides apply identical rules to identical recipe data (family-catalog.json).
// Lunch and dinner: every participant gets the same main dish and, if any, the same side dish; only portions differ.
// Breakfast and snack: personal. Each participant's own day is checked against their own targets; targets are never
// averaged or loosened. If no plan fits, the search reports failure and nothing is changed.
import {SLOTS,mealItems,mealTimes} from './planner.mjs?v=11';
import {requirementsError,requirementsStatus} from './family-requirements.mjs?v=18';
import {cookingInfo,cookingAllowed,cookingFits,cookingPreferences} from './cooking.mjs?v=11';
import {selectedSeason,seasonalAffinity} from './seasons.mjs?v=6';

export const SHARED_SLOTS=['lunch','dinner'],PERSONAL_SLOTS=['breakfast','snack'];
export const SIDE_CATEGORIES=['Salata','Sebze','Çorba'];
export const PORTIONS=[.5,.75,1,1.25,1.5,2],SIDE_PORTIONS=[.5,.75,1];
export const MAX_PARTICIPANTS=4;
const KEYS=['kcal','protein','carbs','fat'];
const SLOT_CATEGORIES=Object.fromEntries(SLOTS.map(([slot,,categories])=>[slot,categories]));
const failure=message=>Object.assign(Error(message),{code:'common-plan'});

// Verification data for one recipe, derived only from source-checked ingredient data. Used by the build script
// (family-catalog.json for the server) and nowhere else, so client search and server check read the same numbers.
export function familyCatalogEntry(recipe,ingredients){
 const verified=recipe?.items?.length>0&&recipe.items.every(([id])=>ingredients?.[id]?.nutrition?.verification==='source-checked')&&KEYS.every(k=>Number.isFinite(recipe.macros?.[k])&&recipe.macros[k]>=0);
 if(!verified)return null;
 const info=cookingInfo(recipe);
 return {macros:Object.fromEntries(KEYS.map(k=>[k,recipe.macros[k]])),category:recipe.category,
  allergens:[...new Set([...(recipe.allergens||[]),...recipe.items.flatMap(([id])=>ingredients[id].allergens||[])])].sort(),
  minutes:info.minutes,difficulty:info.difficulty,verified:true};
}
export function buildFamilyCatalog(catalog){
 const recipes={};
 for(const r of catalog.recipes){const entry=familyCatalogEntry(r,catalog.ingredients);if(entry)recipes[r.id]=entry}
 return {version:1,recipes};
}
const lookup=(catalog,id)=>typeof id==='string'&&Object.hasOwn(catalog.recipes,id)&&catalog.recipes[id]?.verified===true?{id,...catalog.recipes[id]}:null;
const usable=(r,slot,index,allergens)=>Boolean(r)&&(index===0?SLOT_CATEGORIES[slot]:SIDE_CATEGORIES).includes(r.category)
 &&r.macros.kcal>=50&&r.macros.kcal<=850&&KEYS.every(k=>Number.isFinite(r.macros[k])&&r.macros[k]>=0)
 &&Array.isArray(r.allergens)&&!r.allergens.some(a=>allergens.has(a));

// Full check of a candidate or submitted plan. Throws with a user-facing message; returns the normalised plan.
// members: [{id, requirements}] — only targets, allergens and season preference, never the private profile.
export function validateCommonPlan(input,members,catalog,{today}){
 if(!input||typeof input!=='object'||input.date!==today)throw failure('Ortak menü bugüne ait değil. Yeniden hesapla.');
 if(!Array.isArray(members)||members.length<2||members.length>MAX_PARTICIPANTS)throw failure('Ortak menü için 2–4 katılımcı gerekir.');
 if(new Set(members.map(m=>m?.id)).size!==members.length||members.some(m=>typeof m?.id!=='string'))throw failure('Katılımcılar tekrar ediyor.');
 for(const m of members){const error=requirementsError(m.requirements);if(error)throw failure(error)}
 if(catalog?.version!==1||!catalog.recipes||typeof catalog.recipes!=='object')throw failure('Tarif doğrulama verisi alınamadı. Mevcut menü korundu.');
 const entries=input.entries;
 if(!entries||typeof entries!=='object'||Object.keys(entries).length!==members.length||members.some(m=>!Object.hasOwn(entries,m.id)))throw failure('Katılımcı menüleri eksik.');
 const allergens=new Set(members.flatMap(m=>m.requirements.allergies)),byId=new Map(),common={};
 for(const slot of SHARED_SLOTS){
  const ids=input.common?.[slot];
  if(!Array.isArray(ids)||ids.length<1||ids.length>2||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'))throw failure('Ortak öğün tarifleri geçersiz.');
  common[slot]=[...ids];
 }
 const recipe=(id,slot,index)=>{
  const r=lookup(catalog,id);
  if(!r)throw failure('Tarif güncel doğrulama kataloğunda yok. Yeniden hesapla.');
  if(!usable(r,slot,index,allergens))throw failure('Bir tarif öğüne, besin aralığına veya katılımcıların alerjen filtresine uymuyor.');
  byId.set(id,r);return r;
 };
 const checked={};
 for(const m of members){
  const out={};
  for(const [slot] of SLOTS){
   const parts=mealItems(entries[m.id]?.[slot]),shared=SHARED_SLOTS.includes(slot);
   if(shared&&(parts.length!==common[slot].length||parts.some((e,i)=>e?.id!==common[slot][i])))throw failure('Öğle ve akşamda herkes aynı yemekleri yemeli.');
   if(!shared&&parts.length!==1)throw failure('Kahvaltı ve ara öğünde kişi başına bir tarif seçilir.');
   out[slot]={items:parts.map((e,i)=>{
    if(!(shared&&i>0?SIDE_PORTIONS:PORTIONS).includes(e.portion))throw failure('Porsiyon geçersiz.');
    recipe(e.id,slot,i);return {id:e.id,portion:e.portion};
   })};
  }
  if(!requirementsStatus(out,byId,m.requirements).ok)throw failure('Bir katılımcının günlük hedef sınırı sağlanmıyor.');
  checked[m.id]=out;
 }
 const cooking=cookingPreferences(input.cooking);
 // Shared dishes are cooked once; personal breakfasts and snacks are separate dishes.
 const groups=SLOTS.flatMap(([slot])=>SHARED_SLOTS.includes(slot)?[common[slot].map(id=>byId.get(id))]:members.map(m=>checked[m.id][slot].items.map(e=>byId.get(e.id))));
 if(!cookingFits(groups,cooking))throw failure('Süre veya zorluk tercihi sağlanmıyor.');
 return {date:input.date,times:mealTimes(input.times),cooking,common,entries:checked};
}

// Amount to cook: per shared slot, the sum of everyone's portions of each dish.
export function preparedPortions(plan){
 return Object.fromEntries(SHARED_SLOTS.map(slot=>[slot,plan.common[slot].map((id,i)=>({id,portion:Object.values(plan.entries).reduce((sum,e)=>sum+mealItems(e[slot])[i].portion,0)}))]));
}

const vec=(r,portion)=>KEYS.map(k=>r.macros[k]*portion);
const add=(a,b)=>a.map((n,i)=>n+b[i]);
function checks(r){return r.mode==='macro'?['protein','carbs','fat'].map(k=>({i:KEYS.indexOf(k),min:k===r.priority?r[k]*.9:0,max:r[k]*1.1})):[{i:0,min:r.target*.9,max:r.target*1.1}]}
const distance=(v,r)=>{const i=r.mode==='macro'?KEYS.indexOf(r.priority):0,t=r.mode==='macro'?r[r.priority]:r.target;return Math.abs(v[i]-t)/Math.max(t,1)};
// All portion vectors for a list of dishes (first dish full portion range, side dishes the side range).
function combos(dishes){
 let out=[{v:[0,0,0,0],p:[]}];
 dishes.forEach((r,i)=>{const set=i>0?SIDE_PORTIONS:PORTIONS;out=out.flatMap(c=>set.map(n=>({v:add(c.v,vec(r,n)),p:[...c.p,n]})))});
 return out;
}
// One participant: shared dishes fixed, choose personal breakfast/snack and all portions inside their own limits.
function fitMember(shared,breakfasts,snacks,req){
 const limits=checks(req),ok=v=>limits.every(c=>v[c.i]>=c.min-1e-6&&v[c.i]<=c.max+1e-6),under=v=>limits.every(c=>v[c.i]<=c.max+1e-6);
 const lunch=combos(shared.lunch),dinner=combos(shared.dinner);
 const hot=lunch.flatMap(l=>dinner.map(d=>({v:add(l.v,d.v),lunch:l.p,dinner:d.p}))).filter(h=>under(h.v));
 let best=null,score=Infinity;
 for(const b of breakfasts)for(const s of snacks){
  const personal=combos([b]).flatMap(x=>combos([s]).map(y=>({v:add(x.v,y.v),b:x.p[0],s:y.p[0]})));
  for(const h of hot)for(const p of personal){
   const v=add(h.v,p.v);if(!ok(v))continue;
   const d=distance(v,req);if(d<score){score=d;best={breakfast:{id:b.id,portion:p.b},snack:{id:s.id,portion:p.s},lunch:h.lunch,dinner:h.dinner}}
  }
  if(score<.02)break;
 }
 return best;
}
// Search a plan for today. Pure and synchronous; the browser runs it in a Worker and can terminate it.
// catalog: family-catalog.json; recipes/ingredients: full catalog, only used for seasonal ranking.
export function buildCommonPlan({catalog,members,today,cooking,recipes=[],ingredients={},history={},random=Math.random,now=Date.now(),attempts=40,deadline=Infinity}){
 try{
  if(!Array.isArray(members)||members.length<2||members.length>MAX_PARTICIPANTS)return {error:'Ortak menü için en az iki, en fazla dört katılımcının izni gerekir.'};
  for(const m of members){const error=requirementsError(m.requirements);if(error)return {error:(m.name?m.name+': ':'')+error}}
  if(catalog?.version!==1||!catalog.recipes)return {error:'Tarif doğrulama verisi alınamadı. Mevcut menü korundu.'};
  const prefs=cooking?cookingPreferences(cooking):cookingPreferences({style:'easy'});
  const allergens=new Set(members.flatMap(m=>m.requirements.allergies)),full=new Map(recipes.map(r=>[r.id,r]));
  const seasons=members.map(m=>selectedSeason(m.requirements.seasonPreference,now));
  const rank=r=>{const source=full.get(r.id);return (source?seasons.reduce((n,season)=>n+seasonalAffinity(source,ingredients,season),0)*.1:0)-(history[r.id]>now-7*86400000?1:0)+random()};
  const all=Object.keys(catalog.recipes).map(id=>lookup(catalog,id)).filter(r=>r&&cookingAllowed(r,prefs));
  const pool=(slot,index)=>all.filter(r=>usable(r,slot,index,allergens)&&(index===0||r.macros.kcal<=450)).map(r=>({r,k:rank(r)})).sort((a,b)=>b.k-a.k).map(x=>x.r);
  const mains={lunch:pool('lunch',0),dinner:pool('dinner',0)},sides=pool('lunch',1),breakfasts=pool('breakfast',0),snacks=pool('snack',0);
  if(!mains.lunch.length||!mains.dinner.length||!breakfasts.length||!snacks.length)return {error:'Süre, zorluk, alerjen ve besin kaynağı koşullarını birlikte sağlayan tarif yetersiz. Hedefler değiştirilmedi; süre veya zorluk tercihini değiştirebilirsin.'};
  const pick=(list,n)=>list[Math.floor(random()*Math.min(list.length,n))];
  const sample=(list,n,k)=>{const out=new Map();for(let i=0;i<k*3&&out.size<k;i++){const r=pick(list,n);out.set(r.id,r)}return [...out.values()]};
  for(let attempt=0;attempt<attempts;attempt++){
   if(Date.now()>deadline)return {error:'Hesaplama süre sınırını aştı. Mevcut menü korundu; tekrar deneyebilirsin.',timeout:true};
   const width=attempt<15?10:40,lunch=pick(mains.lunch,width),dinner=pick(mains.dinner,width);
   if(lunch.id===dinner.id)continue;
   const side=()=>{const r=pick(sides.filter(s=>s.id!==lunch.id&&s.id!==dinner.id),width);return r?[r]:[]};
   // Fewest dishes first: no side, then a shared side at dinner, at lunch, at both.
   for(const [ls,ds] of [[[],[]],[[],side()],[side(),[]],[side(),side()]]){
    const shared={lunch:[lunch,...ls],dinner:[dinner,...ds]};
    if(ls[0]&&ds[0]&&ls[0].id===ds[0].id)continue;
    if(!cookingFits([shared.lunch,shared.dinner],prefs))continue;
    const entries={};let ok=true;
    for(const m of members){
     const fit=fitMember(shared,sample(breakfasts,width,4),sample(snacks,width,4),m.requirements);
     if(!fit){ok=false;break}
     entries[m.id]={breakfast:{items:[fit.breakfast]},snack:{items:[fit.snack]},
      lunch:{items:shared.lunch.map((r,i)=>({id:r.id,portion:fit.lunch[i]}))},dinner:{items:shared.dinner.map((r,i)=>({id:r.id,portion:fit.dinner[i]}))}};
    }
    if(!ok)continue;
    try{return {plan:validateCommonPlan({date:today,cooking:prefs,common:{lunch:shared.lunch.map(r=>r.id),dinner:shared.dinner.map(r=>r.id)},entries},members,catalog,{today})}}catch{}
   }
  }
  return {error:'Herkesin günlük sınırını aynı öğle ve akşam yemeğiyle sağlayan bir menü bulunamadı. Hedefler değiştirilmedi; tekrar deneyebilir, süre/zorluk tercihini değiştirebilir veya katılımcıları değiştirebilirsin.'};
 }catch{return {error:'Ortak menü hesaplanamadı; mevcut kayıtların korundu.'}}
}
