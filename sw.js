const CACHE='sofra-aile-v8';
const CORE=['./','./index.html','./style.css?v=8','./app.js?v=8','./updates.mjs?v=8','./version.json','./catalog.mjs?v=5','./daily-catalog.json','./planner.mjs?v=7','./seasons.mjs?v=6','./catalog.json','./photo-credits.json','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png'];
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
