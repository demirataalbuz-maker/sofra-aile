import {profileError,estimate,totals} from './planner.mjs?v=11';
import {planningBlock} from './health.mjs?v=11';
const allergyIds=['milk','egg','gluten','nuts','peanut','soy','sesame','fish','mustard'];
export function requirementsError(r){
 if(!r||!['calorie','macro'].includes(r.mode))return 'Ortak hesap için hedefini tamamla.';
 if(r.mode==='calorie'&&(!Number.isFinite(r.target)||r.target<1200||r.target>4500))return 'Ortak kalori hedefi 1200–4500 kcal aralığında olmalı.';
 if(r.mode==='macro'&&(!['protein','carbs','fat'].includes(r.priority)||['protein','carbs','fat'].some(k=>!Number.isFinite(r[k])||r[k]<10||r[k]>350)))return 'Ortak makro hedefleri geçersiz.';
 if(!Array.isArray(r.allergies)||r.allergies.some(a=>!allergyIds.includes(a)))return 'Alerjen tercihi geçersiz.';
 if(!['auto','winter','spring','summer','autumn'].includes(r.seasonPreference))return 'Mevsim tercihi geçersiz.';
 return '';
}
export function cleanRequirements(r){
 const error=requirementsError(r);if(error)throw Error(error);
 return {...(r.mode==='calorie'?{mode:'calorie',target:r.target}:{mode:'macro',protein:r.protein,carbs:r.carbs,fat:r.fat,priority:r.priority}),allergies:[...new Set(r.allergies)].sort(),seasonPreference:r.seasonPreference};
}
export function planningRequirements(profile){
 const error=profileError(profile)||planningBlock(profile);if(error)throw Error(error);
 return cleanRequirements({...profile,target:estimate(profile).target,protein:+profile.protein,carbs:+profile.carbs,fat:+profile.fat,allergies:profile.allergies||[],seasonPreference:profile.seasonPreference||'auto'});
}
export const memberRequirements=m=>m.requirements||planningRequirements(m.profile);
export function requirementsChecks(r){return r.mode==='macro'?['protein','carbs','fat'].map(key=>({key,min:key===r.priority?r[key]*.9:0,max:r[key]*1.1})):[{key:'kcal',min:r.target*.9,max:r.target*1.1}]}
export function requirementsStatus(entries,byId,r){const actual=totals(entries,byId),checks=requirementsChecks(r);return {actual,checks,ok:checks.every(c=>Number.isFinite(actual[c.key])&&actual[c.key]>=c.min-1e-6&&actual[c.key]<=c.max+1e-6)}}
