import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
await build({entryPoints:['lib/grammar/content-v4.ts','lib/grammar/review.ts','lib/sentence-structure.ts'],outdir:'work/v4-unit',entryNames:'[name]',outExtension:{'.js':'.mjs'},bundle:true,format:'esm',platform:'node',logLevel:'silent'});
const v4 = await import('../work/v4-unit/content-v4.mjs');
const review = await import('../work/v4-unit/review.mjs');
const { sentenceStructureSchema, validSentenceStructure } = await import('../work/v4-unit/sentence-structure.mjs');
const ledger = JSON.parse(readFileSync('data/grammar-content-review.json','utf8'));
test('342 compared units cover every lesson, question, diagram, gloss and valid frame combination',async()=>{
 assert.equal(await review.grammarV4Reviewed(),true);
 const units=v4.grammarReviewUnits(),counts={};
 for(const unit of units){const kind=unit.id.split(':')[2];counts[kind]=(counts[kind]??0)+1;}
 assert.deepEqual(counts,{lesson:15,practice:15,notice:15,base:45,a:45,b:45,reading:30,gloss:43,example:30,frame:59});
 assert.equal(new Set(units.map(unit=>unit.id)).size,342);
 for(const source of Object.values(ledger.sources)){assert.equal(new URL(source.url).hostname,'dictionary.cambridge.org');assert.ok(source.summary);}
});
test('missing/pending/duplicate/stale content or metadata prevents activation',async()=>{
 for(const mutate of [l=>l.entries.pop(),l=>l.entries[0].status='pending',l=>l.entries[1].id=l.entries[0].id,l=>l.entries[0].sources=[],l=>l.entries[0].sources=['missing'],l=>l.entries[0].evidenceSummary='',l=>l.entries[0].reviewedOn='',l=>l.entries[0].contentHash='0'.repeat(64),l=>l.curriculumHash='0'.repeat(64),l=>l.sourceHash='0'.repeat(64),l=>l.sources.classes.summary='changed',l=>l.entries.find(e=>e.id.includes(':example:')).sources=['numbers']]){const l=structuredClone(ledger);mutate(l);assert.equal(await review.grammarV4Reviewed(l),false);}
 const changed=v4.grammarReviewUnits();changed[0].content.role='변경된 설명';assert.equal(await review.grammarV4Reviewed(ledger,changed),false);
});
test('fixed analyses cover authored sentences and preserve tense, referents and phrase boundaries',()=>{
 for(const examples of Object.values(v4.REVIEWED_EXAMPLES))for(const example of examples){assert.equal(sentenceStructureSchema.safeParse(example.structure).success,true,example.id);assert.equal(validSentenceStructure(example.structure,example.sentence),true,example.id);assert.ok(review.exampleReviewSources(example.id).length);}
 const arrive=v4.REVIEWED_EXAMPLES.preposition[1];assert.deepEqual(arrive.structure.parts.map(p=>p.role),['S','V','M']);assert.match(arrive.structure.parts[2].explanation,/직접목적어가 아니/);
 const past=v4.REVIEWED_EXAMPLES.verb[1];assert.match(past.structure.translation,/책이었/);assert.deepEqual(past.structure.parts.map(p=>p.role),['S','V','C']);
 const continuous=v4.REVIEWED_EXAMPLES.auxiliary[1];assert.deepEqual(continuous.structure.parts.map(p=>p.role),['S','V','M','V']);assert.match(continuous.structure.parts[3].explanation,/보어가 아니/);
 const command=v4.REVIEWED_EXAMPLES['definite-article'][1];assert.ok(command.structure.parts.every(p=>p.role!=='S'));assert.match(command.structure.note,/명령문/);
 assert.equal(v4.REVIEWED_EXAMPLES.adverb[1].structure.parts[2].text,'very cold.');
});
test('curation narrows claims and removes unsupported translation details only in v4',()=>{
 assert.match(v4.PRACTICE_LESSONS_V4.verb.reading[1].glosses[0].role,/3인칭 단수/);
 assert.match(v4.PRACTICE_LESSONS_V4.pronoun.reading[1].en,/carry/);assert.match(v4.PRACTICE_LESSONS_V4.pronoun.reading[1].ko,/나르는/);
 assert.doesNotMatch(v4.PRACTICE_LESSONS_V4.conjunction.reading[1].ko,/사야/);
 const frames=v4.grammarReviewUnits().filter(u=>u.id.startsWith('indefinite-article:4:frame:')).map(u=>u.content.sentence);
 assert.deepEqual(frames,['I have a bag.','I have an umbrella.','I have an orange.']);
});
