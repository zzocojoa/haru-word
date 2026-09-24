import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { history,emptyState,oversizedState } from './fixtures/backup-history.cjs';
mkdirSync('work/restore-job-tests',{recursive:true});
await build({entryPoints:['db/restore-jobs.ts','lib/backup-analysis.ts','lib/restore-validation.ts','lib/restore-protocol.ts'],outdir:'work/restore-job-tests',entryNames:'[name]',outExtension:{'.js':'.mjs'},bundle:true,format:'esm',platform:'node',logLevel:'silent'});
const api=await import('../work/restore-job-tests/restore-jobs.mjs');
const {analyzeBackup,analyzeExport}=await import('../work/restore-job-tests/backup-analysis.mjs');
const {manifestSchema,parsePart}=await import('../work/restore-job-tests/restore-validation.mjs');
const {sha256}=await import('../work/restore-job-tests/restore-protocol.mjs');
const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
for(const file of ['0000_worthless_doctor_faustus','0001_ai_daily_usage','0002_old_golden_guardian'])sqlite.exec(readFileSync(`drizzle/${file}.sql`,'utf8'));
let failAt=-1;
const db={prepare(sql){return {bind(...args){return {sql,args,async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}}}}}}},async batch(statements){sqlite.exec('BEGIN');try{const result=statements.map((s,i)=>{if(i===failAt)throw Error('injected');const r=sqlite.prepare(s.sql).run(...s.args);return {meta:{changes:Number(r.changes)}}});sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const raw=state=>JSON.stringify({format:'haru-words-v1',exportedAt:'2026-09-24T00:00:00.000Z',state});
const reset=()=>{sqlite.exec('DELETE FROM restore_jobs; DELETE FROM learner_states; DELETE FROM word_progress; DELETE FROM study_sessions;DELETE FROM ai_daily_usage');for(const user of ['owner','other']){sqlite.prepare('INSERT INTO learner_states VALUES (?,0,?,?)').run(user,JSON.stringify(emptyState().settings),'now');sqlite.prepare('INSERT INTO ai_daily_usage VALUES (?,?,?,?)').run(user,'2026-09-24',9,0);}failAt=-1;};
const dump=()=>JSON.stringify(['learner_states','word_progress','study_sessions','ai_daily_usage'].map(t=>sqlite.prepare(`SELECT * FROM ${t} ORDER BY user_id`).all()));
const ready=async(state=history(2))=>{const data=await analyzeBackup(raw(state));let job=await api.createRestoreJob(db,'owner',0,data.manifest);for(let i=0;i<data.parts.length;i++)await api.uploadRestorePart(db,'owner',job.id,i,data.parts[i]);while(job.status!=='ready')job=await api.validateRestoreJob(db,'owner',job.id);return {job,data};};

test('20 MB import/export preserves old JSON, rejects the boundary above it, and retains oversized archives',async()=>{
 const state=history(1825),text=JSON.stringify(JSON.parse(raw(state)),null,2);assert.ok(Buffer.byteLength(text)>8_000_000&&Buffer.byteLength(text)<20_000_000);
 const result=await analyzeBackup(text);assert.deepEqual(result.parsed.state,state);assert.ok(result.parts.every(p=>Buffer.byteLength(p)<=1_800_000));
 const small=raw(emptyState()),atLimit=small+' '.repeat(20_000_000-Buffer.byteLength(small));assert.equal((await analyzeBackup(atLimit)).bytes,20_000_000);
 await assert.rejects(analyzeBackup(atLimit+' '),/20 MB/);
 const huge=oversizedState();for(const p of Object.values(huge.progress)){p.expression=p.notes;p.translation=p.notes;}
 const archive=await analyzeExport(huge,Date.now(),20_000_000);assert.match(archive.error,/20 MB/);assert.deepEqual(JSON.parse(archive.raw).state,huge);
 assert.deepEqual((await analyzeBackup(JSON.stringify(emptyState()))).parsed.state,emptyState());
});
test('manifest rejects excess rows, bytes, malformed hashes and unknown fields',async()=>{
 const {manifest}=await analyzeBackup(raw(emptyState()));
 for(const mutate of [m=>m.fileBytes=20_000_001,m=>m.fileHash='invalid',m=>m.extra=true,m=>m.parts=[{kind:'progress',count:5001,bytes:100,hash:'a'.repeat(64)}]]){const m=structuredClone(manifest);mutate(m);assert.equal(manifestSchema.safeParse(m).success,false);}
});
test('create and upload are resumable/idempotent and account-scoped without touching learner records',async()=>{
 reset();const before=dump(),data=await analyzeBackup(raw(history(2)));const job=await api.createRestoreJob(db,'owner',0,data.manifest);
 assert.equal((await api.createRestoreJob(db,'owner',0,data.manifest)).id,job.id);
 await api.uploadRestorePart(db,'owner',job.id,0,data.parts[0]);await api.uploadRestorePart(db,'owner',job.id,0,data.parts[0]);
 assert.deepEqual((await api.activeRestoreJob(db,'owner')).received,[0]);assert.equal(await api.activeRestoreJob(db,'other'),null);
 await assert.rejects(api.getRestoreJob(db,'other',job.id),e=>e.status===404);await assert.rejects(api.cancelRestoreJob(db,'other',job.id),e=>e.status===404);
 await assert.rejects(api.uploadRestorePart(db,'owner',job.id,0,data.parts[0]+' '),/원본과 달라/);
 await assert.rejects(api.validateRestoreJob(db,'owner',job.id),/전송하지 않은/);assert.equal(dump(),before);
});
test('cross-part duplicate keys and missing personal references fail before commit',async()=>{
 reset();const data=await analyzeBackup(raw(history(1))),m=structuredClone(data.manifest);m.parts.push(m.parts[0]);const job=await api.createRestoreJob(db,'owner',0,m);
 for(let i=0;i<m.parts.length;i++)await api.uploadRestorePart(db,'owner',job.id,i,data.parts[i]||data.parts[0]);await assert.rejects(api.validateRestoreJob(db,'owner',job.id),/중복/);
 reset();const state=history(1),s=Object.values(state.sessions)[0],old=s.ids[0],id='personal_'+crypto.randomUUID();s.ids[0]=id;s.records[id]={...s.records[old],entryId:id};delete s.records[old];
 const part=JSON.stringify(state.sessions),manifest={fileHash:'a'.repeat(64),fileBytes:Buffer.byteLength(part),settings:state.settings,parts:[{kind:'sessions',bytes:Buffer.byteLength(part),hash:await sha256(part),count:1}]};
 const broken=await api.createRestoreJob(db,'owner',0,manifest);await api.uploadRestorePart(db,'owner',broken.id,0,part);await assert.rejects(api.validateRestoreJob(db,'owner',broken.id),/개인 단어/);
});
test('successful commit and lost-response retry apply exactly once; receipts retain no uploaded content',async()=>{
 reset();const {job,data}=await ready();const other=sqlite.prepare('SELECT * FROM learner_states WHERE user_id=?').get('other');
 const result=await api.commitRestoreJob(db,'owner',job.id);assert.equal(result.revision,1);assert.equal(result.status,'committed');const after=dump();
 assert.deepEqual(await api.commitRestoreJob(db,'owner',job.id),result);assert.equal(dump(),after);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM restore_parts').get().n,0);assert.equal(await api.activeRestoreJob(db,'owner'),null);
 assert.deepEqual(JSON.parse(sqlite.prepare('SELECT settings FROM learner_states WHERE user_id=?').get('owner').settings),data.parsed.state.settings);
 assert.deepEqual(sqlite.prepare('SELECT * FROM learner_states WHERE user_id=?').get('other'),other);
 assert.equal(sqlite.prepare('SELECT request_count FROM ai_daily_usage WHERE user_id=?').get('owner').request_count,9);
});
test('concurrent revision changes and every transaction failure preserve all original records',async()=>{
 for(let i=0;i<8;i++){reset();const {job}=await ready();const before=dump();failAt=i;await assert.rejects(api.commitRestoreJob(db,'owner',job.id),/injected/);assert.equal(dump(),before);assert.equal((await api.getRestoreJob(db,'owner',job.id)).status,'ready');}
 reset();const {job}=await ready();sqlite.prepare('UPDATE learner_states SET revision=1 WHERE user_id=?').run('owner');const before=dump();await assert.rejects(api.commitRestoreJob(db,'owner',job.id),e=>e.status===409);assert.equal(dump(),before);
});
test('cancel and expiry free the active slot and delete staged content only',async()=>{
 reset();const {job,data}=await ready();const before=dump();assert.equal((await api.cancelRestoreJob(db,'owner',job.id)).status,'cancelled');assert.equal(dump(),before);
 await assert.rejects(api.commitRestoreJob(db,'owner',job.id),e=>e.status===409);assert.equal(sqlite.prepare('SELECT count(*) n FROM restore_parts').get().n,0);
 const next=await api.createRestoreJob(db,'owner',0,data.manifest);await api.uploadRestorePart(db,'owner',next.id,0,data.parts[0]);sqlite.prepare('UPDATE restore_jobs SET expires_at=0 WHERE id=?').run(next.id);
 await assert.rejects(api.getRestoreJob(db,'owner',next.id),e=>e.status===410);await api.cleanupRestoreJobs(db,'owner');assert.equal(await api.activeRestoreJob(db,'owner'),null);assert.equal(sqlite.prepare('SELECT count(*) n FROM restore_parts').get().n,0);assert.equal(dump(),before);
});
test('an explicit empty file validates and restores without an upload part',async()=>{reset();const {job}=await ready(emptyState());assert.equal(job.total,0);assert.equal((await api.commitRestoreJob(db,'owner',job.id)).revision,1);});

test('staged parts reject oversized collections and deep objects before per-row schema validation',()=>{
 const descriptor={kind:'progress',count:1,hash:'a'.repeat(64),bytes:100};
 assert.throws(()=>parsePart(JSON.stringify({word:{studyDates:Array(20001).fill('bad')}}),descriptor),/기록 수나 구조/);
 let deep={};for(let i=0;i<26;i++)deep={nested:deep};
 assert.throws(()=>parsePart(JSON.stringify(deep),descriptor),/기록 수나 구조/);
});

test('interrupted validation resumes its cursor and preserves live records until commit',async()=>{
 reset();const before=dump(),data=await analyzeBackup(raw(history(2)));let job=await api.createRestoreJob(db,'owner',0,data.manifest);
 for(let i=0;i<data.parts.length;i++)await api.uploadRestorePart(db,'owner',job.id,i,data.parts[i]);
 job=await api.validateRestoreJob(db,'owner',job.id);assert.equal(job.status,'validating');assert.equal(job.validated,1);
 const resumed=await api.createRestoreJob(db,'owner',0,data.manifest);assert.equal(resumed.id,job.id);assert.equal(resumed.validated,1);assert.equal(dump(),before);
 while(job.status!=='ready')job=await api.validateRestoreJob(db,'owner',job.id);
 assert.equal(job.validated,data.parts.length);assert.equal(dump(),before);
});

test('active jobs expire after 24 hours and completed receipts after seven days',async()=>{
 reset();const started=Date.now(),{job}=await ready();
 assert.ok(job.expiresAt>=started+24*60*60*1000&&job.expiresAt<=Date.now()+24*60*60*1000);
 const committedAt=Date.now(),receipt=await api.commitRestoreJob(db,'owner',job.id);
 assert.ok(receipt.expiresAt>=committedAt+7*24*60*60*1000&&receipt.expiresAt<=Date.now()+7*24*60*60*1000);
 const after=dump();await api.cleanupRestoreJobs(db,'owner',receipt.expiresAt-1);assert.equal((await api.getRestoreJob(db,'owner',job.id)).status,'committed');
 await api.cleanupRestoreJobs(db,'owner',receipt.expiresAt);await assert.rejects(api.getRestoreJob(db,'owner',job.id),e=>e.status===404);assert.equal(dump(),after);
});
