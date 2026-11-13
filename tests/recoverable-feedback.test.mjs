import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalLearningDrafts} from '../lib/local-learning-drafts.ts';
import {runRecoverableFeedback,feedbackRequestKey,recoveredFeedback} from '../lib/recoverable-feedback.ts';
class MemoryStorage{
 data=new Map();fail=false;
 get length(){return this.data.size;}key(i){return [...this.data.keys()][i]??null;}getItem(k){return this.data.get(k)??null;}setItem(k,v){if(this.fail)throw Error('storage unavailable');this.data.set(k,v);}removeItem(k){this.data.delete(k);}
}
const input={domain:'word',targetKey:'synthetic-question',sentence:'She sings well.',expectedModelId:'gpt-6.1-sol'};
const seed={original:input.sentence,correctedSentence:input.sentence,meaningUsage:'appropriate',grammar:'natural',explanation:'합성 의견',provider:'openai',model:input.expectedModelId,requestedModel:input.expectedModelId,promptVersion:'reference-v2',validationVersion:'judgment-v2',createdAt:'2026-11-03T00:00:00.000Z'};
const result=(id,state='completed',status=200,feedback=seed)=>({response:Response.json({},{status}),data:{...(state==='completed'?{feedback}:{}),receipt:{requestId:id,state,persisted:true},code:state==='pending'?'receipt_pending':state==='failed'?'provider_unavailable':'receipt_unknown'}});
function setup(){const storage=new MemoryStorage(),store=new LocalLearningDrafts('owner',crypto.randomUUID(),()=>storage);store.connect();return {storage,store,signal:new AbortController().signal};}
const pending=(store)=>store.list(feedbackRequestKey(input.domain,input.targetKey),'request')[0]?.record.values;

test('the explicit Korean role stays bound by the fingerprint while legacy-readable pending rows recover without resending',async()=>{
 const {store,signal}=setup(),context={...input,contextRole:'intended_korean',contextNote:'그녀는 노래를 잘해요.',expectedContextFingerprint:'d'.repeat(64)};
 let sends=0;const looked=[];
 const io={send:async()=>{sends++;throw new TypeError('synthetic response loss');},lookup:async id=>{looked.push(id);return result(id,'completed',200,{...seed,contextFingerprint:context.expectedContextFingerprint,contextNote:context.contextNote});}};
 await assert.rejects(runRecoverableFeedback(store,context,io,signal));
 const row=pending(store);assert.ok(row);assert.equal(Object.hasOwn(row,'contextRole'),false);
 assert.equal(row.expectedContextFingerprint,context.expectedContextFingerprint);
 const recovered=await runRecoverableFeedback(store,context,io,signal);
 assert.equal(recovered.recovered,true);assert.equal(recovered.feedback.contextNote,context.contextNote);
 assert.equal(sends,1);assert.deepEqual(looked,[row.requestId]);
});

test('AI-2: temporary receipt-less lookup failures retain the pending UUID across explicit clicks',async()=>{
 for(const status of [503,502,429,401]){
  const {store,signal}=setup();let sends=0;const lookedUp=[];
  const io={send:async()=>{sends++;throw new TypeError('synthetic lost response');},lookup:async id=>{lookedUp.push(id);return {response:Response.json({},{status}),data:{code:'provider_unavailable'}};}};
  await assert.rejects(runRecoverableFeedback(store,input,io,signal));const id=pending(store).requestId;
  for(let n=0;n<2;n++){await assert.rejects(runRecoverableFeedback(store,input,io,signal));assert.equal(pending(store).requestId,id);assert.equal(pending(store).state,'pending');}
  assert.equal(sends,1);assert.deepEqual(lookedUp,[id,id]);
 }
});

test('UUID is persisted before a single send and a later explicit new request uses a different UUID',async()=>{
 const {store,signal}=setup();const ids=[];
 const io={send:async meta=>{assert.equal(pending(store).requestId,meta.requestId);ids.push(meta.requestId);return result(meta.requestId);},lookup:async()=>{throw Error('unexpected lookup');}};
 await runRecoverableFeedback(store,input,io,signal);assert.equal(recoveredFeedback(store,input.domain,input.targetKey).original,input.sentence);
 await runRecoverableFeedback(store,input,io,signal);assert.equal(ids.length,2);assert.notEqual(ids[0],ids[1]);
});
test('network loss and a fresh page recover only by GET, even after input or model changes',async()=>{
 const {store,storage,signal}=setup();let sends=0,lookups=0;
 await assert.rejects(runRecoverableFeedback(store,input,{send:async()=>{sends++;throw new TypeError('offline');},lookup:async()=>{throw Error('unexpected');}},signal));
 const old=pending(store);assert.equal(old.state,'pending');
 const fresh=new LocalLearningDrafts('owner',crypto.randomUUID(),()=>storage);fresh.connect();
 const value=await runRecoverableFeedback(fresh,{...input,sentence:'Edited input.',expectedModelId:'gpt-6-astra'},{send:async()=>{sends++;throw Error('must not send');},lookup:async id=>{lookups++;assert.equal(id,old.requestId);return result(id);}},signal);
 assert.equal(value.feedback.original,input.sentence);assert.equal(value.feedback.requestedModel,input.expectedModelId);assert.equal(value.recovered,true);assert.equal(sends,1);assert.equal(lookups,1);
 assert.equal(fresh.list(feedbackRequestKey(input.domain,input.targetKey),'request').length,1);
});
test('pending results are checked once per click without polling, resend, or premature replacement',async()=>{
 const {store,signal}=setup();let sends=0,lookups=0;
 const io={send:async()=>{sends++;throw new TypeError('lost');},lookup:async id=>{lookups++;return result(id,'pending',202);}};
 await assert.rejects(runRecoverableFeedback(store,input,io,signal));const id=pending(store).requestId;
 for(let i=0;i<2;i++)await assert.rejects(runRecoverableFeedback(store,input,io,signal),e=>e.issue?.code==='receipt_pending');
 assert.equal(sends,1);assert.equal(lookups,2);assert.equal(pending(store).requestId,id);
});
test('unknown/expired/failed lookup is acknowledged without sending; a subsequent click can start a new attempt',async()=>{
 for(const [state,status] of [['unknown',404],['expired',410],['failed',503],['invalidated',409]]){
  const {store,signal}=setup();let sends=0;
  await assert.rejects(runRecoverableFeedback(store,input,{send:async()=>{sends++;throw new TypeError('lost');},lookup:async()=>{throw Error('unexpected');}},signal));
  const id=pending(store).requestId;
  const io={send:async meta=>{sends++;assert.notEqual(meta.requestId,id);return result(meta.requestId);},lookup:async requestId=>result(requestId,state,status)};
  await assert.rejects(runRecoverableFeedback(store,input,io,signal));assert.equal(sends,1);assert.equal(pending(store).state,'failed');
  await runRecoverableFeedback(store,input,io,signal);assert.equal(sends,2);
 }
});
test('unavailable or full local storage prevents paid submission',async()=>{
 const {store,storage,signal}=setup();storage.fail=true;let sends=0;
 await assert.rejects(runRecoverableFeedback(store,input,{send:async()=>{sends++;return result('bad');},lookup:async()=>{throw Error('unexpected');}},signal),e=>e.issue?.code==='draft_unavailable');
 assert.equal(sends,0);
});
test('clearing drafts or switching accounts while a request finishes cannot recreate deleted/private input',async()=>{
 for(const action of ['clear','switch','cancel']){
  const {store,storage}=setup(),controller=new AbortController();let finish;
  const running=runRecoverableFeedback(store,input,{send:async meta=>new Promise(resolve=>{finish=()=>resolve(result(meta.requestId));}),lookup:async()=>{throw Error('unexpected');}},controller.signal);
  while(!finish)await new Promise(resolve=>setImmediate(resolve));
  if(action==='clear')store.clear();else if(action==='switch'){const other=new LocalLearningDrafts('other',crypto.randomUUID(),()=>storage);other.connect();store.refresh();}else controller.abort();
  finish();await assert.rejects(running,e=>e.name==='AbortError');
  if(action!=='cancel')assert.equal(store.list().length,0);
 }
});
test('mismatched receipt IDs and feedback provenance are rejected without retries',async()=>{
 for(const changed of ['id','model','original']){
  const {store,signal}=setup();let sends=0;
  await assert.rejects(runRecoverableFeedback(store,input,{send:async meta=>{sends++;return result(changed==='id'?crypto.randomUUID():meta.requestId,'completed',200,{...seed,...(changed==='model'?{requestedModel:'gpt-6-astra'}:changed==='original'?{original:'Other input.'}:{})});},lookup:async()=>{throw Error('unexpected');}},signal),e=>e.issue?.code==='invalid_response');
  assert.equal(sends,1);assert.equal(pending(store).state,'pending');
 }
});
test('a second tab sees the first tab pending request and looks it up instead of sending another',async()=>{
 const {store,storage,signal}=setup();let sends=0;
 await assert.rejects(runRecoverableFeedback(store,input,{send:async()=>{sends++;throw new TypeError('lost');},lookup:async()=>{throw Error('unexpected');}},signal));
 const other=new LocalLearningDrafts('owner',crypto.randomUUID(),()=>storage);other.connect();
 await runRecoverableFeedback(other,input,{send:async()=>{sends++;throw Error('duplicate');},lookup:async id=>result(id)},signal);
 assert.equal(sends,1);assert.equal(recoveredFeedback(other,input.domain,input.targetKey).original,input.sentence);
});

test('successful HTTP with missing or invalid receipt is a format failure that retains the pending UUID',async()=>{
 for(const data of [null,{}, {feedback:seed,receipt:{state:'completed'}}]){
  const {store,signal}=setup();let sends=0;
  const io={send:async()=>{sends++;return {response:Response.json({}, {status:200}),data};},lookup:async id=>result(id,'unknown',404)};
  await assert.rejects(runRecoverableFeedback(store,input,io,signal),e=>e.issue?.code==='invalid_response');assert.equal(pending(store).state,'pending');
  await assert.rejects(runRecoverableFeedback(store,input,io,signal),e=>e.issue?.code==='receipt_unknown');assert.equal(sends,1);assert.equal(pending(store).state,'failed');
 }
});

test('context-bound pending results are recovered for their original context only, without a new paid send',async()=>{
 const {store,signal}=setup(),old={...input,contextNote:'질문에 대한 답변',expectedContextFingerprint:'a'.repeat(64)};let sends=0;
 const io={send:async()=>{sends++;throw new TypeError('lost');},lookup:async id=>result(id,'completed',200,{...seed,promptVersion:'reference-v3',validationVersion:'judgment-v3',contextFingerprint:old.expectedContextFingerprint,contextNote:old.contextNote})};
 await assert.rejects(runRecoverableFeedback(store,old,io,signal));
 const recovered=await runRecoverableFeedback(store,{...old,contextNote:'다른 상황',expectedContextFingerprint:'b'.repeat(64)},io,signal);
 assert.equal(recovered.feedback.contextFingerprint,old.expectedContextFingerprint);assert.equal(sends,1);
 const next=setup();await assert.rejects(runRecoverableFeedback(next.store,old,{...io,send:async meta=>result(meta.requestId,'completed',200,{...seed,contextFingerprint:'c'.repeat(64)})},next.signal),e=>e.issue?.code==='invalid_response');
 assert.equal(pending(next.store).state,'pending');
});
