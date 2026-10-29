const fields='code,product_name,brands,nutriments,nutrition_data_per,allergens_tags,traces_tags';
export function externalProduct(p){
 if(!p||!/^\d{8,14}$/.test(String(p.code))||!p.product_name)return null;
 const n=p.nutriments||{},raw={'kcal':n['energy-kcal_100g'],protein:n.proteins_100g,carbs:n.carbohydrates_100g,fat:n.fat_100g};
 if(Object.values(raw).some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0)||raw.kcal>1000||['protein','carbs','fat'].some(k=>raw[k]>100))return null;
 // Per-100ml labels must not silently be counted as grams.
 if(p.nutrition_data_per!=='100g')return null;
 return {id:'off:'+p.code,title:String(p.product_name).slice(0,160)+(p.brands?' · '+String(p.brands).slice(0,80):''),macros:raw,basis:100,unit:'g',piece:null,source:'Open Food Facts · topluluk ürün etiketi (ODbL)',sourceUrl:'https://world.openfoodfacts.org/product/'+p.code,note:'Paketli ürünün 100 g etiket verisi; doğruluğunu kendi ambalajından kontrol et. Alerji uygunluğu onaylanmış değildir. Alerjen/iz kayıtları: '+[...(p.allergens_tags||[]),...(p.traces_tags||[])].join(', ').slice(0,300)};
}
const cache=new Map();let lastRequest=0;
export async function findExternalFood(query,{fetcher=fetch,now=Date.now()}={}){
 const q=String(query||'').trim();if(q.length<3||q.length>100)throw Error('3–100 karakterlik ürün adı veya barkod gir.');
 if(cache.has(q))return cache.get(q);
 if(now-lastRequest<6500)throw Error('Yeni arama için birkaç saniye bekle.');lastRequest=now;
 const barcode=/^\d{8,14}$/.test(q);
 const url=barcode?'https://world.openfoodfacts.org/api/v3/product/'+q+'?fields='+fields:'https://world.openfoodfacts.org/cgi/search.pl?search_terms='+encodeURIComponent(q)+'&search_simple=1&action=process&json=1&page_size=20&fields='+fields;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const r=await fetcher(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw Error('Ürün kaynağına ulaşılamadı. Biraz sonra tekrar dene.');const data=await r.json();const list=(barcode?[data.product]:data.products||[]).map(externalProduct).filter(Boolean);cache.set(q,list);return list}finally{clearTimeout(timer)}
}
export function missingFoodLink(title,details){
 const name=String(title||'').trim(),note=String(details||'').trim();if(name.length<2||name.length>100||note.length>800)throw Error('Besin adı 2–100, açıklama en fazla 800 karakter olmalı.');
 const body='Eksik besin önerisi\n\nBesin/marka: '+name+'\n\nÜrün bilgisi (kullanıcının yazdığı, doğrulanmadı):\n'+note+'\n\nİnceleme: Kaynak ve porsiyon doğrulanmadan kataloğa eklemeyin. Kişisel sağlık bilgisi içeriyorsa kaldırın.';
 return 'https://github.com/demirataalbuz-maker/sofra-private/issues/new?title='+encodeURIComponent('Besin önerisi: '+name)+'&body='+encodeURIComponent(body);
}
