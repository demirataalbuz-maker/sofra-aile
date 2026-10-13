// Sofra account client (Cloudflare Worker + D1). Google proves identity once per sign-in; the Google ID
// token is sent to the server and dropped. The app keeps only its own revocable 30-day session token.
// It is a bearer token, not a cookie: github.io → workers.dev is cross-site and third-party cookies are blocked.
import {captureInvitation,clearInvitation} from './invitation.mjs';
const sessionKey='sofra-account-session-v1';
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
let configLoad,googleLoad;
export class AccountError extends Error{constructor(message,status=0,code='',body={}){super(message);this.status=status;this.code=code;this.body=body}}
export function accountConfig(fetcher=fetch){
 configLoad||=fetcher('./cloud-config.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Hesap ayarı alınamadı.');return r.json()}).catch(e=>{configLoad=null;throw e});
 return configLoad;
}
export function accountReady(config){
 return config?.enabled===true&&/^https:\/\/[a-z0-9.-]+\.workers\.dev$/.test(config.apiUrl||'')&&/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(config.googleClientId||'');
}
export function readSession(storage=globalThis.localStorage){
 try{
  const s=JSON.parse(storage.getItem(sessionKey)||'null');
  if(s&&TOKEN.test(s.token)&&typeof s.accountId==='string'&&Number.isFinite(s.expiresAt)&&s.expiresAt>Date.now())return s;
  if(s)storage.removeItem(sessionKey);
 }catch{}
 return null;
}
export function clearSession(storage=globalThis.localStorage){try{storage.removeItem(sessionKey)}catch{}}
export async function api(path,data={},{auth=true,session=readSession(),fetcher=fetch}={}){
 const config=await accountConfig(fetcher);
 if(!accountReady(config))throw new AccountError('Hesap sunucusu henüz yayında değil.',0,'disabled');
 if(auth&&!session)throw new AccountError('Önce Google ile giriş yap.',401,'session');
 let r;
 try{r=await fetcher(config.apiUrl+path,{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+session.token}:{})},body:JSON.stringify(data),signal:AbortSignal.timeout(20000)})}
 catch{throw new AccountError('Sunucuya ulaşılamadı.',0,'offline')}
 let body={};try{body=await r.json()}catch{}
 // Expired or revoked: forget only the token that was rejected, not one a newer sign-in just stored.
 if(r.status===401&&auth&&readSession()?.token===session.token)clearSession();
 if(!r.ok)throw new AccountError(body.error||'Hesap sunucusu isteği tamamlayamadı.',r.status,body.code||'',body);
 return body;
}
function loadGoogle(){
 googleLoad||=new Promise((resolve,reject)=>{
  if(window.google?.accounts?.id)return resolve(window.google.accounts.id);
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
  script.onload=()=>window.google?.accounts?.id?resolve(window.google.accounts.id):reject(Error('Google giriş servisi açılamadı.'));
  script.onerror=()=>{googleLoad=null;script.remove();reject(Error('Google giriş servisine ulaşılamadı. İnternet bağlantını kontrol et.'))};
  document.head.append(script);
 });
 return googleLoad;
}
// Renders Google's own button. The user's click on it starts sign-in; nothing opens or prompts on its own.
export async function renderGoogleButton(container,{onSignedIn,onError}){
 const invite=captureInvitation();
 const config=await accountConfig();
 if(!accountReady(config))throw new AccountError('Hesap sunucusu henüz yayında değil.',0,'disabled');
 const [{nonce},id]=await Promise.all([api('/auth/challenge',{},{auth:false}),loadGoogle()]);
 if(typeof nonce!=='string'||!TOKEN.test(nonce))throw new AccountError('Giriş isteği hazırlanamadı. Tekrar dene.');
 id.initialize({client_id:config.googleClientId,nonce,ux_mode:'popup',auto_select:false,itp_support:true,use_fedcm_for_button:true,context:'signin',
  callback:async response=>{
   try{
    const body=await api('/auth/google',{credential:response.credential,nonce,...(invite?{invite}:{})},{auth:false});
    localStorage.setItem(sessionKey,JSON.stringify({token:body.token,expiresAt:body.expiresAt,accountId:body.account.id,email:body.account.email}));
    clearInvitation();
    onSignedIn(body.account);
   }catch(e){onError(e)}
  }});
 container.replaceChildren();
 id.renderButton(container,{type:'standard',theme:'outline',size:'large',text:'signin_with',shape:'pill',locale:'tr',width:260});
}
// Returns what the server confirmed. {revoked:true} only after the server acknowledged the revocation.
// Single device: local sign-out always happens; if the server is unreachable the token just expires (30 days).
// Every device: nothing is cleared locally until the server confirms, so the user can retry while still signed in.
export async function signOut({everywhere=false,fetcher=fetch}={}){
 const session=readSession(),forgetGoogle=()=>{try{window.google?.accounts?.id?.disableAutoSelect()}catch{}};
 const reason=e=>e.status===401?'session':e.code==='offline'||e.status===0?'offline':'server';
 if(!session)return {revoked:false,reason:'session'};
 if(everywhere){
  try{await api('/auth/logout-all',{},{session,fetcher})}
  catch(e){return {revoked:false,reason:reason(e)}} // 401 already cleared this (invalid) token in api()
  clearSession();forgetGoogle();return {revoked:true};
 }
 clearSession();forgetGoogle();
 try{await api('/auth/logout',{},{session,fetcher});return {revoked:true}}
 catch(e){return e.status===401?{revoked:true}:{revoked:false,reason:reason(e)}} // 401: token was already invalid
}
export async function deleteAccount(){
 await api('/account/delete',{confirm:'delete'});clearSession();
}
