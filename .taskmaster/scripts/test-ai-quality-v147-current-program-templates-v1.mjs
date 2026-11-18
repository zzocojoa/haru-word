import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {loadCurrentProgramTemplatesV1,buildCurrentProgramTemplatesV1,extendCurrentProgramIndexV1} from './ai-quality-v147-current-program-templates-v1.mjs';
import {buildProgramExposureAuditV1} from './ai-quality-v147-program-exposure-audit-v1.mjs';
const p=loadCurrentProgramTemplatesV1(),r=p.result,read=f=>JSON.parse(readFileSync(f)),sha=x=>createHash('sha256').update(x).digest('hex');
const corpus=read(resolve(p.sourceRoot,'.taskmaster/evaluation/ai-quality-v147/global-exposure-corpus-v1.json'));
const manner=readFileSync(resolve(p.sourceRoot,'lib/feedback-manner-adjectives.ts'),'utf8'),wordRows=read(resolve(p.sourceRoot,'data/words.json'));
const audit=read(resolve(p.dashboardRoot,p.auditFile));
const args=()=>({audit:structuredClone(audit),sourceTexts:{...p.sourceTexts},mannerSource:manner,wordRows:structuredClone(wordRows)});
function synthetic(text){
 const sources={'tests/synthetic-finite.test.mjs':text};
 return buildCurrentProgramTemplatesV1({audit:buildProgramExposureAuditV1({sources,existingCorpus:corpus}),sourceTexts:sources,mannerSource:manner,wordRows});
}
test('current15 frames are explicitly accounted:12 finite English,1 Korean UI,2 SQL; no test/SQL source execution',()=>{
 assert.deepEqual(r.counts,{candidateTemplates:15,englishTemplates:12,excludedSqlTemplates:2,excludedUiTemplates:1,unresolvedTemplates:0,adjectiveValues:14,
  loopGroups:5,generatedOccurrences:76,uniqueGeneratedSurfaces:69});
 assert.equal(r.completeForSelectedCandidateFrames,true);assert.equal(r.sourceExecutionPerformed,false);
 assert(r.generated.every(g=>!g.sentence.startsWith('DELETE')&&!/[가-힣]/.test(g.sentence)));
 assert(r.classifiedTemplates.every(g=>g.sourceExecutionPerformed===false));
 assert.equal(r.completeProjectExposure,false);assert.equal(r.structuralFamiliesCertified,false);assert.equal(r.mainDispatchAuthorized,false);
});
test('current source spans and tuple pairings reproduce69 historical surfaces without substituting stale template IDs',()=>{
 const historical=read(resolve(p.sourceRoot,'.taskmaster/evaluation/ai-quality-v147/program-template-expansions-v1.json')).result;
 assert.deepEqual(r.surfaces.map(x=>x.normalizedSha256).sort(),historical.surfaces.map(x=>x.normalizedSha256).sort());
 assert(r.classifiedTemplates.some(frame=>!historical.classifiedTemplates.some(old=>old.templateId===frame.templateId)));
 for(const frame of r.classifiedTemplates)for(const at of [frame.templateOrigin,frame.loopOrigin,frame.iterableOrigin].filter(Boolean)){
  const text=at.sourceFile==='lib/feedback-manner-adjectives.ts'?manner:p.sourceTexts[at.sourceFile];
  assert.equal(sha(text.slice(at.utf16Start,at.utf16End)),at.sourceSliceSha256);
 }
 for(const frame of r.classifiedTemplates.filter(x=>x.classification==='finite-English-test-text')){
  const generated=r.generated.filter(g=>g.templateId===frame.templateId);assert.equal(generated.length,frame.rows.length);
  for(const g of generated){assert.deepEqual(g.bindings,Object.fromEntries(frame.bindings.map((n,i)=>[n,frame.rows[g.iterationIndex][i]])));
   assert.equal(g.correctnessOrExpectedGradeAssigned,false);}
 }
});
test('changed source/audit/table evidence is rejected instead of inheriting old coverage',()=>{
 const changed=args(),file=Object.keys(changed.sourceTexts)[0];changed.sourceTexts[file]+='\n// changed';
 assert.throws(()=>buildCurrentProgramTemplatesV1(changed),/CPT1_SOURCE_BINDING/);
 const tamper=args();tamper.audit.files[0].sourceSha256='0'.repeat(64);assert.throws(()=>buildCurrentProgramTemplatesV1(tamper),/CPT1_AUDIT_BINDING/);
 const words=args();words.wordRows=words.wordRows.filter(w=>w.word!=='helpful');assert.throws(()=>buildCurrentProgramTemplatesV1(words),/CPT1_MANNER_PROVENANCE/);
});
test('calls, mutable/unknown loops and lexically shadowed holes remain unresolved; interpolation code never runs',()=>{
 const tick=String.fromCharCode(96),hole=name=>'$'+'{'+name+'}',literal=x=>tick+'They worked '+hole(x)+'.'+tick;
 const cases=[
  'for(const x of [["helpful"]]){'+literal('globalThis.FINITE_AUDIT_EXECUTED=true')+';}',
  'for(const x of getWords()){'+literal('x')+';}',
  'for(let x of [["helpful"]]){'+literal('x')+';}',
  'for(const x of [["helpful"]]){function f(x){return '+literal('x')+';}}',
  'for(const x of [["helpful"]]){(()=>{const x="harmful";return '+literal('x')+';})();}'
 ];
 for(const code of cases){const report=synthetic(code);assert.equal(report.counts.unresolvedTemplates,1);
  assert.equal(report.generated.length,0);assert.equal(report.completeForSelectedCandidateFrames,false);assert.equal(report.completeProjectExposure,false);}
 assert.equal(globalThis.FINITE_AUDIT_EXECUTED,undefined);
});
test('updated index retains all1,073 known hashes/origins and current finite evidence while60 candidate surfaces gain no automatic clearance',()=>{
 const base=read(resolve(p.dashboardRoot,'outputs/ai-quality-v147-implementation-20261106/phase186/current-program-exposure-index.json'));
 const before=JSON.stringify(base),index=extendCurrentProgramIndexV1({baseIndex:base,expansion:r,additionalSourceBindings:p.additionalSourceBindings});
 assert.equal(JSON.stringify(base),before);assert.equal(index.entries.length,1073);assert.equal(index.counts.currentUnexpandedTemplates,0);
 assert.equal(index.counts.currentFiniteUniqueSurfaces,69);assert.equal(index.counts.newUniqueFiniteSurfaces,0);
 for(const old of base.entries){const entry=index.entries.find(e=>e.normalizedSha256===old.normalizedSha256);
  for(const origin of old.origins)assert(entry.origins.some(x=>JSON.stringify(x)===JSON.stringify(origin)));}
 const known=new Set(index.entries.map(e=>e.normalizedSha256));for(const g of r.surfaces)assert(known.has(g.normalizedSha256));
 const bank=read(resolve(p.dashboardRoot,'outputs/ai-quality-v147-implementation-20261106/phase185/reference-candidates.json'));
 assert.equal(bank.cases.length,60);
 for(const c of bank.cases){const normalized=c.draft.input.sentence.normalize('NFKC').toLowerCase().replace(/\s+/gu,' ').trim();assert(!known.has(sha(normalized)));}
 assert.equal(index.completeForSelectedTestTemplates,true);assert.equal(index.allDynamicInputsEnumerated,false);
 assert.equal(index.completeProjectExposure,false);assert.equal(index.referenceQualified,false);assert.equal(index.mainDispatchAuthorized,false);
 const bad=structuredClone(r);bad.generated[0].sentence='tampered';assert.throws(()=>extendCurrentProgramIndexV1({baseIndex:base,expansion:bad}),/CPT1_EXPANSION_BINDING/);
});

