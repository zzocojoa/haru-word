import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {parseProviderFeedback, FeedbackValidationError} from '../lib/provider-feedback-contract.ts';
import fixture from './fixtures/sentence-structure.cjs';
const {feedback,original}=fixture;
const content={meaningUsage:feedback.meaningUsage,grammar:feedback.grammar,correctedSentence:feedback.correctedSentence,explanation:feedback.explanation,structure:feedback.structure};
await build({entryPoints:['lib/gemini-feedback.ts','lib/groq-feedback.ts'],outdir:'work/validation-stage-tests',bundle:true,format:'esm',platform:'node',outExtension:{'.js':'.mjs'},logLevel:'silent'});
const google=await import('../work/validation-stage-tests/gemini-feedback.mjs'),groq=await import('../work/validation-stage-tests/groq-feedback.mjs');
const cases=[
 [null,'content_type'],[JSON.stringify(content).padEnd(30001,' '),'content_limit'],['PRIVATE_NOT_JSON','json_syntax'],
 [JSON.stringify({...content,grammar:'PRIVATE_BAD_ENUM'}),'fields'],
 [JSON.stringify({...content,structure:{...content.structure,parts:content.structure.parts.map((p,i)=>i? p:{...p,explanation:'가'.repeat(141)})}}),'fields'],
 [JSON.stringify({...content,structure:{...content.structure,parts:content.structure.parts.slice(0,-1)}}),'structure'],
 [JSON.stringify({...content,structure:{...content.structure,parts:[...content.structure.parts].reverse()}}),'structure'],
 [JSON.stringify({...content,structure:{...content.structure,parts:[{text:'PRIVATE_INVENTED_WORD',role:'S',explanation:'주어'}]}}),'structure'],
];
test('unchanged strict acceptance distinguishes malformed fields and exact text coverage without leaking text',()=>{
 assert.deepEqual(parseProviderFeedback(JSON.stringify(content),original,feedback.model).structure,content.structure);
 for(const [value,stage] of cases)assert.throws(()=>parseProviderFeedback(value,original,feedback.model),e=>e instanceof FeedbackValidationError&&e.stage===stage&&!/PRIVATE/.test(e.message+JSON.stringify(e)));
 const ambiguous={...content,correctedSentence:'',meaningUsage:'uncertain',grammar:'uncertain',structure:{status:'unavailable',translation:'',parts:[],note:'완성된 문장이 필요해요.'}};
 assert.equal(parseProviderFeedback(JSON.stringify(ambiguous),original,feedback.model).structure.status,'unavailable');
 assert.throws(()=>parseProviderFeedback(JSON.stringify({...ambiguous,structure:{...ambiguous.structure,note:''}}),original,feedback.model),e=>e.stage==='structure');
});
test('both transports keep their existing error contract and expose only safe diagnostic stages',async()=>{
 for(const [value,stage] of cases){
  await assert.rejects(google.generateTutorFeedback('test-only',{sentence:original},'trusted',async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:value}]}}]})),e=>e.code==='provider_invalid_response'&&e.validationStage===(value===null?'json_syntax':stage)&&!JSON.stringify(e).includes('PRIVATE'));
  await assert.rejects(groq.generateGroqFeedback('test-only',{sentence:original},'trusted',async()=>Response.json({model:feedback.model==='openai/gpt-oss-120b'?feedback.model:'openai/gpt-oss-120b',choices:[{finish_reason:'stop',message:{content:value}}]})),e=>e.code==='groq_invalid_response'&&e.validationStage===stage&&!JSON.stringify(e).includes('PRIVATE'));
 }
 await assert.rejects(groq.generateGroqFeedback('test-only',{sentence:original},'trusted',async()=>Response.json({model:'PRIVATE_WRONG_MODEL',choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]})),e=>e.validationStage==='model'&&!JSON.stringify(e).includes('PRIVATE'));
 await assert.rejects(google.generateTutorFeedback('test-only',{sentence:original},'trusted',async()=>new Response('PRIVATE_ENVELOPE')),e=>e.validationStage==='envelope'&&!JSON.stringify(e).includes('PRIVATE'));
});
