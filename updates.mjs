import {mergeCatalog} from './catalog.mjs?v=5';
export const WEB_VERSION='8';
export function newerVersion(metadata,current=WEB_VERSION){
  return typeof metadata?.version==='string'&&/^\d+$/.test(metadata.version)&&Number.isSafeInteger(+metadata.version)&&+metadata.version>+current;
}

export async function readJson(url,fetcher=fetch){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetcher(url,{cache:'no-cache',signal:controller.signal});
    if(!response.ok)throw Error('Güncel içerik alınamadı.');
    return {data:await response.json(),cached:response.headers.get('X-Sofra-Offline')==='1'};
  }finally{clearTimeout(timer)}
}
// Read both files before replacing the working catalog; partial updates must not
// make previously published daily recipes disappear.
export async function readCatalog(fetcher=fetch){
  const [base,daily]=await Promise.all([readJson('./catalog.json',fetcher),readJson('./daily-catalog.json',fetcher)]);
  return {catalog:mergeCatalog(base.data,daily.data),cached:base.cached||daily.cached};
}
export function latestRecipeDate(recipes){
  return recipes.map(r=>r.addedOn).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')).sort().at(-1)||'';
}
export const canRefreshPage=page=>['explore','plan','basket','application'].includes(page);
