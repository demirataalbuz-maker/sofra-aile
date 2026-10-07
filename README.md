# Sofra Aile

Giriş istemeyen, telefon için bağımsız Sofra web uygulaması. Ana katalog ve günlük eklenen tarifleri fotoğraflı hazırlık adımlarıyla gösterir. Tarif arama, kişi sayısı, pişirme yöntemi, kişisel günlük menü ve alışveriş listesi içerir. Liste ve menü sadece cihazın tarayıcı depolamasında saklanır; sunucuya gönderilmez. İçerik ilk açılıştan sonra çevrimdışı kullanılabilir; henüz açılmamış fotoğraflar çevrimdışı görünmeyebilir. ChatGPT veya başka bir giriş gerekmez.

Yayın: https://demirataalbuz-maker.github.io/sofra-aile/

İPhone kurulumu: Safari ile URL'yi açın → Paylaş → Ana Ekrana Ekle → Web Uygulaması Olarak Aç. Android'de Chrome → menü → Ana ekrana ekle.

Web sürümü cihazda saklanan profil, kalori/makro hedefleri, alerjen uyarıları ve tekrar azaltan günlük menü önerileri içerir. Besin değerleri yaklaşık hesaplardır; alerjen uyarısı güvenlik garantisi değildir.

Görsel kaynakları için kaynaklar.html ve photo-credits.json dosyalarına bakın. Lisanslı fotoğrafların özgün dosyaları korunmuştur; diğer görseller web için optimize edilmiştir.

## Tarif güncelleme

Yeni Android test APK'sı GitHub Releases'a yayımlandığında `.github/workflows/sync-catalog.yml` en geç bir sonraki 6 saatlik çalışmada tarif ve görselleri otomatik aktarır. `workflow_dispatch` ile hemen başlatılabilir. APK boyutu ve SHA-256 özeti doğrulanır; yeni kaynak bilgisi bulunmayan lisanslı görsel otomatik yayımlanmaz. Web uygulamasının kod veya tasarım değişiklikleri bu akıştan bağımsız olarak ayrıca yayımlanır.

## Günlük yeni tarifler

Günlük eklemeler `daily-catalog.json` dosyasında saklanır ve ana katalogla birleştirilir. Android katalog eşitlemesi bu dosyayı değiştirmez. Tarif hazırlama ve yayın akışı için [DAILY_RECIPES.md](DAILY_RECIPES.md) dosyasına bakın.

## Android / iPhone web kurulumu ve güncelleme (web 8)

Uygulamadaki **Uygulama** düğmesi kurulum adımlarını, web sürümünü, en son günlük tarif tarihini ve güncellik kontrolünü gösterir. Destekleyen tarayıcı `beforeinstallprompt` sağlarsa doğrudan yükleme düğmesi de görünür. Android için Chrome menüsünden Ana ekrana ekle → Yükle; iPhone için Safari paylaş menüsünden Ana Ekrana Ekle kullanılır. Eski native APK kayıtları tarayıcıya otomatik aktarılmaz; web profili cihazda ayrı tutulur. Bildirim altyapısı bu değişiklikle eklenmemiştir.

Açılışta, görünür pencereye dönüşte (en fazla dakikada bir), internet geri geldiğinde ve görünürken 5 dakikada bir HTTP önbelleği yeniden doğrulanarak katalog kontrol edilir. Profil formu, tarif ve alternatif seçimi ekranlarında içerik değişimi sonraki uygun ekrana ertelenir. Web sürümü değişirse uygun ekranlarda oturum başına bir kez yeniden yüklenir; diğer ekranlarda kaydı bitirdikten sonra kullanılabilecek yenileme uyarısı gösterilir. `version.json`, `updates.mjs` WEB_VERSION, uygulama ve stil sorgu sürümleri, sw.js CACHE/CORE birlikte yükseltilmelidir. Yeni tarif için uygulama sürümünü yükseltmek gerekmez.

Service worker altı saniyelik ağ denemesinden sonra kayıtlı içeriğe döner ve JSON yanıtlarını çevrimdışı olarak işaretler. Ulaşılamayan JSON/görsel için HTML döndürülmez. Günlük katalog bozuk/eksik geldiğinde çalışan katalog yerinde kalır; sayfanın ilk açılışında günlük dosya hiç okunamazsa ana katalog ve açıklayıcı uyarı gösterilir.

Doğrulama: 24 Node testi geçti; yeni tarif makroları kaynak kayıtlarından yeniden hesaplandı. Yerel tarayıcıda kurulum/güncellik ekranı, manuel kontrol, yeni tarif detayı ve test sunucusu kapalıyken sayfayı yeniden açma kontrol edildi; 461 tarif ile kayıtlı alışveriş listesi korundu. Fiziksel Android ana ekran kurulumu bu ortamda test edilmedi.

Günlük tarif görevi artık tatlıya öncelik vermez; ana yemek, kahvaltı, ara öğün, çorba/salata ve tatlı arasında çeşitlilik sağlar. Yerel görev için bilgisayar ve masaüstü uygulaması açık olmalıdır. Görevin etkin olması, kapalı bilgisayarda tarif üretileceği anlamına gelmez: https://learn.chatgpt.com/docs/automations?surface=app
