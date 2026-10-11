// Estimates based on the written method, not a promise about a cook's skill.
// Editorial difficulty (easy/medium/hard) can override the inference per recipe.
export const DIFFICULTIES={easy:'Kolay',medium:'Orta',hard:'Uğraştırıcı'};
export const COOKING_STYLES={easy:'Kolay olsun',mixed:'Karışık olsun',any:'Uğraşabilirim'};
const cache=new WeakMap();
export function cookingInfo(r){
 if(!r)return {difficulty:'medium',minutes:null,quick:false,practical:false};
 if(cache.has(r))return cache.get(r);
 const text=(r.steps||[]).join(' ').toLocaleLowerCase('tr-TR');
 const technical=/yufka aç|hamuru.{0,60}(ince aç|merdane|oklava)|yaprakları.{0,80}sar|yaprağın.{0,80}sar|içlerini.{0,60}doldur|(?:biber|kabak|patlıcan).{0,100}doldur|karamel|benmari|beze kıvam|yumurta aklarını.{0,30}(köpür|çırp)/u.test(text);
 const shaping=/yoğur|şekil ver|köfte|harç|mayalan|mühürle|pane|terbiye|yufka|pankek|krep|azar azar.{0,25}(süt|un)/u.test(text);
 const count=(r.steps||[]).length,tools=new Set(r.equipment||[]).size;
 const difficulty=DIFFICULTIES[r.difficulty]?r.difficulty:technical?'hard':shaping||count>=7||tools>=3?'medium':'easy';
 const minutes=Number.isFinite(+r.minutes)&&+r.minutes>0?+r.minutes:null;
 const info={difficulty,minutes,quick:minutes!==null&&minutes<=20,practical:difficulty==='easy'&&count<=5&&tools<=1};
 cache.set(r,info);return info;
}
export function cookingPreferences(value={}){
 return {style:COOKING_STYLES[value?.style]?value.style:'mixed',maxMinutes:[20,30,45,60].includes(+value?.maxMinutes)?+value.maxMinutes:0};
}
export function cookingAllowed(r,preference){
 if(!preference)return true;
 const p=cookingPreferences(preference),info=cookingInfo(r);
 return !!r&&(p.style!=='easy'||info.difficulty==='easy')&&(!p.maxMinutes||(info.minutes!==null&&info.minutes<=p.maxMinutes));
}
// Each group is one meal's recipes. Combos conservatively add durations; no
// assumption that two dishes can cook simultaneously. Repeated family portions
// count once. Extra time for larger quantities is not claimed to be known.
export function cookingFits(groups,preference){
 if(!preference)return true;
 const p=cookingPreferences(preference),hard=new Set();
 for(const group of groups){
  const unique=[...new Map(group.map(r=>[r?.id,r])).values()];
  if(unique.some(r=>!cookingAllowed(r,p)))return false;
  if(p.maxMinutes&&unique.reduce((sum,r)=>sum+(cookingInfo(r).minutes??Infinity),0)>p.maxMinutes)return false;
  for(const r of unique)if(cookingInfo(r).difficulty==='hard')hard.add(r.id);
 }
 return p.style!=='mixed'||hard.size<=1;
}
export function cookingSummary(value){const p=cookingPreferences(value);return COOKING_STYLES[p.style]+' · '+(p.maxMinutes?'öğün başına en fazla '+p.maxMinutes+' dk':'süre sınırı yok');}
export function cookingLabel(r){const i=cookingInfo(r);return DIFFICULTIES[i.difficulty]+' (tahmini)'+(i.quick?' · Hızlı':'')+(i.practical?' · Pratik':'');}
export function cookingFields(value){
 const p=cookingPreferences(value);
 return `<div class="cookingchoices"><label>Bugün nasıl pişirelim?<select name="cookingStyle">${Object.entries(COOKING_STYLES).map(([id,label])=>`<option value="${id}" ${p.style===id?'selected':''}>${label}</option>`).join('')}</select></label><label>Her öğün için toplam süre<select name="cookingMinutes">${[[0,'Süre sınırım yok'],[20,'En fazla 20 dakika'],[30,'En fazla 30 dakika'],[45,'En fazla 45 dakika'],[60,'En fazla 60 dakika']].map(([n,label])=>`<option value="${n}" ${p.maxMinutes===n?'selected':''}>${label}</option>`).join('')}</select></label></div><p class="hint">Kolay: temel işlemler. Karışık: ağırlıkla kolay/orta, uygun olduğunda günde en fazla bir uğraştırıcı tarif. Uğraşabilirim: tüm zorluklar açık.</p><p class="hint">Süreler tarifteki yaklaşık toplam süredir; yalnızca başında duracağın süre değildir. İkili yemeklerde süreleri toplarız. Aile için miktar arttığında daha uzun sürebilir.</p>`;
}
