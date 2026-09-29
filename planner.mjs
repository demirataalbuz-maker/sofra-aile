export const SLOTS=[
  ['breakfast','Kahvaltı',['Kahvaltı']],
  ['lunch','Öğle',['Tavuk','Et','Vejetaryen','Bakliyat','Balık']],
  ['dinner','Akşam',['Çorba','Sebze','Salata','Hindi','Ana yemek']],
  ['snack','Ara öğün',['Ara öğün']]
];

const activityFactors={low:1.2,light:1.375,moderate:1.55,high:1.725};
const keys=['kcal','protein','carbs','fat'];
export function profileError(p){
  if(!p||!['female','male'].includes(p.sex))return 'Hesaplama için cinsiyet seç.';
  if(!Number.isFinite(+p.age)||+p.age<19||+p.age>85)return 'Yaş 19–85 arasında olmalı.';
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
  const bmr=10*(+p.weight)+6.25*(+p.height)-5*(+p.age)+(p.sex==='male'?5:-161);
  const maintenance=Math.round(bmr*activityFactors[p.activity]);
  const change=p.goal==='lose'?-300:p.goal==='gain'?200:0;
  const suggested=Math.max(p.sex==='male'?1500:1200,maintenance+change);
  const target=p.mode==='macro' ? Math.round(+p.protein*4 + +p.carbs*4 + +p.fat*9) : (p.calorieTarget ? +p.calorieTarget : suggested);
  return {maintenance,suggested,target};
}
export function allowed(r,ingredients,allergies=[]){
  if(!r||!r.macros||!Number.isFinite(+r.macros.kcal))return false;
  const restricted=new Set(allergies);
  const found=[...(r.allergens||[])];
  for(const [id] of r.items||[])found.push(...(ingredients[id]?.allergens||[]));
  return !found.some(a=>restricted.has(a));
}
export function totals(entries,byId){
  const sum={kcal:0,protein:0,carbs:0,fat:0};
  for(const [slot] of SLOTS){const e=entries?.[slot],r=byId.get(e?.id);if(!r)continue;for(const k of keys)sum[k]+=Number(r.macros[k]||0)*Number(e.portion||1)}
  return sum;
}
function score(entries,byId,p,goal){
  const t=totals(entries,byId),target=goal.target;
  let result;
  if(p.mode==='macro'){
    const priority=+p[p.priority];
    result=3*Math.abs(t[p.priority]-priority)/Math.max(priority,30);
    for(const k of ['protein','carbs','fat'])if(k!==p.priority){const cap=+p[k];result+=1.8*Math.max(0,t[k]-cap*1.1)/Math.max(cap,30)}
    result+=.22*Math.abs(t.kcal-target)/Math.max(target,1200);
  }else result=3*Math.abs(t.kcal-target)/Math.max(target,1200);
  const ids=Object.values(entries).map(e=>e?.id);result+=(ids.length-new Set(ids).size)*.6;
  return result;
}
export function buildPlan(recipes,ingredients,p,random=Math.random,locked={},avoid={}){
  const byId=new Map(recipes.map(r=>[r.id,r]));const allergies=Array.isArray(p.allergies)?p.allergies:[];
  const pools=Object.fromEntries(SLOTS.map(([k,,categories])=>[k,recipes.filter(r=>categories.includes(r.category)&&r.id!==avoid[k]&&+r.macros?.kcal>=100&&+r.macros?.kcal<=850&&allowed(r,ingredients,allergies))]));
  if(SLOTS.some(([k])=>!pools[k].length))return null;
  const portions=[.75,1,1.25,1.5,2];const goal=estimate(p);
  let best=null,bestScore=Infinity;
  for(let i=0;i<6000;i++){
    const entries={};
    for(const [k] of SLOTS){const r=pools[k][Math.floor(random()*pools[k].length)];entries[k]=locked[k]||{id:r.id,portion:portions[Math.floor(random()*portions.length)]}}
    const value=score(entries,byId,p,goal);
    if(value<bestScore){bestScore=value;best=entries}
  }
  return best;
}
