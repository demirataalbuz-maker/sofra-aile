import test from 'node:test';
import assert from 'node:assert/strict';
import {waterRecommendation,waterSettings,resolvedWaterGoal} from '../water.mjs';
import {trackingState,captureDay,dailyExport} from '../tracking.mjs';
import {instagramSource,recipeDraftLink} from '../recipe-inbox.mjs';
const profile={age:30,sex:'male',weight:80,activity:'moderate',healthConditions:[]};
test('adult drinks reference is separate from food water; other drinks reduce water without invented weight or exercise multipliers',()=>{
 assert.equal(waterRecommendation(profile).goal,2000);
 assert.equal(waterRecommendation({...profile,sex:'female'}).goal,1600);
 assert.equal(waterRecommendation(profile,500).goal,1500);
 assert.equal(waterRecommendation(profile,2500).goal,0);
 assert.equal(waterRecommendation({...profile,weight:250,activity:'high'}).goal,2000);
 assert.throws(()=>waterRecommendation(profile,-1));
 assert.throws(()=>waterRecommendation(profile,Infinity));
});
test('health restrictions, incomplete profiles and unsupported ages never receive an automatic target',()=>{
 for(const p of [null,{}, {...profile,age:17},{...profile,age:86},{...profile,sex:''},...['kidney','other','pregnancy','hypertension','diabetes'].map(c=>({...profile,healthConditions:[c]}))])assert.equal(waterRecommendation(p).goal,null);
 assert.equal(waterRecommendation({...profile,age:18}).goal,2000);
});
test('legacy manual targets and logs survive migration; auto changes do not alter past snapshots',()=>{
 const old=trackingState({waterGoal:2500,entries:[{kind:'water',ml:250}]});
 assert.equal(old.waterMode,'manual');assert.equal(old.entries.length,1);assert.equal(resolvedWaterGoal(profile,old),2500);
 assert.equal(waterSettings().waterMode,'auto');
 const state={profile,tracking:trackingState({waterMode:'auto',otherDrinks:500})};
 captureDay(state,'2026-10-10');state.profile={...profile,sex:'female'};
 assert.equal(resolvedWaterGoal(state.profile,state.tracking),1100);
 assert.equal(dailyExport(state,'2026-10-10').waterGoal,1500);
 assert.equal(dailyExport(state,'2026-10-09').waterGoal,null);
 state.profile.healthConditions=['kidney'];assert.equal(resolvedWaterGoal(state.profile,state.tracking),null);
});
test('Instagram links reject foreign hosts and non-post paths, remove trackers and encode only recipe form fields',()=>{
 assert.equal(instagramSource('https://www.instagram.com/reel/ABC_123/?igsh=secret#foo'),'https://www.instagram.com/reel/ABC_123/');
 for(const s of ['javascript:alert(1)','https://instagram.com.evil.test/p/abc/','https://user:pass@instagram.com/p/abc/','https://instagram.com:123/p/abc/','https://instagram.com/accounts/login/','https://instagram.com/username/'])assert.throws(()=>instagramSource(s));
 const u=new URL(recipeDraftLink({source:'https://instagram.com/p/ABC/',title:'A & B',notes:'Bir not',profile:{weight:80},token:'secret'}));
 assert.equal(u.hostname,'github.com');assert.equal(u.searchParams.get('recipe_name'),'A & B');
 assert.deepEqual([...u.searchParams.keys()],['template','source','recipe_name','notes']);assert.ok(!u.href.includes('secret'));
});
