import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {PROJECT_ROOT,readDashboardSnapshot} from './openai-dashboard-data.mjs';

const TAG='comprehensive-remediation',PLAN='comprehensive-remediation-2026-11-05',final=process.argv.includes('--final');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const sha=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
const manifest=await json(resolve(PROJECT_ROOT,'.taskmaster/docs/comprehensive-remediation-manifest.json'));
const root=resolve(manifest.baseline.existingDashboardRoot),source=resolve(manifest.baseline.sourceRoot);
const output=resolve(root,'outputs/comprehensive-remediation-implementation-20261105');
const baseline=await json(resolve(output,'baseline.json'));
const audit=await json(resolve(root,'outputs/comprehensive-defect-audit-20261105/baseline.json'));
const checks=[];
const pass=name=>{checks.push({name,passed:true});console.log('PASS '+name);};
try{
 assert.equal(PROJECT_ROOT,source);assert.equal(manifest.tag,TAG);assert.equal(manifest.planId,PLAN);
 assert.equal(manifest.scope,'implementation-authorized');assert.equal(manifest.authorization.implementationApproved,true);
 for(const key of ['paidEvaluationApproved','deploymentIncludedAndApproved','externalPublicationApproved','productionQaWritesApproved'])assert.equal(manifest.authorization[key],false,key);
 assert.equal(manifest.authorization.newPaidEvaluationMaxUsdBeforeTax,0);
 for(const location of ['root','source']){
  for(const [command,value]of [['HEAD',baseline[location].head],['--abbrev-ref HEAD',baseline[location].branch]]){
   assert.equal(execFileSync('git',['rev-parse',...command.split(' ')],{cwd:baseline[location].path,encoding:'utf8'}).trim(),value);
  }
 }
 pass('authorized local scope; original branches/HEAD; publication/payment/production QA still excluded');
 const a=await json(resolve(source,'.taskmaster/tasks/tasks.json')),b=await json(resolve(root,'.taskmaster/tasks/tasks.json'));
 assert.deepEqual(a[TAG],b[TAG]);
 assert.deepEqual(manifest,await json(resolve(root,'.taskmaster/docs/comprehensive-remediation-manifest.json')));
 for(const location of ['root','source'])for(const [tag,value]of Object.entries(baseline[location].tags))if(tag!==TAG)assert.deepEqual((location==='root'?b:a)[tag],value);
 const tasks=a[TAG].tasks,children=tasks.flatMap(t=>t.subtasks),ids=new Map(tasks.map(t=>[String(t.id),t]));
 assert.equal(ids.size,33);assert.equal(children.length,81);
 for(const t of tasks)for(const c of t.subtasks)assert.equal(String(c.parentTaskId),String(t.id),'wrong parentTaskId '+t.id+'.'+c.id);
 assert.deepEqual(manifest.tasks.map(t=>String(t.id)),tasks.map(t=>String(t.id)));
 for(const t of tasks)assert.equal(manifest.tasks.find(m=>String(m.id)===String(t.id)).subtaskCount,t.subtasks.length);
 for(const item of [...manifest.requirements,...manifest.gates])for(const id of item.tasks)assert.ok(ids.has(String(id)),'missing manifest reference '+id);
 const graph=new Map();for(const t of tasks){graph.set(String(t.id),t.dependencies.map(String));for(const c of t.subtasks)graph.set(t.id+'.'+c.id,c.dependencies.map(id=>String(id).includes('.')?String(id):t.id+'.'+id));}
 const done=new Set();function visit(id,active=new Set()){
  assert.ok(graph.has(id),'missing dependency '+id);assert.ok(!active.has(id),'cycle '+id);if(done.has(id))return;
  active.add(id);for(const dep of graph.get(id))visit(dep,active);active.delete(id);done.add(id);
 }
 for(const id of graph.keys())visit(id);
 for(const t of tasks){if(Number(t.id)<=30||final&&Number(t.id)<=32){assert.equal(t.status,'done','unfinished parent '+t.id);assert.ok(t.subtasks.every(c=>c.status==='done'),'unfinished children '+t.id);}}
 if(final){assert.equal(ids.get('33').status,'deferred');assert.ok(ids.get('33').subtasks.every(c=>c.status==='deferred'));}
 const mapping=await json(resolve(source,manifest.mappingFile));
 const backlog=await json(resolve(source,'docs/AUDIT_PRIORITY_BACKLOG_20261105.json'));
 assert.deepEqual(mapping.mappings.map(m=>m.auditId).sort(),backlog.tasks.map(t=>t.id).sort());assert.equal(mapping.mappings.length,29);
 for(const m of mapping.mappings){assert.ok(ids.has(String(m.taskId)));for(const id of m.subtaskIds)assert.ok(graph.has(String(id)));}
 assert.equal(mapping.mappings.reduce((n,m)=>n+m.advisoryCount,0),23);
 pass('33/81 status and dependency graph; 29 mappings/23 original advisories; old three tags and ROOT/SOURCE preserved');
 for(const [path,hash]of Object.entries(baseline.frozenEvidenceHashes))assert.equal(await sha(resolve(root,path)),hash,path);
 for(const map of [audit.rootSourceHashes,audit.oldEvidenceHashes,audit.sealedEvaluationHashes])for(const [path,hash]of Object.entries(map))assert.equal(await sha(resolve(root,path)),hash,path);
 for(const file of ['COMPREHENSIVE_DEFECT_AUDIT_20261105.md','COMPREHENSIVE_DEFECT_AUDIT_20261105.findings.json','COMPREHENSIVE_DEFECT_AUDIT_20261105.coverage.json','AUDIT_PRIORITY_BACKLOG_20261105.json','AUDIT_PRIORITY_BACKLOG_20261105.csv'])assert.equal(await sha(resolve(source,'docs',file)),baseline.source.hashes['docs/'+file],file);
 assert.equal(await sha(resolve(source,'.openai/hosting.json')),baseline.source.hashes['.openai/hosting.json']);
 const config=await json(resolve(source,'dist/server/wrangler.json'));assert.equal(config.compatibility_date,'2026-05-15');
 pass('frozen audit five/raw evidence; original ROOT product/evaluation/sealed histories; hosting identity and Worker date preserved');
 const snapshot=await readDashboardSnapshot(root),live=await(await fetch('http://127.0.0.1:4318/api/tasks',{signal:AbortSignal.timeout(5000)})).json();
 assert.equal(snapshot.plan.id,PLAN);assert.equal(live.source.hash,snapshot.source.hash);assert.deepEqual(live.tasks,snapshot.tasks);
 assert.equal(snapshot.tasks.length,33);assert.equal(snapshot.tasks.flatMap(t=>t.subtasks).length,81);
 assert.equal(snapshot.planSnapshots['openai-api-migration-2026-11-03'].tasks.length,15);
 assert.equal(snapshot.planSnapshots['judgment-remediation-2026-11-03'].tasks.length,18);
 assert.equal(snapshot.planSnapshots['integration-remediation-2026-11-04'].tasks.length,12);
 if(final){for(const id of ['CR-G1','CR-G2','CR-G3','CR-G4','CR-G5','CR-G6'])assert.equal(manifest.gates.find(g=>g.id===id)?.result.status,'passed',id);for(const id of ['CR-G7','CR-PAID'])assert.equal(manifest.gates.find(g=>g.id===id)?.result.status,'held',id);}
 pass('actual 4318 source equals registered plan; historical plans separate; implementation/quality/publication gates distinct');
 if(final){
  const report=await json(resolve(source,manifest.implementationValidationFile));
  assert.equal(report.status,'ready-for-publication-review');assert.equal(report.planId,PLAN);assert.equal(report.tag,TAG);
  assert.equal(report.issues.length,29);assert.equal(report.issues.reduce((n,i)=>n+i.advisoryCount,0),23);
  assert.ok(report.checks.every(c=>c.exitCode===0));
  for(const [key,value]of Object.entries(report.evidence)){
   const prefix=key.startsWith('SOURCE:')?'SOURCE:':'ROOT:';
   assert.equal(await sha(resolve(prefix==='SOURCE:'?source:root,key.slice(prefix.length))),value.sha256,key);
  }
  for(const [name,hash]of Object.entries((await json(resolve(output,'qualified-source-hashes.json'))).files))assert.equal(await sha(resolve(source,name)),hash,name);
  for(const [name,hash]of Object.entries((await json(resolve(output,'qualified-build-hashes.json'))).files))assert.equal(await sha(resolve(source,'dist',name)),hash,name);
  assert.deepEqual(await json(resolve(root,manifest.implementationValidationFile)),report);
  for(const file of [manifest.releaseReadinessFile,'docs/COMPREHENSIVE_REMEDIATION_IMPLEMENTATION_20261105.md'])assert.equal(await sha(resolve(root,file)),await sha(resolve(source,file)),file);
  pass('readiness evidence hashes; qualified product/test/build source; ROOT/SOURCE review package agree');
 }
}catch(error){checks.push({name:error.message,passed:false});console.error(error);process.exitCode=1;}
await mkdir(output,{recursive:true});await writeFile(resolve(output,final?'verification-final.json':'verification-progress.json'),JSON.stringify({checkedAt:new Date().toISOString(),final,passed:checks.every(c=>c.passed),exitCode:process.exitCode||0,checks},null,2)+'\n');
