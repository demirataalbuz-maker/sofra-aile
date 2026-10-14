// Instagram recipe inbox. Sofra never opens or reads Instagram itself (no API access, no account, no DM link):
// everything in a draft is what the user typed or pasted. Drafts stay on this device until the user opens the
// pre-filled form of the private recipe inbox (GitHub issue). Nothing here publishes to the catalog, computes
// macros or copies photos/videos; only the source link is kept.
export const INBOX_URL='https://github.com/demirataalbuz-maker/sofra-private/issues/new';
export const DRAFT_KEY='sofra-recipe-drafts-v1',MAX_DRAFTS=30,MAX_LINK=7500;
export const LIMITS={title:100,caption:2000,ingredients:2500,steps:3000,notes:800};
export function instagramSource(value){
 let u;try{u=new URL(String(value).trim())}catch{throw Error('Instagram gönderisinin tam bağlantısını yapıştır.')}
 if(u.protocol!=='https:'||!['instagram.com','www.instagram.com','m.instagram.com'].includes(u.hostname)||u.username||u.password||u.port||!/^\/(?:reel|reels|p|tv)\/[A-Za-z0-9_-]{1,100}\/?$/.test(u.pathname))throw Error('Bir Instagram Reel veya gönderi bağlantısı kullan. Profil, hikâye ve kısa paylaşım bağlantıları yerine gönderiyi açıp bağlantısını kopyala.');
 return 'https://www.instagram.com'+u.pathname.replace(/^\/reels\//,'/reel/').replace(/\/?$/,'/');
}

// One ingredient per line ("Malzemeler:" style headers are skipped). A line is "measured" only if the user wrote an amount; "tuz, isteğe göre" style lines
// are accepted as deliberately unmeasured. Anything else is reported as missing, never guessed.
const NUMBER='(?:\\d+(?:[.,]\\d+)?(?:\\s*[-–/]\\s*\\d+(?:[.,]\\d+)?)?|[½¼¾]|yarım|bir|iki|üç|dört|beş|altı)';
const UNIT='(?:g|gr|gram|kg|ml|cl|l|lt|litre|su bardağı|çay bardağı|kahve fincanı|yemek kaşığı|tatlı kaşığı|çay kaşığı|yk|tk|çk|bardak|kaşık|adet|tane|diş|demet|tutam|paket|kase|dilim|avuç|küp|kutu|fincan|cup|tbsp|tsp|oz)';
const LEADING=new RegExp(`^(${NUMBER})\\s*(${UNIT})?\\.?(?:\\s+|$)(.*)$`,'iu'),TRAILING=new RegExp(`^(.*?)[\\s:,-]+(${NUMBER})\\s*(${UNIT})?\\.?$`,'iu');
const APPROX=/isteğe (?:göre|bağlı)|göz kararı|tadına göre|damak tadına|bir tutam|bir miktar|azıcık|biraz/iu;
export function parseIngredients(text){
 return String(text||'').split(/\r?\n/).map(s=>s.replace(/^[\s•*·\-–]+/,'').trim()).filter(s=>s&&!/:$/.test(s)).slice(0,60).map(raw=>{
  const lead=raw.match(LEADING),trail=lead?null:raw.match(TRAILING);
  if(lead&&lead[3])return {raw,amount:lead[1],unit:lead[2]||'',name:lead[3].trim(),measured:true,approx:false};
  if(trail&&trail[1])return {raw,amount:trail[2],unit:trail[3]||'',name:trail[1].trim(),measured:true,approx:false};
  return {raw,amount:'',unit:'',name:raw,measured:false,approx:APPROX.test(raw)};
 });
}
export function draftStatus(draft){
 const missing=[],items=parseIngredients(draft.ingredients),unmeasured=items.filter(i=>!i.measured&&!i.approx).map(i=>i.name);
 if(items.length<2)missing.push('Malzeme listesi (her satıra bir malzeme ve ölçüsü)');
 if(unmeasured.length)missing.push('Ölçüsü yazılmamış malzeme: '+unmeasured.slice(0,8).join(', ')+(unmeasured.length>8?' …':''));
 if(!draft.servings)missing.push('Kaç kişilik olduğu');
 if(!String(draft.steps||'').trim())missing.push('Yapılış adımları');
 return {ready:missing.length===0,missing,items};
}
// Validates without trimming anything silently: over-long text is an error the user can fix.
export function cleanDraft(input){
 const source=instagramSource(input.source),out={source};
 for(const [key,max] of Object.entries(LIMITS)){
  const value=String(input[key]??'').replace(/\r\n/g,'\n').trim();
  if(value.length>max)throw Error(`${{title:'Tarif adı',caption:'Gönderi açıklaması',ingredients:'Malzemeler',steps:'Yapılış',notes:'Not'}[key]} en fazla ${max} karakter olabilir.`);
  out[key]=value;
 }
 const servings=String(input.servings??'').trim();
 if(servings&&!(/^\d{1,2}$/.test(servings)&&+servings>=1&&+servings<=20))throw Error('Kişi sayısı 1–20 arasında bir sayı olmalı.');
 out.servings=servings?+servings:null;
 return out;
}
const readAll=storage=>{try{const v=JSON.parse(storage.getItem(DRAFT_KEY)||'[]');return Array.isArray(v)?v.filter(d=>{if(!d||typeof d.id!=='string'||typeof d.source!=='string')return false;try{instagramSource(d.source);return true}catch{return false}}):[]}catch{return []}};
export function readDrafts(storage=globalThis.localStorage){return readAll(storage)}
export function saveDraft(input,{storage=globalThis.localStorage,now=Date.now(),id=input.id}={}){
 const clean=cleanDraft(input),drafts=readAll(storage),index=drafts.findIndex(d=>d.id===id);
 if(index<0&&drafts.length>=MAX_DRAFTS)throw Error(`En fazla ${MAX_DRAFTS} taslak saklanır. Gönderdiğin veya gerekmeyen bir taslağı sil.`);
 const draft={...(index>=0?drafts[index]:{id:id||'d'+now.toString(36)+Math.random().toString(36).slice(2,8),createdAt:now}),...clean,updatedAt:now,contentRead:false};
 if(index>=0)drafts[index]=draft;else drafts.unshift(draft);
 storage.setItem(DRAFT_KEY,JSON.stringify(drafts));return draft;
}
export function deleteDraft(id,storage=globalThis.localStorage){storage.setItem(DRAFT_KEY,JSON.stringify(readAll(storage).filter(d=>d.id!==id)))}
export function markLinkOpened(id,{storage=globalThis.localStorage,now=Date.now()}={}){
 storage.setItem(DRAFT_KEY,JSON.stringify(readAll(storage).map(d=>d.id===id?{...d,linkOpenedAt:now}:d)));
}

// Pre-filled private inbox form. Only recipe fields travel; empty fields are left out. Too long → error, not cut.
export function recipeDraftLink({source,title='',notes='',servings='',caption='',ingredients='',steps=''}){
 const url=new URL(INBOX_URL);
 url.searchParams.set('template','instagram-tarifi.yml');
 url.searchParams.set('source',instagramSource(source));
 url.searchParams.set('recipe_name',String(title).trim().slice(0,LIMITS.title));
 url.searchParams.set('notes',String(notes).trim().slice(0,LIMITS.notes));
 const extra={servings:servings?String(servings):'',caption,ingredients,steps};
 if(Object.values(extra).some(v=>String(v).trim())){
  for(const [k,v] of Object.entries(extra))if(String(v).trim())url.searchParams.set(k,String(v).trim());
  const status=draftStatus({servings,ingredients,steps});
  url.searchParams.set('missing',status.missing.length?status.missing.join('\n'):'Uygulama eksik bilgi işaretlemedi.');
 }
 if(url.href.length>MAX_LINK)throw Error('Taslak, gönderim bağlantısına sığmayacak kadar uzun. Açıklamayı veya yapılışı kısalt; kısaltmadan göndermek istersen metni GitHub formuna kendin yapıştır.');
 return url.href;
}

export function recipeInbox({esc,storage=globalThis.localStorage}){
 let editing=null,message='';
 const form=(d={})=>`<form id="recipeInboxForm" class="trackform"><input type="hidden" name="id" value="${esc(d.id||'')}">
  <label>Instagram gönderi veya Reels bağlantısı<input name="source" type="url" maxlength="2000" required placeholder="https://www.instagram.com/reel/…" inputmode="url" autocomplete="off" value="${esc(d.source||'')}"></label>
  <label>Tarif adı (isteğe bağlı)<input name="title" maxlength="${LIMITS.title}" placeholder="Örn. Tavuklu sebze kasesi" value="${esc(d.title||'')}"></label>
  <label>Kaç kişilik?<input name="servings" type="number" min="1" max="20" step="1" inputmode="numeric" value="${esc(d.servings??'')}"></label>
  <label>Gönderi açıklaması (Instagram’dan kopyala)<textarea name="caption" maxlength="${LIMITS.caption}" rows="4" placeholder="Gönderinin altındaki tarif metni">${esc(d.caption||'')}</textarea></label>
  <label>Malzemeler ve ölçüleri<textarea name="ingredients" maxlength="${LIMITS.ingredients}" rows="6" placeholder="Her satıra bir malzeme:&#10;200 g tavuk göğsü&#10;1 su bardağı bulgur&#10;tuz, isteğe göre">${esc(d.ingredients||'')}</textarea></label>
  <label>Yapılış<textarea name="steps" maxlength="${LIMITS.steps}" rows="5" placeholder="Adım adım">${esc(d.steps||'')}</textarea></label>
  <label>Notun (isteğe bağlı)<textarea name="notes" maxlength="${LIMITS.notes}" rows="3" placeholder="Değiştirmek istediklerin">${esc(d.notes||'')}</textarea></label>
  <div id="inboxCheck" class="inboxcheck" role="status"></div>
  <p class="hint">Fotoğraf veya video ekleme; yalnızca bağlantı saklanır. Görseli kullanma izni bilinmediği için gönderinin fotoğrafı/videosu uygulamaya kopyalanmaz. Profilin, kilon ve günlük kayıtların bu taslağa eklenmez.</p>
  <div class="buttonrow"><button class="primary">${d.id?'Taslağı güncelle':'Taslak olarak kaydet'}</button>${d.id?'<button class="textlink" type="button" id="inboxNew">Yeni taslak</button>':''}</div>
  <p id="inboxError" role="alert">${esc(message)}</p></form>`;
 const checkHtml=status=>status.ready?'<p><strong>Gerekli bilgiler girildi.</strong> İnceleme sırasında ölçüler ve makrolar doğrulanmış malzeme verisiyle yeniden kontrol edilir.</p>':`<p><strong>Eksik bilgi var:</strong></p><ul>${status.missing.map(m=>`<li>${esc(m)}</li>`).join('')}</ul><p class="hint">Eksikleri gönderiden kopyalayıp tamamlayabilirsin. Tamamlamazsan inceleyen kişi senden ister; tahminle doldurulmaz.</p>`;
 const list=()=>{const drafts=readDrafts(storage);return drafts.length?drafts.map(d=>{const s=draftStatus(d);let link='',linkError='';try{link=recipeDraftLink(d)}catch(e){linkError=e.message}
  return `<article class="inboxdraft"><h3>${esc(d.title||'Adsız tarif')}</h3><p class="meta"><a href="${esc(d.source)}" target="_blank" rel="noopener noreferrer">Kaynak gönderi</a> · ${esc(new Date(d.updatedAt).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}))}</p>
   <p>${s.ready?'<span class="familybadge">İncelemeye hazır</span>':`<span class="formerror">Eksik: ${esc(s.missing.join(' · '))}</span>`}</p>
   ${d.linkOpenedAt?`<p class="hint">Gönderim bağlantısı ${esc(new Date(d.linkOpenedAt).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}))} tarihinde açıldı. GitHub’da gönderilip gönderilmediğini uygulama bilemez.</p>`:''}
   <div class="buttonrow"><button class="secondary" data-draft-edit="${esc(d.id)}">Düzenle</button>${link?`<a class="secondary inboxlink" data-draft-send="${esc(d.id)}" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${s.ready?'Özel tarif kutusuna gönder':'Eksiklerle gönder'}</a>`:`<span class="formerror">${esc(linkError)}</span>`}<button class="textlink" data-draft-delete="${esc(d.id)}">Sil</button></div></article>`}).join(''):'<p class="hint">Henüz kayıtlı taslak yok.</p>'};
 const html=()=>`<h1 class="heading">Instagram’dan tarif ekle</h1><p class="lead">Beğendiğin tarifi taslak olarak kaydet. İncelenip onaylanmadan tarif kataloğuna eklenmez.</p>
  <section class="panel"><span class="waterbadge">Bağlantıyla gönderim · DM bağlı değil</span><h2>Tarif taslağı</h2>
  <p class="inboxnotice"><strong>Sofra Instagram gönderisini kendisi açıp okuyamaz.</strong> Gönderinin açıklamasını, malzemeleri ve ölçüleri buraya kopyala. Yazmadığın ölçüleri veya besin değerlerini tamamlamayız; eksik olarak işaretleriz.</p>
  <div id="inboxFormRoot">${form(editing||{})}</div></section>
  <section class="panel"><h2>Taslaklarım</h2><p class="hint">Taslaklar yalnızca bu cihazda durur. “Gönder” düğmesi özel tarif kutusunun formunu doldurulmuş olarak açar; son gönderimi GitHub’da sen yaparsın (depo erişimi gerekir).</p><div id="inboxDrafts">${list()}</div></section>
  <section class="panel"><h2>Sonrasında ne olacak?</h2><p>Gönderdikten sonra sohbette “tarif kutusuna bak” yaz. Yalnızca senin yazdıkların kullanılır; eksik ölçüleri senden isteriz. Makrolar doğrulanmış malzeme verisinden hesaplanır, uydurulmaz. Taslağı görüp onaylamadan yayımlanmaz.</p>
  <p class="hint">Instagram’dan otomatik DM alma henüz kurulmadı: bunun için Sofra’nın profesyonel Instagram hesabı, Meta geliştirici uygulaması, mesaj izni ve mesajları alan bir sunucu gerekir.</p></section>
  <button class="textlink" data-page="application">‹ Uygulamaya dön</button>`;
 const bind=()=>{
  const root=document.querySelector('#inboxFormRoot');if(!root)return;
  const repaint=()=>{root.innerHTML=form(editing||{});document.querySelector('#inboxDrafts').innerHTML=list();wire()};
  const wire=()=>{
   const f=document.querySelector('#recipeInboxForm'),check=document.querySelector('#inboxCheck');
   const update=()=>{const d=Object.fromEntries(new FormData(f));check.innerHTML=d.ingredients||d.steps||d.servings?checkHtml(draftStatus(d)):''};update();
   f.addEventListener('input',()=>{document.querySelector('#inboxError').textContent='';update()});
   f.onsubmit=e=>{e.preventDefault();try{const saved=saveDraft(Object.fromEntries(new FormData(f)),{storage});editing=null;message=draftStatus(saved).ready?'Taslak kaydedildi. Hazır olduğunda özel kutuya gönderebilirsin.':'Taslak eksik bilgilerle kaydedildi; eksikler aşağıda listelendi.';repaint()}catch(err){document.querySelector('#inboxError').textContent=err.message}};
   document.querySelector('#inboxNew')?.addEventListener('click',()=>{editing=null;message='';repaint()});
   document.querySelectorAll('[data-draft-edit]').forEach(b=>b.onclick=()=>{editing=readDrafts(storage).find(d=>d.id===b.dataset.draftEdit)||null;message='';repaint();root.scrollIntoView()});
   document.querySelectorAll('[data-draft-delete]').forEach(b=>b.onclick=()=>{if(!confirm('Bu taslak bu cihazdan silinsin mi?'))return;deleteDraft(b.dataset.draftDelete,storage);if(editing?.id===b.dataset.draftDelete)editing=null;message='Taslak silindi.';repaint()});
   document.querySelectorAll('[data-draft-send]').forEach(a=>a.addEventListener('click',()=>{markLinkOpened(a.dataset.draftSend,{storage});setTimeout(repaint,0)}));
   message='';
  };
  wire();
 };
 return {get html(){return html()},bind};
}
