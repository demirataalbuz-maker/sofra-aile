import {readSession,accountConfig,accountReady} from './cloud.mjs?v=16';
import {readFamilyInvitation,clearFamilyInvitation} from './invitation.mjs';
import {mealItems,orderedSlots,totals,rememberRecommendations} from './planner.mjs?v=11';
import {dateKey} from './tracking.mjs?v=13';
import {cookingFields,cookingPreferences,cookingSummary} from './cooking.mjs?v=11';
import {planningRequirements} from './family-requirements.mjs?v=18';
import {SHARED_SLOTS,preparedPortions} from './common-plan.mjs?v=18';
import {personalFromCommon} from './family-cloud.mjs?v=18';
import {familyIngredients} from './family.mjs?v=18';
const ALLERGEN_LABELS={milk:'süt',egg:'yumurta',gluten:'gluten',nuts:'kuruyemiş',peanut:'yer fıstığı',soy:'soya',sesame:'susam',fish:'balık',mustard:'hardal'};
const COMMON_TIMEOUT=25000;
async function loadFamilyCatalog(){
 const r=await fetch('./family-catalog.json',{cache:'no-cache',signal:AbortSignal.timeout(7000)});if(!r.ok)throw Error('Tarif doğrulama verisi alınamadı.');
 const c=await r.json();if(c?.version!==1||!c.recipes)throw Error('Tarif doğrulama verisi geçersiz.');return c;
}

export function bindFamilyCloud(host){
 const {cloudFamily,catalog,esc,fmt,openDetail,state:initialState,ui,save,toast}=host;
 const getState=host.getState||(()=>initialState);
 const root=document.querySelector('#familyCloudRoot');if(!root)return;
 const active=()=>root.isConnected&&document.querySelector('#familyCloudRoot')===root;
 let result=null,pending=false,invitationUrl='',message='',worker=null,timer=null,computing=false;
 const stopWorker=()=>{worker?.terminate();worker=null;clearTimeout(timer);timer=null;computing=false};
 const target=r=>r.mode==='macro'?`${fmt(r.protein)} g protein · ${fmt(r.carbs)} g karb. · ${fmt(r.fat)} g yağ (öncelik: ${{protein:'protein',carbs:'karbonhidrat',fat:'yağ'}[r.priority]})`:`${fmt(r.target)} kcal/gün`;
 const allergyText=r=>r.allergies.length?' · Alerjen filtresi: '+r.allergies.map(a=>ALLERGEN_LABELS[a]||a).join(', '):'';
 // Everything about the shared kitchen: consent, who takes part, compute, today's plan, apply/basket.
 function commonSection(group,self){
  const state=getState();
  const participants=group.members.filter(m=>m.planning),names=new Map(group.members.map(m=>[m.id,m.name]));
  let profileIssue='';try{planningRequirements(state.profile)}catch(e){profileIssue=e.message}
  const plan=group.commonPlan,today=dateKey(),current=plan?.date===today,busy=pending||computing?'disabled':'';
  const changed=!profileIssue&&self.planning&&JSON.stringify(planningRequirements(state.profile))!==JSON.stringify(self.planning);
  const mine=current&&plan.entries[self.id];
  const dish=(e,extra)=>{const r=byId.get(e.id);return r?`<button class="familydish" data-cloud-recipe="${esc(e.id)}" data-portion="${e.portion}"><img src="./${esc(r.image)}" alt="" loading="lazy"><span><strong>${esc(r.title)}</strong><small>${extra}</small></span></button>`:`<p>Tarif bu cihazın kataloğunda yok (${esc(e.id)}). Uygulamayı yenile.</p>`};
  const prep=current?preparedPortions(plan):null;
  return `<section class="commonmeal"><h3>Ortak öğle ve akşam yemeği</h3>
   <p class="hint">Evde tek kişi pişiriyorsa: öğle ve akşam herkes aynı yemeği (varsa aynı yan yemeği) yer, yalnızca porsiyonlar kişiye göre değişir. Kahvaltı ve ara öğün kişiseldir.</p>
   <label class="checklabel"><input type="checkbox" id="commonJoin" ${self.planning?'checked':''} ${busy||(!self.planning&&profileIssue)?'disabled':''}><span>Ortak yemek hesabına katıl<small>Açarsan yalnızca günlük kalori/makro hedefin, alerjenlerin ve mevsim tercihin aile grubunda görünür ve ortak hesapta kullanılır. Kilo, yaş, boy, sağlık durumu ve günlük kayıtların gönderilmez. Kapatınca bu bilgiler silinir ve ortak menü geçersiz olur.</small></span></label>
   ${profileIssue?`<p class="formerror">${esc(profileIssue)}</p><button class="secondary" data-page="profile">Profilimi kontrol et</button>`:''}
   ${changed?'<p class="hint">Bu cihazdaki güncel hedefin ortak hesaptakinden farklı.</p><button class="secondary" id="commonUpdate">Güncel hedefimi ve alerjenlerimi ortak hesaba gönder</button>':''}
   ${participants.length?`<ul class="commonpeople">${participants.map(m=>`<li><strong>${esc(m.name)}</strong> · ${esc(target(m.planning))}${esc(allergyText(m.planning))}</li>`).join('')}</ul>`:'<p class="hint">Henüz kimse katılmadı.</p>'}
   ${participants.length>=2?`<form id="commonForm"><fieldset ${busy}>${cookingFields(ui.commonCookingDraft||{style:'easy'})}</fieldset><button class="primary" ${busy}>${computing?'Porsiyonlar hesaplanıyor…':current?'Ortak menüyü yeniden hesapla':'Ortak menüyü hesapla'}</button>${computing?'<button class="textlink" type="button" id="commonCancel">İptal</button>':''}<p class="hint">Gruptaki herkes hesaplatabilir. Sonuç bulunamazsa mevcut menü değişmez; hedefler gevşetilmez.</p></form>`:'<p class="hint">Ortak hesap için en az iki kişinin katılması gerekir.</p>'}
   ${plan&&!current?'<p class="hint">Son ortak menü önceki bir güne ait; bugün için yeniden hesaplayın.</p>':''}
   ${current?`<p class="cookingbrief">${esc(cookingSummary(plan.cooking))}</p>${orderedSlots(plan.times).map(([slot,label])=>{
    const shared=SHARED_SLOTS.includes(slot),ids=Object.keys(plan.entries);
    return `<div class="cloudmeal"><h4>${esc(plan.times[slot])} · ${label}${shared?' · ortak':''}</h4>${shared?prep[slot].map((e,i)=>dish(e,`${i?'Yan yemek · ':''}Toplam hazırlanacak: ${portion(e.portion)} porsiyon · Yapılışını gör →`)).join('')+`<ul class="commonparts">${ids.map(id=>`<li><strong>${esc(names.get(id)||'Ayrılmış üye')}</strong>: ${mealItems(plan.entries[id][slot]).map(e=>portion(e.portion)+' porsiyon '+esc(byId.get(e.id)?.title||'')).join(' + ')}</li>`).join('')}</ul>`:ids.map(id=>{const e=mealItems(plan.entries[id][slot])[0];return dish(e,`${esc(names.get(id)||'Ayrılmış üye')} · ${portion(e.portion)} porsiyon · Yapılışını gör →`)}).join('')}</div>`;
   }).join('')}<ul class="commonparts">${Object.keys(plan.entries).map(id=>`<li><strong>${esc(names.get(id)||'Ayrılmış üye')}</strong> günlük toplam: ${Object.values(plan.entries[id]).flatMap(mealItems).every(e=>byId.has(e.id))?line(totals(plan.entries[id],byId)):'tarif verisi eksik'}</li>`).join('')}</ul>
   <div class="buttonrow">${mine?`<button class="primary" id="commonApply" ${busy||profileIssue?'disabled':''}>Bugün menüme uygula</button>`:''}<button class="secondary" id="commonBasket" ${busy}>Ortak alışveriş listesini ekle</button></div>
   <p class="hint">Uygulayınca yalnızca senin porsiyonların, güncel profilin ve alerjenlerinle yeniden kontrol edilerek Bugün menüne yazılır. Öğle ve akşamı orada değiştirmek ortak menüden ayrılmanı gerektirir.</p>`:''}
  </section>`;
 }
 const line=t=>`${fmt(t.kcal)} kcal · ${fmt(t.protein)} g protein · ${fmt(t.carbs)} g karb. · ${fmt(t.fat)} g yağ`;
 const portion=n=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2}).format(n);
 const byId=new Map(catalog.recipes.map(r=>[r.id,r]));
 const dishes=menu=>orderedSlots(menu.times).map(([slot,label])=>`<div class="cloudmeal"><h4>${esc(menu.times[slot])} · ${label}</h4>${mealItems(menu.entries[slot]).map(e=>{
  const r=byId.get(e.id);return r?`<button class="familydish" data-cloud-recipe="${esc(e.id)}" data-portion="${e.portion}"><img src="./${esc(r.image)}" alt="" loading="lazy"><span><strong>${esc(r.title)}</strong><small>${portion(e.portion)} porsiyon · Yapılışını gör →</small></span></button>`:`<p>Tarif henüz bu cihazın kataloğunda yok (${esc(e.id)}).</p>`;
 }).join('')}</div>`).join('');
 const run=fn=>async event=>{event?.preventDefault();if(pending)return;pending=true;message='';paint();try{await fn(event)}catch(e){message=e.message}finally{pending=false;if(active())paint()}};
 async function refresh(){result=await cloudFamily.read()}
 function paint(){
  if(!active())return;
  const state=getState();
  const s=readSession(),group=result?.group,invite=readFamilyInvitation(),self=group?.members.find(m=>m.isSelf),owner=self?.role==='owner';
  const disabled=pending?'disabled':'';
  root.innerHTML=`<h2>Telefonlarınız arasında aile grubu</h2><p class="hint">Her üye kendi Google hesabıyla katılır. Kilo, yaş ve günlük kayıtlar paylaşılmaz. Ortak yemek hesabını ayrıca açarsan kalori/makro hedefin ve alerjen tercihlerin bu hesaplama için grupta görünür.</p>
   ${!s?`<p>Aile grubuna katılmak için önce kendi Google hesabınla giriş yap.${invite?' Aile davetin bu sekmede bekliyor.':''}</p><button class="primary" data-page="account">Google ile girişe git</button>`:!result?'<p role="status">Aile grubun yükleniyor…</p>':group?`
    <div class="familyheading"><h3>${esc(group.name)}</h3><span>${group.members.length}/4 kişi</span></div><p class="hint">${owner?'Grubu sen yönetiyorsun.':'Bu grubun üyesisin.'} Üyelerin yemeklerine dokunarak yapılışını açabilirsin.</p>
    <div class="buttonrow"><button class="secondary" id="cloudFamilyRefresh" ${disabled}>Menüleri yenile</button>${owner?`<button class="secondary" id="cloudFamilyInvite" ${group.members.length>=4||pending?'disabled':''}>+ Ailemi davet et</button>`:''}</div>
    ${invitationUrl?`<div class="cloudinvite"><label>Davet bağlantısı<input id="cloudInviteLink" readonly value="${esc(invitationUrl)}"></label><button class="secondary" id="cloudInviteCopy">Bağlantıyı kopyala</button><p class="hint">7 gün geçerli, bir kişi kullanabilir. Diğer kişi için yeni davet oluştur. Paylaşımı sen başlatırsın.</p></div>`:''}
    ${self?commonSection(group,self):''}
    <label class="checklabel"><input type="checkbox" id="cloudMenuShare" ${self?.shareMenu?'checked':''} ${disabled}><span>Menümü ailemle paylaş<small>Açıkken bu cihazda değiştirdiğim menü internet bağlantısıyla aileme gönderilir. Kapatınca paylaşılan menüm kaldırılır.</small></span></label>
    <button class="textlink" id="cloudPublishMenu" ${!state.plan||pending?'disabled':''}>Bu cihazdaki menümü şimdi paylaş / güncelle</button>
    ${group.members.map(m=>`<article class="cloudmember"><h3>${esc(m.name)} ${m.isSelf?'<span class="familybadge">Sen</span>':''}${m.role==='owner'?'<small> · Grup yöneticisi</small>':''}</h3>${m.menu?`<p class="meta">${esc(m.menu.date)}${m.menu.date!==dateKey()?' · Önceki günün menüsü':''} · Son paylaşım ${esc(new Date(m.updatedAt).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}))}</p>${Object.values(m.menu.entries).flatMap(mealItems).every(e=>byId.has(e.id))?`<p>${line(totals(m.menu.entries,byId))}</p>`:''}<details ${m.isSelf?'':'open'}><summary>Öğünleri ve tarifleri göster</summary>${dishes(m.menu)}</details><p class="hint">Bu kişinin paylaştığı menüdür; senin hedefin veya alerjilerin için öneri değildir.</p>`:'<p class="hint">Henüz menüsünü paylaşmadı.</p>'}</article>`).join('')}
    <form id="cloudNameForm"><label>Ailemde görünen adım<input name="displayName" maxlength="40" required value="${esc(self?.name)}"></label><button class="secondary" ${disabled}>Adımı güncelle</button></form><button class="textlink dangerlink" id="cloudFamilyLeave" ${disabled}>Aile grubundan ayrıl</button>
   `:`${invite?`<form id="cloudFamilyJoin"><h3>Aile davetini kabul et</h3><label>Ailende görünecek adın<input name="displayName" maxlength="40" required autocomplete="nickname"></label><p class="hint">Katılınca adın grupta görünür. Menün, ayrıca paylaşmayı açana kadar gizli kalır.</p><button class="primary" ${disabled}>Aile grubuna katıl</button><button class="textlink" type="button" id="cloudDeclineInvite">Daveti kapat</button></form>`:`<form id="cloudFamilyCreate"><h3>Aile grubunu kur</h3><label>Grup adı<input name="groupName" maxlength="40" required placeholder="Bizim aile"></label><label>Ailende görünecek adın<input name="displayName" maxlength="40" required autocomplete="nickname"></label><button class="primary" ${disabled}>Aile grubunu oluştur</button></form><p class="hint">Bir yakınından gelen davet bağlantısını açarak onun grubuna da katılabilirsin.</p>`}`}
   ${message?`<p class="formerror" role="alert">${esc(message)}</p>`:''}`;
  const q=selector=>root.querySelector(selector);
  q('[data-page="account"]')?.addEventListener('click',()=>{host.ui.page='account';host.render()});
  q('#cloudFamilyRefresh')?.addEventListener('click',run(refresh));
  q('#cloudFamilyCreate')?.addEventListener('submit',event=>{const data=Object.fromEntries(new FormData(event.target));run(async()=>{result=await cloudFamily.mutate('/family/create',data)})(event)});
  q('#cloudFamilyJoin')?.addEventListener('submit',event=>{const data=Object.fromEntries(new FormData(event.target));run(async()=>{result=await cloudFamily.mutate('/family/join',{...data,invite});clearFamilyInvitation()})(event)});
  q('#cloudDeclineInvite')?.addEventListener('click',()=>{clearFamilyInvitation();paint()});
  q('#cloudFamilyInvite')?.addEventListener('click',run(async()=>{
   const r=await cloudFamily.request('/family/invite',{});
   const url=new URL('./?page=account',location.href);url.hash='familyInvite='+r.invite;invitationUrl=url.href;
  }));
  q('#cloudInviteCopy')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(invitationUrl);message='Davet bağlantısı kopyalandı.'}catch{message='Bağlantı kutusuna dokunup kopyalayabilirsin.'}paint()});
  q('#cloudMenuShare')?.addEventListener('change',event=>{const on=event.target.checked;run(async()=>{result=await cloudFamily.setSharing(on)})(event)});
  q('#cloudPublishMenu')?.addEventListener('click',run(async()=>{result=await cloudFamily.setSharing(true)}));
  q('#cloudNameForm')?.addEventListener('submit',event=>{const data=Object.fromEntries(new FormData(event.target));run(async()=>{result=await cloudFamily.mutate('/family/name',data)})(event)});
  q('#cloudFamilyLeave')?.addEventListener('click',run(async()=>{
   if(!confirm('Aile grubundan ayrılınca paylaştığın menü kaldırılır. Kişisel kayıtların kalır. Ayrılmak istiyor musun?'))return;
   result=await cloudFamily.mutate('/family/leave',{confirm:'leave'});invitationUrl='';cloudFamily.reset();
  }));
  root.querySelectorAll('[data-cloud-recipe]').forEach(b=>b.addEventListener('click',()=>openDetail(b.dataset.cloudRecipe,Number(b.dataset.portion))));
  q('[data-page="profile"]')?.addEventListener('click',()=>{host.ui.page='profile';host.ui.familyMemberId=null;host.render()});
  q('#commonJoin')?.addEventListener('change',event=>{const on=event.target.checked;run(async()=>{result=await cloudFamily.setParticipation(on);message=on?'Ortak hesaba katıldın. Hedefin ve alerjenlerin aile grubunda görünür.':'Ortak hesaptan çıktın; hedef ve alerjen bilgin silindi.'})(event)});
  q('#commonUpdate')?.addEventListener('click',run(async()=>{result=await cloudFamily.setParticipation(true);message='Ortak hedef ve alerjen bilgilerin güncellendi.'}));
  q('#commonCancel')?.addEventListener('click',()=>{stopWorker();message='Hesaplama iptal edildi; mevcut menü korundu.';paint()});
  q('#commonForm')?.addEventListener('submit',async event=>{
   event.preventDefault();if(pending||computing)return;
   const values=new FormData(event.target),cooking=cookingPreferences({style:values.get('cookingStyle'),maxMinutes:values.get('cookingMinutes')});ui.commonCookingDraft=cooking;
   const today=dateKey();let ticket,familyCatalog;
   pending=true;paint();
   try{ticket=cloudFamily.commonTicket(today);familyCatalog=await loadFamilyCatalog()}catch(e){pending=false;message=e.message;if(active())paint();return}
   pending=false;if(!active())return;
   computing=true;message='Herkesin günlük hedefi ayrı kontrol ediliyor…';paint();
   let job;
   try{job=worker=new Worker(new URL('./family-worker.mjs?v=18',import.meta.url),{type:'module'})}catch{stopWorker();message='Bu tarayıcıda hesaplama başlatılamadı.';paint();return}
   timer=setTimeout(()=>{if(worker!==job)return;stopWorker();message='Hesaplama süre sınırını aştı; mevcut menü korundu. Tekrar dene veya süre/zorluk tercihini değiştir.';if(active())paint()},COMMON_TIMEOUT);
   job.onerror=()=>{if(worker!==job)return;stopWorker();message='Hesaplama başlatılamadı. Sayfayı yenileyip tekrar dene.';if(active())paint()};
   job.onmessage=async({data})=>{
    if(worker!==job)return;if(!active()){stopWorker();return}stopWorker();
    if(!data?.plan){message=data?.error||'Uygun ortak menü bulunamadı; mevcut menü korundu.';if(active())paint();return}
    pending=true;if(active())paint();
    // Published only for the same session, membership, group revision, participants and day (see family-cloud.mjs).
    try{result=await cloudFamily.publishCommon(ticket,data.plan,dateKey());const state=getState();state.family||={members:[],history:{}};for(const entries of Object.values(data.plan.entries))state.family.history=rememberRecommendations(state.family.history,entries);save();message='Ortak menü hazır. Herkes kendi telefonunda kendi porsiyonunu görebilir.'}
    catch(e){message=e.code==='family-conflict'?'Katılımcılar, hedefler veya ortak menü bu sırada değişti. Yeniden hesapla.':e.message}
    finally{pending=false;if(active())paint()}
   };
   job.postMessage({type:'common',input:{catalog:familyCatalog,members:ticket.participants.map(({id,name,requirements})=>({id,name,requirements})),today,cooking,recipes:catalog.recipes,ingredients:catalog.ingredients,history:getState().family?.history||{},now:Date.now(),deadline:Date.now()+COMMON_TIMEOUT-3000}});
  });
  q('#commonApply')?.addEventListener('click',run(async()=>{
   await refresh();const state=getState();
   const group=result?.group,self=group?.members.find(m=>m.isSelf);if(!group||!self)throw Error('Aile grubunu yenile.');
   const personal=personalFromCommon(group.commonPlan,self.id,state.profile,catalog,dateKey(),group.commonRevision);
   if(state.plan?.date===dateKey()&&state.plan.source!=='family-common'&&!confirm('Bugünkü kişisel menünün yerine ortak menüdeki porsiyonların yazılacak. Devam edilsin mi?'))return;
   const before={plan:state.plan,history:state.history};state.plan=personal;state.history=rememberRecommendations(state.history,personal.entries);
   if(!save()){Object.assign(state,before);throw Error('Menü kaydedilemedi; önceki menün korundu.')}
   message='Porsiyonların Bugün menüne eklendi. Yedim ve Liste oradan çalışır.';
  }));
  q('#commonBasket')?.addEventListener('click',run(async()=>{
   await refresh();const state=getState();
   const plan=result?.group?.commonPlan;if(plan?.date!==dateKey())throw Error('Bugünün ortak menüsü yok.');
   const before=structuredClone(state.basket);
   for(const [id,qty] of familyIngredients(plan,catalog.recipes)){const old=state.basket.find(e=>e.id===id);if(old){old.qty=Math.round((old.qty+qty)*10)/10;old.done=false}else state.basket.push({id,qty:Math.round(qty*10)/10,done:false})}
   if(!save()){state.basket=before;throw Error('Liste kaydedilemedi.')}
   message='Ortak menünün tüm malzemeleri listene eklendi.';
   host.render();toast(message);
  }));
 }
 paint();
 const refreshTimer=setInterval(()=>{
  if(!active()){stopWorker();clearInterval(refreshTimer);return}
  const editing=root.contains(document.activeElement)&&['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&document.activeElement.type!=='checkbox';
  if(readSession()&&!pending&&!computing&&!invitationUrl&&!editing&&document.visibilityState==='visible')refresh().then(()=>{if(active())paint()}).catch(()=>{});
 },30000);
 if(readSession())accountConfig().then(config=>{if(!accountReady(config))throw Error('Aile bağlantısı henüz yayında değil.');return refresh()}).then(()=>{if(active())paint()}).catch(e=>{message=e.message;if(active())paint()});
}
