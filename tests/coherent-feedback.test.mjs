import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { parseCoherentFeedback, coherentFeedbackContract } from '../lib/coherent-feedback.ts';
import { sentenceFeedbackSchema, FEEDBACK_MODEL, GROQ_FEEDBACK_MODEL } from '../lib/sentence-feedback.ts';

const original='They arrived to the station.';
const part=(units,fn,meaning,extra={})=>({units,function:fn,meaning,...extra});
const verb=(units,kind='lexical')=>part(units,'verb','행동',{kind});
const wire=()=>({analysis:{target:{reason:'matched',originalSpan:'arrived',category:'verb',gloss:'도착하다'},
  grammar:{status:'needs_work',context:{kind:'clause',subjectSpan:'They',predicateSpan:'arrived'},changes:[{before:'to',after:'at',rule:'preposition'}]},
  structure:{status:'available',translation:'그들은 역에 도착했다.',parts:[part(['They'],'subject','그들은'),verb(['arrived']),part(['at','the','station.'],'prepositional-phrase','역에',{role:'modifier'})]}}});
const parse=(value,sentence=original)=>parseCoherentFeedback(JSON.stringify(value),sentence,FEEDBACK_MODEL);
const compiled=await build({stdin:{contents:`export {generateSentenceFeedbackWithFallback} from './lib/feedback-fallback'; export {generateGrammarFeedback} from './lib/grammar/feedback'; export {LESSON_MAP} from './lib/grammar/content';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'});
const h=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'));
const envelope=(provider,value)=>provider==='google'?{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]}:{model:GROQ_FEEDBACK_MODEL,choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]};

test('meaning remains matched for a grammar-only preposition correction derived from one edit list',()=>{
  const f=parse(wire());assert.equal(f.meaningUsage,'appropriate');assert.equal(f.grammar,'needs_work');assert.equal(f.correctedSentence,'They arrived at the station.');
  assert.deepEqual(f.structure.parts.map(p=>p.role),['S','V','M']);assert.match(f.structure.parts[2].explanation,/전치사구 · 수식어/u);
  assert.match(f.explanation,/선택한 뜻·기능에 맞아요/u);assert.ok(sentenceFeedbackSchema.safeParse(f).success);
});
test('all target judgments are independent of natural, needs_work and uncertain grammar',()=>{
  const reasons=['matched','different-sense','different-function','absent','ambiguous'];
  for(const status of ['natural','needs_work','uncertain'])for(const reason of reasons){
    const x=wire();x.analysis.target=reason==='absent'?{reason}:reason==='ambiguous'?{reason,originalSpan:'arrived'}:{...x.analysis.target,reason};
    let sentence=original;
    if(status==='natural'){sentence='They arrived at the station.';x.analysis.grammar={status,context:x.analysis.grammar.context};}
    if(status==='uncertain'){x.analysis.grammar={status};x.analysis.structure={status:'unavailable',note:'ambiguous'};}
    const f=parse(x,sentence);assert.equal(f.grammar,status);assert.equal(f.meaningUsage,reason==='matched'?'appropriate':reason==='ambiguous'?'uncertain':'needs_work');
    if(status==='uncertain'){assert.equal(f.correctedSentence,'');assert.equal(f.structure.status,'unavailable');}
    if(status==='natural')assert.equal(f.correctedSentence,sentence);
  }
});
test('one infinitive graph preserves its outer complement and inner verb/object scope',()=>{
  const x={analysis:{target:{reason:'matched',originalSpan:'learn',category:'infinitive',gloss:'배우는 것'},grammar:{status:'needs_work',context:{kind:'clause',subjectSpan:'I',predicateSpan:'want'},changes:[{before:'want learn',after:'want to learn',rule:'infinitive-marker'}]},
    structure:{status:'available',translation:'나는 영어를 배우고 싶다.',parts:[part(['I'],'subject','나는'),verb(['want']),part(['to','learn','English.'],'infinitive-clause','영어를 배우는 것',{role:'complement',verbPart:1,children:[part(['to'],'infinitive-marker','부정사 표지'),verb(['learn'],'nonfinite'),part(['English.'],'direct-object','영어를',{verbPart:1})]})]}}};
  const f=parse(x,'I want learn English.');assert.equal(f.meaningUsage,'appropriate');assert.equal(f.correctedSentence,'I want to learn English.');assert.deepEqual(f.structure.parts.map(p=>p.role),['S','V','C']);assert.match(f.structure.parts[2].explanation,/내부 목적어와 구분/u);
  x.analysis.structure.parts[2].children[2].verbPart=0;assert.throws(()=>parse(x,'I want learn English.'));
});
test('lexical fields cannot introduce a second grammatical role or a contradictory category',()=>{
  for(const mutate of [x=>x.analysis.target.gloss='동사로 쓰인 말',x=>x.analysis.structure.parts[0].meaning='보어로 쓰인 그들',x=>x.analysis.structure.parts[0].meaning='이 부분은 보어입니다',x=>x.analysis.target.gloss='전치사입니다',x=>x.analysis.structure.parts[2].meaning='전치사의 목적어 역할을 하는 말',x=>x.analysis.target.category='article']){
    const x=wire();mutate(x);assert.throws(()=>parse(x),e=>e.stage==='judgment'&&e.validationDetail.reason==='target_judgment');
  }
  const x=wire();x.analysis.target={reason:'matched',originalSpan:'They',category:'pronoun',gloss:'그들'};
  assert.doesNotThrow(()=>parse(x)); // POS and sentence role can legitimately differ.
  x.analysis.target={reason:'matched',originalSpan:'They',category:'complement',gloss:'그들'};
  assert.throws(()=>parse(x));
  x.analysis.target={reason:'matched',originalSpan:'They',category:'noun',gloss:'주어/제목'};
  x.analysis.structure.parts[0].meaning='그 주어';assert.doesNotThrow(()=>parse(x));
  x.analysis.structure.parts[0].meaning='접속사를 설명하는 책';assert.doesNotThrow(()=>parse(x));
  x.analysis.target={reason:'matched',originalSpan:'arrived',category:'verb',gloss:'동사'};assert.throws(()=>parse(x));
  x.analysis.target.gloss='도착하다';x.analysis.structure.translation='그들은 도착했다. arrived는 보어입니다.';assert.throws(()=>parse(x));
  const linguistic={analysis:{target:{reason:'matched',originalSpan:'subject',category:'noun',gloss:'주어'},grammar:{status:'natural',context:{kind:'clause',subjectSpan:'The subject',predicateSpan:'is'}},structure:{status:'available',translation:'subject는 명사입니다.',parts:[part(['The','subject'],'subject','그 주어'),verb(['is'],'linking'),part(['a','noun.'],'complement','명사')]}}};
  assert.doesNotThrow(()=>parse(linguistic,'The subject is a noun.'));
});
test('progressive/passive participles retain legitimate verb-form and graph-function differences',()=>{
  for(const [sentence,form,gloss,tail,fn]of [['They are painting houses.','painting','칠하고 있는','houses.','direct-object'],['They are painted blue.','painted','칠해진','blue.','complement']]){
    const x={analysis:{target:{reason:'matched',originalSpan:form,category:'participle',gloss},grammar:{status:'natural',context:{kind:'clause',subjectSpan:'They',predicateSpan:'are'}},structure:{status:'available',translation:'검사용 해석',parts:[part(['They'],'subject','그들은'),verb(['are'],'auxiliary'),verb([form]),part([tail],fn,'검사용 뜻',fn==='direct-object'?{verbPart:2}:{})]}}};
    assert.doesNotThrow(()=>parse(x,sentence));
  }
});
test('safe diagnostics name target-span failures separately from literal-edit failures',()=>{
  const x=wire();x.analysis.target.originalSpan='missing';assert.throws(()=>parse(x),e=>e.validationDetail.reason==='target_span');
  x.analysis.target.originalSpan='arrived';x.analysis.grammar.changes[0].before='missing';assert.throws(()=>parse(x),e=>e.validationDetail.reason==='edit_anchor_absent');
  x.analysis.grammar={status:'uncertain'};assert.throws(()=>parse(x),e=>e.validationDetail.reason==='context_withholding');
});
test('word boundaries use Unicode code points for astral letters as well as ASCII',()=>{
  const x=wire();x.analysis.grammar={status:'uncertain'};x.analysis.structure={status:'unavailable',note:'ambiguous'};
  assert.throws(()=>parse(x,'They 𝒶arrived to the station.'),e=>e.validationDetail.reason==='target_span');
  x.analysis.target.originalSpan='𝒶';assert.throws(()=>parse(x,'They 𝒶b to the station.'),e=>e.validationDetail.reason==='target_span');
  assert.doesNotThrow(()=>parse(x,'They 𝒶 to the station.'));
});
test('free explanations, role codes, duplicate corrections and legacy wire fields are rejected',()=>{
  for(const change of [x=>x.explanation='관사 this',x=>x.analysis.explanation='다른 분석',x=>x.analysis.correctedSentence='Another correction.',x=>x.analysis.meaningUsage='needs_work',x=>x.analysis.structure.parts[0].role='C',x=>x.analysis.structure.parts[0].explanation='보어']){
    const x=wire();change(x);assert.throws(()=>parse(x),e=>e.stage==='fields');
  }
  const x=wire();x.analysis.grammar={status:'uncertain'};assert.throws(()=>parse(x));
});
test('literal edits reject missing/ambiguous/overlapping/unchanged anchors and empty or oversized correction',()=>{
  for(const changes of [[{before:'missing',after:'at',rule:'preposition'}],[{before:'to',after:'to',rule:'preposition'}],[{before:'to',after:'at',rule:'preposition'},{before:'arrived',after:'arrive',rule:'verb-form'}],[{before:original,after:'',rule:'word-order'}],[{before:original,after:'x'.repeat(2001),rule:'word-order'}]]){
    const x=wire();x.analysis.grammar.changes=changes;assert.throws(()=>parse(x));
  }
  const x=wire();x.analysis.grammar.changes=[{before:'to',after:'at',rule:'preposition'}];assert.throws(()=>parse(x,'They arrived to town to rest.'));
});
test('target evidence rejects invented/embedded/ambiguous matched spans but permits punctuation and ambiguous repeats',()=>{
  for(const span of ['missing','he','arriv']){const x=wire();x.analysis.target.originalSpan=span;assert.throws(()=>parse(x));}
  const x=wire();x.analysis.grammar={status:'uncertain'};x.analysis.structure={status:'unavailable',note:'ambiguous'};x.analysis.target.originalSpan='station';assert.equal(parse(x).meaningUsage,'appropriate');
  x.analysis.target.originalSpan='arrived';assert.throws(()=>parse(x,'They arrived then arrived.'));
  x.analysis.target={reason:'ambiguous',originalSpan:'arrived'};assert.equal(parse(x,'They arrived then arrived.').meaningUsage,'uncertain');
});
test('role codes and their explanations share one graph function including this noun phrase',()=>{
  const sentence='This book is useful.',x={analysis:{target:{reason:'matched',originalSpan:'This',category:'determiner',gloss:'이'},grammar:{status:'natural',context:{kind:'clause',subjectSpan:'This book',predicateSpan:'is'}},structure:{status:'available',translation:'이 책은 유용하다.',parts:[part(['This','book'],'subject','이 책은'),verb(['is'],'linking'),part(['useful.'],'complement','유용한')]}}};
  const f=parse(x,sentence);assert.equal(f.structure.parts[0].role,'S');assert.match(f.structure.parts[0].explanation,/주어/u);assert.match(f.explanation,/한정사/u);assert.ok(!f.explanation.includes('관사'));assert.ok(!f.structure.parts[0].explanation.includes('관사'));
});
test('flag defaults preserve old requests; enabled word/grammar requests share the canonical contract and one provider call',async()=>{
  for(const domain of ['word','grammar'])for(const enabled of [undefined,'false','true']){
    const calls=[],old={meaningUsage:'appropriate',grammar:'needs_work',correctedSentence:'They arrived at the station.',explanation:'전치사를 확인해요.',structure:{status:'unavailable',translation:'',parts:[],note:'성분 확인 필요'}};
    const fetcher=async(_url,init)=>{calls.push(JSON.parse(init.body));return Response.json(envelope('google',enabled==='true'?wire():old));};
    const config={google_api:'synthetic-secret',feedback_coherent_enabled:enabled};
    const f=domain==='word'?await h.generateSentenceFeedbackWithFallback(config,{word:'arrive',pos:'v.',meaning:'도착하다',sentence:original},fetcher):await h.generateGrammarFeedback(config,h.LESSON_MAP.get('infinitive'),original,fetcher);
    assert.equal(calls.length,1);assert.ok(sentenceFeedbackSchema.safeParse(f).success);
    const schema=calls[0].generationConfig.responseJsonSchema;
    assert.equal(Object.hasOwn(schema.properties,'analysis'),enabled==='true');assert.equal(Object.hasOwn(schema.properties,'explanation'),enabled!=='true');
    const input=JSON.parse(calls[0].contents[0].parts[0].text);assert.equal(Array.isArray(input.originalUnits),enabled==='true');
    assert.equal(calls[0].generationConfig.maxOutputTokens,4096);
  }
});
test('enabled fallback retains Google first, Groq transport and strict schema without a rendering call',async()=>{
  const urls=[],bodies=[];const f=await h.generateSentenceFeedbackWithFallback({google_api:'synthetic',groq_api:'synthetic',feedback_coherent_enabled:'true'},
    {word:'arrive',pos:'v.',meaning:'도착하다',sentence:original},async(url,init)=>{urls.push(String(url));bodies.push(JSON.parse(init.body));return urls.length===1?Response.json({}, {status:503}):Response.json(envelope('groq',wire()));});
  assert.equal(urls.length,2);assert.match(urls[0],/generativelanguage/u);assert.match(urls[1],/groq/u);assert.equal(f.model,GROQ_FEEDBACK_MODEL);assert.equal(bodies[1].reasoning_effort,'low');assert.deepEqual(bodies[1].response_format.json_schema.schema,coherentFeedbackContract.schema);
});
test('every provider schema object is closed and requires exactly its properties without duplicate output fields',()=>{
  const visit=value=>{if(!value||typeof value!=='object')return;if(value.type==='object'){assert.equal(value.additionalProperties,false);assert.deepEqual(value.required,Object.keys(value.properties));}for(const v of Object.values(value))if(Array.isArray(v))v.forEach(visit);else visit(v);};visit(coherentFeedbackContract.schema);
  assert.deepEqual(Object.keys(coherentFeedbackContract.schema.properties.analysis.properties),['target','grammar','structure']);
});
