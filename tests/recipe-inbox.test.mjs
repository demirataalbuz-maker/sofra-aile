import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseIngredients,draftStatus,cleanDraft,saveDraft,readDrafts,deleteDraft,markLinkOpened,recipeDraftLink,recipeInbox,MAX_DRAFTS,MAX_LINK,DRAFT_KEY} from '../recipe-inbox.mjs';

const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),m}};
const reel='https://www.instagram.com/reel/ABC_123/?igsh=tracker';
test('persisted foreign or executable source links are rejected before rendering draft links',()=>{
 const storage=memory();storage.setItem(DRAFT_KEY,JSON.stringify([{id:'bad',source:'javascript:alert(1)'},{id:'foreign',source:'https://example.com/reel/a/'},{id:'valid',source:reel}]));
 assert.deepEqual(readDrafts(storage).map(d=>d.id),['valid']);
});
const full={source:reel,title:'Tavuklu bulgur',servings:'4',caption:'Akşam için pratik tarif #yemek',ingredients:'Malzemeler:\n400 g tavuk göğsü\n2 su bardağı bulgur\n1 yemek kaşığı salça\ntuz, isteğe göre',steps:'1. Tavuğu sotele.\n2. Bulguru ekle.',notes:'Daha az tuz'};

test('ingredients: only what the user wrote counts as a measure; missing measures are reported, never guessed',()=>{
 const items=parseIngredients(full.ingredients);
 assert.deepEqual(items.map(i=>[i.amount,i.unit,i.name]),[['400','g','tavuk göğsü'],['2','su bardağı','bulgur'],['1','yemek kaşığı','salça'],['','','tuz, isteğe göre']]);
 assert.equal(items[3].approx,true);
 const s=draftStatus({...full,ingredients:'400 g tavuk\nsoğan\nzeytinyağı',servings:null,steps:''});
 assert.equal(s.ready,false);
 assert.deepEqual(s.missing,['Ölçüsü yazılmamış malzeme: soğan, zeytinyağı','Kaç kişilik olduğu','Yapılış adımları']);
 assert.equal(draftStatus(cleanDraft(full)).ready,true);
 assert.deepEqual(draftStatus({ingredients:'',servings:4,steps:'x'}).missing,['Malzeme listesi (her satıra bir malzeme ve ölçüsü)']);
});

test('drafts are saved on this device only, updated in place, capped, and never marked as read from Instagram',()=>{
 const storage=memory();
 const d=saveDraft(full,{storage,now:1000});
 assert.equal(d.source,'https://www.instagram.com/reel/ABC_123/','tracker removed');assert.equal(d.servings,4);assert.equal(d.contentRead,false);
 const again=saveDraft({...full,id:d.id,title:'Yeni ad'},{storage,now:2000});
 assert.equal(again.id,d.id);assert.equal(again.createdAt,1000);assert.equal(readDrafts(storage).length,1);
 markLinkOpened(d.id,{storage,now:3000});assert.equal(readDrafts(storage)[0].linkOpenedAt,3000);
 deleteDraft(d.id,storage);assert.deepEqual(readDrafts(storage),[]);
 for(let i=0;i<MAX_DRAFTS;i++)saveDraft({source:reel},{storage,now:i});
 assert.throws(()=>saveDraft({source:reel},{storage,now:99}),/En fazla 30/);
 storage.setItem(DRAFT_KEY,'not json');assert.deepEqual(readDrafts(storage),[]);
});

test('input is validated, not silently cut; non-post links and bad servings are refused',()=>{
 assert.throws(()=>cleanDraft({...full,caption:'x'.repeat(2001)}),/en fazla 2000/);
 assert.throws(()=>cleanDraft({...full,steps:'x'.repeat(3001)}),/en fazla 3000/);
 for(const servings of ['0','21','2.5','dört'])assert.throws(()=>cleanDraft({...full,servings}),/1–20/);
 for(const source of ['https://instagram.com/someone/','https://evil.test/reel/ABC/','javascript:alert(1)'])assert.throws(()=>cleanDraft({...full,source}));
 assert.equal(cleanDraft({...full,servings:''}).servings,null);
});

test('inbox link carries recipe fields and the app\'s missing list only; too long is an error, not truncation',()=>{
 const u=new URL(recipeDraftLink({...cleanDraft(full),profile:{weight:80},token:'secret',healthConditions:['kidney']}));
 assert.equal(u.hostname,'github.com');
 assert.deepEqual([...u.searchParams.keys()],['template','source','recipe_name','notes','servings','caption','ingredients','steps','missing']);
 assert.equal(u.searchParams.get('missing'),'Uygulama eksik bilgi işaretlemedi.');
 assert.ok(!/secret|kidney|weight/.test(u.href));
 const partial=new URL(recipeDraftLink({source:reel,ingredients:'tuz\n200 g un'}));
 assert.match(partial.searchParams.get('missing'),/Ölçüsü yazılmamış malzeme: tuz/);
 assert.throws(()=>recipeDraftLink({source:reel,caption:'ç'.repeat(2000),steps:'ş'.repeat(3000)}),/sığmayacak/);
 assert.ok(MAX_LINK<8192,'stays under GitHub\'s URL limit');
});

test('the screen never claims a DM link or Instagram reading, and the module never fetches anything',()=>{
 const html=recipeInbox({esc:s=>String(s),storage:memory()}).html;
 assert.match(html,/DM bağlı değil/);assert.match(html,/Instagram gönderisini kendisi açıp okuyamaz/);
 assert.match(html,/kataloğuna eklenmez/);assert.match(html,/fotoğrafı\/videosu uygulamaya kopyalanmaz/);
 const source=fs.readFileSync(new URL('../recipe-inbox.mjs',import.meta.url),'utf8');
 assert.ok(!/\bfetch\(|XMLHttpRequest|catalog\.json/.test(source));
});

test('the private inbox form has a field for every value the app pre-fills',()=>{
 const template=new URL('../../sofra-private/.github/ISSUE_TEMPLATE/instagram-tarifi.yml',import.meta.url);
 if(!fs.existsSync(template))return; // only checkable when both repositories sit side by side
 const yml=fs.readFileSync(template,'utf8');
 for(const id of ['source','recipe_name','servings','caption','ingredients','steps','notes','missing'])assert.match(yml,new RegExp('id: '+id+'\\b'),id);
});
