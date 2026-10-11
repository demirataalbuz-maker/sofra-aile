export const nutrients=['kcal','protein','carbs','fat'];
export function dateKey(now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value}
export function numeric(value,min,max,label){if(value===''||value===null||!Number.isFinite(+value)||+value<min||+value>max)throw Error(label+' için geçerli bir miktar gir.');return +value}
export function newEntry(kind,data,day=dateKey(),now=new Date(),id=crypto.randomUUID()){
 if(!validDate(day)||day>dateKey(now))throw Error('Geleceğe tüketim kaydı eklenemez.');
 const entry={id,kind,day,at:now.toISOString()};
 if(kind==='water')entry.ml=numeric(data.ml,1,2000,'Su');
 else if(kind==='food'){
  entry.title=String(data.title||'').trim().slice(0,160);if(!entry.title)throw Error('Yemeğin adını yaz.');
  entry.portion=numeric(data.portion,.01,20,'Porsiyon');entry.recipeId=data.recipeId||null;
  entry.macros=data.macros===null?null:Object.fromEntries(nutrients.map(k=>[k,numeric(data.macros?.[k],0,k==='kcal'?10000:2000,k)]));
  entry.source=data.recipeId?'catalog':'manual';
 }else if(kind==='weight')entry.kg=numeric(data.kg,35,300,'Kilo');
 else throw Error('Bilinmeyen kayıt türü.');
 return entry;
}
export function daySummary(entries,day){
 const active=entries.filter(e=>e.day===day&&!e.deleted),food=active.filter(e=>e.kind==='food');
 return {water:active.filter(e=>e.kind==='water').reduce((s,e)=>s+e.ml,0),foodCount:food.length,unknownCount:food.filter(e=>!e.macros).length,totals:Object.fromEntries(nutrients.map(k=>[k,food.reduce((s,e)=>s+(e.macros?e.macros[k]*e.portion:0),0)])),weight:active.filter(e=>e.kind==='weight').at(-1)?.kg??null};
}
export function trackingState(input){return {entries:Array.isArray(input?.entries)?input.entries:[],waterGoal:Number.isFinite(input?.waterGoal)&&input.waterGoal>=250&&input.waterGoal<=6000?input.waterGoal:null,snapshots:input?.snapshots&&typeof input.snapshots==='object'?input.snapshots:{},closedDays:input?.closedDays&&typeof input.closedDays==='object'?input.closedDays:{}}}
export function dailyExport(state,day){const track=trackingState(state.tracking),snapshot=track.snapshots[day],current=day===dateKey();return {schemaVersion:1,date:day,timeZone:'Europe/Istanbul',profile:snapshot?.profile||(current?state.profile:null),plan:snapshot?.plan||(state.plan?.date===day?state.plan:null),mealTimes:snapshot?.mealTimes||(current?state.mealTimes:null),waterGoal:snapshot?snapshot.waterGoal:(current?track.waterGoal:null),complete:track.closedDays[day]===true,entries:track.entries.filter(e=>e.day===day&&!e.deleted),summary:daySummary(track.entries,day)}}

export function captureDay(state,day=dateKey()){
 state.tracking=trackingState(state.tracking);
 state.tracking.snapshots[day]=structuredClone({profile:state.profile||null,plan:state.plan?.date===day?state.plan:null,mealTimes:state.mealTimes,waterGoal:state.tracking.waterGoal});
}
