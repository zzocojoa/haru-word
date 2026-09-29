import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import fixture from './fixtures/sentence-structure.cjs';
const { feedback, structure, original } = fixture;
await build({ entryPoints: ['lib/sentence-feedback.ts', 'lib/feedback-compatibility.ts', 'lib/feedback-fallback.ts', 'lib/grammar/feedback.ts', 'lib/grammar/content.ts', 'lib/backup.ts', 'lib/backup-analysis.ts', 'lib/restore-validation.ts', 'lib/response-validation.ts', 'db/restore-jobs.ts', 'db/feedback-compatibility.ts'], outdir: 'work/structure-tests', entryNames: '[dir]/[name]', bundle: true, format: 'esm', platform: 'node', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const { sentenceFeedbackSchema } = await import('../work/structure-tests/lib/sentence-feedback.mjs');
const { legacyFeedback, legacyFeedbackDocument } = await import('../work/structure-tests/lib/feedback-compatibility.mjs');
const { generateSentenceFeedbackWithFallback } = await import('../work/structure-tests/lib/feedback-fallback.mjs');
const { generateGrammarFeedback } = await import('../work/structure-tests/lib/grammar/feedback.mjs');
const { GRAMMAR_LESSONS } = await import('../work/structure-tests/lib/grammar/content.mjs');
const { makeBackup, parseBackup, prepareSafetyBackup } = await import('../work/structure-tests/lib/backup.mjs');
const { analyzeBackup } = await import('../work/structure-tests/lib/backup-analysis.mjs');
const { parsePart } = await import('../work/structure-tests/lib/restore-validation.mjs');
const { parseSnapshot } = await import('../work/structure-tests/lib/response-validation.mjs');
const jobs = await import('../work/structure-tests/db/restore-jobs.mjs');
const { hasSavedStructuredFeedback } = await import('../work/structure-tests/db/feedback-compatibility.mjs');
const word = JSON.parse(readFileSync('data/words.json')).find(w => w.word === 'trip' && w.pos === 'n.');
const sid = crypto.randomUUID(), date = '2026-09-29', now = date + 'T00:00:00.000Z';
const rec = { meaning: '여행', en: 'independent', ko: 'help', sentenceStatus: 'unmeasured', sentence: original, notes: '', aiFeedback: feedback };
const session = { id: sid, kind: 'daily', date, period: date, ids: [word.id], warmupIds: [], stage: 'sentence', index: 0, records: { [word.id]: rec }, retry: [], retryMode: false, elapsed: 0, finished: false, paused: true, createdAt: now };
const grammar = { noun: { stage: 5, sentence: original, answers: Object.fromEntries(['q1','q2','q3'].map(k => [k,{ first:'a',latest:'a',attempts:1,helped:false }])), feedback, updatedAt: now } };
const state = { settings: { level:'A1',dailyGoal:3,assessments:{},activeSessionId:sid },progress:{},sessions:{[sid]:session},grammar };

test('optional structure keeps old feedback compatible and strictly ties chunks to the corrected sentence', () => {
  assert.ok(sentenceFeedbackSchema.safeParse(feedback).success);
  const old = legacyFeedback(feedback); assert.ok(!Object.hasOwn(old,'structure')); assert.ok(sentenceFeedbackSchema.safeParse(old).success);
  for (const mutate of [s => s.parts.reverse(), s => s.parts.pop(), s => s.parts.push(s.parts[0]), s => s.parts[0].text='You', s => s.parts[0].role='N', s => s.translation='', s => s.parts[0].explanation='', s => s.parts[0].extra='unknown', s => s.parts=Array(21).fill(s.parts[0]), s => s.parts[0].explanation='x'.repeat(141)]) {
    const bad=structuredClone(structure);mutate(bad);assert.equal(sentenceFeedbackSchema.safeParse({...feedback,structure:bad}).success,false);
  }
  assert.equal(sentenceFeedbackSchema.safeParse({...feedback,correctedSentence:original}).success,false);
  assert.equal(sentenceFeedbackSchema.safeParse({...feedback,correctedSentence:'',structure:{status:'unavailable',translation:'',parts:[],note:'입력이 불명확해요.'}}).success,true);
  assert.equal(sentenceFeedbackSchema.safeParse({...feedback,structure:{...structure,status:'unavailable'}}).success,false);
});
test('questions, contractions, SV, SVC and imperatives are not forced into SVO', () => {
  for (const [sentence, pairs] of [
    ['Do you like music?', [['Do','V'],['you','S'],['like','V'],['music?','O']]],
    ["I'm ready.", [["I",'S'],["'m",'V'],['ready.','C']]],
    ['I sleep.', [['I','S'],['sleep.','V']]],
    ['Stop!', [['Stop!','V']]],
  ]) assert.ok(sentenceFeedbackSchema.safeParse({...feedback,correctedSentence:sentence,structure:{status:'available',translation:'학습용 해석',parts:pairs.map(([text,role])=>({text,role,explanation:'문맥의 역할'})),note:''}}).success);
});
test('Google and Groq receive identical structure instructions and return validated structure in one request each', async () => {
  const content={meaningUsage:feedback.meaningUsage,grammar:feedback.grammar,correctedSentence:feedback.correctedSentence,explanation:feedback.explanation,structure};
  for (const fallback of [false,true]) {
    const sent=[];const result=await generateSentenceFeedbackWithFallback({google_api:'synthetic',groq_api:'synthetic'}, {sentence:original,word:'trip',pos:'n.',meaning:'여행'}, async(url,init)=>{
      const body=JSON.parse(init.body);sent.push(body);
      if(url.includes('googleapis'))return fallback?new Response('',{status:429}):Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(content)}]}}]});
      return Response.json({model:'openai/gpt-oss-120b',choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]});
    });
    assert.equal(sent.length,fallback?2:1);assert.deepEqual(result.structure,structure);
    assert.match(sent[0].systemInstruction.parts[0].text,/Do not force all sentences into SVO/);
    assert.ok(sent[0].generationConfig.responseJsonSchema.required.includes('structure'));
    if(fallback)assert.equal(sent[1].messages[0].content,sent[0].systemInstruction.parts[0].text);
  }
  const result=await generateGrammarFeedback('synthetic',GRAMMAR_LESSONS[0],original,async(_url,init)=>{
    assert.match(JSON.parse(init.body).systemInstruction.parts[0].text,/ENTIRE correctedSentence/);
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(content)}]}}]});
  });assert.deepEqual(result.structure,structure);
});
test('mismatched provider structure triggers existing fallback without accepting fabricated words', async () => {
  let calls=0;await assert.rejects(generateSentenceFeedbackWithFallback({google_api:'synthetic',groq_api:'synthetic'},{sentence:original,word:'trip',pos:'n.',meaning:'여행'},async url=>{
    calls++;const content={...legacyFeedback(feedback),structure:{...structure,parts:[{text:'Not the correction.',role:'S',explanation:'오류'}]}};
    delete content.original;delete content.model;delete content.createdAt;
    return url.includes('googleapis')?Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(content)}]}}]}):Response.json({model:'openai/gpt-oss-120b',choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]});
  }),e=>e.code==='groq_invalid_response'&&e.issue.previous.code==='provider_invalid_response');assert.equal(calls,2);
});
test('snapshot, safety backup, normal backup and staged parts preserve both feedback domains', async () => {
  assert.deepEqual(parseSnapshot({revision:1,state}).state,state);
  for (const raw of [JSON.stringify(makeBackup(state)),prepareSafetyBackup(state)])assert.deepEqual(parseBackup(raw).state,state);
  const analyzed=await analyzeBackup(JSON.stringify(makeBackup(state)));
  for(let i=0;i<analyzed.manifest.parts.length;i++)assert.deepEqual(parsePart(analyzed.parts[i],analyzed.manifest.parts[i]),JSON.parse(analyzed.parts[i]));
  const unchanged=JSON.stringify(session);const legacy=JSON.parse(legacyFeedbackDocument(unchanged,'session'));
  assert.equal(legacy.records[word.id].aiFeedback.structure,undefined);assert.equal(JSON.stringify(session),unchanged);
  assert.equal(JSON.parse(legacyFeedbackDocument(JSON.stringify(grammar.noun),'grammar')).feedback.structure,undefined);
});
test('staged restore and compatibility checks protect owned data against old clients', async () => {
  const sqlite=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')))sqlite.exec(readFileSync('drizzle/'+f,'utf8'));
  const db = {
    prepare(sql) { return { bind(...args) { return {
      sql, args,
      async first() { return sqlite.prepare(sql).get(...args) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...args) }; },
      async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; },
    }; } }; },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map(s => /^SELECT/.test(s.sql)
          ? { results: sqlite.prepare(s.sql).all(...s.args) }
          : { meta: { changes: Number(sqlite.prepare(s.sql).run(...s.args).changes) } });
        sqlite.exec('COMMIT'); return results;
      } catch(e) { sqlite.exec('ROLLBACK'); throw e; }
    },
  };
  try{
    sqlite.prepare('INSERT INTO learner_states VALUES (?,0,?,?)').run('owner',JSON.stringify(state.settings),now);
    const analyzed=await analyzeBackup(JSON.stringify(makeBackup(state)));let job=await jobs.createRestoreJob(db,'owner',0,analyzed.manifest);
    for(let i=0;i<analyzed.parts.length;i++)await jobs.uploadRestorePart(db,'owner',job.id,i,analyzed.parts[i]);
    while(job.status!=='ready')job=await jobs.validateRestoreJob(db,'owner',job.id);
    await assert.rejects(jobs.commitRestoreJob(db,'owner',job.id,2,false),e=>e.status===426);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM study_sessions').get().n,0);
    await jobs.commitRestoreJob(db,'owner',job.id,2,true);
    assert.deepEqual(JSON.parse(sqlite.prepare('SELECT document FROM study_sessions').get().document),session);
    assert.equal(await hasSavedStructuredFeedback(db,'other'),false);
    assert.equal(await hasSavedStructuredFeedback(db,'owner',[sid],[]),true);
    assert.equal(await hasSavedStructuredFeedback(db,'owner',[],['noun']),true);
    assert.equal(await hasSavedStructuredFeedback(db,'owner',[crypto.randomUUID()],[]),false);
    assert.equal((await jobs.commitRestoreJob(db,'owner',job.id,2,true)).revision,1);
  }finally{sqlite.close()}
});
