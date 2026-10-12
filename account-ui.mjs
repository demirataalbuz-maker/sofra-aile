import {DEFAULT_WATER_TIMES} from './water-reminders.mjs?v=13';
import {connectCloud,login,logout,cloudCall,enablePush,disablePush} from './cloud.mjs?v=9';
import {writeLink,clearLink} from './sync.mjs?v=11';
export function account(host){
 const {state,ui,esc,save,render,toast}=host;
 const settings=state.cloudSettings||{};
 const html=`<h1 class="heading">Hesap ve bildirimler</h1><p class="lead">Kayıtlarını cihazların arasında eşitle, günlük menü ve hatırlatmaları yönet.</p><section class="panel"><h2>Su hatırlatmaları</h2><p>Saatlik su bildirimlerini hesap açmadan Takip bölümünden bağlayabilirsin. Aşağıdaki hesap eşitleme ve menü bildirimleri ayrı bir hizmettir; henüz bağlı değil.</p><button class="primary" data-page="tracking">Su bildirimlerine git →</button></section><p id="cloudStatus" role="status">Sunucu durumu kontrol ediliyor…</p>
 <fieldset id="cloudControls" disabled class="cloudcontrols"><section class="panel"><h2>Hesabım</h2><form id="authForm" class="trackform"><label>E-posta<input name="email" type="email" autocomplete="username" required></label><label>Şifre<input name="password" type="password" minlength="8" autocomplete="current-password" required></label><div class="buttonrow"><button class="primary" name="action" value="login">Giriş yap</button><button class="secondary" name="action" value="create">Hesap oluştur</button></div></form><p class="hint">Yeni hesapta e-posta adresini doğruladıktan sonra giriş yap.</p><button class="textlink" id="signOut">Çıkış yap</button></section>
 <section class="panel"><h2>Eşitleme ve paylaşım</h2><p>Kayıtlarını eşitlemek profilini, menünü, yemek/su günlüğünü ve kilo kayıtlarını Sofra sunucusunda saklar. İlk bağlantıda hangi kaydı kullanacağını sen seçersin.</p><label class="checklabel"><input id="syncConsent" type="checkbox" ${settings.sync?'checked':''}>Kayıtlarımı hesabımla eşitlemek istiyorum</label><div class="buttonrow"><button class="secondary" id="uploadState">Bu cihazı hesaba bağla</button><button class="secondary" id="downloadState">Hesabımdaki kaydı yükle</button></div><p class="hint">Hesaptaki kaydı yüklemek bu cihazdaki Sofra kaydını değiştirir; önce otomatik yerel yedek alınır. Yeni değişiklik varsa üzerine yazılmaz.</p>
 <label class="checklabel"><input id="reportConsent" type="checkbox" ${settings.reports?'checked':''}>Günlük kayıtlarımı özel GitHub deposuna gönder ve yapay zekâ değerlendirmesi için paylaş</label><p class="hint">Profil, kilo, yemek ve su kayıtlarının günlük özeti uygulama sahibinin özel deposuna gönderilir; yetkili rapor otomasyonu okur. E-posta dosyaya eklenmez. Git geçmişi eski sürümleri saklayabilir; kapatmak yeni gönderimleri durdurur, önceki kayıtları silmez.</p>
 <label class="checklabel"><input id="autoMenu" type="checkbox" ${settings.autoMenu?'checked':''}>Her gün menümü otomatik hazırla</label><form id="reminderForm" class="trackform"><label>Günaydın bildirimi<input name="morning" type="time" value="${esc(settings.morning||'07:30')}" required></label><label>Su hatırlatma saatleri<input name="waterTimes" value="${esc((settings.waterTimes||DEFAULT_WATER_TIMES).join(', '))}" placeholder="09:00, 10:00, 11:00"></label><button class="secondary" type="button" id="hourlyWater">09.00–21.00 her saat</button><p class="hint">Saatler Türkiye saatidir. Gece için saat ekleme; hedef tamamlandığında su hatırlatmaları durur. Öğün saatlerini Bugün ekranında düzenleyebilirsin.</p><button class="primary">Tercihlerimi kaydet</button></form></section>
 <section class="panel"><h2>Telefon bildirimleri</h2><p>iPhone’da ana ekrandaki Sofra simgesinden aç. Bildirim iznini aşağıdaki düğmeyle ver; ardından uygulamayı kapatıp test bildirimini kontrol et.</p><div class="buttonrow"><button class="primary" id="pushOn">Bildirimleri aç</button><button class="secondary" id="pushTest">Test bildirimi gönder</button></div><button class="textlink" id="pushOff">Bu cihazda bildirimleri kapat</button><p class="hint">İnternet, telefonun izinleri ve odak modu teslimatı etkiler; dakikası dakikasına teslim garantisi yoktur.</p></section></fieldset><p class="formerror" id="accountError" role="alert"></p>`;
 const bind=()=>{
  const q=s=>document.querySelector(s),run=fn=>async e=>{e?.preventDefault();try{q('#accountError').textContent='';await fn(e)}catch(err){q('#accountError').textContent=err.message}};
  connectCloud().then(c=>{if(ui.page!=='account')return;q('#cloudControls').disabled=false;q('#cloudStatus').textContent=c.instance.currentUser?'Giriş yapıldı: '+c.instance.currentUser.email:'Sunucu hazır; hesabına giriş yap.'}).catch(e=>{if(ui.page==='account')q('#cloudStatus').textContent=e.message});
  q('#authForm').onsubmit=run(async e=>{const f=new FormData(e.target),r=await login(f.get('email'),f.get('password'),e.submitter.value==='create');e.target.reset();toast(r.verify?'Doğrulama e-postanı kontrol et.':'Giriş yapıldı.');render()});
  q('#signOut').onclick=run(async()=>{await logout();clearLink();ui.syncUid=null;ui.syncRevision=null;ui.syncEnabled=false;render()});
  const payload=()=>{const {reports,cloudSettings,family,...local}=state;return local};
  q('#uploadState').onclick=run(async()=>{
   if(!q('#syncConsent').checked)throw Error('Eşitleme tercihini önce aç.');
   const c=await connectCloud(),remote=await cloudCall('get');
   if(remote.state)throw Error('Hesabında kayıt var. Üzerine yazmamak için önce hesaptaki kaydı yükle.');
   const result=await cloudCall('sync',{revision:remote.revision,state:payload()});ui.syncRevision=result.revision;ui.syncUid=c.instance.currentUser.uid;ui.syncEnabled=true;state.cloudSettings={...settings,sync:true};writeLink(ui.syncUid,ui.syncRevision,state);save();toast('Cihaz hesabına bağlandı.');render();
  });
  q('#downloadState').onclick=run(async()=>{
   if(!q('#syncConsent').checked)throw Error('Eşitleme tercihini önce aç.');
   const c=await connectCloud(),remote=await cloudCall('get');if(!remote.state)throw Error('Hesabında henüz kayıt yok. Bu cihazı bağlayabilirsin.');
   localStorage.setItem('sofra-before-cloud',JSON.stringify(state));
   const localFamily=state.family;for(const k of Object.keys(state))delete state[k];Object.assign(state,remote.state,{family:localFamily,reports:remote.reports||{},cloudSettings:remote.settings||{sync:true}});
   ui.syncUid=c.instance.currentUser.uid;ui.syncRevision=remote.revision;ui.syncEnabled=true;writeLink(ui.syncUid,ui.syncRevision,state);save();render();toast('Hesabındaki kayıt yüklendi.');
  });
  q('#hourlyWater').onclick=()=>q('[name=waterTimes]').value=DEFAULT_WATER_TIMES.join(', ');
  q('#reminderForm').onsubmit=run(async e=>{
   const f=new FormData(e.target),waterTimes=String(f.get('waterTimes')).split(',').map(s=>s.trim()).filter(Boolean);
   if(waterTimes.length>24||waterTimes.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))throw Error('En fazla 24 saat gir: 10:00, 14:00 gibi.');
   const next={sync:q('#syncConsent').checked,reports:q('#reportConsent').checked,autoMenu:q('#autoMenu').checked,morning:f.get('morning'),waterTimes:[...new Set(waterTimes)]};
   if(next.reports&&!next.sync)throw Error('Rapor paylaşımı için eşitleme açık olmalı.');
   await cloudCall('settings',{settings:next});state.cloudSettings=next;if(!next.sync)ui.syncEnabled=false;save();toast('Tercihler sunucuya kaydedildi.');render();
  });
  q('#pushOn').onclick=run(async()=>{await enablePush();toast('Bildirim aboneliğin sunucuya kaydedildi. Test gönderebilirsin.')});
  q('#pushOff').onclick=run(async()=>{await disablePush();toast('Bu cihazın aboneliği kapatıldı.')});
  q('#pushTest').onclick=run(async()=>{await cloudCall('testPush');toast('Test gönderme isteği işlendi; telefonunu kontrol et.')});
 };
 return {html,bind};
}
