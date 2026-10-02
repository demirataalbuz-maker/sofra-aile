# Web menüsü — 2 Ekim 2026

Menüdeki yemek düğmesi tarifi, adımlarını ve seçilmiş porsiyonun malzemelerini açar. Menüme dön, mevcut planı korur. Tarif ekranındaki miktar değişikliği kaydedilmiş günlük planı değiştirmez.

Kalori hedefi profil üzerinden sabittir. Öğün değişimi diğer üç öğünü koruyarak farklı tariflerin porsiyonlarını dener. Toplam yalnızca hedefin %90–110 aralığında ise değişim kabul edilir. Uygun değişim bulunamazsa mevcut öğün korunur. Makro modunda öncelikli makro %90–110 aralığında, diğerleri kendi hedeflerinin %110 üst sınırının altında kalmalıdır; kalori tamamlamak için diğer makrolar yükseltilmez. Eski kayıtlı menü sınır dışındaysa uyarı gösterilir; hedef sessizce değiştirilmez. Kalori ve makro toplamları her çizimde seçili tarif/porsiyonlardan yeniden hesaplanır.

Yaş alanındaki 19 alt sınırı 18 olarak düzeltildi; tam sayı 18–85 kabul edilir. Mevcut tahmin yaş, boy, mevcut kilo, biyolojik cinsiyet, aktivite ve kilo verme/koruma/alma tercihinden hesaplanır. Elle kalori hedefi yazıldıysa önerilen değerin yerini alır. Hedef kilo, bu sürümde seçilmiş hedef olarak gösterilir; hedef kiloya ulaşma süresi veya dinamik metabolizma modeli hesaplanmaz.

Formül kaynağı: [Endotext, Mifflin–St Jeor](https://www.ncbi.nlm.nih.gov/sites/books/NBK278991/table/diet-treatment-obes.table12est/?report=objectonly). Yaş kapsamı için yetişkin planlayıcı örneği: [NIDDK, 18 yaş ve üzeri](https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner). Sofra'nın algoritması NIDDK'nin dinamik modeli değildir. Aktivite açıklamaları yaklaşık günlük yaşam örnekleridir; ölçülmüş harcama veya kesin egzersiz eşiği iddiası taşımaz.

Mevsim desteği, Türkiye için genel sebze önceliğidir; tüm ürünleri kapsayan bölgesel hasat takvimi değildir. Kaynak: [CarrefourSA, Mevsim Sebzeleri](https://www.carrefoursa.com/blog/mevsim-sebzeleri/), 2 Ekim 2026 tarihinde kontrol edildi. Yalnızca sebze/mevsim listeleri kullanıldı, yazıdaki sağlık iddiaları aktarılmadı. 40 g altındaki garnitür miktarları mevsim önceliği kazandırmaz. Protein kaynakları, tahıllar ve kaynakta eşlenmeyen malzemeler tarafsızdır. Mevsim, hedef/alerjen sınırları sağlandıktan sonra tercih puanını etkiler; sezon dışındaki tarifler yasaklanmaz. Kullanıcı otomatik mevsimi, başka mevsimi veya önceliği kapatmayı seçebilir. Otomatik mevsim Türkiye saatine göre hesaplanır.

Doğrulama: 14 Node testi; 40 ardışık kalori değişimi, makro sınırları, olanaksız değişimde koruma, yaş 18/17 sınırı, profil girdilerinin tahmine etkisi, alerjen ve tekrar engelleme, mevsim tercihi ve kapanması. Yerel tarayıcıda telefon boyutunda 18 yaş/1700 kcal profili kaydedildi; menü → tarif → menü geçişi, porsiyon hesabı, canlı toplam değişimi ve aktivite açıklaması kontrol edildi. JavaScript hatası görülmedi. Fiziksel iPhone/Safari testi yapılmadı.

## Fotoğraflı alternatifler ve öğün saatleri — web v7

Değiştir ekranı, tek yemek veya iki yemeklik kombin için en fazla 8 fotoğraflı seçenek gösterir. Her seçenekte porsiyonlar, öğünün makroları ve seçimden sonraki günlük toplam görünür. Kaydetmeden önce gün/profil/plan ve hedef-alerjen sınırları yeniden doğrulanır. Hesap daima sabit günlük hedeften kalan payı kullanır; tolerans değişim başına katlanmaz. Kombin aynı öğünde yenilen iki yemektir; her tarifin yapılışı ayrı açılır, iki tarif de alışverişe ve öneri geçmişine katılır. Eski tek tarifli kayıtlar desteklenir.

Menü 3 ana öğün + 1 ara öğünden oluşur. Varsayılan gösterim saatleri 08.00 kahvaltı, 13.00 öğle, 16.00 ara öğün, 19.00 akşamdır. Saatler kullanıcının rutinine göre ayrı kaydedilir; menü ve hedef değiştirilmeden kronolojik sıralanır. Porsiyonun öğün tekrarı olmadığı açıklanır. Bu saatler bilimsel olarak zorunlu bir beslenme aralığı iddiası taşımaz.

Web/iOS sürümünde push aboneliği veya sunucudan bildirim gönderimi yoktur; saat formu bildirim etkinleştirmez. iOS 16.4 ve üzeri ana ekrana eklenmiş web uygulamalarında, kullanıcı etkileşimiyle izin ve sunucudan Web Push kurulumu mümkündür: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

Doğrulama: 19 Node testi geçti. Yeni testler kombinlerin makrolarını, tüm parçalarının alerjen kontrolünü, kayıttan geri yüklemeyi, 40 karışık tek/kombin değişiminde sabit sınırları, başka öğüne kalan kalori aktarımını ve saat sıralamasını kapsar. Yerel tarayıcıda 390×844 görünümde tek seçim, kombin seçimi, kombin tarifini açma, saat değiştirme, sayfa yenilemede koruma ve malzemeleri alışverişe ekleme denendi; JavaScript hatası görülmedi. Fiziksel iPhone/Safari denenmedi. Bu yayın Android APK güncellemesi değildir.
