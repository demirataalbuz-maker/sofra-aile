import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFoodQuery,foodAmount,searchFoods,diaryFoods,frequentFoods} from '../food-diary.mjs';
import {newEntry,daySummary} from '../tracking.mjs';
test('four boiled eggs are explicit edible portions, oil is not silently included',()=>{
 const foods=diaryFoods({ingredients:{},recipes:[]}),f=searchFoods(foods,'4 yumurta yedim')[0];
 assert.equal(f.id,'food:boiled-egg');
 const m=foodAmount(f,4,'adet');assert.equal(m.kcal,310);assert.equal(m.protein,25.16);
 assert.deepEqual(parseFoodQuery('150,5 g yoğurt yedim'),{query:'yogurt',amount:150.5,unit:'g'});
 assert.throws(()=>foodAmount(f,-1,'g'));assert.throws(()=>foodAmount(f,1,'porsiyon'));
 const now=new Date(),day=now.toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'});
 const e=newEntry('food',{title:f.title,macros:m,portion:1},day,now);
 assert.equal(daySummary([e],day).totals.kcal,310);e.deleted=true;assert.equal(daySummary([e],day).totals.kcal,0);
});
test('unverified ingredients stay out, manual history uses actual consumed portions and excludes deleted records',()=>{
 assert.equal(diaryFoods({ingredients:{x:{nutrition:{verification:'unverified'}}},recipes:[]}).length,2);
 const m={kcal:120,protein:5,carbs:10,fat:2},e={kind:'food',title:'Etiketli ürün',macros:m,portion:2,at:'2026-10-20'};
 const recent=frequentFoods([e,{...e,at:'2026-10-19'},{...e,title:'Silinmiş',deleted:true}]);
 assert.equal(recent.length,1);assert.equal(recent[0].count,2);assert.equal(recent[0].portion,2);
 const recipe={title:'Yemek',basis:1,unit:'porsiyon',macros:m};assert.equal(foodAmount(recipe,.5,'porsiyon').kcal,60);assert.throws(()=>foodAmount(recipe,100,'g'));
});
