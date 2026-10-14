import {buildPlan,rememberRecommendations,targetStatus,profileError,allowed,SLOTS} from './planner.mjs?v=21';
import {planningBlock} from './health.mjs?v=11';
import {cookingFits} from './cooking.mjs?v=11';
import {mealItems} from './planner.mjs?v=21';
export function buildWeek(recipes,ingredients,profile,{start,history={},cooking,random=Math.random}={}){
 const error=profileError(profile)||planningBlock(profile);if(error)throw Error(error);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start||''))throw Error('Hafta başlangıç tarihi geçersiz.');
 const initial=new Date(start+'T12:00:00Z');if(!Number.isFinite(+initial)||initial.toISOString().slice(0,10)!==start)throw Error('Hafta başlangıç tarihi geçersiz.');
 let recent=history;const days=[],missing=[];
 for(let i=0;i<7;i++){
  const time=+initial+i*86400000,date=new Date(time).toISOString().slice(0,10);
  const entries=buildPlan(recipes,ingredients,profile,random,{},{},{history:recent,now:time,cooking});
  if(!entries){missing.push(date);continue;}
  days.push({date,entries});recent=rememberRecommendations(recent,entries,time);
 }
 return {start,profileHash:JSON.stringify(profile),cooking,days,missing};
}
export function validWeekDay(day,week,recipes,profile,ingredients={}){
 if(week?.profileHash!==JSON.stringify(profile)||profileError(profile)||planningBlock(profile))return false;
 const byId=new Map(recipes.map(r=>[r.id,r]));
 const parts=SLOTS.map(([slot])=>mealItems(day?.entries?.[slot]));
 if(parts.some(g=>!g.length||g.length>2||g.some(e=>!Number.isFinite(e.portion)||e.portion<=0||e.portion>2||!allowed(byId.get(e.id),ingredients,profile.allergies))))return false;
 const groups=parts.map(g=>g.map(x=>byId.get(x.id)));
 return groups.length===4&&groups.every(g=>g.length&&g.every(Boolean))&&targetStatus(day.entries,byId,profile).ok&&cookingFits(groups,week.cooking);
}
