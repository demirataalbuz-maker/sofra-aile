import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {readCatalog,canRefreshPage,latestRecipeDate,newerVersion} from '../updates.mjs';
const base=JSON.parse(fs.readFileSync(new URL('../catalog.json',import.meta.url)));
const daily=JSON.parse(fs.readFileSync(new URL('../daily-catalog.json',import.meta.url)));
const response=(data,offline=false)=>new Response(JSON.stringify(data),{headers:offline?{'X-Sofra-Offline':'1'}:{}});

test('new daily recipes refresh without replacing profile state, request cache revalidation and mark offline fallback',async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{calls.push(options);return response(url.includes('daily-')?daily:base)};
 const fresh=await readCatalog(fetcher);assert.equal(fresh.cached,false);assert.equal(fresh.catalog.recipes.length,new Set([...base.recipes,...daily.recipes].map(r=>r.id)).size);
 assert.ok(calls.every(x=>x.cache==='no-cache'&&x.signal));
 const offline=await readCatalog(async url=>response(url.includes('daily-')?daily:base,true));assert.equal(offline.cached,true);
 assert.equal(latestRecipeDate(offline.catalog.recipes),[...base.recipes,...daily.recipes].map(r=>r.addedOn).filter(Boolean).sort().at(-1));
});
test('partial or invalid daily downloads are rejected instead of silently deleting daily recipes',async()=>{
 await assert.rejects(()=>readCatalog(async url=>url.includes('daily-')?new Response('missing',{status:503}):response(base)));
 await assert.rejects(()=>readCatalog(async url=>response(url.includes('daily-')?{recipes:[{}],ingredients:{}}:base)));
 for(const page of ['profile','detail','alternatives'])assert.equal(canRefreshPage(page),false);
 for(const page of ['explore','plan','basket','application'])assert.equal(canRefreshPage(page),true);
});
function worker({fetcher=async()=>{throw Error('offline')},saved=null}={}){
 const handlers={},pending=[];
 const context={self:{location:{origin:'https://example.test'},addEventListener:(kind,fn)=>handlers[kind]=fn},fetch:fetcher,caches:{match:async()=>saved,open:async()=>({put:async()=>{}})},AbortController,Headers,Response,URL,setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8'),context);
 return async(url,mode='cors')=>{let result;handlers.fetch({request:{url,method:'GET',mode},respondWith:r=>result=r,waitUntil:p=>pending.push(p)});const value=await result;await Promise.all(pending);return value};
}
test('service worker never returns HTML for missing JSON or images and marks cached data as offline',async()=>{
 const offline=worker();assert.equal((await offline('https://example.test/daily-catalog.json')).status,503);
 const cached=await worker({saved:response({recipes:[]})})('https://example.test/daily-catalog.json');
 assert.equal(cached.headers.get('X-Sofra-Offline'),'1');assert.deepEqual(await cached.json(),{recipes:[]});
 const error=await worker({fetcher:async()=>new Response('error',{status:500}),saved:response({recipes:['saved']})})('https://example.test/daily-catalog.json');assert.deepEqual(await error.json(),{recipes:['saved']});
});
test('daily nutrition is reproducible from verified sources; dates, allergen tags and cover provenance are complete',()=>{
 assert.equal(new Set(daily.recipes.map(r=>r.addedOn)).size,daily.recipes.length);
 for(const r of daily.recipes){
  const allergens=new Set();
  for(const [id]of r.items){const i=base.ingredients[id]||daily.ingredients[id];assert.equal(i.nutrition.verification,'source-checked');assert.ok(i.nutrition.sourceId);for(const a of i.allergens)allergens.add(a)}
  assert.deepEqual([...allergens].sort(),[...r.allergens].sort());
  for(const key of ['kcal','protein','carbs','fat']){const value=r.items.reduce((sum,[id,n])=>{const i=base.ingredients[id]||daily.ingredients[id];return sum+n*i.gramsPerUnit*i.nutrition[key]/100},0)/r.servings;assert.ok(Math.abs(value-r.macros[key])<=.051)}
  assert.ok(fs.existsSync(new URL('../'+r.imageProvenance.promptFile,import.meta.url)));
 }
});

test('invalid, missing and older release metadata cannot cause reload loops',()=>{
 for(const data of [{},null,{version:'7'},{version:'8'},{version:'undefined'},{version:9}])assert.equal(newerVersion(data),false);
 assert.equal(newerVersion({version:'9'}),true);
});
