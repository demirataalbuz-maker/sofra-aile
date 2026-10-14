import {accountConfig,accountReady,readSession,renderGoogleButton,signOut,deleteAccount,api} from './cloud.mjs?v=16';
import {readLink,statusText} from './sync.mjs?v=16';
import {readFamilyInvitation} from './invitation.mjs';
let detach=null;
export function account(host){
 const {state,esc,render,toast,cloudSync}=host;
 const html=`<h1 class="heading">Hesap ve eşitleme</h1><p class="lead">Sofra hesapsız çalışır. İstersen Google ile giriş yapıp kayıtlarını kendi cihazların arasında eşitleyebilirsin.</p>
 <section class="panel"><h2>Su hatırlatmaları</h2><p>Saatlik su bildirimleri hesaptan bağımsızdır; Takip bölümünden açıp kapatabilirsin.</p><button class="primary" data-page="tracking">Su bildirimlerine git →</button></section>
 <section class="panel"><h2>Google hesabı</h2><p>Deneme sürümüne ilk giriş için sana özel davet bağlantısını açıp kendi Google hesabını kullan. Davet, kişisel kayıtlarını aile üyelerine açmaz. Sonraki girişlerinde yeniden davet gerekmez.</p><p id="accountStatus" role="status">Kontrol ediliyor…</p><div id="googleButton" class="googlebutton"></div>
 <div class="buttonrow" id="signedInActions" hidden><button class="secondary" id="signOut">Çıkış yap</button><button class="textlink" id="signOutAll">Tüm cihazlarda çıkış yap</button></div>
 <p class="hint">Giriş yapmak tek başına hiçbir kaydı yüklemez. Google’dan yalnızca hesap kimliğin ve e-posta adresin alınır; Google şifren ve Google erişim anahtarların Sofra’ya gelmez. Oturum 30 gün sürer.</p></section>
 <section class="panel" id="syncPanel" hidden><h2>Cihazlar arası eşitleme</h2><p id="syncStatus" role="status"></p>
 <details class="syncdata"><summary>Eşitlemeyi açarsan Cloudflare’a neler gider?</summary><ul><li>Profilin: yaş, boy, kilo, cinsiyet, hareket düzeyi, hedeflerin, alerjilerin ve seçtiğin sağlık durumları</li><li>Kişisel menün, öğün saatlerin, alışveriş listen ve öneri geçmişin</li><li>Yemek, su ve kilo günlüğün ile günlük hedef özetlerin</li></ul><p>Bunlar Sofra’nın Cloudflare D1 veritabanında, Google hesabına bağlı Sofra hesabında saklanır. <strong>Gitmeyenler:</strong> aile profilleri, su bildirimi aboneliğin, tarif kutusu ve bu cihazdaki yedekler. Eşitlemeyi kapatmak yeni gönderimleri durdurur; sunucudaki kaydı silmek için aşağıdaki silme düğmesini kullan.</p></details>
 <div id="syncSetup" hidden><p id="remoteInfo"></p><label class="checklabel"><input id="syncConsent" type="checkbox">Yukarıdaki kayıtlarımın Cloudflare’da hesabımla saklanmasına ve cihazlarım arasında eşitlenmesine izin veriyorum</label><div class="buttonrow"><button class="secondary" id="uploadState">Bu cihazdaki kayıtları hesaba yükle</button><button class="secondary" id="downloadState">Hesabımdaki kayıtları bu cihaza indir</button></div><p class="hint">İndirmeden önce bu cihazdaki kayıtların yedeklenir. Hesabında kayıt varsa üzerine yazmadan önce sorarız.</p></div>
 <div id="syncLinked" hidden class="buttonrow"><button class="secondary" id="syncNow">Şimdi eşitle</button><button class="textlink" id="syncOff">Bu hesapta eşitlemeyi kapat</button></div>
 <div id="syncConflict" hidden class="buttonrow"><button class="secondary" id="takeRemote">Hesabımdakini kullan</button><button class="secondary" id="takeLocal">Bu cihazdakini hesaba yaz</button></div>
 <button class="textlink" id="restoreBackup" hidden>Eşitleme öncesi yerel yedeği geri yükle</button>
 <button class="textlink dangerlink" id="deleteAccount">Sunucudaki Sofra hesabımı ve kayıtlarımı sil</button></section>
 <section class="panel"><h2>Aile grubum</h2><p>${readFamilyInvitation()?'Bu sekmede bir aile davetin var. Google girişinden sonra Aile bölümünde adını yazıp daveti kabul edebilirsin.':'Kendi Google hesabınla aile grubu oluşturabilir veya sana gönderilen davetle katılabilirsin. Menü paylaşımını ayrıca sen açarsın.'}</p><button class="secondary" data-page="family">Aile grubuna git →</button></section>
 <section class="panel"><h2>Henüz gelmeyenler</h2><p>Uygulama kapalıyken otomatik günlük menü, öğün bildirimleri ve günlük raporlar bu sürümde yok.</p></section>
 <p class="formerror" id="accountError" role="alert"></p>`;
 const bind=()=>{
  const q=s=>document.querySelector(s),show=(s,on)=>{const el=q(s);if(el)el.hidden=!on};
  const error=msg=>{const el=q('#accountError');if(el)el.textContent=msg||''};
  const run=fn=>async e=>{e?.preventDefault();const b=e?.currentTarget;error('');if(b)b.disabled=true;try{await fn(e)}catch(err){error(err.message)}finally{if(b?.isConnected)b.disabled=false}};
  let meta=null;
  const paint=status=>{
   if(!q('#syncStatus'))return;
   const s=readSession(),link=readLink(),mine=Boolean(s&&link?.uid===s.accountId);
   q('#syncStatus').textContent=statusText(status)||(mine?'Eşitleme açık.':'');
   const conflict=mine&&['conflict','missing'].includes(status.kind);
   show('#syncConflict',conflict);if(q('#takeRemote'))q('#takeRemote').hidden=status.kind==='missing';
   show('#syncLinked',mine&&!conflict&&meta?.sync.enabled!==false);
   show('#syncSetup',!mine||meta?.sync.enabled===false);
   show('#restoreBackup',cloudSync.hasBackup());
   if(meta&&q('#remoteInfo'))q('#remoteInfo').textContent=(link&&!mine?'Bu cihazdaki kayıtlar daha önce başka bir Google hesabıyla eşitlendi; bu hesaba ancak sen seçersen yüklenir. ':'')+(meta.sync.hasState?'Hesabında kayıt var'+(meta.sync.updatedAt?' (son değişiklik '+new Date(meta.sync.updatedAt).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'})+')':'')+'.':'Hesabında henüz kayıt yok.');
  };
  detach?.();detach=cloudSync.onStatus(paint);
  const refresh=async()=>{
   const config=await accountConfig().catch(()=>null);
   if(!q('#accountStatus'))return;
   if(!accountReady(config)){q('#accountStatus').textContent='Hesap sunucusu henüz yayında değil. Kayıtların bu cihazda saklanmaya devam ediyor.';return}
   const s=readSession();
   if(!s){
    q('#accountStatus').textContent='Giriş yapılmadı.';show('#signedInActions',false);show('#syncPanel',false);
    renderGoogleButton(q('#googleButton'),{
     onSignedIn:acc=>{cloudSync.reset();toast('Giriş yapıldı: '+acc.email);cloudSync.restore().catch(()=>{});render()},
     onError:e=>{error(e.message);refresh()}
    }).catch(e=>{if(q('#accountStatus'))q('#accountStatus').textContent=e.message});
    return;
   }
   q('#googleButton').replaceChildren();
   q('#accountStatus').textContent='Giriş yapıldı: '+s.email;show('#signedInActions',true);show('#syncPanel',true);
   paint(cloudSync.describe());
   try{meta=await api('/account')}catch(e){if(e.status===401){render();return}error(e.message)}
   paint(cloudSync.status());
  };
  refresh();
  const consent=()=>{if(!q('#syncConsent').checked)throw Error('Önce Cloudflare’da saklama iznini işaretle.')};
  const hasLocal=()=>Boolean(state.profile||state.plan||state.tracking?.entries?.length||state.basket?.length);
  q('#signOut').onclick=run(async()=>{const r=await signOut();cloudSync.reset();toast(r.revoked?'Çıkış yapıldı. Kayıtların bu cihazda duruyor.':'Bu cihazda çıkış yapıldı. Sunucuya ulaşılamadığı için oturum anahtarı en geç 30 gün içinde kendiliğinden geçersiz olacak.');render()});
  q('#signOutAll').onclick=run(async()=>{
   const r=await signOut({everywhere:true});
   if(r.revoked){cloudSync.reset();toast('Tüm cihazlarda oturum kapatıldı.');render();return}
   // Never report success without the server's confirmation: other devices may still be signed in.
   if(r.reason==='session'){cloudSync.reset();render();throw Error('Bu cihazdaki oturum zaten geçersizdi; diğer cihazlar kapatılamadı. Yeniden giriş yapıp “Tüm cihazlarda çıkış yap”ı tekrar dene.')}
   throw Error(r.reason==='offline'?'İnternete bağlı değilsin; diğer cihazlardaki oturumlar kapatılamadı. Bu cihazda oturumun açık kaldı, bağlanınca tekrar dene.':'Sunucu diğer cihazlardaki oturumları kapatamadı. Bu cihazda oturumun açık kaldı; biraz sonra tekrar dene.');
  });
  q('#uploadState').onclick=run(async()=>{
   consent();const s=readSession(),link=readLink();
   if(link&&link.uid!==s?.accountId&&!confirm('Bu cihazdaki kayıtlar daha önce başka bir Google hesabıyla eşitlendi. Yine de bu hesaba yüklensin mi?'))return;
   try{await cloudSync.connect('upload')}
   catch(e){if(e.code!=='remote-exists')throw e;if(!confirm('Hesabında zaten kayıt var. Hesaptaki kayıt bu cihazdakiyle değiştirilsin mi? (Hesaptakini korumak için “indir” seçeneğini kullan.)'))return;await cloudSync.connect('upload',{replaceRemote:true})}
   toast('Bu cihaz hesabınla eşitleniyor.');render();
  });
  q('#downloadState').onclick=run(async()=>{
   consent();if(hasLocal()&&!confirm('Bu cihazdaki Sofra kayıtları hesabındakiyle değiştirilecek. Önce yerel yedek alınır. Devam edilsin mi?'))return;
   await cloudSync.connect('download');toast('Hesabındaki kayıtlar yüklendi.');render();
  });
  q('#syncNow').onclick=run(async()=>{await cloudSync.restore()});
  q('#syncOff').onclick=run(async()=>{await cloudSync.disable();toast('Eşitleme kapatıldı. Kayıtların bu cihazda kalır.');render()});
  q('#takeRemote').onclick=run(async()=>{if(!confirm('Bu cihazdaki eşitlenmemiş değişiklikler yerine hesabındaki kayıt kullanılacak. Önce yerel yedek alınır. Devam edilsin mi?'))return;await cloudSync.connect('download');render()});
  q('#takeLocal').onclick=run(async()=>{if(!confirm('Hesabındaki kayıt bu cihazdakiyle değiştirilecek. Diğer cihazın son değişiklikleri hesaptan kalkar. Devam edilsin mi?'))return;await cloudSync.connect('upload',{replaceRemote:true});render()});
  q('#restoreBackup').onclick=run(async()=>{if(!confirm('Eşitleme öncesi yedek bu cihaza geri yüklenecek ve bu cihazda eşitleme duracak. Devam edilsin mi?'))return;await cloudSync.restoreBackup();toast('Yerel yedek geri yüklendi.');render()});
  q('#deleteAccount').onclick=run(async()=>{if(!confirm('Sunucudaki Sofra hesabın, oturumların ve eşitlenen kayıtların kalıcı olarak silinecek. Bu cihazdaki kayıtlar kalır. Devam edilsin mi?'))return;cloudSync.reset();await deleteAccount();cloudSync.forget();toast('Sunucudaki hesabın silindi.');render()});
 };
 return {html,bind};
}
