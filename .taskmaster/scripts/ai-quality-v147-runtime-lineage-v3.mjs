// Local synthetic runtime ownership. Immutable restart records supplement the
// original RUNTIME receipt; an unresolved restart never grants another lease.
import {lstatSync,realpathSync,readdirSync,readFileSync,openSync,closeSync,writeFileSync,fsyncSync,mkdirSync} from 'node:fs';
import {resolve,relative,dirname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {observeProcess} from './ai-quality-v147-process.mjs';
import {digest} from './ai-quality-v147-budget-v3.mjs';

const check=(ok,code)=>{if(!ok)throw Error('RL3_'+code);},sha=b=>createHash('sha256').update(b).digest('hex');
const registry=new Map(),noncePattern=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export function ownedDirectoryV3(dir){const s=lstatSync(dir);check(s.isDirectory()&&!s.isSymbolicLink()&&realpathSync(dir)===dir,'DIRECTORY_LINK');}
export function ownedPathV3(root,file){
 root=resolve(root);file=resolve(file);const rel=relative(root,file);check(rel!==''&&!rel.startsWith('..'+sep)&&rel!=='..'&&!resolve(file).startsWith('\\\\')&&file.startsWith(root+sep),'PATH');ownedDirectoryV3(root);
 let current=root;for(const part of relative(root,dirname(file)).split(sep).filter(Boolean)){current=resolve(current,part);ownedDirectoryV3(current);}return file;
}
export function validateOwnedTreeV3(root){ownedDirectoryV3(root);for(const e of readdirSync(root,{withFileTypes:true})){const file=resolve(root,e.name),s=lstatSync(file);check(!s.isSymbolicLink(),'TREE_LINK');if(s.isDirectory())validateOwnedTreeV3(file);else check(s.isFile()&&s.nlink===1,'NONREGULAR');}}
export function runtimeChildrenV3(parentPid){
 check(process.platform==='win32'&&Number.isSafeInteger(parentPid)&&parentPid>0,'PROCESS_SCOPE');
 const raw=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$ErrorActionPreference='Stop';@(Get-CimInstance Win32_Process -Filter "ParentProcessId = ${parentPid}" | Where-Object { $_.Name -eq 'workerd.exe' } | Select-Object ProcessId,ParentProcessId) | ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true,timeout:15000,stdio:['ignore','pipe','pipe']}).trim();
 const value=raw?JSON.parse(raw):[],rows=Array.isArray(value)?value:[value];return rows.map(x=>{check(Number.isSafeInteger(x.ProcessId)&&x.ParentProcessId===parentPid,'CHILD');return {pid:x.ProcessId,parentPid:x.ParentProcessId};});
}
function read(root,file){ownedPathV3(root,file);const s=lstatSync(file);check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<1048576,'FILE');const b=readFileSync(file),after=lstatSync(file);ownedPathV3(root,file);check(s.ino===after.ino&&s.dev===after.dev&&s.size===b.length&&after.mtimeMs===s.mtimeMs,'READ_CHANGED');return b;}
function write(root,file,value){ownedPathV3(root,file);const b=Buffer.from(JSON.stringify(value)+'\n'),fd=openSync(file,'wx',0o600);try{writeFileSync(fd,b);fsyncSync(fd);}finally{closeSync(fd);}check(read(root,file).equals(b),'READBACK');return sha(b);}
function lineageDir(root,nonce){check(noncePattern.test(nonce),'NONCE');const dir=resolve(root,'runtime-'+nonce);ownedPathV3(root,dir);return dir;}
function history(root,owner,runtime,expectedInitialSha256){
 const dir=lineageDir(root,owner.nonce);ownedDirectoryV3(dir);const names=readdirSync(dir).sort();check(names.length>0&&names.length<=128,'HISTORY_COUNT');let previous=null,current=null,pending=false,closed=false;const identities=[],records=[];
 for(let i=0;i<names.length;i++){
  check(names[i]===String(i).padStart(6,'0')+'.json','HISTORY_ORDER');const file=resolve(dir,names[i]),b=read(root,file),value=JSON.parse(b);check(value.protocol==='ai-quality-v147-runtime-lineage-v3'&&value.ownerNonce===owner.nonce&&value.ownerHash===digest(owner)&&value.previousSha256===previous&&value.ordinal===i,'HISTORY_BINDING');
  if(i===0){check(value.kind==='initial'&&digest(value.identity)===digest(runtime.identity)&&value.identity.pid===runtime.pid,'INITIAL');if(expectedInitialSha256)check(sha(b)===expectedInitialSha256,'EXTERNAL_INITIAL');current=value.identity;identities.push(current);}
  else if(value.kind==='restart-intent'){check(!pending&&!closed&&digest(value.previousIdentity)===digest(current),'INTENT');pending=true;}
  else if(value.kind==='restart-complete'){check(pending&&!closed&&digest(value.previousIdentity)===digest(current)&&value.identity?.pid>0&&value.identity.executableHash===identities[0].executableHash&&!identities.some(x=>digest(x)===digest(value.identity)),'RESTART');current=value.identity;identities.push(current);pending=false;}
  else if(value.kind==='restart-aborted'){check(pending&&!closed&&digest(value.identities)===digest(identities)&&value.afterDispose===true,'ABORTED');pending=false;}
  else if(value.kind==='closed'){check(!pending&&!closed&&digest(value.identities)===digest(identities),'CLOSED');closed=true;}
  else throw Error('RL3_RECORD_KIND');previous=sha(b);records.push({file:relative(root,file),sha256:previous,value});
 }
 return {directory:dir,records,identities,pending,closed,headSha256:previous,initialSha256:records[0].sha256};
}
export function inspectRuntimeLineageV3({root,owner,runtime,expectedInitialSha256}){
 const view=history(root,owner,runtime,expectedInitialSha256),ownerObservation=observeProcess(owner.pid),observations=view.identities.map(identity=>({identity,observation:observeProcess(identity.pid)})),children=runtimeChildrenV3(owner.pid);
 // A dead owner cannot spawn another child. A closed lease can share itsNode
 // with other registered profiles; their exact identities stay untouched.
 const unaccountedChildren=children.filter(p=>{const o=observeProcess(p.pid),entry=o.status==='present'?registry.get(digest(o.identity)):null;return !entry||entry.nonce===owner.nonce;});
 return {...view,ownerObservation,observations,children,unaccountedChildren,recoverable:(view.closed||ownerObservation.status==='absent')&&observations.every(x=>x.observation.status==='absent')&&unaccountedChildren.length===0,noDispatchPerformed:true};
}
export function createRuntimeLineageV3({root,owner,assertOwned}){
 const dir=lineageDir(root,owner.nonce);mkdirSync(dir);ownedDirectoryV3(dir);let runtime=null,head=null,ordinal=0,pending=false,closed=false,failure=null;const identities=[],events=[];
 function append(kind,fields){assertOwned();ownedDirectoryV3(dir);const value={protocol:'ai-quality-v147-runtime-lineage-v3',ownerNonce:owner.nonce,ownerHash:digest(owner),ordinal,previousSha256:head,kind,...fields};head=write(root,resolve(dir,String(ordinal).padStart(6,'0')+'.json'),value);ordinal++;events.push({kind,ordinal:ordinal-1,sha256:head});}
 function fail(code){failure=code;events.push({kind:'held',code});}
 function verify(){check(runtime&&!failure,'HELD');const h=history(root,owner,runtime);check(h.headSha256===head&&h.records.length===ordinal,'HISTORY_CHANGED');return h;}
 return {
  events,
  initial(value){check(!runtime,'INITIAL_DUPLICATE');runtime=value;identities.push(value.identity);registry.set(digest(value.identity),{nonce:owner.nonce,pid:value.pid});append('initial',{identity:value.identity});return {initialSha256:head,directory:relative(root,dir)};},
  crashWarning(message){if(typeof message!=='string'||!/^The Workers runtime crashed unexpectedly and is being restarted \(crash #\d+\)\./.test(message))return;try{check(runtime&&!pending&&!closed&&!failure,'CRASH_STATE');verify();pending=true;append('restart-intent',{previousIdentity:identities.at(-1)});}catch{fail('RESTART_INTENT_FAILED');}},
  async restarted(){try{
   check(pending&&!closed&&!failure,'RESTART_STATE');verify();const old=identities.at(-1);check(observeProcess(old.pid).status==='absent','OLD_RUNTIME_PRESENT_OR_UNKNOWN');const candidates=runtimeChildrenV3(owner.pid).filter(p=>!identities.some(x=>x.pid===p.pid));
   // Registry entries include other profiles in thisNode. A new ambiguous
   // child is held rather than assigned or killed using its process name.
   const fresh=[];for(const p of candidates){const o=observeProcess(p.pid);check(o.status==='present','RESTART_IDENTITY_UNKNOWN');const registered=registry.get(digest(o.identity));if(!registered)fresh.push(o.identity);}
   check(fresh.length===1&&fresh[0].executableHash===identities[0].executableHash,'RESTART_OWNERSHIP_AMBIGUOUS');const next=fresh[0];append('restart-complete',{previousIdentity:old,identity:next});identities.push(next);registry.set(digest(next),{nonce:owner.nonce,pid:next.pid});pending=false;
  }catch(error){fail('RESTART_RECORD_FAILED');throw error;}},
  assertReady(){assertOwned();check(runtime&&!pending&&!closed&&!failure,'RUNTIME_NOT_READY');},
  inspect(){const h=verify();return {...h,failure,events:structuredClone(events),pending};},
  preflight(){verify();validateOwnedTreeV3(root);},
  afterDispose(){
   verify();for(const identity of identities)check(observeProcess(identity.pid).status==='absent','RUNTIME_REMAINED_OR_UNKNOWN');
   for(const p of runtimeChildrenV3(owner.pid)){const o=observeProcess(p.pid);check(o.status==='present'&&registry.get(digest(o.identity))?.nonce!==undefined&&registry.get(digest(o.identity)).nonce!==owner.nonce,'UNTRACKED_CHILD');}
   if(pending){append('restart-aborted',{identities,afterDispose:true});pending=false;}if(!closed){append('closed',{identities});closed=true;}return {...history(root,owner,runtime),events:structuredClone(events),allOwnedRuntimesAbsent:true};
  },
  markFailure(){fail('RUNTIME_LIBRARY_ERROR');}
 };
}
