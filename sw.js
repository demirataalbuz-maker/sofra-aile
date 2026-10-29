const CACHE='sofra-aile-v27';
const CORE=['./flexible-food.mjs?v=26','./external-food.mjs?v=24','./food-diary.mjs?v=26','./food-diary-ui.mjs?v=26','./weekly.mjs?v=21','./weekly-ui.mjs?v=21','./weekly-worker.mjs?v=21','./water-push.mjs?v=21','./push-config.json','./water-reminders.mjs?v=13','./water.mjs?v=13','./water-ui.mjs?v=13','./recipe-inbox.mjs?v=22','./cooking.mjs?v=11','./family.mjs?v=21','./family-ui.mjs?v=21','./family-worker.mjs?v=21','./family-cloud.mjs?v=21','./family-cloud-ui.mjs?v=21','./family-requirements.mjs?v=21','./common-plan.mjs?v=21','./invitation.mjs','./family-cloud.css?v=21','./family-catalog.json','./health.mjs?v=11','./','./index.html','./style.css?v=25','./app.js?v=27','./updates.mjs?v=27','./version.json','./tracking.mjs?v=13','./tracking-ui.mjs?v=27','./account-ui.mjs?v=21','./cloud.mjs?v=16','./sync.mjs?v=21','./snapshots.mjs?v=16','./cloud-config.json','./catalog.mjs?v=5','./daily-catalog.json','./planner.mjs?v=21','./seasons.mjs?v=6','./catalog.json','./photo-credits.json','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png'];

self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([
 caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sofra-aile-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()
])));
async function networkFirst(request,event){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);
 try{
  const response=await fetch(request,{cache:'no-cache',signal:controller.signal});
  if(!response.ok)throw Error('Unavailable');
  const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{}));
  return response;
 }catch{
  const saved=await caches.match(request)||(request.mode==='navigate'?await caches.match('./index.html'):null);
  if(!saved)return new Response('Offline',{status:503,headers:{'Content-Type':'text/plain'}});
  const headers=new Headers(saved.headers);headers.set('X-Sofra-Offline','1');
  return new Response(saved.body,{status:saved.status,statusText:saved.statusText,headers});
 }finally{clearTimeout(timer)}
}
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 event.respondWith(networkFirst(request,event));
});
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{}}catch{}
 const safeUrl=new URL('./?page=tracking',self.location.href);
 try{const candidate=new URL(data.url);if(candidate.origin===safeUrl.origin&&candidate.pathname===safeUrl.pathname)safeUrl.href=candidate.href}catch{}
 event.waitUntil(self.registration.showNotification(String(data.title||'Porsiva').slice(0,100),{body:String(data.body||'Porsiva’da yeni bir hatırlatman var.').slice(0,250),tag:String(data.tag||'sofra').slice(0,100),icon:'./icon-192.png',data:{url:safeUrl.href}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const target=new URL(event.notification.data?.url||'./',self.location.href),scope=new URL('./',self.location.href);
 if(target.origin!==scope.origin||target.pathname!==scope.pathname)return;
 event.waitUntil(self.clients.openWindow(target.href));
});
