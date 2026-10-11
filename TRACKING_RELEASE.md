# Web 9 — günlük takip

12 Ekim 2026

## Kullanılabilen özellikler

- Alt menüde **Takip**: +250/+500 ml ve özel miktarda su, kullanıcı tarafından belirlenen hedef, kayıt geri alma.
- Gün seçimi; önceki günlerin kayıtları ve o gün saklanan hedefler. Sonradan değişen hedefler geçmişe uygulanmaz.
- **Bugün → Yedim**: her yemeğin gerçek porsiyonunu ayrı kaydet. Komboda yenmeyen parça için sıfır yazılabilir.
- Katalogdan yemek veya dışarıda yenilen yemek ekleme. Bilinmeyen değerler toplamdan ayrı gösterilir; şeker alanı eklenmedi.
- Günlük kalori/protein/karbonhidrat/yağ toplamı, gün tamamlandı işareti, kilo ölçümü, günlük JSON indirme.
- Telefonun yerel verileri ve mevcut profili korunur. Tarayıcı verileri silinirse bu kayıtlar da silinir.

## Henüz aktif olmayan özellikler

Firebase girişi kullanıcı isteğiyle sona bırakıldı. `cloud-config.json` bu nedenle kapalı. **Hesap** ekranı bunu açıkça gösterir ve kullanılamayan denetimleri kapatır.

Hesap, eşitleme, sunucuda otomatik menü, kapalı PWA'ya bildirim, özel GitHub'a aktarım ve rapor ekranı için kod hazırlıkları var. Canlı sunucu, fiziksel iPhone/Android bildirim testi ve rapor onayı denetimi tamamlanmadı; rapor otomasyonu henüz kurulmadı. Bu sürümün yayımlanması bildirimleri etkinleştirmez.

## Doğrulama

`node --test tests/*.test.mjs`

Tarayıcıda ayrı bir localhost test profiliyle su ekle/geri al, yenilemede kalıcılık, bilinmeyen besin değeri, yarım ve 0,75 porsiyon hesabı, menüden kayıt ve kapalı hesap ekranı denendi. Küçük ekran yatay taşması kontrol edildi. Canlı kullanıcı kayıtları testte kullanılmadı.
