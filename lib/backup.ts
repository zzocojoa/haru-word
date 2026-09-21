import { z } from 'zod';
import { progressSchema,sessionSchema,settingsSchema } from './validation';
import { POS,type State } from './learning';
import rawWords from '@/data/words.json';

export const MAX_BACKUP_BYTES=8_000_000;
export const RESTORE_CHUNK_BYTES=1_800_000;
const catalog=new Map(rawWords.map(w=>[w.id,w]));
const bytes=(value:string)=>new TextEncoder().encode(value).byteLength;
const realDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;

export const backupStateSchema=z.object({
 settings:settingsSchema,
 progress:z.record(z.string(),progressSchema).refine(v=>Object.keys(v).length<=5000,'단어 기록은 최대 5,000개까지 복원할 수 있어요.'),
 sessions:z.record(z.string().uuid(),sessionSchema).refine(v=>Object.keys(v).length<=10000,'학습 회차는 최대 10,000개까지 복원할 수 있어요.'),
}).strict().superRefine((s,c)=>{
 const issue=(message:string)=>c.addIssue({code:'custom',message});
 const validEntry=(id:string)=>catalog.has(id)||!!s.progress[id]?.personal;
 const checkDate=(d:string|undefined)=>{if(d&&!realDate(d))issue('존재하지 않는 학습 날짜가 있어요.');};
 for(const [id,p]of Object.entries(s.progress)){
  if(!catalog.has(id)&&!/^personal_[a-zA-Z0-9-]{36}$/.test(id))issue('목록에 없는 단어가 있어요.');
  if(id.startsWith('personal_')!==!!p.personal||p.personal&&(p.personal.id!==id||!POS[p.personal.pos]))issue('개인 단어의 정보가 맞지 않아요.');
  for(const sense of [p,...Object.values(p.senses||{})]){checkDate(sense.lastStudied);checkDate(sense.lastReviewed);sense.studyDates?.forEach(checkDate);}
  for(const [meaning,sense]of Object.entries(p.senses||{}))if(sense.meaning!==undefined&&sense.meaning!==meaning)issue('뜻별 기록이 일치하지 않아요.');
  p.encounters?.forEach(e=>checkDate(e.date));
 }
 for(const [level,a]of Object.entries(s.settings.assessments)){
  if(!a)continue;
  if(!a.ids.length||new Set(a.ids).size!==a.ids.length||a.index>a.ids.length||a.completed!==(a.index===a.ids.length)||Object.keys(a.marks).length!==a.index||a.ids.slice(0,a.index).some(id=>!a.marks[id])||Object.keys(a.marks).some(id=>!a.ids.includes(id))||a.ids.some(id=>catalog.get(id)?.level!==level))issue('친숙도 확인 순서가 맞지 않아요.');
 }
 if(s.settings.activeSessionId&&!s.sessions[s.settings.activeSessionId])issue('이어갈 학습 회차가 파일에 없어요.');
 for(const [key,v]of Object.entries(s.sessions)){
  if(key!==v.id)issue('학습 회차의 식별자가 맞지 않아요.');
  checkDate(v.date);if(v.kind==='monthly'){if(!/^\d{4}-\d{2}$/.test(v.period)||!realDate(v.period+'-01'))issue('월말 점검 기간이 잘못되었어요.');}else checkDate(v.period.length===10?v.period:'invalid');
  if(!v.ids.length||v.ids.some(id=>!v.records[id]||!validEntry(v.records[id].entryId||id)))issue('회차의 목표 단어나 개인 단어 정보가 빠졌어요.');
  if(v.warmupIds.some(id=>!validEntry(id))||new Set(v.warmupIds).size!==v.warmupIds.length||Object.keys(v.warmupResults||{}).some(id=>!v.warmupIds.includes(id))||v.warmupDraft&&!v.warmupIds.includes(v.warmupDraft.id))issue('이전 복습의 단어 정보가 맞지 않아요.');
  if(Object.keys(v.wordKeys||{}).some(id=>!v.ids.includes(id))||v.retry.some(r=>r.seen?.some(id=>!v.ids.includes(id))))issue('재시도 순서가 맞지 않아요.');
  if(v.finished!==(v.stage==='done')||v.retryMode&&!v.retry.length||v.index>(v.stage==='warmup'?v.warmupIds.length:v.ids.length)||(!v.finished&&!v.retryMode&&v.stage!=='checkpoint'&&v.index>=(v.stage==='warmup'?v.warmupIds.length:v.ids.length)))issue('학습을 이어갈 위치가 맞지 않아요.');
  if(v.stage==='checkpoint'&&(v.kind!=='monthly'||v.index>=v.ids.length)||v.resumeAfterRetry&&v.resumeAfterRetry.index>v.ids.length)issue('점검을 이어갈 위치가 맞지 않아요.');
  for(const r of Object.values(v.records)){checkDate(r.learnedOn);checkDate(r.lastPracticedOn);}
 }
});

export type ParsedBackup={state:State;exportedAt?:string;legacy:boolean};
const envelope=z.object({format:z.literal('haru-words-v1'),exportedAt:z.string().datetime(),state:backupStateSchema}).strict();
export function parseBackup(raw:string):ParsedBackup {
 if(bytes(raw)>MAX_BACKUP_BYTES)throw new Error('백업 파일은 8 MB까지 복원할 수 있어요. 파일을 임의로 나누거나 일부 기록을 지우지 마세요.');
 let value:unknown;try{value=JSON.parse(raw.replace(/^\uFEFF/,''),(key,v)=>{if(['__proto__','constructor','prototype'].includes(key))throw new Error('Unsafe key');return v;});}catch{throw new Error('올바른 JSON 백업 파일을 선택해 주세요.');}
 const wrapped=!!value&&typeof value==='object'&&('format'in value||'state'in value);
 const candidate=wrapped?(value as {state?:unknown}).state:value;
 if(candidate&&typeof candidate==='object')for(const [key,max]of [['progress',5000],['sessions',10000]]as const){const rows=(candidate as Record<string,unknown>)[key];if(rows&&typeof rows==='object'&&Object.keys(rows).length>max)throw new Error(key==='progress'?'단어 기록은 최대 5,000개까지 복원할 수 있어요.':'학습 회차는 최대 10,000개까지 복원할 수 있어요.');}
 // Bound collections before Zod clones them or builds a large issue list.
 const stack:[unknown,number][]=[[value,0]];
 while(stack.length){const [item,depth]=stack.pop()!;if(!item||typeof item!=='object')continue;const values=Object.values(item);if(depth>24||values.length>(Array.isArray(item)?20000:10000))throw new Error('백업 내부의 기록 수나 구조가 지원 범위를 넘었어요.');for(const v of values)if(v&&typeof v==='object')stack.push([v,depth+1]);}
 const parsed=wrapped?envelope.safeParse(value):backupStateSchema.safeParse(value);
 if(!parsed.success)throw new Error(parsed.error.issues.find(i=>i.code==='custom')?.message||'하루단어 백업 형식이나 버전을 확인해 주세요. 파일은 수정하지 않고 보관해 주세요.');
 const data=parsed.data;const result:ParsedBackup='state'in data?{state:data.state,exportedAt:data.exportedAt,legacy:false}:{state:data,legacy:true};
 // Verify row/parameter limits before showing a restorable preview.
 restoreChunks(result.state.progress);restoreChunks(result.state.sessions);
 return result;
}
export function makeBackup(state:State){return {format:'haru-words-v1' as const,exportedAt:new Date().toISOString(),state};}
export function backupSummary(state:State){return {words:Object.keys(state.progress).length,sessions:Object.keys(state.sessions).length,personal:Object.values(state.progress).filter(p=>p.personal).length,unfinished:Object.values(state.sessions).filter(s=>!s.finished).length,level:state.settings.level,goal:state.settings.dailyGoal};}
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
