import {mealItems,mealTimes} from './planner.mjs?v=11';
import {validDate} from './tracking.mjs?v=13';
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
// Pin identity when work is queued. Stale views and jobs cannot use a newer account's session.
export function createFamilyCloud({api,session,getState,notify=()=>{},delay=1200}){
 let context=null,epoch=0,readSequence=0,timer=null,chain=Promise.resolve(),last='',stopped=false;
 const same=(s,e)=>e===epoch&&session()?.token===s?.token&&session()?.accountId===s?.accountId;
 const reset=()=>{epoch++;readSequence++;clearTimeout(timer);timer=null;context=null;last='';stopped=false};
 function capture(){const s=session();if(!s)throw Error('Önce Google ile giriş yap.');return {s,e:epoch}}
 async function read(){
  const {s,e}=capture(),sequence=++readSequence,result=await api('/family/get',{},{session:s});
  if(!same(s,e)||sequence!==readSequence)throw Error('Aile bilgisi değişti. Ekranı yeniden aç.');
  const self=result.group?.members.find(m=>m.isSelf);
  context=self?{accountId:s.accountId,member:self}:null;stopped=false;
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
  return read();
 }
 function queue(){
  const s=session();if(!s||context?.accountId!==s.accountId||!context.member.shareMenu||stopped)return;
  const menu=menuForSharing(getState());if((menu?JSON.stringify(menu):'')===last)return;
  const e=epoch,membershipId=context.member.id;clearTimeout(timer);
  timer=setTimeout(()=>{timer=null;chain=chain.catch(()=>{}).then(async()=>{
   if(!same(s,e)||context?.member.id!==membershipId||!context.member.shareMenu||stopped)return;
   try{
    const result=await api('/family/share',{membershipId,revision:context.member.revision,shareMenu:Boolean(menu),menu},{session:s});
    if(!same(s,e)||context?.member.id!==membershipId)return;
    context.member={...context.member,...result,menu};last=menu?JSON.stringify(menu):'';
    if(!menu)notify('Kişisel menün kaldırıldığı için aile paylaşımı kapandı. Yeni menünü Aile ekranından paylaşabilirsin.');
   }catch(err){if(!same(s,e))return;stopped=true;notify(err.code==='family-conflict'?'Aile paylaşımın başka cihazda değişti. Aile ekranını yenile.':'Menü aileye gönderilemedi; yerel menün duruyor. Aile ekranından tekrar paylaş.');}
  })},delay);
 }
 return {read,mutate,setSharing,queue,reset,request:async(path,data)=>{const {s,e}=capture();const r=await api(path,data,{session:s});if(!same(s,e))throw Error('Hesap değişti.');return r},settled:()=>chain};
}
