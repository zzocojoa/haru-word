import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

test('DEP-FASTURI: schema-utils and its Ajv resolver retain ordinary schema references without fetching',()=>{
 const {validate}=require('schema-utils');
 validate({type:'object',properties:{count:{type:'integer'}},required:['count'],additionalProperties:false},{count:2});
 assert.throws(()=>validate({type:'integer'},'synthetic'),/Invalid/);
 const Ajv=createRequire(require.resolve('schema-utils'))('ajv'),ajv=new Ajv();
 ajv.addSchema({$id:'https://synthetic.invalid/schemas/part.json',type:'object',required:['count'],properties:{count:{type:'integer'}}});
 const accepts=ajv.compile({$id:'https://synthetic.invalid/schemas/main.json',$ref:'./part.json'});
 assert.equal(accepts({count:2}),true);assert.equal(accepts({count:'synthetic'}),false);
});

test('DEP-MINIMATCH: typescript-estree resolves the patched named API with its existing dot-file matching policy',()=>{
 const consumer=createRequire(require.resolve('@typescript-eslint/typescript-estree'));
 const {minimatch}=consumer('minimatch');
 assert.equal(minimatch('src/.settings.ts','src/*.ts',{dot:true}),true);
 assert.equal(minimatch('src/settings.js','src/*.ts',{dot:true}),false);
 assert.equal(minimatch('other/settings.ts','src/*.ts',{dot:true}),false);
});
