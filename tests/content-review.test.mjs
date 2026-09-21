import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
 const valid=new Set(['B comes after A','come in','turn on','a table for two','introduce him to her','you two']);
 for(const w of words.filter(w=>w.level==='A1'))if(ending.test(data[w.id].expression))assert.ok(valid.has(data[w.id].expression),w.word+': '+data[w.id].expression);
});
