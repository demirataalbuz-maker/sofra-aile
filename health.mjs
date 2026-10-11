export const HEALTH_OPTIONS={hypertension:'Yüksek tansiyon / sodyum kısıtı',diabetes:'Diyabet / kan şekeri yönetimi',kidney:'Böbrek hastalığı',other:'Başka bir hastalık veya özel beslenme / sıvı kısıtı',pregnancy:'Gebelik veya emzirme'};
export function planningBlock(profile){
  if(!Array.isArray(profile?.healthConditions)||!profile.healthConditions.length)return '';
  return profile.healthConditions.includes('hypertension')
    ? 'Tansiyon için sodyumu güvenilir biçimde hesaplayamıyoruz. Bu profil için otomatik menü kapalı; hekim veya diyetisyenin belirlediği planı takip et. Tarifleri inceleyebilir, yediklerini ve suyunu kaydedebilirsin.'
    : 'Bu sağlık durumu için kişisel beslenme gereksinimlerini doğrulayamıyoruz. Bu profil için otomatik menü kapalı; hekim veya diyetisyenin belirlediği planı takip et. Tarifleri inceleyebilir ve günlük kayıt tutabilirsin.';
}
