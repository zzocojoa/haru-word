import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const report=JSON.parse(readFileSync('data/evaluations/english-accuracy-2026-10-02-annotated.json','utf8'));
const actual=(id,provider)=>structuredClone(report.rows.find(r=>r.caseId===id&&r.provider===provider).feedback);
const word=JSON.parse(readFileSync('data/words.json','utf8')).find(w=>w.word==='arrive'&&w.pos==='v.');
const sid='01111111-1111-4111-8111-111111111111';
const stubs={
  'cloudflare:workers':'export const env=globalThis.safetyRuntime.env;',
  '@/app/chatgpt-auth':'export const getChatGPTUser=async()=>({userId:"synthetic-safety"});',
  '@/db/store':'export const database=()=>globalThis.safetyRuntime.db;',
  '@/db/feedback':'export const loadFeedbackSession=async()=>globalThis.safetyRuntime.session; export const loadPersonalWord=async()=>null; export const recordFeedbackAttempt=async()=>{globalThis.safetyRuntime.attempts++};',
  '@/lib/feedback-fallback':'export const generateSentenceFeedbackWithFallback=async()=>{globalThis.safetyRuntime.calls++;return globalThis.safetyRuntime.feedback};',
  '@/lib/grammar/feedback':'import {z} from "zod"; export const grammarFeedbackRequestSchema=z.object({lessonId:z.literal("auxiliary"),sentence:z.string()}); export const generateGrammarFeedback=async()=>{globalThis.safetyRuntime.calls++;return globalThis.safetyRuntime.feedback};',
};
await build({ entryPoints:{word:'app/api/sentence-feedback/route.ts',grammar:'app/api/grammar-feedback/route.ts'},outdir:'work/feedback-safety-api',bundle:true,format:'esm',platform:'node',outExtension:{'.js':'.mjs'},logLevel:'silent',plugins:[{name:'synthetic-learning-only',setup(b){b.onResolve({filter:/^(cloudflare:workers|@\/app\/chatgpt-auth|@\/db\/(store|feedback)|@\/lib\/(feedback-fallback|grammar\/feedback))$/},a=>({path:a.path,namespace:'safety-stub'}));b.onLoad({filter:/.*/,namespace:'safety-stub'},a=>({loader:'js',contents:stubs[a.path],resolveDir:process.cwd()}));}}] });
globalThis.safetyRuntime={env:{grammar_enabled:'true',google_ai_enabled:'true'},calls:0,attempts:0};
const routes={word:await import('../work/feedback-safety-api/word.mjs'),grammar:await import('../work/feedback-safety-api/grammar.mjs')};
function runtime(feedback){
  const r=globalThis.safetyRuntime;r.feedback=feedback;r.calls=0;r.attempts=0;
  r.session={id:sid,stage:'sentence',index:0,ids:[word.id],retryMode:false,records:{[word.id]:{meaning:'도착하다'}}};
  const progress={stage:5,sentence:feedback.original,answers:Object.fromEntries(['q1','q2','q3'].map(k=>[k,{first:'a',latest:'a',attempts:1,helped:false}])),updatedAt:feedback.createdAt};
  r.db={prepare:()=>({bind:()=>({first:async()=>({document:JSON.stringify(progress)})})})};
  return r;
}
const request=(domain,feedback,modern)=>new Request('https://local.test/api/'+(domain==='word'?'sentence':'grammar')+'-feedback',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://local.test',...(modern?{'X-Study-Feedback-Structure':'1','X-Study-Grammar':'3'}:{})},body:JSON.stringify(domain==='word'?{sessionId:sid,entryId:word.id,sentence:feedback.original}:{lessonId:'auxiliary',sentence:feedback.original})});

test('both learner routes reject conflicting new analyses for modern and legacy clients without another call or raw text',async()=>{
  for(const [domain,id,provider] of [['word','word-32','groq'],['grammar','grammar-45','google']])for(const modern of [false,true]){
    const f=actual(id,provider),r=runtime(f),logs=[],previousWarn=console.warn;
    try{
      console.warn=value=>logs.push(value);
      const response=await routes[domain].POST(request(domain,f,modern)),body=await response.json();
      assert.equal(response.status,422);assert.equal(body.code,'analysis_conflict');assert.equal(body.feedback,undefined);
      assert.equal(r.calls,1);assert.equal(r.attempts,1);assert.equal(r.feedback,f);
      assert.ok(logs.length===1);assert.ok(!JSON.stringify(logs).includes(f.original));assert.ok(!JSON.stringify(logs).includes(f.explanation));
      assert.ok(!JSON.stringify(body).includes(f.original));
    }finally{console.warn=previousWarn;}
  }
});

test('valid analyses keep existing response shape and old-client projection',async()=>{
  for(const domain of ['word','grammar'])for(const modern of [false,true]){
    const f=actual(domain==='word'?'word-32':'grammar-45',domain==='word'?'groq':'google');
    f.structure.parts.at(-1).role=domain==='word'?'M':'V';
    const r=runtime(f),response=await routes[domain].POST(request(domain,f,modern));
    assert.equal(response.status,200);const body=await response.json();assert.equal(body.feedback.original,f.original);
    assert.equal(Object.hasOwn(body.feedback,'structure'),modern);assert.equal(r.calls,1);
  }
});
