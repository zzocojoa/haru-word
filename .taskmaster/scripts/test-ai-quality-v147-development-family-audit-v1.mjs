import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {digest} from './ai-quality-v147-budget-v3.mjs';
import {loadDevelopmentFamilyAuditV1,buildDevelopmentFamilyAuditV1,assertNoKnownDevelopmentSurfacesV1} from './ai-quality-v147-development-family-audit-v1.mjs';
const p=loadDevelopmentFamilyAuditV1(),r=p.result,read=f=>JSON.parse(readFileSync(f));
const program=read(resolve(p.root,p.programIndexFile)),bank=read(resolve(p.root,p.bankFile)),calibration=read(resolve(p.root,p.calibrationFile));

test('actual public calibration adds three missing surfaces and blocks the bank case that test-only exposure missed',()=>{
 assert.deepEqual(r.developmentIndex.counts,{programKnownSurfaces:1073,calibrationItems:60,calibrationUniqueSurfaces:7,newlyIncludedCalibrationSurfaces:3,combinedUniqueSurfaces:1076});
 const matched=r.familyAudit.cases.filter(c=>c.knownDevelopmentSurface);
 assert.equal(matched.length,1);assert.equal(matched[0].caseId,'ko-word-needsCorrection-03');
 assert(matched[0].knownExposureOrigins.some(o=>o.kind==='public-reference-role-calibration'));
 const original=bank.cases.find(c=>c.caseId===matched[0].caseId).draft.input.sentence;
 assert.throws(()=>assertNoKnownDevelopmentSurfacesV1({index:r.developmentIndex,inputs:[{sentence:original.toUpperCase().replaceAll(' ','   ')}]}),/DEVF1_KNOWN_DEVELOPMENT_SURFACE/);
 assert.equal(program.entries.some(e=>e.normalizedSha256===matched[0].inputSha256),false);
});
test('six long cases share two lexical scaffolds; neither lexical overlap nor58 family labels certifies semantic independence',()=>{
 assert.deepEqual(r.familyAudit.counts,{cases:60,declaredFamilyLabels:58,sharedDeclaredLabelGroups:2,knownDevelopmentCases:1,majorScaffoldGroups:2,casesWithSharedScaffold:6});
 assert(r.familyAudit.majorScaffoldGroups.every(g=>g.caseIds.length===3&&g.distinctShared12WordRuns===97&&!g.semanticFamilyEquivalenceVerified));
 assert(r.familyAudit.cases.every(c=>!c.familyIndependenceVerified&&!c.referenceQualified&&!c.mainDispatchAuthorized));
 assert.equal(r.familyAudit.independentFamiliesAdmitted,0);
 const renamed=structuredClone(bank);renamed.cases.forEach((c,i)=>{c.assignment.familyId='new-label-'+i;});
 const audit=buildDevelopmentFamilyAuditV1({programIndex:program,calibration,bank:renamed}).familyAudit;
 assert.equal(audit.counts.declaredFamilyLabels,60);assert.equal(audit.independentFamiliesAdmitted,0);
 assert.equal(audit.counts.casesWithSharedScaffold,6);
});
test('the screen never turns an unknown input into a qualified reference, and source/index tampering is rejected',()=>{
 const pass=assertNoKnownDevelopmentSurfacesV1({index:r.developmentIndex,inputs:[{sentence:'A deliberately unpublished test probe rests beside an amber gauge.'}]});
 assert.equal(pass.negativeScreenPassed,true);assert.equal(pass.referenceQualified,false);assert.equal(pass.familyIndependenceVerified,false);assert.equal(pass.mainDispatchAuthorized,false);
 const index=structuredClone(r.developmentIndex);index.entries=[];
 assert.throws(()=>assertNoKnownDevelopmentSurfacesV1({index,inputs:[{sentence:'They worked.'}]}),/DEVF1_INDEX_BINDING/);
 const changed=structuredClone(calibration);changed.plan.requests[0].privateOriginalData.items[0].draft.input.sentence='Changed.';
 assert.throws(()=>buildDevelopmentFamilyAuditV1({programIndex:program,calibration:changed,bank}),/DEVF1_CALIBRATION/);
 const changedProgram=structuredClone(program);changedProgram.entries=[];
 assert.throws(()=>buildDevelopmentFamilyAuditV1({programIndex:changedProgram,calibration,bank}),/DEVF1_PROGRAM_INDEX/);
});
test('index augmentation preserves every previous origin and leaves the bank, program index and calibration unchanged',()=>{
 const before=digest({program,calibration,bank});
 const value=buildDevelopmentFamilyAuditV1({programIndex:program,calibration,bank});
 assert.equal(digest({program,calibration,bank}),before);
 for(const old of program.entries){const next=value.developmentIndex.entries.find(e=>e.normalizedSha256===old.normalizedSha256);
  for(const origin of old.origins)assert(next.origins.some(x=>digest(x)===digest(origin)));}
 assert.equal(value.developmentIndex.coverage,'partial');assert.equal(value.developmentIndex.completeProjectExposure,false);
 assert.equal(value.familyAudit.actualProviderCalls,0);assert.equal(value.familyAudit.actualCountCalls,0);assert.equal(value.familyAudit.actualKeyReads,0);
});

