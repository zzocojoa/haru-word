import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {loadJointCohortContextV1,verifyJointCohortDraftV1} from './ai-quality-v147-joint-cohort-draft-v1.mjs';
const context=loadJointCohortContextV1(),file=resolve(context.root,process.env.QA_JOINT_DRAFT_FILE||'outputs/ai-quality-v147-implementation-20261106/phase191/joint-candidate-draft.json');
const bank=JSON.parse(readFileSync(file)),copy=()=>structuredClone(bank);
function text(c,s){c.sentence=s;c.inputCharacters=s.length;}

test('post-seal60 drafts preserve six strata/length allocation,30 Korean intentions and15 grammar lessons without claiming language/transport qualification',()=>{
 const r=verifyJointCohortDraftV1({bank,context});
 assert.equal(r.cases,60);assert.equal(r.wordCases,30);assert.equal(r.grammarCases,30);assert.equal(r.grammarLessons,15);assert.equal(r.longCases,12);
 assert.equal(r.explicitKoreanIntents,30);assert.equal(r.knownDevelopmentMatches,0);assert.equal(r.priorBankMatches,0);
 assert.equal(r.repeatedScaffoldGroups,0);assert.equal(r.independentFamiliesAdmitted,0);assert.equal(r.referenceQualified,false);
 assert.equal(bank.independentReferenceReviews,0);assert.equal(bank.applicationTransportVerified,false);assert.equal(bank.mainDispatchAuthorized,false);
 assert.equal(bank.actualProviderCalls,0);assert.equal(bank.actualCountCalls,0);assert.equal(bank.actualKeyReads,0);
});

test('a pre-seal timestamp or a different judge/product seal cannot inherit the current fresh-draft binding',()=>{
 const a=copy();a.createdAt='2026-11-01T00:00:00.000Z';assert.throws(()=>verifyJointCohortDraftV1({bank:a,context}),/JCD1_POST_FREEZE_TIME/);
 const b=copy();b.jointFreezeHash='0'.repeat(64);assert.throws(()=>verifyJointCohortDraftV1({bank:b,context}),/JCD1_FREEZE_BINDING/);
 const c=copy();c.referencePolicyHash='0'.repeat(64);assert.throws(()=>verifyJointCohortDraftV1({bank:c,context}),/JCD1_FREEZE_BINDING/);
});

test('reused prior-bank or public-calibration sentences are rejected, including normalized uppercase variants',()=>{
 const a=copy();text(a.cases[0],'THE KITE DRIFTED UNDER THE BRIDGE.');
 assert.throws(()=>verifyJointCohortDraftV1({bank:a,context}),/JCD1_OLD_BANK_INPUT/);
 const b=copy();text(b.cases[0],'MUSIC.');
 assert.throws(()=>verifyJointCohortDraftV1({bank:b,context}),/DEVF1_KNOWN_DEVELOPMENT_SURFACE/);
 const c=copy();text(c.cases[1],c.cases[0].sentence);
 assert.throws(()=>verifyJointCohortDraftV1({bank:c,context}),/JCD1_DUPLICATE_INPUT/);
});

test('shortened boundary cases, absent Korean intent and invented catalogue targets cannot silently reduce coverage',()=>{
 const a=copy();text(a.cases.find(c=>c.lengthBand==='near-boundary'),'A short replacement sentence.');
 assert.throws(()=>verifyJointCohortDraftV1({bank:a,context}),/JCD1_LENGTH_BAND/);
 const b=copy();b.cases[0].contextNote='';b.cases[0].contextCharacters=0;
 assert.throws(()=>verifyJointCohortDraftV1({bank:b,context}),/JCD1_BILINGUAL_INTENT/);
 const c=copy();c.cases[0].wordCatalogueEntryId='invented';
 assert.throws(()=>verifyJointCohortDraftV1({bank:c,context}),/JCD1_WORD_TARGET/);
 const d=copy();d.cases.find(c=>c.domain==='grammar').contextRole='intended_korean';
 assert.throws(()=>verifyJointCohortDraftV1({bank:d,context}),/JCD1_GRAMMAR_TARGET/);
 const e=copy();e.cases[1].allocationSlot=1;
 assert.throws(()=>verifyJointCohortDraftV1({bank:e,context}),/JCD1_CELL_BINDING/);
});

test('family relabeling and self-marked quality approval are not substitutes for independent review',()=>{
 const a=copy();a.cases[0].referenceQualified=true;
 assert.throws(()=>verifyJointCohortDraftV1({bank:a,context}),/JCD1_CASE_CLAIMS/);
 const b=copy();b.qualifiedReferences=60;b.referenceQualified=true;
 assert.throws(()=>verifyJointCohortDraftV1({bank:b,context}),/JCD1_NO_ADMISSION/);
 const c=copy();c.cases.forEach((item,i)=>{item.familyId='author-label-'+i;});
 const r=verifyJointCohortDraftV1({bank:c,context});assert.equal(r.independentFamiliesAdmitted,0);assert.equal(r.referenceQualified,false);
});

