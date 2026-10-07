import {emptyState,day,STATUS,STAGES,stage,status,selectMix,applyEvaluation,metrics,mergeState,validateState} from './domain.mjs';
import {LEVEL_NAMES,chooseContext,prepareHandoff,buildPrompt,parseReport,parseMinutes,validateChatUrl} from './handoff.mjs';
const KEY='english-basket-v1', PENDING_KEY='english-basket-handoff-v1';
const RESULT_NAMES={success:'사용 성공',help:'도움 필요',unused:'미사용'};
let state=emptyState(),view='today',filter='all',query='',active=null,report=null,exercise=null,installPrompt=null;
let storageError=false,initialWarning='';
let reviewCards=null;
try {
  const raw=localStorage.getItem(KEY);if(raw)state=validateState(JSON.parse(raw));
  state.settings={chatUrl:state.settings?.chatUrl||'https://chatgpt.com/'};
  try{state.settings.chatUrl=validateChatUrl(state.settings.chatUrl);}catch{state.settings.chatUrl='https://chatgpt.com/';}
  const pending=localStorage.getItem(PENDING_KEY);
  if(pending){const parsed=JSON.parse(pending);if(parsed?.format==='english-basket-handoff-v1'&&['chat','test'].includes(parsed.kind)&&Array.isArray(parsed.expressions)&&Array.isArray(parsed.expressionIds)&&Array.isArray(parsed.scenes)&&Array.isArray(parsed.reviews))active=parsed;}
  const legacy=sessionStorage.getItem('basket-active');
  if(legacy&&!localStorage.getItem('english-basket-legacy-draft-v1'))localStorage.setItem('english-basket-legacy-draft-v1',legacy);
  sessionStorage.removeItem('basket-token');
} catch{storageError=true;initialWarning='기존 데이터를 읽지 못했습니다. 설정에서 원본 저장 파일을 백업하고 복원해 주세요. 기존 내용은 덮어쓰지 않습니다.';}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID();
const labels={today:['◌','오늘의 학습'],basket:['▤','내 바구니'],review:['↻','복습'],level:['✦','Level'],talk:['☏','1분 대화'],growth:['↗','성장 기록'],settings:['⚙','설정']};
const DATE_FORMAT=new Intl.DateTimeFormat('ko-KR',{dateStyle:'long',timeZone:'Asia/Seoul'});
function notify(message){const el=document.querySelector('#notice');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),5000);}
function changeState(change){if(storageError)throw Error('먼저 설정에서 기존 저장 파일을 백업하고 복원해 주세요.');const next=structuredClone(state);change(next);localStorage.setItem(KEY,JSON.stringify(next));state=next;}
function persistActive(){if(active)localStorage.setItem(PENDING_KEY,JSON.stringify(active));else localStorage.removeItem(PENDING_KEY);}
function navigate(next){if(next==='review')reviewCards=selectMix(state.expressions,5);if(next==='talk'&&state.expressions.length&&(!active||state.sessions.some(s=>s.id===active.id))){active=prepareHandoff(state);report=null;persistActive();}view=next;render();window.scrollTo(0,0);}
function expressionCard(e,controls=false){const currentStage=stage(e),currentStatus=status(e,currentStage);return `<div class="expression"><div class="flex"><strong>${esc(e.text)}</strong><span class="badge ${currentStatus===0?'gold':''}">${STATUS[currentStatus]}</span></div><p>${esc(e.meaning||'뜻이나 나만의 메모를 추가해 보세요.')}</p><div class="progress"><i style="width:${currentStage*20}%"></i></div><div class="muted">${currentStage}/5 · ${currentStage?STAGES[currentStage-1]:'아직 첫 만남'}</div>${controls?`<div class="flex" style="margin-top:12px"><button class="small secondary" data-action="edit" data-id="${esc(e.id)}">수정</button><button class="small ghost" data-action="remove" data-id="${esc(e.id)}">삭제</button></div>`:''}</div>`;}
function header(title,description='') {
  return `<h1>${title}</h1>${description?`<p class="muted">${description}</p>`:''}`;
}

function render() {
  document.querySelector('#app').innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand"><img src="./icon.svg" alt="바구니">English Basket</div><nav>${Object.entries(labels).map(([key,[icon,label]])=>`<button class="nav ${view===key?'active':''}" data-view="${key}" ${view===key?'aria-current="page"':''}><span aria-hidden="true">${icon}</span>${label}</button>`).join('')}</nav></aside><main class="main"><div class="topbar"><span>${DATE_FORMAT.format(new Date())}</span><div class="flex"><button class="pill ghost small" data-view="level">✦ Level ${state.level}</button><button class="pill ghost small" data-view="settings" aria-label="설정">⚙</button></div></div>${({today:todayPage,basket:basketPage,review:reviewPage,level:levelPage,talk:talkPage,growth:growthPage,settings:settingsPage}[view])()}</main></div>`;
}

function todayPage() {
  const m=metrics(state),today=day(),todays=state.expressions.filter(e=>day(new Date(e.createdAt))===today);
  const steps=[['basket','영어 담기',todays.length>0],['review','섞어서 연습하기',state.reviews.some(r=>r.day===today)],['talk','ChatGPT에서 1분 대화',state.sessions.some(s=>s.kind==='chat'&&s.day===today)]];
  return `<div class="hero"><div><h1>오늘의 영어 한 줌</h1><p class="muted">담고, 써보고, 1분만 말해요.</p></div><img src="./icon.svg" alt="웃는 바구니"><div class="flex"><button data-view="basket">+ 영어 담기</button><button class="ghost" data-view="talk">ChatGPT로 가져가기 →</button></div></div>
    <div class="statgrid"><div class="stat"><strong>${state.expressions.length}</strong><small>모은 표현</small></div><div class="stat"><strong>${m.streak}일</strong><small>연속 1분 대화</small></div><div class="stat"><strong>${m.used}</strong><small>사용한 표현</small></div><div class="stat"><strong>${Math.floor(m.seconds/60)}분</strong><small>기록한 대화</small></div></div>
    <div class="grid"><section class="card"><h2>오늘 할 일</h2><div class="steps">${steps.map(([v,t,done],i)=>`<div class="step" role="button" tabindex="0" data-view="${v}"><span class="num">${done?'✓':i+1}</span><b>${t}</b><span class="arrow">→</span></div>`).join('')}</div></section><section class="card"><div class="card-header"><h2>오늘 담은 영어</h2><button class="small ghost" data-view="basket">전체 보기</button></div>${todays.length?todays.slice(-3).map(e=>expressionCard(e)).join(''):'<div class="empty">마음에 남은 영어를 담아 보세요.</div>'}</section></div>`;
}

function basketPage() {
  const list=state.expressions.filter(e=>(filter==='all'||status(e)===Number(filter))&&(e.text+' '+e.meaning).toLowerCase().includes(query.toLowerCase()));
  return `${header('내 바구니')}<section class="card"><form id="add-form"><div class="split"><div><label for="expression">영어</label><textarea id="expression" name="text" maxlength="500" required placeholder="I'm a bit worried about it."></textarea></div><div><label for="meaning">뜻 · 상황 메모 (선택)</label><textarea id="meaning" name="meaning" maxlength="1000" placeholder="내일 발표가 조금 걱정돼요."></textarea></div></div><button style="margin-top:16px" type="submit">담기</button></form></section>
    <div class="filter"><input id="search" aria-label="표현 검색" placeholder="영어 또는 메모 검색" value="${esc(query)}">${['전체',...STATUS].map((s,i)=>`<button class="small secondary ${filter===(i?String(i-1):'all')?'active':''}" data-filter="${i?i-1:'all'}">${s}</button>`).join('')}</div><section class="card">${list.length?list.map(e=>expressionCard(e,true)).join(''):'<div class="empty">아직 담긴 영어가 없어요.</div>'}</section>`;
}

function reviewPage() {
  return `${header('복습')}<section class="card"><div class="flex">${['말하기','짧은 글쓰기','문장 변형','상황 대응'].map(mode=>`<button class="secondary" data-action="exercise" data-mode="${mode}">${mode}</button>`).join('')}</div>
    ${exercise?`<div style="margin-top:24px"><span class="badge">${esc(exercise.context[1])}</span><h2 style="margin-top:16px">${esc(exercise.prompt)}</h2><p class="muted">${exercise.expressions.map(e=>esc(e.text)).join(' · ')}</p><label for="practice-answer">나의 영어</label><textarea id="practice-answer" maxlength="4000" placeholder="한 문장부터 써 보세요.">${esc(exercise.answer||'')}</textarea><div class="flex" style="margin-top:14px"><button data-action="practice-submit" ${exercise.feedback?'disabled':''}>기록하기</button><button class="ghost" data-action="read-answer">들어보기</button>${exercise.feedback?'<button class="secondary" data-view="talk">ChatGPT로 가져가기 →</button>':''}</div>${exercise.feedback?`<p class="muted" style="margin-top:12px">${esc(exercise.feedback)}</p>`:''}</div>`:'<div class="empty">어떤 연습을 해 볼까요?</div>'}</section>
    <section class="card"><h2>다시 꺼내 보기</h2>${(reviewCards||=selectMix(state.expressions,5)).map(e=>`<div class="expression"><strong>${esc(e.text)}</strong><details><summary>뜻 보기</summary><p>${esc(e.meaning||'메모 없음')}</p></details><button class="small secondary" data-action="understand" data-id="${esc(e.id)}">${e.understood?'✓ 기억나요':'기억나요'}</button></div>`).join('')}</section>`;
}

function levelPage() {
  return `${header('나의 Level')}<section class="card"><h2>Level ${state.level} · ${LEVEL_NAMES[state.level-1]}</h2><button data-action="start-test">ChatGPT 미니 테스트 →</button></section><div class="level-grid">${LEVEL_NAMES.map((name,i)=>`<section class="level-card ${state.level===i+1?'current':''}"><span class="eyebrow">LEVEL ${i+1}</span><strong>${i<state.level-1?'✓':i+1}</strong><h3>${name}</h3></section>`).join('')}</div><details class="card" style="margin-top:20px"><summary>표현의 숙달 단계</summary><p class="list-compact">${STAGES.map((s,i)=>`${i+1}. ${s}`).join('<br>')}</p></details>`;
}

function growthPage() {
  const m=metrics(state);
  return `${header('성장 기록')}<div class="statgrid"><div class="stat"><strong>${m.streak}일</strong><small>연속 1분 대화</small></div><div class="stat"><strong>${Math.floor(m.seconds/60)}분</strong><small>기록한 대화</small></div><div class="stat"><strong>${m.used}</strong><small>사용한 표현</small></div><div class="stat"><strong>${m.revived}</strong><small>다시 쓴 과거 표현</small></div></div><div class="grid"><section class="card"><h2>다시 연습할 영어</h2>${m.weak.length?m.weak.slice(0,8).map(e=>expressionCard(e)).join(''):'<p class="muted">아직 없어요.</p>'}</section><section class="card"><h2>대화 기록</h2>${state.sessions.length?[...state.sessions].reverse().slice(0,20).map(s=>`<details class="expression"><summary>${esc(s.day)} · ${s.kind==='test'?'미니 테스트':'대화'}${s.durationSource==='not-recorded'?'':` · ${Math.round(s.seconds/6)/10}분`}</summary><p>${esc(s.summary)}</p><p class="muted">성공 ${s.results.filter(r=>r.result==='success').length} · 도움 ${s.results.filter(r=>r.result==='help').length} · 미사용 ${s.results.filter(r=>r.result==='unused').length}${s.kind==='test'?` · ${s.passed?'통과':'연습 중'}`:''}</p>${s.corrections.map(c=>`<p class="feedback">${esc(c)}</p>`).join('')}${s.messages.length?`<details><summary>대화 원문</summary>${s.messages.map(msg=>`<p class="muted">${esc(msg.content)}</p>`).join('')}</details>`:''}</details>`).join(''):'<p class="muted">대화 후 결과를 기록해 보세요.</p>'}</section></div><details class="card"><summary>기록 기준</summary><p class="muted">대화 시간은 직접 입력한 값입니다. 1분 이상 기록한 일반 대화로 연속일을 계산해요. 테스트와 시간 미입력 대화는 연속일에 포함하지 않아요.</p></details>`;
}

function talkPage() {
  const done=active&&state.sessions.some(s=>s.id===active.id);
  if(!active)return `${header('오늘의 1분 대화')}<section class="card"><p class="muted">먼저 대화에 쓸 영어를 담아 주세요.</p><button data-view="basket">+ 영어 담기</button></section>`;
  if(!report&&active.resultDraft)try{report=parseReport(active.resultDraft,active);}catch{}
  return `${header(active.kind==='test'?`Level ${active.level} 미니 테스트`:'오늘의 1분 대화')}<section class="card"><div class="title-row"><h2>${esc(active.contextTitle)}</h2><button class="small ghost" data-action="new-handoff">다시 섞기</button></div><p class="muted">${esc(active.scenario)}</p><div class="flex">${active.expressions.map(e=>`<span class="badge gold">${esc(e.text)}</span>`).join('')}</div><p class="muted" style="margin-top:20px">채팅에 붙여넣고 음성 모드를 켜세요.</p><button data-action="copy-handoff">복사하고 ChatGPT 열기 ↗</button>
    <details style="margin-top:18px"><summary>전달할 내용 보기</summary><textarea id="handoff-text" class="transfer-text" readonly aria-label="ChatGPT에 전달할 내용">${esc(buildPrompt(active))}</textarea><div class="flex" style="margin-top:10px"><a class="button-link secondary" href="${esc(state.settings.chatUrl)}" target="_blank" rel="noopener noreferrer">ChatGPT 열기 ↗</a><button class="ghost small" data-action="download-handoff">파일로 받기</button></div></details></section>
    ${done?'<section class="card"><h2>✓ 기록했어요</h2><button class="secondary" data-view="growth">성장 기록 보기 →</button></section>':`<details class="card" ${active.resultDraft?'open':''}><summary>대화 후 기록</summary><p class="muted" style="margin-top:16px">ChatGPT에 “Basket 결과를 주세요”라고 말해 주세요.</p><form id="record-form"><label for="result-text">받은 결과</label><textarea id="result-text" name="result" class="transfer-text" maxlength="100000" required placeholder="ChatGPT 결과를 여기에 붙여넣으세요.">${esc(active.resultDraft||'')}</textarea><div id="report-summary">${report?reportPreview():''}</div><label for="duration-minutes">대화 시간 · 분 (선택)</label><input id="duration-minutes" name="minutes" class="short-input" type="number" min="0.1" max="180" step="0.1" placeholder="예: 3" value="${esc(active.durationMinutes)}"><button style="margin-top:16px" type="submit">기록하기</button></form></details>`}`;
}

function reportPreview() {
  return `<div class="report-preview"><p>${esc(report.summary)}</p>${report.results.map(r=>`<div class="result-row"><span>${esc(active.expressions.find(e=>e.id===r.id)?.text)}</span><span class="badge ${r.result==='success'?'':'gold'}">${RESULT_NAMES[r.result]}</span></div>`).join('')}${report.corrections.map(c=>`<p class="feedback">${esc(c)}</p>`).join('')}${active.kind==='test'?`<p class="badge">${report.passed?'테스트 통과':'조금 더 연습해요'}</p>`:''}</div>`;
}

function settingsPage() {
  const legacy=localStorage.getItem('english-basket-legacy-draft-v1');
  return `${header('설정')}<section class="card"><form id="settings-form"><label for="chat-url">자주 쓰는 ChatGPT 채팅 주소 (선택)</label><input type="url" id="chat-url" name="chatUrl" value="${esc(state.settings.chatUrl)}" placeholder="https://chatgpt.com/"><button style="margin-top:16px" type="submit">저장</button></form></section><section class="card"><h2>내 기록</h2><div class="flex"><button class="secondary" data-action="export">백업 받기</button><label style="margin:0" for="import">백업 가져오기<input type="file" id="import" accept="application/json,.json"></label></div>${storageError?'<button class="ghost" data-action="export-raw">기존 원본 받기</button>':''}${legacy?'<details><summary>이전 미완료 대화</summary><button class="ghost" data-action="export-legacy">파일로 받기</button></details>':''}<p class="footer-note">기록은 이 브라우저에 저장됩니다.</p></section><details class="card"><summary>홈 화면에 추가</summary>${installPrompt?'<button data-action="install">앱 설치</button>':'<p class="muted">iPhone: Safari 공유 → 홈 화면에 추가<br>Android: 브라우저 메뉴 → 앱 설치</p>'}</details>`;
}

function download(text,name,type='text/plain;charset=utf-8') {
  const url=URL.createObjectURL(new Blob([text],{type}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function prepare(kind) {
  if(active&&!state.sessions.some(s=>s.id===active.id)) {
    if(active.kind===kind){navigate('talk');return;}
    if(!confirm('아직 기록하지 않은 자료가 있어요. 새 자료로 바꿀까요?'))return;
  }
  active=prepareHandoff(state,kind);report=null;persistActive();navigate('talk');
}

function createExercise(mode) {
  if(!state.expressions.length)throw Error('먼저 바구니에 영어를 담아 주세요.');
  if(exercise?.answer&&!exercise.feedback&&!confirm('아직 기록하지 않은 연습을 새 문제로 바꿀까요?'))return;
  const chosenExpressions=selectMix(state.expressions,5);
  const context=chooseContext(state,chosenExpressions);
  const task={말하기:'표현 한 개를 골라 소리 내어 말하고 말한 문장을 적어 보세요.','짧은 글쓰기':'표현 두 개를 골라 생각과 이유를 짧은 글로 써 보세요.','문장 변형':'이 상황에서 쓴 문장을 일이 내일 일어날 때와 어제 일어났을 때로 바꿔 보세요.','상황 대응':'상대방에게 정중하게 답할 문장을 써 보세요.'}[mode];
  exercise={id:uid(),mode,context,expressions:chosenExpressions,prompt:context[2]+' '+task,answer:'',feedback:null};render();
}

function speak(text) {
  if(!text.trim())throw Error('먼저 나의 영어를 적어 주세요.');
  if(!('speechSynthesis' in window))throw Error('이 브라우저는 읽어주기를 지원하지 않아요.');
  speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-US';utterance.rate=.9;speechSynthesis.speak(utterance);
}

document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-view],[data-action],[data-filter]');if(!el)return;
  try {
    if(el.dataset.view){navigate(el.dataset.view);return;}
    if(el.dataset.filter){filter=el.dataset.filter;render();return;}
    const action=el.dataset.action,id=el.dataset.id;
    if(action==='edit'){const e=state.expressions.find(e=>e.id===id),text=prompt('영어',e.text);if(text===null)return;if(!text.trim()||text.length>500)throw Error('1~500자 영어를 입력해 주세요.');const meaning=prompt('뜻 또는 쓰고 싶은 상황',e.meaning);if(meaning===null)return;changeState(s=>{const item=s.expressions.find(e=>e.id===id);item.text=text.trim();item.meaning=meaning.slice(0,1000);});render();}
    if(action==='remove'){if(active?.expressionIds.includes(id)&&!state.sessions.some(s=>s.id===active.id))throw Error('대화 자료에 담긴 표현은 결과 기록 후 삭제해 주세요.');if(confirm('이 영어를 삭제할까요? 기존 대화 기록은 유지됩니다.')){changeState(s=>{s.expressions=s.expressions.filter(e=>e.id!==id);});render();}}
    if(action==='understand'){changeState(s=>{s.expressions.find(e=>e.id===id).understood=true;s.reviews.push({id:uid(),day:day(),expressionId:id,kind:'understand'});});reviewCards=reviewCards?.map(e=>state.expressions.find(item=>item.id===e.id)||e);render();}
    if(action==='exercise')createExercise(el.dataset.mode);
    if(action==='practice-submit'){const answer=document.querySelector('#practice-answer').value.trim();if(!answer)throw Error('나의 영어를 한 문장 적어 주세요.');changeState(s=>{const saved={id:exercise.id,day:day(),at:new Date().toISOString(),context:exercise.context[0],kind:exercise.mode,prompt:exercise.prompt,answer,expressionIds:exercise.expressions.map(e=>e.id)};const i=s.reviews.findIndex(r=>r.id===exercise.id);if(i<0)s.reviews.push(saved);else s.reviews[i]=saved;});exercise.answer=answer;exercise.feedback='✓ 연습을 기록했어요.';render();}
    if(action==='read-answer')speak(document.querySelector('#practice-answer').value);
    if(action==='start-test')prepare('test');
    if(action==='new-handoff'){if(!state.sessions.some(s=>s.id===active.id)&&!confirm('기록하지 않은 자료와 결과 입력을 새로 준비할까요?'))return;const kind=active.kind;active=null;persistActive();prepare(kind);}
    if(action==='copy-handoff'){
      const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;
      try{await navigator.clipboard.writeText(buildPrompt(active));if(popup){popup.location.replace(state.settings.chatUrl);notify('복사했어요. 채팅에 붙여넣고 음성 모드를 켜세요.');}else{document.querySelector('#handoff-text').closest('details').open=true;notify('복사했어요. 아래 ChatGPT 열기를 눌러 주세요.');}}
      catch{if(popup)popup.close();const input=document.querySelector('#handoff-text');input.closest('details').open=true;input.focus();input.select();notify('선택된 자료를 복사한 뒤 ChatGPT를 열어 주세요.');}
    }
    if(action==='download-handoff')download(buildPrompt(active),`English-Basket-${day()}-${active.kind}.txt`);
    if(action==='export')download(JSON.stringify({...state,settings:{chatUrl:state.settings.chatUrl}},null,2),`english-basket-${day()}.json`,'application/json');
    if(action==='export-raw')download(localStorage.getItem(KEY)||'{}','english-basket-original.json','application/json');
    if(action==='export-legacy')download(localStorage.getItem('english-basket-legacy-draft-v1'),'english-basket-unfinished-conversation.json','application/json');
    if(action==='install'){await installPrompt.prompt();installPrompt=null;render();}
  }catch(error){notify(error.name==='QuotaExceededError'?'저장 공간이 부족해요. 백업을 내려받아 주세요.':error.message);}
});

document.addEventListener('submit',event=>{
  event.preventDefault();
  try {
    const form=event.target,values=Object.fromEntries(new FormData(form));
    if(form.id==='add-form'){values.text=values.text.trim();if(!values.text)return;if(state.expressions.some(e=>e.text.toLowerCase()===values.text.toLowerCase()))throw Error('이미 담아 둔 영어예요. 기존 메모를 수정해 보세요.');changeState(s=>s.expressions.push({...values,id:uid(),createdAt:new Date().toISOString(),evidence:[],understood:false}));render();notify('오늘의 영어를 담았어요.');}
    if(form.id==='settings-form'){const chatUrl=validateChatUrl(values.chatUrl.trim()||'https://chatgpt.com/');changeState(s=>{s.settings={chatUrl};});render();notify('이 채팅으로 학습 자료를 가져갈게요.');}
    if(form.id==='record-form'){
      active.resultDraft=values.result;
      const evaluation=parseReport(values.result,active),seconds=parseMinutes(values.minutes),alreadySaved=state.sessions.some(s=>s.id===active.id),savedLevel=state.level;
      changeState(s=>applyEvaluation(s,{id:active.id,kind:active.kind,level:active.level,at:new Date().toISOString(),preparedAt:active.at,context:active.context,expressionIds:active.expressionIds,expressionSnapshots:active.expressions,seconds:seconds??0,messages:[],confirmed:true,source:'chatgpt-return',durationSource:seconds===null?'not-recorded':'self-reported',completedScenes:evaluation.completedScenes},evaluation));
      report=evaluation;render();notify(alreadySaved?'이미 기록한 결과예요.':state.level>savedLevel?'다음 Level로 올라갔어요. 오늘의 결과도 기록했어요.':'오늘의 대화 결과를 기록했어요.');
    }
  }catch(error){notify(error.name==='QuotaExceededError'?'저장 공간이 부족해요. 백업을 내려받아 주세요.':error.message);}
});

document.addEventListener('input',event=>{
  const input=event.target;
  if(input.id==='search'){const position=input.selectionStart;query=input.value;render();const next=document.querySelector('#search');next.focus();next.setSelectionRange(position,position);}
  if(input.id==='practice-answer'&&exercise){exercise.answer=input.value;exercise.feedback=null;const saveButton=document.querySelector('[data-action="practice-submit"]');if(saveButton)saveButton.disabled=false;}
  if(active){
    if(input.id==='result-text'){active.resultDraft=input.value;try{report=parseReport(input.value,active);}catch{report=null;}const preview=document.querySelector('#report-summary');if(preview)preview.innerHTML=report?reportPreview():'';}
    if(input.id==='duration-minutes')active.durationMinutes=input.value;

    if(['result-text','duration-minutes'].includes(input.id))try{persistActive();}catch{notify('작성 중인 결과를 저장하지 못했어요. 백업을 확인해 주세요.');}
  }
});

document.addEventListener('change',async event=>{
  if(event.target.id!=='import')return;
  try{const file=event.target.files[0];if(!file)return;if(file.size>5*1024*1024)throw Error('5MB 이하의 백업 파일을 선택해 주세요.');const imported=JSON.parse(await file.text()),merged=mergeState(state,imported);merged.settings={chatUrl:state.settings.chatUrl};localStorage.setItem(KEY,JSON.stringify(merged));state=merged;storageError=false;render();notify('기존 기록과 백업을 합쳤어요.');}catch(error){notify(error.message);}
});

document.addEventListener('keydown',event=>{if(event.target.matches('.step')&&['Enter',' '].includes(event.key)){event.preventDefault();event.target.click();}});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;if(view==='settings')render();});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
render();if(initialWarning)notify(initialWarning);
