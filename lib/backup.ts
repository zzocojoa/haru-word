import { z } from 'zod';
import { grammarStateSchema } from './grammar/model';
import { progressSchema,sessionSchema,settingsSchema } from './validation';
import { stateReferenceIssues } from './state-integrity';
import { type State } from './learning';
import rawWords from '@/data/words.json';
import { resumeMonthlyWriting } from './learning/session-flow';
import { serializeBackup } from './backup-format';
import { assertBackupStructure } from './backup-structure';
export { makeBackup } from './backup-format';

export const MAX_BACKUP_BYTES=8_000_000;
export const RESTORE_CHUNK_BYTES=1_800_000;
const catalog=new Map(rawWords.map(w=>[w.id,w]));
const bytes=(value:string)=>new TextEncoder().encode(value).byteLength;

export const backupStateSchema=z.object({
 grammar:grammarStateSchema.optional(),
 settings:settingsSchema,
 progress:z.record(z.string(),progressSchema).refine(v=>Object.keys(v).length<=5000,'단어 기록은 최대 5,000개까지 복원할 수 있어요.'),
 sessions:z.record(z.string().uuid(),sessionSchema).refine(v=>Object.keys(v).length<=10000,'학습 회차는 최대 10,000개까지 복원할 수 있어요.'),
}).strict().superRefine((s,c)=>{
 const issue=(message:string)=>c.addIssue({code:'custom',message});
 for(const id of Object.keys(s.progress)){
  if(!catalog.has(id)&&!/^personal_[a-zA-Z0-9-]{36}$/.test(id))issue('목록에 없는 단어가 있어요.');
 }
 for(const message of stateReferenceIssues(s,id=>catalog.has(id)))issue(message);
});

export type ParsedBackup={state:State;exportedAt?:string;legacy:boolean};
const envelope=z.object({format:z.literal('haru-words-v1'),exportedAt:z.string().datetime(),state:backupStateSchema}).strict();
export function parseBackup(raw:string,maxBytes=MAX_BACKUP_BYTES):ParsedBackup {
 if(bytes(raw)>maxBytes)throw new Error(`백업 파일은 ${maxBytes/1_000_000} MB까지 복원할 수 있어요. 파일을 임의로 나누거나 일부 기록을 지우지 마세요.`);
 let value:unknown;try{value=JSON.parse(raw.replace(/^\uFEFF/,''),(key,v)=>{if(['__proto__','constructor','prototype'].includes(key))throw new Error('Unsafe key');return v;});}catch{throw new Error('올바른 JSON 백업 파일을 선택해 주세요.');}
 const wrapped=!!value&&typeof value==='object'&&('format'in value||'state'in value);
 const candidate=wrapped?(value as {state?:unknown}).state:value;
 if(candidate&&typeof candidate==='object')for(const [key,max]of [['progress',5000],['sessions',10000]]as const){const rows=(candidate as Record<string,unknown>)[key];if(rows&&typeof rows==='object'&&Object.keys(rows).length>max)throw new Error(key==='progress'?'단어 기록은 최대 5,000개까지 복원할 수 있어요.':'학습 회차는 최대 10,000개까지 복원할 수 있어요.');}
 // Bound collections before Zod clones them or builds a large issue list.
 assertBackupStructure(value);
 const parsed=wrapped?envelope.safeParse(value):backupStateSchema.safeParse(value);
 if(!parsed.success)throw new Error(parsed.error.issues.find(i=>i.code==='custom')?.message||'하루단어 백업 형식이나 버전을 확인해 주세요. 파일은 수정하지 않고 보관해 주세요.');
 const data=parsed.data;const result:ParsedBackup='state'in data?{state:data.state,exportedAt:data.exportedAt,legacy:false}:{state:data,legacy:true};
 // Verify row/parameter limits before showing a restorable preview.
 restoreChunks(result.state.progress);restoreChunks(result.state.sessions);if(result.state.grammar)restoreChunks(result.state.grammar);
 return result;
}
export function prepareSafetyBackup(state:State,now=new Date()):string {
 const raw=serializeBackup(state,now);
 // Validate the exact bytes to download through the same parser as import.
 // A successful serialization alone is not proof that recovery is possible.
 parseBackup(raw);
 return raw;
}
export function backupSummary(state:State){return {words:Object.keys(state.progress).length,sessions:Object.keys(state.sessions).length,personal:Object.values(state.progress).filter(p=>p.personal).length,unfinished:Object.values(state.sessions).filter(s=>!resumeMonthlyWriting(s).finished).length,level:state.settings.level,goal:state.settings.dailyGoal};}
export function replacementChanges(before:State,after:State){
 const equal=(a:unknown,b:unknown):boolean=>{
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>equal(v,b[i]));
  const x=a as Record<string,unknown>,y=b as Record<string,unknown>;
  const keys=Object.keys(x).filter(k=>x[k]!==undefined),other=Object.keys(y).filter(k=>y[k]!==undefined);
  return keys.length===other.length&&keys.every(k=>Object.hasOwn(y,k)&&equal(x[k],y[k]));
 };
 const counts=(a:Record<string,unknown>,b:Record<string,unknown>)=>({added:Object.keys(b).filter(k=>!Object.hasOwn(a,k)).length,changed:Object.keys(b).filter(k=>Object.hasOwn(a,k)&&!equal(a[k],b[k])).length,removed:Object.keys(a).filter(k=>!Object.hasOwn(b,k)).length});
 return {words:counts(before.progress,after.progress),sessions:counts(before.sessions,after.sessions)};
}
export function restoreChunks(records:Record<string,unknown>):string[]{
 const out:string[]=[];let parts:string[]=[];let size=2;
 for(const [id,value]of Object.entries(records)){
  const part=JSON.stringify(id)+':'+JSON.stringify(value),length=bytes(part);
  if(length+2>RESTORE_CHUNK_BYTES)throw new Error('한 학습 기록이 너무 커서 복원할 수 없어요. 원본 백업 파일을 보관해 주세요.');
  if(parts.length&&size+1+length>RESTORE_CHUNK_BYTES){out.push('{'+parts.join(',')+'}');parts=[];size=2;}
  size+=length+(parts.length?1:0);parts.push(part);
 }
 if(parts.length)out.push('{'+parts.join(',')+'}');return out;
}
