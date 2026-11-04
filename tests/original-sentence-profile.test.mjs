import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
await build({entryPoints:['lib/feedback-fallback.ts','lib/grammar/feedback.ts','lib/grammar/content.ts','lib/grammar/content-v3.ts','lib/original-sentence-feedback.ts','lib/gemini-feedback.ts','lib/openai-feedback.ts'],outdir:'work/original-profile-tests',entryNames:'[name]',bundle:true,splitting:true,format:'esm',platform:'node',outExtension:{'.js':'.mjs'},logLevel:'silent'});
const {generateSentenceFeedbackWithFallback}=await import('../work/original-profile-tests/feedback-fallback.mjs');
const {generateGrammarFeedback,legacyGrammarInstruction:grammarInstruction,legacyGrammarFeedbackInput}=await import('../work/original-profile-tests/feedback.mjs');
const {GRAMMAR_LESSONS}=await import('../work/original-profile-tests/content.mjs');
const {lessonForVersion}=await import('../work/original-profile-tests/content-v3.mjs');
const {systemInstruction}=await import('../work/original-profile-tests/gemini-feedback.mjs');
const profile=await import('../work/original-profile-tests/original-sentence-feedback.mjs');
const config={google_api:'test-only',groq_api:'test-only'};
const openAiConfig={apiKey:'test-only',modelId:'gpt-6.1-sol',allowedModels:'gpt-6.1-sol'};
const { generateStructuredOpenAiFeedback: generateOpenAiFeedback}=await import('../work/original-profile-tests/openai-feedback.mjs');
const openAi=value=>Response.json({status:'completed',model:'gpt-6.1-sol',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify({...value,structure:value.structure??{status:'unavailable',translation:'',parts:[],note:'합성 검사입니다.'}})}]}]});
const value={meaningUsage:'appropriate',grammar:'natural',correctedSentence:'I like jazz.',explanation:'자연스러운 문장이에요.'};


const input={sentence:'I like jazz.',word:'jazz',pos:'n.',meaning:'재즈'};

await build({entryPoints:{'word-route':'app/api/sentence-feedback/route.ts','grammar-route':'app/api/grammar-feedback/route.ts'},outdir:'work/original-profile-tests/routes',bundle:true,splitting:true,format:'esm',platform:'node',outExtension:{'.js':'.mjs'},logLevel:'silent',plugins:[{name:'synthetic-boundaries',setup(b){
 b.onResolve({filter:/^(cloudflare:workers|@\/app\/chatgpt-auth|@\/db\/(store|feedback))$/},a=>({path:a.path,namespace:'synthetic'}));
 b.onLoad({filter:/.*/,namespace:'synthetic'},a=>({loader:'js',contents:a.path==='cloudflare:workers'?'export const env=globalThis.originalRouteRuntime.env':a.path.endsWith('chatgpt-auth')?'export const getChatGPTUser=async()=>globalThis.originalRouteRuntime.user':a.path.endsWith('store')?'export const database=()=>globalThis.originalRouteRuntime.db':`export const loadFeedbackModel=async()=>"gpt-6.1-sol";export const loadFeedbackContext=async(_db,_user,kind)=>({modelId:"gpt-6.1-sol",document:JSON.stringify(kind==="word"?globalThis.originalRouteRuntime.session:globalThis.originalRouteRuntime.progress)});
export const loadPersonalWord=async()=>undefined;
export const recordFeedbackAttempt=async()=>{globalThis.originalRouteRuntime.attempts++;};`}));
}}]});
const word=JSON.parse(readFileSync('data/words.json')).find(w=>w.word==='arrive'&&w.pos==='v.');
const sessionId=crypto.randomUUID(),wordSentence='I arrive home.',grammarSentence=input.sentence;
const session={id:sessionId,ids:[word.id],index:0,stage:'sentence',finished:false,records:{[word.id]:{meaning:'도착하다'}}};
const answer={first:'synthetic',latest:'synthetic',helped:false,attempts:1};
const progress={stage:5,answers:{q1:answer,q2:answer,q3:answer},sentence:grammarSentence,updatedAt:'2026-09-30T00:00:00.000Z'};
globalThis.originalRouteRuntime={env:{...config,google_ai_enabled:'true',grammar_enabled:'true',ai_feedback_enabled:'true',OPENAI_API_KEY:'test-only',OPENAI_ALLOWED_MODELS:'gpt-6.1-sol'},user:{userId:'synthetic-user'},session,progress,attempts:0,db:{prepare(){return {bind(){return {first:async()=>({document:JSON.stringify(progress)})};}};}}};
const wordRoute=await import('../work/original-profile-tests/routes/word-route.mjs');
const grammarRoute=await import('../work/original-profile-tests/routes/grammar-route.mjs');
const routeRequest=domain=>new Request(`https://study.example/api/${domain==='word'?'sentence':'grammar'}-feedback`,{method:'POST',headers:{'content-type':'application/json',origin:'https://study.example','x-study-feedback-structure':'1','x-study-grammar':'3','x-study-ai-contract':'2'},body:JSON.stringify(domain==='word'?{sessionId,entryId:word.id,sentence:wordSentence,expectedModelId:openAiConfig.modelId}:{lessonId:'noun',sentence:grammarSentence,expectedModelId:openAiConfig.modelId})});

test('original-only context strips exercise commands and samples across all content versions',()=>{
 for(const lesson of GRAMMAR_LESSONS)for(const version of [1,2,3]){
  const l=lessonForVersion(lesson,version),r=profile.originalSentenceGrammarInput(l,input.sentence);
  assert.deepEqual(Object.keys(r),['sentence','target','role']);
  assert.equal(r.sentence,input.sentence);assert.equal(r.target,l.title);assert.equal(r.role,l.role);
 }
 const malicious={title:'명사',role:'이름을 나타내요.',writing:'PRIVATE_REWRITE_COMMAND',check:'PRIVATE_CHECK',pattern:'PRIVATE_EXAMPLE',stem:'PRIVATE_STEM'};
 assert.doesNotMatch(JSON.stringify(profile.originalSentenceGrammarInput(malicious,input.sentence)),/PRIVATE/);
});

test('legacy flags cannot reactivate word or grammar helpers',async()=>{
 for(const setting of [undefined,'false','TRUE','true']){let calls=0;const fetcher=async()=>{calls++;};const legacy={...config,feedback_original_sentence_enabled:setting};await assert.rejects(generateSentenceFeedbackWithFallback(legacy,input,fetcher),e=>e.code==='disabled');await assert.rejects(generateGrammarFeedback(legacy,GRAMMAR_LESSONS[0],input.sentence,fetcher),e=>e.code==='disabled');assert.equal(calls,0);}
});

test('retired experimental flags leave new OpenAI grammar generation on the frozen baseline contract',async t=>{
 t.mock.method(console,'info',()=>{});
 for(const setting of [undefined,'false','true']){let calls=0;await generateGrammarFeedback({...openAiConfig,feedback_original_sentence_enabled:setting,feedback_chunked_enabled:setting},GRAMMAR_LESSONS[0],input.sentence,async(url,init)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(init.body);assert.ok(body.instructions.startsWith(grammarInstruction));assert.deepEqual(JSON.parse(body.input[0].content),legacyGrammarFeedbackInput(GRAMMAR_LESSONS[0],input.sentence));return openAi(value);});assert.equal(calls,1);}
});

test('frozen critical judgment contradictions remain rejected by OpenAI without fallback',async t=>{
 t.mock.method(console,'info',()=>{});const rows=JSON.parse(readFileSync('data/evaluations/english-accuracy-2026-09-30-round-2.json')).rows.filter(r=>r.criticalErrors.length);
 for(const{feedback:f}of rows){const bad={meaningUsage:f.meaningUsage,grammar:f.grammar,correctedSentence:f.correctedSentence,explanation:f.explanation,structure:{status:'unavailable',translation:'',parts:[],note:'합성 검사입니다.'}};let calls=0;
 await assert.rejects(generateOpenAiFeedback(openAiConfig,{...input,sentence:f.original},systemInstruction,async()=>{calls++;return openAi(bad)}),e=>e.code==='provider_invalid_response'&&e.validationStage==='judgment'&&!JSON.stringify(e).includes(f.original));assert.equal(calls,1);
 const result=await generateOpenAiFeedback(openAiConfig,{...input,sentence:f.original},systemInstruction,async()=>openAi({...bad,correctedSentence:f.original}));assert.equal(result.correctedSentence,f.original);}
});

test('both actual POSTs ignore retired prompt flags and retain trusted baseline inputs',async t=>{
 t.mock.method(console,'info',()=>{});
 for(const setting of [undefined,'false','true'])for(const domain of ['word','grammar']){originalRouteRuntime.env.feedback_original_sentence_enabled=setting;let calls=0,sent;t.mock.method(globalThis,'fetch',async(_url,init)=>{calls++;sent=JSON.parse(init.body);return openAi({...value,correctedSentence:domain==='word'?wordSentence:grammarSentence})});const response=await(domain==='word'?wordRoute:grammarRoute).POST(routeRequest(domain));assert.equal(response.status,200);assert.equal(calls,1);assert.ok(sent.instructions.startsWith(domain==='word'?systemInstruction:grammarInstruction));const fields=JSON.parse(sent.input[0].content);assert.deepEqual(fields,domain==='word'?{word:word.word,pos:word.pos,meaning:'도착하다',sentence:wordSentence}:legacyGrammarFeedbackInput(GRAMMAR_LESSONS[0],grammarSentence));}
});

test('both OpenAI POSTs reject conflicting judgments once without exposing or rewriting learner documents',async t=>{
 t.mock.method(console,'error',()=>{});const before=JSON.stringify({session,progress}),beforeAttempts=originalRouteRuntime.attempts;
 for(const domain of ['word','grammar']){let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return openAi({...value,correctedSentence:'A different sentence.'})});const response=await(domain==='word'?wordRoute:grammarRoute).POST(routeRequest(domain)),body=await response.json();assert.equal(response.status,502);assert.equal(body.code,'provider_invalid_response');assert.equal(body.previous,undefined);assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(body),/I arrive|I like jazz/);}
 assert.equal(JSON.stringify({session,progress}),before);assert.equal(originalRouteRuntime.attempts,beforeAttempts+2);
});

test('both OpenAI POSTs retain required text structure regardless of retired count flags',async t=>{
 t.mock.method(console,'info',()=>{});const before=JSON.stringify({session,progress});
 for(const setting of [undefined,'false','TRUE','true'])for(const domain of ['word','grammar']){originalRouteRuntime.env.feedback_chunked_enabled=setting;const sentence=domain==='word'?wordSentence:grammarSentence;let sent;t.mock.method(globalThis,'fetch',async(_url,init)=>{sent=JSON.parse(init.body);return openAi({...value,correctedSentence:sentence,structure:{status:'available',translation:'합성 번역입니다.',parts:[{text:sentence,role:'X',explanation:'합성 성분입니다.'}],note:''}})});const response=await(domain==='word'?wordRoute:grammarRoute).POST(routeRequest(domain)),body=await response.json();assert.equal(response.status,200);const props=sent.text.format.schema.properties.structure.properties.parts.items.properties;assert.equal(Boolean(props.wordCount),false);assert.equal(Boolean(props.text),true);assert.equal(body.feedback.structure.parts[0].text,sentence);}
 assert.equal(JSON.stringify({session,progress}),before);
});
