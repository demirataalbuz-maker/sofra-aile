import test from 'node:test';
import assert from 'node:assert/strict';
import {createSync,readLink,writeLink,localPayload,statusText,PILOT_MAX_ENTRIES} from '../sync.mjs';
import {api,readSession,accountReady,AccountError,signOut} from '../cloud.mjs';

const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),full:false}};
const fail=(status,code,body={})=>new AccountError('x',status,code,{code,...body});
let tokens=0;const newToken=()=>String(++tokens).padStart(43,'t');
// In-memory stand-in for the account Worker. It authenticates ONLY with the session the caller passed,
// and records it, so a request made with the wrong account's session is visible in `calls`.
function server(){
 const accounts={},calls=[];
 const ensure=id=>accounts[id]||={state:null,stateHash:null,revision:0,sync:false};
 const srv={accounts,calls,offline:false,hook:null,
  client(){return async(path,data={},options={})=>{
   const s=options.session;assert.ok(s?.token,'engine must pass its pinned session');
   calls.push({path,account:s.accountId,token:s.token,data});
   if(srv.hook)await srv.hook(path,s);
   if(srv.offline)throw fail(0,'offline');
   const a=ensure(s.accountId);
   if(path==='/account')return {sync:{enabled:a.sync,hasState:a.state!==null,stateHash:a.stateHash,revision:a.revision}};
   if(path==='/sync/settings'){if(data.revision!==a.revision)throw fail(409,'conflict',{revision:a.revision,stateHash:a.stateHash});a.sync=data.sync;a.revision++;return {revision:a.revision,enabled:a.sync}}
   if(!a.sync)throw fail(403,'sync-off');
   if(path==='/sync/pull')return {state:structuredClone(a.state),stateHash:a.stateHash,revision:a.revision};
   if(path==='/sync/push'){
    if(data.state?.tracking?.entries?.length>PILOT_MAX_ENTRIES)throw fail(413,'pilot-limit');
    if(data.revision!==a.revision)throw fail(409,'conflict',{revision:a.revision,stateHash:a.stateHash});
    a.state=structuredClone(data.state);a.revision++;a.stateHash='h'+a.revision;return {revision:a.revision,stateHash:a.stateHash};
   }
   throw fail(404,'');
  }}
 };
 return srv;
}
function device(srv,initial={profile:{age:30},tracking:{entries:[]},family:{members:['secret-family']}}){
 const storage=memory();let state=structuredClone(initial),session=null;
 const timers=[];
 const sync=createSync({api:srv.client(),session:()=>session,getState:()=>state,storage,
  // Mirrors app.js: the persistent write happens first and throws before state changes.
  applyRemote:remote=>{if(storage.full)throw Error('QuotaExceededError');state={...structuredClone(remote),family:state.family,reports:state.reports}},
  schedule:fn=>{timers.push(fn);return timers.length},cancel:()=>{}});
 const realSet=storage.setItem;storage.setItem=(k,v)=>{if(storage.full&&k==='sofra-before-cloud')throw Error('QuotaExceededError');realSet(k,v)};
 return {sync,storage,get state(){return state},set state(v){state=v},
  // Every sign-in gets a fresh token, like the real server, so A→B→A is a different session.
  signIn:id=>{session={accountId:id,token:newToken(),email:id+'@example.test'}},signOut:()=>{session=null},
  edit:fn=>{fn(state);sync.queue()},drain:async()=>{while(timers.length)await timers.shift()()}};
}
const water=id=>({id,kind:'water',ml:250});
const linkedDevice=async(srv,id='acc-a')=>{const d=device(srv);d.signIn(id);await d.sync.connect('upload');return d};

test('signing in uploads nothing; only an explicit connect does, and family data never leaves the device',async()=>{
 const srv=server(),a=device(srv);a.signIn('acc-a');
 a.edit(s=>s.tracking.entries.push(water('w1')));await a.drain();
 assert.equal(await a.sync.restore(),false);
 assert.deepEqual(srv.calls,[]);assert.equal(a.sync.status().kind,'not-linked');
 await a.sync.connect('upload');
 assert.equal(srv.accounts['acc-a'].state.tracking.entries[0].id,'w1');
 assert.equal(srv.accounts['acc-a'].state.family,undefined);
 assert.deepEqual(localPayload({profile:1,family:2,reports:3,cloudSettings:4}),{profile:1});
});

test('two devices: edits flow both ways and offline edits upload after reconnect',async()=>{
 const srv=server(),a=device(srv),b=device(srv,{profile:null,tracking:{entries:[]}});
 a.signIn('acc');b.signIn('acc');
 await a.sync.connect('upload');
 await b.sync.connect('download');assert.equal(b.state.profile.age,30);assert.ok(b.sync.hasBackup());
 b.edit(s=>s.tracking.entries.push(water('from-b')));await b.drain();
 assert.equal(await a.sync.restore(),true);assert.equal(a.state.tracking.entries[0].id,'from-b');
 assert.deepEqual(a.state.family,{members:['secret-family']},'downloads keep local family data');
 srv.offline=true;a.edit(s=>s.tracking.entries.push(water('offline-a')));await a.drain();
 assert.equal(a.sync.status().kind,'offline');assert.equal(srv.accounts.acc.state.tracking.entries.length,1);
 srv.offline=false;await a.sync.restore();
 assert.deepEqual(srv.accounts.acc.state.tracking.entries.map(e=>e.id),['from-b','offline-a']);
 assert.equal(a.sync.status().kind,'synced');
});

test('divergent edits stop in conflict, keep local data and resolve only by explicit choice',async()=>{
 const srv=server(),a=device(srv),b=device(srv);a.signIn('acc');b.signIn('acc');
 await a.sync.connect('upload');await b.sync.connect('download');
 srv.offline=true;b.edit(s=>s.tracking.entries.push(water('b-offline')));await b.drain();srv.offline=false;
 a.edit(s=>s.tracking.entries.push(water('a-online')));await a.drain();
 await b.sync.restore();assert.equal(b.sync.status().kind,'conflict');
 assert.equal(b.state.tracking.entries[0].id,'b-offline','local edit kept');
 b.edit(s=>s.tracking.entries.push(water('b-more')));await b.drain();
 assert.equal(srv.accounts.acc.state.tracking.entries[0].id,'a-online','no upload while in conflict');
 await b.sync.connect('download');
 assert.equal(b.state.tracking.entries[0].id,'a-online');
 assert.equal(JSON.parse(b.storage.getItem('sofra-before-cloud')).tracking.entries[0].id,'b-offline');
 await b.sync.restoreBackup();assert.equal(b.state.tracking.entries[0].id,'b-offline');assert.equal(readLink(b.storage),null);
});

test('a consent change on another device bumps the revision without causing a false conflict',async()=>{
 const srv=server(),a=device(srv),b=device(srv);a.signIn('acc');b.signIn('acc');
 await a.sync.connect('upload');await b.sync.connect('download');
 srv.accounts.acc.revision++; // what POST /sync/settings does to the stored row
 a.edit(s=>s.tracking.entries.push(water('after-settings')));await a.drain();
 assert.equal(a.sync.status().kind,'synced');assert.equal(srv.accounts.acc.state.tracking.entries[0].id,'after-settings');
});

test('sync turned off elsewhere stops this device and forgets the link',async()=>{
 const srv=server(),a=await linkedDevice(srv,'acc');
 srv.accounts.acc.sync=false;
 a.edit(s=>s.profile.age=31);await a.drain();
 assert.equal(a.sync.status().kind,'off');assert.equal(readLink(a.storage),null);assert.match(statusText(a.sync.status()),/kapatıldı/);
});

test('account switch: device linked to A never uploads to B without an explicit choice',async()=>{
 const srv=server(),d=await linkedDevice(srv,'acc-a');
 d.signOut();d.sync.reset();d.edit(s=>s.tracking.entries.push(water('while-signed-out')));await d.drain();
 assert.equal(d.sync.describe().kind,'signed-out');
 d.signIn('acc-b');srv.calls.length=0;
 d.edit(s=>s.tracking.entries.push(water('as-b')));await d.drain();await d.sync.restore();
 assert.deepEqual(srv.calls,[]);assert.equal(d.sync.describe().kind,'other-account');
 assert.equal(srv.accounts['acc-b'],undefined);
 srv.accounts['acc-b']={state:{profile:{age:50}},stateHash:'hb',revision:4,sync:true};
 await assert.rejects(d.sync.connect('upload'),e=>e.code==='remote-exists');
 assert.equal(srv.accounts['acc-b'].state.profile.age,50);
 d.signOut();d.signIn('acc-a');await d.sync.restore();
 assert.deepEqual(srv.accounts['acc-a'].state.tracking.entries.map(e=>e.id),['while-signed-out','as-b']);
});

// ---- Codex review P1: in-flight responses across session changes ----
const noWriteTo=(srv,id)=>assert.deepEqual(srv.calls.filter(c=>c.account===id&&c.path!=='/account').map(c=>c.path),[],'no write call reached '+id);

test('review repro 1: switching to B while connect(A) reads /account never touches B',async()=>{
 const srv=server(),d=device(srv);d.signIn('acc-a');
 srv.hook=async path=>{if(path==='/account'){srv.hook=null;d.signIn('acc-b')}};
 await assert.rejects(d.sync.connect('upload'),/Hesap değişti/);
 noWriteTo(srv,'acc-b');assert.equal(srv.accounts['acc-b'],undefined);
 assert.deepEqual(srv.calls.map(c=>c.path+':'+c.account),['/account:acc-a']);
 assert.equal(readLink(d.storage),null);
});

test('review repro 2: a 409 that arrives after switching to B is not retried with any session',async()=>{
 const srv=server(),d=await linkedDevice(srv,'acc-a');
 srv.accounts['acc-a'].revision++; // settings-only bump: same hash, would normally trigger the retry
 srv.calls.length=0;
 srv.hook=async path=>{if(path==='/sync/push'){srv.hook=null;d.signIn('acc-b')}};
 d.edit(s=>s.profile.owner='A');await d.drain();
 assert.deepEqual(srv.calls.map(c=>c.path+':'+c.account),['/sync/push:acc-a'],'exactly one push, with A');
 noWriteTo(srv,'acc-b');
 assert.equal(readLink(d.storage).uid,'acc-a');assert.equal(d.sync.status().kind,'other-account');
});

test('connect response after an account switch is discarded: no link for either account',async()=>{
 const srv=server(),d=device(srv);d.signIn('acc-a');
 srv.hook=async path=>{if(path==='/sync/push'){srv.hook=null;d.signIn('acc-b')}};
 await assert.rejects(d.sync.connect('upload'),/Hesap değişti/);
 assert.equal(readLink(d.storage),null);noWriteTo(srv,'acc-b');
 // Download variant: the remote record of A is not installed on a device now signed in as B.
 const srv2=server(),e=await linkedDevice(srv2,'acc-a'),before=structuredClone(e.state),linkBefore=readLink(e.storage);
 srv2.accounts['acc-a'].state={profile:{age:44},tracking:{entries:[]}};srv2.accounts['acc-a'].revision++;
 srv2.hook=async path=>{if(path==='/sync/pull'){srv2.hook=null;e.signIn('acc-b')}};
 await assert.rejects(e.sync.connect('download'),/Hesap değişti/);
 assert.deepEqual(e.state,before);assert.deepEqual(readLink(e.storage),linkBefore);
});

test('disable during an account switch never changes B and leaves A for the user to retry',async()=>{
 const srv=server(),d=await linkedDevice(srv,'acc-a');
 srv.accounts['acc-b']={state:{profile:{age:60}},stateHash:'hb',revision:7,sync:true};
 srv.calls.length=0;srv.hook=async path=>{if(path==='/account'){srv.hook=null;d.signIn('acc-b')}};
 await assert.rejects(d.sync.disable(),/Hesap değişti/);
 assert.equal(srv.accounts['acc-b'].sync,true);assert.equal(srv.accounts['acc-b'].revision,7);
 noWriteTo(srv,'acc-b');assert.equal(srv.accounts['acc-a'].sync,true);
});

test('A→B→A: the same account with a new session still discards the old request',async()=>{
 const srv=server(),d=await linkedDevice(srv,'acc-a');
 const before=readLink(d.storage);srv.calls.length=0;
 srv.hook=async path=>{if(path==='/sync/push'){srv.hook=null;d.signIn('acc-b');d.signIn('acc-a')}};
 d.edit(s=>s.profile.age=33);await d.drain();
 assert.equal(srv.calls.length,1,'no automatic resend');
 assert.deepEqual(readLink(d.storage),before,'link not advanced by the old session');
 // The edit is still pending locally and goes out under the new session on the next sync.
 await d.sync.restore();assert.equal(srv.accounts['acc-a'].state.profile.age,33);
 assert.notEqual(srv.calls.at(-1).token,srv.calls[0].token);
});

test('logout, disable or forget while a response is pending: the link is not re-created',async()=>{
 for(const action of ['logout','forget']){
  const srv=server(),d=await linkedDevice(srv,'acc-a');
  srv.hook=async path=>{if(path==='/sync/push'){srv.hook=null;if(action==='logout'){d.signOut();d.sync.reset()}else d.sync.forget()}};
  const before=readLink(d.storage);
  d.edit(s=>s.profile.age=40);await d.drain();
  if(action==='forget')assert.equal(readLink(d.storage),null,'forget wins over the late response');
  else assert.deepEqual(readLink(d.storage),before,'late response does not advance the link after logout');
 }
 // disable is queued behind a pending upload; the upload's late success cannot resurrect the link.
 const srv=server(),d=await linkedDevice(srv,'acc-a');let release;
 srv.hook=path=>path==='/sync/push'?new Promise(r=>release=r):null;
 d.edit(s=>s.profile.age=41);const pending=d.drain();await new Promise(r=>setImmediate(r));
 const off=d.sync.disable();srv.hook=null;release();await pending;await off;
 assert.equal(readLink(d.storage),null);assert.equal(srv.accounts['acc-a'].sync,false);
});

test('storage full: a download changes nothing locally and the link does not move',async()=>{
 const srv=server(),a=await linkedDevice(srv,'acc'),b=device(srv);b.signIn('acc');await b.sync.connect('download');
 a.edit(s=>s.tracking.entries.push(water('from-a')));await a.drain();
 const before=structuredClone(b.state),link=readLink(b.storage);
 b.storage.full=true;
 assert.equal(await b.sync.restore(),false);
 assert.deepEqual(b.state,before);assert.deepEqual(readLink(b.storage),link);assert.equal(b.sync.status().kind,'storage');
 await assert.rejects(b.sync.connect('download'),e=>e.code==='storage');assert.deepEqual(b.state,before);
 b.storage.full=false;assert.equal(await b.sync.restore(),true);assert.equal(b.state.tracking.entries[0].id,'from-a');
});

test('an edit made while a pull is in flight is never overwritten by the download',async()=>{
 const srv=server(),a=await linkedDevice(srv,'acc'),b=device(srv);b.signIn('acc');await b.sync.connect('download');
 a.edit(s=>s.tracking.entries.push(water('from-a')));await a.drain();
 srv.hook=async path=>{if(path==='/sync/pull'){srv.hook=null;b.state.tracking.entries.push(water('typed-meanwhile'))}};
 assert.equal(await b.sync.restore(),false);
 assert.equal(b.sync.status().kind,'conflict');assert.equal(b.state.tracking.entries.at(-1).id,'typed-meanwhile');
});

test('pilot limit: an oversized diary is never sent or trimmed, and the user is told',async()=>{
 const srv=server(),d=await linkedDevice(srv,'acc');srv.calls.length=0;
 d.edit(s=>{for(let i=0;i<=PILOT_MAX_ENTRIES;i++)s.tracking.entries.push(water('w'+i))});await d.drain();
 assert.deepEqual(srv.calls,[]);assert.equal(d.sync.status().kind,'too-large');
 assert.equal(d.state.tracking.entries.length,PILOT_MAX_ENTRIES+1);assert.match(statusText(d.sync.status()),/hiçbiri silinmedi/);
 const fresh=device(srv,d.state);fresh.signIn('acc2');
 await assert.rejects(fresh.sync.connect('upload'),e=>e.code==='pilot-limit');
 assert.equal(srv.calls.filter(c=>c.path==='/sync/push').length,0);
});

test('account client: disabled config, offline and expired session are distinguishable; 401 forgets the token',async()=>{
 globalThis.localStorage=memory();
 assert.equal(accountReady({enabled:false,apiUrl:'https://x.workers.dev',googleClientId:'1-a.apps.googleusercontent.com'}),false);
 assert.equal(accountReady({enabled:true,apiUrl:'http://x.workers.dev',googleClientId:'1-a.apps.googleusercontent.com'}),false);
 const ready={enabled:true,apiUrl:'https://porsiva-accounts.example.workers.dev',googleClientId:'921622453693-abc.apps.googleusercontent.com'};
 assert.equal(accountReady(ready),true);
 const token='A'.repeat(43);localStorage.setItem('sofra-account-session-v1',JSON.stringify({token,accountId:'a',email:'a@example.test',expiresAt:Date.now()+1000}));
 assert.equal(readSession().accountId,'a');
 const seen=[];
 const fetcher=async(url,options)=>{if(url==='./cloud-config.json')return new Response(JSON.stringify(ready));seen.push(options);return new Response(JSON.stringify({error:'Oturumun sona erdi.',code:'session'}),{status:401})};
 await assert.rejects(api('/account',{},{fetcher}),e=>e.status===401);
 assert.equal(seen[0].headers.Authorization,'Bearer '+token);assert.equal(seen[0].credentials,'omit');
 assert.equal(readSession(),null);
 await assert.rejects(api('/account',{},{fetcher}),e=>e.code==='session');
 localStorage.setItem('sofra-account-session-v1',JSON.stringify({token,accountId:'a',email:'a',expiresAt:Date.now()-1}));
 assert.equal(readSession(),null,'expired session is ignored');
});

test('sign-out everywhere reports success only after the server confirms',async()=>{
 globalThis.localStorage=memory();
 const ready={enabled:true,apiUrl:'https://porsiva-accounts.example.workers.dev',googleClientId:'921622453693-abc.apps.googleusercontent.com'};
 const login=()=>localStorage.setItem('sofra-account-session-v1',JSON.stringify({token:'B'.repeat(43),accountId:'a',email:'a',expiresAt:Date.now()+60000}));
 const answer=(status,body={ok:true})=>async url=>url==='./cloud-config.json'?new Response(JSON.stringify(ready)):new Response(JSON.stringify(body),{status});
 const offline=async url=>{if(url==='./cloud-config.json')return new Response(JSON.stringify(ready));throw TypeError('Failed to fetch')};
 login();assert.deepEqual(await signOut({everywhere:true,fetcher:offline}),{revoked:false,reason:'offline'});
 assert.ok(readSession(),'still signed in so the user can retry');
 assert.deepEqual(await signOut({everywhere:true,fetcher:answer(500,{error:'x'})}),{revoked:false,reason:'server'});
 assert.ok(readSession());
 assert.deepEqual(await signOut({everywhere:true,fetcher:answer(200)}),{revoked:true});assert.equal(readSession(),null);
 login();assert.deepEqual(await signOut({everywhere:true,fetcher:answer(401,{code:'session'})}),{revoked:false,reason:'session'});assert.equal(readSession(),null);
 // Single device: local sign-out always happens; the result says whether the server revoked the token.
 login();assert.deepEqual(await signOut({fetcher:offline}),{revoked:false,reason:'offline'});assert.equal(readSession(),null);
 login();assert.deepEqual(await signOut({fetcher:answer(500,{error:'x'})}),{revoked:false,reason:'server'});assert.equal(readSession(),null);
 login();assert.deepEqual(await signOut({fetcher:answer(200)}),{revoked:true});
});

// ---- Codex review 2: work queued behind a blocked operation must not run for a newer session ----
const switches={
 'A→B':d=>{d.signIn('acc-b');d.sync.reset()},
 'logout':d=>{d.signOut();d.sync.reset()},
 'A→B→A':d=>{d.signIn('acc-b');d.signIn('acc-a');d.sync.reset()},
 'A→B without reset (other tab)':d=>{d.signIn('acc-b')}
};
const queued={
 'connect upload':d=>d.sync.connect('upload',{replaceRemote:true}),
 'connect download':d=>d.sync.connect('download'),
 'disable':d=>d.sync.disable(),
 'restoreBackup':d=>d.sync.restoreBackup()
};
for(const [qName,enqueue] of Object.entries(queued))for(const [sName,change] of Object.entries(switches)){
 test(`queued ${qName} behind a blocked pull, then ${sName}: nothing is sent or written afterwards`,async()=>{
  const srv=server(),d=await linkedDevice(srv,'acc-a');
  srv.accounts['acc-a'].state={profile:{age:77},tracking:{entries:[]}};srv.accounts['acc-a'].revision++;srv.accounts['acc-a'].stateHash='remote';
  srv.accounts['acc-b']={state:{profile:{age:50}},stateHash:'hb',revision:4,sync:true};
  d.storage.setItem('sofra-before-cloud',JSON.stringify({profile:{age:11},tracking:{entries:[]}}));
  let release;srv.hook=path=>path==='/sync/pull'?new Promise(r=>release=r):null;
  const first=d.sync.restore();await new Promise(r=>setImmediate(r));
  assert.ok(release,'first pull is in flight');
  const second=enqueue(d);
  const state=structuredClone(d.state),link=readLink(d.storage),backup=d.storage.getItem('sofra-before-cloud'),sent=srv.calls.length,b=structuredClone(srv.accounts['acc-b']),a=structuredClone(srv.accounts['acc-a']);
  change(d);srv.hook=null;release();
  const results=await Promise.allSettled([first,second]);
  assert.deepEqual(srv.calls.slice(sent).map(c=>c.path+':'+c.account),[],'no request after the switch');
  assert.deepEqual(d.state,state,'local record unchanged');assert.deepEqual(readLink(d.storage),link,'link unchanged');
  assert.equal(d.storage.getItem('sofra-before-cloud'),backup,'backup unchanged');
  assert.deepEqual(srv.accounts['acc-b'],b);assert.deepEqual(srv.accounts['acc-a'],a);
  if(qName!=='restoreBackup'||sName!=='logout')assert.equal(results[1].status,'rejected');
  if(results[1].status==='rejected')assert.match(results[1].reason.message,/Hesap değişti/);
  // Status describes the session now signed in, never the old operation's outcome.
  const expected={'A→B':'other-account','logout':'signed-out','A→B→A':'synced','A→B without reset (other tab)':'other-account'}[sName];
  assert.equal(d.sync.status().kind,expected);
 });
}

test('a queued change keeps the context it was queued under: the timer does nothing after a switch',async()=>{
 const srv=server(),d=await linkedDevice(srv,'acc-a');srv.calls.length=0;
 d.state.profile.age=55;d.sync.queue(); // timer scheduled while signed in as A
 d.signIn('acc-b'); // another tab switched account, no reset here
 await d.drain();
 assert.deepEqual(srv.calls,[]);assert.equal(d.sync.status().kind,'other-account');
});

test('restoreBackup queued while signed out still works when nothing changes',async()=>{
 const srv=server(),d=await linkedDevice(srv,'acc-a');
 d.storage.setItem('sofra-before-cloud',JSON.stringify({profile:{age:11},tracking:{entries:[]}}));
 d.signOut();d.sync.reset();
 await d.sync.restoreBackup();
 assert.equal(d.state.profile.age,11);assert.equal(readLink(d.storage),null);
});

test('an old account\'s sync-off error does not clear the new account\'s link',async()=>{
 const srv=server(),d=await linkedDevice(srv,'acc-a');
 srv.accounts['acc-a'].sync=false;
 let release;srv.hook=path=>path==='/sync/pull'?new Promise(r=>release=r):null;
 const first=d.sync.restore();await new Promise(r=>setImmediate(r));
 // Meanwhile the device is linked to B (e.g. user connected B in another tab).
 d.signIn('acc-b');writeLink('acc-b',9,d.state,'hb',d.storage);const linkB=readLink(d.storage);
 srv.hook=null;release();await first;
 assert.deepEqual(readLink(d.storage),linkB);assert.notEqual(d.sync.status().kind,'off');
});

// ---- Daily summaries travel compacted and come back in full ----
test('daily summaries are compacted on the wire and arrive identical on the other device',async()=>{
 const p={age:34,height:172,weight:78,sex:'female'},snapshots={};
 for(let i=1;i<=20;i++){const d='2026-09-'+String(i).padStart(2,'0');snapshots[d]={profile:p,plan:{date:d,hash:JSON.stringify(p),entries:{lunch:{id:'tav-'+i,portion:1}}},mealTimes:{breakfast:'08:00'},waterGoal:1600,waterMode:'auto',otherDrinks:0}}
 const srv=server(),a=device(srv,{profile:p,tracking:{entries:[],snapshots}}),b=device(srv,{profile:null,tracking:{entries:[]}});
 a.signIn('acc');b.signIn('acc');await a.sync.connect('upload');
 const stored=srv.accounts.acc.state.tracking.snapshots;
 assert.equal(stored['2026-09-02'].sameProfile,true);assert.equal(stored['2026-09-02'].plan.hashFromProfile,true);
 await b.sync.connect('download');
 assert.equal(JSON.stringify(b.state.tracking.snapshots),JSON.stringify(snapshots));
 // Nothing looks changed afterwards: no spurious upload, no conflict.
 srv.calls.length=0;await b.sync.restore();assert.equal(b.sync.status().kind,'synced');assert.deepEqual(srv.calls.map(c=>c.path),['/sync/pull']);
});

test('server size-limit answer shows the limit message and keeps local data',async()=>{
 const srv=server(),d=await linkedDevice(srv,'acc');
 const client=srv.client;srv.client=()=>{const inner=client.call(srv);return async(p,data,o)=>{if(p==='/sync/push')throw fail(413,'size-limit',{limit:1000});return inner(p,data,o)}};
 const e=device(srv,structuredClone(d.state));e.signIn('acc');e.storage.setItem('sofra-cloud-link-v1',d.storage.getItem('sofra-cloud-link-v1'));
 e.edit(s=>s.profile.age=44);await e.drain();
 assert.equal(e.sync.status().kind,'too-large');assert.equal(e.state.profile.age,44);
 await assert.rejects(e.sync.connect('upload',{replaceRemote:true}),err=>err.code==='size-limit'&&/hiçbiri silinmedi/.test(err.message));
});
