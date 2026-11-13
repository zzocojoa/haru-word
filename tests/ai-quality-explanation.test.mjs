import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { TARGET_NEEDS_WORK_EXPLANATION, verifiedCorrectionRule } from '../lib/verified-feedback-explanation.ts';
import { parseJudgmentFeedback } from '../lib/judgment-feedback-contract.ts';
import { sentenceFeedbackSchema } from '../lib/sentence-feedback.ts';

const parse=(original,correctedSentence,extra={})=>parseJudgmentFeedback(JSON.stringify({meaningUsage:'appropriate',grammar:'needs_work',correctedSentence,targetReason:'합성 목표',grammarReason:'MODEL_FALSE_RULE',correctionReason:'MODEL_FALSE_RULE',contextNeeded:'none',...extra}),original,'gpt-6.1-sol',{sentence:original});

test('unchanged constructions cannot supply the explanation of a different edit',()=>{
 for(const [a,b]of [
  ['She is speaking quiet.','She is speaking quietly.'],
  ['The workers is painting.','The workers are painting.'],
  ['They needs help and want to read.','They need help and want to read.'],
  ['I buyed a book and they walks.','I buyed a book and they walk.'],
  ['I listen to music and they walks.','I listen to music and they walk.'],
  ['The book is interesting and they walks.','The book is interesting and they walk.'],
 ])assert.equal(verifiedCorrectionRule(a,b),undefined,a);
});

test('only an actual single reviewed edit receives its corresponding rule',()=>{
 for(const [a,b,rule]of [
  ['I want learn English.','I want to learn English.',/to \+ 동사원형/],
  ['They is studying.','They are studying.',/they.*are/],
  ['She are here.','She is here.',/he·she·it.*is/],
  ['Him likes tea.','He likes tea.',/주격과 목적격/],
  ['I buyed a book.','I bought a book.',/buy.*bought/],
  ['He goed home.','He went home.',/go.*went/],
  ['We eated lunch.','We ate lunch.',/eat.*ate/],
  ['I listen music.','I listen to music.',/listen.*to/],
 ])assert.match(verifiedCorrectionRule(a,b)??'',rule,a);
});

test('multiple or unsupported edits use the literal comparison instead of a partial grammar story',()=>{
 for(const [a,b]of [
  ['They is work quick.','They are working quickly.'],
  ['I want learn and buyed a book.','I want to learn and bought a book.'],
  ['Him likes she.','He likes her.'],
  ['I have buyed a book.','I have bought a book.'],
  ['She is read.','She is reading.'],
 ])assert.equal(verifiedCorrectionRule(a,b),undefined,a);
 assert.equal(verifiedCorrectionRule('They are here.','They are here.'),undefined);
 assert.equal(verifiedCorrectionRule('They are here.','They are here!'),undefined);
});

test('verified single edits after modal verbs can teach the base-form rule',()=>{
 for(const [original,correction] of [
  ['The children can carries two lanterns.','The children can carry two lanterns.'],
  ['She can swims.','She can swim.'],
  ['He should rests now.','He should rest now.'],
  ['They must not inspects the room.','They must not inspect the room.'],
 ]){
  assert.match(verifiedCorrectionRule(original,correction)??'',/동사원형/,original);
  const feedback=parse(original,correction);
  assert.equal(feedback.correctedSentence,correction);
  assert.match(feedback.explanation,/교정 참고: .*동사원형/);
  assert.doesNotMatch(feedback.explanation,/MODEL_FALSE_RULE/);
 }
 for(const [original,correction] of [
  ['The water can carries two labels.','The water can carry two labels.'],
  ['“The children can carries two lanterns.”','“The children can carry two lanterns.”'],
  ['She can swims and rests.','She can swim and rest.'],
  ['He should rests now.','He should rest later.'],
  ['He might brought a key.','He might bring a key.'],
  ['She can have carries.','She can have carry.'],
 ])assert.equal(verifiedCorrectionRule(original,correction),undefined,original);
});

test('matching subject and recipient case edits share one verified explanation',()=>{
 const original='Him gave the notebook to she.';
 const correction='He gave the notebook to her.';
 assert.match(parse(original,correction).explanation,/교정 참고:.*주격.*전치사 to.*목적격/);
 assert.match(verifiedCorrectionRule('Me sent the forms to they.','I sent the forms to them.')??'',/주격.*목적격/);
 for(const [before,after] of [
  [original,'She gave the notebook to him.'],
  [original,'He gave the letter to her.'],
  [original,'He gives the notebook to her.'],
  [original,'He gave the notebook to her!'],
  ['US gave the notebook to she.','We gave the notebook to her.'],
  ['Him wanted to she.','He wanted to her.'],
 ])assert.equal(verifiedCorrectionRule(before,after),undefined,before+' → '+after);
});

test('visible explanations preserve separate judgments and exclude model-authored false rules',()=>{
 const changed=parse('She is speaking quiet.','She is speaking quietly.');
 assert.match(changed.explanation,/실제 바뀐 표현/);assert.doesNotMatch(changed.explanation,/진행형|MODEL_FALSE_RULE/);
 const uncertain=parse('She sing well.','She sings well.',{meaningUsage:'uncertain',contextNeeded:'target_meaning'});
 assert.match(uncertain.explanation,/목표 사용은 문맥/);assert.match(uncertain.explanation,/문법에 보완/);assert.match(uncertain.explanation,/추가 문맥/);
 const original='They are here.';
 const natural=parse(original,original,{grammar:'natural',correctionReason:''});
 assert.doesNotMatch(natural.explanation,/교정 참고:|교정:|MODEL_FALSE_RULE/);
 const withheld=parse(original,'',{meaningUsage:'uncertain',grammar:'uncertain',contextNeeded:'message',correctionReason:''});
 assert.doesNotMatch(withheld.explanation,/교정 참고:/);assert.match(withheld.explanation,/교정문을 보류/);
});

test('a verified count-unit repair teaches the noun rule without borrowing unrelated edits',()=>{
 for (const [original, correction, noun] of [
  ['Two luggage block aisle.', 'Two pieces of luggage block the aisle.', 'luggage'],
  ['One luggage block aisle.', 'One piece of luggage blocks the aisle.', 'luggage'],
  ['Three equipment fill room.', 'Three items of equipment fill the room.', 'equipment'],
  ['I brought two luggage to the airport.', 'I brought two pieces of luggage to the airport.', 'luggage'],
 ]) {
  const feedback = parse(original, correction);
  assert.equal(feedback.correctedSentence, correction);
  assert.match(feedback.explanation, new RegExp('교정 참고:.*' + noun + '.*piece of.*item of'));
  assert.doesNotMatch(feedback.explanation, /MODEL_FALSE_RULE/);
 }
 for (const [original, correction] of [
  ['Two luggage block aisle.', 'Three pieces of luggage block the aisle.'],
  ['Two luggage block aisle.', 'Two pieces of luggage blocked the aisle.'],
  ['Two luggage block aisle.', 'Two pieces of luggage block the doorway.'],
  ['Two luggage block aisle.', 'Two pieces of luggage block the aisle?'],
  ['I brought two luggage to the airport.', 'I brought two pieces of luggage to the hotel.'],
  ['Two luggage carts block aisle.', 'Two pieces of luggage carts block the aisle.'],
  ['She wrote "two luggage".', 'She wrote "two pieces of luggage".'],
 ]) assert.equal(verifiedCorrectionRule(original, correction), undefined, correction);
});

test('an avoid complement explains the action form and any verified present agreement edit', () => {
  const agreement = parse('She avoid drive at night.', 'She avoids driving at night.');
  assert.match(agreement.explanation, /교정 참고: .*she.*avoids.*avoid.*-ing/);
  assert.doesNotMatch(agreement.explanation, /MODEL_FALSE_RULE/);
  for (const [original, correction] of [
    ['They avoid to open the door.', 'They avoid opening the door.'],
    ['We avoided to run on the path.', 'We avoided running on the path.'],
    ['He avoids swim alone.', 'He avoids swimming alone.'],
  ]) {
    const feedback = parse(original, correction);
    assert.equal(feedback.correctedSentence, correction);
    assert.match(feedback.explanation, /교정 참고: .*avoid.*-ing/);
    assert.doesNotMatch(feedback.explanation, /주어/);
  }
  for (const [original, correction] of [
    ['She avoid drive at night.', 'She avoided driving at night.'],
    ['She avoid drive at night.', 'She avoids driving alone.'],
    ['She avoid drive at night.', 'He avoids driving at night.'],
    ['She avoid drive at night.', 'She avoids driving at night?'],
    ['She avoid drive at night.', 'She avoid driving at night.'],
    ['She avoids to run.', 'She avoids to running.'],
    ['She avoids to run.', 'She avoids runing.'],
    ['She avoids to drive.', 'She avoids riding.'],
    ['She avoids a drive at night.', 'She avoids driving at night.'],
    ['“She avoid drive at night.”', '“She avoids driving at night.”'],
  ]) assert.equal(verifiedCorrectionRule(original, correction), undefined, correction);
});

const hold=(original,contextNeeded)=>parse(original,'',{meaningUsage:'needs_work',grammar:'uncertain',contextNeeded,correctionReason:''});

test('withheld corrections explain verified form errors without choosing a time or number',()=>{
 for(const [original,kind,rule,question] of [
  ['You might brought a torch.','time',/동사원형/,/의도한 시점/],
  ['They could went to class.','time',/동사원형/,/의도한 시점/],
  ['Those car belongs to Mia.','quantity',/복수형/,/의도한 수량/],
  ['These book is on the desk.','quantity',/복수형/,/의도한 수량/],
 ]){
  const feedback=hold(original,kind);
  assert.equal(feedback.grammar,'uncertain');
  assert.equal(feedback.correctedSentence,'');
  assert.equal(feedback.original,original);
  assert.match(feedback.explanation,rule);
  assert.match(feedback.explanation,/교정문을 보류/);
  assert.match(feedback.explanation,question);
  assert.doesNotMatch(feedback.explanation,/MODEL_FALSE_RULE/);
  assert.deepEqual(sentenceFeedbackSchema.parse(JSON.parse(JSON.stringify(feedback))),feedback);
 }
});

test('withholding alone never upgrades grammatical or unsupported forms to confirmed errors',()=>{
 for(const [original,kind] of [
  ['She might saw the board.','time'],
  ['They might have brought a torch.','time'],
  ['"You might brought a torch."','time'],
  ['You might brought a torch.','quantity'],
  ['Those car doors belong to Mia.','quantity'],
  ['Those cars belong to Mia.','quantity'],
  ['Those car belongs to Mia.','message'],
 ])assert.doesNotMatch(hold(original,kind).explanation,/동사원형이 필요|복수형이어야/,original);
});

await build({stdin:{contents:"export {FeedbackDetail} from './app/feedback-detail';export {RecordText} from './app/record-text';export {createElement} from 'react';export {renderToStaticMarkup} from 'react-dom/server';",resolveDir:process.cwd(),loader:'tsx'},outfile:'work/ai-quality-explanation/runtime.mjs',bundle:true,format:'esm',platform:'node',external:['react','react-dom','react/jsx-runtime','lucide-react'],jsx:'automatic',logLevel:'silent'});
const {FeedbackDetail,RecordText,createElement,renderToStaticMarkup}=await import(pathToFileURL(process.cwd()+'/work/ai-quality-explanation/runtime.mjs'));

test('v7 incomplete sentences keep their target judgment and show a content request without an apply action', () => {
 const original='Every spare gasket in the drawer';
 const feedback={...parse(original,'',{grammar:'needs_work',contextNeeded:'message',correctionReason:''}),validationVersion:'judgment-v7'};
 const before=JSON.stringify(feedback);
 for(const grammarTarget of [false,true]){
  const html=renderToStaticMarkup(createElement(FeedbackDetail,{feedback,grammarTarget}));
  assert.match(html,/문법 · 문장 미완성/);
  assert.match(html,/교정 · 완성할 내용 필요/);
  assert.match(html,/수정 제안 없음/);
  assert.doesNotMatch(html,/AI 교정 제안|아래의 원문과 교정문을 비교|AI 제안으로 문장 바꾸기/);
 }
 assert.equal(JSON.stringify(feedback),before);
 const historical={...feedback,grammar:'uncertain',validationVersion:'judgment-v6'};
 const html=renderToStaticMarkup(createElement(FeedbackDetail,{feedback:historical}));
 assert.match(html,/문법 · 판단 어려움/);
 assert.doesNotMatch(html,/문법 · 문장 미완성/);
});

test('new and saved v6 records show separate form and correction labels without changing old data',()=>{
 for(const [original,kind,rule] of [
  ['You might brought a torch.','time','조동사 바로 뒤에는 동사원형이 필요해요.'],
  ['Those car belongs to Mia.','quantity','these·those가 가리키는 명사는 복수형이어야 해요.'],
 ]){
  const recent={...hold(original,kind),validationVersion:'judgment-v6'};
  const older={...recent,explanation:recent.explanation.replace(`${rule} `,'')};
  const oldRecord=JSON.stringify(older);
  for(const [feedback,grammarTarget] of [[recent,true],[older,false]]){
   const html=renderToStaticMarkup(createElement(FeedbackDetail,{feedback,grammarTarget}));
   assert.match(html,/문법 · 형태 오류 확인/);
   assert.match(html,/교정 · 문맥 확인 필요/);
   assert.equal(html.split(rule).length,2);
   assert.doesNotMatch(html,/AI 교정 제안|문법 · 판단 어려움/);
  }
  assert.equal(JSON.stringify(older),oldRecord);
 }
 const unresolved={...hold('They might have brought a torch.','time'),validationVersion:'judgment-v6'};
 const html=renderToStaticMarkup(createElement(FeedbackDetail,{feedback:unresolved}));
 assert.match(html,/문법 · 판단 어려움/);
 assert.doesNotMatch(html,/형태 오류 확인|교정 · 문맥 확인 필요/);
});

test('the target display separates a known mismatch from missing context in both learning routes',()=>{
 const needsWork={...hold('You might brought a torch.','time'),validationVersion:'judgment-v6'};
 assert.match(needsWork.explanation,/목표 표현의 사용 기준에 맞지 않는다고/);
 const unknown={...parse('She sings well.','She sings well.',{meaningUsage:'uncertain',grammar:'natural',contextNeeded:'target_meaning',correctionReason:''}),validationVersion:'judgment-v6'};
 for(const grammarTarget of [false,true]){
  const label=grammarTarget?'수업 목표':'뜻·용법';
  const wrong=renderToStaticMarkup(createElement(FeedbackDetail,{feedback:needsWork,grammarTarget}));
  assert.ok(wrong.includes(`${label} · 보완 필요`));
  assert.match(wrong,/문법 · 형태 오류 확인/);
  assert.match(wrong,/교정 · 문맥 확인 필요/);
  const unclear=renderToStaticMarkup(createElement(FeedbackDetail,{feedback:unknown,grammarTarget}));
  assert.ok(unclear.includes(`${label} · 문맥 확인 필요`));
  assert.doesNotMatch(unclear,/목표 표현의 사용 기준에 맞지 않는다고/);
 }
});

test('only the previous app-authored v6 target line is replaced at read time',()=>{
 const previous='AI는 목표 뜻·용법을 별도로 확인할 필요가 있다고 보았어요.';
 const feedback={...hold('Those car belongs to Mia.','quantity'),validationVersion:'judgment-v6'};
 const old={...feedback,explanation:feedback.explanation.replace(TARGET_NEEDS_WORK_EXPLANATION,previous)};
 const raw=JSON.stringify(old);
 const show=feedback=>renderToStaticMarkup(createElement(FeedbackDetail,{feedback,grammarTarget:true}));
 assert.ok(show(old).includes(TARGET_NEEDS_WORK_EXPLANATION));
 assert.ok(!show(old).includes(previous));
 assert.equal(JSON.stringify(old),raw);
 assert.ok(show({...old,validationVersion:'judgment-v5'}).includes(previous));
 assert.ok(show({...old,explanation:`학습 메모: ${previous}\n${feedback.explanation}`}).includes(previous));
});

test('actual feedback components render the original, correction and factual fallback with escaped long text',()=>{
 const feedback={...parse('She is speaking quiet.','She is speaking quietly.'),validationVersion:'judgment-v6',promptVersion:'reference-v6'};
 const html=renderToStaticMarkup(createElement(FeedbackDetail,{feedback}));
 for(const expected of [feedback.original,feedback.correctedSentence,'실제 바뀐 표현','교정 참고 설명은 검토한 규칙'])assert.ok(html.includes(expected),expected);
 assert.doesNotMatch(html,/진행형|MODEL_FALSE_RULE/);
 for(const [text,disclosed]of [['x'.repeat(240),false],['x'.repeat(241),true],['a\nb\nc\nd',false],['a\nb\nc\nd\ne',true]]){
  const markup=renderToStaticMarkup(createElement(RecordText,{text,label:'검사'}));assert.equal(markup.includes('<details'),disclosed);
 }
 const escaped=renderToStaticMarkup(createElement(RecordText,{text:'<script>synthetic</script>',label:'검사'}));assert.ok(escaped.includes('&lt;script&gt;'));assert.ok(!escaped.includes('<script>'));
});

test('only a changed correction is shown and a known grammar issue has its own heading',()=>{
 const original='The children can carries two lanterns.';
 const correction='The children can carry two lanterns.';
 const show=feedback=>renderToStaticMarkup(createElement(FeedbackDetail,{feedback,grammarTarget:true}));
 const repair=show(parse(original,correction));
 assert.match(repair,/문법 · 보완 필요/);
 assert.match(repair,/AI 교정 제안/);
 const normal=show(parse(correction,correction,{grammar:'natural',correctionReason:''}));
 assert.match(normal,/문법 · 수정 제안 없음/);
 assert.doesNotMatch(normal,/AI 교정 제안/);
 const withheld=show(hold('She might took the upstairs key.','time'));
 assert.match(withheld,/문법 · 판단 어려움/);
 assert.doesNotMatch(withheld,/AI 교정 제안|문법 · 보완 필요/);
});

test('v9 keeps a known grammar issue separate from an unresolved repair in saved output',()=>{
 const original='She might took the upstairs key.';
 const f={...parse(original,'',{grammar:'needs_work',contextNeeded:'time',correctionReason:''}),validationVersion:'judgment-v9'};
 const saved=sentenceFeedbackSchema.parse(JSON.parse(JSON.stringify(f)));
 const before=JSON.stringify(saved);
 const html=renderToStaticMarkup(createElement(FeedbackDetail,{feedback:saved,grammarTarget:true}));
 assert.equal(saved.grammar,'needs_work');
 assert.match(html,/문법 · 형태 오류 확인/);
 assert.match(html,/교정 · 문맥 확인 필요/);
 assert.doesNotMatch(html,/AI 교정 제안|문법 · 판단 어려움|문장 미완성/);
 assert.equal(JSON.stringify(saved),before);
 const other={...parse('She sing well.','',{grammar:'needs_work',contextNeeded:'message',correctionReason:''}),validationVersion:'judgment-v9'};
 const generic=renderToStaticMarkup(createElement(FeedbackDetail,{feedback:other}));
 assert.match(generic,/문법 · 보완 필요/);
 assert.match(generic,/교정 · 문맥 확인 필요/);
 assert.doesNotMatch(generic,/문장 미완성|AI 교정 제안/);
});
