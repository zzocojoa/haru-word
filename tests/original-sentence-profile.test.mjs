import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
await build({entryPoints:['lib/feedback-fallback.ts','lib/grammar/feedback.ts','lib/grammar/content.ts','lib/grammar/content-v3.ts','lib/original-sentence-feedback.ts','lib/gemini-feedback.ts'],outdir:'work/original-profile-tests',entryNames:'[name]',bundle:true,splitting:true,format:'esm',platform:'node',outExtension:{'.js':'.mjs'},logLevel:'silent'});
const {generateSentenceFeedbackWithFallback}=await import('../work/original-profile-tests/feedback-fallback.mjs');
const {generateGrammarFeedback,grammarInstruction,grammarFeedbackInput}=await import('../work/original-profile-tests/feedback.mjs');
const {GRAMMAR_LESSONS}=await import('../work/original-profile-tests/content.mjs');
const {lessonForVersion}=await import('../work/original-profile-tests/content-v3.mjs');
const {systemInstruction}=await import('../work/original-profile-tests/gemini-feedback.mjs');
const profile=await import('../work/original-profile-tests/original-sentence-feedback.mjs');
const config={google_api:'test-only',groq_api:'test-only'};
const value={meaningUsage:'appropriate',grammar:'natural',correctedSentence:'I like jazz.',explanation:'자연스러운 문장이에요.'};
const google=c=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(c)}]}}]});
const groq=c=>Response.json({model:'openai/gpt-oss-120b',choices:[{finish_reason:'stop',message:{content:JSON.stringify(c)}}]});
const input={sentence:'I like jazz.',word:'jazz',pos:'n.',meaning:'재즈'};

await build({entryPoints:{'word-route':'app/api/sentence-feedback/route.ts','grammar-route':'app/api/grammar-feedback/route.ts'},outdir:'work/original-profile-tests/routes',bundle:true,splitting:true,format:'esm',platform:'node',outExtension:{'.js':'.mjs'},logLevel:'silent',plugins:[{name:'synthetic-boundaries',setup(b){
 b.onResolve({filter:/^(cloudflare:workers|@\/app\/chatgpt-auth|@\/db\/(store|feedback))$/},a=>({path:a.path,namespace:'synthetic'}));
 b.onLoad({filter:/.*/,namespace:'synthetic'},a=>({loader:'js',contents:a.path==='cloudflare:workers'?'export const env=globalThis.originalRouteRuntime.env':a.path.endsWith('chatgpt-auth')?'export const getChatGPTUser=async()=>globalThis.originalRouteRuntime.user':a.path.endsWith('store')?'export const database=()=>globalThis.originalRouteRuntime.db':`export const loadFeedbackSession=async()=>globalThis.originalRouteRuntime.session;
export const loadPersonalWord=async()=>undefined;
export const recordFeedbackAttempt=async()=>{globalThis.originalRouteRuntime.attempts++;};`}));
}}]});
const word=JSON.parse(readFileSync('data/words.json')).find(w=>w.word==='arrive'&&w.pos==='v.');
const sessionId=crypto.randomUUID(),wordSentence='I arrive home.',grammarSentence=input.sentence;
const session={id:sessionId,ids:[word.id],index:0,stage:'sentence',finished:false,records:{[word.id]:{meaning:'도착하다'}}};
const answer={first:'synthetic',latest:'synthetic',helped:false,attempts:1};
const progress={stage:5,answers:{q1:answer,q2:answer,q3:answer},sentence:grammarSentence,updatedAt:'2026-09-30T00:00:00.000Z'};
globalThis.originalRouteRuntime={env:{...config,google_ai_enabled:'true',grammar_enabled:'true'},user:{userId:'synthetic-user'},session,attempts:0,db:{prepare(){return {bind(){return {first:async()=>({document:JSON.stringify(progress)})};}};}}};
const wordRoute=await import('../work/original-profile-tests/routes/word-route.mjs');
const grammarRoute=await import('../work/original-profile-tests/routes/grammar-route.mjs');
const routeRequest=domain=>new Request(`https://study.example/api/${domain==='word'?'sentence':'grammar'}-feedback`,{method:'POST',headers:{'content-type':'application/json',origin:'https://study.example','x-study-feedback-structure':'1','x-study-grammar':'3'},body:JSON.stringify(domain==='word'?{sessionId,entryId:word.id,sentence:wordSentence}:{lessonId:'noun',sentence:grammarSentence})});

test('original-only context strips exercise commands and samples across all content versions',()=>{
 for(const lesson of GRAMMAR_LESSONS)for(const version of [1,2,3]){
  const l=lessonForVersion(lesson,version),r=profile.originalSentenceGrammarInput(l,input.sentence);
  assert.deepEqual(Object.keys(r),['sentence','target','role']);
  assert.equal(r.sentence,input.sentence);assert.equal(r.target,l.title);assert.equal(r.role,l.role);
 }
 const malicious={title:'명사',role:'이름을 나타내요.',writing:'PRIVATE_REWRITE_COMMAND',check:'PRIVATE_CHECK',pattern:'PRIVATE_EXAMPLE',stem:'PRIVATE_STEM'};
 assert.doesNotMatch(JSON.stringify(profile.originalSentenceGrammarInput(malicious,input.sentence)),/PRIVATE/);
});

test('unactivated word and grammar profiles keep baseline instructions and input helpers',async()=>{
 for(const setting of [undefined,'false','TRUE']){
  const sent=[];const fetcher=async(_url,init)=>{sent.push(JSON.parse(init.body));return google(value);};
  await generateSentenceFeedbackWithFallback({...config,feedback_original_sentence_enabled:setting},input,fetcher);
  await generateGrammarFeedback({...config,feedback_original_sentence_enabled:setting},GRAMMAR_LESSONS[0],input.sentence,fetcher);
  assert.ok(sent[0].systemInstruction.parts[0].text.startsWith(systemInstruction));
  assert.ok(sent[1].systemInstruction.parts[0].text.startsWith(grammarInstruction));
  assert.deepEqual(JSON.parse(sent[1].contents[0].parts[0].text),grammarFeedbackInput(GRAMMAR_LESSONS[0],input.sentence));
 }
});

test('activated profiles use original-first request and preserve one-Google then one-Groq policy',async()=>{
 for(const domain of ['word','grammar']){
  const sent=[],fetcher=async(url,init)=>{sent.push({url,body:JSON.parse(init.body)});return sent.length===1?new Response('PRIVATE_ERROR',{status:503}):groq(value);};
  const enabled={...config,feedback_original_sentence_enabled:'true'};
  const result=domain==='word'?await generateSentenceFeedbackWithFallback(enabled,input,fetcher):await generateGrammarFeedback(enabled,GRAMMAR_LESSONS[0],input.sentence,fetcher);
  assert.equal(sent.length,2);assert.match(sent[0].url,/googleapis/);assert.match(sent[1].url,/api.groq.com/);assert.equal(result.original,input.sentence);
  const expectedInput=domain==='word'?input:profile.originalSentenceGrammarInput(GRAMMAR_LESSONS[0],input.sentence);
  assert.deepEqual(JSON.parse(sent[0].body.contents[0].parts[0].text),expectedInput);
  assert.deepEqual(JSON.parse(sent[1].body.messages[1].content),expectedInput);
  const expectedInstruction=domain==='word'?profile.originalSentenceWordInstruction:profile.originalSentenceGrammarInstruction;
  assert.ok(sent[0].body.systemInstruction.parts[0].text.startsWith(expectedInstruction));
  assert.equal(sent[0].body.systemInstruction.parts[0].text,sent[1].body.messages[0].content);
  assert.equal(sent[0].body.generationConfig.maxOutputTokens,4096);assert.equal(sent[1].body.max_completion_tokens,4096);
 }
});

test('both provider judgments reject contradictory actual outputs; fallback cannot bypass the guard',async()=>{
 const rows=JSON.parse(readFileSync('data/evaluations/english-accuracy-2026-09-30-round-2.json')).rows.filter(r=>r.criticalErrors.length);
 for(const {feedback:f} of rows){
  const bad={meaningUsage:f.meaningUsage,grammar:f.grammar,correctedSentence:f.correctedSentence,explanation:f.explanation,structure:f.structure};
  let calls=0;
  await assert.rejects(generateSentenceFeedbackWithFallback(config,{...input,sentence:f.original},async()=>++calls===1?google(bad):groq(bad)),e=>e.code==='groq_invalid_response'&&e.issue.previous.code==='provider_invalid_response'&&!JSON.stringify(e).includes(f.original));
  assert.equal(calls,2);
  calls=0;
  const good={...bad,correctedSentence:f.original,structure:undefined};
  const result=await generateSentenceFeedbackWithFallback(config,{...input,sentence:f.original},async()=>++calls===1?google(bad):groq(good));
  assert.equal(calls,2);assert.equal(result.correctedSentence,f.original);
 }
});

test('both actual POST routes propagate the server flag and strip grammar exercises only when activated',async()=>{
 const savedFetch=globalThis.fetch,savedInfo=console.info;console.info=()=>{};
 try{
  for(const setting of [undefined,'false','true'])for(const domain of ['word','grammar']){
   originalRouteRuntime.env.feedback_original_sentence_enabled=setting;
   let sent,calls=0;globalThis.fetch=async(_url,init)=>{calls++;sent=JSON.parse(init.body);return google({...value,correctedSentence:domain==='word'?wordSentence:grammarSentence});};
   const response=await (domain==='word'?wordRoute:grammarRoute).POST(routeRequest(domain));
   assert.equal(response.status,200);assert.equal(calls,1);
   const instruction=domain==='word'?(setting==='true'?profile.originalSentenceWordInstruction:systemInstruction):(setting==='true'?profile.originalSentenceGrammarInstruction:grammarInstruction);
   assert.ok(sent.systemInstruction.parts[0].text.startsWith(instruction));
   const fields=JSON.parse(sent.contents[0].parts[0].text);
   if(domain==='grammar')assert.deepEqual(fields,setting==='true'?profile.originalSentenceGrammarInput(GRAMMAR_LESSONS[0],grammarSentence):grammarFeedbackInput(GRAMMAR_LESSONS[0],grammarSentence));
   else assert.deepEqual(fields,{word:word.word,pos:word.pos,meaning:'도착하다',sentence:wordSentence});
  }
 }finally{globalThis.fetch=savedFetch;console.info=savedInfo;delete originalRouteRuntime.env.feedback_original_sentence_enabled;}
});

test('both POST routes reject conflicting judgments without exposing or modifying learner documents',async()=>{
 const savedFetch=globalThis.fetch,savedError=console.error,logs=[];console.error=line=>logs.push(line);
 const before=JSON.stringify({session,progress}),beforeAttempts=originalRouteRuntime.attempts;
 try{
  for(const domain of ['word','grammar']){
   let calls=0;globalThis.fetch=async()=>++calls===1?google(value):groq(value);
   // Deliberately different original and correction, including the grammar route.
   const original=domain==='word'?wordSentence:'I like music.';
   if(domain==='grammar')progress.sentence=original;
   const request=domain==='word'?routeRequest(domain):new Request('https://study.example/api/grammar-feedback',{method:'POST',headers:{origin:'https://study.example','content-type':'application/json'},body:JSON.stringify({lessonId:'noun',sentence:original})});
   const response=await (domain==='word'?wordRoute:grammarRoute).POST(request),body=await response.json();
   assert.equal(response.status,502);assert.equal(body.code,'groq_invalid_response');assert.equal(body.previous.code,'provider_invalid_response');assert.equal(calls,2);
   assert.doesNotMatch(JSON.stringify(body),/judgment|I like|I arrive|test-only|synthetic-user/);
  }
  assert.equal(originalRouteRuntime.attempts,beforeAttempts+2);
  assert.doesNotMatch(JSON.stringify(logs),/judgment|I like|I arrive|test-only|synthetic-user/);
 }finally{progress.sentence=grammarSentence;globalThis.fetch=savedFetch;console.error=savedError;}
 assert.equal(JSON.stringify({session,progress}),before);
});

test('both actual POSTs select count wire only for exact true and return existing text structure',async()=>{
 const savedFetch=globalThis.fetch,savedInfo=console.info;console.info=()=>{};
 const before=JSON.stringify({session,progress});
 try{
  for(const setting of [undefined,'false','TRUE','true'])for(const domain of ['word','grammar']){
   originalRouteRuntime.env.feedback_chunked_enabled=setting;
   const sentence=domain==='word'?wordSentence:grammarSentence;let sent;
   globalThis.fetch=async(_url,init)=>{sent=JSON.parse(init.body);return google({...value,correctedSentence:sentence,
    structure:{status:'available',translation:'합성 번역입니다.',parts:[{...(setting==='true'?{wordCount:3}:{text:sentence}),role:'X',explanation:'합성 성분입니다.'}],note:''}});};
   const response=await (domain==='word'?wordRoute:grammarRoute).POST(routeRequest(domain)),body=await response.json();
   assert.equal(response.status,200);
   const props=sent.generationConfig.responseJsonSchema.properties.structure.properties.parts.items.properties;
   assert.equal(Boolean(props.wordCount),setting==='true');assert.equal(Boolean(props.text),setting!=='true');
   assert.equal(body.feedback.structure.parts[0].text,sentence);assert.equal('wordCount' in body.feedback.structure.parts[0],false);
  }
 }finally{globalThis.fetch=savedFetch;console.info=savedInfo;delete originalRouteRuntime.env.feedback_chunked_enabled;}
 assert.equal(JSON.stringify({session,progress}),before);
});
