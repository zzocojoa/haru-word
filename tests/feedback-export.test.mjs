import test from 'node:test';
import assert from 'node:assert/strict';
import {feedbackExportView} from '../lib/learning/feedback-export.ts';
import {EMPTY,emptyRecord,exportLog,exportTutor} from '../lib/learning.ts';
const seed={original:'I am reading.',correctedSentence:'I am reading.',meaningUsage:'appropriate',grammar:'natural',explanation:'합성 참고 설명',model:'gpt-6.1-sol',provider:'openai',requestedModel:'gpt-6.1-sol',createdAt:'2026-11-03T00:00:00.000Z'};
test('export separates absent, uncertain, unsafe and edited feedback from current reference opinions',()=>{
  assert.equal(feedbackExportView(seed.original).status,'의견 없음');
  assert.equal(feedbackExportView(seed.original,seed).correction,seed.correctedSentence);
  for(const [f,status] of [[{...seed,grammar:'uncertain'},'보류·판단 불충분'],[{...seed,validationVersion:'judgment-v2',explanation:'reading은 목적어예요.'},'보류·설명 모순']]){
    assert.deepEqual(feedbackExportView(seed.original,f),{status,correction:'',explanation:''});
  }
  assert.deepEqual(feedbackExportView('My new input.',seed),{status:'수정 전 입력의 의견',correction:'',explanation:''});
});
test('CSV appends status after the 24 stable columns; tutor omits withheld advice and raw state is unchanged',()=>{
  const state=structuredClone(EMPTY),id=crypto.randomUUID(),feedback={...seed,grammar:'uncertain',correctedSentence:'Unique withheld correction.',explanation:'Unique withheld explanation.'};
  state.sessions[id]={id,kind:'daily',date:'2026-11-03',createdAt:seed.createdAt,ids:['entry'],records:{entry:{...emptyRecord('합성 뜻'),sentence:seed.original,aiFeedback:feedback}}};
  const before=JSON.stringify(state),csv=exportLog(state,[]),tutor=exportTutor(state,[]);
  const header=csv.split('\r\n')[0].slice(1).split(',');
  assert.equal(header.length,25);assert.deepEqual(header.slice(-3),['"AI 제공사"','"AI 모델"','"AI 의견 상태"']);
  for(const output of [csv,tutor]){assert.match(output,/보류·판단 불충분/);assert.ok(!output.includes(feedback.correctedSentence));assert.ok(!output.includes(feedback.explanation));}
  assert.equal(JSON.stringify(state),before);assert.equal(state.sessions[id].records.entry.aiFeedback.correctedSentence,feedback.correctedSentence);
});
