# Porsiva (önceki adı Sofra)

## Aile menüsü — web 10

- Alt menüde **Aile**: bu cihazda 2–6 yetişkin için ayrı profil, katılım seçimi, düzenleme ve kaldırmayı geri alma.
- Aynı dört öğün tarifi; kişiye göre 0,5–2 porsiyon ve gerektiğinde akşam yan yemeği. Her kişinin kalori hedefi veya öncelikli makrosu ayrı ±%10 kontrol edilir; diğer makrolar üst sınırdır. Ortak mutfakta seçili üyelerin alerjenlerinin birleşimi tüm ana/yan yemeklerden dışlanır. Yalnızca kaynak kontrolü yapılmış malzemeli tarifler kullanılır.
- Arama sınırlıdır: sonuç bulunmaması matematiksel olarak imkânsızlık kanıtı değildir. Hedefler gevşetilmez; kullanıcı yeniden deneyebilir. Hesap bir Web Worker'da yapılır. Tarih, katılımcılar ve profil değişince önceki plan geçersizleşir.
- Tarif detayları, toplam aile malzeme listesi ve yalnızca menü içeren JSON dosyası paylaşımı. Dosyada ad/takma ad, yemek, saat ve porsiyon bulunur; profil, hedef, sağlık ve günlük verileri bulunmaz. Paylaşmadan önce açık onay kutusu gerekir. Gelen dosya yalnızca görüntülenir; profil veya günlük menüyü değiştirmez.
- **Gerçek aile hesapları / telefonlar arasında canlı eşitleme yoktur.** Aile bilgileri mevcut tek-kullanıcı bulut yüküne dahil edilmez. Her kişi için ayrı yemek/su günlüğü henüz eklenmedi; Takip bölümü cihazın kişisel profiline aittir.

## Sağlık sınırları

Profilde hipertansiyon/sodyum kısıtı, diyabet, böbrek hastalığı, diğer klinik beslenme/sıvı kısıtları ve gebelik/emzirme sorulur. Bunlardan biri seçilirse otomatik kişisel ve aile planı oluşturulmaz, gerekçesi açıklanır. Bu hastalığa uygun menü oluşturma özelliği değildir. Mevcut katalogdaki sodyum/potasyum verileri klinik bir değerlendirme için yeterli değildir. Tarif görüntüleme ve manuel günlük takibi açık kalır. Sıvı kısıtında hekim planı esas alınmalıdır.

Sağlık verisi temeli: https://www.who.int/news-room/fact-sheets/detail/sodium-reduction ve https://www.who.int/en/news-room/fact-sheets/detail/healthy-diet . Bu kaynaklardan hasta için bireysel tedavi hedefi türetilmez.

Akıllı tartı/sağlık cihazları eşitlemesi kullanıcı kararıyla ertelendi. Bu sürüm Xiaomi, Apple Health veya Health Connect ile bağlanmaz. Sunucu da kapalı kalır; gelecekte etkinleştirilmeden önce yeni sağlık kısıtları sunucu planlayıcısı ve doğrulamasına taşınmalıdır.

Porsiva görünür adı, manifest ve P simgesi güncellendi; site URL'si, manifest kimliği ve mevcut yerel kayıt anahtarı korundu. Böylece mevcut profil/günlükler marka değişikliği nedeniyle sıfırlanmaz. Mevcut ana ekran simgesinin adını güncellemesi telefonun davranışına bağlıdır.

Doğrulama: `node --test tests/*.test.mjs`. Aile sınırları, makro önceliği, alerjenler, klinik durum engeli, yan yemek, paylaşımda veri azaltma, geçersiz dosya ve gerçek katalogla üç kişi testi eklenmiştir. Yerel tarayıcıda ayrı hedefli profiller, yeniden açmada koruma, tarif detayı, sağlık kısıtı, menü dosyası indirme/açma ve 390 px görünüm kontrol edildi. Fiziksel telefon test edilmedi.

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
## Menüye özel süre ve zorluk (web 11)

İlk kişisel menü ve **Yeni menü** isteği, profil ekranından ayrı bir seçim ekranı açar: Kolay olsun / Karışık olsun / Uğraşabilirim; öğün başına 20, 30, 45, 60 dakika veya sınırsız. Aile menüsü aynı soruları oluşturma düğmesinin üzerinde sorar. Seçim yeni menü başarıyla kaydedilene kadar mevcut menüyü değiştirmez. Kişisel ve aile seçimleri birbirinden bağımsızdır; menüyle cihazda saklanır. Eski menüler korunur ve henüz tercih uygulanmadığı belirtilir. Profilden veya sadece Bugün ekranına girmekten sessizce yeni menü üretilmez.

Zorluk `cooking.mjs` içinde yazılı adımlar, teknik ve ekipman sayısından tahmin edilir ve arayüzde **tahmini** olarak gösterilir. Ana Android kataloğu değiştirilmez. Editör `difficulty: easy | medium | hard` ile tek tarifi düzeltebilir; yeni günlük tarifler de otomatik sınıflanır. Hızlı: toplam katalog süresi en fazla 20 dakika. Pratik: kolay, en fazla 5 adım ve en fazla 1 pişirme ekipmanı. Uzun bekleme/fırın süresi tek başına zor sayılmaz. Doğrulanmamış aktif hazırlık/pişirme süreleri üretilmez; katalogdaki toplam süre kullanılır.

Kolay seçimi yalnızca kolay tarifleri kullanır. Karışık seçimde günlük en fazla bir farklı uğraştırıcı tarif bulunabilir; kişisel planda zaman zaman böyle bir tarife sıralama önceliği verilir, bulunması zorunlu değildir. Uğraşabilirim tüm zorlukları açar. Tüm modlarda kalori/makro, alerji, sağlık ve doğrulanmış aile besin verisi kontrolleri korunur. Tekli/ikili öğün değişimleri de kayıtlı menünün tercihine göre doğrulanır. Süre sınırı bir öğünün farklı yemek süreleri toplamına uygulanır; aynı aile yemeğinin farklı porsiyonları süreyi tekrar saydırmaz. Ailede farklı kişilere eklenen farklı yan yemekler toplam süreye dahildir. Büyük miktarların süreyi uzatabileceği kullanıcıya açıklanır; eşzamanlı pişirme varsayılmaz.

Uygun menü bulunamadığında sınırlar kendiliğinden genişletilmez ve önceki menü korunur. Sunucu ertelendiği için bu özellik tarayıcıdaki planlayıcılarda çalışır; gelecekte sunucu planlayıcısına da taşınmalıdır.


## Web 12 — su önerisi ve Instagram bağlantı kutusu
- Takip bölümünde yeni profillerin su hedefi otomatik öneridir. BDA / EFSA yetişkin içecek referansı (kadın 1600 ml, erkek 2000 ml), isteğe bağlı diğer alkolsüz içecek payı düşülerek içme suyu planına çevrilir. Kilo/egzersiz çarpanı kullanılmaz; kişisel tıbbi gereksinim hesabı değildir.
- 18–85 yaş dışı/eksik profilde veya seçili sağlık kısıtında otomatik öneri yoktur. Geçmiş hedefler günün snapshot kaydından okunur. Eski elle girilmiş hedefler korunur; Otomatik öneriyi kullan düğmesiyle geçilir.
- Kaynak: https://www.bda.uk.com/static/ae2e9a5c-81b2-4507-81457ba68e72ffbf/BDAFluid-and-hydrationFINAL-0325-003.pdf
- Uygulama → Instagram’dan tarif gönder: gönderi bağlantısını doğrular, takip parametrelerini kaldırır, mevcut özel GitHub issue formunu önceden dolduran bağlantı hazırlar. Kullanıcı GitHub'da son gönderimi yapar; depo erişimi gerekir. Profil/günlük verisi bu bağlantıya katılmaz.
- DM alma, webhook, otomatik video analizi, yeni sunucu veya ücretli API kurulmadı. Form başarısı yalnızca bağlantının hazırlandığını belirtir; issue açıldığını varsaymaz.
- Sunucu kapalı kalır. Açılmadan önce yeni waterMode/otherDrinks ayarları ve çözümlenmiş hedefler sunucu doğrulamasına, zamanlayıcısına ve raporlarına taşınmalıdır.
