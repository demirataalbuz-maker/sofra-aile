import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAutomaticWaterTarget,resolvedWaterGoal} from '../water.mjs';
import {hourlyWaterTimes,needsWaterReminder} from '../water-reminders.mjs';
const profile={age:30,sex:'male',healthConditions:[]};
test('eligible legacy profile automatically switches once, preserves manual value and history, later overrides remain',()=>{
 const s={profile,tracking:{waterGoal:2500,waterMode:'manual',snapshots:{yesterday:{waterGoal:2500}},entries:[{ml:250}]}};
 assert.equal(applyAutomaticWaterTarget(s),true);assert.equal(resolvedWaterGoal(profile,s.tracking),2000);
 assert.equal(s.tracking.waterGoal,2500);assert.equal(s.tracking.entries.length,1);assert.equal(s.tracking.snapshots.yesterday.waterGoal,2500);
 s.tracking.waterMode='manual';assert.equal(applyAutomaticWaterTarget(s),false);assert.equal(resolvedWaterGoal(profile,s.tracking),2500);
 const clinical={profile:{...profile,healthConditions:['kidney']},tracking:{waterGoal:1200,waterMode:'manual'}};
 assert.equal(applyAutomaticWaterTarget(clinical),false);assert.equal(clinical.tracking.waterMode,'manual');
 assert.equal(applyAutomaticWaterTarget({profile:null}),false);
});
test('hourly schedule includes daytime boundaries only; no stale, deleted or other-day totals suppress reminders',()=>{
 const times=hourlyWaterTimes();assert.equal(times.length,13);assert.equal(times[0],'09:00');assert.equal(times.at(-1),'21:00');
 assert.throws(()=>hourlyWaterTimes(22,7));assert.throws(()=>hourlyWaterTimes(1,24));
 const t={waterMode:'auto',entries:[{kind:'water',day:'2026-10-11',ml:3000}]};
 assert.equal(needsWaterReminder(profile,t,'2026-10-12'),true);
 t.entries.push({kind:'water',day:'2026-10-12',ml:2000});assert.equal(needsWaterReminder(profile,t,'2026-10-12'),false);
 t.entries[1].deleted=true;assert.equal(needsWaterReminder(profile,t,'2026-10-12'),true);
 assert.equal(needsWaterReminder({...profile,healthConditions:['kidney']},t,'2026-10-12'),false);
 assert.equal(needsWaterReminder(null,t,'2026-10-12'),false);
});
