import test from 'node:test';
import assert from 'node:assert/strict';
import {menuForSharing,createFamilyCloud} from '../family-cloud.mjs';
import {captureInvitation,clearInvitation,readFamilyInvitation,clearFamilyInvitation} from '../invitation.mjs';
const state=()=>({profile:{weight:90,allergies:['milk']},tracking:{entries:[{kind:'weight',kg:90}]},plan:{date:'2026-10-14',hash:'sensitive-profile',entries:Object.fromEntries(['breakfast','lunch','snack','dinner'].map(k=>[k,{id:'recipe-'+k,portion:1}]))},mealTimes:{breakfast:'08:00',lunch:'13:00',snack:'16:00',dinner:'19:00'}});
const wait=()=>new Promise(r=>setTimeout(r,15));
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
function setup(){
 let current={accountId:'A',token:'token-a'},data=state();const calls=[],notices=[],members={A:{id:'member-A',isSelf:true,revision:0,shareMenu:false,menu:null},B:{id:'member-B',isSelf:true,revision:0,shareMenu:false,menu:null}};
 const api=async(path,payload,{session})=>{
  calls.push({path,account:session.accountId,payload});const m=members[session.accountId];
  if(path==='/family/get')return {group:{members:[structuredClone(m)]}};
  if(path==='/family/share'){
   if(payload.revision!==m.revision||payload.membershipId!==m.id)throw Object.assign(Error('Conflict'),{code:'family-conflict'});
   Object.assign(m,{revision:m.revision+1,shareMenu:payload.shareMenu,menu:payload.menu});return {revision:m.revision,shareMenu:m.shareMenu};
  }
 };
 const engine=createFamilyCloud({api,session:()=>current,getState:()=>data,delay:1,notify:x=>notices.push(x)});
 return {engine,calls,members,notices,api,session:()=>current,setSession:s=>current=s,getState:()=>data,setState:s=>data=s};
}
test('only menu/time/portions are shared; family invitation remains after Google login for explicit acceptance',()=>{
 const menu=menuForSharing(state());assert.deepEqual(Object.keys(menu).sort(),['date','entries','times']);assert.ok(!JSON.stringify(menu).includes('sensitive'));assert.ok(!JSON.stringify(menu).includes('milk'));
 assert.equal(menuForSharing({...state(),plan:null}),null);
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const token='x'.repeat(43),location={hash:'#familyInvite='+token,pathname:'/',search:'?page=account'};
 let url;assert.equal(captureInvitation(location,{replaceState:(_,__,u)=>url=u},storage),token);assert.equal(url,'/?page=account');
 clearInvitation(storage);assert.equal(readFamilyInvitation(storage),token);
 clearFamilyInvitation(storage);assert.equal(readFamilyInvitation(storage),null);
});
test('share is opt-in; menu edits publish once; withdrawal removes menu; personal data never uploaded',async()=>{
 const s=setup();await s.engine.read();s.engine.queue();await wait();assert.equal(s.calls.filter(c=>c.path==='/family/share').length,0);
 await s.engine.setSharing(true);s.getState().plan.entries.lunch.portion=1.5;s.engine.queue();await wait();await s.engine.settled();
 assert.equal(s.members.A.menu.entries.lunch.items[0].portion,1.5);
 assert.ok(!JSON.stringify(s.calls).includes('sensitive-profile'));
 s.engine.queue();await wait();assert.equal(s.calls.filter(c=>c.path==='/family/share').length,2);
 await s.engine.setSharing(false);s.getState().plan.entries.lunch.portion=2;s.engine.queue();await wait();assert.equal(s.members.A.menu,null);
});
test('queued and in-flight A work never sends to B or changes B context',async()=>{
 const s=setup();await s.engine.read();await s.engine.setSharing(true);
 s.getState().plan.entries.lunch.portion=1.5;s.engine.queue();s.setSession({accountId:'B',token:'token-b'});await wait();await s.engine.settled();
 assert.equal(s.calls.filter(c=>c.path==='/family/share'&&c.account==='B').length,0);
 assert.equal(s.members.A.menu.entries.lunch.items[0].portion,1);
 const held=gate(),requested=gate();s.setSession({accountId:'A',token:'token-a'});
 const engine=createFamilyCloud({api:async(...args)=>{if(args[0]==='/family/share'){requested.resolve();await held.promise}return s.api(...args)},session:s.session,getState:s.getState,delay:1});
 await engine.read();s.getState().plan.entries.lunch.portion=1.75;engine.queue();await requested.promise;s.setSession({accountId:'B',token:'token-b'});await engine.read();held.resolve();await wait();await engine.settled();
 s.getState().plan.entries.lunch.portion=2;engine.queue();await wait();assert.equal(s.calls.filter(c=>c.path==='/family/share'&&c.account==='B').length,0);
});
test('other-device share-off rejects stale queue; profile change withdraws old menu',async()=>{
 const s=setup();await s.engine.read();await s.engine.setSharing(true);
 s.members.A.shareMenu=false;s.members.A.menu=null;s.members.A.revision++;
 s.getState().plan.entries.lunch.portion=1.5;s.engine.queue();await wait();await s.engine.settled();assert.equal(s.members.A.menu,null);assert.ok(s.notices[0].includes('başka cihazda'));
 await s.engine.read();await s.engine.setSharing(true);s.setState({...s.getState(),plan:null});s.engine.queue();await wait();await s.engine.settled();assert.equal(s.members.A.shareMenu,false);assert.equal(s.members.A.menu,null);
});
test('old group read cannot overwrite newer group read',async()=>{
 const s=setup(),hold=gate();let calls=0;
 const engine=createFamilyCloud({api:async()=>{calls++;if(calls===1){await hold.promise;return {group:{members:[{id:'old',isSelf:true,shareMenu:true,revision:0}]}}}return {group:null}},session:s.session,getState:s.getState});
 const old=engine.read();await engine.read();hold.resolve();await assert.rejects(()=>old,/değişti/);
});
