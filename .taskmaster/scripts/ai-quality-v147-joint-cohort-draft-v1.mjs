// Draft assembly and mechanical eligibility only. No language oracle, transport,
// API key lookup, product mutation or automatic independent-reference admission.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {digest} from './ai-quality-v147-budget-v3.mjs';
import {normalizedExposureSentenceV1} from './ai-quality-v147-exposure-v1.mjs';
import {assertNoKnownDevelopmentSurfacesV1,buildDevelopmentFamilyAuditV1} from './ai-quality-v147-development-family-audit-v1.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),read=f=>JSON.parse(readFileSync(f,'utf8'));
const check=(v,c)=>{if(!v)throw Error('JCD1_'+c);};
export const JOINT_COHORT_DRAFT_V1='ai-quality-v147-post-joint-freeze-draft-v1';

export function loadJointCohortContextV1(){
 const here=fileURLToPath(new URL('../..',import.meta.url)),m=read(resolve(here,'.taskmaster/docs/ai-quality-v147-manifest.json'));
 const source=resolve(m.baseline.sourceRoot),root=resolve(m.baseline.existingDashboardRoot),freezeFile=m.currentJointEvaluationFreezeFile;
 check(typeof freezeFile==='string','JOINT_FREEZE_REQUIRED');
 const freeze=read(resolve(root,freezeFile)),{hash,...basis}=freeze;
 check(hash===digest(basis)&&freeze.referencePolicyVersion===4&&freeze.nextCohortSize===60&&!freeze.referenceQualified&&!freeze.mainDispatchAuthorized,'FREEZE');
 const product=read(resolve(root,freeze.productSourceManifestFile));
 check(sha(readFileSync(resolve(root,freeze.productSourceManifestFile)))===freeze.productSourceManifestSha256,'PRODUCT_MANIFEST');
 for(const[f,h]of Object.entries(product.sourceFiles))check(sha(readFileSync(resolve(source,f)))===h,'PRODUCT_CHANGED');
 for(const[f,h]of Object.entries(freeze.referenceCodeBindings))check(sha(readFileSync(resolve(source,f)))===h,'JUDGE_CHANGED');
 const calibration=read(resolve(root,freeze.referencePolicyPreparedFile));
 check(sha(readFileSync(resolve(root,freeze.referencePolicyPreparedFile)))===freeze.referencePolicyPreparedSha256
  &&calibration.plan.policyHash===freeze.referencePolicyHash,'POLICY');
 const index=read(resolve(root,freeze.developmentIndexFile)),priorBank=read(resolve(root,freeze.priorBankFile));
 check(sha(readFileSync(resolve(root,freeze.developmentIndexFile)))===freeze.developmentIndexSha256
  &&sha(readFileSync(resolve(root,freeze.priorBankFile)))===freeze.priorBankSha256,'PRIOR_EVIDENCE');
 const program=read(resolve(root,'.taskmaster/docs/ai-quality-v147-current-program-templates-preparation-v1.json'));
 const programIndex=read(resolve(root,program.indexFile));
 check(sha(readFileSync(resolve(root,program.indexFile)))===program.indexSha256
  &&index.parentProgramIndexHash===programIndex.sha256,'PROGRAM_INDEX');
 const wordsFile='data/words.json',lessonsFile='data/grammar-index.json',words=read(resolve(source,wordsFile)),lessons=read(resolve(source,lessonsFile)).entries;
 return {source,root,freezeFile,freeze,index,programIndex,priorBank,calibration,words,lessons,
  sourceBindings:{[freezeFile]:sha(readFileSync(resolve(root,freezeFile))),[freeze.developmentIndexFile]:freeze.developmentIndexSha256,
   [freeze.priorBankFile]:freeze.priorBankSha256,[freeze.referencePolicyPreparedFile]:freeze.referencePolicyPreparedSha256,
   [program.indexFile]:program.indexSha256},
  productBindings:{[wordsFile]:sha(readFileSync(resolve(source,wordsFile))),[lessonsFile]:sha(readFileSync(resolve(source,lessonsFile)))}};
}

export function buildJointCohortDraftV1({rows,passages,createdAt,context}){
 const {freeze,words,lessons}=context;
 check(Array.isArray(rows)&&rows.length===60,'ROW_COUNT');
 const cases=rows.map(row=>{
  check(Array.isArray(row)&&row.length===13,'ROW_FIELDS');
  const [domain,stratum,allocationSlot,target,pos,meaning,familyHypothesis,rawSentence,contextNote,meaningUsage,grammar,contextNeeded,correctionSpec]=row;
  const sentence=rawSentence.startsWith('@')?passages[rawSentence.slice(1)]:rawSentence;
  check(typeof sentence==='string','PASSAGE');
  let correction=correctionSpec==='='?sentence:correctionSpec;
  if(correctionSpec&&typeof correctionSpec==='object'){
   check(typeof correctionSpec.from==='string'&&correctionSpec.from.length>0&&typeof correctionSpec.to==='string'
    &&sentence.split(correctionSpec.from).length===2,'EXPLICIT_AUTHOR_EDIT');
   correction=sentence.replace(correctionSpec.from,correctionSpec.to);
  }
  const id='joint-'+domain+'-'+stratum+'-'+String(allocationSlot).padStart(2,'0');
  const item={id,domain,stratum,allocationSlot,sentence,contextNote,contextKind:'sentence',
   lengthBand:allocationSlot<=4?'short':allocationSlot<=8?'ordinary':'near-boundary',
   inputCharacters:sentence.length,contextCharacters:contextNote.length,
   familyId:'joint-family-'+digest({id,familyHypothesis}).slice(0,24),familyHypothesis,
   authorDraft:{meaningUsage,grammar,contextNeeded,correction},authorDraftQualified:false,
   allowedCorrectionPolicy:'Examples are non-exhaustive author hypotheses; preserve supported intent, not literal identity.',
   difficultyIndependentlyReviewed:false,referenceQualified:false,familyIndependenceVerified:false,freshnessQualified:false};
  if(domain==='word'){
   const word=words.find(w=>w.word===target&&w.pos===pos);check(word,'WORD_CATALOGUE');
   item.wordTarget={word:target,pos,meaning,expression:target};item.contextRole='intended_korean';
   item.wordCatalogueEntryId=word.id;
  }else{check(domain==='grammar'&&lessons.some(l=>l.id===target),'LESSON');item.lessonId=target;}
  return item;
 });
 const bank={protocol:JOINT_COHORT_DRAFT_V1,status:'author-draft-after-joint-freeze;independent-review-pending',createdAt,
  jointFreezeFile:context.freezeFile,jointFreezeHash:freeze.hash,referencePolicyHash:freeze.referencePolicyHash,
  candidateFreezeSha256:freeze.candidateFreezeSha256,cases,wordCases:30,grammarCases:30,
  author:'Current Codex assistant; same-author AI hypotheses, not independent reference reviews.',
  authorHypothesesPresent:true,qualifiedExpectedGradesAuthored:false,independentReferenceReviews:0,qualifiedReferences:0,
  referenceQualified:false,familyIndependenceVerified:false,freshnessQualified:false,formalPilotCasesApproved:0,
  formalPilotGenerations:0,formalPilotGrades:0,actualProviderCalls:0,actualCountCalls:0,actualKeyReads:0,
  applicationBodiesCaptured:0,applicationTransportVerified:false,mainDispatchAuthorized:false,englishTruthCertified:false,
  priorBankPreserved:true,productAndJudgeSemanticsChanged:false};
 verifyJointCohortDraftV1({bank,context});return bank;
}

export function verifyJointCohortDraftV1({bank,context}){
 const {freeze,index,priorBank,words,lessons,calibration}=context;
 check(bank.protocol===JOINT_COHORT_DRAFT_V1&&bank.jointFreezeHash===freeze.hash&&bank.referencePolicyHash===freeze.referencePolicyHash,'FREEZE_BINDING');
 const freezeTime=Date.parse(freeze.observedAtUtc.replace(' UTC','Z').replace(' ','T'));
 check(Number.isFinite(Date.parse(bank.createdAt))&&Date.parse(bank.createdAt)>freezeTime,'POST_FREEZE_TIME');
 check(Array.isArray(bank.cases)&&bank.cases.length===60&&new Set(bank.cases.map(c=>c.id)).size===60,'DENOMINATOR');
 check(!bank.referenceQualified&&!bank.familyIndependenceVerified&&!bank.freshnessQualified&&!bank.mainDispatchAuthorized
  &&bank.qualifiedReferences===0&&bank.independentReferenceReviews===0&&bank.formalPilotGenerations===0,'NO_ADMISSION');
 const distribution={},hashes=new Set(),cells=new Set(),priorHashes=new Set(priorBank.cases.map(c=>sha(normalizedExposureSentenceV1(c.draft.input.sentence))));
 const grammarCoverage=new Map();
 for(const c of bank.cases){
  check(['word','grammar'].includes(c.domain)&&['normal','needsCorrection','insufficientContext'].includes(c.stratum)
   &&Number.isSafeInteger(c.allocationSlot)&&c.allocationSlot>=1&&c.allocationSlot<=10,'CELL');
  const cell=c.domain+'.'+c.stratum+'.'+c.allocationSlot;
  check(!cells.has(cell)&&c.id==='joint-'+c.domain+'-'+c.stratum+'-'+String(c.allocationSlot).padStart(2,'0'),'CELL_BINDING');cells.add(cell);
  check(typeof c.sentence==='string'&&c.sentence.isWellFormed()&&c.sentence===c.sentence.trim()&&c.sentence.length>0&&c.sentence.length<=2000
   &&typeof c.contextNote==='string'&&c.contextNote.isWellFormed()&&c.contextNote.length<=500&&c.contextKind==='sentence','INPUT');
  check(c.inputCharacters===c.sentence.length&&c.contextCharacters===c.contextNote.length,'LENGTH_METADATA');
  const band=c.allocationSlot<=4?'short':c.allocationSlot<=8?'ordinary':'near-boundary';
  check(c.lengthBand===band&&(band==='short'?c.sentence.length<=70:band==='ordinary'?c.sentence.length>=65&&c.sentence.length<500:c.sentence.length>=1800),'LENGTH_BAND');
  const hash=sha(normalizedExposureSentenceV1(c.sentence));check(!hashes.has(hash),'DUPLICATE_INPUT');hashes.add(hash);
  check(!priorHashes.has(hash),'OLD_BANK_INPUT');
  check(!c.authorDraftQualified&&!c.referenceQualified&&!c.familyIndependenceVerified&&!c.freshnessQualified&&!c.difficultyIndependentlyReviewed,'CASE_CLAIMS');
  check(['appropriate','needs_work','uncertain'].includes(c.authorDraft.meaningUsage)&&['natural','needs_work','uncertain'].includes(c.authorDraft.grammar)
   &&['none','message','time','quantity','target_meaning','relationship'].includes(c.authorDraft.contextNeeded)
   &&typeof c.authorDraft.correction==='string'&&c.authorDraft.correction.length<=2000,'AUTHOR_HYPOTHESIS');
  if(c.domain==='word'){
   check(c.contextRole==='intended_korean'&&/[가-힣]/.test(c.contextNote)&&c.contextNote.trim().length>0,'BILINGUAL_INTENT');
   check(words.some(w=>w.id===c.wordCatalogueEntryId&&w.word===c.wordTarget.word&&w.pos===c.wordTarget.pos)
    &&typeof c.wordTarget.meaning==='string'&&c.wordTarget.meaning.length>0,'WORD_TARGET');
  }else{
   check(c.contextRole===undefined&&lessons.some(l=>l.id===c.lessonId),'GRAMMAR_TARGET');
   grammarCoverage.set(c.lessonId,(grammarCoverage.get(c.lessonId)??0)+1);
  }
  const key=c.domain+'.'+c.stratum;distribution[key]??={short:0,ordinary:0,'near-boundary':0,total:0};
  distribution[key][band]++;distribution[key].total++;
 }
 check(digest(distribution)===digest(freeze.requiredAllocation),'ALLOCATION');
 check(grammarCoverage.size===15&&[...grammarCoverage.values()].every(n=>n===2),'GRAMMAR_COVERAGE');
 assertNoKnownDevelopmentSurfacesV1({index,inputs:bank.cases.map(c=>({sentence:c.sentence}))});
 // Mechanical overlap flags are a review aid; they never certify semantics.
 const familyView={cases:bank.cases.map(c=>({caseId:c.id,domain:c.domain,assignment:{stratum:c.stratum,familyId:c.familyId},draft:{input:{sentence:c.sentence}}}))};
 const report=buildDevelopmentFamilyAuditV1({programIndex:context.programIndex,calibration,bank:familyView}).familyAudit;
 check(report.counts.knownDevelopmentCases===0,'DEVELOPMENT_OVERLAP');
 return {cases:60,wordCases:30,grammarCases:30,grammarLessons:15,longCases:bank.cases.filter(c=>c.lengthBand==='near-boundary').length,
  distribution,sourceWordEntriesVerified:30,explicitKoreanIntents:30,knownDevelopmentMatches:0,priorBankMatches:0,
  repeatedScaffoldGroups:report.counts.majorScaffoldGroups,repeatedScaffoldCases:report.counts.casesWithSharedScaffold,
  lexicalOverlapScreenOnly:true,independentFamiliesAdmitted:0,referenceQualified:false,mainDispatchAuthorized:false};
}

