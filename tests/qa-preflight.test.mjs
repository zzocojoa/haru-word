import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {validateEnvironment,requireDisabledAiStatus}=createRequire(import.meta.url)('./qa/preflight.cjs');
test('QA preparation rejects hosted origins, wrong grammar profiles, live AI and absent full images',()=>{
  assert.throws(()=>validateEnvironment({QA_BASE_URL:'https://study.example'}),/loopback/);
  assert.throws(()=>validateEnvironment({QA_GRAMMAR_VERSION:'5'}),/must be/);
  assert.throws(()=>validateEnvironment({QA_NEW_GRAMMAR_VERSION:'2'}),/must be/);
  assert.throws(()=>validateEnvironment({QA_IMAGE_PILOT_MODE:'enabled'}),/ASSET_ROOT/);
  const dir=mkdtempSync(join(tmpdir(),'haru-preflight-')),file=join(dir,'worker.json');
  writeFileSync(file,JSON.stringify({vars:{ai_feedback_enabled:'true'}}));
  assert.throws(()=>validateEnvironment({QA_WORKER_CONFIG:file}),/disabled/);
  writeFileSync(file,JSON.stringify({vars:{ai_feedback_enabled:'false',grammar_practice_v4_enabled:'true'}}));
  assert.throws(()=>validateEnvironment({QA_WORKER_CONFIG:file,QA_GRAMMAR_VERSION:'2'}),/differs/);
  assert.equal(validateEnvironment({QA_WORKER_CONFIG:file,QA_GRAMMAR_VERSION:'4'}).origin,'http://127.0.0.1:8787');
  assert.throws(()=>validateEnvironment({QA_IMAGE_PILOT_MODE:'enabled',QA_WORD_IMAGE_ASSET_ROOT:dir}),/missing/);
});
test('QA runner checks real local AI status rather than trusting a declared profile',async()=>{
  for(const response of [Response.json({enabled:true}),Response.json({error:'unavailable'},{status:503}),Response.json({})]){
    await assert.rejects(requireDisabledAiStatus('http://127.0.0.1:8798',{},async()=>response),/disabled/);
  }
  await requireDisabledAiStatus('http://127.0.0.1:8798',{},async(url,options)=>{
    assert.equal(new URL(url).pathname,'/api/sentence-feedback');assert.equal(options.headers['X-Study-AI-Contract'],'4');
    return Response.json({enabled:false});
  });
});
