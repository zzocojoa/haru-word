import test from 'node:test';import assert from 'node:assert/strict';
import {sessionCounts} from '../lib/learning-display.ts';
import {emptyRecord} from '../lib/learning.ts';
const record=(patch={})=>({...emptyRecord('뜻'),...patch});
test('recorded errors, independent success and unmeasured remain distinct without mutation',()=>{
 const s={kind:'daily',ids:['success','help','skip','missing'],records:{success:record({en:'independent',ko:'independent',sentenceStatus:'written'}),help:record({en:'independent',ko:'help',sentenceStatus:'improve'}),skip:record({en:'independent',ko:'independent'})}};
 const before=structuredClone(s);assert.deepEqual(sessionCounts(s),{total:4,recorded:2,successful:1,needsHelp:1,unmeasured:2});assert.deepEqual(s,before);
});
test('monthly optional sentences and directional practice use the existing completion contract',()=>{
 const s={kind:'monthly',ids:['a','b'],records:{a:record({ko:'independent'}),b:record({ko:'help'})}};
 assert.deepEqual(sessionCounts(s),{total:2,recorded:2,successful:1,needsHelp:1,unmeasured:0});
 assert.equal(sessionCounts({...s,kind:'practice',practiceMode:'ko'}).successful,1);
 assert.equal(sessionCounts({...s,kind:'practice',practiceMode:'sentence'}).recorded,0);
});
