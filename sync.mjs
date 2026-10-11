const key='sofra-cloud-link-v1';
export function localPayload(state){const {reports,cloudSettings,family,...data}=state;return data}
export function syncDecision(local,link,remote){
 if(!remote.state)return 'missing';
 const dirty=JSON.stringify(local)!==link.baseline;
 if(remote.revision!==link.revision)return dirty?'conflict':'download';
 return dirty?'upload':'same';
}
export function readLink(){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
export function writeLink(uid,revision,state){localStorage.setItem(key,JSON.stringify({uid,revision,baseline:JSON.stringify(localPayload(state))}))}
export function clearLink(){localStorage.removeItem(key)}
