import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,mkdirSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';import {build} from 'esbuild';
import {EMPTY,newSession,applyRecord,ensureCarryover,continueBatch,repeatDailySession} from '../lib/learning.ts';
import { invalidSessionCases } from './invalid-session-cases.mjs';
import { history, oversizedState } from './fixtures/backup-history.cjs';
import { serializeBackup } from '../lib/backup-format.ts';
mkdirSync('work/backup-tests',{recursive:true});
await build({entryPoints:['lib/backup.ts'],outfile:'work/backup-tests/backup.mjs',bundle:true,format:'esm',platform:'node',logLevel:'silent'});
const {parseBackup,makeBackup,prepareSafetyBackup,replacementChanges,restoreChunks,RESTORE_CHUNK_BYTES,MAX_BACKUP_BYTES}=await import('../work/backup-tests/backup.mjs');
const words=JSON.parse(readFileSync('data/words.json','utf8')),contents=JSON.parse(readFileSync('data/content.json','utf8'));
const fixture=()=>{let state=structuredClone(EMPTY);const s=newSession(state,words,id=>contents[id],'daily','2026-09-22');state=ensureCarryover({...state,settings:{...state.settings,activeSessionId:s.id},sessions:{[s.id]:s}},s);return state;};
const envelope=s=>JSON.stringify(makeBackup(s));
const jsonValue=v=>JSON.parse(JSON.stringify(v));

test('730-session safety and whole backups share compact bytes and preserve every record',()=>{
 const state=history(),now=new Date('2026-09-24T00:00:00Z');
 const pretty=JSON.stringify(makeBackup(state,now),null,2);
 assert.ok(Buffer.byteLength(pretty)>MAX_BACKUP_BYTES);
 assert.throws(()=>parseBackup(pretty),/8 MB/);
 const before=JSON.stringify(state),raw=prepareSafetyBackup(state,now);
 assert.equal(raw,serializeBackup(state,now));
 assert.ok(Buffer.byteLength(raw)<MAX_BACKUP_BYTES);
 assert.deepEqual(parseBackup(raw).state,state);
 assert.equal(JSON.stringify(state),before);
});

test('safety backup blocks oversized UTF-8 state but ordinary export preserves its data',()=>{
 const state=oversizedState(),raw=serializeBackup(state);
 assert.ok(raw.length<MAX_BACKUP_BYTES,'UTF-16 length alone must not be used');
 assert.ok(Buffer.byteLength(raw)>MAX_BACKUP_BYTES);
 assert.throws(()=>prepareSafetyBackup(state),/8 MB/);
 assert.deepEqual(JSON.parse(raw).state,state);
});

test('safety backup runs the actual import reference and per-row validation',()=>{
 const broken=fixture();broken.settings.activeSessionId=crypto.randomUUID();
 assert.throws(()=>prepareSafetyBackup(broken),/이어갈 학습 회차/);
 const largeRow=fixture(),session=Object.values(largeRow.sessions)[0];
 session.kind='weekly';session.period='2026-09-21';session.ids=words.slice(0,350).map(w=>w.id);delete session.wordKeys;
 session.records=Object.fromEntries(session.ids.map(id=>[id,{entryId:id,meaning:contents[id].meaning,en:'unmeasured',ko:'unmeasured',sentenceStatus:'unmeasured',sentence:'',notes:'가'.repeat(1900)}]));
 const raw=serializeBackup(largeRow);assert.ok(Buffer.byteLength(raw)<MAX_BACKUP_BYTES);
 assert.throws(()=>prepareSafetyBackup(largeRow),/한 학습 기록이 너무 커서/);
});

test('current and legacy backups round-trip without changing snapshots, scores, notes or drafts',()=>{
 const s=fixture(),id=s.settings.activeSessionId,word=s.sessions[id].ids[0];s.sessions[id].records[word]={...s.sessions[id].records[word],material:contents[word],draft:{answer:'내 임시 답',hinted:true,revealed:true,stage:'en',retry:false},sentence:'My sentence.',notes:'내 메모'};
 assert.deepEqual(parseBackup(envelope(s)).state,jsonValue(s));assert.deepEqual(parseBackup(JSON.stringify(s)).state,jsonValue(s));assert.equal(parseBackup(JSON.stringify(s)).legacy,true);assert.equal(parseBackup('\ufeff'+envelope(s)).legacy,false);
});
test('real daily, delayed retry, weekly and monthly cursor states remain restorable',()=>{
 let state=fixture();const sid=state.settings.activeSessionId;let s=state.sessions[sid];
 while(!s.finished){assert.deepEqual(parseBackup(envelope(state)).state,jsonValue(state));const id=s.retryMode?s.retry[0].id:s.ids[s.index];const patch=s.stage==='learn'?{meaning:contents[id].meaning,material:contents[id]}:s.stage==='sentence'?{sentence:'My sentence.',sentenceStatus:'written'}:{[s.stage]:'help'};state=applyRecord(state,s,id,patch,true,'2026-09-22');s=state.sessions[sid];}
 for(const kind of ['weekly','monthly']){let review=newSession(state,words,id=>contents[id],kind,'2026-09-22');const r={...state,sessions:{...state.sessions,[review.id]:review}};assert.deepEqual(parseBackup(envelope(r)).state,jsonValue(r));}
});
test('unknown versions, properties, malformed JSON, unsafe keys and oversized files are rejected',()=>{
 for(const value of ['not json',JSON.stringify({...makeBackup(EMPTY),format:'haru-words-v2'}),JSON.stringify({...makeBackup(EMPTY),token:'do-not-accept'}),'{{}}',envelope(EMPTY).replace('"progress":{}','"progress":{"__proto__":{}}'),' '.repeat(8_000_001)])assert.throws(()=>parseBackup(value));
 assert.equal({}.polluted,undefined);
});
test('monthly checkpoints, resumed batches and all practice modes round-trip through real transitions',()=>{
 let state=structuredClone(EMPTY);state.progress=Object.fromEntries(words.slice(0,21).map(w=>[w.id,{meaning:contents[w.id].meaning,familiarity:'known',studyDates:['2026-09-22'],lastStudied:'2026-09-22',en:'independent',ko:'help',sentenceStatus:'improve'}]));
 let s=newSession(state,words,id=>contents[id],'monthly','2026-09-22');state.sessions[s.id]=s;let checkpoints=0;
 while(!s.finished){assert.deepEqual(parseBackup(envelope(state)).state,jsonValue(state));if(s.stage==='checkpoint'){checkpoints++;s=continueBatch(s);state.sessions[s.id]=s;continue;}const id=s.retryMode?s.retry[0].id:s.ids[s.index];state=applyRecord(state,s,id,s.stage==='sentence'?{sentenceStatus:'unmeasured'}:{ko:'independent'},true,'2026-09-22');s=state.sessions[s.id];}
 assert.equal(checkpoints,1);assert.ok(Object.values(s.records).every(r=>r.en==='unmeasured'));
 for(const mode of ['known','ko','sentence']){const copy=fixture();for(const p of Object.values(copy.progress))Object.assign(p,{familiarity:'known',ko:'help',sentenceStatus:'improve'});const practice=newSession(copy,words,id=>contents[id],'practice','2026-09-22',undefined,mode);assert.ok(practice);copy.sessions[practice.id]=practice;assert.deepEqual(parseBackup(envelope(copy)).state,jsonValue(copy));}
 const daily=fixture(),source=Object.values(daily.sessions)[0];Object.assign(source,{stage:'done',finished:true,paused:true});const repeat=repeatDailySession(daily,words,'2026-09-22');assert.ok(repeat);daily.sessions[repeat.id]=repeat;assert.deepEqual(parseBackup(envelope(daily)).state,jsonValue(daily));
});
test('all references, dates and cursors must be usable before restore',()=>{
 const cases=[s=>{s.settings.activeSessionId=crypto.randomUUID()},s=>{const x=Object.values(s.sessions)[0];delete x.records[x.ids[0]]},s=>{Object.values(s.sessions)[0].date='2026-02-30'},s=>{Object.values(s.sessions)[0].index=999},s=>{Object.values(s.sessions)[0].retryMode=true},s=>{s.progress.unknown={}},s=>{const x=Object.values(s.sessions)[0];x.warmupIds=['personal_'+crypto.randomUUID()]},s=>{s.settings.assessments.A1={ids:[words[0].id],index:1,marks:{},completed:true}}];
 for(const mutate of cases){const s=fixture();mutate(s);assert.throws(()=>parseBackup(envelope(s)));}
});
test('personal words and multiple senses survive, but missing or mismatched personal definitions fail',()=>{
 const s=fixture(),id='personal_'+crypto.randomUUID();s.progress[id]={personal:{id,word:'commute',headword:'commute',pos:'v.',level:'A1',page:0,personal:true},meaning:'통근하다',senses:{통근하다:{meaning:'통근하다',en:'help'}}};assert.deepEqual(parseBackup(envelope(s)).state,jsonValue(s));
 s.progress[id].personal.id=words[0].id;assert.throws(()=>parseBackup(envelope(s)));s.progress[id]={};assert.throws(()=>parseBackup(envelope(s)));
});
test('replacement preview distinguishes added, changed and removed records without mutation',()=>{
 const same=fixture();assert.deepEqual(replacementChanges(same,parseBackup(envelope(same)).state),{words:{added:0,changed:0,removed:0},sessions:{added:0,changed:0,removed:0}});
 const before=fixture(),after=structuredClone(before);const id=Object.keys(after.progress)[0];after.progress[id].notes='새 메모';after.progress[words.at(-1).id]={};delete after.progress[Object.keys(after.progress)[1]];const copy=structuredClone(before);
 assert.deepEqual(replacementChanges(before,after).words,{added:1,changed:1,removed:1});assert.deepEqual(before,copy);
});
test('restore chunks respect UTF-8 parameter size and preserve all records without truncation',()=>{
 const data=Object.fromEntries(Array.from({length:900},(_,i)=>['entry'+i,{text:'가'.repeat(1900)}]));const chunks=restoreChunks(data);assert.ok(chunks.length>2);for(const c of chunks)assert.ok(Buffer.byteLength(c)<=RESTORE_CHUNK_BYTES);assert.deepEqual(Object.assign({},...chunks.map(JSON.parse)),data);
 assert.throws(()=>restoreChunks({one:{text:'가'.repeat(610000)}}));
});

await build({entryPoints:['app/api/state/restore/route.ts'],outfile:'work/backup-tests/route.mjs',bundle:true,format:'esm',platform:'node',logLevel:'silent',plugins:[{name:'boundaries',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'cf-env',namespace:'cf-env'}));b.onLoad({filter:/.*/,namespace:'cf-env'},()=>({contents:'export const env={};',loader:'js'}));b.onResolve({filter:/^@\/(app\/chatgpt-auth|db\/store)$/},a=>({path:a.path,namespace:'boundary'}));b.onLoad({filter:/.*/,namespace:'boundary'},a=>({contents:a.path.endsWith('chatgpt-auth')?'export const getChatGPTUser=async()=>globalThis.backupRuntime.user':'export const database=()=>globalThis.backupRuntime.db',loader:'js'}));}}]});
const sqlite=new DatabaseSync(':memory:');for(const path of ['drizzle/0000_worthless_doctor_faustus.sql','drizzle/0001_ai_daily_usage.sql'])sqlite.exec(readFileSync(path,'utf8'));
let failureAt=-1;let batches=0;let queries=0;
const db={prepare(sql){return {bind(...args){return {sql,args,async first(){return sqlite.prepare(sql).get(...args)??null}}}}},async batch(statements){batches++;queries=statements.length;sqlite.exec('BEGIN');try{const results=statements.map((s,i)=>{if(i===failureAt)throw Error('Injected failure');const r=sqlite.prepare(s.sql).run(...s.args);return {meta:{changes:Number(r.changes)}}});sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}}};
globalThis.backupRuntime={user:{userId:'owner'},db};const {POST}=await import('../work/backup-tests/route.mjs');
const req=(state=fixture(),revision=0,headers={})=>new Request('https://study.example/api/state/restore',{method:'POST',headers:{'content-type':'application/json',origin:'https://study.example','x-study-revision':String(revision),...headers},body:envelope(state)});
const seed=()=>{sqlite.exec('DELETE FROM learner_states; DELETE FROM word_progress; DELETE FROM study_sessions; DELETE FROM ai_daily_usage;');for(const user of ['owner','other']){sqlite.prepare('INSERT INTO learner_states VALUES (?,0,?,?)').run(user,JSON.stringify(EMPTY.settings),'2026-09-22');sqlite.prepare('INSERT INTO word_progress VALUES (?,?,?)').run(user,words.at(-1).id,JSON.stringify({notes:'existing '+user}));sqlite.prepare('INSERT INTO ai_daily_usage VALUES (?,?,?,?)').run(user,'2026-09-22',4,0);}failureAt=-1;batches=0;};
const dump=()=>JSON.stringify(['learner_states','word_progress','study_sessions','ai_daily_usage'].map(table=>sqlite.prepare('SELECT * FROM '+table+' ORDER BY user_id').all()));
test('restore rejects the same invalid session positions as delta saves without DB changes',async()=>{
 seed();const before=dump();
 for(const [name,mutate] of invalidSessionCases){
  const state=fixture();mutate(Object.values(state.sessions)[0]);
  assert.equal((await POST(req(state))).status,400,name);
  assert.equal(dump(),before,name);
 }
 assert.equal(batches,0);
});
test('restore rejects unauthenticated, cross-site, malformed, invalid and oversized requests without database writes',async()=>{
 seed();const before=dump();backupRuntime.user=null;assert.equal((await POST(req())).status,401);backupRuntime.user={userId:'owner'};
 assert.equal((await POST(req(undefined,0,{origin:'https://other.example'}))).status,403);assert.equal((await POST(req(undefined,0,{'sec-fetch-site':'cross-site'}))).status,403);assert.equal((await POST(req(undefined,0,{'content-type':'text/plain'}))).status,415);
 assert.equal((await POST(req(undefined,NaN))).status,400);const invalid=fixture();invalid.settings.activeSessionId=crypto.randomUUID();assert.equal((await POST(req(invalid))).status,400);
 assert.equal((await POST(new Request('https://study.example/api/state/restore',{method:'POST',headers:{'content-type':'application/json','x-study-revision':'0'},body:' '.repeat(8_000_001)}))).status,413);
 assert.equal(batches,0);assert.equal(dump(),before);
});
test('restore replaces only the owner in one transaction and leaves AI usage and other accounts untouched',async()=>{
 seed();const incoming=fixture(),other=sqlite.prepare('SELECT * FROM word_progress WHERE user_id=?').all('other');const r=await POST(req(incoming));assert.equal(r.status,200);assert.deepEqual(await r.json(),{revision:1});assert.equal(batches,1);assert.ok(queries<=50);
 assert.deepEqual(Object.fromEntries(sqlite.prepare('SELECT entry_id,document FROM word_progress WHERE user_id=?').all('owner').map(r=>[r.entry_id,JSON.parse(r.document)])),incoming.progress);
 assert.deepEqual(Object.fromEntries(sqlite.prepare('SELECT session_id,document FROM study_sessions WHERE user_id=?').all('owner').map(r=>[r.session_id,JSON.parse(r.document)])),jsonValue(incoming.sessions));
 assert.deepEqual(sqlite.prepare('SELECT * FROM word_progress WHERE user_id=?').all('other'),other);assert.equal(sqlite.prepare('SELECT request_count FROM ai_daily_usage WHERE user_id=?').get('owner').request_count,4);
});
test('a stale revision and a repeated request never overwrite the successful restore',async()=>{
 seed();assert.equal((await POST(req())).status,200);const after=dump();assert.equal((await POST(req(EMPTY,0))).status,409);assert.equal(dump(),after);
});
test('failure after deletions rolls back the entire replacement and keeps the revision',async()=>{
 seed();const before=dump();failureAt=2;assert.equal((await POST(req())).status,503);assert.equal(dump(),before);failureAt=-1;
});
test('an explicit empty backup restores empty study state without resetting AI limits',async()=>{
 seed();assert.equal((await POST(req(EMPTY))).status,200);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM word_progress WHERE user_id=?').get('owner').n,0);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM study_sessions WHERE user_id=?').get('owner').n,0);assert.equal(sqlite.prepare('SELECT request_count FROM ai_daily_usage WHERE user_id=?').get('owner').request_count,4);
});

test('backup timestamp accepts the synchronized server clock without changing state',()=>{
 const now=new Date('2026-09-22T02:00:00Z');const state=fixture();const backup=makeBackup(state,now);
 assert.equal(backup.exportedAt,now.toISOString());assert.deepEqual(parseBackup(JSON.stringify(backup)).state,jsonValue(state));
});
