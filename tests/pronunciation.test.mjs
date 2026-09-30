import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {build} from 'esbuild';
mkdirSync('work/tests',{recursive:true});
await build({entryPoints:['lib/pronunciation.ts'],outfile:'work/tests/pronunciation.mjs',bundle:true,platform:'node',format:'esm'});
const {PRONUNCIATION_GUIDE,pronunciationFor,familyMeaningNote}=await import('../work/tests/pronunciation.mjs');
const words=JSON.parse(readFileSync('data/words.json','utf8'));
const content=JSON.parse(readFileSync('data/content.json','utf8'));
test('reviewed US pronunciation matches catalog identity and exact selected sense',()=>{
 assert.equal(Object.keys(PRONUNCIATION_GUIDE).length,35);
 assert.equal(new Set(Object.values(PRONUNCIATION_GUIDE).map(x=>x.word)).size,16);
 for(const [id,guide]of Object.entries(PRONUNCIATION_GUIDE)){
  const word=words.find(x=>x.id===id);assert.ok(word);
  assert.equal(guide.meaning,content[id].meaning);assert.equal(guide.pos,word.pos);
  assert.match(guide.url,/^https:\/\/dictionary\.cambridge\.org\/us\/(pronunciation|dictionary)\/english\/[a-z]+$/);
  assert.equal(guide.reviewedAt,'2026-09-30');assert.ok(guide.variants.length);
  for(const variant of guide.variants){assert.match(variant.ipa,/^\/.+\/$/);assert.ok(variant.usage);}
  assert.equal(pronunciationFor(word,' '+guide.meaning+' ').kind,'reviewed');
  assert.equal(pronunciationFor(word,'別の意味').kind,'dictionary');
  assert.equal(pronunciationFor({...word,personal:true},guide.meaning).kind,'dictionary');
  assert.equal(pronunciationFor({...word,id:'personal-word'},guide.meaning).kind,'dictionary');
 }
});
test('same spelling has appropriate POS/sense pronunciation; supported variants remain visible',()=>{
 const guide=(word,pos)=>PRONUNCIATION_GUIDE[words.find(w=>w.word===word&&w.pos===pos).id];
 assert.deepEqual(guide('close','v.').variants.map(x=>x.ipa),['/kloʊz/']);
 assert.deepEqual(guide('close','adj.').variants.map(x=>x.ipa),['/kloʊs/']);
 assert.deepEqual(guide('read','v.').variants.map(x=>x.ipa),['/riːd/','/red/']);
 assert.equal(guide('transfer','v.').variants.length,2);
 assert.equal(PRONUNCIATION_GUIDE['1d57180ec583b7df'].variants[0].ipa,'/tɪr/');
 assert.equal(PRONUNCIATION_GUIDE['648df715279cd53b'].variants.length,2);
 assert.equal(pronunciationFor({...words[0],word:'Close',personal:true},'닫다').kind,'dictionary');
 assert.equal(pronunciationFor(words[0],content[words[0].id].meaning).kind,'device');
 assert.ok(familyMeaningNote('brother'));assert.ok(familyMeaningNote('sister'));assert.equal(familyMeaningNote('teacher'),undefined);
});
test('authored family translations never introduce an unexpressed relative age',()=>{
 let matches=0;
 for(const card of Object.values(content)){
  if(!/\b(brother|sister)\b/.test(card.example)||!/(남동생|여동생|언니|오빠)/.test(card.translation))continue;
  assert.match(card.example,/\b(younger|older) (brother|sister)\b/,card.example);
  matches++;
 }
 assert.ok(matches>=19);
 for(const id of ['c3ebf9da783ee7dd','8380ffd0a911c786','ae5fbe65659ef923']){
  assert.equal(content[id].source,'학습용 작성 예문');assert.equal(content[id].attribution,undefined);assert.equal(content[id].url,undefined);
 }
 assert.match(content.ae5fbe65659ef923.example,/Please close the window/);
});
