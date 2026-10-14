import {cookingFields,cookingPreferences,cookingSummary,cookingLabel} from './cooking.mjs?v=11';
import {familyState,participating,familyError,familyHash,validFamilyPlan,menuExport,readSharedMenu,familyIngredients} from './family.mjs?v=18';
import {mealItems,orderedSlots,totals,estimate,rememberRecommendations} from './planner.mjs?v=11';
import {planningBlock} from './health.mjs?v=11';
import {dateKey} from './tracking.mjs?v=9';
import {bindFamilyCloud} from './family-cloud-ui.mjs?v=18';

export function familyView(host){
 const {state,ui,catalog,esc,fmt,save,render,toast,openDetail}=host;
 const f=state.family=familyState(state.family),members=participating(f),byId=new Map(catalog.recipes.map(r=>[r.id,r]));
 const current=false,error=familyError(members);
 const portionFmt=n=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2}).format(n);
 const line=t=>`${fmt(t.kcal)} kcal · ${fmt(t.protein)} g protein · ${fmt(t.carbs)} g karb. · ${fmt(t.fat)} g yağ`;
 const dish=(e,extra='')=>{const r=byId.get(e.id);return r?`<button class="familydish" data-family-recipe="${esc(e.id)}" data-portion="${e.portion}"><img src="./${esc(r.image)}" loading="lazy" alt=""><span><strong>${esc(r.title)}</strong><small>${extra}${portionFmt(e.portion)} porsiyon · Yapılışını gör →</small><small>${esc(cookingLabel(r))} · ${r.minutes} dk</small></span></button>`:`<p>${esc(e.title||e.id)} · ${portionFmt(e.portion)} porsiyon (tarif bu katalogda yok)</p>`;};
 const shared=ui.sharedFamilyMenu;
 const html=`<h1 class="heading">Aile grubum</h1><p class="lead">Aynı aile, ayrı hedefler. Herkes kendi telefonundan katılsın; paylaşılan menüleri burada görün.</p>
 <section class="panel" id="familyCloudRoot"></section>
 <details class="panel" hidden><summary>Bu cihazdaki eski aile kayıtları</summary><div class="familyintro"><strong>Bu cihazdaki eski profiller</strong><p>Ortak yemek için yukarıdaki aile grubunu kullan. Önceki yerel kayıtların bu cihazda korunur.</p></div>
 <section class="panel"><div class="familyheading"><h2>Aile üyeleri</h2><span class="meta">${f.members.length}/6 yetişkin</span></div><p class="hint">Bilgilerini girmeden önce kişinin iznini al. Takma ad kullanabilirsin. Otomatik hesap 18–85 yaş içindir.</p>
 ${f.members.map(m=>`<article class="familymember"><label class="checklabel"><input type="checkbox" data-family-include="${esc(m.id)}" ${m.included!==false?'checked':''}><span><strong>${esc(m.name)}</strong><small>${planningBlock(m.profile)?'Otomatik hedef hesabı kapalı':m.profile.mode==='macro'?`${fmt(m.profile.protein)} g protein · ${fmt(m.profile.carbs)} g karb. · ${fmt(m.profile.fat)} g yağ`:`${fmt(estimate(m.profile).target)} kcal/gün`}</small>${planningBlock(m.profile)?'<small class="formerror">Sağlık kısıtı: otomatik menü desteklenmiyor.</small>':''}</span></label><div class="familyactions"><button class="textlink" data-family-edit="${esc(m.id)}">Düzenle</button><button class="textlink" data-family-delete="${esc(m.id)}">Kaldır</button></div></article>`).join('')||'<p>İlk aile üyesini ekleyerek başlayalım.</p>'}
 <div class="buttonrow"><button class="secondary" id="familyAdd" ${f.members.length>=6?'disabled':''}>+ Aile üyesi</button>${state.profile&&!f.members.some(m=>m.id==='self')?'<button class="secondary" id="familySelf">Profilimden ekle</button>':''}</div>
 ${ui.deletedFamilyMember?'<button class="textlink" id="familyUndo">Son kaldırılan üyeyi geri getir</button>':''}</section>
 <section class="panel"><h2>Bugünün ortak menüsü</h2><p class="hint">3 ana öğün + 1 ara öğün. Ortak tarifler seçili herkesin alerjen filtresinden geçer. Her kişinin günlük kalori hedefi ±%10; makro modunda öncelikli makro ±%10, diğerleri en fazla %10 üzerinde tutulur. Gerektiğinde kişiye özel yan yemek eklenir.</p>
 <form id="familyCookingForm"><fieldset ${ui.familyBusy?'disabled':''}>${cookingFields(ui.familyCookingDraft||f.plan?.cooking)}</fieldset><p class="hint">Yemeği hazırlayacak kişinin zamanına göre seç. Menü oluşana kadar mevcut menünüz değişmez.</p>${error?`<p class="formerror">${esc(error)}</p>`:''}<button class="primary" type="submit" id="familyGenerate" ${error||ui.familyBusy?'disabled':''}>${ui.familyBusy?'Porsiyonlar hesaplanıyor…':current?'Ortak menüyü değiştir':'Ortak menü oluştur'}</button></form>${ui.familyBusy?'<button class="textlink" id="familyCancel">İptal</button>':''}<p id="familyStatus" class="hint" role="status">${esc(ui.familyMessage||'')}</p></section>
 ${current?`<p class="cookingbrief">${f.plan.cooking?esc(cookingSummary(f.plan.cooking)):'Bu menüye süre/zorluk tercihi uygulanmadı.'}</p><div class="familytotals">${members.map(m=>`<section class="panel"><h2>${esc(m.name)}</h2><p>${line(totals(f.plan.entries[m.id],byId))}</p><span class="familybadge">Kişisel hedef aralığında</span></section>`).join('')}</div>${orderedSlots(state.mealTimes).map(([slot,label])=>`<section class="panel"><span class="mealtime">${state.mealTimes[slot]}</span><h2>${label}</h2>${dish({id:f.plan.common[slot],portion:members.reduce((s,m)=>s+mealItems(f.plan.entries[m.id][slot])[0].portion,0)},'Toplam hazırlanacak: ')}<div class="familyparts">${members.map(m=>{const parts=mealItems(f.plan.entries[m.id][slot]);return `<div><strong>${esc(m.name)}</strong><span>${portionFmt(parts[0].portion)} porsiyon ortak yemek</span>${parts.slice(1).map(e=>dish(e,'Yanında: ')).join('')}</div>`}).join('')}</div></section>`).join('')}<section class="panel"><button class="primary" id="familyBasket">Tüm ailenin malzemelerini listeye ekle</button><h2 class="familysharetitle">Menüyü paylaş</h2><p class="hint">Dosyada adlar, yemekler, saatler ve porsiyonlar bulunur. Kilo, yaş, sağlık bilgileri, hedefler ve günlük kayıtlar bulunmaz.</p><label class="checklabel"><input id="familyShareConsent" type="checkbox">Seçili üyeler menülerinin paylaşılmasını kabul ediyor.</label><button class="secondary" id="familyExport" disabled>Menü dosyasını indir</button></section>`:f.plan?'<p class="hint">Önceki menü yeni gün, katılımcılar veya profil değişikliği nedeniyle gösterilmiyor. Güncel menü oluştur.</p>':''}
 <section class="panel"><h2>Ailemden gelen menü</h2><p class="hint">Porsiva menü dosyasını burada aç. Bu bir kopyadır; gönderenin sonraki değişiklikleri otomatik gelmez ve kişisel menünün üzerine yazılmaz.</p><label class="filepick">Menü dosyası seç<input type="file" id="familyImport" accept=".json,application/json"></label></section>
 ${shared?`<section class="panel"><h2>Paylaşılan menü · ${esc(shared.date)}</h2><p class="hint">Gönderenin menü kopyasıdır; senin hedeflerin veya sağlık durumun için doğrulanmadı.</p><button class="textlink" id="closeSharedMenu">Kopyayı kapat</button>${shared.members.map(m=>`<details><summary>${esc(m.name)}</summary>${orderedSlots(shared.times).map(([slot,label])=>`<h3>${shared.times[slot]} · ${label}</h3>${m.meals[slot].map(e=>dish(e)).join('')}`).join('')}</details>`).join('')}</section>`:''}
 <p class="bottomnote">Bilinen alerjenler dışlanır; ürün etiketi ve çapraz temas ayrıca kontrol edilmelidir. Klinik beslenme gerektiren durumlarda otomatik aile planı oluşturulmaz.</p></details>`;
 const bind=()=>{
  bindFamilyCloud(host);
  const q=s=>document.querySelector(s),all=(s,fn)=>document.querySelectorAll(s).forEach(fn);
  const cancel=()=>{ui.familyWorker?.terminate();ui.familyWorker=null;ui.familyBusy=false;};
  const mutate=fn=>{cancel();const before=structuredClone(state.family);fn();state.family.plan=null;ui.familyMessage='';if(!save()){state.family=before;toast('Değişiklik kaydedilemedi.')}render();};
  const edit=id=>{cancel();ui.familyMemberId=id;ui.page='profile';render();scrollTo(0,0);};
  q('#familyAdd').onclick=()=>edit('new');q('#familySelf')?.addEventListener('click',()=>edit('self'));
  all('[data-family-edit]',b=>b.onclick=()=>edit(b.dataset.familyEdit));
  all('[data-family-include]',b=>b.onchange=()=>mutate(()=>{f.members.find(m=>m.id===b.dataset.familyInclude).included=b.checked}));
  all('[data-family-delete]',b=>b.onclick=()=>mutate(()=>{ui.deletedFamilyMember=f.members.find(m=>m.id===b.dataset.familyDelete);f.members=f.members.filter(m=>m.id!==b.dataset.familyDelete)}));
  q('#familyUndo')?.addEventListener('click',()=>mutate(()=>{if(f.members.length<6&&!f.members.some(m=>m.id===ui.deletedFamilyMember.id))f.members.push(ui.deletedFamilyMember);ui.deletedFamilyMember=null}));
  all('[data-family-recipe]',b=>b.onclick=()=>openDetail(b.dataset.familyRecipe,+b.dataset.portion));
  q('#familyCookingForm').onsubmit=e=>{
   e.preventDefault();const values=new FormData(e.target),cooking=cookingPreferences({style:values.get('cookingStyle'),maxMinutes:values.get('cookingMinutes')});ui.familyCookingDraft=cooking;
   if(ui.familyBusy||error)return;const snapshot=familyHash(members),day=dateKey();ui.familyBusy=true;ui.familyMessage='Herkesin hedefini ayrı kontrol ediyoruz.';
   try{
    const worker=ui.familyWorker=new Worker(new URL('./family-worker.mjs?v=18',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{if(ui.familyWorker!==worker)return;cancel();const active=participating(state.family);
     if(snapshot!==familyHash(active)||day!==dateKey()){ui.familyMessage='Profiller veya gün değişti. Yeniden menü oluştur.';}
     else if(data.plan&&validFamilyPlan(data.plan,active,catalog.recipes,catalog.ingredients)){
      const previous=structuredClone(state.family);state.family.plan={...data.plan,date:day};for(const entries of Object.values(data.plan.entries))state.family.history=rememberRecommendations(state.family.history,entries);
      if(!save()){state.family=previous;ui.familyMessage='Menü kaydedilemedi; önceki kayıt korundu.';}else ui.familyMessage='Ortak yemekler ve kişisel porsiyonlar hazır.';
     }else ui.familyMessage=data.error||'Uygun ortak menü bulunamadı; mevcut kayıt korundu.';
     if(ui.page==='family')render();
    };
    worker.onerror=()=>{cancel();ui.familyMessage='Menü hesaplaması başlatılamadı. Sayfayı yenileyip tekrar dene.';if(ui.page==='family')render()};
    worker.postMessage({recipes:catalog.recipes,ingredients:catalog.ingredients,members,options:{history:f.history,cooking}});render();
   }catch{cancel();toast('Bu tarayıcıda menü hesaplaması başlatılamadı.');render();}
  };
  q('#familyCancel')?.addEventListener('click',()=>{cancel();ui.familyMessage='Hesaplama iptal edildi; önceki kayıt korundu.';render()});
  q('#familyShareConsent')?.addEventListener('change',e=>q('#familyExport').disabled=!e.target.checked);
  q('#familyExport')?.addEventListener('click',()=>{
   if(!q('#familyShareConsent').checked||!current)return;
   const data=menuExport(f.plan,members,catalog.recipes,state.mealTimes),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
   const a=document.createElement('a');a.href=url;a.download=`porsiva-aile-menusu-${dateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  q('#familyBasket')?.addEventListener('click',()=>{
   if(!current)return;const before=structuredClone(state.basket);
   for(const [id,qty] of familyIngredients(f.plan,catalog.recipes)){const old=state.basket.find(e=>e.id===id);if(old){old.qty=Math.round((old.qty+qty)*10)/10;old.done=false}else state.basket.push({id,qty:Math.round(qty*10)/10,done:false});}
   if(!save())state.basket=before;else toast('Ailenin toplam malzemeleri listeye eklendi.');render();
  });
  q('#familyImport').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>50000)throw Error('Menü dosyası en fazla 50 KB olabilir.');const data=readSharedMenu(JSON.parse(await file.text()));ui.sharedFamilyMenu=data;if(ui.page==='family')render();}catch(err){toast(err instanceof SyntaxError?'Dosya okunamadı; geçerli bir JSON menü dosyası seç.':err.message)}};
  q('#closeSharedMenu')?.addEventListener('click',()=>{ui.sharedFamilyMenu=null;render()});
 };
 return {html,bind};
}
