import {selectedSeason,seasonalAffinity} from './seasons.mjs?v=6';
export const SLOTS=[
  ['breakfast','Kahvaltı',['Kahvaltı']],
  ['lunch','Öğle',['Tavuk','Et','Vejetaryen','Bakliyat','Balık']],
  ['dinner','Akşam',['Çorba','Sebze','Salata','Hindi','Ana yemek']],
  ['snack','Ara öğün',['Ara öğün']]
];

const activityFactors={low:1.2,light:1.375,moderate:1.55,high:1.725};
const keys=['kcal','protein','carbs','fat'];
const DAY=24*60*60*1000;
export const DEFAULT_TIMES={breakfast:'08:00',lunch:'13:00',snack:'16:00',dinner:'19:00'};
export const mealItems=entry=>Array.isArray(entry?.items)?entry.items:entry?.id?[entry]:[];
export function mealTimes(input={}){
  return Object.fromEntries(SLOTS.map(([slot])=>[slot,/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input?.[slot])?input[slot]:DEFAULT_TIMES[slot]]));
}
export function orderedSlots(times={}){
  const values=mealTimes(times);return [...SLOTS].sort((a,b)=>values[a[0]].localeCompare(values[b[0]]));
}

// Store only recipe IDs and their last recommendation time, never every render.
export function rememberRecommendations(history,entries={},now=Date.now()){
  const kept=new Map(Object.entries(history&&typeof history==='object'?history:{}).filter(([id,time])=>
    id.length<=200&&Number.isFinite(time)&&time<=now&&time>=now-30*DAY));
  for(const entry of Object.values(entries||{}))for(const part of mealItems(entry))if(typeof part?.id==='string')kept.set(part.id,now);
  return Object.fromEntries([...kept].sort((a,b)=>b[1]-a[1]).slice(0,1000));
}

function variedPool(pool,history,now){
  const fresh=pool.filter(r=>history[r.id]===undefined||history[r.id]<=now-7*DAY);
  if(fresh.length)return fresh;
  // With a small eligible catalog, cycle oldest recommendations first.
  const oldest=Math.min(...pool.map(r=>history[r.id]));
  return pool.filter(r=>history[r.id]===oldest);
}
export function profileError(p){
  if(!p||!['female','male'].includes(p.sex))return 'Hesaplama için cinsiyet seç.';
  if(!Number.isInteger(+p.age)||+p.age<18||+p.age>85)return 'Yaş 18–85 arasında tam sayı olmalı.';
  if(!Number.isFinite(+p.height)||+p.height<120||+p.height>220)return 'Boy 120–220 cm arasında olmalı.';
  if(!Number.isFinite(+p.weight)||+p.weight<35||+p.weight>300)return 'Kilo 35–300 kg arasında olmalı.';
  if(!activityFactors[p.activity])return 'Hareket düzeyini seç.';
  if(!['lose','maintain','gain'].includes(p.goal))return 'Hedefini seç.';
  if(p.targetWeight!==''&&p.targetWeight!=null&&(!Number.isFinite(+p.targetWeight)||+p.targetWeight<35||+p.targetWeight>300))return 'Hedef kilo 35–300 kg arasında olmalı.';
  if(p.mode==='macro'){
    if(!['protein','carbs','fat'].includes(p.priority))return 'Öncelikli makroyu seç.';
    for(const k of ['protein','carbs','fat'])if(!Number.isFinite(+p[k])||+p[k]<10||+p[k]>350)return 'Makro hedefleri 10–350 g arasında olmalı.';
  }else if(p.mode!=='calorie')return 'Hedef türünü seç.';
  if(p.calorieTarget!==''&&p.calorieTarget!=null&&(!Number.isFinite(+p.calorieTarget)||+p.calorieTarget<1200||+p.calorieTarget>4500))return 'Kalori hedefi 1200–4500 kcal arasında olmalı.';
  return '';
}
export function estimate(p){
  const bmr=9.99*(+p.weight)+6.25*(+p.height)-4.92*(+p.age)+(p.sex==='male'?5:-161);
  const maintenance=Math.round(bmr*activityFactors[p.activity]);
  const change=p.goal==='lose'?-300:p.goal==='gain'?200:0;
  const suggested=Math.max(p.sex==='male'?1500:1200,maintenance+change);
  const target=p.mode==='macro' ? Math.round(+p.protein*4 + +p.carbs*4 + +p.fat*9) : (p.calorieTarget ? +p.calorieTarget : suggested);
  return {maintenance,suggested,target};
}
export function matchingAllergens(r,ingredients,allergies=[]){
  if(!r)return [];
  const restricted=new Set(Array.isArray(allergies)?allergies:[]);
  const found=new Set(r.allergens||[]);
  for(const [id] of r.items||[])for(const allergen of ingredients[id]?.allergens||[])found.add(allergen);
  return [...found].filter(a=>restricted.has(a));
}
export function allowed(r,ingredients,allergies=[]){
  if(!r||!r.macros||!Number.isFinite(+r.macros.kcal))return false;
  return matchingAllergens(r,ingredients,allergies).length===0;
}
export function totals(entries,byId){
  const sum={kcal:0,protein:0,carbs:0,fat:0};
  for(const [slot] of SLOTS)for(const e of mealItems(entries?.[slot])){const r=byId.get(e?.id);if(!r)continue;for(const k of keys)sum[k]+=Number(r.macros[k]||0)*Number(e.portion||1)}
  return sum;
}
export function targetStatus(entries,byId,p){
  const actual=totals(entries,byId),goal=estimate(p),checks=[];
  if(p.mode==='macro'){
    for(const key of ['protein','carbs','fat'])checks.push({key,min:key===p.priority?+p[key]*.9:0,max:+p[key]*1.1});
  }else checks.push({key:'kcal',min:goal.target*.9,max:goal.target*1.1});
  return {actual,target:goal.target,checks,ok:checks.every(({key,min,max})=>Number.isFinite(actual[key])&&actual[key]>=min-1e-6&&actual[key]<=max+1e-6)};
}
function score(entries,byId,p,goal){
  const t=totals(entries,byId),target=goal.target;
  let result;
  if(p.mode==='macro'){
    const priority=+p[p.priority];
    result=3*Math.abs(t[p.priority]-priority)/Math.max(priority,30);
    for(const k of ['protein','carbs','fat'])if(k!==p.priority){const cap=+p[k];result+=1.8*Math.max(0,t[k]-cap*1.1)/Math.max(cap,30)}
    // Secondary macros are ceilings, not amounts that must be filled with calories.
  }else result=3*Math.abs(t.kcal-target)/Math.max(target,1200);
  const ids=Object.values(entries).flatMap(mealItems).map(e=>e.id);result+=(ids.length-new Set(ids).size)*.6;
  return result;
}
export function buildPlan(recipes,ingredients,p,random=Math.random,locked={},avoid={},options={}){
  const byId=new Map(recipes.map(r=>[r.id,r]));const allergies=Array.isArray(p.allergies)?p.allergies:[];
  const now=options.now??Date.now(),history=rememberRecommendations(options.history,{},now);
  const pools=Object.fromEntries(SLOTS.map(([k,,categories])=>[k,variedPool(recipes.filter(r=>categories.includes(r.category)&&r.id!==avoid[k]&&+r.macros?.kcal>=100&&+r.macros?.kcal<=850&&allowed(r,ingredients,allergies)),history,now)]));
  if(SLOTS.some(([k])=>locked[k]?mealItems(locked[k]).some(e=>!allowed(byId.get(e.id),ingredients,allergies)):!pools[k].length))return null;
  const portions=[.75,1,1.25,1.5,2];const goal=estimate(p);
  const season=selectedSeason(p.seasonPreference,now);
  const affinity=new Map(recipes.map(r=>[r.id,seasonalAffinity(r,ingredients,season)]));
  const valueOf=entries=>score(entries,byId,p,goal)-.025*Object.values(entries).flatMap(mealItems).reduce((sum,e)=>sum+affinity.get(e.id),0);
  let best=null,bestScore=Infinity;
  const consider=entries=>{if(!targetStatus(entries,byId,p).ok)return;const value=valueOf(entries);if(value<bestScore){bestScore=value;best=entries}};
  const unlocked=SLOTS.filter(([k])=>!locked[k]);
  // A swap checks every eligible recipe/portion against the original daily target.
  // It never changes locked meals or silently expands the target to fit a dish.
  if(unlocked.length===1){
    const [slot]=unlocked[0];
    for(const r of pools[slot])for(const portion of portions)consider({...locked,[slot]:{id:r.id,portion}});
    return best;
  }
  for(let i=0;i<6000;i++){
    const entries={};
    for(const [k] of SLOTS){if(locked[k]){entries[k]=locked[k];continue}const r=pools[k][Math.floor(random()*pools[k].length)];entries[k]={id:r.id,portion:portions[Math.floor(random()*portions.length)]}}
    consider(entries);
  }
  return best;
}

export function validReplacement(entries,slot,candidate,recipes,ingredients,p){
  return validCandidate(entries,slot,candidate,new Map(recipes.map(r=>[r.id,r])),ingredients,p);
}
function validCandidate(entries,slot,candidate,byId,ingredients,p){
  if(!SLOTS.some(([key])=>key===slot))return false;
  const items=mealItems(candidate);
  if(items.length<1||items.length>2||new Set(items.map(e=>e.id)).size!==items.length)return false;
  for(const [key] of SLOTS){
    const parts=mealItems(key===slot?candidate:entries?.[key]);
    if(!parts.length||parts.length>2||parts.some(e=>!Number.isFinite(e.portion)||e.portion<=0||e.portion>2||!allowed(byId.get(e.id),ingredients,p.allergies)))return false;
  }
  return targetStatus({...entries,[slot]:candidate},byId,p).ok;
}

// Curated previews, ranked around the remaining DAILY budget. A meal has no
// compounding ±10% allowance of its own. Selection revalidates the current day.
export function replacementOptions(recipes,ingredients,p,entries,slot,{kind='single',history={},now=Date.now(),limit=8}={}){
  const definition=SLOTS.find(([key])=>key===slot);if(!definition)return [];
  const byId=new Map(recipes.map(r=>[r.id,r])),goal=estimate(p),season=selectedSeason(p.seasonPreference,now);
  const metric=p.mode==='macro'?p.priority:'kcal',target=p.mode==='macro'?+p[metric]:goal.target;
  const locked={...entries};delete locked[slot];const residual=Math.max(0,target-totals(locked,byId)[metric]);
  const currentIds=new Set(mealItems(entries[slot]).map(e=>e.id));
  const otherIds=new Set(Object.values(locked).flatMap(mealItems).map(e=>e.id));
  const safe=recipes.filter(r=>!otherIds.has(r.id)&&r.macros?.kcal>=50&&r.macros?.kcal<=850&&allowed(r,ingredients,p.allergies));
  const freshness=r=>history[r.id]>now-7*DAY ? .15 : 0;
  const rank=r=>Math.abs((r.macros[metric]||0)-residual)/Math.max(30,residual)+freshness(r)-.03*seasonalAffinity(r,ingredients,season);
  const mains=safe.filter(r=>definition[2].includes(r.category)).sort((a,b)=>rank(a)-rank(b));
  const currentTotal=totals({[slot]:entries[slot]},byId),options=new Map();
  const consider=items=>{
    const candidate=items.length===1?items[0]:{items};
    if(!validCandidate(entries,slot,candidate,byId,ingredients,p))return;
    const key=items.map(e=>e.id).sort().join('|');
    const daily=totals({...entries,[slot]:candidate},byId),meal=totals({[slot]:candidate},byId);
    const value=Math.abs(daily[metric]-target)/Math.max(target,30)+.08*Math.abs(meal[metric]-currentTotal[metric])/Math.max(currentTotal[metric],30)+items.reduce((sum,e)=>sum+freshness(byId.get(e.id))-.025*seasonalAffinity(byId.get(e.id),ingredients,season),0);
    if(!options.has(key)||value<options.get(key).value)options.set(key,{entry:candidate,daily,meal,value});
  };
  const portions=[.5,.75,1,1.25,1.5,2];
  if(kind==='single'){
    for(const r of mains)if(!currentIds.has(r.id))for(const portion of portions)consider([{id:r.id,portion}]);
  }else{
    const categories=slot==='breakfast'?['Ara öğün','Kahvaltı']:slot==='snack'?['Ara öğün']:['Salata','Çorba','Sebze'];
    const sides=safe.filter(r=>categories.includes(r.category)).sort((a,b)=>a.macros.kcal-b.macros.kcal).slice(0,18);
    for(const main of mains.slice(0,24))for(const side of sides)if(main.id!==side.id)for(const a of [.5,.75,1,1.25])for(const b of [.5,.75,1])consider([{id:main.id,portion:a},{id:side.id,portion:b}]);
  }
  return [...options.values()].sort((a,b)=>a.value-b.value).slice(0,Math.min(8,Math.max(0,limit)));
}
