import test from 'node:test';
import assert from 'node:assert/strict';
import {newEntry,daySummary,dateKey,dailyExport,captureDay,trackingState} from '../tracking.mjs';
const now=new Date('2026-10-11T22:00:00Z'),day='2026-10-12';
test('Turkey midnight, water undo and earlier days remain isolated',()=>{
 assert.equal(dateKey(now),day);
 const entries=[newEntry('water',{ml:250},day,now,'a'),newEntry('water',{ml:500},day,now,'b'),newEntry('water',{ml:300},'2026-10-11',now,'c')];
 assert.equal(daySummary(entries,day).water,750);entries[1].deleted=true;assert.equal(daySummary(entries,day).water,250);assert.equal(daySummary(entries,'2026-10-11').water,300);
 assert.throws(()=>newEntry('water',{ml:-50},day,now));assert.throws(()=>newEntry('water',{ml:250},'2026-10-13',now));
});
test('actual portions are snapshots and unknown outside meals never pretend to be zero',()=>{
 const m={kcal:400,protein:20,carbs:50,fat:13};
 const entries=[newEntry('food',{title:'Tarif',recipeId:'a',portion:.5,macros:m},day,now,'a'),newEntry('food',{title:'Dışarıda yemek',portion:1,macros:null},day,now,'b')];
 m.kcal=999;const result=daySummary(entries,day);assert.equal(result.totals.kcal,200);assert.equal(result.totals.protein,10);assert.equal(result.unknownCount,1);assert.equal(result.foodCount,2);
 assert.throws(()=>newEntry('food',{title:'Bozuk',portion:0,macros:m},day,now));
});
test('daily export captures historical targets without silently applying later weight changes',()=>{
 const s={profile:{weight:75},plan:{date:day,entries:{}},mealTimes:{breakfast:'08:00'},tracking:trackingState()};captureDay(s,day);s.profile.weight=80;
 s.tracking.entries.push(newEntry('water',{ml:250},day,now,'x'));
 const out=dailyExport(s,day);assert.equal(out.profile.weight,75);assert.equal(out.complete,false);assert.equal(out.summary.water,250);
 s.tracking.closedDays[day]=true;assert.equal(dailyExport(s,day).complete,true);
});

test('a missing historical snapshot never borrows today’s water target',()=>{
 const s={profile:{weight:80},mealTimes:{breakfast:'09:00'},tracking:trackingState({waterGoal:2500})};
 const out=dailyExport(s,'2025-01-01');assert.equal(out.waterGoal,null);assert.equal(out.profile,null);assert.equal(out.mealTimes,null);
 s.tracking.snapshots['2025-01-01']={waterGoal:null};assert.equal(dailyExport(s,'2025-01-01').waterGoal,null);
});
