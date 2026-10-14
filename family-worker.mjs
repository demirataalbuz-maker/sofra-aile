import {buildFamilyPlan} from './family.mjs?v=21';
import {buildCommonPlan} from './common-plan.mjs?v=21';
// Menu searches run here so the phone stays responsive; the page terminates this Worker on cancel or timeout.
self.onmessage=({data})=>{try{self.postMessage(data?.type==='common'?buildCommonPlan(data.input):buildFamilyPlan(data.recipes,data.ingredients,data.members,data.options));}catch{self.postMessage({error:'Ortak menü hesaplanamadı; mevcut kayıtların korundu.'});}};
