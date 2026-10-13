import test from 'node:test';
import assert from 'node:assert/strict';
import {captureInvitation,clearInvitation} from '../invitation.mjs';
test('invitation fragment is removed and retained only until successful login',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const token='a'.repeat(43),location={hash:'#invite='+token,pathname:'/sofra-aile/',search:'?page=account'};
 let replaced;const history={state:null,replaceState:(_,__,url)=>replaced=url};
 assert.equal(captureInvitation(location,history,storage),token);
 assert.equal(replaced,'/sofra-aile/?page=account');
 location.hash='';assert.equal(captureInvitation(location,history,storage),token);
 clearInvitation(storage);assert.equal(captureInvitation(location,history,storage),null);
 location.hash='#invite=invalid';assert.equal(captureInvitation(location,history,storage),null);
});
