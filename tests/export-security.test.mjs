import test from 'node:test';
import assert from 'node:assert/strict';
import {EMPTY,emptyRecord,exportLog} from '../lib/learning.ts';

test('CSV neutralizes spreadsheet formulas behind whitespace and control characters',()=>{
 for(const text of ['=1+1','+1+1','-1+1','@SUM(1,1)','  =1+1','\t=1+1','\r=1+1','\n=1+1','\ufeff=1+1','\tplain text']){
  const state=structuredClone(EMPTY);const id='entry';const sid=crypto.randomUUID();
  state.sessions[sid]={id:sid,kind:'daily',date:'2026-09-22',createdAt:'2026-09-22T00:00:00Z',ids:[id],records:{[id]:{...emptyRecord('뜻'),notes:text}}};
  const csv=exportLog(state,[{id,word:'word',pos:'n.',level:'A1'}]);
  assert.ok(csv.includes('"\''+text+'"'),JSON.stringify(text));
  assert.equal(state.sessions[sid].records[id].notes,text,'escaping never changes stored input');
 }
});

test('CSV retains ordinary Korean, quotes and interior punctuation',()=>{
 const state=structuredClone(EMPTY),sid=crypto.randomUUID(),notes='나는 "@home" 표현을 배웠다.';
 state.sessions[sid]={id:sid,kind:'daily',date:'2026-09-22',createdAt:'2026-09-22T00:00:00Z',ids:['entry'],records:{entry:{...emptyRecord('뜻'),notes}}};
 assert.ok(exportLog(state,[]).includes('"나는 ""@home"" 표현을 배웠다."'));
});
