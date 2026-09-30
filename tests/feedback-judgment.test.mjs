import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseProviderFeedback, FeedbackValidationError } from '../lib/provider-feedback-contract.ts';
import { sentenceFeedbackSchema } from '../lib/sentence-feedback.ts';

const result = JSON.parse(readFileSync('data/evaluations/english-accuracy-2026-09-30-round-2.json'));
const content = f => ({ meaningUsage:f.meaningUsage, grammar:f.grammar, correctedSentence:f.correctedSentence, explanation:f.explanation, structure:f.structure });
const parse = (original, value) => parseProviderFeedback(JSON.stringify(value), original, 'gemini-3.1-flash-lite');

test('actual remaining critical responses are rejected before reaching the learner', () => {
 const baseline=JSON.parse(readFileSync('data/evaluations/english-accuracy-2026-09-30.json'));
 for(const [report,count] of [[baseline,6],[result,3]]){
  const rows=report.rows.filter(r=>r.criticalErrors.length);
  assert.equal(rows.length,count);
  for(const {feedback:f} of rows)assert.throws(()=>parse(f.original,content(f)),e=>e instanceof FeedbackValidationError&&e.stage==='judgment');
 }
});

test('natural feedback preserves every word and intent; valid corrections remain allowed', () => {
 const sample={meaningUsage:'appropriate',grammar:'natural',correctedSentence:'I like music.',explanation:'자연스러운 문장이에요.'};
 assert.equal(parse('I like music.',sample).grammar,'natural');
 assert.equal(parse('  I like music.  ',sample).grammar,'natural');
 for(const original of ['I like jazz.','I like music?','He likes music.','I liked music.','I like two songs.'])assert.throws(()=>parse(original,sample),e=>e.stage==='judgment');
 assert.equal(parse('She sing well.',{...sample,grammar:'needs_work',correctedSentence:'She sings well.'}).grammar,'needs_work');
 assert.throws(()=>parse('This book is interesting.',{...sample,meaningUsage:'needs_work',correctedSentence:''}),e=>e.stage==='judgment');
});

test('uncertain original judgments withhold invented corrections, including noun fragments', () => {
 const sample={meaningUsage:'uncertain',grammar:'uncertain',correctedSentence:'',explanation:'완전한 문장이 필요해요.',structure:{status:'unavailable',translation:'',parts:[],note:'입력이 불충분해요.'}};
 assert.equal(parse('Music',sample).correctedSentence,'');
 assert.throws(()=>parse('Music',{...sample,correctedSentence:'I like books.',structure:undefined}),e=>e.stage==='judgment');
 assert.equal(parse('Go!',{...sample,grammar:'natural',meaningUsage:'appropriate',correctedSentence:'Go!',structure:undefined}).correctedSentence,'Go!');
});

test('new-generation judgment guards do not invalidate previously saved feedback', () => {
 for(const {feedback:f} of result.rows.filter(r=>r.criticalErrors.length))assert.equal(sentenceFeedbackSchema.safeParse(f).success,true);
});
