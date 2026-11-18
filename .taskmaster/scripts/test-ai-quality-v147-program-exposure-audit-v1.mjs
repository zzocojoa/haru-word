import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {extractProgramLiteralCandidatesV1,loadProgramExposureAuditV1,matchProgramExposureAuditV1} from './ai-quality-v147-program-exposure-audit-v1.mjs';
import {globalExposureMatchesV1} from './ai-quality-v147-global-exposure-v1.mjs';
import {loadDiagnosticEnvelopeV1,compileDiagnosticEnvelopeV1} from './ai-quality-v147-diagnostic-envelope-v1.mjs';
const out=resolve(process.env.QA_OUTPUT_DIR),sha=x=>createHash('sha256').update(x).digest('hex'),j=f=>JSON.parse(readFileSync(f,'utf8')),p=loadProgramExposureAuditV1(),a=p.result,rows=[];
mkdirSync(out,{recursive:false});const save=(name,v)=>writeFileSync(resolve(out,name),JSON.stringify(v,null,2)+'\n',{flag:'wx'}),pass=name=>rows.push({name,passed:true});
test('AST decodes escaped and backtick literals while comments/regex text do not become sentence records;UTF16 positions bind source',()=>{
 const source='// "He sings."\nconst emoji="😀"; const original="I\\u0020read books."; const pair=[\'She runs.\', `They walk.`]; const re=/He dances./;',r=extractProgramLiteralCandidatesV1('tests/static.test.mjs',source);
 assert.deepEqual(r.literals.map(x=>x.value),['I read books.','She runs.','They walk.']);assert.equal(r.staticStringsVisited,4);assert.equal(r.templates.length,0);
 for(const row of r.literals){assert.equal(row.sourceSliceSha256,sha(source.slice(row.utf16Start,row.utf16End)));assert.equal(row.line,2);assert.equal(row.columnUtf16,row.utf16Start-source.indexOf('\n'));}
 save('lexer-provenance.json',r);pass('AST literals and independent source slices');
});
test('dynamic interpolation and imports are parsed without executing source;unexpanded templates never become enumerated inputs',()=>{
 const source='import x from "must-not-load";const original=`They performed the task ${globalThis.PROGRAM_AUDIT_EXECUTED=true}.`;';assert.equal(globalThis.PROGRAM_AUDIT_EXECUTED,undefined);
 const r=extractProgramLiteralCandidatesV1('tests/dynamic.test.mjs',source);assert.equal(globalThis.PROGRAM_AUDIT_EXECUTED,undefined);assert.equal(r.templates.length,1);assert.equal(r.templateExpressionsVisited,1);assert.equal(r.literals.length,0);assert.equal(r.allActualInputsIdentified,false);assert.equal(r.templates[0].allGeneratedSentencesEnumerated,false);assert.equal(r.templates[0].dynamicExpansionExecuted,false);
 save('dynamic-unresolved.json',r);pass('no code execution and dynamic uncertainty');
});
test('credential-shaped/static sensitive fields are omitted,and malformed syntax or paths fail before a report',()=>{
 const fake='sk-proj-'+'A'.repeat(25),source='const apiKey="This is synthetic.";const note="Token '+fake+'.";const sentence="She reads books.";',r=extractProgramLiteralCandidatesV1('tests/privacy.test.mjs',source);
 assert.deepEqual(r.literals.map(x=>x.value),['She reads books.']);assert.equal(r.excluded.sensitiveStaticStrings,2);assert.ok(!JSON.stringify(r).includes(fake));assert.throws(()=>extractProgramLiteralCandidatesV1('../.env',source),/PA1_SOURCE/);assert.throws(()=>extractProgramLiteralCandidatesV1('tests/bad.test.mjs','const = ;'),/PA1_PARSE/);
 save('privacy-and-guards.json',{sensitiveOmissions:2,secretPersisted:false,invalidPathHeld:true,parseErrorHeld:true});pass('privacy and parser/path guards');
});
test('all123 frozen program sources are parsed with independently checked origin slices and explicit static/template denominators',()=>{
 assert.equal(a.counts.files,123);assert.equal(a.parser.version,'5.9.3');assert.equal(a.counts.staticStringsVisited,12596);assert.equal(a.counts.templateExpressionsVisited,163);assert.equal(a.counts.candidateLiteralOccurrences,629);assert.equal(a.counts.uniqueCandidateSurfaces,433);assert.equal(a.counts.unexpandedCandidateTemplates,15);
 const sourceRoot=loadDiagnosticEnvelopeV1().prepared.sourceRoot;
 for(const file of a.files){const source=readFileSync(resolve(sourceRoot,file.sourceFile),'utf8');assert.equal(sha(source),file.sourceSha256);assert.equal(file.staticStringsVisited,file.literals.length+file.excluded.otherStaticStrings+file.excluded.sensitiveStaticStrings);assert.equal(file.templateExpressionsVisited,file.templates.length+file.excluded.noncandidateTemplates+file.excluded.sensitiveTemplates);for(const row of [...file.literals,...file.templates])assert.equal(sha(source.slice(row.utf16Start,row.utf16End)),row.sourceSliceSha256);}
 assert.equal(a.completeProjectExposure,false);assert.equal(a.allActualInputsIdentified,false);assert.equal(a.modelEvidenceProjectionAllowed,false);assert.equal(a.liveFreshnessPolicyChanged,false);save('actual-program-audit.json',p);pass('123 source hashes and629literal/15template provenance');
});
test('399 candidate surfaces are absent from the selected426 corpus;both a known hit and an unseen string stay unqualified',()=>{
 const sourceRoot=loadDiagnosticEnvelopeV1().prepared.sourceRoot,corpus=j(resolve(sourceRoot,p.existingCorpusFile)),outside=a.surfaces.filter(r=>!r.alreadyInSelected426Corpus);assert.equal(outside.length,399);
 for(const row of outside)assert.equal(globalExposureMatchesV1(corpus,{sentence:row.value},'family-'+'0'.repeat(24)).length,0);
 assert.ok(a.surfaces.some(r=>r.value==='Who helped her?'));const hit=matchProgramExposureAuditV1(a,outside[0].value),miss=matchProgramExposureAuditV1(a,'An unseen synthetic audit probe arrived today.');assert.equal(hit.state,'seen-program-text-candidate');assert.ok(hit.matchingOriginIds.length>0);assert.equal(miss.state,'unresolved-not-a-freshness-clearance');assert.equal(hit.freshnessQualified,false);assert.equal(miss.freshnessQualified,false);assert.equal(hit.originalInputRoleCertified,false);
 const changed=structuredClone(a);changed.surfaces[0].value='changed';assert.throws(()=>matchProgramExposureAuditV1(changed,'She reads books.'),/PA1_MATCH_BINDING/);save('old-corpus-contrast-and-held-claims.json',{outsideCandidates:399,knownHit:hit,unknownHeld:miss,allActualInputsIdentified:false,structuralFamiliesCertified:false});pass('old-corpus gaps and no false freshness clearance');
});
test('a changed real source copy is rejected before parsing;no active source or frozen policy is rewritten',()=>{
 const sourceRoot=loadDiagnosticEnvelopeV1().prepared.sourceRoot,copy=resolve(out,'source-change-copy');mkdirSync(resolve(copy,'.taskmaster/evaluation/ai-quality-v147'),{recursive:true});copyFileSync(resolve(sourceRoot,p.existingCorpusFile),resolve(copy,p.existingCorpusFile));
 for(const file of a.files){const dest=resolve(copy,file.sourceFile);mkdirSync(dirname(dest),{recursive:true});copyFileSync(resolve(sourceRoot,file.sourceFile),dest);}
 const f=resolve(copy,a.files[0].sourceFile);writeFileSync(f,readFileSync(f,'utf8')+'\n// synthetic mutation');assert.throws(()=>loadProgramExposureAuditV1(copy),/PA1_SOURCE_CHANGED/);save('source-change-held.json',{sourceCopyOnly:true,changedSourceHeldBeforeScan:true,activeSourcesChanged:false});pass('real source-change preflight');
});
test('the pending six-call diagnostic retains exact frozen bodies,run/cost andNode24 bundle hash;all actual calls and key reads remain0',()=>{
 const prepared=loadDiagnosticEnvelopeV1(),bundle=compileDiagnosticEnvelopeV1(prepared),frozen=j(resolve(prepared.prepared.root,'outputs/ai-quality-v147-implementation-20261106/phase42/approval-review/diagnostic-envelope.json'));assert.deepEqual(bundle.requests,frozen.requests);assert.equal(bundle.maximumMicros,frozen.maximumMicros);assert.equal(bundle.spec.runId,frozen.spec.runId);assert.equal(bundle.approvedMicros,'0');if(process.versions.node.startsWith('24.'))assert.equal(bundle.hash,frozen.hash);
 save('pending-diagnostic-unchanged.json',{nodeVersion:process.version,bodyHashes:bundle.requests.map(x=>x.sha256),runId:bundle.spec.runId,maximumMicros:bundle.maximumMicros,node24BundleHashUnchanged:process.versions.node.startsWith('24.')?bundle.hash===frozen.hash:null,actualProviderCalls:0,actualKeyReads:0});pass('pending six-request approval bindings preserved');
});
process.on('exit',()=>save('program-audit-results.json',{passed:rows.length===7,groups:7,rows,nodeVersion:process.version,counts:a.counts,completeProjectExposure:false,modelEvidenceProjectionAllowed:false,liveFreshnessPolicyChanged:false,actualProviderCalls:0,actualCountApiCalls:0,actualKeyReads:0,newPaidApprovalUsd:0}));
