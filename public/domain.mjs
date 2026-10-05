export const STATUS = ['새 표현', '익숙해지는 중', '내 것이 된 표현'];
export const STAGES = ['읽어서 이해', '도움받아 사용', '도움 없이 사용', '다른 상황에서 사용', '며칠 뒤에도 사용'];
const DAY_FORMAT=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
export function day(date = new Date()) {
  return DAY_FORMAT.format(date);
}
export const emptyState = () => ({version:1, expressions:[], sessions:[], reviews:[], level:1, settings:{chatUrl:'https://chatgpt.com/'}});
const INTERVALS = [1, 3, 7, 14, 30];
const orderedEvidence = e => [...(e.evidence || [])].sort((a,b)=>a.at.localeCompare(b.at));

// Dates are derived from evidence so merged backups get the same schedule.
export function reviewSchedule(expression) {
  const evidence=orderedEvidence(expression);
  let successfulDays=new Set(), lastSuccess=null, latest=null;
  for(const event of evidence) {
    if(event.result==='help') successfulDays=new Set();
    if(event.result==='success') {successfulDays.add(day(new Date(event.at)));lastSuccess=event.at;}
    latest=event;
  }
  const intervalDays=latest?.result==='success'?INTERVALS[Math.min(Math.max(successfulDays.size-1,0),INTERVALS.length-1)]:1;
  const due=latest?day(new Date(Date.parse(latest.at)+intervalDays*86400000)):(expression.due||day(new Date(expression.createdAt)));
  return {due,intervalDays,lastSuccess,lastResult:latest?.result||null,lastAt:latest?.at||null};
}

export function stage(expression) {
  const ev = orderedEvidence(expression);
  const failedAt=ev.findLastIndex(e=>e.result==='help');
  const successes = ev.slice(failedAt+1).filter(e => e.result === 'success');
  const differentContexts=new Set(successes.map(e=>e.context)).size>=2;
  if(differentContexts&&Date.parse(successes.at(-1).at)-Date.parse(successes[0].at)>=3*86400000)return 5;
  if(differentContexts)return 4;
  if(successes.length) return 3;
  if(ev.some(e=>e.result==='help')) return 2;
  return expression.understood ? 1 : 0;
}
export const status = e => stage(e)===5 ? 2 : stage(e)>=2 ? 1 : 0;
export function selectMix(expressions, count=5, random=Math.random, now=new Date()) {
  const today=day(now);
  const candidates=expressions.map(e=>({e,category:status(e),schedule:reviewSchedule(e),random:random()}));
  const ranked=[...candidates].sort((a,b)=>a.schedule.due.localeCompare(b.schedule.due)||Number(b.schedule.lastResult==='help')-Number(a.schedule.lastResult==='help')||a.random-b.random);
  const due=ranked.filter(x=>x.schedule.due<=today),future=ranked.filter(x=>x.schedule.due>today);
  const selected=[];
  const quotas=[Math.ceil(count*.5),Math.floor(count*.3),Math.floor(count*.2)];
  for(let s=0;s<3;s++) {
    const bucket=due.filter(x=>x.category===s);
    // Give one of today's new expressions a place without burying older reviews.
    if(s===0&&count>1){const fresh=bucket.findIndex(x=>day(new Date(x.e.createdAt))===today&&!x.schedule.lastAt);if(fresh>0)bucket.unshift(...bucket.splice(fresh,1));}
    selected.push(...bucket.slice(0,quotas[s]));
  }
  for(const x of [...due,...future])if(selected.length<count&&!selected.some(v=>v.e.id===x.e.id))selected.push(x);
  return selected.slice(0,count).map(x=>x.e);
}
export function applyEvaluation(state, session, evaluation) {
  if(state.sessions.some(s=>s.id===session.id)) return state;
  const at=session.at, today=day(new Date(at));
  const known = new Set(session.expressionIds);
  const results=state.expressions.filter(e=>known.has(e.id)).map(e=>({id:e.id,result:evaluation.results.find(r=>r.id===e.id)?.result||'unused'}));
  const revived=[];
  for(const r of results) {
    const e=state.expressions.find(e=>e.id===r.id);
    if(r.result==='success' && new Date(at)-new Date(reviewSchedule(e).lastSuccess||e.createdAt)>=7*86400000) revived.push(e.id);
    e.evidence.push({at,result:r.result,context:session.context});
    const schedule=reviewSchedule(e);
    e.lastSuccess=schedule.lastSuccess;
    e.due=schedule.due;
  }
  state.sessions.push({...session,day:today,results,revived,corrections:evaluation.corrections.slice(0,2),summary:evaluation.summary,passed:session.kind==='test'&&evaluation.passed});
  if(session.kind==='test'&&evaluation.passed&&(session.level===undefined||session.level===state.level)) state.level=Math.min(6,state.level+1);
  return state;
}
export function metrics(state, now=new Date()) {
  const sessions=state.sessions.filter(s=>s.kind==='chat');
  const days=new Set(sessions.filter(s=>s.seconds>=60&&(s.confirmed===true||s.messages.some(m=>m.role==='user'))).map(s=>s.day));
  let cursor=new Date(now), streak=0;
  if(!days.has(day(cursor))) cursor=new Date(cursor.getTime()-86400000);
  while(days.has(day(cursor))) {streak++;cursor=new Date(cursor.getTime()-86400000);}
  return {streak,seconds:sessions.reduce((a,s)=>a+s.seconds,0),used:new Set(state.sessions.flatMap(s=>s.results.filter(r=>r.result==='success').map(r=>r.id))).size,revived:new Set(state.sessions.flatMap(s=>s.revived)).size,weak:state.expressions.filter(e=>e.evidence.at(-1)&&e.evidence.at(-1).result!=='success')};
}
export function validateState(s) {
  if(!s||s.version!==1||!Array.isArray(s.expressions)||!Array.isArray(s.sessions)||!Array.isArray(s.reviews)||!Number.isInteger(s.level)||s.level<1||s.level>6) throw Error('English Basket v1 백업 파일을 선택해 주세요.');
  const ids=new Set();
  for(const e of s.expressions) {
    if(typeof e.id!=='string'||ids.has(e.id)||typeof e.text!=='string'||!e.text.trim()||e.text.length>500||typeof e.meaning!=='string'||!Array.isArray(e.evidence)||!Number.isFinite(Date.parse(e.createdAt))) throw Error('표현 데이터가 올바르지 않습니다.');
    ids.add(e.id);
    for(const ev of e.evidence) if(!['success','help','unused'].includes(ev.result)||typeof ev.context!=='string'||!Number.isFinite(Date.parse(ev.at))) throw Error('숙달 기록이 올바르지 않습니다.');
  }
  for(const x of s.sessions) if(typeof x.id!=='string'||!Number.isFinite(x.seconds)||x.seconds<0||!Array.isArray(x.results)||!Array.isArray(x.revived)||!Array.isArray(x.messages)||!Array.isArray(x.corrections)||!['chat','test'].includes(x.kind)||typeof x.day!=='string') throw Error('대화 기록이 올바르지 않습니다.');
  return s;
}
export function mergeState(current, imported) {
  validateState(imported);
  const result=structuredClone(current);
  for(const e of imported.expressions) {
    const existing=result.expressions.find(a=>a.id===e.id);
    if(!existing) result.expressions.push(e);
    else {existing.evidence=Array.from(new Map([...existing.evidence,...e.evidence].map(v=>[v.at+'|'+v.context+'|'+v.result,v])).values()).sort((a,b)=>a.at.localeCompare(b.at));existing.understood ||= e.understood;}
  }
  for(const expression of result.expressions){const schedule=reviewSchedule(expression);expression.due=schedule.due;expression.lastSuccess=schedule.lastSuccess;}
  result.sessions=Array.from(new Map([...imported.sessions,...result.sessions].map(s=>[s.id,s])).values());
  result.reviews=Array.from(new Map([...imported.reviews,...result.reviews].map(s=>[s.id,s])).values());
  result.level=Math.max(current.level,imported.level);
  return result;
}
