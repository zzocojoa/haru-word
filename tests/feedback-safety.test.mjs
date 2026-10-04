import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { feedbackSafetyIssue } from '../lib/feedback-safety.ts';
import { sentenceFeedbackPresentation } from '../lib/sentence-feedback-presentation.ts';

await build({ entryPoints:['app/feedback-detail.tsx','app/grammar/grammar-writing.tsx'], outdir:'work/feedback-safety-render', bundle:true, format:'esm', platform:'node', external:['react','react-dom','react/jsx-runtime','lucide-react'], outExtension:{'.js':'.mjs'}, logLevel:'silent' });
const { renderToStaticMarkup } = await import('react-dom/server');
const { createElement } = await import('react');
const { FeedbackDetail } = await import('../work/feedback-safety-render/feedback-detail.mjs');
const { GrammarWriting } = await import('../work/feedback-safety-render/grammar/grammar-writing.mjs');
const frozen=JSON.parse(readFileSync('tests/fixtures/feedback-safety-replay.json','utf8'));
const actual=(id,provider)=>frozen.rows.find(r=>r.caseId===id&&r.provider===provider).feedback;
const make=(sentence,pairs)=>({ original:sentence,correctedSentence:sentence,meaningUsage:'appropriate',grammar:'natural',explanation:'문장별 참고 설명',model:'gemini-3.1-flash-lite',createdAt:'2026-10-02T00:00:00.000Z',structure:{status:'available',translation:'검사용 해석',parts:pairs.map(([text,role])=>({text,role,explanation:'검사용 설명'})),note:''}});

test('frozen successful HTTP responses with wrong English roles are withheld without rewriting evidence',()=>{
  for(const [id,provider,reason] of [['grammar-45','google','progressive_role'],['grammar-45','groq','progressive_role'],['word-32','groq','preposition_object']]){
    const feedback=actual(id,provider),before=JSON.stringify(feedback);
    assert.equal(feedbackSafetyIssue(feedback),reason);assert.equal(JSON.stringify(feedback),before);
    const html=renderToStaticMarkup(createElement(FeedbackDetail,{feedback,suggestionAction:createElement('button',null,'교정 적용')}));
    assert.match(html,/AI 설명 확인 필요/);assert.match(html,/Cambridge/);
    assert.ok(!html.includes(feedback.explanation));assert.ok(!html.includes('교정 적용'));assert.ok(!html.includes('sentence-structure-parts'));
  }
});

test('short progressive clauses include split/grouped verbs, contractions, negation and past forms',()=>{
  for(const [sentence,pairs] of [
    ['I am now writing.',[['I','S'],['am','V'],['now','M'],['writing.','C']]],
    ["I'm writing.",[["I",'S'],["'m",'V'],['writing.','O']]],
    ['She is not reading.',[['She','S'],['is','V'],['not','M'],['reading.','C']]],
    ['They were still playing.',[['They','S'],['were','V'],['still','M'],['playing.','C']]],
  ]){
    const bad=make(sentence,pairs);assert.equal(feedbackSafetyIssue(bad),'progressive_role');
    const good=structuredClone(bad);good.structure.parts.at(-1).role='V';assert.equal(feedbackSafetyIssue(good),undefined);
  }
  assert.equal(feedbackSafetyIssue(make('We are playing.',[['We','S'],['are playing.','V']])),undefined);
  assert.equal(feedbackSafetyIssue(make('I am now writing.',[['I','S'],['am','V'],['now','M'],['wri','C'],['ting.','C']])),'progressive_role');
  assert.equal(feedbackSafetyIssue(make('I am now writing.',[['I','S'],['am','V'],['now','M'],['wri','V'],['ting.','V']])),undefined);
});

test('preposition phrases and isolated prepositions cannot become direct objects',()=>{
  for(const pairs of [
    [['They','S'],['arrived','V'],['at the station.','O']],
    [['They','S'],['arrived','V'],['at','O'],['the station.','O']],
    [['They','S'],['arrived','V'],['a','O'],['t the station.','O']],
    [['They','S'],['arrived','V'],['at','M'],['the station.','O']],
    [['They','S'],['arrived','V'],['at the station.','C']],
    [['They','S'],['arrived','V'],['at the station.','M']],
  ]){
    const feedback=make('They arrived at the station.',pairs);
    assert.equal(feedbackSafetyIssue(feedback),pairs[2][1]==='O'?'preposition_object':undefined);
  }
});

test('valid gerunds, adjectives, proper names, infinitives and objects containing modifiers remain readable',()=>{
  const valid=[
    ['My hobby is reading.',[['My hobby','S'],['is','V'],['reading.','C']]],
    ['I am interesting.',[['I','S'],['am','V'],['interesting.','C']]],
    ['He is trying.',[['He','S'],['is','V'],['trying.','C']]],
    ['I am working.',[['I','S'],['am','V'],['working.','C']]],
    ['They are running.',[['They','S'],['are','V'],['running.','C']]],
    ['I am working class.',[['I','S'],['am','V'],['working class.','C']]],
    ['We are teaching staff.',[['We','S'],['are','V'],['teaching staff.','C']]],
    ['She is Reading.',[['She','S'],['is','V'],['Reading.','C']]],
    ['I want to read.',[['I','S'],['want','V'],['to read.','O']]],
    ['I bought a book about the station.',[['I','S'],['bought','V'],['a book about the station.','O']]],
    ['I bought a book about the station.',[['I','S'],['bought','V'],['a book','O'],['about the station.','O']]],
    ['I read To the Lighthouse.',[['I','S'],['read','V'],['To the Lighthouse.','O']]],
    ['We discussed In the Mood for Love.',[['We','S'],['discussed','V'],['In','O'],['the Mood for Love.','O']]],
    ['I prefer for my coffee to have milk in it.',[['I','S'],['prefer','V'],['for my coffee to have milk in it.','O']]],
    ['I prefer for my coffee to have milk in it.',[['I','S'],['prefer','V'],['for','O'],['my coffee to have milk in it.','O']]],
    ['I prefer for my coffee to have milk in it.',[['I','S'],['prefer','V'],['for','O'],['my coffee','S'],['to have','V'],['milk','O'],['in it.','M']]],
    ['I need at least three books.',[['I','S'],['need','V'],['at least three books.','O']]],
    ['I need about a week.',[['I','S'],['need','V'],['about a week.','O']]],
    ['I need over a hundred books.',[['I','S'],['need','V'],['over a hundred books.','O']]],
    ['I need under a week.',[['I','S'],['need','V'],['under a week.','O']]],
    ['We discussed "at the station".',[['We','S'],['discussed','V'],['"at the station".','O']]],
    ['We discussed "at the station".',[['We','S'],['discussed','V'],['"','X'],['at the station','O'],['".','X']]],
  ];
  for(const [sentence,pairs] of valid)assert.equal(feedbackSafetyIssue(make(sentence,pairs)),undefined,sentence);
  const legacy=make('I am now writing.',[['I','S'],['am','V'],['now','M'],['writing.','C']]);delete legacy.structure;
  assert.equal(feedbackSafetyIssue(legacy),undefined);
  assert.equal(feedbackSafetyIssue({...legacy,structure:{status:'unavailable',translation:'',parts:[],note:'문맥 확인 필요'}}),undefined);
});

test('daily retry is explicit and unsafe correction cannot be applied, including stale feedback',()=>{
  const feedback=actual('word-32','groq');
  const present=(sentence,options={})=>sentenceFeedbackPresentation({feedback,sentence,busy:false,pending:false,...options});
  assert.equal(present(feedback.original).action,'retryAnalysis');assert.equal(present(feedback.original).disabled,false);
  assert.equal(present(feedback.original).canApply,false);assert.equal(present('A changed draft.').canApply,false);
  assert.equal(present(feedback.original,{busy:true}).disabled,true);
  assert.equal(present(feedback.original,{pending:true}).disabled,true);
  assert.equal(present('').disabled,true);
});

test('grammar writing withholds badges, free explanation, roles and apply action but preserves the draft',()=>{
  const feedback=actual('grammar-45','google');
  const lesson={id:'auxiliary',writing:'진행형 문장을 써 보세요.',stem:'I am writing.',check:'내 문장 점검'};
  const progress={stage:5,sentence:feedback.original,answers:{},feedback,updatedAt:feedback.createdAt};
  const noop=()=>{};
  const html=renderToStaticMarkup(createElement(GrammarWriting,{lesson,progress,canSave:true,aiPending:false,aiError:null,onAi:noop,onSentence:noop,onCheck:noop,onChecks:noop,onFrame:noop,onExplain:noop,onComplete:noop}));
  assert.match(html,/AI 설명 확인 필요/);assert.ok(!html.includes(feedback.explanation));assert.ok(!html.includes('자연스러운 문장이에요'));
  assert.ok(!html.includes('sentence-structure-parts'));assert.ok(html.includes(feedback.original));
});


test('grammar safety blocks an otherwise available correction action while preserving the draft',()=>{
  const feedback={...structuredClone(actual('grammar-45','google')),original:'I am now write.',grammar:'needs_work'};
  const lesson={id:'auxiliary',writing:'진행형 문장을 써 보세요.',stem:'I am writing.',check:'내 문장 점검'};
  const progress={stage:5,sentence:feedback.original,answers:{},feedback,updatedAt:feedback.createdAt};
  const noop=()=>{};
  const render=()=>renderToStaticMarkup(createElement(GrammarWriting,{lesson,progress,canSave:true,aiPending:false,aiError:null,onAi:noop,onSentence:noop,onCheck:noop,onChecks:noop,onFrame:noop,onExplain:noop,onComplete:noop}));
  assert.notEqual(feedback.correctedSentence,progress.sentence);
  const unsafe=render();
  assert.match(unsafe,/AI 설명 확인 필요/);assert.ok(unsafe.includes(progress.sentence));
  assert.ok(!unsafe.includes('AI 제안을 내 문장에 적용'));
  const safe=structuredClone(feedback);safe.structure.parts.at(-1).role='V';progress.feedback=safe;
  const allowed=render();
  assert.ok(allowed.includes('AI 제안을 내 문장에 적용'));assert.ok(!allowed.includes('AI 설명 확인 필요'));
  assert.equal(feedbackSafetyIssue(feedback),'progressive_role');
});

test('word/history and grammar views expose only neutral reference opinions while preserving structure',()=>{
  const feedback=make('I like music.',[['I','S'],['like','V'],['music.','O']]);
  const before=JSON.stringify(feedback);
  for(const meaningUsage of ['appropriate','needs_work','uncertain'])for(const grammar of ['natural','needs_work','uncertain']){
    const f={...feedback,meaningUsage,grammar};
    for(const grammarTarget of [false,true]){
      const html=renderToStaticMarkup(createElement(FeedbackDetail,{feedback:f,grammarTarget}));
      assert.match(html,/AI 참고 의견 · 정답 판정이 아닙니다/);
      assert.match(html,/AI에 보낸 문장/);
      assert.ok(!html.includes('sentence-structure-parts'));assert.ok(!html.includes(f.structure.translation));
      assert.ok(!html.includes('자연스러운 문장이에요'));assert.ok(!html.includes('data-tone="success"'));
      assert.ok(html.includes(f.original));assert.ok(html.includes(f.explanation));
    }
  }
  assert.equal(JSON.stringify(feedback),before);
});
