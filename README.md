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
