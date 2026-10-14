import {compactState,expandState} from './snapshots.mjs?v=16';
const key='sofra-cloud-link-v1',backupKey='sofra-before-cloud';
// Family profiles, reports and device settings never leave the device through account sync.
export function localPayload(state){const {reports,cloudSettings,family,...data}=state;return data}
export function syncDecision(local,link,remote){
 if(!remote.state)return 'missing';
 const dirty=JSON.stringify(local)!==link.baseline;
 // A consent change on another device bumps the revision but leaves the stored state (and its hash) alone.
 const unchanged=remote.revision===link.revision||(Boolean(link.stateHash)&&remote.stateHash===link.stateHash);
 if(!unchanged)return dirty?'conflict':'download';
 return dirty?'upload':'same';
}
export function readLink(storage=globalThis.localStorage){
 try{const link=JSON.parse(storage.getItem(key)||'null');return link&&typeof link.uid==='string'&&Number.isSafeInteger(link.revision)&&typeof link.baseline==='string'?link:null}catch{return null}
}
export function writeLink(uid,revision,state,stateHash=null,storage=globalThis.localStorage){storage.setItem(key,JSON.stringify({uid,revision,stateHash,baseline:JSON.stringify(localPayload(state))}))}
export function clearLink(storage=globalThis.localStorage){storage.removeItem(key)}

const TEXT={
 idle:'',
 'signed-out':'Oturum kapalı. Eşitleme beklemede; kayıtların bu cihazda duruyor.',
 'not-linked':'Bu cihaz hesabınla eşitlenmiyor.',
 'other-account':'Bu cihazdaki kayıtlar daha önce başka bir Google hesabıyla eşitlendi. Bu hesaba kendiliğinden yüklenmez.',
 pending:'Değişikliklerin birazdan eşitlenecek.',
 syncing:'Eşitleniyor…',
 synced:'Eşitlendi.',
 offline:'Çevrimdışı ya da sunucuya ulaşılamadı. Değişikliklerin bu cihazda saklandı; bağlantı gelince gönderilecek.',
 conflict:'Bu cihazda ve hesabında farklı değişiklikler var. Hangisini tutacağını seç; diğeri otomatik silinmez, yerel yedek alınır.',
 missing:'Hesabındaki kayıt silinmiş veya boş. Bu cihazdakini yeniden yükleyebilir ya da eşitlemeyi kapatabilirsin.',
 off:'Eşitleme hesabında kapatıldı. Kayıtların bu cihazda kalmaya devam ediyor.',
 'too-large':'Eşitleme sınırına ulaştın (kayıt sayısı veya toplam boyut). Kayıtların bu cihazda güvende; hiçbiri silinmedi, yalnızca yeni eşitleme durdu. Günlük dosyanı Takip bölümünden indirebilirsin.',
 storage:'Telefon depolama alanı dolu; hesabındaki kayıt bu cihaza yazılamadı. Bu cihazdaki kayıtlar değiştirilmedi.',
 error:'Eşitleme durdu.'
};
// Pilot capacity: the server validates the whole record on every upload, so the diary size is capped
// (measured, see account-worker/README.md). Over the cap sync pauses; nothing is trimmed or deleted.
export const PILOT_MAX_ENTRIES=500;
// Same as the server's MAX_STATE_BYTES: checked on the compact wire copy before anything is sent.
export const PILOT_MAX_BYTES=350000;
export const entryCount=state=>Array.isArray(state?.tracking?.entries)?state.tracking.entries.length:0;
// What goes over the wire: daily summaries compacted (shared with the server), or null if over a limit.
export function wirePayload(payload){
 if(entryCount(payload)>PILOT_MAX_ENTRIES)return null;
 const wire=compactState(payload);
 return new TextEncoder().encode(JSON.stringify(wire)).length>PILOT_MAX_BYTES?null:wire;
}
export function statusText(status){return status.message||TEXT[status.kind]||''}

// Sync engine. Server calls run one at a time, in order.
// Each public call captures its context (session token + account + engine epoch) at the moment it is
// called, not when its turn in the queue comes. Before running, after every await and before every
// local write the operation checks that context is still current; otherwise it stops without sending,
// writing or changing status for whoever is signed in now. reset/forget/disable/restoreBackup bump the
// epoch, which voids everything queued or in flight before them. A→B→A issues a new token, so a context
// captured for the first A session never comes back to life.
export function createSync({api,session,getState,applyRemote,storage=globalThis.localStorage,delay=3000,schedule=setTimeout,cancel=clearTimeout}){
 let status={kind:'idle',message:''},timer=null,chain=Promise.resolve(),epoch=0;
 const listeners=new Set();
 const set=(kind,message='')=>{status={kind,message};for(const fn of listeners)try{fn(status)}catch{}};
 const stale=()=>Object.assign(Error('Hesap değişti; işlem durduruldu. Yeniden dene.'),{code:'stale'});
 const same=(a,b)=>a===b||(Boolean(a&&b)&&a.accountId===b.accountId&&a.token===b.token);
 // Context of a call. s may be null for local-only operations done while signed out.
 const capture=()=>({s:session(),epoch});
 const alive=op=>op.epoch===epoch&&same(session(),op.s);
 // Queue a task under a context captured by the caller; the task never runs for a context that died while waiting.
 const serial=(op,task)=>{const run=chain.then(()=>{if(!alive(op))throw stale();return task()});chain=run.catch(()=>{});return run};
 async function call(op,path,data={}){
  if(!op.s||!alive(op))throw stale();
  let result;
  try{result=await api(path,data,{session:op.s})}
  catch(e){if(!alive(op))throw stale();throw e} // an old account's error never reaches the current one
  if(!alive(op))throw stale();
  return result;
 }
 const ownLink=op=>{const link=op.s&&readLink(storage);return link&&link.uid===op.s.accountId?link:null};
 const sameLink=(a,b)=>Boolean(a&&b)&&a.uid===b.uid&&a.revision===b.revision&&a.baseline===b.baseline;
 function linked(){const s=session();return Boolean(s&&readLink(storage)?.uid===s.accountId)}
 // resume=false after a discarded request: report the state but never schedule a resend by itself.
 function describe(resume=true){
  const s=session(),link=readLink(storage);
  if(!s)set(link?'signed-out':'idle');else if(!link)set('not-linked');else if(link.uid!==s.accountId)set('other-account');
  else if(['idle','signed-out','not-linked','other-account','off','syncing'].includes(status.kind)){
   if(JSON.stringify(localPayload(getState()))===link.baseline)set('synced');else if(resume)queue();else set('pending');
  }
  return status;
 }
 function backup(){
  try{storage.setItem(backupKey,JSON.stringify(getState()))}
  catch{throw Object.assign(Error('Yerel yedek alınamadı (depolama dolu). Bu cihazdaki kayıtlar değiştirilmedi.'),{code:'storage'})}
 }
 // Order matters: backup, then the app's persistent record, then the link. If a step throws, later
 // steps do not run, so the link never claims a baseline that is not on disk.
 function install(op,remote){
  if(!alive(op))throw stale();
  backup();
  try{applyRemote(expandState(remote.state))}catch{throw Object.assign(Error(TEXT.storage),{code:'storage'})}
  writeLink(op.s.accountId,remote.revision,getState(),remote.stateHash,storage);
 }
 function failed(op,e){
  if(e.code==='stale'||!alive(op))return describe(false);
  if(e.code==='storage')return set('storage',e.message);
  if(e.code==='pilot-limit'||e.code==='size-limit')return set('too-large');
  if(e.code==='offline'||e.status===0||e.status===429||e.status>=500)return set('offline');
  if(e.status===401)return set('signed-out','Oturumun sona erdi. Google ile yeniden giriş yapınca eşitleme kaldığı yerden sürer.');
  if(e.code==='sync-off'){if(ownLink(op))clearLink(storage);return set('off')}
  if(e.code==='conflict')return set('conflict');
  set('error','Eşitleme durdu: '+(e.message||'bilinmeyen hata'));
 }
 async function upload(op,link,retried=false){
  const snapshot=structuredClone(localPayload(getState())),text=JSON.stringify(snapshot);
  if(text===link.baseline)return set('synced');
  const wire=wirePayload(snapshot);if(!wire)return set('too-large');
  set('syncing');
  try{
   const r=await call(op,'/sync/push',{state:wire,revision:link.revision});
   if(!sameLink(readLink(storage),link))return describe(false); // disabled, forgotten or replaced meanwhile
   storage.setItem(key,JSON.stringify({uid:link.uid,revision:r.revision,stateHash:r.stateHash,baseline:text}));
   set('synced');
   if(JSON.stringify(localPayload(getState()))!==text)queue();
  }catch(e){
   if(e.code!=='stale'&&alive(op)&&e.code==='conflict'&&!retried&&link.stateHash&&e.body?.stateHash===link.stateHash&&sameLink(readLink(storage),link)){
    const next={...link,revision:e.body.revision};storage.setItem(key,JSON.stringify(next));return upload(op,next,true);
   }
   failed(op,e);
  }
 }
 // The timer carries the context of the moment the change was queued.
 function queue(){
  const op=capture();
  if(!ownLink(op)||['conflict','missing','storage'].includes(status.kind))return;
  set('pending');cancel(timer);timer=schedule(()=>{timer=null;return run(op).catch(()=>{})},delay);
 }
 function run(op){
  return serial(op,async()=>{const link=ownLink(op);if(!link)return describe();await upload(op,link)}).catch(e=>{if(e.code==='stale')describe(false);else throw e});
 }
 function flush(){cancel(timer);timer=null;return run(capture())}
 // Boot, coming back online, returning to the app: pick up the other device's changes or send ours.
 function restore(){
  const op=capture();
  return serial(op,async()=>{
   const link=ownLink(op);if(!link){describe();return false}
   set('syncing');
   try{
    const remote=await call(op,'/sync/pull');
    if(!sameLink(readLink(storage),link)){describe(false);return false}
    // Decided on the state as it is now, so edits made while the pull was in flight count as local changes.
    const decision=syncDecision(localPayload(getState()),link,remote);
    if(decision==='conflict'){set('conflict');return false}
    if(decision==='missing'){set('missing');return false}
    if(decision==='download'){install(op,remote);set('synced');return true}
    const current=remote.revision===link.revision?link:{...link,revision:remote.revision,stateHash:remote.stateHash};
    if(current!==link)storage.setItem(key,JSON.stringify(current));
    if(decision==='upload')await upload(op,current);else set('synced');
    return false;
   }catch(e){failed(op,e);return false}
  }).catch(e=>{if(e.code==='stale'){describe(false);return false}throw e});
 }
 const userError=e=>{if(e.code==='stale'){describe(false);throw stale()}throw e};
 // Explicit user choice only. Signing in never calls this.
 function connect(mode,{replaceRemote=false}={}){
  const op=capture();if(!op.s)return Promise.reject(Error('Önce Google ile giriş yap.'));
  return serial(op,async()=>{
   try{
    const {sync}=await call(op,'/account');let revision=sync.revision;
    if(!sync.enabled)revision=(await call(op,'/sync/settings',{sync:true,revision})).revision;
    if(mode==='download'){
     const remote=await call(op,'/sync/pull');if(!remote.state)throw Error('Hesabında henüz kayıt yok. Bu cihazdaki kayıtları yükleyebilirsin.');
     install(op,remote);
    }else{
     if(sync.hasState&&!replaceRemote)throw Object.assign(Error('Hesabında kayıt var.'),{code:'remote-exists'});
     const snapshot=structuredClone(localPayload(getState())),wire=wirePayload(snapshot);
     if(!wire)throw Object.assign(Error(TEXT['too-large']),{code:'pilot-limit'});
     // Uses the revision just read: if another device writes in between, the server answers 409 instead of overwriting it.
     const r=await call(op,'/sync/push',{state:wire,revision});
     if(!alive(op))throw stale();
     writeLink(op.s.accountId,r.revision,snapshot,r.stateHash,storage);
    }
    set('synced');
   }catch(e){
    if((e.code==='pilot-limit'||e.code==='size-limit')&&alive(op)){set('too-large');throw Object.assign(Error(TEXT['too-large']),{code:e.code})}
    throw e;
   }
  }).catch(userError);
 }
 // Turning sync off voids everything queued or in flight before it, at the moment the user asks.
 function disable(){
  if(!session())return Promise.reject(Error('Önce Google ile giriş yap.'));
  epoch++;cancel(timer);timer=null;const op=capture();
  return serial(op,async()=>{
   const {sync}=await call(op,'/account');
   if(sync.enabled)await call(op,'/sync/settings',{sync:false,revision:sync.revision});
   if(!alive(op))throw stale();
   if(ownLink(op))clearLink(storage);
   set('not-linked');
  }).catch(userError);
 }
 function hasBackup(){try{return Boolean(storage.getItem(backupKey))}catch{return false}}
 // Puts the pre-download copy back and stops syncing. Captured like any other call: if the account
 // changes before its turn, it does nothing.
 function restoreBackup(){
  epoch++;cancel(timer);timer=null;const op=capture();
  return serial(op,async()=>{
   const saved=JSON.parse(storage.getItem(backupKey)||'null');if(!saved||typeof saved!=='object')throw Error('Yerel yedek bulunamadı.');
   applyRemote(localPayload(saved));clearLink(storage);set(op.s?'not-linked':'idle');
  }).catch(userError);
 }
 // Sign-out, account switch, account deletion: everything queued or in flight becomes void.
 function reset(){epoch++;cancel(timer);timer=null;describe(false)}
 function forget(){epoch++;cancel(timer);timer=null;clearLink(storage);set(session()?'not-linked':'idle')}
 return {queue,flush,restore,connect,disable,describe,linked,hasBackup,restoreBackup,reset,forget,status:()=>status,onStatus(fn){listeners.add(fn);return()=>listeners.delete(fn)}};
}
