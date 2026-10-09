import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
import {readFile} from 'node:fs/promises';

test('preview serves offline app files but all former AI endpoints are retired',async()=>{
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    assert.equal((await fetch(base+'/')).status,200);
    assert.equal((await fetch(base+'/handoff.mjs')).status,200);
    for(const route of ['health','coach'])assert.equal((await fetch(base+'/api/'+route,{method:'POST'})).status,410);
    for(const route of ['/.env','/%2e%2e%2fpackage.json'])assert.notEqual((await fetch(base+route)).status,200);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('app contains no paid API request, background polling or microphone capture',async()=>{
  const app=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
  const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(app,/\bfetch\(|setInterval\(|SpeechRecognition|OPENAI_API_KEY|api\.openai\.com/);
  assert.doesNotMatch(server,/\bfetch\(|OPENAI_API_KEY|api\.openai\.com/);
});
