(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const statusLabels = { pending:'대기', 'in-progress':'진행 중', done:'완료', deferred:'후속 보류', blocked:'차단됨', review:'검토 중', cancelled:'취소', unknown:'상태 미확인' };
  const priorities = { high:'높음', medium:'보통', low:'낮음' };
  const knownStatus = value => Object.hasOwn(statusLabels, value) ? value : 'unknown';
  const isDone = node => node?.status === 'done';
  const ratio = (done, total) => total ? Math.round(done / total * 100) : 0;
  const numberId = value => /^[1-9]\d*$/.test(String(value));
  const canConnect = location.protocol === 'http:' && ['127.0.0.1','localhost'].includes(location.hostname);
  let snapshot;
  try { snapshot = JSON.parse($('dashboard-data').textContent); } catch { $('data-warning').hidden = false; $('data-warning').textContent = '저장된 작업 데이터를 읽지 못했습니다. 대시보드를 다시 생성해 주세요.'; return; }
  let catalog = snapshot.catalog || { plans:[{id:snapshot.plan.id,label:snapshot.plan.title}] };
  let planSnapshots = snapshot.planSnapshots || { [snapshot.plan.id]:snapshot };
  const requestedPlan = new URL(location.href).searchParams.get('plan');
  if (catalog.plans.some(p=>p.id===requestedPlan) && Object.hasOwn(planSnapshots,requestedPlan)) snapshot=planSnapshots[requestedPlan];
  const planUi = new Map();
  const state = { phase:'all', status:'all', query:'', expanded:new Set(), highlighted:null, mode:canConnect?'live':'snapshot', error:'', fetching:false };
  let visibleTasks = [];
  let pollTimer;
  let requestGeneration = 0;

  function dateText(value) {
    if (!value || !Number.isFinite(new Date(value).getTime())) return '확인되지 않음';
    return new Intl.DateTimeFormat('ko-KR', { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(new Date(value));
  }
  const taskById = id => snapshot.tasks.find(t => String(t.id) === String(id));
  const phaseOf = task => snapshot.plan.tasks.find(t => String(t.id) === String(task.id))?.phase ?? 0;
  function nodeById(id, parent) {
    const parts = String(id).split('.');
    if (parts.length === 2) return taskById(parts[0])?.subtasks.find(s => String(s.id) === parts[1]);
    return parent ? parent.subtasks.find(s => String(s.id) === String(id)) : taskById(id);
  }
  const unsatisfied = task => task.dependencies.filter(dep => !isDone(nodeById(dep)));
  const isReady = task => task.status === 'pending' && unsatisfied(task).length === 0;
  const units = tasks => tasks.flatMap(t => t.subtasks);
  const doneCount = list => list.filter(isDone).length;
  function badge(status, ready = false) {
    const safe = knownStatus(status);
    return '<span class="status ' + (ready?'ready':safe) + '">' + (ready?'착수 가능':statusLabels[safe]) + '</span>';
  }
  function renderPlans() {
    $('plan-selector').hidden = catalog.plans.length < 2;
    const focused=document.activeElement?.closest('[data-plan-id]')?.dataset.planId;
    $('plan-buttons').innerHTML=catalog.plans.map(p=>{
      const item=p.id===snapshot.plan.id?snapshot:planSnapshots[p.id],tasks=item?.tasks||[],leaves=units(tasks);
      return '<button type="button" class="plan-choice" data-plan-id="'+escape(p.id)+'" aria-pressed="'+String(p.id===snapshot.plan.id)+'"><strong>'+escape(p.label)+'</strong><small>상위 '+tasks.length+'개 · 세부 '+leaves.length+'개 · '+doneCount(leaves)+' / '+leaves.length+' 완료</small></button>';
    }).join('');
    if(focused)[...$('plan-buttons').children].find(e=>e.dataset.planId===focused)?.focus({preventScroll:true});
    $('plan-context').textContent=snapshot.plan.context||'';
    $('plan-budget').textContent=snapshot.plan.budget||'';
    $('plan-tag').textContent=snapshot.source.tag;
    $('plan-description').textContent=snapshot.plan.description||'Task Master의 실제 작업 상태를 확인합니다.';
    $('page-title').textContent=snapshot.plan.title;
    const dot=document.createElement('span');dot.className='title-dot';dot.textContent='.';$('page-title').append(dot);
    $('task-range').textContent='01 — '+snapshot.tasks.length;
    $('phase-one-label').textContent=snapshot.plan.phaseLabels[1];
    $('phase-two-label').textContent=snapshot.plan.phaseLabels[2];
    document.title='하루단어 · '+snapshot.plan.title;
  }
  function switchPlan(id) {
    if(id===snapshot.plan.id || !catalog.plans.some(p=>p.id===id) || !Object.hasOwn(planSnapshots,id))return;
    requestGeneration++;state.fetching=false;
    planUi.set(snapshot.plan.id,{phase:state.phase,status:state.status,query:state.query,expanded:new Set(state.expanded),highlighted:state.highlighted});
    snapshot=planSnapshots[id];
    Object.assign(state,planUi.get(id)||{phase:'all',status:'all',query:'',expanded:new Set(),highlighted:null});
    state.mode=canConnect?'live':'snapshot';state.error='';
    $('search').value=state.query;$('status-filter').value=state.status;
    try{const url=new URL(location.href);url.searchParams.set('plan',id);history.replaceState(null,'',url);}catch{/* File snapshots can still switch without history permission. */}
    renderAll();[...$('plan-buttons').children].find(e=>e.dataset.planId===id)?.focus({preventScroll:true});
    $('announcement').textContent='플랜을 '+snapshot.plan.title+'로 전환했습니다. 진행률과 검증 단계를 따로 표시합니다.';
    if(canConnect)void refresh();
  }
  function summarizeWarnings() {
    const warnings = [];
    const missing = snapshot.plan.tasks.filter(t => !taskById(t.id));
    const expected = snapshot.plan.tasks.reduce((n,t) => n + t.subtaskCount, 0);
    if (missing.length) warnings.push('계획 작업 ' + missing.map(t=>'#'+t.id).join(', ') + '이 원본에 없습니다.');
    if (units(snapshot.tasks).length !== expected) warnings.push('계획의 세부 ' + expected + '개와 현재 원본 ' + units(snapshot.tasks).length + '개가 다릅니다.');
    const unknown = [...snapshot.tasks, ...units(snapshot.tasks)].filter(t => knownStatus(t.status) === 'unknown');
    if (unknown.length) warnings.push('알 수 없는 작업 상태 ' + unknown.length + '개가 있습니다.');
    const mismatch = snapshot.tasks.filter(t => isDone(t) && t.subtasks.some(s => !isDone(s) && s.status !== 'cancelled'));
    if (mismatch.length) warnings.push('상위 완료와 세부 상태가 다른 작업: ' + mismatch.map(t=>'#'+t.id).join(', ') + '.');
    const badDependencies = snapshot.tasks.filter(t => t.dependencies.some(dep => !nodeById(dep)));
    if (badDependencies.length) warnings.push('원본에서 찾을 수 없는 선행 작업이 있습니다.');
    $('integrity-warning').textContent = warnings.join(' ');
    $('integrity-warning').hidden = warnings.length === 0;
  }

  function renderOverview() {
    const tasks = snapshot.tasks, leaves = units(tasks), done = doneCount(leaves), percent = ratio(done, leaves.length);
    $('overall-percent').textContent = percent;
    $('leaf-done').textContent = done; $('leaf-total').textContent = leaves.length;
    $('parent-done').textContent = doneCount(tasks); $('parent-total').textContent = tasks.length;
    $('leaf-running').textContent = leaves.filter(t=>t.status==='in-progress').length;
    $('ready-count').textContent = tasks.filter(isReady).length;
    $('waiting-count').textContent = tasks.filter(t=>t.status==='pending' && !isReady(t)).length;
    $('scope-count').textContent = '상위 ' + tasks.length + '개 · 세부 ' + leaves.length + '개';
    $('overall-progress').setAttribute('aria-valuenow', percent);
    $('overall-progress').setAttribute('aria-valuetext', '세부 ' + leaves.length + '개 중 ' + done + '개 완료');
    $('overall-progress').firstElementChild.style.width = percent + '%';
    const started = done > 0 || [...tasks,...leaves].some(t=>['in-progress','review'].includes(t.status));
    $('summary-state').textContent = leaves.length && done === leaves.length ? '세부 작업 완료' : started ? '구현 진행 중' : '아직 시작하지 않음';
    $('phase-all-count').textContent = tasks.length;
    $('phase-one-count').textContent = tasks.filter(t=>phaseOf(t)===1).length;
    $('phase-two-count').textContent = tasks.filter(t=>phaseOf(t)===2).length;
    $('phase-panels').innerHTML = [1,2].map(phase => {
      const group = tasks.filter(t=>phaseOf(t)===phase), children = units(group), count = doneCount(children);
      let label = group.length && group.every(isDone) ? '작업 완료' : group.some(t=>['in-progress','review'].includes(t.status)) ? '진행 중' : phase===2 && group.every(t=>t.status==='deferred') ? '전환 후 진행' : '대기';
      return '<article class="phase-card '+(phase===2?'later':'')+'"><div class="phase-top"><span class="phase-index">0'+phase+'</span><span class="phase-label">'+label+'</span></div><h3>'+escape(snapshot.plan.phaseLabels[phase])+'</h3><p class="phase-description">상위 '+group.length+'개 · 세부 '+children.length+'개</p><p class="phase-percent">'+ratio(count,children.length)+'<small>%</small></p><div class="track"><span style="width:'+ratio(count,children.length)+'%"></span></div><div class="phase-bottom"><span>세부 '+count+' / '+children.length+' 완료</span><span>상위 '+doneCount(group)+' / '+group.length+'</span></div></article>';
    }).join('');
    const active = tasks.find(t=>t.status==='in-progress') || tasks.find(t=>t.status==='review');
    const next = active || tasks.filter(isReady).sort((a,b)=>(['high','medium','low'].indexOf(a.priority)-['high','medium','low'].indexOf(b.priority))||Number(a.id)-Number(b.id))[0];
    if (next) {
      $('next-kind').textContent = active ? statusLabels[knownStatus(next.status)] : '착수 가능';
      const first = next.subtasks.find(s=>!isDone(s)&&s.status!=='cancelled');
      $('next-task').innerHTML = '<h2><span class="task-number">#'+escape(next.id)+'</span>'+escape(next.title)+'</h2><p>'+(first?'다음 세부 작업 · '+escape(next.id)+'.'+escape(first.id)+' '+escape(first.title):'세부 작업과 검증 기준을 확인해 주세요.')+'</p><button class="next-open" data-jump="'+escape(next.id)+'" type="button">이 작업 살펴보기 <span aria-hidden="true">↗</span></button>';
    } else {
      $('next-kind').textContent = tasks.length && tasks.every(isDone) ? '작업 완료' : '상태 확인';
      $('next-task').innerHTML = '<h2>'+(tasks.length&&tasks.every(isDone)?'등록된 상위 작업을 완료했어요':'착수 가능한 작업이 없어요')+'</h2><p>보류·차단 상태와 선행 작업, 각 검증 근거를 확인해 주세요.</p>';
    }
    summarizeWarnings();
  }

  function matches(task) {
    if (state.phase !== 'all' && phaseOf(task) !== Number(state.phase)) return false;
    if (state.status === 'ready' && !isReady(task)) return false;
    if (state.status === 'waiting' && !(task.status==='pending'&&!isReady(task))) return false;
    if (!['all','ready','waiting'].includes(state.status) && task.status !== state.status) return false;
    const query = state.query.trim().toLowerCase();
    if (!query) return true;
    const exact = query.match(/^#?(\d+)(?:\.(\d+))?$/);
    if (exact) return String(task.id)===exact[1] && (!exact[2] || task.subtasks.some(s=>String(s.id)===exact[2]));
    return [task.title,task.description,task.details,task.testStrategy,...task.subtasks.flatMap(s=>[s.title,s.description,s.details])].join(' ').toLowerCase().includes(query);
  }
  function dependencyButtons(task) {
    if (!task.dependencies.length) return '';
    return '<div class="dependency-list"><span>선행 작업</span>'+task.dependencies.map(dep=>{
      const node = nodeById(dep), parentId = String(dep).split('.')[0];
      return '<button type="button" class="dependency-link '+(isDone(node)?'complete':'')+'" data-jump="'+escape(parentId)+'" '+(!node?'disabled':'')+' aria-label="선행 작업 '+escape(dep)+' 보기">#'+escape(dep)+' · '+(node?statusLabels[knownStatus(node.status)]:'원본 없음')+'</button>';
    }).join('')+'</div>';
  }
  function taskMarkup(task) {
    const done = doneCount(task.subtasks), total = task.subtasks.length;
    const needs = unsatisfied(task), phase = phaseOf(task);
    const phaseLabel = snapshot.plan.phaseLabels[phase] || '미분류';
    const dependencies = task.dependencies.length ? '선행 '+task.dependencies.map(x=>'#'+x).join(' · ') : '선행 작업 없음';
    const warning = task.status==='pending' && needs.length ? ' · '+needs.length+'건 대기' : '';
    return '<details class="task '+(state.highlighted===task.id?'task-highlight':'')+'" id="task-'+escape(task.id)+'" data-task="'+escape(task.id)+'" data-status="'+escape(knownStatus(task.status))+'" '+(state.expanded.has(task.id)?'open':'')+'>'+
      '<summary aria-label="작업 '+escape(task.id)+' '+escape(task.title)+'"><div class="task-title"><span class="task-id">'+String(task.id).padStart(2,'0')+'</span><div><span class="task-name">'+escape(task.title)+'</span><p class="task-meta">'+escape(phaseLabel)+'<span class="sep">/</span>'+escape(dependencies)+escape(warning)+'</p></div></div>'+badge(task.status,isReady(task))+'<div class="task-progress"><div class="numbers"><span><b>'+done+'</b> / '+total+'</span><span>'+ratio(done,total)+'%</span></div><div class="track"><span style="width:'+ratio(done,total)+'%"></span></div></div><span class="disclosure" aria-hidden="true">＋</span></summary>'+
      '<div class="task-body"><p class="task-description">'+escape(task.description)+'</p>'+dependencyButtons(task)+'<div class="subtask-heading"><span>세부 작업 '+total+'개</span><span>우선순위 · '+escape(priorities[task.priority]||'미정')+'</span></div><ul class="subtasks">'+task.subtasks.map(child=>{
        const status = knownStatus(child.status);
        const childNeeds = child.dependencies.map(dep=>String(dep).includes('.')?String(dep):task.id+'.'+dep);
        return '<li class="subtask '+status+'" data-subtask="'+escape(task.id+'.'+child.id)+'"><span class="subtask-mark" aria-hidden="true">'+(isDone(child)?'✓':'')+'</span><div><p class="subtask-name"><span class="subtask-id">#'+escape(task.id+'.'+child.id)+'</span>'+escape(child.title)+'</p><details class="subtask-details"><summary>완료 조건'+(childNeeds.length?' · 선행 '+escape(childNeeds.map(x=>'#'+x).join(', ')):'')+'</summary><p>'+escape(child.details||child.description||'상위 작업의 검사 기준을 확인해 주세요.')+'</p></details></div>'+badge(child.status)+'</li>';
      }).join('')+'</ul><details class="implementation-detail"><summary>실행 상세 · 검증 기준</summary><div class="implementation-columns"><div><h4>실행 상세</h4><p>'+escape(task.details||'기록된 실행 상세가 없습니다.')+'</p></div><div><h4>검증 기준</h4><p>'+escape(task.testStrategy||'상위 계획의 검증 기준을 확인해 주세요.')+'</p></div></div></details></div></details>';
  }
  function renderWork() {
    visibleTasks = snapshot.tasks.filter(matches);
    $('tasks-list').innerHTML = visibleTasks.map(taskMarkup).join('');
    $('empty-state').hidden = visibleTasks.length !== 0;
    $('list-total').textContent = snapshot.tasks.length;
    $('visible-count').textContent = visibleTasks.length+' / '+snapshot.tasks.length+'개 표시';
    const allOpen = visibleTasks.length>0 && visibleTasks.every(t=>state.expanded.has(t.id));
    $('expand-all').innerHTML = allOpen?'모두 접기 <span aria-hidden="true">−</span>':'모두 펼치기 <span aria-hidden="true">＋</span>';
    $('expand-all').disabled = visibleTasks.length===0;
    $('reset').disabled = state.phase==='all' && state.status==='all' && !state.query;
    document.querySelectorAll('[data-phase]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.phase===state.phase)));
  }
  function renderGates() {
    $('gate-list').innerHTML = snapshot.plan.gates.map(gate=>{
      const total = gate.tasks.length, done = gate.tasks.filter(id=>isDone(taskById(id))).length;
      const results={passed:['done','검증 통과'],held:['deferred','활성화 보류'],pending:['pending','검증 대기']},result=Object.hasOwn(results,gate.result?.status)?results[gate.result.status]:null;
      const evidence=result?'<p class="gate-result"><span class="status '+result[0]+'" data-gate-result>'+result[1]+'</span></p><p class="fine-print" data-gate-detail>'+escape(gate.result.detail)+'</p>':'';
      return '<article class="gate" data-gate="'+escape(gate.id)+'"><span class="gate-code">'+escape(gate.id)+'</span><h3>'+escape(gate.name)+'</h3><p class="gate-count">연결 작업 '+done+' / '+total+' 완료</p><div class="track"><span style="width:'+ratio(done,total)+'%"></span></div>'+evidence+'<details><summary>확인 조건</summary><p>'+escape(gate.criteria)+'</p></details></article>';
    }).join('');
  }
  function renderSource() {
    const live = state.mode==='live';
    $('connection-mode').textContent = state.error?'마지막 확인 상태':live?'원본 연결 · 5초 갱신':state.mode==='imported'?'불러온 JSON 사본':'저장된 HTML 사본';
    $('connection-dot').className = 'connection-dot'+(state.error?' error':live?' live':'');
    $('freshness').textContent = '확인 '+dateText(snapshot.source.readAt)+' KST';
    $('source-time').textContent = '원본 수정 · '+dateText(snapshot.source.updatedAt)+' KST';
    $('mode-explanation').textContent = live?'로컬 서버가 Task Master 작업 JSON을 5초마다 읽습니다. 창이 보이지 않을 때는 자동 읽기를 쉽니다.':state.mode==='imported'?'선택한 JSON의 상태입니다. 자동 갱신은 잠시 멈춥니다.':'이 파일을 만든 시점의 상태입니다. 최신 상태는 로컬 대시보드 또는 원본 JSON 불러오기로 확인하세요.';
    $('resume-live').hidden = !canConnect || state.mode!=='imported';
    $('refresh').innerHTML = '<span aria-hidden="true">↻</span> '+(canConnect?'지금 새로고침':'JSON으로 갱신');
    $('refresh').disabled = state.fetching;
    $('refresh').setAttribute('aria-busy',String(state.fetching));
    $('data-warning').hidden = !state.error;
    $('data-warning').textContent = state.error;
  }
  function renderAll() { renderPlans(); renderOverview(); renderWork(); renderGates(); renderSource(); }

  function jump(id) {
    id = String(id);
    if (!taskById(id)) return;
    state.phase='all'; state.status='all'; state.query=''; state.highlighted=id; state.expanded.add(id);
    $('search').value=''; $('status-filter').value='all'; renderWork();
    requestAnimationFrame(()=>{
      const target=$('task-'+id); target?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
      target?.querySelector('summary')?.focus({preventScroll:true});
    });
  }
  function reset() { state.phase='all';state.status='all';state.query='';state.highlighted=null;$('search').value='';$('status-filter').value='all';renderWork(); }
  document.addEventListener('click',event=>{
    const plan=event.target.closest('[data-plan-id]');if(plan){switchPlan(plan.dataset.planId);return;}
    const target=event.target.closest('[data-jump]');if(target){jump(target.dataset.jump);return;}
    const phase=event.target.closest('[data-phase]');if(phase){state.phase=phase.dataset.phase;renderWork();}
  });
  $('tasks-list').addEventListener('toggle',event=>{
    const target=event.target;
    if(!target.matches('.task'))return;
    if(target.open)state.expanded.add(target.dataset.task);else state.expanded.delete(target.dataset.task);
    const allOpen=visibleTasks.length>0&&visibleTasks.every(t=>state.expanded.has(t.id));
    $('expand-all').innerHTML=allOpen?'모두 접기 <span aria-hidden="true">−</span>':'모두 펼치기 <span aria-hidden="true">＋</span>';
  },true);
  $('search').addEventListener('input',()=>{
    state.query=$('search').value;
    if(state.query.trim()) snapshot.tasks.filter(matches).forEach(t=>state.expanded.add(t.id));
    renderWork();
  });
  $('status-filter').addEventListener('change',()=>{state.status=$('status-filter').value;renderWork();});
  $('reset').addEventListener('click',reset);$('empty-reset').addEventListener('click',reset);
  $('expand-all').addEventListener('click',()=>{
    const close=visibleTasks.every(t=>state.expanded.has(t.id));
    visibleTasks.forEach(t=>close?state.expanded.delete(t.id):state.expanded.add(t.id));renderWork();
  });

  function validateSnapshot(data,expectedPlan=snapshot.plan.id) {
    if(data?.schemaVersion!==1||!Array.isArray(data.tasks)||!data.plan||!Array.isArray(data.plan.tasks)||!Array.isArray(data.plan.gates)||!data.source)throw new Error('invalid');
    if(data.plan.id!==expectedPlan)throw new Error('wrong_plan');
    if(!data.tasks.every(t=>numberId(t.id)&&typeof t.title==='string'&&Array.isArray(t.subtasks)&&Array.isArray(t.dependencies)&&t.subtasks.every(s=>numberId(s.id)&&typeof s.title==='string'&&Array.isArray(s.dependencies))))throw new Error('invalid');
    if(new Set(data.tasks.map(t=>String(t.id))).size!==data.tasks.length)throw new Error('duplicate');
  }
  async function refresh({manual=false}={}) {
    if(!canConnect){$('import-file').click();return;}
    if(state.fetching||(!manual&&state.mode==='imported'))return;
    const generation=++requestGeneration,selectedPlan=snapshot.plan.id;
    state.fetching=true;renderSource();
    try {
      const response=await fetch('/api/tasks?plan='+encodeURIComponent(selectedPlan),{cache:'no-store',signal:AbortSignal.timeout(4500)});
      if(!response.ok)throw new Error('source');
      const envelope=await response.json();
      if(generation!==requestGeneration||selectedPlan!==snapshot.plan.id||(!manual&&state.mode==='imported'))return;
      const data=envelope.planSnapshots && Object.hasOwn(envelope.planSnapshots,snapshot.plan.id)?envelope.planSnapshots[snapshot.plan.id]:envelope;
      validateSnapshot(data);
      const changed=data.source.hash!==snapshot.source.hash;
      if(envelope.catalog){
        if(!Array.isArray(envelope.catalog.plans)||!envelope.catalog.plans.length||envelope.catalog.plans.length>8||new Set(envelope.catalog.plans.map(p=>p.id)).size!==envelope.catalog.plans.length)throw new Error('invalid_catalog');
        for(const plan of envelope.catalog.plans){
          if(typeof plan.id!=='string'||typeof plan.label!=='string'||!Object.hasOwn(envelope.planSnapshots||{},plan.id))throw new Error('invalid_catalog');
          validateSnapshot(envelope.planSnapshots[plan.id],plan.id);
        }
        if(!envelope.catalog.plans.some(p=>p.id===data.plan.id))throw new Error('invalid_catalog');
        catalog=envelope.catalog;
      }
      if(envelope.planSnapshots)planSnapshots=envelope.planSnapshots;
      snapshot=data;state.mode='live';state.error='';
      if(changed){renderPlans();renderOverview();renderWork();renderGates();$('announcement').textContent='선택한 플랜의 Task Master 작업 상태를 갱신했습니다.';}
    } catch { if(generation===requestGeneration)state.error='원본 연결을 확인하지 못했어요. 마지막으로 읽은 상태를 유지합니다. 서버와 작업 JSON을 확인한 뒤 새로고침해 주세요.'; }
    finally {if(generation===requestGeneration){state.fetching=false;renderSource();}}
  }
  $('refresh').addEventListener('click',()=>refresh({manual:true}));
  $('resume-live').addEventListener('click',()=>refresh({manual:true}));
  $('import-button').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',async()=>{
    const file=$('import-file').files[0];if(!file)return;
    try{
      if(file.size>4_000_000)throw new Error('large');
      const raw=JSON.parse(await file.text());
      const collection=Object.hasOwn(raw,snapshot.source.tag)?raw[snapshot.source.tag]?.tasks:(snapshot.source.tag==='master'||raw.planId===snapshot.plan.id)?raw.tasks:null;
      if(!Array.isArray(collection))throw new Error('missing');
      const ids=new Set(snapshot.plan.tasks.map(t=>String(t.id)));
      const tasks=collection.filter(t=>ids.has(String(t.id))).map(t=>({id:String(t.id),title:t.title,description:t.description||'',details:t.details||'',testStrategy:t.testStrategy||'',status:t.status||'unknown',priority:t.priority||'medium',dependencies:Array.isArray(t.dependencies)?t.dependencies.map(String):[],subtasks:(t.subtasks||[]).map(s=>({id:String(s.id),title:s.title,description:s.description||'',details:s.details||'',status:s.status||'unknown',dependencies:Array.isArray(s.dependencies)?s.dependencies.map(String):[]}))}));
      if(!tasks.length || tasks.length!==ids.size || tasks.some(t=>!ids.has(t.id)))throw new Error('wrong_plan');
      const data={...snapshot,tasks,source:{...snapshot.source,mode:'imported',readAt:new Date().toISOString(),updatedAt:new Date(file.lastModified).toISOString(),hash:'imported-'+Date.now()}};
      validateSnapshot(data);requestGeneration++;state.fetching=false;snapshot=data;state.mode='imported';state.error='';renderAll();$('announcement').textContent='JSON의 작업 상태를 불러왔습니다. 원본 파일은 수정하지 않았습니다.';
    }catch{state.error='이 계획의 Task Master JSON을 읽지 못했어요. '+snapshot.source.tag+' 태그와 작업 형식을 확인해 주세요. 현재 표시는 유지합니다.';renderSource();}
    finally{$('import-file').value='';}
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&canConnect&&state.mode!=='imported')void refresh();});
  renderAll();
  if(canConnect){void refresh();pollTimer=setInterval(()=>{if(!document.hidden)void refresh();},5000);}
  window.addEventListener('pagehide',()=>clearInterval(pollTimer),{once:true});
})();
