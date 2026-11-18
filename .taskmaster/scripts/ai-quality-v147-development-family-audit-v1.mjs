// Local development-exposure and structural-review dossier. A negative surface
// screen never certifies family independence or admits an English reference.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest} from './ai-quality-v147-budget-v3.mjs';
import {normalizedExposureSentenceV1} from './ai-quality-v147-exposure-v1.mjs';
import {compileReferenceRoleCompactV1} from './ai-quality-v147-reference-role-compact-v1.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),read=f=>JSON.parse(readFileSync(f,'utf8'));
const check=(v,c)=>{if(!v)throw Error('DEVF1_'+c);};
const wordTokens=s=>s.normalize('NFKC').toLowerCase().match(/[a-z]+(?:['’][a-z]+)?|\d+/g)??[];
export const DEVELOPMENT_FAMILY_AUDIT_V1='ai-quality-v147-development-family-audit-v1';

export function buildDevelopmentFamilyAuditV1({programIndex,calibration,bank}){
 const base=structuredClone(programIndex),claimed=base.sha256;delete base.sha256;
 check(sha(JSON.stringify(base))===claimed&&base.protocol==='ai-quality-v147-current-program-exposure-snapshot-v1','PROGRAM_INDEX');
 check(calibration.hash===digest(calibration.plan)&&calibration.plan.publicDevelopmentOnly
  &&calibration.plan.policy.version===4&&calibration.plan.requests.length===6,'CALIBRATION');
 check(Array.isArray(bank.cases)&&bank.cases.length===60&&new Set(bank.cases.map(c=>c.caseId)).size===60,'BANK');
 const entries=new Map(base.entries.map(e=>[e.normalizedSha256,e])),calibrationSurfaces=new Set();let calibrationItems=0,added=0;
 for(const r of calibration.plan.requests)for(const item of r.privateOriginalData.items){
  const sentence=item.draft.input.sentence,h=sha(normalizedExposureSentenceV1(sentence));calibrationItems++;calibrationSurfaces.add(h);
  if(!entries.has(h)){entries.set(h,{normalizedSha256:h,origins:[]});added++;}
  entries.get(h).origins.push({kind:'public-reference-role-calibration',requestKey:r.key,requestSha256:r.requestSha256,itemId:item.itemId});
 }
 check(calibrationItems===60,'CALIBRATION_DENOMINATOR');
 const indexBasis={protocol:'ai-quality-v147-current-development-exposure-v1',parentProgramIndexHash:programIndex.sha256,
  calibrationPlanHash:calibration.hash,entries:[...entries.values()].sort((a,b)=>a.normalizedSha256.localeCompare(b.normalizedSha256)),
  counts:{programKnownSurfaces:base.entries.length,calibrationItems,calibrationUniqueSurfaces:calibrationSurfaces.size,
   newlyIncludedCalibrationSurfaces:added,combinedUniqueSurfaces:entries.size},coverage:'partial',
  completeProjectExposure:false,structuralFamiliesCertified:false,referenceQualified:false,mainDispatchAuthorized:false};
 const developmentIndex={...indexBasis,hash:digest(indexBasis)};
 const postings=new Map(),families=new Map();
 for(const c of bank.cases){
  check(['word','grammar'].includes(c.domain)&&['normal','needsCorrection','insufficientContext'].includes(c.assignment.stratum)
   &&typeof c.draft.input.sentence==='string'&&c.draft.input.sentence.length<=2000&&typeof c.assignment.familyId==='string','CASE');
  const tokens=wordTokens(c.draft.input.sentence);
  for(let i=0;i+12<=tokens.length;i++){
   const key=tokens.slice(i,i+12).join(' ');if(!postings.has(key))postings.set(key,new Set());postings.get(key).add(c.caseId);
  }
  const f=c.assignment.familyId;if(!families.has(f))families.set(f,[]);families.get(f).push(c.caseId);
 }
 const byMembers=new Map();
 for(const [text,ids]of postings)if(ids.size>1){
  const caseIds=[...ids].sort(),key=caseIds.join('|');
  if(!byMembers.has(key))byMembers.set(key,{caseIds,sharedRunHashes:[],exampleSharedWords:text});
  byMembers.get(key).sharedRunHashes.push(sha(text));
 }
 const scaffoldGroups=[...byMembers.values()].map(g=>({
  id:'scaffold-'+digest({ids:g.caseIds,runs:[...g.sharedRunHashes].sort()}).slice(0,24),caseIds:g.caseIds,
  distinctShared12WordRuns:g.sharedRunHashes.length,sharedRunHashes:[...g.sharedRunHashes].sort(),
  exampleSharedWords:g.exampleSharedWords,semanticFamilyEquivalenceVerified:false
 })).sort((a,b)=>b.distinctShared12WordRuns-a.distinctShared12WordRuns||a.id.localeCompare(b.id));
 const majorScaffoldGroups=scaffoldGroups.filter(g=>g.distinctShared12WordRuns>=2);
 const cases=bank.cases.map(c=>{
  const normalizedSha256=sha(normalizedExposureSentenceV1(c.draft.input.sentence)),known=entries.get(normalizedSha256);
  const scaffoldGroupIds=majorScaffoldGroups.filter(g=>g.caseIds.includes(c.caseId)).map(g=>g.id);
  const reasons=['provisional-family-label-is-not-independence-evidence'];
  if(known)reasons.push('known-development-surface');
  if(scaffoldGroupIds.length)reasons.push('shared-scaffold-requires-structural-review');
  if(families.get(c.assignment.familyId).length>1)reasons.push('declared-family-label-shared');
  return {caseId:c.caseId,domain:c.domain,stratum:c.assignment.stratum,declaredFamilyId:c.assignment.familyId,
   inputSha256:normalizedSha256,bankDraftHash:digest(c.draft),knownDevelopmentSurface:!!known,
   knownExposureOrigins:known?.origins??[],scaffoldGroupIds,reasonCodes:reasons,familyIndependenceVerified:false,
   referenceQualified:false,mainDispatchAuthorized:false};
 });
 const basis={protocol:DEVELOPMENT_FAMILY_AUDIT_V1,bankHash:digest(bank),programIndexHash:programIndex.sha256,
  calibrationPlanHash:calibration.hash,developmentIndexHash:developmentIndex.hash,cases,
  scaffoldRule:{wordRunLength:12,minimumDistinctSharedRuns:2,purpose:'Lexical overlap review flag only; not semantic family classification.'},
  scaffoldGroups,majorScaffoldGroups,
  sharedDeclaredLabels:[...families].filter(([,ids])=>ids.length>1).map(([familyId,caseIds])=>({familyId,caseIds})),
  counts:{cases:cases.length,declaredFamilyLabels:families.size,sharedDeclaredLabelGroups:[...families.values()].filter(v=>v.length>1).length,
   knownDevelopmentCases:cases.filter(c=>c.knownDevelopmentSurface).length,majorScaffoldGroups:majorScaffoldGroups.length,
   casesWithSharedScaffold:cases.filter(c=>c.scaffoldGroupIds.length).length},
  independentFamiliesAdmitted:0,semanticFamilyEquivalenceVerified:false,completeProjectExposure:false,
  referenceQualified:false,mainDispatchAuthorized:false,actualProviderCalls:0,actualCountCalls:0,actualKeyReads:0};
 return {developmentIndex,familyAudit:{...basis,hash:digest(basis)}};
}

export function assertNoKnownDevelopmentSurfacesV1({index,inputs}){
 const {hash,...basis}=index;check(hash===digest(basis)&&index.protocol==='ai-quality-v147-current-development-exposure-v1','INDEX_BINDING');
 check(Array.isArray(inputs)&&inputs.length>0&&inputs.length<=60,'INPUTS');
 const known=new Set(index.entries.map(e=>e.normalizedSha256));
 for(const input of inputs){
  check(typeof input.sentence==='string'&&input.sentence.isWellFormed()&&input.sentence.length>0&&input.sentence.length<=2000,'INPUT_TEXT');
  check(!known.has(sha(normalizedExposureSentenceV1(input.sentence))),'KNOWN_DEVELOPMENT_SURFACE');
 }
 return {knownSurfaceMatches:0,negativeScreenPassed:true,completeProjectExposure:false,familyIndependenceVerified:false,
  referenceQualified:false,mainDispatchAuthorized:false};
}

export function loadDevelopmentFamilyAuditV1(){
 const here=fileURLToPath(new URL('../..',import.meta.url)),m=read(resolve(here,'.taskmaster/docs/ai-quality-v147-manifest.json'));
 const source=resolve(m.baseline.sourceRoot),root=resolve(m.baseline.existingDashboardRoot);
 const p=read(resolve(root,'.taskmaster/docs/ai-quality-v147-current-program-templates-preparation-v1.json'));
 const b=read(resolve(root,'.taskmaster/docs/ai-quality-v147-bilingual-reference-record-preparation-v1.json'));
 const c=read(resolve(root,'.taskmaster/docs/ai-quality-v147-reference-role-compact-execution-v1.json'));
 const files={[p.indexFile]:p.indexSha256,[b.candidateFile]:b.candidateSha256,[c.preparedFile]:c.preparedSha256,
  [c.runtimeTerminalFile]:c.runtimeTerminalSha256};
 for(const[f,h]of Object.entries(files))check(sha(readFileSync(resolve(root,f)))===h,'EVIDENCE_BINDING');
 const calibration=read(resolve(root,c.preparedFile)),terminal=read(resolve(root,c.runtimeTerminalFile));
 check(calibration.hash===compileReferenceRoleCompactV1().hash&&terminal.planHash===calibration.hash
  &&terminal.actualProviderCalls===6&&terminal.records.length===6&&!terminal.failureCode&&terminal.inspection.matched===60,'ACTUAL_CALIBRATION');
 const result=buildDevelopmentFamilyAuditV1({programIndex:read(resolve(root,p.indexFile)),calibration,bank:read(resolve(root,b.candidateFile))});
 return {result,source,root,sourceBindings:files,programIndexFile:p.indexFile,bankFile:b.candidateFile,calibrationFile:c.preparedFile};
}

