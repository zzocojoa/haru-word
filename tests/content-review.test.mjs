import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolveCardContent} from '../lib/content.ts';
const words=JSON.parse(readFileSync('data/words.json','utf8'));
const data=JSON.parse(readFileSync('data/content.json','utf8'));
const find=(word,pos)=>data[words.find(w=>w.word===word&&w.pos===pos).id];
test('all 3809 shipped entries have complete content and matching published records',()=>{
 const published=JSON.parse(readFileSync('public/sources/learning-data.json','utf8')).records;
 assert.equal(words.length,3809);assert.equal(new Set(words.map(w=>w.headword)).size,3000);
 assert.equal(Object.keys(data).length,words.length);assert.equal(published.length,words.length);
 const map=new Map(published.map(w=>[w.id,w]));
 for(const w of words){for(const field of ['meaning','expression','example','translation','source'])assert.ok(data[w.id][field]?.trim(),w.id+': '+field);assert.deepEqual(map.get(w.id),{...w,...data[w.id]});}
});
test('higher-level expressions include the missing objects and complete useful phrases',()=>{
 assert.equal(find('borrow','v.').expression,'borrow books from the library');
 assert.equal(find('avoid','v.').expression,'avoid drinks with sugar');
 assert.equal(find('concentrate','v.').expression,'concentrate on your work');
 assert.equal(find('concerned','adj.').expression,'concerned about his health');
});
test('train and work have complete expressions rather than clipped word windows',()=>{
 assert.equal(find('train','n.').expression,'miss the train');assert.equal(find('work','n.').expression,'a lot of work');
});
test('would invitation and fit health examples match their single learning senses',()=>{
 const would=find('would','modal v.');assert.match(would.meaning,/정중한 권유/);assert.equal(would.example,'Would you like some tea?');assert.equal(would.translation,'차를 좀 드시겠어요?');
 const fit=find('fit','adj.');assert.equal(fit.meaning,'건강한');assert.equal(fit.example,'I walk every day to keep fit.');assert.equal(fit.translation,'나는 건강을 유지하려고 매일 걷는다.');
 for(const c of [would,fit]){assert.equal(c.source,'학습용 작성 예문');assert.equal(c.attribution,undefined);assert.equal(c.url,undefined);}
});
test('all reviewed corrections are published and retained by the content build',()=>{
 const patches=JSON.parse(readFileSync('data/reviewed-content-overrides.json','utf8'));
 const published=JSON.parse(readFileSync('public/sources/learning-data.json','utf8')).records;
 assert.equal(published.length,3809);
 for(const [id,patch]of Object.entries(patches))for(const [key,value]of Object.entries(patch)){assert.equal(data[id][key],value);assert.equal(published.find(w=>w.id===id)[key],value);}
 assert.match(readFileSync('scripts/build-content.py','utf8'),/reviewed-content-overrides/);
});
test('A1 ending candidates left after review are valid particles, letters or a complete party size',()=>{
 const ending=/\b(?:a|an|the|of|to|for|with|in|on|at|by|from|my|your|his|her|their|our|two)$/i;
 const valid=new Set(['B comes after A','come in','turn on','a table for two','introduce him to her','you two','for me','help us','see him']);
 for(const w of words.filter(w=>w.level==='A1'))if(ending.test(data[w.id].expression))assert.ok(valid.has(data[w.id].expression),w.word+': '+data[w.id].expression);
});

test('A1 review ledger covers each A1 entry once and hashes the exact shipped revision',()=>{
 const ledger=JSON.parse(readFileSync('data/a1-content-review.json','utf8'));
 const entries=ledger.batches.flatMap(b=>b.entries);const a1=words.filter(w=>w.level==='A1');
 assert.equal(entries.length,1077);assert.equal(new Set(entries.map(e=>e.id)).size,1077);
 assert.deepEqual(new Set(entries.map(e=>e.id)),new Set(a1.map(w=>w.id)));
 const fields=['meaning','expression','example','translation','source','attribution','url'];
 for(const entry of entries){
  const hash=createHash('sha256').update(JSON.stringify(fields.map(k=>data[entry.id][k]??null))).digest('hex');
  assert.equal(entry.afterHash,hash,'reviewed content changed without updating evidence: '+entry.id);
  assert.match(entry.beforeHash,/^[a-f0-9]{64}$/);
  if(entry.status==='corrected'){assert.ok(entry.reason);assert.notEqual(entry.beforeHash,entry.afterHash);}
  else{assert.equal(entry.status,'kept');assert.equal(entry.beforeHash,entry.afterHash);}
 }
});

test('A1 noun, pronoun and single-sense corrections retain their reviewed examples',()=>{
 const checks=[['favorite','n.','my favorite'],['some','pron.','Please have some.'],['when','pron.','Since when'],['lesson','n.','English lesson'],['line','n.','straight line'],['play','v.','play in the park'],['word','n.','three new words']];
 for(const [word,pos,part]of checks){const c=find(word,pos);assert.ok(c.example.includes(part),word);assert.equal(c.source,'학습용 작성 예문');assert.equal(c.attribution,undefined);assert.equal(c.url,undefined);}
 assert.equal(find('yes','exclam.').meaning,'네; 그렇습니다');
 assert.equal(find('cook','v.').meaning,'요리하다');assert.equal(find('short','adj.').meaning,'키가 작은');
});

test('A2 review ledger covers all 990 entries and hashes the shipped revision',()=>{
 const ledger=JSON.parse(readFileSync('data/a2-content-review.json','utf8'));
 const entries=ledger.batches.flatMap(b=>b.entries),a2=words.filter(w=>w.level==='A2');
 assert.equal(entries.length,990);assert.equal(new Set(entries.map(e=>e.id)).size,990);
 assert.deepEqual(new Set(entries.map(e=>e.id)),new Set(a2.map(w=>w.id)));
 assert.equal(entries.filter(e=>e.status==='corrected').length,552);
 const fields=['meaning','expression','example','translation','source','attribution','url'];
 for(const entry of entries){
  const hash=createHash('sha256').update(JSON.stringify(fields.map(k=>data[entry.id][k]??null))).digest('hex');
  assert.equal(entry.afterHash,hash,'A2 revision changed without review evidence: '+entry.id);
  assert.match(entry.beforeHash,/^[a-f0-9]{64}$/);
  if(entry.status==='corrected'){assert.ok(entry.reason);assert.notEqual(entry.beforeHash,entry.afterHash);}
  else{assert.equal(entry.status,'kept');assert.equal(entry.beforeHash,entry.afterHash);}
 }
});

test('A2 examples align with selected meanings and separate POS uses',()=>{
 const a2=(word,pos)=>data[words.find(w=>w.level==='A2'&&w.word===word&&w.pos===pos).id];
 for(const [word,pos,meaning,part] of [
  ['hold','v.','잡다','hold my bag'],['pass','v.','건네주다','pass me the salt'],
  ['gas','n.','휘발유','Gas prices'],['side','n.','편 (지지하는 쪽)','on our side'],
  ['thin','adj.','얇은','paper is too thin'],['whose','pron.','누구의 것','Whose is this'],
  ['source','n.','출처','source of this information'],['wheel','n.','바퀴','front wheel']
 ]){const c=a2(word,pos);assert.equal(c.meaning,meaning,word);assert.ok(c.example.includes(part),word);}
 assert.equal(a2('cash','n.').translation,'이 가게는 현금만 받아요.');
 for(const word of ['double','downtown','least','less','percent']){
  const cards=words.filter(w=>w.level==='A2'&&w.word===word).map(w=>data[w.id]);
  assert.equal(new Set(cards.map(c=>c.example)).size,cards.length,word+' uses separate POS examples');
 }
});

test('A2 saved senses and user examples survive catalog sense changes',()=>{
 const gas=find('gas','n.');
 const old=resolveCardContent(gas,{meaning:'가스',en:'independent',notes:'기존 메모'});
 assert.equal(old.meaning,'가스');assert.equal(old.example,'');assert.equal(old.translation,'');
 const custom={meaning:'가스',expression:'natural gas',example:'We use gas for cooking.',translation:'우리는 요리에 가스를 써요.'};
 const saved=resolveCardContent(gas,custom);for(const [k,v] of Object.entries(custom))assert.equal(saved[k],v);
});

test('catalog corrections never combine a saved older meaning with another sense examples',()=>{
 const base=find('bar','n.');assert.equal(base.meaning,'술집');
 assert.deepEqual(resolveCardContent(base),base);
 const old=resolveCardContent(base,{meaning:'막대·덩어리',en:'independent'});
 assert.equal(old.meaning,'막대·덩어리');for(const key of ['expression','example','translation'])assert.equal(old[key],'');
 assert.match(old.source,/사전에서 확인/);assert.equal(old.attribution,undefined);assert.equal(old.url,undefined);
 const custom={meaning:'막대·덩어리',example:'This is a gold bar.',translation:'이것은 금괴예요.',expression:'a gold bar'};
 const saved=resolveCardContent(base,custom);for(const key of Object.keys(custom))assert.equal(saved[key],custom[key]);
 const same=resolveCardContent(base,{meaning:' 술집 ',notes:'내 메모'});assert.equal(same.example,base.example);
});
