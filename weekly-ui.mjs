import {validWeekDay} from './weekly.mjs?v=21';
import {dateKey} from './tracking.mjs?v=13';
import {cookingFields,cookingPreferences} from './cooking.mjs?v=11';
import {orderedSlots,mealItems,totals,rememberRecommendations,profileError} from './planner.mjs?v=21';
import {planningBlock} from './health.mjs?v=11';
import {readSession} from './cloud.mjs?v=16';
export function weeklyView(host){
 const {getState,catalog,esc,fmt,render,save,toast,openDetail,ui}=host,state=getState(),week=state.weekly,byId=new Map(catalog.recipes.map(r=>[r.id,r]));
 const error=profileError(state.profile)||planningBlock(state.profile),stale=week&&week.profileHash!==JSON.stringify(state.profile);
 const html=`<h1 class="heading">Haftalık menüm</h1><p class="lead">7 gün için kişisel öneri. Her gün hedeflerin ayrı kontrol edilir; aile ortak menüsü bu ekrandan değiştirilmez. Haftalık taslak bu cihazda saklanır.</p><button class="textlink" data-page="plan">Bugünkü menüme dön</button>${error?`<p class="formerror">${esc(error)}</p><button class="primary" data-page="profile">Profilimi düzenle</button>`:`<form id="weeklyForm" class="panel"><label>Başlangıç günü<input type="date" name="start" required value="${dateKey()}"></label>${cookingFields(week?.cooking||state.plan?.cooking)}<button class="primary" type="submit">7 günlük menü oluştur</button><p id="weeklyStatus" role="status"></p></form>`}${stale?'<p class="formerror">Profilin değişti; günleri kullanmadan önce haftayı yeniden oluştur.</p>':''}${week?.missing?.length?`<p class="formerror">${week.missing.length} gün için uygun menü bulunamadı; mevcut hedefler gevşetilmedi.</p>`:''}${(week?.days||[]).map((day,index)=>{const t=totals(day.entries,byId);return `<section class="panel"><h2>${new Date(day.date+'T12:00:00').toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long'})}</h2><p>${fmt(t.kcal)} kcal · ${fmt(t.protein)} g protein · ${fmt(t.carbs)} g karb. · ${fmt(t.fat)} g yağ</p>${orderedSlots(state.mealTimes).map(([slot,label])=>`<h3>${esc(label)} · ${state.mealTimes[slot]}</h3>${mealItems(day.entries[slot]).map(e=>{const r=byId.get(e.id);return r?`<button class="planrecipe" data-week-recipe="${esc(r.id)}" data-portion="${e.portion}"><img src="./${esc(r.image)}" loading="lazy" alt=""><span class="copy"><strong>${esc(r.title)}</strong><span>${Number(e.portion).toLocaleString('tr-TR',{maximumFractionDigits:2})} porsiyon · Yapılışını gör →</span></span></button>`:'<p>Tarif artık katalogda yok; haftayı yeniden oluştur.</p>'}).join('')}`).join('')}<button class="secondary" data-week-use="${index}" ${stale||!validWeekDay(day,week,catalog.recipes,state.profile,catalog.ingredients)?'disabled':''}>Bu menüyü bugün kullan</button></section>`}).join('')}`;
 return {html,bind(){
  document.querySelectorAll('[data-week-recipe]').forEach(b=>b.onclick=()=>openDetail(b.dataset.weekRecipe,Number(b.dataset.portion)));
  document.querySelectorAll('[data-week-use]').forEach(b=>b.onclick=()=>{
   const current=getState(),w=current.weekly,day=w?.days[Number(b.dataset.weekUse)];
   if(!validWeekDay(day,w,catalog.recipes,current.profile,catalog.ingredients)){toast('Profil veya tarifler değişti; haftayı yeniden oluştur.');return;}
   if(current.plan?.source==='family-common'&&!confirm('Bu kişisel menü, bugünkü ortak aile menünün yerine geçecek. Devam edilsin mi?'))return;
   const previous={plan:current.plan,history:current.history};current.plan={date:dateKey(),hash:JSON.stringify(current.profile),entries:structuredClone(day.entries),cooking:w.cooking};current.history=rememberRecommendations(current.history,day.entries);
   if(!save()){Object.assign(current,previous);return;}ui.page='plan';render();toast('Seçtiğin menü bugüne uygulandı.');
  });
  const form=document.querySelector('#weeklyForm');if(!form)return;
  form.onsubmit=e=>{
   e.preventDefault();const button=form.querySelector('button'),status=form.querySelector('#weeklyStatus'),data=new FormData(form),before=getState(),profileHash=JSON.stringify(before.profile),sessionToken=readSession()?.token;
   button.disabled=true;status.textContent='7 günlük menü hazırlanıyor…';
   const worker=new Worker(new URL('./weekly-worker.mjs?v=21',import.meta.url),{type:'module'}),timeout=setTimeout(()=>finish('Hesaplama zaman aşımına uğradı; mevcut menüler korundu.'),30000);
   const finish=(error,result)=>{clearTimeout(timeout);worker.terminate();if(!form.isConnected)return;button.disabled=false;const current=getState();if(profileHash!==JSON.stringify(current.profile)||sessionToken!==readSession()?.token){status.textContent='Profil veya hesap değişti; yeniden dene.';return;}if(error){status.textContent=error;return;}const old=current.weekly;current.weekly=result;if(!save()){current.weekly=old;return;}render();};
   worker.onerror=()=>finish('Haftalık hesaplama açılamadı; sayfayı yenileyip tekrar dene.');worker.onmessage=({data})=>finish(data.error,data.week);
   worker.postMessage({recipes:catalog.recipes,ingredients:catalog.ingredients,profile:before.profile,options:{start:data.get('start'),history:before.history,cooking:cookingPreferences({style:data.get('cookingStyle'),maxMinutes:data.get('cookingMinutes')})}});
  };
 }};
}
