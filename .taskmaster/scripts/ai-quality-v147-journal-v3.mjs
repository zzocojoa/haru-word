// Synthetic-only v3 commit journal. No transport, credentials or legacy ledger IO.
// Exact committed bytes are checked; replay validates every operation. Prepared
// or foreign bytes are held and never truncated,removed or recovered implicitly.
import {mkdirSync,openSync,writeFileSync,readFileSync,fsyncSync,closeSync,lstatSync,fstatSync,realpathSync,readdirSync,renameSync,unlinkSync,existsSync} from 'node:fs';
import {resolve,dirname,isAbsolute} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {compileBudgetV3,digest} from './ai-quality-v147-budget-v3.mjs';
import {ownProcessIdentity} from './ai-quality-v147-process.mjs';
export const JOURNAL_V3='ai-quality-v147-journal-v3';
const check=(ok,code)=>{if(!ok)throw Error('J3_'+code);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fields=(x,names)=>object(x)&&Object.keys(x).sort().join('|')===[...names].sort().join('|');
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x);
const sha=x=>createHash('sha256').update(x).digest('hex'),bytes=x=>Buffer.from(JSON.stringify(x)+'\n','utf8');
const native=new Set(['EPERM','EACCES','ENOENT','EEXIST','EIO','ENOSPC']);
const knownCode=e=>typeof e?.message==='string'&&/^(?:J3|P3)_[A-Z0-9_]+$/.test(e.message)?e.message:'J3_IO';
const headKeys=['schemaVersion','protocol','index','recordHash','logBytes','logSha256'];
function parse(b){try{return JSON.parse(b.toString('utf8'));}catch{throw Error('J3_JSON');}}
function regular(file){const s=lstatSync(file);check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1,'NONREGULAR');return s;}
function read(file,maximum){
 const before=regular(file);check(before.size<=maximum,'FILE_SIZE');const fd=openSync(file,'r');try{
  const opened=fstatSync(fd);check(opened.ino===before.ino&&opened.dev===before.dev&&opened.nlink===1,'FILE_REPLACED');const b=readFileSync(fd),after=fstatSync(fd),last=regular(file);
  check(b.length===opened.size&&after.size===opened.size&&after.mtimeMs===opened.mtimeMs&&last.ino===opened.ino&&last.dev===opened.dev,'READ_CHANGED');return b;
 }finally{closeSync(fd);}
}
function durable(file,data,fault,stage){const fd=openSync(file,'wx',0o600);try{writeFileSync(fd,data);fault?.(stage+':before-fsync');fsyncSync(fd);}finally{closeSync(fd);}fault?.(stage+':after-fsync');}
function fixed(context){
 check(context&&isAbsolute(context.allowedRoot)&&isAbsolute(context.directory),'ABSOLUTE_SCOPE');
 check(!context.allowedRoot.split(/[\\/]/).some(p=>/^(?:\.env(?:[._-].*)?|\.sites-runtime|\.wrangler|\.git)$/i.test(p)),'PROTECTED_ROOT');
 const root=realpathSync(context.allowedRoot);check(root===resolve(context.allowedRoot)&&!lstatSync(root).isSymbolicLink(),'ROOT_LINK');
 const kernel=compileBudgetV3(context.spec);check(kernel.spec.mode==='synthetic','SYNTHETIC_ONLY');const path=resolve(context.directory);
 check(path===resolve(root,'v3-'+kernel.spec.runId)&&dirname(path)===root,'RUN_SCOPE');
 const maxLog=Buffer.byteLength(JSON.stringify(kernel.spec))*2+kernel.spec.requests.length*8192+1048576;
 return {allowedRoot:root,directory:path,spec:kernel.spec,kernel,specHash:kernel.specHash,maxLog};
}
function directory(c){check(!lstatSync(c.directory).isSymbolicLink()&&realpathSync(c.directory)===c.directory,'DIRECTORY_LINK');}
function owner(c){return {schemaVersion:3,protocol:JOURNAL_V3,runId:c.spec.runId,stage:c.spec.profile.stage,specHash:c.specHash,directoryHash:digest(c.directory),nonce:randomUUID(),pid:process.pid,identity:ownProcessIdentity()};}
function validateOwner(c,o){
 check(fields(o,['schemaVersion','protocol','runId','stage','specHash','directoryHash','nonce','pid','identity'])&&o.schemaVersion===3&&o.protocol===JOURNAL_V3&&o.runId===c.spec.runId&&o.stage===c.spec.profile.stage&&o.specHash===c.specHash&&o.directoryHash===digest(c.directory)&&uuid(o.nonce)&&Number.isSafeInteger(o.pid)&&o.pid>0,'OWNER');
 const i=o.identity;check(fields(i,['platform','pid','createdAt','commandHash','executableHash'])&&['win32','linux'].includes(i.platform)&&i.pid===o.pid&&typeof i.createdAt==='string'&&i.createdAt.length>0&&hash(i.commandHash)&&hash(i.executableHash),'OWNER_IDENTITY');
}
function validHead(h,c){check(fields(h,headKeys)&&h.schemaVersion===3&&h.protocol===JOURNAL_V3&&Number.isSafeInteger(h.index)&&h.index>=0&&Number.isSafeInteger(h.logBytes)&&h.logBytes>0&&h.logBytes<=c.maxLog&&h.index<h.logBytes&&hash(h.recordHash)&&hash(h.logSha256),'HEAD');}
const headFor=(record,log)=>({schemaVersion:3,protocol:JOURNAL_V3,index:record.index,recordHash:digest(record),logBytes:log.length,logSha256:sha(log)});
function stateProof(kernel,before,after){
 const changed=Object.keys(after.slots).filter(k=>before?.slots[k]!==after.slots[k]).sort().map(k=>[k,digest(after.slots[k])]);
 return {sequence:after.sequence,accountHash:digest(kernel.account(after)),deltaHash:digest(changed)};
}
function replay(c,head,log){
 validHead(head,c);check(log.length>=head.logBytes&&log.length<=c.maxLog,'LOG_LENGTH');const prefix=log.subarray(0,head.logBytes);
 check(sha(prefix)===head.logSha256&&prefix.at(-1)===10&&Buffer.from(prefix.toString('utf8')).equals(prefix),'PREFIX_HASH');const lines=prefix.toString('utf8').split('\n');lines.pop();check(lines.length===head.index+1,'RECORD_COUNT');
 const kernel=c.kernel;let ledger,last,previousHash=null;
 for(let index=0;index<lines.length;index++){
  const r=parse(Buffer.from(lines[index]));
  if(index===0){
   check(fields(r,['schemaVersion','protocol','index','previousHash','spec','approval','stateProof','owner'])&&r.schemaVersion===3&&r.protocol===JOURNAL_V3&&r.index===0&&r.previousHash===null&&digest(r.spec)===c.specHash,'GENESIS');validateOwner(c,r.owner);ledger=kernel.newLedger(r.approval);check(digest(r.stateProof)===digest(stateProof(kernel,null,ledger)),'GENESIS_STATE');
  }else{
   check(fields(r,['schemaVersion','protocol','index','previousHash','specHash','operations','stateProof','owner'])&&r.schemaVersion===3&&r.protocol===JOURNAL_V3&&r.index===index&&r.previousHash===previousHash&&r.specHash===c.specHash&&Array.isArray(r.operations)&&r.operations.length>0&&r.operations.length<=64,'CHAIN');validateOwner(c,r.owner);const before=ledger;
   for(const operation of r.operations)ledger=kernel.transition(ledger,operation);check(digest(r.stateProof)===digest(stateProof(kernel,before,ledger)),'STATE_REPLAY');
  }
  previousHash=digest(r);last=r;
 }
 check(previousHash===head.recordHash,'HEAD_RECORD');kernel.audit(ledger);return {kernel,ledger,last,head};
}
function history(c){
 directory(c);const head=parse(read(resolve(c.directory,'HEAD.json'),4096)),log=read(resolve(c.directory,'CHAIN.jsonl'),c.maxLog),result=replay(c,head,log);return {...result,log,files:readdirSync(c.directory),uncommittedBytes:log.length-head.logBytes};
}
function strict(c){
 const r=history(c);check(r.uncommittedBytes===0&&r.files.every(x=>['CHAIN.jsonl','HEAD.json','LOCK.json'].includes(x)),'PREPARED_OR_FOREIGN');if(r.files.includes('LOCK.json'))validateOwner(c,parse(read(resolve(c.directory,'LOCK.json'),4096)));return r;
}
const view=r=>({head:structuredClone(r.head),ledger:r.ledger,account:r.kernel.account(r.ledger)});
function leaseArchive(c,o,label){
 const folder=resolve(c.allowedRoot,'v3-'+c.spec.runId+'-lease-history');try{mkdirSync(folder);}catch(e){if(e.code!=='EEXIST')throw e;}check(!lstatSync(folder).isSymbolicLink()&&realpathSync(folder)===folder,'LEASE_ARCHIVE');
 const data={schemaVersion:3,protocol:JOURNAL_V3,owner:o,outcome:label,atUtc:new Date().toISOString()};durable(resolve(folder,o.nonce+'.json'),bytes(data));
}
export function createV3Journal(context,approval,testFault){
 const c=fixed(context);const ledger=c.kernel.newLedger(approval);mkdirSync(c.directory);const first={schemaVersion:3,protocol:JOURNAL_V3,index:0,previousHash:null,spec:c.spec,approval:structuredClone(approval),stateProof:stateProof(c.kernel,null,ledger),owner:owner(c)},log=bytes(first);
 durable(resolve(c.directory,'CHAIN.jsonl'),log,testFault,'create-log');durable(resolve(c.directory,'HEAD.json'),bytes(headFor(first,log)),testFault,'create-head');return readV3Journal(context);
}
export function readV3Journal(context){const c=fixed(context),r=strict(c);return {...view(r),liveDispatchSupported:false,physicalCaptureValidated:false};}
export function readV3CommittedPrefix(context){const c=fixed(context),r=history(c);return {...view(r),files:r.files,uncommittedBytes:r.uncommittedBytes,noDispatchPerformed:true};}
export function openV3Journal(context){
 const c=fixed(context);directory(c);const o=owner(c),lock=resolve(c.directory,'LOCK.json'),lockBytes=bytes(o);let lockIdentity,current,poisoned=false,closed=false;
 durable(lock,lockBytes);lockIdentity=regular(lock);
 function owns(){directory(c);const now=regular(lock);check(now.ino===lockIdentity.ino&&now.dev===lockIdentity.dev&&sha(read(lock,4096))===sha(lockBytes),'OWNER_CHANGED');check(digest(o.identity)===digest(ownProcessIdentity()),'NOT_OWN_PROCESS');}
 function release(label){check(!closed,'SESSION_CLOSED');owns();leaseArchive(c,o,label);owns();unlinkSync(lock);closed=true;}
 try{current=strict(c);}catch(e){release('open-held-'+knownCode(e));throw e;}
 function verify(){
  check(!closed&&!poisoned,'SESSION_HELD');try{
   owns();check(readdirSync(c.directory).every(x=>['CHAIN.jsonl','HEAD.json','LOCK.json'].includes(x)),'PREPARED_OR_FOREIGN');
   const head=read(resolve(c.directory,'HEAD.json'),4096);check(digest(parse(head))===digest(current.head),'HEAD_CHANGED');const log=read(resolve(c.directory,'CHAIN.jsonl'),c.maxLog);check(log.length===current.head.logBytes&&sha(log)===current.head.logSha256,'LOG_CHANGED');return log;
  }catch(e){poisoned=true;throw e;}
 }
 return Object.freeze({
  current(){verify();return view(current);},
  append(input,testFault){
   const log=verify(),operations=structuredClone(Array.isArray(input)?input:[input]);check(operations.length>0&&operations.length<=64,'OPERATION_BATCH');let stage='transition';
   try{
    const before=current.ledger;let ledger=before;for(const op of operations)ledger=current.kernel.transition(ledger,op);
    const record={schemaVersion:3,protocol:JOURNAL_V3,index:current.head.index+1,previousHash:current.head.recordHash,specHash:c.specHash,operations,stateProof:stateProof(current.kernel,before,ledger),owner:o},line=bytes(record),combined=Buffer.concat([log,line]);check(combined.length<=c.maxLog,'LOG_SIZE');const nextHead=headFor(record,combined),pending={schemaVersion:3,protocol:JOURNAL_V3,from:current.head,to:nextHead,record,lineBytes:line.length,lineSha256:sha(line)},pendingBytes=bytes(pending),pendingFile=resolve(c.directory,'PENDING.json'),temp=resolve(c.directory,'HEAD-'+o.nonce+'.tmp');
    stage='pending';durable(pendingFile,pendingBytes,testFault,'pending');
    stage='log';const file=resolve(c.directory,'CHAIN.jsonl'),beforeStat=regular(file),fd=openSync(file,'a');try{const opened=fstatSync(fd);check(opened.ino===beforeStat.ino&&opened.dev===beforeStat.dev&&opened.nlink===1,'LOG_REPLACED');writeFileSync(fd,line);testFault?.('log:before-fsync');fsyncSync(fd);}finally{closeSync(fd);}testFault?.('log:after-fsync');check(read(file,c.maxLog).equals(combined),'APPEND_READBACK');
    stage='head';durable(temp,bytes(nextHead),testFault,'head');testFault?.('head:before-rename');renameSync(temp,resolve(c.directory,'HEAD.json'));testFault?.('head:after-rename');
    stage='pending-cleanup';owns();check(read(pendingFile,pendingBytes.length+1).equals(pendingBytes),'PENDING_CHANGED');testFault?.('pending:before-unlink');unlinkSync(pendingFile);testFault?.('pending:after-unlink');
    stage='commit-readback';owns();check(digest(parse(read(resolve(c.directory,'HEAD.json'),4096)))===digest(nextHead)&&read(file,c.maxLog).equals(combined)&&readdirSync(c.directory).every(x=>['CHAIN.jsonl','HEAD.json','LOCK.json'].includes(x)),'COMMIT_READBACK');
    current={...current,head:nextHead,ledger,last:record};return view(current);
   }catch(e){poisoned=true;throw Object.assign(Error('J3_APPEND_HELD'),{failureStage:stage,failureCode:knownCode(e),nativeCode:native.has(e?.code)?e.code:'UNKNOWN'});}
  },
  audit(){verify();try{const disk=strict(fixed(c));check(digest(disk.ledger)===digest(current.ledger),'AUDIT_CHANGED');return view(current);}catch(e){poisoned=true;throw e;}},
  close(){check(!closed,'SESSION_CLOSED');try{check(!poisoned,'SESSION_HELD');verify();const disk=strict(fixed(c));check(digest(disk.ledger)===digest(current.ledger),'AUDIT_CHANGED');return {head:disk.head,ledgerClosed:disk.ledger.closed,noDispatchPerformed:true};}catch(e){poisoned=true;throw e;}finally{release(poisoned?'session-held':'session-audited');}},
  abandon(){release('session-held');return {noDispatchPerformed:true,incompleteFilesPreserved:true};}
 });
}
// Read-only classification. Recovery/lease removal is deliberately explicit and
// unsupported here; neither malformed nor complete prepared bytes are repaired.
export function inspectV3Pending(context){
 const c=fixed(context),current=history(c),file=resolve(c.directory,'PENDING.json');
 if(!existsSync(file))return {pending:false,head:current.head,uncommittedBytes:current.uncommittedBytes,leasePresent:current.files.includes('LOCK.json'),recoveryImplemented:false,noDispatchPerformed:true};
 const p=parse(read(file,c.maxLog));check(fields(p,['schemaVersion','protocol','from','to','record','lineBytes','lineSha256'])&&p.schemaVersion===3&&p.protocol===JOURNAL_V3,'PENDING');validHead(p.from,c);validHead(p.to,c);
 const log=current.log,base=replay(fixed(c),p.from,log),r=p.record;check(fields(r,['schemaVersion','protocol','index','previousHash','specHash','operations','stateProof','owner'])&&r.schemaVersion===3&&r.protocol===JOURNAL_V3&&r.index===p.from.index+1&&r.previousHash===p.from.recordHash&&r.specHash===c.specHash&&Array.isArray(r.operations)&&r.operations.length>0&&r.operations.length<=64,'PENDING_RECORD');validateOwner(c,r.owner);
 const before=base.ledger;let ledger=before;for(const op of r.operations)ledger=base.kernel.transition(ledger,op);check(digest(r.stateProof)===digest(stateProof(base.kernel,before,ledger)),'PENDING_STATE');const line=bytes(r),combined=Buffer.concat([log.subarray(0,p.from.logBytes),line]);check(p.lineBytes===line.length&&p.lineSha256===sha(line)&&digest(p.to)===digest(headFor(r,combined)),'PENDING_HEAD');
 const isBefore=digest(current.head)===digest(p.from),isAfter=digest(current.head)===digest(p.to);check(isBefore||isAfter,'PENDING_CURRENT_HEAD');const suffix=log.subarray(p.from.logBytes);check(suffix.length<=line.length&&suffix.equals(line.subarray(0,suffix.length)),'PENDING_LOG_CHANGED');
 const temp='HEAD-'+r.owner.nonce+'.tmp';check(current.files.every(x=>['CHAIN.jsonl','HEAD.json','LOCK.json','PENDING.json',temp].includes(x)),'PENDING_FOREIGN');if(current.files.includes(temp))check(digest(parse(read(resolve(c.directory,temp),4096)))===digest(p.to),'PENDING_TEMP_CHANGED');
 const logState=suffix.length===0?'not-appended':suffix.length<line.length?'partial':'complete';check(!isAfter||logState==='complete','PENDING_COMMITTED_LOG');return {pending:true,head:current.head,nextHead:p.to,owner:r.owner,operationKinds:r.operations.map(x=>x.kind),logState,headState:isAfter?'committed':'previous',proposedConsumedSlots:base.kernel.account(ledger).consumedSlots,pendingSha256:sha(read(file,c.maxLog)),logSha256:sha(log),recoveryImplemented:false,noDispatchPerformed:true};
}
