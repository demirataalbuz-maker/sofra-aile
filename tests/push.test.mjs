import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('push keeps links within Sofra and displays a generic notification for malformed data',async()=>{
 const handlers={},shown=[],opened=[];
 const self={location:{origin:'https://example.test',href:'https://example.test/sofra/sw.js'},addEventListener:(event,fn)=>handlers[event]=fn,registration:{showNotification:async(title,options)=>shown.push({title,options})},clients:{openWindow:async url=>opened.push(url)}};
 vm.runInNewContext(fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8'),{self,URL});
 const run=async(data)=>{let pending;handlers.push({data,waitUntil:p=>pending=p});await pending};
 await run({json:()=>({title:'Menün hazır',url:'https://example.test/sofra/?page=plan'})});
 assert.equal(shown[0].options.data.url,'https://example.test/sofra/?page=plan');
 await run({json:()=>({url:'https://evil.example/steal'})});assert.equal(shown[1].options.data.url,'https://example.test/sofra/?page=tracking');
 await run({json:()=>{throw Error('bad json')}});assert.equal(shown[2].title,'Porsiva');
 let pending;handlers.notificationclick({notification:{close(){},data:{url:shown[0].options.data.url}},waitUntil:p=>pending=p});await pending;assert.deepEqual(opened,['https://example.test/sofra/?page=plan']);
 handlers.notificationclick({notification:{close(){},data:{url:'https://example.test/other/'}},waitUntil(){}});assert.equal(opened.length,1);
});
