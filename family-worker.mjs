import {buildFamilyPlan} from './family.mjs?v=10';
self.onmessage=({data})=>{try{self.postMessage(buildFamilyPlan(data.recipes,data.ingredients,data.members,data.options));}catch{self.postMessage({error:'Ortak menü hesaplanamadı; mevcut kayıtların korundu.'});}};
