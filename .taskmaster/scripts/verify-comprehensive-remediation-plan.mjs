import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { PROJECT_ROOT, readDashboardSnapshot } from './openai-dashboard-data.mjs';

const TAG='comprehensive-remediation',PLAN='comprehensive-remediation-2026-11-05';
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const manifest=await json(resolve(PROJECT_ROOT,'.taskmaster/docs/comprehensive-remediation-manifest.json'));
const root=resolve(manifest.baseline.existingDashboardRoot),source=resolve(manifest.baseline.sourceRoot);
assert.equal(source,resolve(root,'work/comprehensive-defect-audit-20261105'));
const output=resolve(root,'outputs/comprehensive-remediation-plan-20261105');
const baseline=await json(resolve(output,'baseline.json'));
const auditBaseline=await json(resolve(root,'outputs/comprehensive-defect-audit-20261105/baseline.json'));
const expectedIds=['UI-1','UI-2','UI-3','UI-4','UI-5','AI-1','AI-2','AI-3','AI-4','AI-5','AI-6','DATA-1','DOCS-1','OPS-1','OPS-2','OPS-3','DASH-1','DASH-2','DASH-3','TEST-1','TEST-2','TEST-3','DEP-UNDICI','DEP-VITE','DEP-ZOD','DEP-SATORI','DEP-NEXT','DEP-FASTURI','DEP-MINIMATCH'].sort();
const sha=value=>createHash('sha256').update(value).digest('hex');
const checks=[];
const pass=name=>{checks.push({name,passed:true});console.log('PASS '+name);};
const children=tasks=>tasks.flatMap(t=>t.subtasks);
function validateGraph(tasks){
  const ids=new Map(tasks.map(t=>[Number(t.id),t]));
  assert.equal(ids.size,tasks.length,'duplicate task id');
  const visit=(id,active=new Set(),done=new Set())=>{
    assert.ok(ids.has(id),'missing dependency '+id);assert.ok(!active.has(id),'dependency cycle '+id);
    if(done.has(id))return;
    active.add(id);for(const dep of ids.get(id).dependencies)visit(Number(dep),active,done);active.delete(id);done.add(id);
  };
  for(const task of tasks){
    visit(Number(task.id));
    const siblings=new Map(task.subtasks.map(t=>[Number(t.id),t]));
    assert.equal(siblings.size,task.subtasks.length,'duplicate subtask id');
    const walk=(id,active=new Set(),done=new Set())=>{
      assert.ok(siblings.has(id),'missing sibling '+id);assert.ok(!active.has(id),'subtask cycle '+id);if(done.has(id))return;
      active.add(id);for(const dep of siblings.get(id).dependencies)walk(Number(dep),active,done);active.delete(id);done.add(id);
    };
    for(const child of task.subtasks)walk(Number(child.id));
  }
}
try{
  assert.equal(manifest.planId,PLAN);assert.equal(manifest.tag,TAG);assert.equal(manifest.scope,'planning-only');assert.equal(manifest.executionStarted,false);
  assert.equal(manifest.authorization.planningApproved,true);
  for(const field of ['implementationApproved','paidEvaluationApproved','deploymentIncludedAndApproved','externalPublicationApproved','productionQaWritesApproved'])assert.equal(manifest.authorization[field],false,field);
  assert.equal(manifest.authorization.newPaidEvaluationMaxUsdBeforeTax,0);
  assert.equal(manifest.authorization.priorBudgetsClosedAndNotTransferred,true);
  pass('planning authorization only; implementation/publication/payment/production writes unapproved');

  const a=await json(resolve(source,'.taskmaster/tasks/tasks.json')),b=await json(resolve(root,'.taskmaster/tasks/tasks.json'));
  assert.deepEqual(a[TAG],b[TAG]);
  const tasks=a[TAG].tasks;
  assert.equal(tasks.length,33);assert.equal(children(tasks).length,81);
  for(const node of [...tasks,...children(tasks)])assert.equal(node.status,'pending');
  assert.ok(tasks.every(t=>['high','medium','low'].includes(t.priority)));
  validateGraph(tasks);
  assert.deepEqual(manifest.tasks.map(t=>t.id),tasks.map(t=>t.id));
  for(const task of tasks)assert.equal(manifest.tasks.find(t=>t.id===task.id).subtaskCount,task.subtasks.length);
  for(const item of [...manifest.requirements,...manifest.gates])for(const id of item.tasks)assert.ok(tasks.some(t=>t.id===id),'missing manifest reference '+id);
  assert.deepEqual(manifest.requirements.map(r=>r.id).sort(),expectedIds.map(id=>'CR-'+id).sort());
  pass('33 parents/81 subtasks all pending; valid numeric references and acyclic parent/sibling graphs');
  for(const mode of ['cycle','missing','sibling-cycle','sibling-missing']){
    const invalid=structuredClone(tasks);
    if(mode==='cycle')invalid[0].dependencies=[2];
    if(mode==='missing')invalid[0].dependencies=[999];
    if(mode==='sibling-cycle')invalid[0].subtasks[0].dependencies=[2];
    if(mode==='sibling-missing')invalid[0].subtasks[0].dependencies=[999];
    assert.throws(()=>validateGraph(invalid));
  }
  pass('negative controls reject missing IDs and parent/subtask cycles');

  const backlog=await json(resolve(source,'docs/AUDIT_PRIORITY_BACKLOG_20261105.json'));
  const mapping=await json(resolve(source,'.taskmaster/docs/comprehensive-remediation-mapping.json'));
  assert.equal(mapping.tag,TAG);assert.equal(mapping.planId,PLAN);
  assert.deepEqual(backlog.tasks.map(t=>t.id).sort(),expectedIds);
  assert.deepEqual(mapping.mappings.map(t=>t.auditId).sort(),expectedIds);
  assert.equal(new Set(mapping.mappings.map(t=>t.taskId)).size,29);
  assert.deepEqual(manifest.issues.map(t=>t.auditId).sort(),expectedIds);
  for(const row of backlog.tasks){
    const link=mapping.mappings.find(x=>x.auditId===row.id),entry=manifest.issues.find(x=>x.auditId===row.id);
    assert.deepEqual(entry.auditRecord,row,'audit evidence changed '+row.id);
    assert.equal(link.originalPriority,row.priority);
    const task=tasks.find(t=>Number(t.id)===link.taskId);
    assert.ok(task.title.includes(row.id)&&task.title.includes(row.priority));
    assert.equal(task.priority,{P1:'high',P2:'medium',P3:'low'}[row.priority]);
    for(const field of ['actual','expected','evidence_level','evidence','limits','locations','regression'])assert.ok(task.details.includes(row[field]),row.id+' missing '+field);
    assert.ok(task.details.includes(link.existingTestGap));
    assert.deepEqual(task.subtasks.map(t=>task.id+'.'+t.id),link.subtaskIds);
    for(const child of task.subtasks){assert.ok(child.details.includes(row.actual));assert.ok(child.details.includes(row.limits));assert.ok(child.details.includes('회귀 검사:'));}
  }
  assert.equal(manifest.issues.filter(x=>x.kind==='product').length,12);
  assert.equal(manifest.issues.filter(x=>x.auditId.startsWith('DEP-')).length,7);
  assert.equal(manifest.issues.reduce((n,x)=>n+x.advisoryCount,0),23);
  pass('29/29 exact audit mappings; priorities/evidence/limits/acceptance retained; product12/tool10/dependency7 and advisory23 separated');

  const id=aid=>mapping.mappings.find(x=>x.auditId===aid).taskId;
  assert.ok(tasks[id('UI-4')-1].dependencies.includes(id('AI-6')));
  assert.ok(tasks[id('UI-2')-1].dependencies.includes(id('UI-5')));
  assert.ok(tasks[id('DEP-ZOD')-1].dependencies.includes(id('DATA-1')));
  for(const task of tasks.slice(3,30))for(const p1 of [2,3])assert.ok(task.dependencies.includes(p1));
  assert.deepEqual(tasks[30].dependencies,Array.from({length:29},(_,i)=>i+2));
  assert.deepEqual(tasks[31].dependencies,[31]);assert.deepEqual(tasks[32].dependencies,[32]);
  pass('P1-first dependency order; AI-6 before UI-4; UI-5/UI-2 and DATA-1/Zod coordination; quality/release/deploy separated');

  const complexity=await json(resolve(source,manifest.complexityReviewFile));
  assert.equal(complexity.aiToolExecuted,false);assert.equal(complexity.tasks.length,33);
  for(const task of tasks){const c=complexity.tasks.find(x=>x.taskId===task.id);assert.ok(c&&c.score>=1&&c.score<=10&&c.reason);assert.equal(c.recommendedSubtasks,task.subtasks.length);}
  assert.equal(manifest.gates.find(x=>x.id==='CR-G7').result.status,'held');assert.equal(manifest.gates.find(x=>x.id==='CR-PAID').result.status,'held');
  assert.ok(manifest.gates.filter(x=>/^CR-G[1-6]$/.test(x.id)).every(x=>x.result.status==='pending'));
  assert.deepEqual(manifest.baseline.originalGates,await json(resolve(root,'outputs/comprehensive-defect-audit-20261105/final-gates.json')));
  pass('manual complexity review/subdivision complete; implementation quality pending; historical failures and unapproved gates retained');

  for(const which of ['root','source']){
    const dir=which==='root'?root:source,old=baseline[which],current=which==='root'?b:a;
    for(const [tag,value]of Object.entries(old.tags))assert.deepEqual(current[tag],value,'historical tag '+which+'/'+tag);
    const registry=await json(resolve(dir,'.taskmaster/docs/dashboard-plans.json'));
    assert.equal(registry.defaultPlanId,PLAN);assert.equal(registry.plans.length,old.registry.plans.length+1);
    for(const previous of old.registry.plans){
      const now=registry.plans.find(x=>x.id===previous.id);assert.ok(now);
      const expected=structuredClone(previous);
      if(expected.kind==='current'){expected.kind='previous';expected.label=expected.label.replace('새 플랜','이전 플랜');}
      assert.deepEqual(now,expected,'history context/budget '+previous.id);
    }
    const allowed=new Set(['.taskmaster/README.md','.taskmaster/tasks/tasks.json','.taskmaster/docs/dashboard-plans.json','.taskmaster/dashboard/dashboard.css']);
    for(const [file,hash]of Object.entries(old.files))if(!allowed.has(file))assert.equal(sha(await readFile(resolve(dir,file))),hash,which+'/'+file);
    const css=await readFile(resolve(dir,'.taskmaster/dashboard/dashboard.css'),'utf8');
    const overlay='/* Audit source filenames must wrap in expanded task descriptions. */\n.task-description{overflow-wrap:anywhere}\n';
    assert.equal(css.replaceAll('\r\n','\n').split(overlay).length,2);
    // Compare normalized line endings because apply_patch preserves the original CRLF file.
    const originalCss=execFileSync('git',['show','HEAD:.taskmaster/dashboard/dashboard.css'],{cwd:source,encoding:'utf8'}).replaceAll('\r\n','\n');
    assert.equal(css.replaceAll('\r\n','\n').replace(overlay,''),originalCss);
    const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8'}).trim();
    assert.equal(git('branch','--show-current'),old.branch);assert.equal(git('rev-parse','HEAD'),old.head);
  }
  pass('both branches/HEAD unchanged; prior3 tag objects/history/product files unchanged; new-tag merge and one verified description-wrap CSS rule only');
  for(const [file,hash]of Object.entries(baseline.auditEvidence))assert.equal(sha(await readFile(resolve(root,file))),hash,file);
  for(const group of ['rootSourceHashes','oldEvidenceHashes','sealedEvaluationHashes'])for(const [file,hash]of Object.entries(auditBaseline[group]))assert.equal(sha(await readFile(resolve(root,file))),hash,group+'/'+file);
  pass('audit5 artifacts and 2089 raw evidence files preserved; original root637/evaluation32/sealed7 hashes unchanged');

  const artifacts=['.taskmaster/docs/comprehensive-remediation-prd.md','.taskmaster/docs/comprehensive-remediation-manifest.json','.taskmaster/docs/comprehensive-remediation-mapping.json','.taskmaster/docs/comprehensive-remediation-complexity.json','.taskmaster/docs/comprehensive-remediation-validation.json','.taskmaster/scripts/verify-comprehensive-remediation-plan.mjs','.taskmaster/scripts/test-comprehensive-remediation-dashboard.mjs','docs/COMPREHENSIVE_REMEDIATION_PLAN_20261105.md'];
  for(const file of artifacts)assert.equal(sha(await readFile(resolve(root,file))),sha(await readFile(resolve(source,file))),file);
  for(const entry of manifest.sources){assert.equal(entry.checkedDateKst,'2026-11-05');assert.ok(entry.url.startsWith('https://'));assert.equal(sha(await readFile(resolve(output,entry.id.toLowerCase()+'.txt'))),entry.sha256);}
  const prd=await readFile(resolve(source,manifest.prdFile),'utf8');
  for(const section of ['overview','functional-decomposition','structural-decomposition','dependency-graph','implementation-roadmap','test-strategy','architecture','risks','appendix'])assert.ok(prd.includes('<'+section+'>')&&prd.includes('</'+section+'>'));
  pass('ROOT/SOURCE new plan artifacts byte-identical; RPG sections and checked official-source hashes present');

  const health=await(await fetch('http://127.0.0.1:4318/api/health')).json();
  assert.equal(health.projectKey,sha(root).slice(0,20));
  const live=await(await fetch('http://127.0.0.1:4318/api/tasks')).json(),direct=await readDashboardSnapshot(root);
  assert.equal(live.plan.id,PLAN);assert.equal(live.source.tag,TAG);assert.equal(live.source.hash,direct.source.hash);
  assert.equal(live.tasks.length,33);assert.equal(children(live.tasks).length,81);
  assert.equal(live.catalog.plans.length,4);
  for(const [tag,p,c]of [['master',15,35],['judgment-remediation',18,49],['integration-remediation',12,41]]){
    const entry=Object.values(live.planSnapshots).find(x=>x.source.tag===tag);assert.equal(entry.tasks.length,p);assert.equal(children(entry.tasks).length,c);
  }
  assert.equal((await fetch('http://127.0.0.1:4318/api/tasks?plan=unknown')).status,400);
  assert.equal((await fetch('http://127.0.0.1:4318/api/tasks',{method:'POST'})).status,405);
  pass('actual4318 reads ROOT; new/old counts and source hash match; read-only/unknown-plan guards intact');
}catch(error){checks.push({name:error.message,passed:false});console.error(error);process.exitCode=1;}
await mkdir(output,{recursive:true});
const report={checkedAt:new Date().toISOString(),passed:checks.every(c=>c.passed),exitCode:process.exitCode||0,checks,counts:{parents:33,subtasks:81,auditMappings:29},scope:'planning structure, registration mapping, preservation and existing local dashboard only; product implementation/test/build/payment/publication not executed'};
await writeFile(resolve(output,'structure-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,checks:checks.length,exitCode:report.exitCode}));
