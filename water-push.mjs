import {waterRecommendation,resolvedWaterGoal} from './water.mjs?v=13';
import {dateKey,daySummary} from './tracking.mjs?v=13';
const storageKey='porsiva-water-push-v1';
let service,loading,timer,syncing,stopping=false;
const read=()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'null')}catch{return null}};
const write=value=>localStorage.setItem(storageKey,JSON.stringify(value));
export function pushPreference(state,now=new Date()){
 const day=dateKey(now),goal=resolvedWaterGoal(state.profile,state.tracking),eligible=waterRecommendation(state.profile).goal!==null&&goal>0;
 return {enabled:eligible,pausedDay:eligible&&daySummary(state.tracking?.entries||[],day).water>=goal?day:null};
}
export async function pushService(){
 if(service)return service;if(loading)return loading;
 loading=(async()=>{const cfg=await fetch('./push-config.json',{cache:'no-cache'}).then(r=>r.json());if(!cfg.enabled||!/^https:\/\/[a-z0-9.-]+\.workers\.dev$/.test(cfg.apiUrl))throw Error('Bildirim sunucusu henüz bağlı değil.');
 const r=await fetch(cfg.apiUrl+'/health',{signal:AbortSignal.timeout(10000)}),data=await r.json();if(!r.ok||!data.ready||!data.publicKey)throw Error('Bildirim sunucusuna ulaşılamadı.');return service={...data,url:cfg.apiUrl};})();
 try{return await loading}finally{loading=null}
}
async function call(path,data={}){
 const c=await pushService(),device=read();if(!device?.token)throw Error('Önce bu cihazda bildirimleri aç.');
 const r=await fetch(c.url+path,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+device.token},body:JSON.stringify({id:device.id,...data}),signal:AbortSignal.timeout(15000)});
 let body;try{body=await r.json()}catch{throw Error('Bildirim sunucusu yanıt vermedi.')}
 if(!r.ok)throw Error(body.error||(r.status===429?'Test henüz gönderilemedi; bir dakika sonra tekrar dene.':'İşlem tamamlanamadı.'));return body;
}
function bytes(key){return Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-key.length%4)%4)),c=>c.charCodeAt(0))}
export async function enableWaterPush(state){
 if(!service)throw Error('Sunucu kontrolü sürüyor; birazdan tekrar dene.');
 if(waterRecommendation(state.profile).goal===null)throw Error('Önce su önerisine uygun bir profil oluştur.');
 if(!('Notification'in window)||!('PushManager'in window)||!('serviceWorker'in navigator))throw Error('Bu tarayıcıda bildirim kullanılamıyor. iPhone’da Porsiva’yı ana ekrana ekleyip simgesinden aç.');
 // This must be the first awaited operation in the user click handler on iOS.
 const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Bildirim izni verilmedi. Telefonun site/uygulama bildirim ayarından izin ver.');
 let d=read();if(!d){const token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');d={id:crypto.randomUUID(),token};write(d)}
 const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
 if(sub&&String(new Uint8Array(sub.options.applicationServerKey||[]))!==String(bytes(service.publicKey)))throw Error('Bu cihazın eski bildirim bağlantısını Hesap bölümünden kapatıp tekrar dene.');
 sub||=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(service.publicKey)});
 const pref=pushPreference(state);await call('/subscribe',{subscription:sub.toJSON(),...pref});
 write({...d,active:true,lastAck:JSON.stringify(pref),ackDay:dateKey(),error:''});
}
function publishStatus(){const el=document.querySelector('#waterPushStatus');if(el)el.textContent=waterPushStatus()}
export async function syncWaterPush(state){
 if(stopping)return;if(syncing){await syncing;return syncWaterPush(state)}
 const d=read();if(!d?.active)return;
 const pref=pushPreference(state),signature=JSON.stringify(pref);if(d.lastAck===signature&&d.ackDay===dateKey()&&!d.error)return;
 syncing=(async()=>{try{await call('/state',pref);if(read()?.id===d.id)write({...d,lastAck:signature,ackDay:dateKey(),error:''})}catch{if(read()?.id===d.id)try{write({...d,error:'Son tercih sunucuya ulaşmadı. İnternete bağlanıp Porsiva’yı aç; önceki bildirim planı devam edebilir.'})}catch{}}finally{publishStatus()}})();
 try{await syncing}finally{syncing=null}
}
export function queueWaterPush(state){clearTimeout(timer);timer=setTimeout(()=>syncWaterPush(state).catch(()=>{}),600)}
export async function disableWaterPush(){
 stopping=true;clearTimeout(timer);
 try{if(syncing)await syncing;const d=read();if(!d)return;await call('/unsubscribe');localStorage.removeItem(storageKey);
 try{const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub)await sub.unsubscribe()}catch{}
 }finally{stopping=false}
}
export async function testWaterPush(){const r=await call('/test');if(!r.sent)throw Error('Test gönderilemedi.');return r}
export function waterPushStatus(){
 const d=read();if(!d?.active)return 'Bu cihazda telefon bildirimleri henüz açılmadı.';if(d.error)return d.error;
 if(typeof Notification!=='undefined'&&Notification.permission!=='granted')return 'Telefon bildirim izni kapalı; cihaz ayarından izin verip yeniden bağla.';
 let p;try{p=JSON.parse(d.lastAck)}catch{}
 if(p?.enabled===false)return 'Profiline göre otomatik su hatırlatması duraklatıldı.';
 if(p?.pausedDay===dateKey())return 'Bugünkü su hedefin tamamlandı; hatırlatmalar yarın yeniden başlayacak.';
 return 'Bu cihaz bağlı. 09.00–21.00 arasında saatlik hatırlatma açık.';
}
export function bindWaterPush(state){
 const status=document.querySelector('#waterPushStatus'),on=document.querySelector('#waterPushOn'),test=document.querySelector('#waterPushTest'),off=document.querySelector('#waterPushOff');if(!status)return;
 pushService().then(()=>{if(!status.isConnected)return;status.textContent=waterPushStatus();on.disabled=false;test.disabled=!read()?.active;off.disabled=!read()?.active}).catch(e=>{if(status.isConnected)status.textContent='Bildirim sunucusuna ulaşılamadı. İnternet bağlantını kontrol edip bu sayfayı yeniden aç.'});
 const refresh=()=>{status.textContent=waterPushStatus();test.disabled=!read()?.active;off.disabled=!read()?.active};
 on.onclick=async()=>{on.disabled=true;try{await enableWaterPush(state);refresh();status.textContent='Cihaz bağlandı; ilk test bildirimi gönderiliyor…';try{await testWaterPush();status.textContent='İlk test telefonunun bildirim servisine iletildi. Bildirim görünmüyorsa telefonun bildirim/odak ayarlarını kontrol et. Saatlik hatırlatmalar 09.00–21.00 arasında tam saatlerde gönderilir.'}catch(e){status.textContent='Cihaz bağlandı ancak ilk test iletilemedi: '+e.message+' “Test bildirimi” ile yeniden deneyebilirsin.'}}catch(e){status.textContent=e.message}finally{on.disabled=false}};
 test.onclick=async()=>{test.disabled=true;try{await testWaterPush();status.textContent='Test, telefonun bildirim servisine iletildi. Ekranını kontrol et; görünmesi telefon izinlerine bağlıdır.'}catch(e){status.textContent=e.message}finally{test.disabled=false}};
 off.onclick=async()=>{off.disabled=true;try{await disableWaterPush();refresh()}catch(e){status.textContent=e.message;off.disabled=false}};
}
