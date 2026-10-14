import {SLOTS,mealItems,mealTimes,profileError,allowed,targetStatus} from './planner.mjs?v=11';
import {planningBlock} from './health.mjs?v=11';
import {validDate} from './tracking.mjs?v=13';
import {planningRequirements} from './family-requirements.mjs?v=17';
import {SHARED_SLOTS} from './common-plan.mjs?v=17';
export function menuForSharing(state){
 if(!validDate(state?.plan?.date)||!state.plan.entries)return null;
 const entries={};
 for(const slot of ['breakfast','lunch','snack','dinner']){
  const parts=mealItems(state.plan.entries[slot]);
  if(!parts.length||parts.length>3||parts.some(e=>typeof e.id!=='string'||!Number.isFinite(e.portion)||e.portion<=0||e.portion>20))return null;
  entries[slot]={items:parts.map(e=>({id:e.id,portion:e.portion}))};
 }
 return {date:state.plan.date,entries,times:mealTimes(state.mealTimes)};
}
// "Bugün menüme uygula": copy only this person's portions into their own plan, after re-checking them against the
// person's current profile and allergies on this device. Other members' entries are never written anywhere.
export function personalFromCommon(plan,memberId,profile,catalog,today,revision){
 if(plan?.date!==today)throw Error('Bu ortak menü bugüne ait değil. Yeniden hesaplatın.');
 const mine=plan.entries?.[memberId];if(!mine)throw Error('Bu ortak menüde senin porsiyonun yok. Katılımını açıp yeniden hesaplatın.');
 const error=profileError(profile)||planningBlock(profile);if(error)throw Error(error);
 const byId=new Map(catalog.recipes.map(r=>[r.id,r])),entries={};
 for(const [slot] of SLOTS){
  const items=mealItems(mine[slot]);if(!items.length||items.length>2)throw Error('Ortak menü eksik.');
  for(const e of items){
   const r=byId.get(e.id);if(!r)throw Error('Bir tarif bu cihazın kataloğunda yok. Uygulamayı yenileyip tekrar dene.');
   if(!allowed(r,catalog.ingredients,profile.allergies||[]))throw Error('Bir yemek güncel alerjen tercihine uymuyor. Ortak menüyü yeniden hesaplatın.');
  }
  entries[slot]=items.length===1?{id:items[0].id,portion:items[0].portion}:{items:items.map(e=>({id:e.id,portion:e.portion}))};
 }
 if(!targetStatus(entries,byId,profile).ok)throw Error('Bu porsiyonlar güncel hedefinle uyuşmuyor. Ortak menüyü yeniden hesaplatın.');
 return {date:today,hash:JSON.stringify(profile),entries,...(plan.cooking?{cooking:plan.cooking}:{}),source:'family-common',sharedSlots:[...SHARED_SLOTS],familyRevision:revision};
}
export const isCommonSlot=(plan,slot)=>plan?.source==='family-common'&&SHARED_SLOTS.includes(slot);
// Pin identity when work is queued. Stale views and jobs cannot use a newer account's session.
export function createFamilyCloud({api,session,getState,notify=()=>{},delay=1200,storage=globalThis.localStorage}){
 let context=null,group=null,epoch=0,readSequence=0,timer=null,chain=Promise.resolve(),last='',stopped=false;
 const same=(s,e)=>e===epoch&&session()?.token===s?.token&&session()?.accountId===s?.accountId;
 const bindingKey='sofra-family-local-owner-v1';let binding=null;
 try{binding=JSON.parse(storage?.getItem(bindingKey)||'null')}catch{}
 const owns=(s,m,kind)=>binding?.accountId===s.accountId&&binding?.membershipId===m.id&&binding?.[kind]===true;
 const bind=(s,m,kind,on,snapshot)=>{binding=binding?.accountId===s.accountId&&binding?.membershipId===m.id?{...binding,[kind]:on}:{accountId:s.accountId,membershipId:m.id,[kind]:on};if(kind==='planning')binding.planningSnapshot=snapshot?JSON.stringify(snapshot):null;try{storage?.setItem(bindingKey,JSON.stringify(binding))}catch{}};
 const reset=()=>{epoch++;readSequence++;clearTimeout(timer);timer=null;context=null;group=null;last='';stopped=false};
 function capture(){const s=session();if(!s)throw Error('Önce Google ile giriş yap.');return {s,e:epoch}}
 async function read(){
  const {s,e}=capture(),sequence=++readSequence,result=await api('/family/get',{},{session:s});
  if(!same(s,e)||sequence!==readSequence)throw Error('Aile bilgisi değişti. Ekranı yeniden aç.');
  const self=result.group?.members.find(m=>m.isSelf);
  context=self?{accountId:s.accountId,member:self}:null;group=self?result.group:null;stopped=false;
  last=self?.menu?JSON.stringify(self.menu):'';return result;
 }
 async function mutate(path,data={}){
  readSequence++;
  const {s,e}=capture();await api(path,data,{session:s});
  if(!same(s,e))throw Error('Hesap değişti. Aile ekranını yeniden aç.');
  return read();
 }
 async function setSharing(on){
  readSequence++;
  const {s,e}=capture();const member=context?.accountId===s.accountId?context.member:null;
  if(!member)throw Error('Aile grubunu yenile.');
  const menu=on?menuForSharing(getState()):null;
  if(on&&!menu)throw Error('Önce Bugün bölümünde kişisel menünü oluştur.');
  const result=await api('/family/share',{membershipId:member.id,revision:member.revision,shareMenu:on,menu},{session:s});
  if(!same(s,e))throw Error('Hesap değişti. Aile ekranını yeniden aç.');
  context.member={...member,...result,menu};last=menu?JSON.stringify(menu):'';stopped=false;
  bind(s,member,'menu',on);
  return read();
 }
 async function setParticipation(on){
  readSequence++;const {s,e}=capture(),m=context?.accountId===s.accountId?context.member:null;
  if(!m)throw Error('Önce aile grubunu yenile.');
  const requirements=on?planningRequirements(getState().profile):null;
  const result=await api('/family/planning',{membershipId:m.id,revision:m.planningRevision,enabled:on,requirements},{session:s});
  if(!same(s,e))throw Error('Hesap değişti.');
  context.member={...m,...result};bind(s,m,'planning',on,requirements);return read();
 }
 // A common-plan computation is pinned to the session, membership, group revision, participants and day it
 // started with. The Worker result is published only if none of them changed; the server re-checks the rest.
 function commonTicket(today){
  const {s,e}=capture(),m=context?.accountId===s.accountId?context.member:null;
  if(!m||!group)throw Error('Önce aile grubunu yenile.');
  const participants=group.members.filter(x=>x.planning).map(x=>({id:x.id,revision:x.planningRevision,name:x.name,requirements:x.planning}));
  if(m.planning&&getState().profile&&JSON.stringify(planningRequirements(getState().profile))!==JSON.stringify(m.planning))throw Error('Bu cihazdaki profil hedefin ortak hesaptan farklı. Katılım bilgilerini güncelle.');
  if(participants.length<2)throw Error('Ortak hesap için en az iki kişinin katılımı gerekir.');
  return {s,e,membershipId:m.id,groupId:group.id,revision:group.commonRevision,participants,today};
 }
 async function publishCommon(ticket,plan,today){
  readSequence++;
  if(!same(ticket.s,ticket.e)||context?.member.id!==ticket.membershipId||group?.id!==ticket.groupId)throw Error('Hesap veya aile grubu değişti; sonuç yayımlanmadı.');
  if(today!==ticket.today)throw Error('Gün değişti; ortak menüyü yeniden hesapla.');
  const participants=group.members.filter(m=>m.planning).map(m=>[m.id,m.planningRevision]).sort();
  if(group.commonRevision!==ticket.revision||JSON.stringify(participants)!==JSON.stringify(ticket.participants.map(m=>[m.id,m.revision]).sort()))throw Error('Katılımcılar veya aile menüsü değişti; yeniden hesapla.');
  await api('/family/common',{revision:ticket.revision,participants:ticket.participants.map(({id,revision})=>({id,revision})),plan},{session:ticket.s});
  if(!same(ticket.s,ticket.e))throw Error('Hesap değişti.');
  return read();
 }
 function queue(){
  const s=session();if(!s||context?.accountId!==s.accountId||stopped)return;
  let requirements=null;try{requirements=planningRequirements(getState().profile)}catch{}
  const digest=JSON.stringify(requirements),ownsPlanning=owns(s,context.member,'planning');
  if(ownsPlanning&&requirements&&digest===JSON.stringify(context.member.planning))bind(s,context.member,'planning',true,requirements);
  const planningChanged=Boolean(getState().profile&&context.member.planning)&&ownsPlanning&&typeof binding.planningSnapshot==='string'&&digest!==binding.planningSnapshot&&digest!==JSON.stringify(context.member.planning);
  const menu=menuForSharing(getState()),menuChanged=context.member.shareMenu&&owns(s,context.member,'menu')&&(menu?JSON.stringify(menu):'')!==last;
  if(!planningChanged&&!menuChanged)return;
  const e=epoch,membershipId=context.member.id;clearTimeout(timer);
  timer=setTimeout(()=>{timer=null;chain=chain.catch(()=>{}).then(async()=>{
   if(!same(s,e)||context?.member.id!==membershipId||stopped)return;
   try{
    if(planningChanged&&context.member.planning){
     const result=await api('/family/planning',{membershipId,revision:context.member.planningRevision,enabled:Boolean(requirements),requirements},{session:s});
     if(!same(s,e)||context?.member.id!==membershipId)return;
     context.member={...context.member,...result};
     bind(s,context.member,'planning',Boolean(requirements),requirements);
     if(!requirements)notify('Profilin ortak otomatik hesap için uygun olmadığından katılımın kapandı.');
    }
    if(!menuChanged||!context.member.shareMenu)return;
    const result=await api('/family/share',{membershipId,revision:context.member.revision,shareMenu:Boolean(menu),menu},{session:s});
    if(!same(s,e)||context?.member.id!==membershipId)return;
    context.member={...context.member,...result,menu};last=menu?JSON.stringify(menu):'';
    if(!menu)notify('Kişisel menün kaldırıldığı için aile paylaşımı kapandı. Yeni menünü Aile ekranından paylaşabilirsin.');
   }catch(err){if(!same(s,e))return;stopped=true;notify(err.code==='family-conflict'?'Aile paylaşımın başka cihazda değişti. Aile ekranını yenile.':'Menü aileye gönderilemedi; yerel menün duruyor. Aile ekranından tekrar paylaş.');}
  })},delay);
 }
 return {read,mutate,setSharing,setParticipation,commonTicket,publishCommon,queue,reset,request:async(path,data)=>{const {s,e}=capture();const r=await api(path,data,{session:s});if(!same(s,e))throw Error('Hesap değişti.');return r},settled:()=>chain};
}
