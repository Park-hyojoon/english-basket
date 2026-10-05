import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState, applyEvaluation, metrics} from '../public/domain.mjs';
import {prepareHandoff,buildPrompt,parseReport,parseMinutes,validateChatUrl} from '../public/handoff.mjs';

function fixture(kind='chat') {
  const state=emptyState();
  state.expressions=['turn out','be used to','a bit worried'].map((text,i)=>({id:`e${i}`,text,meaning:'메모',source:'legacy source',createdAt:'2026-10-01T00:00:00Z',evidence:[]}));
  state.reviews=[{id:'r1',kind:'글쓰기',answer:'It turned out better than I expected.',day:'2026-10-05'}];
  const session=prepareHandoff(state,kind,()=>0.2);
  const report={format:'english-basket-report-v1',sessionId:session.id,kind,level:1,summary:'잘 말했어요.',completedScenes:kind==='test'?3:1,corrections:[],results:session.expressions.map(e=>({id:e.id,result:'success'})),passed:kind==='test'};
  return {state,session,report};
}
test('handoff includes recent practice and omits collection metadata',()=>{
  const {session}=fixture();const prompt=buildPrompt(session);
  assert.match(prompt,/It turned out better/);assert.match(prompt,/대화 중 문법 교정으로 끊지/);
  assert.doesNotMatch(prompt,/legacy source/);assert.equal(session.expressions.length,3);
});
test('report accepts ChatGPT prose and JSON fences without user editing',()=>{
  const {session,report}=fixture();assert.deepEqual(parseReport('오늘 잘했어요.\n```json\n'+JSON.stringify(report)+'\n```',session),report);
});
test('wrong conversation, missing results, duplicates and unknown statuses do not import',()=>{
  const {session,report}=fixture();
  for(const bad of [{...report,sessionId:'wrong'},{...report,results:report.results.slice(1)},{...report,results:[report.results[0],report.results[0],report.results[2]]},{...report,results:report.results.map(r=>({...r,result:'maybe'}))}])assert.throws(()=>parseReport(JSON.stringify(bad),session));
});
test('mini test advancement requires three scenes and two independent uses',()=>{
  const {session,report}=fixture('test');
  assert.equal(parseReport(JSON.stringify({...report,completedScenes:1}),session).passed,false);
  assert.equal(parseReport(JSON.stringify({...report,results:report.results.map((r,i)=>({...r,result:i?'help':'success'}))}),session).passed,false);
  assert.equal(parseReport(JSON.stringify(report),session).passed,true);
});
test('unknown duration remains unknown; entered minutes convert to seconds',()=>{
  assert.equal(parseMinutes(''),null);assert.equal(parseMinutes('1.5'),90);
  for(const value of ['abc',-1,0,181,Infinity])assert.throws(()=>parseMinutes(value));
});
test('confirmed external result affects growth only once and unknown duration does not create a streak',()=>{
  const {state,session,report}=fixture();
  const saved={...session,at:new Date().toISOString(),seconds:0,messages:[],confirmed:true,durationSource:'not-recorded'};
  applyEvaluation(state,saved,report);applyEvaluation(state,saved,report);
  assert.equal(state.sessions.length,1);assert.equal(metrics(state).streak,0);assert.equal(metrics(state).used,3);
});
test('old-level test cannot advance the new level a second time',()=>{
  const {state,session,report}=fixture('test');
  applyEvaluation(state,{...session,seconds:60,messages:[]},report);
  applyEvaluation(state,{...session,id:'another-old-test',seconds:60,messages:[]},report);
  assert.equal(state.level,2);
});
test('saved chat destination only accepts ChatGPT URLs',()=>{
  assert.equal(validateChatUrl('https://chatgpt.com/c/abc?x=1'),'https://chatgpt.com/c/abc');
  for(const url of ['javascript:alert(1)','https://chatgpt.com.evil.test/','http://chatgpt.com/','https://me:pw@chatgpt.com/'])assert.throws(()=>validateChatUrl(url));
});
