// BDA Fluid and hydration (2025), using EFSA adult drink reference values.
export const WATER_SOURCE='https://www.bda.uk.com/static/ae2e9a5c-81b2-4507-81457ba68e72ffbf/BDAFluid-and-hydrationFINAL-0325-003.pdf';
export function waterSettings(input={}){
 const valid=Number.isFinite(input?.waterGoal)&&input.waterGoal>=250&&input.waterGoal<=6000;
 return {waterDefaultsVersion:input?.waterDefaultsVersion===13?13:0,waterGoal:valid?input.waterGoal:null,waterMode:input?.waterMode==='auto'?'auto':input?.waterMode==='manual'||valid?'manual':'auto',otherDrinks:Number.isFinite(input?.otherDrinks)&&input.otherDrinks>=0&&input.otherDrinks<=4000?input.otherDrinks:0};
}
export function waterRecommendation(profile,otherDrinks=0){
 if(Array.isArray(profile?.healthConditions)&&profile.healthConditions.length)return {goal:null,reason:'Profilindeki sağlık veya özel beslenme durumu nedeniyle otomatik su önerisi kapalı. Hekiminin önerdiği sıvı planını kullan; toplam sıvı sınırı yalnızca içme suyu demek değildir.'};
 if(!profile||!Number.isInteger(+profile.age)||+profile.age<18||+profile.age>85||!['female','male'].includes(profile.sex))return {goal:null,reason:'Su önerisini görmek için Profil bölümünde yaşını ve hesaplama için biyolojik cinsiyetini tamamla. Bu araç 18–85 yaş yetişkin profilleri içindir.'};
 if(!Number.isFinite(otherDrinks)||otherDrinks<0||otherDrinks>4000)throw Error('Diğer içecekler için 0–4000 ml arasında bir miktar gir.');
 const drinks=profile.sex==='female'?1600:2000;
 return {goal:Math.max(0,drinks-otherDrinks),drinks,otherDrinks,total:profile.sex==='female'?2000:2500,reason:'',active:['moderate','high'].includes(profile.activity)};
}
export function resolvedWaterGoal(profile,tracking){const settings=waterSettings(tracking);return settings.waterMode==='manual'?settings.waterGoal:waterRecommendation(profile,settings.otherDrinks).goal}


// One-time upgrade: eligible profiles receive the system target without a button.
export function applyAutomaticWaterTarget(state){
 if(!state.profile||state.tracking?.waterDefaultsVersion===13)return false;
 const settings=waterSettings(state.tracking);
 if(waterRecommendation(state.profile,settings.otherDrinks).goal===null)return false;
 state.tracking={...state.tracking,...settings,waterMode:'auto',waterDefaultsVersion:13};
 return true;
}
