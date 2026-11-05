import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, Response as LocalResponse } from 'miniflare';

// Exercise the real workerd fetch implementation. Every outbound request is
// intercepted locally: no API key, network egress, D1 or paid generation.
const { outputFiles } = await build({ stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
  import {generateOpenAiFeedback,generateStructuredOpenAiFeedback} from './lib/openai-feedback';
  export default {async fetch(request) {
    const url = new URL(request.url);
    const run = url.searchParams.has('structured') ? generateStructuredOpenAiFeedback : generateOpenAiFeedback;
    const modelId = url.searchParams.get('model') || 'gpt-6.1-sol';
    try {
      await run({apiKey:'SYNTHETIC_NEVER_REAL',modelId,allowedModels:modelId},
        {word:'book',pos:'n.',meaning:'책',sentence:'This is a book.'},'Synthetic transport check.');
      return Response.json({unexpectedSuccess:true});
    } catch(error) {return Response.json({code:error.code,status:error.status});}
  }};
` }, bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent' });

async function worker(t, outboundService) {
  const instance = new Miniflare({host: '127.0.0.1', port: 0, inspectorPort: 0,
    workers:[{config:{name:'transport-probe',compatibilityDate:'2026-05-22',
      manifest:{mainModule:'worker.mjs',modules:{'worker.mjs':{type:'esm',contents:outputFiles[0].text}}}},
      dev:{outboundService:{type:'fetcher',handler:outboundService}}}]});
  t.after(() => instance.dispose());
  return instance;
}

test('real Worker reaches a local OpenAI HTTP response for both contracts and all catalog models', async t => {
  const requests = [];
  const instance = await worker(t, request => {
    requests.push({url:request.url,method:request.method,authorization:request.headers.get('authorization')});
    return LocalResponse.json({error:{code:'invalid_api_key'}},{status:401});
  });
  for (const model of ['gpt-6.1-sol','gpt-6.1-terra','gpt-6-astra']) {
    for (const suffix of ['', '&structured=1']) {
      const response = await instance.dispatchFetch('http://local.test/?model='+model+suffix);
      assert.deepEqual(await response.json(),{code:'provider_key_invalid',status:503});
    }
  }
  assert.equal(requests.length,6);
  for (const request of requests) assert.deepEqual(request,{url:'https://api.openai.com/v1/responses',method:'POST',authorization:'Bearer SYNTHETIC_NEVER_REAL'});
});

test('real Worker rejects redirects without following or forwarding credentials to their target', async t => {
  const requests = [];
  let redirectStatus = 301;
  const instance = await worker(t, request => {
    requests.push(request.url);
    return new LocalResponse('PRIVATE_REDIRECT_BODY',{status:redirectStatus,headers:{Location:'https://never-follow.invalid/private'}});
  });
  for (const status of [301,302,303,307,308]) {
    redirectStatus = status;
    const response = await instance.dispatchFetch('http://local.test/');
    assert.deepEqual(await response.json(),{code:'provider_network',status:503});
  }
  assert.deepEqual(requests,Array(5).fill('https://api.openai.com/v1/responses'));
});
