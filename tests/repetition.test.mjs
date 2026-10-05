import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,selectMix,reviewSchedule,applyEvaluation,mergeState,stage} from '../public/domain.mjs';
import {prepareHandoff,chooseContext,buildPrompt} from '../public/handoff.mjs';

const expression=(id)=>({id,text:id,meaning:'내가 말하고 싶은 뜻',createdAt:'2026-10-01T00:00:00Z',evidence:[]});
const success=(at,context='home')=>({at,result:'success',context});
const stateWith=(...expressions)=>({...emptyState(),expressions});

test('due reviews outrank future successes regardless of mastery quota',()=>{
  const fresh=expression('new'),future=expression('future');future.evidence=[success('2026-10-05T00:00:00Z')];
  const overdue=Array.from({length:6},(_,i)=>({...expression('weak'+i),evidence:[{at:'2026-10-02T00:00:00Z',result:'help',context:'home'}]}));
  const mix=selectMix([fresh,future,...overdue],5,()=>.5,new Date('2026-10-05T02:00:00Z'));
  assert.equal(mix.length,5);assert.equal(mix.some(e=>e.id==='future'),false);assert.ok(mix.some(e=>e.id==='weak0'));
});
test('one of today’s new expressions appears alongside older due work',()=>{
  const xs=Array.from({length:10},(_,i)=>expression('old'+i));xs.push({...expression('today'),createdAt:'2026-10-05T00:00:00Z'});
  const mix=selectMix(xs,5,()=>.5,new Date('2026-10-05T02:00:00Z'));
  assert.ok(mix.some(e=>e.id==='today'));assert.ok(mix.some(e=>e.id==='old0'));
});
test('spaced successes expand 1→3→7→14→30 days; same-day repeats do not inflate interval',()=>{
  const e=expression('phrase');
  for(const [at,interval]of [['2026-10-01',1],['2026-10-02',3],['2026-10-05',7],['2026-10-12',14],['2026-10-26',30]]){
    e.evidence.push(success(at+'T00:00:00Z'));
    assert.equal(reviewSchedule(e).intervalDays,interval);
    e.evidence.push(success(at+'T01:00:00Z','work'));assert.equal(reviewSchedule(e).intervalDays,interval);
  }
});
test('struggling with a mastered expression restores short review and learning status',()=>{
  const e=expression('phrase');e.evidence=[success('2026-10-01T00:00:00Z'),success('2026-10-05T00:00:00Z','work')];assert.equal(stage(e),5);
  e.evidence.push({at:'2026-10-06T00:00:00Z',context:'season',result:'help'});
  assert.equal(stage(e),2);assert.equal(reviewSchedule(e).due,'2026-10-07');
  e.evidence.push(success('2026-10-07T00:00:00Z','season'));assert.equal(stage(e),3);assert.equal(reviewSchedule(e).intervalDays,1);
});
test('unused expression returns tomorrow without erasing earlier successful use',()=>{
  const e=expression('phrase');e.evidence=[success('2026-10-01T00:00:00Z'),success('2026-10-05T00:00:00Z','work'),{at:'2026-10-06T00:00:00Z',context:'season',result:'unused'}];
  assert.equal(stage(e),5);assert.equal(reviewSchedule(e).due,'2026-10-07');
});
test('merged evidence restores latest schedule and success date in both merge directions',()=>{
  const a=stateWith(expression('phrase')),b=structuredClone(a);
  a.expressions[0].evidence=[success('2026-10-01T00:00:00Z')];a.expressions[0].due='1999-01-01';
  b.expressions[0].evidence=[success('2026-10-05T00:00:00Z','work')];
  const ab=mergeState(a,b),ba=mergeState(b,a);
  assert.deepEqual(reviewSchedule(ab.expressions[0]),reviewSchedule(ba.expressions[0]));
  assert.equal(ab.expressions[0].due,'2026-10-08');assert.equal(ab.expressions[0].lastSuccess,'2026-10-05T00:00:00Z');
});
test('next practice changes scene; ChatGPT receives previous corrections and weak result',()=>{
  const state=stateWith(expression('phrase'));
  applyEvaluation(state,{id:'s1',kind:'chat',at:'2026-10-05T00:00:00Z',seconds:60,context:'season',expressionIds:['phrase'],messages:[]},{results:[{id:'phrase',result:'help'}],corrections:['I used to rain → I am used to the rain.'],summary:'비에 익숙하다는 표현 연습',passed:false});
  const handoff=prepareHandoff(state,'chat',()=>0);
  assert.notEqual(handoff.context,'season');assert.equal(handoff.expressions[0].lastResult,'help');assert.match(buildPrompt(handoff),/I am used to the rain/);
  state.reviews.push({id:'r1',kind:'말하기',day:'2026-10-06',at:'2026-10-06T00:00:00Z',context:handoff.context,answer:'practice'});
  assert.notEqual(chooseContext(state,state.expressions,()=>0)[0],handoff.context);
});
