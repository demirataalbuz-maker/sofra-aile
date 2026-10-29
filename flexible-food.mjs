import {allowed,estimate,profileError} from './planner.mjs?v=21';
import {planningBlock} from './health.mjs?v=11';
export function flexibleOptions(catalog,profile,summary,kind){
 if(!profile||profileError(profile))throw Error('Öneri için önce profilini ve hedefini tamamla.');
 if(planningBlock(profile))throw Error(planningBlock(profile));
 if(summary.unknownCount)throw Error('Besin değeri bilinmeyen kaydın var; kalan pay hesaplanamıyor. Önce bu kaydı tamamla.');
 const remaining=estimate(profile).target-summary.totals.kcal;
 const categories=kind==='sweet'?['Tatlı']:kind==='snack'?['Ara öğün']:['Ana yemek','Tavuk','Et','Balık','Hindi','Vejetaryen','Bakliyat','Sebze','Çorba','Salata'];
 const budget=Math.min(remaining,estimate(profile).target*(kind==='sweet'||kind==='snack'?.15:.35));
 return catalog.recipes.filter(r=>categories.includes(r.category)&&allowed(r,catalog.ingredients,profile.allergies||[])).flatMap(r=>[.5,.75,1,1.25,1.5].filter(portion=>r.macros.kcal*portion<=budget&&r.macros.kcal*portion>=80&&(! (profile.mode==='macro')||['protein','carbs','fat'].every(k=>summary.totals[k]+r.macros[k]*portion<=+profile[k]*1.1))).map(portion=>({r,portion,score:Math.abs(r.macros.kcal*portion-budget)+Math.max(0,20-r.macros.protein*portion)*2}))).sort((a,b)=>a.score-b.score).filter((x,i,a)=>a.findIndex(y=>y.r.id===x.r.id)===i).slice(0,6);
}
