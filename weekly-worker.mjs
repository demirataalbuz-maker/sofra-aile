import {buildWeek} from './weekly.mjs?v=21';
self.onmessage=({data})=>{try{self.postMessage({week:buildWeek(data.recipes,data.ingredients,data.profile,data.options)})}catch(e){self.postMessage({error:e.message||'Haftalık menü oluşturulamadı.'})}};
