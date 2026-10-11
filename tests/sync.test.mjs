import test from 'node:test';
import assert from 'node:assert/strict';
import {syncDecision,localPayload} from '../sync.mjs';
test('only one-sided changes sync automatically; divergent devices keep local data',()=>{
 const before={profile:null,tracking:{entries:[]}},after={...before,tracking:{entries:[{id:'water'}]}};
 const link={revision:3,baseline:JSON.stringify(before)};
 assert.equal(syncDecision(before,link,{state:before,revision:3}),'same');
 assert.equal(syncDecision(after,link,{state:before,revision:3}),'upload');
 assert.equal(syncDecision(before,link,{state:after,revision:4}),'download');
 assert.equal(syncDecision(after,link,{state:after,revision:4}),'conflict');
 assert.equal(syncDecision(before,link,{state:null,revision:4}),'missing');
 assert.deepEqual(localPayload({...before,reports:{},cloudSettings:{}}),before);
});
