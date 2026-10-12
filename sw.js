const CACHE='sofra-aile-v12';
const CORE=['./water.mjs?v=12','./water-ui.mjs?v=12','./recipe-inbox.mjs?v=12','./cooking.mjs?v=11','./family.mjs?v=11','./family-ui.mjs?v=11','./family-worker.mjs?v=11','./health.mjs?v=11','./','./index.html','./style.css?v=12','./app.js?v=12','./updates.mjs?v=12','./version.json','./tracking.mjs?v=12','./tracking-ui.mjs?v=12','./account-ui.mjs?v=11','./cloud.mjs?v=9','./sync.mjs?v=11','./cloud-config.json','./catalog.mjs?v=5','./daily-catalog.json','./planner.mjs?v=11','./seasons.mjs?v=6','./catalog.json','./photo-credits.json','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png'];
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
