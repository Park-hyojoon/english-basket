export const STATUS = ['새 표현', '익숙해지는 중', '내 것이 된 표현'];
export const STAGES = ['읽어서 이해', '도움받아 사용', '도움 없이 사용', '다른 상황에서 사용', '며칠 뒤에도 사용'];
export function day(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul', year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export const emptyState = () => ({version:1, expressions:[], sessions:[], reviews:[], level:1, settings:{endpoint:'',token:'',sound:true}});
export function stage(expression) {
  const ev = expression.evidence || [];
  const successes = ev.filter(e => e.result === 'success');
  if(successes.length && new Set(successes.map(e=>e.context)).size >= 2 && successes.some(a=>successes.some(b=>new Date(b.at)-new Date(a.at)>=3*86400000))) return 5;
  if(new Set(successes.map(e=>e.context)).size >= 2) return 4;
  if(successes.length) return 3;
  if(ev.some(e=>e.result==='help')) return 2;
  return expression.understood ? 1 : 0;
}
export const status = e => stage(e)===5 ? 2 : stage(e)>=2 ? 1 : 0;
export function selectMix(expressions, count=5, random=Math.random) {
  const shuffle = xs => xs.map(x=>({x,r:random()})).sort((a,b)=>a.r-b.r).map(a=>a.x);
  const selected=[];
  const quotas=[Math.ceil(count*.5),Math.floor(count*.3),Math.floor(count*.2)];
  const priority = xs => shuffle(xs).sort((a,b)=>(a.due||'').localeCompare(b.due||''));
  for(let s=0;s<3;s++) selected.push(...priority(expressions.filter(e=>status(e)===s)).slice(0,quotas[s]));
  selected.push(...priority(expressions.filter(e=>!selected.some(a=>a.id===e.id))).slice(0,count-selected.length));
  return selected.slice(0,count);
}
export function applyEvaluation(state, session, evaluation) {
  if(state.sessions.some(s=>s.id===session.id)) return state;
  const at=session.at, today=day(new Date(at));
  const known = new Set(session.expressionIds);
  const results=state.expressions.filter(e=>known.has(e.id)).map(e=>({id:e.id,result:evaluation.results.find(r=>r.id===e.id)?.result||'unused'}));
  const revived=[];
  for(const r of results) {
    const e=state.expressions.find(e=>e.id===r.id);
    if(r.result==='success' && new Date(at)-new Date(e.lastSuccess||e.createdAt)>=7*86400000) revived.push(e.id);
    e.evidence.push({at,result:r.result,context:session.context});
    if(r.result==='success') e.lastSuccess=at;
    e.due=day(new Date(new Date(at).getTime()+(r.result==='success'?3:1)*86400000));
  }
  state.sessions.push({...session,day:today,results,revived,corrections:evaluation.corrections.slice(0,2),summary:evaluation.summary,passed:session.kind==='test'&&evaluation.passed});
  if(session.kind==='test'&&evaluation.passed) state.level=Math.min(6,state.level+1);
  return state;
}
export function metrics(state, now=new Date()) {
  const sessions=state.sessions.filter(s=>s.kind==='chat');
  const days=new Set(sessions.filter(s=>s.seconds>=60&&s.messages.some(m=>m.role==='user')).map(s=>s.day));
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
  result.sessions=Array.from(new Map([...imported.sessions,...result.sessions].map(s=>[s.id,s])).values());
  result.reviews=Array.from(new Map([...imported.reviews,...result.reviews].map(s=>[s.id,s])).values());
  result.level=Math.max(current.level,imported.level);
  return result;
}
