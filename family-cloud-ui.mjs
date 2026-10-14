import {readSession,accountConfig,accountReady} from './cloud.mjs?v=16';
import {readFamilyInvitation,clearFamilyInvitation} from './invitation.mjs';
import {mealItems,orderedSlots,totals} from './planner.mjs?v=11';
import {dateKey} from './tracking.mjs?v=13';

export function bindFamilyCloud(host){
 const {cloudFamily,catalog,esc,fmt,openDetail,state}=host;
 const root=document.querySelector('#familyCloudRoot');if(!root)return;
 const active=()=>root.isConnected&&document.querySelector('#familyCloudRoot')===root;
 let result=null,pending=false,invitationUrl='',message='';
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
  const s=readSession(),group=result?.group,invite=readFamilyInvitation(),self=group?.members.find(m=>m.isSelf),owner=self?.role==='owner';
  const disabled=pending?'disabled':'';
  root.innerHTML=`<h2>Telefonlarınız arasında aile grubu</h2><p class="hint">Her üye kendi Google hesabıyla katılır. Paylaşılan menüler yemek, porsiyon ve öğün saatlerinden oluşur; kilo, hedef, alerji ve günlük kayıtlar bu gruba gönderilmez.</p>
   ${!s?`<p>Aile grubuna katılmak için önce kendi Google hesabınla giriş yap.${invite?' Aile davetin bu sekmede bekliyor.':''}</p><button class="primary" data-page="account">Google ile girişe git</button>`:!result?'<p role="status">Aile grubun yükleniyor…</p>':group?`
    <div class="familyheading"><h3>${esc(group.name)}</h3><span>${group.members.length}/4 kişi</span></div><p class="hint">${owner?'Grubu sen yönetiyorsun.':'Bu grubun üyesisin.'} Üyelerin yemeklerine dokunarak yapılışını açabilirsin.</p>
    <div class="buttonrow"><button class="secondary" id="cloudFamilyRefresh" ${disabled}>Menüleri yenile</button>${owner?`<button class="secondary" id="cloudFamilyInvite" ${group.members.length>=4||pending?'disabled':''}>+ Ailemi davet et</button>`:''}</div>
    ${invitationUrl?`<div class="cloudinvite"><label>Davet bağlantısı<input id="cloudInviteLink" readonly value="${esc(invitationUrl)}"></label><button class="secondary" id="cloudInviteCopy">Bağlantıyı kopyala</button><p class="hint">7 gün geçerli, bir kişi kullanabilir. Diğer kişi için yeni davet oluştur. Paylaşımı sen başlatırsın.</p></div>`:''}
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
 }
 paint();
 const refreshTimer=setInterval(()=>{
  if(!active()){clearInterval(refreshTimer);return}
  const editing=root.contains(document.activeElement)&&['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&document.activeElement.type!=='checkbox';
  if(readSession()&&!pending&&!invitationUrl&&!editing&&document.visibilityState==='visible')refresh().then(()=>{if(active())paint()}).catch(()=>{});
 },30000);
 if(readSession())accountConfig().then(config=>{if(!accountReady(config))throw Error('Aile bağlantısı henüz yayında değil.');return refresh()}).then(()=>{if(active())paint()}).catch(e=>{message=e.message;if(active())paint()});
}
