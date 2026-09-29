# Sofra Aile

Giriş istemeyen, telefon için bağımsız Sofra web uygulaması. 458 tarifi ve fotoğraflı hazırlık adımlarını gösterir. Tarif arama, kişi sayısı, pişirme yöntemi, örnek günlük menü ve alışveriş listesi içerir. Liste ve menü sadece cihazın tarayıcı depolamasında saklanır; sunucuya gönderilmez. İçerik ilk açılıştan sonra çevrimdışı kullanılabilir; henüz açılmamış fotoğraflar çevrimdışı görünmeyebilir. ChatGPT veya başka bir giriş gerekmez.

Yayın: https://demirataalbuz-maker.github.io/sofra-aile/

İPhone kurulumu: Safari ile URL'yi açın → Paylaş → Ana Ekrana Ekle → Web Uygulaması Olarak Aç. Android'de Chrome → menü → Ana ekrana ekle.

Bu sürüm Android uygulamasının tüm kişisel planlama özelliklerini içermez. Günlük menü örnektir; alerji veya kişisel hedefe göre güvenli öneri sayılmaz. Mevcut katalogdaki yaklaşık besin değerleri gösterilir.

Görsel kaynakları için kaynaklar.html ve photo-credits.json dosyalarına bakın. Lisanslı fotoğrafların özgün dosyaları korunmuştur; diğer görseller web için optimize edilmiştir.

## Tarif güncelleme

Yeni Android test APK'sı GitHub Releases'a yayımlandığında `.github/workflows/sync-catalog.yml` en geç bir sonraki 6 saatlik çalışmada tarif ve görselleri otomatik aktarır. `workflow_dispatch` ile hemen başlatılabilir. APK boyutu ve SHA-256 özeti doğrulanır; yeni kaynak bilgisi bulunmayan lisanslı görsel otomatik yayımlanmaz. Web uygulamasının kod veya tasarım değişiklikleri bu akıştan bağımsız olarak ayrıca yayımlanır.
