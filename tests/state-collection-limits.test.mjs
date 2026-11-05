import test from 'node:test';
import assert from 'node:assert/strict';
import {assertStateDataKeys} from '../lib/state-data-keys.ts';
import {assertBackupStructure} from '../lib/backup-structure.ts';
import {z} from 'zod';

test('DEP-ZOD: constrained arrays reject a small symbolic oversize length before parsing children',()=>{
 let reads=0;const value=new Proxy([],{get(target,key){if(key==='length')return 101;if(/^\d+$/.test(String(key))){reads++;throw Error('child parsed');}return Reflect.get(target,key);}});
 const result=z.array(z.string()).max(100).safeParse(value);
 assert.equal(result.success,false);assert.equal(result.error.issues[0].code,'too_big');assert.equal(reads,0);
});

test('DATA-1: invalid record arrays are rejected without enumerating or reading their entries',()=>{
 for(const part of ['progress','sessions','grammar']){
  let enumerations=0;
  const array=new Proxy([],{ownKeys(){enumerations++;throw Error('entry enumeration reached');}});
  assert.throws(()=>assertStateDataKeys({[part]:array}),/collection|record/i);
  assert.equal(enumerations,0);
 }
});

test('DATA-1: a symbolic oversize array length is rejected before materializing values; no large allocation',()=>{
 let enumerations=0;
 const array=new Proxy([],{get(target,key){if(key==='length')return 20001;return Reflect.get(target,key);},ownKeys(){enumerations++;throw Error('entry enumeration reached');}});
 assert.throws(()=>assertBackupStructure(array),/지원 범위|collection/i);assert.equal(enumerations,0);
});

test('DATA-1: schema-specific collection counts are checked before child values and reserved meaning keys survive',()=>{
 let valuesRead=0;const senses={};
 for(let i=0;i<101;i++)Object.defineProperty(senses,'meaning'+i,{enumerable:true,get(){valuesRead++;throw Error('unbounded child read');}});
 assert.throws(()=>assertStateDataKeys({progress:{synthetic:{senses}}}),/collection|지원 범위/i);assert.equal(valuesRead,0);
 const valid=JSON.parse('{"progress":{"synthetic":{"senses":{"__proto__":{"meaning":"__proto__"},"constructor":{"meaning":"constructor"}}}}}');
 assert.doesNotThrow(()=>assertStateDataKeys(valid));assert.throws(()=>assertStateDataKeys(JSON.parse('{"sessions":{"constructor":{}}}')),/Unsafe/);
 assert.doesNotThrow(()=>assertStateDataKeys({progress:{synthetic:{senses:[['__proto__',{meaning:'__proto__'}]]}}}));
});
