import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const HERE=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const sha=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const m=await read(resolve(HERE,'.taskmaster/docs/ai-quality-v147-manifest.json')),SOURCE=m.baseline.sourceRoot,ROOT=m.baseline.existingDashboardRoot;
const gold=await read(resolve(SOURCE,m.goldPolicyFile)),contract=await read(resolve(SOURCE,gold.contractFile));
assert.equal(gold.contractFile,m.currentDecisionContractFile);assert.equal(await sha(resolve(SOURCE,gold.contractFile)),gold.contractSha256);
assert.deepEqual(gold.dimensions,contract.dimensions);assert.deepEqual(gold.criticalFields,contract.criticalFields);
for(const [key,value]of [['publicDevelopmentOnly',true],['freshHoldout',false],['actualModelJudgeMeasured',false],['qualifiedIndependentReview',false],['historicScoresModified',false],['newPaidCalls',0]])assert.equal(gold[key],value,key);
assert.equal(gold.developmentCases.length,12);assert.equal(new Set(gold.developmentCases.map(c=>c.id)).size,12);
assert.equal(gold.finalFreshGoldTemplate.preResultSealSha256,null);
console.log('PASS pre-result development-only five-dimension policy binds current contract; no live/independent/fresh-case claim');
const out=resolve(SOURCE,'work/ai-quality-gold-policy');await mkdir(out,{recursive:true});
await build({stdin:{contents:"export {parseJudgmentFeedback} from './lib/judgment-feedback-contract';",resolveDir:SOURCE,loader:'ts'},outfile:resolve(out,'runtime.mjs'),bundle:true,format:'esm',platform:'node',logLevel:'silent'});
const {parseJudgmentFeedback}=await import(pathToFileURL(resolve(out,'runtime.mjs')));
const parse=(c,a)=>parseJudgmentFeedback(JSON.stringify({...a,targetReason:'SYNTHETIC_REASON_NOT_TEACHING',grammarReason:'SYNTHETIC_REASON_NOT_TEACHING',correctionReason:a.correctedSentence&&a.correctedSentence!==c.original?'SYNTHETIC_REASON_NOT_TEACHING':'',expectedDimensionGrades:undefined}),c.original,'gpt-6.1-sol',c.input);
let tuples=0;
for(const c of gold.developmentCases){
 assert.ok(c.historyIds.length>0);assert.equal(c.use,'public-development-reference; never fresh pilot/confirmation');
 for(const a of c.allowedProductAlternatives){
  tuples++;assert.deepEqual(Object.keys(a.expectedDimensionGrades).sort(),[...contract.dimensions].sort());for(const value of Object.values(a.expectedDimensionGrades))assert.ok(gold.dimensionValues.includes(value));
  const f=parse(c,a);for(const field of ['meaningUsage','grammar','correctedSentence'])assert.equal(f[field],a[field],c.id+'/'+field);assert.doesNotMatch(f.explanation,/SYNTHETIC_REASON_NOT_TEACHING/);
  if(c.id==='G12')assert.doesNotMatch(f.explanation,/진행형/);
 }
}
console.log(`PASS actual current parser accepts all${tuples} declared safe development tuples; target/grammar separate and raw reasons absent`);
for(const p of gold.separationProbes){
 const c=gold.developmentCases.find(c=>c.id===p.caseId);assert.ok(c);assert.equal(parse(c,p.wire).correctedSentence,p.wire.correctedSentence);
 assert.equal(p.expectedDimensionGrades.grammar,'pass');assert.equal(p.expectedDimensionGrades.correction,'uncertain');assert.equal(p.expectedDimensionGrades.abstention,'fail');assert.ok(Object.values(p.expectedCriticalFlags).every(v=>v===false));
}
console.log('PASS unconfirmed modal-perfect alternative is parseable but not certified equivalent; grammar/uncertainty/critical references remain distinct');
assert.equal(await sha(resolve(SOURCE,gold.priorCriteria.file)),gold.priorCriteria.sha256);
for(const p of [m.goldPolicyFile,m.currentDecisionContractFile,'.taskmaster/scripts/verify-ai-quality-v147-gold-policy.mjs'])assert.equal(await sha(resolve(SOURCE,p)),await sha(resolve(ROOT,p)),p);
console.log('PASS prior criteria fingerprint and root/source references preserved');
console.log(JSON.stringify({passed:true,groups:4,developmentTuples:tuples,separationProbes:gold.separationProbes.length,modelJudgesExecuted:0,freshCases:0,qualifiedReview:false,scope:'Gold reference/contract verification only; semantic reference author is the same Codex session, not independently certified'}));
