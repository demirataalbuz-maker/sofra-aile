import test from 'node:test';
import assert from 'node:assert/strict';
import {compactSnapshots,expandSnapshots,compactState,expandState} from '../snapshots.mjs';
import {wirePayload,PILOT_MAX_BYTES} from '../sync.mjs';

const profileA={age:34,height:172,weight:78,sex:'female',activity:'light',goal:'lose',mode:'calorie',allergies:['peanut'],healthConditions:[]};
const profileB={...profileA,weight:76};
const times={breakfast:'08:30',lunch:'12:30',snack:'16:00',dinner:'19:30'};
// Same shape as captureDay() writes; plan.hash is JSON of the profile the plan was made for.
const day=(date,profile,{stalePlan=false,plan=true}={})=>({profile,plan:plan&&profile?{date,hash:JSON.stringify(stalePlan?profileA:profile),entries:{breakfast:{id:'kah-1',portion:1},lunch:{items:[{id:'tav-1',portion:1},{id:'sal-2',portion:0.5}]}},cooking:{style:'mixed',maxMinutes:0}}:null,mealTimes:times,waterGoal:1600,waterMode:'auto',otherDrinks:0});
function sample(){
 return {
  '2026-09-01':day('2026-09-01',null),
  '2026-09-02':day('2026-09-02',null,{plan:false}),
  '2026-09-03':day('2026-09-03',profileA),
  '2026-09-04':day('2026-09-04',profileA),
  '2026-09-05':day('2026-09-05',profileA,{plan:false}),
  '2026-09-06':day('2026-09-06',profileB,{stalePlan:true}), // profile changed after the plan was made
  '2026-09-07':day('2026-09-07',profileB),
  '2026-09-08':{profile:profileB,plan:null,mealTimes:times,waterGoal:null} // older snapshot without water fields
 };
}

test('compact → expand restores every daily summary exactly, key order included',()=>{
 const full=sample(),compact=compactSnapshots(structuredClone(full));
 assert.equal(JSON.stringify(expandSnapshots(compact)),JSON.stringify(full));
 assert.equal(JSON.stringify(expandSnapshots(JSON.parse(JSON.stringify(compact)))),JSON.stringify(full),'survives a JSON round trip');
 assert.equal(compact['2026-09-03'].profile.weight,78,'first day of a profile keeps the full copy');
 assert.equal(compact['2026-09-04'].sameProfile,true);assert.equal('profile' in compact['2026-09-04'],false);
 assert.equal(compact['2026-09-06'].profile.weight,76,'changed profile is stored again');
 assert.equal(compact['2026-09-06'].plan.hash,JSON.stringify(profileA),'a plan made for another profile keeps its own hash');
 assert.equal(compact['2026-09-07'].plan.hashFromProfile,true);assert.equal('hash' in compact['2026-09-07'].plan,false);
 assert.ok(JSON.stringify(compact).length<JSON.stringify(full).length*0.75);
});

test('expand is a no-op on the full format and compactState only touches tracking.snapshots',()=>{
 const full=sample();assert.equal(JSON.stringify(expandSnapshots(full)),JSON.stringify(full));
 const state={profile:profileA,plan:{date:'2026-09-07',hash:JSON.stringify(profileA)},tracking:{entries:[{id:'w',kind:'water'}],snapshots:full,closedDays:{}}};
 const wire=compactState(state);
 assert.equal(wire.plan.hash,state.plan.hash,'current plan untouched');assert.deepEqual(wire.tracking.entries,state.tracking.entries);
 assert.equal(JSON.stringify(expandState(wire)),JSON.stringify(state));
 assert.equal(JSON.stringify(state.tracking.snapshots),JSON.stringify(sample()),'input not mutated');
 assert.equal(compactState(null),null);assert.deepEqual(compactState({profile:null}),{profile:null});
});

test('a year of daily summaries shrinks by about half on the wire',()=>{
 const full={};const start=Date.parse('2025-10-01T12:00:00Z');
 for(let i=0;i<365;i++){const d=new Date(start+i*86400000).toISOString().slice(0,10);full[d]=day(d,i<200?profileA:profileB)}
 const before=JSON.stringify(full).length,after=JSON.stringify(compactSnapshots(full)).length;
 assert.ok(after<before*0.6,`${after} vs ${before}`);
 assert.equal(JSON.stringify(expandSnapshots(compactSnapshots(full))),JSON.stringify(full));
});

test('wire payload: refused locally above the entry or byte limit, never trimmed',()=>{
 const small={profile:profileA,tracking:{entries:[],snapshots:sample()}};
 assert.ok(wirePayload(small).tracking.snapshots['2026-09-04'].sameProfile);
 const big={profile:profileA,basket:Array.from({length:12000},(_,i)=>({id:'ing-'+i,qty:100,done:false})),tracking:{entries:[]}};
 assert.ok(JSON.stringify(big).length>PILOT_MAX_BYTES);
 assert.equal(wirePayload(big),null);assert.equal(big.basket.length,12000);
});
