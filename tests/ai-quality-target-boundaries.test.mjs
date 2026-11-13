import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {build} from 'esbuild';
mkdirSync('work/ai-quality-target-tests',{recursive:true});
await build({stdin:{contents:"export {generateOpenAiFeedback} from './lib/openai-feedback';export {systemInstruction} from './lib/feedback-prompts';export {wordFeedbackInput,feedbackMatchesContext,feedbackContextFingerprint} from './lib/feedback-context';export {sentenceFeedbackSchema} from './lib/sentence-feedback';export {generateGrammarFeedback} from './lib/grammar/feedback';export {LESSON_MAP} from './lib/grammar/content';export {AI_PROMPT_VERSION,AI_VALIDATION_VERSION} from './lib/ai-models';",loader:'ts',resolveDir:process.cwd()},outfile:'work/ai-quality-target-tests/runtime.mjs',bundle:true,platform:'node',format:'esm',logLevel:'silent'});
const r=await import('../work/ai-quality-target-tests/runtime.mjs');
// Exposed contract cases with fixed wire judgments, not live model predictions.
const models=['gpt-6.1-sol','gpt-6.1-terra','gpt-6-astra'];
const cases=[
 {word:'book',pos:'n.',meaning:'책',sentence:'The agent booked a room.',meaningUsage:'needs_work',grammar:'natural'},
 {word:'book',pos:'v.',meaning:'예약하다',sentence:'The book is on the desk.',meaningUsage:'needs_work',grammar:'natural'},
 {word:'lend',pos:'v.',meaning:'빌려주다',sentence:"They didn't lent us any tools.",meaningUsage:'appropriate',grammar:'needs_work',correction:"They didn't lend us any tools."},
 {word:'careful',pos:'adj.',meaning:'주의 깊은',sentence:'The worker moved carefully.',meaningUsage:'needs_work',grammar:'natural'},
 {word:'careful',pos:'adj.',meaning:'주의 깊은',sentence:'He works careful.',meaningUsage:'needs_work',grammar:'needs_work',correction:'He works carefully.'},
 {word:'carefully',pos:'adv.',meaning:'주의 깊게',sentence:'She is careful.',meaningUsage:'needs_work',grammar:'natural'},
 {word:'quietly',pos:'adv.',meaning:'조용히',sentence:'They walks quietly.',meaningUsage:'appropriate',grammar:'needs_work',correction:'They walk quietly.'},
 {word:'careful',pos:'adj.',meaning:'주의 깊은',sentence:'She is careful.',meaningUsage:'appropriate',grammar:'natural'},
];
const wire=c=>({meaningUsage:c.meaningUsage,grammar:c.grammar,correctedSentence:c.correction??c.sentence,targetReason:'합성 목표 의견',grammarReason:'합성 원문 의견',correctionReason:c.correction?'합성 교정 참고':'',contextNeeded:'none'});
const envelope=(model,value)=>Response.json({status:'completed',model,output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value)}]}]});

test('word-target sense/POS/inflection boundaries keep independent wire labels and unchanged grammatical originals through actual adapters',async t=>{
 t.mock.method(console,'info',()=>{});let calls=0;
 for(const c of cases)for(const modelId of models){
  const input=r.wordFeedbackInput(c,c.meaning,c.sentence);
  const f=await r.generateOpenAiFeedback({apiKey:'SYNTHETIC_ONLY',modelId,allowedModels:models.join(',')},input,r.systemInstruction,async(url,init)=>{
   calls++;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(init.body);assert.deepEqual(JSON.parse(body.input[0].content),input);assert.equal(body.store,false);
   return envelope(modelId,wire(c));
  });
  assert.equal(f.meaningUsage,c.meaningUsage);assert.equal(f.grammar,c.grammar);assert.equal(f.correctedSentence,c.correction??c.sentence);assert.equal(f.promptVersion,'reference-v13');
 }
 assert.equal(calls,cases.length*models.length);
});

test('grammar-feature case errors, unrelated errors and missing targets remain distinct on the actual grammar adapter',async t=>{
 t.mock.method(console,'info',()=>{});
 const lesson=r.LESSON_MAP.get('pronoun');assert.ok(lesson);
 for(const c of [{sentence:'Me likes tea.',meaningUsage:'needs_work',grammar:'needs_work',correction:'I like tea.'},{sentence:'I likes tea.',meaningUsage:'appropriate',grammar:'needs_work',correction:'I like tea.'},{sentence:'The chef sings.',meaningUsage:'needs_work',grammar:'natural'}])for(const modelId of models){
  const f=await r.generateGrammarFeedback({apiKey:'SYNTHETIC_ONLY',modelId,allowedModels:models.join(','),judgmentEnabled:true},lesson,c.sentence,async(_url,init)=>{const body=JSON.parse(init.body),input=JSON.parse(body.input[0].content);assert.match(input.targetCriterion,/roles and case forms/);return envelope(modelId,wire(c));});
  assert.equal(f.meaningUsage,c.meaningUsage);assert.equal(f.grammar,c.grammar);assert.equal(f.correctedSentence,c.correction??c.sentence);
 }
});

test('new prompt identity retains stored v147 feedback but prevents it from being selected as a current policy result',async()=>{
 assert.equal(r.AI_PROMPT_VERSION,'reference-v13');assert.equal(r.AI_VALIDATION_VERSION,'judgment-v10');
 const input=r.wordFeedbackInput(cases.at(-1),cases.at(-1).meaning,cases.at(-1).sentence),model='gpt-6.1-sol',id=await r.feedbackContextFingerprint('word','synthetic-careful',input,model);
 const current={original:input.sentence,correctedSentence:input.sentence,meaningUsage:'appropriate',grammar:'natural',explanation:'합성 의견',model,provider:'openai',requestedModel:model,promptVersion:r.AI_PROMPT_VERSION,validationVersion:r.AI_VALIDATION_VERSION,contextFingerprint:id,createdAt:'2026-11-06T00:00:00.000Z'};
 assert.equal(r.feedbackMatchesContext(current,input.sentence,model,id),true);
 const previous={...current,promptVersion:'reference-v5'};assert.equal(r.sentenceFeedbackSchema.safeParse(previous).success,true);assert.equal(r.feedbackMatchesContext(previous,input.sentence,model,id),false);
 const previousContextPolicy={...current,promptVersion:'reference-v11'};assert.equal(r.sentenceFeedbackSchema.safeParse(previousContextPolicy).success,true);assert.equal(r.feedbackMatchesContext(previousContextPolicy,input.sentence,model,id),false);
});

test('lesson criteria preserve known grammar defects independently of missing correction context in actual requests',async t=>{
 t.mock.method(console,'info',()=>{});
 const examples=[
  {lesson:'conjunction',sentence:'I wondered whether',meaningUsage:'uncertain',grammar:'needs_work',contextNeeded:'message',criterion:/Judge target use and original grammar separately/},
  {lesson:'verb',sentence:'You might brought a torch.',meaningUsage:'needs_work',grammar:'needs_work',contextNeeded:'time',criterion:/A visible verb-form error keeps grammar needs_work/},
  {lesson:'conjunction',sentence:'Because I was tired.',contextKind:'reply',contextNote:'Why did you leave?',meaningUsage:'appropriate',grammar:'natural',contextNeeded:'none',criterion:/Explicit reason replies may license subordinate-clause ellipsis/},
  {lesson:'definite-article',sentence:'The switch is off.',contextNote:'The listener cannot see either switch, and I have not decided which one I mean.',meaningUsage:'needs_work',grammar:'natural',contextNeeded:'target_meaning',criterion:/ordinary presumed shared context/},
 ];
 for(const c of examples){
  let calls=0;
  const expected={meaningUsage:c.meaningUsage,grammar:c.grammar,contextNeeded:c.contextNeeded,correctedSentence:c.grammar==='natural'?c.sentence:'',targetReason:'합성 목표 판단',grammarReason:'합성 문법 판단',correctionReason:''};
  const feedback=await r.generateGrammarFeedback({apiKey:'SYNTHETIC_ONLY',modelId:models[0],allowedModels:models.join(','),judgmentEnabled:true,contextKind:c.contextKind,contextNote:c.contextNote},r.LESSON_MAP.get(c.lesson),c.sentence,async(_url,init)=>{
   calls++;const body=JSON.parse(init.body),input=JSON.parse(body.input[0].content);
   assert.equal(input.sentence,c.sentence);assert.match(input.targetCriterion,c.criterion);
   assert.doesNotMatch(input.targetCriterion,/withhold BOTH judgments|may coexist with grammar uncertain/);
   return envelope(models[0],expected);
  });
  assert.equal(calls,1);assert.equal(feedback.grammar,c.grammar);assert.equal(feedback.meaningUsage,c.meaningUsage);assert.equal(feedback.correctedSentence,expected.correctedSentence);
  if(c.lesson==='definite-article')assert.match(feedback.explanation,/추가 문맥:/);
 }
});

test('a known contextual target problem asks a question without making natural grammar uncertain',async t=>{
 t.mock.method(console,'info',()=>{});
 const input={word:'over',pos:'prep.',meaning:'~ 위로',expression:'over',sentence:'It went over.',contextKind:'sentence',contextNote:'무엇 위로 갔는지는 아직 정하지 않았어요.',contextRole:'intended_korean'};
 const value={meaningUsage:'needs_work',grammar:'natural',correctedSentence:input.sentence,targetReason:'합성 목표 사용 판단',grammarReason:'합성 원문 문법 판단',correctionReason:'',contextNeeded:'target_meaning'};
 const f=await r.generateOpenAiFeedback({apiKey:'SYNTHETIC_ONLY',modelId:models[0],allowedModels:models.join(',')},input,r.systemInstruction,async(_url,init)=>{
  assert.match(JSON.parse(init.body).instructions,/When a known target-use problem requires missing context/);
  return envelope(models[0],value);
 });
 assert.equal(f.grammar,'natural');assert.equal(f.meaningUsage,'needs_work');assert.equal(f.correctedSentence,input.sentence);assert.match(f.explanation,/추가 문맥:/);
});
