const key='sofra-pilot-invite';
const familyKey='sofra-family-invite';
const valid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
// Fragment stays out of HTTP requests and referrers. Keep it only for this tab's sign-in retry.
export function captureInvitation(location=globalThis.location,history=globalThis.history,storage=globalThis.sessionStorage){
 try{
  const params=new URLSearchParams(location.hash.slice(1));
  if(params.has('invite')||params.has('familyInvite')){
   const isFamily=params.has('familyInvite'),token=params.get(isFamily?'familyInvite':'invite');
   history.replaceState(history.state,'',location.pathname+location.search);
   storage.removeItem(key);
   storage.removeItem(familyKey);
   if(valid(token))storage.setItem(key,token);
   if(isFamily&&valid(token))storage.setItem(familyKey,token);
  }
  const token=storage.getItem(key);return valid(token)?token:null;
 }catch{return null}
}
export function clearInvitation(storage=globalThis.sessionStorage){try{storage.removeItem(key)}catch{}}
export function readFamilyInvitation(storage=globalThis.sessionStorage){try{const token=storage.getItem(familyKey);return valid(token)?token:null}catch{return null}}
export function clearFamilyInvitation(storage=globalThis.sessionStorage){try{storage.removeItem(familyKey);storage.removeItem(key)}catch{}}
