import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
await build({entryPoints:['lib/feedback-fallback.ts','lib/groq-feedback.ts','lib/feedback-issue.ts','lib/sentence-feedback.ts','lib/validation.ts','lib/backup.ts','lib/learning.ts','lib/grammar/content.ts','lib/grammar/feedback.ts'],outdir:'work/groq-tests',entryNames:'[name]',bundle:true,splitting:true,format:'esm',platform:'node',outExtension:{'.js':'.mjs'},logLevel:'silent'});
const {generateSentenceFeedbackWithFallback:run}=await import('../work/groq-tests/feedback-fallback.mjs');
const {generateGroqFeedback,groqHttpError}=await import('../work/groq-tests/groq-feedback.mjs');

const {sentenceFeedbackSchema,GROQ_FEEDBACK_MODEL,FEEDBACK_MODEL}=await import('../work/groq-tests/sentence-feedback.mjs');
const {saveSchema}=await import('../work/groq-tests/validation.mjs');
const backup=await import('../work/groq-tests/backup.mjs');
const learning=await import('../work/groq-tests/learning.mjs');
const {GRAMMAR_LESSONS}=await import('../work/groq-tests/content.mjs');
const {generateGrammarFeedback}=await import('../work/groq-tests/feedback.mjs');
const config={google_api:'synthetic-google',groq_api:'synthetic-groq'}, input={word:'arrive',pos:'v.',meaning:'도착하다',sentence:'I arrive home yesterday.'};
const content={meaningUsage:'appropriate',grammar:'needs_work',correctedSentence:'I arrived home yesterday.',explanation:'과거 일이므로 arrived로 써요.'};
test('retired legacy and fallback entry points stay closed for every restored flag and key combination',async()=>{
 for(const flag of [undefined,'false','true','TRUE'])for(const keys of [{},config]){let calls=0;const fetcher=async()=>{calls++;};const legacy={...keys,groq_ai_enabled:flag,feedback_original_sentence_enabled:flag,feedback_chunked_enabled:flag};
 await assert.rejects(run(legacy,input,fetcher),e=>e.code==='disabled');await assert.rejects(generateGroqFeedback('synthetic',input,'trusted',fetcher),e=>e.code==='disabled');await assert.rejects(generateGrammarFeedback(legacy,GRAMMAR_LESSONS[0],input.sentence,fetcher),e=>e.code==='disabled');assert.equal(calls,0);}
});

test('Groq classifies limits/auth/permission/billing/server errors without inventing quota periods',()=>{
 for(const [status,code] of [[429,'groq_limit'],[401,'groq_key_invalid'],[402,'groq_billing'],[403,'groq_permission'],[404,'groq_model'],[400,'groq_request'],[422,'groq_request'],[503,'groq_unavailable'],[504,'groq_timeout']])assert.equal(groqHttpError(status,null).code,code);
 assert.equal(groqHttpError(429,'8.1').issue.retryAfterSeconds,9);assert.equal(groqHttpError(429,'9999999999').issue.retryAfterSeconds,undefined);
});

test('Google and Groq feedback survive save, backup parsing and CSV with the correct provider',()=>{
 const word=JSON.parse(readFileSync('data/words.json','utf8')).find(w=>w.word==='arrive'&&w.pos==='v.');
 for(const model of [FEEDBACK_MODEL,GROQ_FEEDBACK_MODEL]){
  const state=structuredClone(learning.EMPTY),sid=crypto.randomUUID(),now=new Date().toISOString(),feedback={...content,model,original:input.sentence,createdAt:now};
  assert.equal(sentenceFeedbackSchema.safeParse(feedback).success,true);
  state.sessions[sid]={id:sid,kind:'daily',date:'2026-09-25',period:'2026-09-25',ids:[word.id],warmupIds:[],stage:'sentence',index:0,records:{[word.id]:{...learning.emptyRecord(input.meaning),aiFeedback:feedback}},retry:[],retryMode:false,elapsed:0,finished:false,paused:false,createdAt:now};
  assert.equal(saveSchema.safeParse({revision:0,progress:{},sessions:state.sessions}).success,true);
  const restored=backup.parseBackup(JSON.stringify({format:'haru-words-v1',exportedAt:now,state}));
  assert.equal(restored.state.sessions[sid].records[word.id].aiFeedback.model,model);
  const csv=learning.exportLog(state,[word]);assert.match(csv,/AI 제공사/);assert.ok(csv.includes(model===FEEDBACK_MODEL?'Google Gemini':'Groq'));
 }
 assert.equal(sentenceFeedbackSchema.safeParse({...content,model:'unknown',original:'I read.',createdAt:new Date().toISOString()}).success,true);
});
