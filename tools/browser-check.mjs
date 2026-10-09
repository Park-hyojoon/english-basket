import {createRequire} from 'node:module';
import path from 'node:path';
import os from 'node:os';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
import {emptyState} from '../public/domain.mjs';
const require=createRequire(import.meta.url);
let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.BASKET_PLAYWRIGHT||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const screenshots=process.env.BASKET_SCREENSHOTS==='1';
if(screenshots)await mkdir('outputs',{recursive:true});
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.BASKET_BROWSER_CHANNEL||'msedge',headless:true});
const errors=[],apiCalls=[];
try {
  const context=await browser.newContext({viewport:{width:1280,height:900},permissions:['clipboard-read','clipboard-write']});
  await context.route('https://chatgpt.com/**',route=>route.fulfill({status:200,body:'ChatGPT navigation test'}));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/'))apiCalls.push(r.url());});
  await page.goto(base);
  const legacy=emptyState();legacy.expressions=[{id:'old1',text:'be used to',meaning:'~에 익숙하다',source:'스피킹 앱',type:'숙어',createdAt:'2026-10-01T00:00:00Z',evidence:[{at:'2026-10-02T00:00:00Z',context:'home',result:'help'}]}];legacy.settings={endpoint:'https://old.example',token:'old',sound:true};
  await page.evaluate(data=>localStorage.setItem('english-basket-v1',JSON.stringify(data)),legacy);await page.reload();
  await page.locator('.nav[data-view="basket"]').click();
  assert.equal(await page.locator('#source,#type,#endpoint,#token').count(),0);
  assert.doesNotMatch(await page.locator('main').innerText(),/스피킹 앱|재료 종류|어디서 만났/);
  for(const [text,meaning]of[['turn out','결과적으로'],['a bit worried','조금 걱정되는']]){await page.locator('#expression').fill(text);await page.locator('#meaning').fill(meaning);await page.locator('#add-form button').click();}
  let data=await page.evaluate(()=>JSON.parse(localStorage.getItem('english-basket-v1')));
  assert.equal(data.expressions[0].source,'스피킹 앱');assert.equal(data.expressions[0].evidence.length,1);assert.equal(data.expressions[1].source,undefined);assert.equal(data.settings.token,undefined);
  await page.locator('.nav[data-view="review"]').click();const beforeCards=await page.locator('[data-action="understand"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.id));await page.locator('[data-action="understand"]').first().click();assert.deepEqual(await page.locator('[data-action="understand"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.id)),beforeCards);await page.locator('[data-mode="짧은 글쓰기"]').click();await page.locator('#practice-answer').fill('It turned out better than I expected.');await page.locator('[data-action="practice-submit"]').click();
  await page.locator('[data-view="talk"]:visible').first().click();
  const prompt=await page.locator('#handoff-text').inputValue();assert.match(prompt,/It turned out better/);assert.doesNotMatch(prompt,/스피킹 앱/);
  const popupPromise=context.waitForEvent('page');await page.locator('[data-action="copy-handoff"]').click();const popup=await popupPromise;await popup.waitForURL('https://chatgpt.com/');await popup.close();await page.bringToFront();assert.equal((await page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n'),prompt);
  const active=await page.evaluate(()=>JSON.parse(localStorage.getItem('english-basket-handoff-v1')));
  const result={format:'english-basket-report-v1',sessionId:active.id,kind:active.kind,level:active.level,summary:'걱정과 결과를 말했어요.',completedScenes:1,corrections:['I worry yesterday → I was worried yesterday.'],results:active.expressionIds.map((id,i)=>({id,result:i===1?'help':'success'})),passed:false};
  await page.getByText('대화 후 기록',{exact:true}).click();await page.locator('#result-text').fill('오늘의 결과입니다.\n```json\n'+JSON.stringify(result)+'\n```');
  await page.reload();await page.locator('.nav[data-view="talk"]').click();assert.match(await page.locator('#report-summary').innerText(),/걱정과 결과/);
  await page.locator('#record-form button[type="submit"]').click();
  data=await page.evaluate(()=>JSON.parse(localStorage.getItem('english-basket-v1')));assert.equal(data.sessions.length,1);assert.equal(data.sessions[0].durationSource,'not-recorded');
  await page.locator('.nav[data-view="growth"]').click();assert.equal(await page.locator('.stat strong').first().textContent(),'0일');
  await page.locator('[data-view="level"]:visible').first().click();await page.locator('[data-action="start-test"]').click();
  const testActive=await page.evaluate(()=>JSON.parse(localStorage.getItem('english-basket-handoff-v1')));
  const testResult={...result,sessionId:testActive.id,kind:'test',completedScenes:3,results:testActive.expressionIds.map(id=>({id,result:'success'})),passed:true};
  await page.getByText('대화 후 기록',{exact:true}).click();await page.locator('#result-text').fill(JSON.stringify({...testResult,sessionId:'wrong'}));await page.locator('#record-form button[type="submit"]').click();assert.match(await page.locator('#notice').innerText(),/다른 대화/);
  await page.locator('#result-text').fill(JSON.stringify(testResult));await page.locator('#duration-minutes').fill('2.5');await page.locator('#record-form button[type="submit"]').click();
  data=await page.evaluate(()=>JSON.parse(localStorage.getItem('english-basket-v1')));assert.equal(data.sessions.length,2);assert.equal(data.level,2);assert.equal(data.sessions[1].seconds,150);
  await page.locator('.nav[data-view="today"]').click();if(screenshots)await page.screenshot({path:'outputs/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.locator('.nav[data-view="basket"]').click();if(screenshots)await page.screenshot({path:'outputs/mobile-basket.png',fullPage:true});
  for(const v of ['today','review','talk','growth','settings','level']){await page.locator(`[data-view="${v}"]:visible`).first().click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),v+' fits mobile');}
  await page.locator('.nav[data-view="talk"]').click();assert.match(await page.locator('#handoff-text').inputValue(),/I worry yesterday/);assert.notEqual((await page.evaluate(()=>JSON.parse(localStorage.getItem('english-basket-handoff-v1')))).context,testActive.context);if(screenshots)await page.screenshot({path:'outputs/mobile-talk.png',fullPage:true});
  await page.waitForFunction(()=>navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await page.locator('.nav[data-view="basket"]').click();assert.equal(await page.locator('.expression').count(),3);await page.locator('#expression').fill('one step at a time');await page.locator('#add-form button').click();assert.equal(await page.locator('.expression').count(),4);
  assert.deepEqual(apiCalls,[]);assert.deepEqual(errors,[]);
  console.log('PASS: existing records, simplified collection, practice transfer, copy/open, external results, optional time, Level, mobile, offline, zero API requests.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
