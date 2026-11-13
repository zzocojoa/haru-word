import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {inspectPilotInputCandidatesV1,validatePilotCandidateRowsV1,capturePilotProviderBodiesV1} from './ai-quality-v147-pilot-input-preparation-v1.mjs';
const source=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),read=f=>JSON.parse(readFileSync(f,'utf8')),sha=x=>createHash('sha256').update(x).digest('hex'),fileSha=f=>sha(readFileSync(f));
const root=read(resolve(source,'.taskmaster/docs/ai-quality-v147-manifest.json')).baseline.existingDashboardRoot,ev=resolve(root,'outputs/ai-quality-v147-implementation-20261106'),out=resolve(process.env.QA_OUTPUT_DIR);
assert.ok(!relative(ev,out).startsWith('..')&&relative(ev,out).split(/[\\/]/).length===2&&!existsSync(resolve(dirname(out),'progress-final.json'))&&!existsSync(out));mkdirSync(out);
delete process.env.OPENAI_API_KEY;delete process.env.GOOGLE_API_KEY;delete process.env.GROQ_API_KEY;
let forbiddenNetworkAttempts=0;globalThis.fetch=async()=>{forbiddenNetworkAttempts++;throw Error('NETWORK_DISABLED');};
const p=inspectPilotInputCandidatesV1(source),stage=read(resolve(ev,p.bank.priorStageFile)),captureRoot=resolve(ev,'phase82/capture-final'),saved=read(resolve(captureRoot,'captured-bodies.json')),provenance=read(resolve(captureRoot,'bundle-provenance.json')),require=createRequire(import.meta.url);
test('All60 allocated inputs preserve6 strata,15 lessons,length and context coverage;known exact surfaces excluded without independence claims',()=>{
 assert.equal(p.bank.cases.length,60);assert.equal(p.report.grammarLessons,15);assert.equal(p.report.longCases,12);assert.equal(p.report.exactKnownMatches,0);assert.ok(p.report.knownSurfaceHashes>400);assert.deepEqual(Object.values(p.report.strata),Array(6).fill(10));assert.deepEqual([...new Set(p.bank.cases.map(x=>x.input.contextKind))].sort(),['command','reply','sentence','title']);assert.equal(p.report.structuralFamilyIndependenceVerified,false);assert.equal(p.report.sourceQualified,false);assert.equal(p.report.globalExposureCoverage,'partial');
});
test('Reject contaminated originals,duplicates,allocation drift,false qualification and invalid request length before capture',()=>{
 const known=new Map([[p.report.rows[0].normalizedSha256,[{kind:'test-known-original'}]]]);assert.throws(()=>validatePilotCandidateRowsV1(p.bank,stage,known),/KNOWN_ORIGINAL/);
 const duplicate=structuredClone(p.bank);duplicate.cases[1].input.sentence=duplicate.cases[0].input.sentence;assert.throws(()=>validatePilotCandidateRowsV1(duplicate,stage),/DUPLICATE_SENTENCE/);
 const drift=structuredClone(p.bank);drift.cases[0].lessonId='not-the-allocated-lesson';assert.throws(()=>validatePilotCandidateRowsV1(drift,stage),/SLOT_BINDING/);
 const falseClaim=structuredClone(p.bank);falseClaim.referenceQualified=true;assert.throws(()=>validatePilotCandidateRowsV1(falseClaim,stage),/DRAFT_CLAIMS/);
 const overlong=structuredClone(p.bank);overlong.cases[0].input.sentence='a'.repeat(2001);assert.throws(()=>validatePilotCandidateRowsV1(overlong,stage),/INPUT_SHAPE/);
});
test('Actual product factories reproduce all360 baseline/candidate requests without network,keys or private evaluation labels',async()=>{
 const profiles=provenance.profiles.map(x=>{assert.equal(fileSha(resolve(captureRoot,x.bundleFile)),x.bundleSha256);for(const[f,h]of Object.entries(x.productInputs))assert.equal(fileSha(resolve(x.sourceRoot,f)),h,f);return{id:x.phase,api:require(resolve(captureRoot,x.bundleFile))};});
 const actual=await capturePilotProviderBodiesV1({prepared:p,profiles});assert.equal(actual.records.length,360);assert.deepEqual(actual.records,saved.records);assert.equal(forbiddenNetworkAttempts,0);assert.equal(actual.builtWorkerOrD1Exercised,false);assert.equal(actual.mainDispatchAuthorized,false);
 assert.deepEqual(profiles.map(x=>x.api.AI_PROMPT_VERSION),['reference-v5','reference-v6']);assert.equal(read(resolve(source,'node_modules/zod/package.json')).version,read(resolve(source,'package-lock.json')).packages['node_modules/zod'].version);
 const mutated=structuredClone(p);mutated.bank.cases[0].input.sentence='Unapproved changed input.';await assert.rejects(capturePilotProviderBodiesV1({prepared:mutated,profiles}),/BANK_MUTATION/);
});
test('Old paid pins,scores and budget remain unchanged;prepared bodies grant no quality or dispatch qualification',()=>{
 for(const[f,h]of Object.entries(read(resolve(ev,'phase78/actual-prepared.json')).plan.sourceBindings))assert.equal(fileSha(resolve(source,f)),h,f);
 const score=read(resolve(ev,'phase78/actual-summary.json'));assert.equal(score.primary.matched,71);assert.equal(score.primary.axesMatched,72);
 const ledger='.taskmaster/docs/ai-quality-v147-evaluation-budget-ledger-v2.json';assert.equal(fileSha(resolve(source,ledger)),fileSha(resolve(root,ledger)));assert.equal(read(resolve(source,ledger)).availableMicros,'21583226');assert.equal(read(resolve(source,ledger)).reservedMicros,'0');
 writeFileSync(resolve(out,'summary.json'),JSON.stringify({passed:true,tests:4,cases:60,capturedBodies:360,actualProviderCalls:0,actualCountApiCalls:0,actualKeyReads:0,forbiddenNetworkAttempts,referenceQualified:false,familyIndependenceVerified:false,mainDispatchAuthorized:false,builtWorkerOrD1Exercised:false,oldScoresUnchanged:true,oldPaidSourcesUnchanged:true})+'\n');
});
