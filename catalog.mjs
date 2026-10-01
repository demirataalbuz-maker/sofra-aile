// Daily additions are separate from the Android snapshot, which sync may replace.
export function mergeCatalog(base,extra={recipes:[],ingredients:{}}){
  if(!Array.isArray(base?.recipes)||!base.recipes.length||!base.ingredients)throw Error('Tarif listesi eksik');
  if(!Array.isArray(extra?.recipes)||!extra.ingredients||typeof extra.ingredients!=='object')throw Error('Günlük tarif dosyası geçersiz');
  const ingredients={...extra.ingredients,...base.ingredients};
  const seen=new Set();
  for(const r of extra.recipes){
    if(!r?.id||seen.has(r.id)||!r.title||!r.category||!r.image||!r.image.startsWith('images/')||r.image.includes('..'))throw Error('Günlük tarif kimliği veya görseli geçersiz');
    seen.add(r.id);
    if(!(r.servings>0)||!(r.minutes>0)||!Array.isArray(r.steps)||!r.steps.length||!Array.isArray(r.allergens))throw Error('Günlük tarif açıklaması eksik');
    if(!Array.isArray(r.items)||!r.items.length||r.items.some(([id,n])=>!ingredients[id]||!Number.isFinite(n)||n<=0))throw Error('Günlük tarif malzemesi geçersiz');
    for(const key of ['kcal','protein','carbs','fat'])if(!Number.isFinite(r.macros?.[key])||r.macros[key]<0)throw Error('Günlük tarif besin değeri eksik');
  }
  const baseIds=new Set(base.recipes.map(r=>r.id));
  return {...base,ingredients,recipes:[...extra.recipes.filter(r=>!baseIds.has(r.id)),...base.recipes]};
}
