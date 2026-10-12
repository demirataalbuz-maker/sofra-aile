import {resolvedWaterGoal,waterRecommendation} from './water.mjs?v=13';
export function hourlyWaterTimes(start=9,end=21){
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>23||start>end)throw Error('Başlangıç ve bitiş aynı gün içinde olmalı.');
 return Array.from({length:end-start+1},(_,i)=>String(start+i).padStart(2,'0')+':00');
}
export const DEFAULT_WATER_TIMES=hourlyWaterTimes();
export function needsWaterReminder(profile,tracking,day){
 if(waterRecommendation(profile).goal===null)return false;
 const goal=resolvedWaterGoal(profile,tracking);
 const drank=(tracking?.entries||[]).filter(e=>e.day===day&&e.kind==='water'&&!e.deleted).reduce((sum,e)=>sum+(Number.isFinite(e.ml)?e.ml:0),0);
 return goal>0&&drank<goal;
}
