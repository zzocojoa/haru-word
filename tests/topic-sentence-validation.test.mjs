import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handleTopicSentenceValidation } from '../lib/server/topic-sentence-validation.mjs';
const origin='https://wordgrain-oxford-study.hoihou-o.chatgpt.site';
const key='a'.repeat(64),now=Date.now();
const request=(body,headers={})=>new Request(origin+'/api/card-automation-validation',{method:'POST',headers:{'Content-Type':'application/json','X-Topic-Validation-Key':key,...headers},body:JSON.stringify(body)});
const input={provider:'google',stage:'interpret',settings:{topic:'여행 영어',level:'초급',template:'expression',base_expression:'',start_date:'2026-10-08',end_date:null,time:'07:30'},content:null,review:null,recent:[]};
function setup() {
  const db=new DatabaseSync(':memory:'); db.exec('CREATE TABLE card_automation_nonces(nonce TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)');
  const config={topic_sentence_validation_key:key,topic_sentence_validation_expires:new Date(now+7200000).toISOString(),card_studio_enabled:'true',card_studio_owner_id:'fixture-owner',card_studio_bridge_secret:'fixture-secret-with-more-than-thirty-two-characters',google_ai_enabled:'true',google_api:'fixture-google',groq_api:'fixture-groq',
    DB:{prepare(sql){return {async first(){return db.prepare(sql).get()??null;},bind(...args){return {sql,args};}};},async batch(statements){db.exec('BEGIN');try{const result=statements.map(s=>({meta:{changes:Number(db.prepare(s.sql).run(...s.args).changes)}}));db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}}};
  let calls=0;
  const provider=async()=>{calls++;return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({summary:'여행 상황 영어',include:['여행 상황'],exclude:['무관한 상황'],source_kind:'none'})}]}}]});};
  return {db,config,provider,calls:()=>calls,run:(body,headers={},override={})=>handleTopicSentenceValidation(request(body,headers),{...config,...override},provider,()=>now)};
}
test('default, expired and overlong authorization remain disabled without AI or database changes',async()=>{
  const x=setup();try{for(const override of [{topic_sentence_validation_key:undefined},{topic_sentence_validation_expires:new Date(now).toISOString()},{topic_sentence_validation_expires:new Date(now+86400001).toISOString()}])assert.equal((await x.run({action:'status'},{},override)).status,404);assert.equal(x.calls(),0);assert.equal(x.db.prepare('SELECT count(*) n FROM card_automation_nonces').get().n,0);}finally{x.db.close();}
});
test('wrong credentials and browser-originated requests fail before reading effects',async()=>{
  const x=setup();try{for(const headers of [{'X-Topic-Validation-Key':'b'.repeat(64)},{Origin:origin},{Cookie:'fixture=yes'},{'Content-Type':'text/plain'}])assert.equal((await x.run({action:'status'},headers)).status,403);assert.equal(x.calls(),0);assert.equal(x.db.prepare('SELECT count(*) n FROM card_automation_nonces').get().n,0);}finally{x.db.close();}
});
test('status reads existing readiness with no AI or nonce write',async()=>{
  const x=setup();try{assert.deepEqual(await(await x.run({action:'status'})).json(),{ready:true});assert.equal(x.calls(),0);assert.equal(x.db.prepare('SELECT count(*) n FROM card_automation_nonces').get().n,0);}finally{x.db.close();}
});
test('invalid request sizes, topic, level, stage and budget slots fail before provider',async()=>{
  const x=setup();try{
    for(const body of [{action:'call',number:0,input},{action:'call',number:49,input},{action:'call',number:1,input,other:true},...[
      {...input,stage:'revise'},{...input,settings:{...input.settings,topic:'미허용 주제'}},{...input,settings:{...input.settings,level:'고급'}}].map(input=>({action:'call',number:1,input}))])assert.equal((await x.run(body)).status,400);
    assert.equal((await x.run({action:'status',padding:'x'.repeat(65536)})).status,400);assert.equal(x.calls(),0);
  }finally{x.db.close();}
});
test('current interpret schema and Site key are used; concurrent duplicate slot permits only one AI',async()=>{
  const x=setup();try{const outputs=await Promise.all([x.run({action:'call',number:1,input}),x.run({action:'call',number:1,input})]);assert.deepEqual(outputs.map(r=>r.status).sort(),[200,409]);assert.equal(x.calls(),1);assert.equal((await outputs.find(r=>r.status===200).json()).result.source_kind,'none');}finally{x.db.close();}
});
test('48 shared durable slots cap attempts, do not create product tables, and remain protected until expiry',async()=>{
  const x=setup();try{for(let number=1;number<=48;number++)assert.equal((await x.run({action:'call',number,input})).status,200);assert.equal(x.calls(),48);assert.equal((await x.run({action:'call',number:1,input})).status,409);assert.equal((await x.run({action:'call',number:49,input})).status,400);assert.equal(x.calls(),48);assert.deepEqual(x.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name),['card_automation_nonces']);const rows=x.db.prepare("SELECT expires_at FROM card_automation_nonces WHERE nonce LIKE 'topic-validation:%'").all();assert.equal(rows.length,48);assert.ok(rows.every(r=>r.expires_at===now+7500000));}finally{x.db.close();}
});
test('storage failures and invalid relay payload never reach a provider',async()=>{
  const x=setup();try{const badDb={...x.config.DB,batch:async()=>{throw new Error('fixture storage');}};assert.equal((await x.run({action:'call',number:1,input},{},{DB:badDb})).status,503);assert.equal((await x.run({action:'call',number:2,input:{...input,other:true}})).status,400);assert.equal(x.calls(),0);}finally{x.db.close();}
});
test('provider auth failure is safely returned and cannot retry the same authorization slot',async()=>{
  const x=setup();try{let calls=0;const provider=async()=>{calls++;return new Response('fixture sensitive error',{status:403});};const run=()=>handleTopicSentenceValidation(request({action:'call',number:1,input}),x.config,provider,()=>now);const response=await run();assert.equal(response.status,502);assert.deepEqual(await response.json(),{error:'auth',http_status:403});assert.equal((await run()).status,409);assert.equal(calls,1);}finally{x.db.close();}
});
