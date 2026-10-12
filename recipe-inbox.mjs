export const INBOX_URL='https://github.com/demirataalbuz-maker/sofra-private/issues/new';
export function instagramSource(value){
 let u;try{u=new URL(String(value).trim())}catch{throw Error('Instagram gönderisinin tam bağlantısını yapıştır.')}
 if(u.protocol!=='https:'||!['instagram.com','www.instagram.com','m.instagram.com'].includes(u.hostname)||u.username||u.password||u.port||!/^\/(?:reel|reels|p|tv)\/[A-Za-z0-9_-]{1,100}\/?$/.test(u.pathname))throw Error('Bir Instagram Reel veya gönderi bağlantısı kullan. Profil, hikâye ve kısa paylaşım bağlantıları yerine gönderiyi açıp bağlantısını kopyala.');
 return 'https://www.instagram.com'+u.pathname.replace(/^\/reels\//,'/reel/').replace(/\/?$/,'/');
}
export function recipeDraftLink({source,title='',notes=''}){
 const canonical=instagramSource(source),url=new URL(INBOX_URL);
 url.searchParams.set('template','instagram-tarifi.yml');
 url.searchParams.set('source',canonical);
 url.searchParams.set('recipe_name',String(title).trim().slice(0,100));
 url.searchParams.set('notes',String(notes).trim().slice(0,800));
 return url.href;
}
export function recipeInbox({esc}){
 return {html:`<h1 class="heading">Instagram’dan tarif ekle</h1><p class="lead">Beğendiğin tarifin bağlantısını hazırla, özel tarif kutusuna gönder.</p><section class="panel"><span class="waterbadge">Bağlantıyla gönderim</span><h2>Tarif bağlantısı</h2><p>Instagram’da gönderiyi aç → Paylaş → Bağlantıyı kopyala. Buraya yapıştır.</p><form id="recipeInboxForm" class="trackform"><label>Instagram gönderi bağlantısı<input name="source" type="url" maxlength="2000" required placeholder="https://www.instagram.com/reel/…" inputmode="url" autocomplete="off"></label><label>Tarif adı (isteğe bağlı)<input name="title" maxlength="100" placeholder="Örn. Tavuklu sebze kasesi"></label><label>Tarifle ilgili notun (isteğe bağlı)<textarea name="notes" maxlength="800" rows="4" placeholder="Ölçüler veya istediğin değişiklikler"></textarea></label><p class="hint">Yalnızca tarif bağlantısı ve notu aktarılır; profilin, kilon ve günlük kayıtların eklenmez. Notuna kişisel bilgi veya şifre yazma.</p><button class="primary">Gönderim bağlantısını hazırla</button><p id="inboxError" role="alert"></p></form><div id="inboxReady" hidden><p><strong>Bağlantın hazır; henüz gönderilmedi.</strong></p><a id="inboxDraftLink" class="primary inboxlink" target="_blank" rel="noopener noreferrer">Özel kutuda aç ve gönder</a><p class="hint">GitHub formunda hazırlama isteğini işaretleyip gönder. Bu özel kutu yalnızca depo sahibine ve erişimi olan kişilere açıktır; GitHub girişi gerekebilir.</p></div></section><section class="panel"><h2>Sonrasında ne olacak?</h2><p>Gönderdikten sonra sohbette “tarif kutusuna bak” yaz. Kaynağı inceleyip ölçüleri, makroları ve görselleriyle bir taslak hazırlayabiliriz. Video açılamazsa dosyayı sohbette paylaşman gerekir.</p><p class="hint">Otomatik Instagram DM alma ve kendiliğinden video işleme henüz bağlı değil. Tarif, incelenip yayın isteği verilmeden uygulamaya eklenmez.</p></section><button class="textlink" data-page="application">‹ Uygulamaya dön</button>`,bind(){
 const form=document.querySelector('#recipeInboxForm'),ready=document.querySelector('#inboxReady'),error=document.querySelector('#inboxError');
 form.addEventListener('input',()=>{ready.hidden=true;document.querySelector('#inboxDraftLink').removeAttribute('href');error.textContent=''});
 form.onsubmit=e=>{e.preventDefault();try{const data=Object.fromEntries(new FormData(form));document.querySelector('#inboxDraftLink').href=recipeDraftLink(data);ready.hidden=false;error.textContent=''}catch(e){ready.hidden=true;error.textContent=e.message}};
 }};
}
