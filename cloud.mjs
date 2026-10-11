let context;
export async function connectCloud(){
 if(context)return context;
 const config=await fetch('./cloud-config.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Bağlantı ayarı alınamadı.');return r.json()});
 if(!config.enabled)throw Error('Hesap ve bildirim sunucusunun kurulumu sürüyor. Yerel günlük takibini kullanabilirsin.');
 if(!config.firebase?.projectId||!/^https:\/\//.test(config.apiUrl))throw Error('Sunucu ayarı tamamlanmamış.');
 const [app,auth]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js')]);
 const instance=auth.getAuth(app.initializeApp(config.firebase));await instance.authStateReady();
 async function call(action,data={}){
  if(!instance.currentUser)throw Error('Önce hesabına giriş yap.');
  const token=await instance.currentUser.getIdToken();const r=await fetch(config.apiUrl,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action,...data}),signal:AbortSignal.timeout(20000)});
  const body=await r.json();if(!r.ok)throw Error(body.error||'Sunucuya ulaşılamadı.');return body;
 }
 context={config,auth,instance,call};return context;
}
export async function login(email,password,create=false){const c=await connectCloud();if(create){const r=await c.auth.createUserWithEmailAndPassword(c.instance,email,password);await c.auth.sendEmailVerification(r.user);return {verify:true}}await c.auth.signInWithEmailAndPassword(c.instance,email,password);return {verify:!c.instance.currentUser.emailVerified}}
export async function logout(){const c=await connectCloud();await c.auth.signOut(c.instance)}
export async function cloudCall(action,data){return (await connectCloud()).call(action,data)}
export async function enablePush(){
 const c=await connectCloud();
 if(!('Notification'in window)||!('PushManager'in window)||!('serviceWorker'in navigator))throw Error('Bu tarayıcı bildirim desteklemiyor. iPhone’da Sofra’yı ana ekrana ekleyip simgesinden aç.');
 if(!c.instance.currentUser)throw Error('Önce giriş yap.');
 // Permission is requested only by the notification button, never at startup.
 if(await Notification.requestPermission()!=='granted')throw Error('Bildirim izni verilmedi. Telefon ayarlarından açabilirsin.');
 const reg=await navigator.serviceWorker.ready;
 const key=c.config.vapidPublicKey;if(!key)throw Error('Bildirim sunucusu henüz hazır değil.');
 const base64=key.replace(/-/g,'+').replace(/_/g,'/');const bytes=Uint8Array.from(atob(base64+'='.repeat((4-base64.length%4)%4)),ch=>ch.charCodeAt(0));
 const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
 await c.call('subscribe',{subscription:sub.toJSON()});return true;
}
export async function disablePush(){const c=await connectCloud(),reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub){await c.call('unsubscribe',{endpoint:sub.endpoint});await sub.unsubscribe()}}
