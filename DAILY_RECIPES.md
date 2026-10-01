# Günlük tarif ekleme

Her çalışmada Türkiye tarihine göre en fazla bir yeni tarif ekle. Sporcu tatlılarına öncelik ver; kahvaltı, ara öğün ve ana yemeklerle çeşitlendir. Katalogdaki tarifin yalnızca adını değiştirerek tekrar ekleme.

`catalog.json` Android yayınından gelen ana katalogdur. Günlük tarifleri `daily-catalog.json` içindeki `recipes` dizisinin başına ekle. Yeni malzemeler gerekiyorsa aynı dosyanın `ingredients` alanına benzersiz kimliklerle ekle; ana katalogdaki malzemeleri değiştirme. Uygulama iki dosyayı birleştirir. Android APK güncellemesi bu işlemden ayrı yürür.

Her günlük tarifte `addedOn` alanını `YYYY-MM-DD` Türkiye tarihi olarak kaydet. Aynı gün için zaten tarif varsa yeniden ekleme; yerelde hazırlanmış ancak henüz yayımlanmamış tarif varsa onu tamamla. Kaçırılan günler için toplu tarif üretme.

Tarif; benzersiz `daily-` önekli kimlik, Türkçe başlık ve açıklama, mevcut kategori, kişi sayısı, süre, ölçülü malzemeler, ekipman, anlaşılır hazırlık adımları, kapak görseli ve alerjenleri içermeli. Makroları porsiyon başına hesapla: her malzemenin miktarı × `gramsPerUnit` × `nutrition` içindeki 100 g değeri / 100; toplamı kişi sayısına böl. Kaynaklı mevcut malzeme verisini kullan; yeni besin değeri gerekiyorsa güvenilir kaynakla doğrula ve kaynak bilgisini kaydet. Hesaplayamadığın değerleri uydurma. Şeker verisi yoksa ekleme. Kan grubuna göre besin uygunluğu veya tıbbi vaat üretme.

Kapak için tarifi doğru temsil eden özgün ya da açık lisansı doğrulanmış görsel kullan. Mevcut görsel ancak yemeği doğru temsil ediyorsa kullanılabilir. Fotoğrafın gerektiğinde temsili olduğu açık olmalı. Lisanslı görsellerin atıflarını `photo-credits.json` ve gerekiyorsa `kaynaklar.html` içinde tamamla. Hazırlık görsellerini yalnızca ilgili işlemi doğru gösteriyorsa eşleştir; ilgisiz görsel yerleştirme.

Değişiklikten önce Git durumunu kontrol et, başkasının tamamlanmamış çalışmasını dahil etme. `node --test tests/*.test.mjs` çalıştır. Malzeme birimlerini, porsiyon hesabını, alerjenleri, görsel dosyalarını, tarif adımlarını ve yeni tarifin açılmasını kontrol et. Yalnızca ilgili dosyaları commit edip mevcut `origin/main` üzerinden GitHub Pages'a yayımla. Gerekmedikçe uygulama kodunu değiştirme ve APK oluşturma. Yayın işinin başarısını ve canlı `daily-catalog.json` dosyasında tarifin bulunduğunu doğrula; yayın başarısızsa yeni bir tarif üretmek yerine mevcut eklemeyi kurtar.

Canlı web sürümü: https://demirataalbuz-maker.github.io/sofra-aile/
