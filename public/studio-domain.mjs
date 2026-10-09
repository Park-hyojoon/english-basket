import {day,addDays,weekStart} from './dates.mjs';

export const LANGUAGES={en:'English',ko:'한국어'};
export const DIFFICULTIES={gentle:'가볍게',standard:'기본',stretch:'한 걸음 더'};
export const ERROR_NAMES={article:'관사',tense:'시제',preposition:'전치사',number:'단수·복수',word_order:'어순',expression:'어휘·표현',connection:'문장 연결',logic:'내용·논리',spelling:'맞춤법·띄어쓰기'};
export const RUBRICS={
  en:{version:'basket-writing-en-v1',areas:[['grammar','문법 정확성',25],['expression','표현력',20],['structure','문장 구성',20],['logic','내용과 논리',20],['basket','수집 표현 활용',15]]},
  ko:{version:'basket-writing-ko-v1',areas:[['clarity','생각의 명료성',25],['logic','내용과 논리',25],['connection','문장 연결',20],['vocabulary','어휘의 적절성',15],['accuracy','맞춤법·문법',15]]}
};
export const TOPICS=[
  ['달라진 저녁','날씨가 바뀌면서 달라진 기분과 생활을 써 보세요.'],
  ['작은 걱정','다가오는 일을 앞두고 걱정되는 점과 준비를 써 보세요.'],
  ['뜻밖의 하루','예상과 달라진 일과 그때 느낀 마음을 써 보세요.'],
  ['정중한 거절','쉬고 싶은 날 받은 부탁에 이유와 대안을 전해 보세요.'],
  ['낯선 변화','새로운 환경에서 불편한 것과 조금 익숙해진 것을 써 보세요.'],
  ['차분한 해결','일상에서 생긴 문제와 원하는 해결 방법을 써 보세요.'],
  ['내 시간을 지키기','요즘 줄이고 싶은 일과 대신 하고 싶은 일을 써 보세요.'],
  ['마음에 남은 장면','읽은 이야기에서 마음에 남은 장면과 자신의 경험을 연결해 보세요.'],
  ['다른 관점','누군가와 생각이 달랐던 순간과 이해하게 된 점을 써 보세요.'],
  ['늦어진 약속','약속이 늦어진 이유와 상대에게 전하고 싶은 말을 써 보세요.'],
  ['도움을 청하는 말','혼자 해결하기 어려운 일과 필요한 도움을 구체적으로 써 보세요.'],
  ['작은 회복','힘든 한 주를 보낸 뒤 마음을 회복하는 방법을 써 보세요.']
];
export const newStudio=()=>({version:1,writings:[],readings:[],evaluations:[],activeIds:{en:null,ko:null},preferences:{en:{level:null,difficulty:'standard'},ko:{level:1,difficulty:'standard'}}});
export function targetRange(level,difficulty='standard') {
  const base=level<=2?[1,3]:level<=4?[3,5]:[5,7];
  const offset=difficulty==='gentle'?-1:difficulty==='stretch'?1:0;
  return {min:Math.max(1,base[0]+offset),max:Math.max(2,base[1]+offset)};
}
export function writingCounts(text,language='en') {
  const trimmed=text.trim();
  return {words:trimmed?trimmed.split(/\s+/u).length:0,characters:[...trimmed.replace(/\s/gu,'')].length,sentences:trimmed?trimmed.split(/[.!?。！？]+(?:["'”’)]*)\s*|\n+/u).filter(s=>s.trim()).length:0};
}
export function comparisonKey(w) {return [w.language,w.type,w.level,w.difficulty,w.target.min,w.target.max,RUBRICS[w.language].version].join('|');}
export function createWriting(studio,{language='en',type='practice',level=1,difficulty='standard',expressionIds=[],expressions=[],readingIds=[],now=new Date()}={}) {
  if(!LANGUAGES[language]||!['practice','weekly'].includes(type)||!Number.isInteger(level)||level<1||level>6||!DIFFICULTIES[difficulty])throw Error('작문 조건을 확인해 주세요.');
  const previous=studio.writings.filter(w=>w.language===language&&w.type===type);
  const weekly=type==='weekly'?previous.find(w=>w.week===weekStart(now)):null;
  if(weekly)return weekly;
  // Weekly conditions stay constant; changing practice difficulty cannot inflate comparisons.
  const anchor=type==='weekly'?previous[0]:null;
  if(anchor){level=anchor.level;difficulty=anchor.difficulty;}
  const used=new Set(previous.slice(-TOPICS.length+1).map(w=>w.topicKey));
  const topicIndex=TOPICS.findIndex((_,i)=>!used.has(i));
  const topic=TOPICS[topicIndex<0?0:topicIndex];
  return {id:crypto.randomUUID(),language,type,createdAt:now.toISOString(),updatedAt:now.toISOString(),week:weekStart(now),topic:topic[0],topicPrompt:topic[1],topicKey:topicIndex<0?0:topicIndex,level,difficulty,target:anchor?{...anchor.target}:targetRange(level,difficulty),expressionIds:language==='en'?[...new Set(expressionIds)]:[],expressionSnapshots:language==='en'?expressions.map(e=>({id:e.id,text:e.text,meaning:e.meaning})):[],readingIds:[...readingIds],draft:'',original:null,originalAt:null,provenance:'unknown',rewrite:'',revisions:[],requests:[],feedbackDraft:'',status:'draft'};
}
export function freezeOriginal(w,now=new Date()) {
  if(w.original!==null)return;
  if(!w.draft.trim())throw Error('먼저 자신의 글을 작성해 주세요.');
  if(w.provenance==='unknown')throw Error('최초 글을 보존하기 전에 작성 방법을 선택해 주세요.');
  if(w.type==='weekly'&&w.provenance!=='independent')throw Error('주간 평가는 도움 없이 직접 쓴 글임을 확인해 주세요.');
  w.original=w.draft;w.originalAt=now.toISOString();w.status='written';
}
export function createFeedbackRequest(w,phase='original',now=new Date()) {
  if(!['original','rewrite'].includes(phase))throw Error('첨삭할 글을 확인해 주세요.');
  freezeOriginal(w,now);
  const text=phase==='original'?w.original:w.rewrite;
  if(!text.trim())throw Error('첨삭받을 글을 먼저 작성해 주세요.');
  const existing=w.requests.findLast(r=>r.phase===phase&&r.text===text);
  if(existing)return existing;
  const request={id:crypto.randomUUID(),phase,text,at:now.toISOString(),key:comparisonKey(w),rubricVersion:RUBRICS[w.language].version};
  w.requests.push(request);return request;
}
export function acceptWritingReport(studio,w,request,report,now=new Date()) {
  const existing=studio.evaluations.find(e=>e.requestId===request.id);
  if(existing)return existing;
  if(request.phase==='rewrite'&&request.text!==w.rewrite)throw Error('재작성 글이 바뀌었어요. 현재 글로 첨삭 자료를 다시 준비해 주세요.');
  const counts=writingCounts(request.text,w.language);
  const enough=counts.sentences>=w.target.min&&(w.language==='en'?counts.words>=8:counts.characters>=20);
  const confidence=enough?report.confidence:'low';
  const evaluation={...report,id:crypto.randomUUID(),writingId:w.id,requestId:request.id,phase:request.phase,at:now.toISOString(),day:day(new Date(request.phase==='original'?w.originalAt:now)),evaluatedText:request.text,language:w.language,type:w.type,level:w.level,difficulty:w.difficulty,target:{...w.target},key:request.key,rubricVersion:request.rubricVersion,provenance:request.phase==='original'?w.provenance:'assisted-rewrite',confidence,counts,total:Object.values(report.scores).reduce((a,n)=>a+n,0)};
  studio.evaluations.push(evaluation);if(w.status!=='complete')w.status='feedback';w.feedbackDraft='';w.updatedAt=now.toISOString();return evaluation;
}
export function saveRewrite(w,provenance='own-rewrite',complete=false,now=new Date()) {
  if(w.original===null)throw Error('먼저 최초 작성본을 저장해 주세요.');
  if(!w.rewrite.trim())throw Error('다시 쓴 글을 작성해 주세요.');
  if(!['own-rewrite','ai-example'].includes(provenance))throw Error('다시 쓴 글의 작성 방법을 확인해 주세요.');
  if(!w.revisions.some(r=>r.text===w.rewrite&&r.provenance===provenance))w.revisions.push({id:crypto.randomUUID(),text:w.rewrite,provenance,at:now.toISOString()});
  w.status=complete?'complete':'rewriting';w.updatedAt=now.toISOString();
}
export function addReading(studio,values,now=new Date()) {
  const source=String(values.source||'기타').trim(),book=String(values.book||'').trim(),location=String(values.location||'').trim(),original=String(values.original||'').trim(),meaning=String(values.meaning||'').trim(),expression=String(values.expression||'').trim(),memo=String(values.memo||'').trim();
  if(!original||original.length>3000||!expression||expression.length>500)throw Error('짧은 원문과 중요한 표현(500자 이하)을 입력해 주세요.');
  if([source,book,location].some(x=>x.length>200)||meaning.length>3000||memo.length>3000)throw Error('독서 메모가 너무 길어요.');
  const existing=studio.readings.find(r=>r.source===source&&r.book===book&&r.location===location&&r.original===original&&r.expression===expression);
  return existing||{id:crypto.randomUUID(),source,book,location,original,meaning,expression,memo,createdAt:now.toISOString(),expressionId:null};
}
const requiredText=(x,max=30000)=>typeof x==='string'&&x.length<=max;
export function validateStudio(studio) {
  if(studio===undefined)return;
  if(!studio||studio.version!==1||!Array.isArray(studio.writings)||!Array.isArray(studio.readings)||!Array.isArray(studio.evaluations))throw Error('작문 백업 형식이 올바르지 않습니다.');
  if(!studio.activeIds||!studio.preferences||Object.keys(LANGUAGES).some(language=>{const p=studio.preferences[language];return !p||!(p.level===null||Number.isInteger(p.level)&&p.level>=1&&p.level<=6)||!DIFFICULTIES[p.difficulty]||!(studio.activeIds[language]===null||typeof studio.activeIds[language]==='string');}))throw Error('작문 설정이 올바르지 않습니다.');
  for(const collection of [studio.writings,studio.readings,studio.evaluations]){const ids=new Set();for(const item of collection){if(!item||typeof item.id!=='string'||ids.has(item.id))throw Error('작문 기록 ID가 중복되거나 누락됐습니다.');ids.add(item.id);}}
  for(const w of studio.writings){if(!LANGUAGES[w.language]||!['practice','weekly'].includes(w.type)||!Number.isInteger(w.level)||w.level<1||w.level>6||!DIFFICULTIES[w.difficulty]||!Number.isFinite(Date.parse(w.createdAt))||!Number.isFinite(Date.parse(w.updatedAt))||!requiredText(w.topic,500)||!requiredText(w.topicPrompt,2000)||!requiredText(w.draft)||!(w.original===null||requiredText(w.original))||!requiredText(w.rewrite)||!requiredText(w.feedbackDraft,100000)||!Array.isArray(w.expressionIds)||!Array.isArray(w.expressionSnapshots)||!Array.isArray(w.readingIds)||!Array.isArray(w.requests)||!Array.isArray(w.revisions)||!w.target||!Number.isInteger(w.target.min)||!Number.isInteger(w.target.max)||w.target.min<1||w.target.max<w.target.min||w.target.max>20||!['unknown','independent','assisted','copied'].includes(w.provenance))throw Error('작문 내용이나 조건이 올바르지 않습니다.');for(const r of w.requests)if(typeof r.id!=='string'||!['original','rewrite'].includes(r.phase)||!requiredText(r.text)||typeof r.key!=='string'||typeof r.rubricVersion!=='string')throw Error('첨삭 요청 기록이 올바르지 않습니다.');for(const r of w.revisions)if(!requiredText(r.text)||!['own-rewrite','ai-example'].includes(r.provenance))throw Error('재작성 이력이 올바르지 않습니다.');}
  for(const r of studio.readings)if(!requiredText(r.original,3000)||!requiredText(r.expression,500)||!requiredText(r.source,200)||!requiredText(r.book,200)||!requiredText(r.location,200)||!requiredText(r.meaning,3000)||!requiredText(r.memo,3000)||!Number.isFinite(Date.parse(r.createdAt)))throw Error('독서 기록이 올바르지 않습니다.');
  for(const e of studio.evaluations){const rubric=RUBRICS[e.language],w=studio.writings.find(w=>w.id===e.writingId),request=w?.requests.find(r=>r.id===e.requestId);if(!rubric||!w||!request||e.language!==w.language||e.type!==w.type||e.level!==w.level||e.difficulty!==w.difficulty||e.key!==comparisonKey(w)||e.key!==request.key||e.evaluatedText!==request.text||e.phase!==request.phase||e.provenance!==(e.phase==='original'?w.provenance:'assisted-rewrite')||e.rubricVersion!==rubric.version||!['low','medium','high'].includes(e.confidence)||!e.scores||Object.keys(e.scores).length!==rubric.areas.length||rubric.areas.some(([key,,max])=>!Number.isFinite(e.scores[key])||e.scores[key]<0||e.scores[key]>max)||!Array.isArray(e.errors)||e.errors.some(x=>!ERROR_NAMES[x.category]||!requiredText(x.original,2000)||!requiredText(x.correction,2000)||!requiredText(x.explanation,2000))||!Array.isArray(e.usedExpressionIds)||e.usedExpressionIds.some(id=>!w.expressionIds.includes(id))||!Array.isArray(e.strengths)||e.strengths.some(x=>!requiredText(x,2000))||!Array.isArray(e.improvements)||e.improvements.some(x=>!rubric.areas.some(([id])=>id===x.area)||!requiredText(x.original,2000)||!requiredText(x.suggestion,2000)||!requiredText(x.reason,2000))||!requiredText(e.flow,3000)||!requiredText(e.revisedExample)||!requiredText(e.evaluatedText)||!Number.isFinite(Date.parse(e.at))||!/^\d{4}-\d{2}-\d{2}$/.test(e.day)||!Number.isFinite(e.total)||e.total!==rubric.areas.reduce((n,[key])=>n+e.scores[key],0))throw Error('작문 평가 기록이 올바르지 않습니다.');}
}
const fingerprint=text=>{let a=2166136261,b=5381;for(const c of text){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}return (a>>>0).toString(16)+(b>>>0).toString(16);};
export function mergeStudio(current,imported) {
  validateStudio(current);validateStudio(imported);
  const result=structuredClone(current||newStudio());if(!imported)return result;
  const remap=new Map();
  for(const w of imported.writings){const existing=result.writings.find(x=>x.id===w.id);if(!existing){result.writings.push(structuredClone(w));continue;}if(JSON.stringify(existing)===JSON.stringify(w))continue;
    const id=w.id+'-backup-'+fingerprint(JSON.stringify(w));remap.set(w.id,id);if(!result.writings.some(x=>x.id===id))result.writings.push({...structuredClone(w),id,conflictOf:w.id,requests:w.requests.map(r=>({...r,id:r.id+'-'+id}))});
  }
  for(const e of imported.evaluations){const writingId=remap.get(e.writingId)||e.writingId,id=remap.has(e.writingId)?e.id+'-'+writingId:e.id;if(!result.evaluations.some(x=>x.id===id))result.evaluations.push({...structuredClone(e),id,writingId,requestId:remap.has(e.writingId)?e.requestId+'-'+writingId:e.requestId});}
  for(const reading of imported.readings)if(!result.readings.some(r=>r.id===reading.id))result.readings.push(structuredClone(reading));
  return result;
}
export function comparableEvaluations(studio,key) {
  return studio.evaluations.filter(e=>e.key===key&&e.phase==='original'&&e.provenance==='independent'&&e.confidence!=='low').sort((a,b)=>a.day.localeCompare(b.day)||a.at.localeCompare(b.at));
}
export function writingAnalytics(studio,{language='en',type='practice',key=null,days=7,now=new Date()}={}) {
  const end=day(now),start=addDays(end,1-days),week=weekStart(now);
  const candidates=studio.evaluations.filter(e=>e.language===language&&e.type===type&&e.phase==='original');
  const groups=[...new Set(candidates.sort((a,b)=>b.at.localeCompare(a.at)).map(e=>e.key))];
  const selectedKey=groups.includes(key)?key:groups[0]||null;
  const group=selectedKey?candidates.filter(e=>e.key===selectedKey):[];
  const points=Array.from({length:days},(_,i)=>{const date=addDays(start,i),writings=studio.writings.filter(w=>w.language===language&&w.type===type&&day(new Date(w.originalAt||w.createdAt))===date&&(!selectedKey||comparisonKey(w)===selectedKey)),evaluations=group.filter(e=>e.day===date),eligible=evaluations.filter(e=>e.provenance==='independent'&&e.confidence!=='low');return {day:date,state:eligible.length?'evaluated':evaluations.length?'low-confidence':writings.some(w=>w.original!==null||w.draft.trim())?'ungraded':'empty',score:eligible.length?eligible.reduce((n,e)=>n+e.total,0)/eligible.length:null,evaluations};});
  const weekWritings=studio.writings.filter(w=>w.language===language&&w.original!==null&&day(new Date(w.originalAt))>=week&&day(new Date(w.originalAt))<=end);
  const weekEvals=studio.evaluations.filter(e=>e.language===language&&e.phase==='original'&&e.day>=week&&e.day<=end);
  const weekly=studio.evaluations.filter(e=>e.language===language&&e.type==='weekly'&&e.phase==='original'&&e.provenance==='independent'&&e.confidence!=='low').sort((a,b)=>b.at.localeCompare(a.at));
  const lastWeekly=weekly[0],priorWeekly=lastWeekly?weekly.find(e=>e.key===lastWeekly.key&&e.day<weekStart(new Date(lastWeekly.day+'T03:00:00Z'))):null;
  const errors=Object.entries(ERROR_NAMES).map(([category,label])=>{const within=studio.evaluations.filter(e=>e.language===language&&e.phase==='original'&&e.day>=start&&e.day<=end&&(!selectedKey||e.key===selectedKey)),split=addDays(start,Math.floor(days/2)),first=within.filter(e=>e.day<split),last=within.filter(e=>e.day>=split),rate=list=>list.length?list.filter(e=>e.errors.some(x=>x.category===category)).length/list.length:null;return {category,label,count:within.reduce((n,e)=>n+e.errors.filter(x=>x.category===category).length,0),before:rate(first),after:rate(last)};}).filter(x=>x.count).sort((a,b)=>b.count-a.count);
  const eligible=selectedKey?comparableEvaluations(studio,selectedKey).filter(e=>e.day>=start&&e.day<=end):[];
  const first=eligible[0],last=eligible.at(-1),comparable=first&&last&&first.day!==last.day;
  const areas=RUBRICS[language].areas.map(([id,label,max])=>({id,label,max,score:eligible.length?eligible.reduce((n,e)=>n+e.scores[id],0)/eligible.length:null,change:comparable?last.scores[id]-first.scores[id]:null}));
  const best=areas.filter(a=>a.change>0).sort((a,b)=>b.change/b.max-a.change/a.max)[0];
  const used=new Set(weekEvals.flatMap(e=>e.usedExpressionIds));
  const weak=areas.filter(a=>a.score!==null).sort((a,b)=>a.score/a.max-b.score/b.max)[0];
  return {start,end,week,groups,key:selectedKey,points,areas,errors,weekWritings:weekWritings.length,learningDays:new Set(weekWritings.map(w=>day(new Date(w.originalAt)))).size,used:used.size,lastWeekly,weeklyChange:priorWeekly?lastWeekly.total-priorWeekly.total:null,best:best?.label||null,strengths:weekEvals.flatMap(e=>e.strengths).slice(-2),nextGoal:errors.length?`${errors[0].label}를 점검하며 새 문장으로 써 보기`:weak?`${weak.label}에 집중해 짧게 써 보기`:'짧은 독립 작문을 시작해 보세요.'};
}
export function diffWords(before,after) {
  const a=before.match(/\s+|[^\s]+/gu)||[],b=after.match(/\s+|[^\s]+/gu)||[];
  // Bound memory for unusually long essays; plain complete versions always remain available.
  if(a.length*b.length>150000)return b.map(text=>({text,changed:!before.includes(text)}));
  const rows=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
  for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)rows[i][j]=a[i]===b[j]?rows[i+1][j+1]+1:Math.max(rows[i+1][j],rows[i][j+1]);
  const out=[];let i=0,j=0;while(j<b.length){if(i<a.length&&a[i]===b[j]){out.push({text:b[j++],changed:false});i++;}else if(i<a.length&&rows[i+1][j]>=rows[i][j+1])i++;else out.push({text:b[j++],changed:true});}return out;
}
