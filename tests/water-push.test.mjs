import test from 'node:test';
import assert from 'node:assert/strict';
import {pushPreference} from '../water-push.mjs';
test('only eligibility and today pause leave device; undo and next day restore reminders',()=>{
 const now=new Date('2026-10-12T09:00:00Z'),s={profile:{age:30,sex:'male',weight:80,healthConditions:[]},tracking:{waterMode:'auto',entries:[]}};
 assert.deepEqual(pushPreference(s,now),{enabled:true,pausedDay:null});
 s.tracking.entries.push({kind:'water',day:'2026-10-12',ml:2000});
 assert.deepEqual(pushPreference(s,now),{enabled:true,pausedDay:'2026-10-12'});
 assert.deepEqual(pushPreference(s,new Date('2026-10-13T09:00:00Z')),{enabled:true,pausedDay:null});
 s.tracking.entries[0].deleted=true;assert.deepEqual(pushPreference(s,now),{enabled:true,pausedDay:null});
 s.profile.healthConditions=['kidney'];assert.deepEqual(pushPreference(s,now),{enabled:false,pausedDay:null});
 s.profile=null;assert.deepEqual(pushPreference(s,now),{enabled:false,pausedDay:null});
});
