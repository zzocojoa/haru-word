// Explicit synthetic Windows recovery. Original bytes are archived before
// roll-forward; no provider, credentials, resend, reset or capture completion.
import {readFileSync,writeFileSync,readdirSync,lstatSync,fstatSync,realpathSync,mkdirSync,openSync,fsyncSync,closeSync,renameSync,unlinkSync,existsSync} from 'node:fs';
import {resolve,dirname,basename,isAbsolute} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {compileBudgetV3,digest} from './ai-quality-v147-budget-v3.mjs';
import {readV3Journal,readV3CommittedPrefix,inspectV3Pending,JOURNAL_V3} from './ai-quality-v147-journal-v3.mjs';
import {observeProcess,ownProcessIdentity,acquireRecoveryMutex} from './ai-quality-v147-process.mjs';
import {readV3SettlementProof} from './ai-quality-v147-settlement-proof-v3.mjs';
export const RECOVERY_V3='ai-quality-v147-recovery-v3';
const check=(ok,code)=>{if(!ok)throw Error('R3_'+code);};
const sha=x=>createHash('sha256').update(x).digest('hex'),bytes=x=>Buffer.from(JSON.stringify(x)+'\n','utf8');
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x),hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const recoveryNonce=(inspectionHash,salt)=>{const h=digest({protocol:RECOVERY_V3,inspectionHash,salt});return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const fields=(x,n)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===[...n].sort().join('|');
const known=e=>typeof e?.message==='string'&&(/^(?:R3|J3|P3)_[A-Z0-9_]+$/.test(e.message)||/^(?:RECOVERY_MUTEX_BUSY_OR_FAILED|MUTEX_HELPER_GONE|MUTEX_ARCHIVE_(?:TIMEOUT|REFUSED_(?:PARSE|FIELDS|READ|HASH|MOVE)))$/.test(e.message))?e.message:'R3_IO';
function regular(f){const s=lstatSync(f);check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1,'NONREGULAR');return s;}
function raw(f,max=64*1024*1024){const before=regular(f);check(before.size<=max,'FILE_SIZE');const fd=openSync(f,'r');try{const a=fstatSync(fd);check(a.ino===before.ino&&a.dev===before.dev&&a.nlink===1,'READ_REPLACED');const b=readFileSync(fd),z=fstatSync(fd),last=regular(f);check(b.length===a.size&&z.size===a.size&&z.mtimeMs===a.mtimeMs&&last.ino===a.ino&&last.dev===a.dev,'READ_CHANGED');return b;}finally{closeSync(fd);}}
function parse(f){try{return JSON.parse(raw(f).toString('utf8'));}catch(e){if(e.message?.startsWith('R3_'))throw e;throw Error('R3_JSON');}}
function durable(f,b){const fd=openSync(f,'wx',0o600);try{writeFileSync(fd,b);fsyncSync(fd);}finally{closeSync(fd);}check(raw(f).equals(b),'WRITE_READBACK');}
function scope(context){
 check(process.platform==='win32'&&context&&isAbsolute(context.allowedRoot)&&isAbsolute(context.directory),'SYNTHETIC_WINDOWS_SCOPE');check(!context.allowedRoot.split(/[\\/]/).some(p=>/^(?:\.env(?:[._-].*)?|\.sites-runtime|\.wrangler|\.git)$/i.test(p)),'PROTECTED_ROOT');
 const root=realpathSync(context.allowedRoot);check(root===resolve(context.allowedRoot)&&!lstatSync(root).isSymbolicLink(),'ROOT_LINK');const k=compileBudgetV3(context.spec);check(k.spec.mode==='synthetic','SYNTHETIC_ONLY');const path=resolve(context.directory);check(path===resolve(root,'v3-'+k.spec.runId)&&dirname(path)===root&&!lstatSync(path).isSymbolicLink()&&realpathSync(path)===path,'RUN_SCOPE');return {root,path,k};
}
function validateOwner(c,o){
 check(fields(o,['schemaVersion','protocol','runId','stage','specHash','directoryHash','nonce','pid','identity'])&&o.schemaVersion===3&&o.protocol===JOURNAL_V3&&o.runId===c.k.spec.runId&&o.stage===c.k.spec.profile.stage&&o.specHash===c.k.specHash&&o.directoryHash===digest(c.path)&&uuid(o.nonce)&&Number.isSafeInteger(o.pid)&&o.pid>0,'OWNER');const i=o.identity;
 check(fields(i,['platform','pid','createdAt','commandHash','executableHash'])&&i.platform==='win32'&&i.pid===o.pid&&typeof i.createdAt==='string'&&i.createdAt.length>0&&hash(i.commandHash)&&hash(i.executableHash),'OWNER_IDENTITY');
}
function absentOrReleasedSelf(c,o,locked){
 validateOwner(c,o);const seen=observeProcess(o.pid);check(seen.status!=='unknown','OWNER_UNKNOWN');if(seen.status==='absent')return 'confirmed-absent';check(digest(seen.identity)===digest(o.identity),'PID_IDENTITY_CHANGED');check(!locked&&o.pid===process.pid&&digest(o.identity)===digest(ownProcessIdentity()),'OWNER_LIVE');return 'self-unlocked';
}
function bindings(c,names){return Object.fromEntries(names.filter(n=>n!=='LOCK.json').sort().map(n=>{check(/^(?:HEAD\.json|CHAIN\.jsonl|PENDING\.json|HEAD-[a-f0-9-]{36}\.tmp)$/.test(n),'FOREIGN_FILE');return [n,sha(raw(resolve(c.path,n)))];}));}
const auditPath=(c,o)=>resolve(c.root,'v3-'+c.k.spec.runId+'-recovery-'+o.nonce);
function auditDirectory(c,path){check(dirname(path)===c.root&&!lstatSync(path).isSymbolicLink()&&realpathSync(path)===path,'AUDIT_SCOPE');}
function verifySettlementProofs(context,ledger,proofs,settlementProof){
 check(Array.isArray(proofs)&&new Set(proofs.map(x=>x?.key)).size===proofs.length,'CAPTURE_PROOFS');
 for(const p of proofs){try{check(digest(readV3SettlementProof({bridge:settlementProof,context,ledger,key:p.key,expectedResult:p.result}))===digest(p),'CAPTURE_CHANGED');}catch{throw Error('R3_PHYSICAL_CAPTURE_REQUIRED');}}
}
function collectSettlementProofs(context,ledger,operations,settlementProof){
 const expected=new Map(Object.entries(ledger.slots).filter(([,r])=>r.result!==null).map(([key,r])=>[key,r.result]));
 for(const op of operations.filter(op=>op.kind==='settle')){check(!expected.has(op.key)||digest(expected.get(op.key))===digest(op.result),'SETTLEMENT_CHANGED');expected.set(op.key,op.result);}
 if(expected.size===0)return [];check(settlementProof,'PHYSICAL_CAPTURE_REQUIRED');const proofs=[];
 for(const [key,result]of [...expected].sort(([a],[b])=>a<b?-1:a>b?1:0)){try{proofs.push(readV3SettlementProof({bridge:settlementProof,context,ledger,key,expectedResult:result}));}catch{throw Error('R3_PHYSICAL_CAPTURE_REQUIRED');}}
 return proofs;
}
function linkedAudit(c,lock,currentFiles,context,ledger,settlementProof){
 const folder=auditPath(c,lock);if(!existsSync(folder))return null;auditDirectory(c,folder);const inspection=parse(resolve(folder,'inspection.json'));
 check(inspection.schemaVersion===3&&inspection.protocol===RECOVERY_V3&&digest(inspection.owner)===digest(lock)&&inspection.plan?.inspectionHash===digest(inspection.plan?.basis),'AUDIT_BINDING');const b=inspection.plan.basis;
 check(fields(b,['schemaVersion','protocol','runId','specHash','directoryHash','head','files','lockHash','lockObservation','linkedAudit','pending','action',...(Object.hasOwn(b,'settlementProofs')?['settlementProofs']:[])])&&b.schemaVersion===3&&b.protocol===RECOVERY_V3&&b.runId===c.k.spec.runId&&b.specHash===c.k.specHash&&b.directoryHash===digest(c.path),'AUDIT_RUN');
 check(b.files&&typeof b.files==='object'&&!Array.isArray(b.files)&&Object.keys(b.files).length>=2&&Object.entries(b.files).every(([n,h])=>/^(?:HEAD\.json|CHAIN\.jsonl|PENDING\.json|HEAD-[a-f0-9-]{36}\.tmp)$/.test(n)&&hash(h))&&hash(b.files['CHAIN.jsonl'])&&hash(b.files['HEAD.json'])&&(b.lockHash===null||hash(b.lockHash)),'AUDIT_FILES');
 // New version5 recovery nonces bind the inspection hash to this exact lease.
 // Historical version4 recovery leases remain readable with their old checks.
 if(lock.nonce[14]==='5')check(uuid(inspection.nonceSalt)&&recoveryNonce(inspection.plan.inspectionHash,inspection.nonceSalt)===lock.nonce,'AUDIT_ANCHOR');
 if(b.lockHash)check(sha(raw(resolve(folder,'previous-owned-lock.json')))===b.lockHash,'ARCHIVED_LOCK');
 for(const [n,h]of Object.entries(b.files)){const f=resolve(folder,'before-'+n);if(existsSync(f))check(sha(raw(f))===h,'ARCHIVED_FILE_CHANGED');}
 const current=bindings(c,currentFiles),expected={...b.files},p=b.pending;
 if(p){
  check([b.files['CHAIN.jsonl'],p.nextHead.logSha256].includes(current['CHAIN.jsonl']),'LINKED_CHAIN');expected['CHAIN.jsonl']=current['CHAIN.jsonl'];
  const nextHeadHash=sha(bytes(p.nextHead));check([b.files['HEAD.json'],nextHeadHash].includes(current['HEAD.json']),'LINKED_HEAD');expected['HEAD.json']=current['HEAD.json'];
  if(current['HEAD.json']===nextHeadHash)check(current['CHAIN.jsonl']===p.nextHead.logSha256,'LINKED_COMMIT');
  for(const n of Object.keys(b.files).filter(n=>n==='PENDING.json'||n.startsWith('HEAD-'))){
   if(current[n]===undefined){check(current['HEAD.json']===nextHeadHash&&sha(raw(resolve(folder,'retired-'+n)))===b.files[n],'LINKED_RETIRED');delete expected[n];}
  }
 }else check(digest(current)===digest(expected),'LINKED_FILES');
 check(digest(current)===digest(expected),'LINKED_FILES');
 // Every changed original must already have a byte-exact, fsynced backup.
 for(const [n,h]of Object.entries(b.files))if(current[n]!==h)check(sha(raw(resolve(folder,'before-'+n)))===h,'MISSING_ORIGINAL');
 if(Object.hasOwn(b,'settlementProofs'))verifySettlementProofs(context,ledger,b.settlementProofs,settlementProof);
 return {directory:basename(folder),inspectionSha256:sha(raw(resolve(folder,'inspection.json')))};
}
export function inspectV3Recovery(context,{settlementProof=null}={}){
 const c=scope(context),lockFile=resolve(c.path,'LOCK.json'),lock=existsSync(lockFile)?parse(lockFile):null,current=readV3CommittedPrefix(context),names=current.files;
 const lockObservation=lock?absentOrReleasedSelf(c,lock,true):null,linked=lock?linkedAudit(c,lock,names,context,current.ledger,settlementProof):null;let pending=null,operations=[];
 if(names.includes('PENDING.json')){
  const p=inspectV3Pending(context);absentOrReleasedSelf(c,p.owner,Boolean(lock&&!linked));check(!lock||linked||digest(lock)===digest(p.owner),'PENDING_OWNER');pending=p;operations=parse(resolve(c.path,'PENDING.json')).record.operations;
 }else{check(current.uncommittedBytes===0,'UNCOMMITTED_WITHOUT_PENDING');readV3Journal(context);}
 const proofs=collectSettlementProofs(context,current.ledger,operations,settlementProof),files=bindings(c,names),basis={schemaVersion:3,protocol:RECOVERY_V3,runId:c.k.spec.runId,specHash:c.k.specHash,directoryHash:digest(c.path),head:current.head,files,lockHash:lock?sha(raw(lockFile)):null,lockObservation,linkedAudit:linked,pending,action:pending?operations.some(op=>op.kind==='settle')?'roll-forward-validated-captured-settlement':'roll-forward-validated-nonsettle':lock?'release-confirmed-dead-lock':'none',...(settlementProof?{settlementProofs:proofs}:{})};
 return {basis,inspectionHash:digest(basis),noDispatchPerformed:true,physicalCaptureValidated:proofs.length>0};
}
export async function recoverV3Journal({context,expectedInspectionHash,settlementProof=null,testFault}){
 const c=scope(context);check(hash(expectedInspectionHash),'INSPECTION_REQUIRED');const mutex=await acquireRecoveryMutex(digest({protocol:RECOVERY_V3,directory:c.path,runId:c.k.spec.runId})),lockFile=resolve(c.path,'LOCK.json');let folder,o,ownerBytes,ownerStat,owned=false;
 function owns(){const now=regular(lockFile);check(scope(context).path===c.path&&now.ino===ownerStat.ino&&now.dev===ownerStat.dev&&sha(raw(lockFile))===sha(ownerBytes),'OWNER_CHANGED');check(digest(ownProcessIdentity())===digest(o.identity),'NOT_OWN_PROCESS');}
 function captureProofs(plan){if(plan.settlementProofs)verifySettlementProofs(context,readV3CommittedPrefix(context).ledger,plan.settlementProofs,settlementProof);}
 const point=async stage=>{await testFault?.(stage,{mutexHelperPid:mutex.pid});};
 try{
  const inspection=inspectV3Recovery(context,{settlementProof});check(inspection.inspectionHash===expectedInspectionHash,'INSPECTION_CHANGED');const plan=inspection.basis;if(plan.action==='none')return {status:'unchanged',head:plan.head,noDispatchPerformed:true,physicalCaptureValidated:inspection.physicalCaptureValidated};
  const nonceSalt=randomUUID();o={schemaVersion:3,protocol:JOURNAL_V3,runId:c.k.spec.runId,stage:c.k.spec.profile.stage,specHash:c.k.specHash,directoryHash:digest(c.path),nonce:recoveryNonce(inspection.inspectionHash,nonceSalt),pid:process.pid,identity:ownProcessIdentity()};ownerBytes=bytes(o);folder=auditPath(c,o);mkdirSync(folder);durable(resolve(folder,'inspection.json'),bytes({schemaVersion:3,protocol:RECOVERY_V3,owner:o,plan:inspection,nonceSalt,mutexHelperPid:mutex.pid}));
  if(plan.lockHash){
   check(sha(raw(lockFile))===plan.lockHash,'LOCK_CHANGED');absentOrReleasedSelf(c,parse(lockFile),true);await point('recovery:before-lock-archive');
   await mutex.archiveLock({source:lockFile,destination:resolve(folder,'previous-owned-lock.json'),allowedRoot:c.root,expectedHash:plan.lockHash});check(sha(raw(resolve(folder,'previous-owned-lock.json')))===plan.lockHash,'LOCK_ARCHIVE');await point('recovery:after-lock-archive');
  }
  durable(lockFile,ownerBytes);ownerStat=regular(lockFile);owned=true;await point('recovery:after-lock-acquire');owns();check(digest(bindings(c,readdirSync(c.path)))===digest(plan.files),'FILES_CHANGED');captureProofs(plan);
  for(const [n,h]of Object.entries(plan.files)){const original=raw(resolve(c.path,n));check(sha(original)===h,'BEFORE_CHANGED');durable(resolve(folder,'before-'+n),original);}await point('recovery:after-preservation');
  if(plan.pending){
   const p=parse(resolve(c.path,'PENDING.json')),line=bytes(p.record),combined=Buffer.concat([raw(resolve(c.path,'CHAIN.jsonl')).subarray(0,p.from.logBytes),line]);check(sha(combined)===p.to.logSha256&&combined.length===p.to.logBytes&&digest(p.to)===digest(plan.pending.nextHead),'PREPARED_BINDING');
   const preparedChain=resolve(folder,'prepared-CHAIN.jsonl'),preparedHead=resolve(folder,'prepared-HEAD.json');durable(preparedChain,combined);durable(preparedHead,bytes(p.to));await point('recovery:after-prepared-fsync');owns();check(digest(bindings(c,readdirSync(c.path)))===digest(plan.files),'FILES_CHANGED');
   await point('recovery:before-chain-rename');owns();check(digest(bindings(c,readdirSync(c.path)))===digest(plan.files),'FILES_CHANGED');captureProofs(plan);if(sha(raw(resolve(c.path,'CHAIN.jsonl')))!==p.to.logSha256)renameSync(preparedChain,resolve(c.path,'CHAIN.jsonl'));await point('recovery:after-chain-rename');
   const expected={...plan.files,'CHAIN.jsonl':p.to.logSha256};await point('recovery:before-head-rename');owns();check(digest(bindings(c,readdirSync(c.path)))===digest(expected),'FILES_CHANGED');captureProofs(plan);renameSync(preparedHead,resolve(c.path,'HEAD.json'));await point('recovery:after-head-rename');
   expected['HEAD.json']=sha(bytes(p.to));owns();check(digest(bindings(c,readdirSync(c.path)))===digest(expected),'FILES_CHANGED');captureProofs(plan);
   for(const n of Object.keys(plan.files).filter(n=>n.startsWith('HEAD-'))){check(sha(raw(resolve(c.path,n)))===plan.files[n],'TEMP_CHANGED');renameSync(resolve(c.path,n),resolve(folder,'retired-'+n));delete expected[n];}await point('recovery:after-temp-archive');
   owns();check(digest(bindings(c,readdirSync(c.path)))===digest(expected),'FILES_CHANGED');captureProofs(plan);renameSync(resolve(c.path,'PENDING.json'),resolve(folder,'retired-PENDING.json'));await point('recovery:after-pending-archive');
  }
  owns();const after=readV3Journal(context);check(digest(after.head)===digest(plan.pending?.nextHead??plan.head),'RESULT_HEAD');captureProofs(plan);const result={schemaVersion:3,protocol:RECOVERY_V3,status:'recovered',action:plan.action,before:plan.head,after:after.head,rawFilesPreserved:true,noDispatchPerformed:true,physicalCaptureValidated:(plan.settlementProofs?.length??0)>0,powerLossDurabilityMeasured:false};durable(resolve(folder,'result.json'),bytes(result));await point('recovery:after-result');return {...result,evidenceDirectory:folder};
 }catch(e){throw Object.assign(Error('R3_RECOVERY_HELD'),{failureCode:known(e),nativeCode:['EPERM','EACCES','EEXIST','ENOENT','EIO','ENOSPC'].includes(e?.code)?e.code:'UNKNOWN'});}
 finally{
  try{if(owned){owns();durable(resolve(folder,'released-owned-lock.json'),ownerBytes);await point('recovery:before-owned-release');owns();unlinkSync(lockFile);await point('recovery:after-owned-release');}}
  finally{await mutex.release();}
 }
}
