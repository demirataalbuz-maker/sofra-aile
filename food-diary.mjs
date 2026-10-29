const keys=['kcal','protein','carbs','fat'];
export const normalizeFood=value=>String(value||'').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
export function parseFoodQuery(value){
 const m=String(value).match(/^\s*(\d+(?:[.,]\d+)?)\s*(gram|gr|g|adet|tane)?\s+/i);
 const text=normalizeFood(m?String(value).slice(m[0].length):value).replace(/\b(yedim|ictim|tane)\b/g,'').trim();
 return {query:text,amount:m?Number(m[1].replace(',','.')):null,unit:m&&/^(g|gr|gram)$/i.test(m[2]||'')?'g':null};
}
export function diaryFoods(catalog){
 // Generic regional reference, distinct from unverified brandless catalog sucuk.
 const foods=Object.entries(catalog.ingredients).filter(([,i])=>i.nutrition?.verification==='source-checked'&&keys.every(k=>Number.isFinite(i.nutrition[k]))).map(([id,i])=>({id:'ingredient:'+id,title:i.name,macros:Object.fromEntries(keys.map(k=>[k,i.nutrition[k]])),basis:100,unit:'g',piece:i.unit==='adet'?i.gramsPerUnit:null,source:i.nutrition.source,sourceUrl:i.nutrition.sourceUrl,note:i.note||'Malzemenin çiğ/kuru/pişmiş durumunu adına göre seç; pişirme yağı ve sosu ayrıca kaydet.'}));
 foods.unshift({id:'food:pear',title:'Armut (çiğ, kabuklu, çekirdeksiz)',macros:{kcal:57,protein:.36,carbs:15.23,fat:.14},basis:100,unit:'g',piece:178,source:'USDA SR 09252 · FDC 169118',sourceUrl:'https://www.ars.usda.gov/ARSUserFiles/80400535/Data/SR/SR28/reports/sr28fg09.pdf',note:'1 orta armut ≈ 178 g yenilebilir kısım; boyut değişir. En doğru porsiyon için sap ve çekirdek çıkarılmış kısmı tart.'});
 foods.unshift({id:'food:sucuk',title:'Sucuk (Erzurum, TürKomp referansı)',macros:{kcal:454,protein:23.75,carbs:2.17,fat:38.52},basis:100,unit:'g',piece:null,source:'TürKomp · 12.02.0066',sourceUrl:'https://turkomp.tarimorman.gov.tr/food-sucuk-erzurum-479',note:'Bölgesel ortalama referans; her marka ve sucuk için aynı değildir. Gramla tart; ilave yağı ayrıca kaydet. Ambalajdaki alerjen ve besin bilgilerini kontrol et.'});
 for(const food of foods)if(food.id==='ingredient:egg')food.title+=' · çiğ';
 foods.unshift({id:'food:boiled-egg',title:'Haşlanmış yumurta (kabuksuz)',macros:{kcal:155,protein:12.58,carbs:1.12,fat:10.61},basis:100,unit:'g',piece:50,source:'USDA SR · 01129 / FDC 173424',sourceUrl:'https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/reports/sr28fg01.pdf',note:'1 büyük yumurta ≈ 50 g yenilebilir kısım. Haşlanmış, yağ eklenmemiş; farklı boyutta gramla tart.'});
 return [...foods,...catalog.recipes.map(r=>({id:'recipe:'+r.id,recipeId:r.id,title:r.title,image:r.image,macros:r.macros,basis:1,unit:'porsiyon',piece:null,source:'Sofra tarifi · yaklaşık porsiyon hesabı',note:'Yalnızca bu tarifteki malzemeler ve porsiyon için geçerlidir; farklı ev/restoran tarifi aynı değerde olmayabilir.'}))];
}
export function foodIcon(food){const t=normalizeFood(food.title);return /armut/.test(t)?'🍐':/elma/.test(t)?'🍎':/muz/.test(t)?'🍌':/yumurta/.test(t)?'🥚':/sut|yogurt|peynir/.test(t)?'🥛':/ekmek/.test(t)?'🍞':/tavuk|hindi/.test(t)?'🍗':/balik|somon|ton /.test(t)?'🐟':/pirinc|bulgur|yulaf/.test(t)?'🌾':/domates/.test(t)?'🍅':/cilek/.test(t)?'🍓':'🍽️'}
export function searchFoods(foods,query,limit=25){
 const parsed=parseFoodQuery(query),words=parsed.query.split(' ').filter(Boolean);
 return foods.filter(f=>words.every(w=>normalizeFood(f.title).includes(w))).sort((a,b)=>(normalizeFood(a.title).startsWith(parsed.query)?0:1)-(normalizeFood(b.title).startsWith(parsed.query)?0:1)).slice(0,limit);
}
export function foodAmount(food,amount,unit){
 if(!Number.isFinite(+amount)||+amount<=0||+amount>10000)throw Error('Geçerli bir miktar gir.');
 if(unit!=='g'&&unit!=='adet'&&unit!=='porsiyon')throw Error('Geçersiz birim.');
 if(food.unit==='porsiyon'&&unit!=='porsiyon'||food.unit==='g'&&unit==='porsiyon'||unit==='adet'&&!food.piece)throw Error('Bu yiyecek için bu birim kullanılamaz.');
 const factor=+amount*(unit==='adet'?food.piece:1)/food.basis;
 return Object.fromEntries(keys.map(k=>[k,food.macros[k]*factor]));
}
export function frequentFoods(entries){
 const groups=new Map();
 for(const e of entries.filter(e=>e.kind==='food'&&!e.deleted&&e.macros)){
  const key=e.title+'|'+JSON.stringify(e.macros)+'|'+e.portion;
  const old=groups.get(key);groups.set(key,{...e,count:(old?.count||0)+1,at:old&&old.at>e.at?old.at:e.at});
 }
 return [...groups.values()].sort((a,b)=>b.count-a.count||b.at.localeCompare(a.at)).slice(0,8);
}
