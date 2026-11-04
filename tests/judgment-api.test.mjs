import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const boundary = { name: 'synthetic-judgment-boundaries', setup(b) {
  b.onResolve({ filter: /^(cloudflare:workers|@\/app\/chatgpt-auth|@\/db\/(store|feedback))$/ }, a => ({path:a.path,namespace:'judgment-boundary'}));
  b.onLoad({ filter: /.*/, namespace: 'judgment-boundary' }, a => ({loader:'js',contents:a.path==='cloudflare:workers'?'export const env=globalThis.judgmentApi.env;'
    :a.path.endsWith('chatgpt-auth')?'export const getChatGPTUser=async()=>({userId:"synthetic-judgment"});'
    :a.path.endsWith('store')?'export const database=()=>({});'
    :'export const loadFeedbackContext=async(_db,_user,kind)=>({modelId:"gpt-6.1-sol",document:JSON.stringify(kind==="word"?globalThis.judgmentApi.session:globalThis.judgmentApi.progress)});export const loadFeedbackModel=async()=>"gpt-6.1-sol";export const loadPersonalWord=async()=>undefined;export const recordFeedbackAttempt=async()=>{globalThis.judgmentApi.attempts++};'}));
} };
const out='work/judgment-api-tests';
await build({entryPoints:{word:'app/api/sentence-feedback/route.ts',grammar:'app/api/grammar-feedback/route.ts'},outdir:out,bundle:true,format:'esm',platform:'node',outExtension:{'.js':'.mjs'},logLevel:'silent',plugins:[boundary]});
await build({stdin:{contents:"export {systemInstruction,legacySystemInstruction} from './lib/feedback-prompts';export {grammarInstruction,legacyGrammarInstruction,grammarFeedbackInput} from './lib/grammar/feedback';export {LESSON_MAP} from './lib/grammar/content';export {lessonForVersion} from './lib/grammar/content-v4';",resolveDir:process.cwd(),loader:'ts'},outfile:out+'/helpers.mjs',bundle:true,format:'esm',platform:'node',logLevel:'silent'});
const helpers=await import('../'+out+'/helpers.mjs');
const word=JSON.parse(readFileSync('data/words.json','utf8')).find(w=>w.word==='arrive'&&w.pos==='v.');
const sessionId='b1111111-1111-4111-8111-111111111111',answer={first:'synthetic first',latest:'synthetic latest',helped:false,attempts:1};
globalThis.judgmentApi={env:{OPENAI_API_KEY:'SYNTHETIC_NEVER_REAL',OPENAI_ALLOWED_MODELS:'gpt-6.1-sol',ai_feedback_enabled:'true',grammar_enabled:'true'},attempts:0};
const r=globalThis.judgmentApi,routes={word:await import('../'+out+'/word.mjs'),grammar:await import('../'+out+'/grammar.mjs')};
function setup(sentence,version=1){r.attempts=0;r.session={id:sessionId,stage:'sentence',ids:[word.id],index:0,retryMode:false,records:{[word.id]:{meaning:'도착하다'}}};r.progress={stage:5,sentence,answers:{q1:answer,q2:answer,q3:answer},updatedAt:'2026-11-03T00:00:00.000Z',...(version>1?{contentVersion:version,questionIds:[1,2,3].map(n=>`auxiliary:${version}:base:q${n}`),observation:answer}:{})};}
const request=(domain,sentence,extra={},capability='4')=>new Request('https://local.test/api/'+(domain==='word'?'sentence':'grammar')+'-feedback',{method:'POST',headers:{Origin:'https://local.test','Content-Type':'application/json','X-Study-AI-Contract':capability,'X-Study-Grammar':'4','X-Study-Feedback-Structure':'1'},body:JSON.stringify({...domain==='word'?{sessionId,entryId:word.id,sentence,expectedModelId:'gpt-6.1-sol'}:{lessonId:'auxiliary',sentence,expectedModelId:'gpt-6.1-sol'},...extra})});
const currentWire=sentence=>({meaningUsage:'appropriate',grammar:'natural',correctedSentence:sentence,targetReason:'합성 목표 설명',grammarReason:'합성 문법 설명',correctionReason:'',contextNeeded:'none'});
const oldWire=sentence=>({meaningUsage:'appropriate',grammar:'natural',correctedSentence:sentence,explanation:'합성 v142 설명',structure:{status:'unavailable',translation:'',parts:[],note:'합성'}});
const response=(body,value)=>Response.json({status:'completed',model:body.model,output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value)}]}]});

test('both actual routes activate the judgment candidate only for the exact explicit switch',async t=>{
 t.mock.method(console,'info',()=>{});
 for(const domain of ['word','grammar'])for(const flag of [undefined,'false','TRUE','true']){
  const sentence=domain==='word'?'She arrives home.':'I am writing.';setup(sentence);r.env.feedback_judgment_enabled=flag;
  const active=flag==='true';let calls=0,sent;
  t.mock.method(globalThis,'fetch',async(_url,init)=>{calls++;sent=JSON.parse(init.body);return response(sent,active?currentWire(sentence):oldWire(sentence));});
  const result=await routes[domain].POST(request(domain,sentence)),body=await result.json();
  assert.equal(result.status,200);assert.equal(calls,1);assert.equal(r.attempts,1);
  assert.equal(body.feedback.validationVersion,active?'judgment-v5':'structured-v1');assert.equal(body.feedback.promptVersion,active?'reference-v5':'reference-v1');
  assert.equal(Object.hasOwn(body.feedback,'structure'),!active);
  const instruction=domain==='word'?(active?helpers.systemInstruction:helpers.legacySystemInstruction):(active?helpers.grammarInstruction:helpers.legacyGrammarInstruction);
  assert.ok(sent.instructions.startsWith(instruction));
 }
});

test('judgment grammar routes preserve the actual v1-v4 lesson context and source progress',async t=>{
 t.mock.method(console,'info',()=>{});r.env.feedback_judgment_enabled='true';
 for(const version of [1,2,3,4]){
  const sentence='I am writing.';setup(sentence,version);const before=JSON.stringify(r.progress);let sent;
  t.mock.method(globalThis,'fetch',async(_url,init)=>{sent=JSON.parse(init.body);return response(sent,currentWire(sentence));});
  const result=await routes.grammar.POST(request('grammar',sentence));assert.equal(result.status,200);
  const expected=helpers.grammarFeedbackInput(helpers.lessonForVersion(helpers.LESSON_MAP.get('auxiliary'),version),sentence);
  assert.deepEqual(JSON.parse(sent.input[0].content),expected);assert.equal(JSON.stringify(r.progress),before);
 }
});

test('unverified role contradictions are replaced by reviewed product explanations without generated structure or a second request',async t=>{
 t.mock.method(console,'warn',()=>{});r.env.feedback_judgment_enabled='true';
 for(const domain of ['word','grammar']){
  const sentence='I am writing.';setup(sentence);let calls=0;
  t.mock.method(globalThis,'fetch',async(_url,init)=>{calls++;const body=JSON.parse(init.body);return response(body,{...currentWire(sentence),grammarReason:'writing은 목적어입니다.'});});
  const result=await routes[domain].POST(request(domain,sentence)),body=await result.json();
  assert.equal(result.status,200);assert.equal(calls,1);
  assert.ok(!body.feedback.explanation.includes('writing은 목적어'));assert.equal(body.feedback.original,sentence);
 }
});

test('v4 routes reject outdated clients and changed context fingerprints before provider dispatch',async t=>{
 r.env.feedback_judgment_enabled='true';let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('must not dispatch');});
 for(const domain of ['word','grammar']){
  setup('She arrives home.');
  assert.equal((await routes[domain].POST(request(domain,'She arrives home.',{},'2'))).status,426);
  assert.equal((await routes[domain].POST(request(domain,'She arrives home.',{},'3'))).status,426);
  assert.equal((await routes[domain].POST(request(domain,'She arrives home.',{expectedContextFingerprint:'0'.repeat(64),contextNote:'질문에 대한 답변'}))).status,409);
  assert.equal((await routes[domain].POST(request(domain,'She arrives home.',{contextNote:'x'.repeat(501)}))).status,400);
 }assert.equal(calls,0);assert.equal(r.attempts,0);
});

test('v4 routes bind explicit context, model, target and curriculum stem without ordinary notes',async t=>{
 r.env.feedback_judgment_enabled='true';t.mock.method(console,'info',()=>{});
 for(const domain of ['word','grammar']){
  const sentence='She arrives home.';setup(sentence,4);r.session.records[word.id].notes='PRIVATE_LEARNING_NOTE';let sent;
  t.mock.method(globalThis,'fetch',async(_url,init)=>{sent=JSON.parse(init.body);return response(sent,currentWire(sentence));});
  const result=await routes[domain].POST(request(domain,sentence,{contextNote:'어제 상황을 설명하는 답변이에요.',contextKind:'reply'}));
  assert.equal(result.status,200);const body=await result.json(),input=JSON.parse(sent.input[0].content);
  assert.equal(input.contextNote,'어제 상황을 설명하는 답변이에요.');assert.ok(!JSON.stringify(sent).includes('PRIVATE_LEARNING_NOTE'));
  assert.equal(input.contextKind,'reply');assert.match(body.feedback.explanation,/대화의 짧은 답변/);
  if(domain==='grammar')assert.equal(input.stem,helpers.lessonForVersion(helpers.LESSON_MAP.get('auxiliary'),4).stem);
  assert.match(body.feedback.contextFingerprint,/^[a-f0-9]{64}$/);assert.equal(body.feedback.contextNote,input.contextNote);
 }
});

test('candidate/profile wire mismatch fails without fallback or switching the selected model',async t=>{
 t.mock.method(console,'error',()=>{});
 for(const flag of ['false','true']){
  r.env.feedback_judgment_enabled=flag;const sentence='She arrives home.';setup(sentence);let calls=0;
  t.mock.method(globalThis,'fetch',async(_url,init)=>{calls++;const body=JSON.parse(init.body);assert.equal(body.model,'gpt-6.1-sol');return response(body,flag==='true'?oldWire(sentence):currentWire(sentence));});
  const result=await routes.word.POST(request('word',sentence)),body=await result.json();assert.equal(result.status,502);assert.equal(body.code,'provider_invalid_response');assert.equal(calls,1);
 }
});
