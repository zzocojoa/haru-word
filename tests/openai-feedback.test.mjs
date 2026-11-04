import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { build } from 'esbuild';
import { feedback as legacy } from './fixtures/sentence-structure.cjs';
mkdirSync('work/openai-feedback-tests', { recursive: true });
await build({ entryPoints: ['lib/openai-feedback.ts'], outfile: 'work/openai-feedback-tests/adapter.mjs', bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const { generateStructuredOpenAiFeedback: generateOpenAiFeedback, openAiHttpError, OPENAI_RESPONSE_BYTES, OPENAI_FEEDBACK_TIMEOUT_MS } = await import('../work/openai-feedback-tests/adapter.mjs');
const config = { apiKey: 'SYNTHETIC_KEY_NEVER_REAL', modelId: 'gpt-6.1-sol', allowedModels: 'gpt-6.1-sol,gpt-6.1-terra,gpt-6-astra' };
const input = { sentence: legacy.original, word: 'trip', pos: 'n.', meaning: '여행' };
const { original: _original, model: _model, createdAt: _createdAt, ...content } = legacy;
void _original; void _model; void _createdAt;
const envelope = (text = JSON.stringify(content), model = config.modelId) => ({ status: 'completed', model,
  output: [{ type: 'reasoning', summary: [{ type: 'summary_text', text: 'PRIVATE_REASONING' }] },
    { type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text }] }],
  usage: { input_tokens: 128, output_tokens: 512, output_tokens_details: { reasoning_tokens: 100 } },
});
const run = (fetcher, settings = config) => generateOpenAiFeedback(settings, input, 'Trusted server prompt. ', fetcher);
const issue = (code, stage) => error => error.code === code && (stage === undefined || error.validationStage === stage)
  && !JSON.stringify({ message: error.message, issue: error.issue }).includes('PRIVATE');

test('all catalog models use exact Responses strict JSON, no storage, tools, retries or account input', async t => {
  t.mock.method(console, 'info', () => {});
  assert.equal(OPENAI_FEEDBACK_TIMEOUT_MS, 28_000);
  for (const id of config.allowedModels.split(',')) {
    let calls = 0;
    const result = await run(async (url, init) => {
      calls++; assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(init.redirect, 'manual');
      assert.equal(init.headers.Authorization, 'Bearer ' + config.apiKey);
      const body = JSON.parse(init.body);
      assert.equal(body.model, id); assert.equal(body.store, false); assert.equal(body.stream, false);
      assert.equal(body.max_output_tokens, 4096); assert.equal(body.service_tier, 'default');
      assert.deepEqual(body.reasoning, { effort: 'low' });
      assert.equal(body.text.format.type, 'json_schema'); assert.equal(body.text.format.strict, true);
      assert.equal(body.text.format.schema.additionalProperties, false);
      assert.ok(body.text.format.schema.required.includes('structure'));
      assert.deepEqual(JSON.parse(body.input[0].content), input);
      assert.ok(body.instructions.startsWith('Trusted server prompt. '));
      for (const key of ['tools', 'temperature', 'top_p', 'user', 'safety_identifier', 'conversation', 'previous_response_id', 'metadata']) assert.equal(key in body, false);
      assert.equal(init.signal.aborted, false);
      return Response.json(envelope(undefined, id));
    }, { ...config, modelId: id });
    assert.equal(calls, 1); assert.equal(result.provider, 'openai'); assert.equal(result.requestedModel, id); assert.equal(result.model, id);
    assert.equal(result.original, input.sentence); assert.equal(result.promptVersion, 'reference-v1'); assert.equal(result.validationVersion, 'structured-v1');
    assert.deepEqual(result.structure, content.structure); assert.ok(Number.isFinite(Date.parse(result.createdAt)));
  }
});

test('unknown/inactive models, missing key and pre-cancelled requests never call the provider', async () => {
  let calls = 0; const fetcher = async () => { calls++; return Response.json(envelope()); };
  for (const settings of [{ ...config, modelId: 'gpt-6.1-sol-extra' }, { ...config, allowedModels: '' }, { ...config, allowedModels: 'gpt-6-astra' }]) await assert.rejects(run(fetcher, settings), issue('model_unavailable'));
  await assert.rejects(run(fetcher, { ...config, apiKey: '' }), issue('not_configured'));
  const signal = AbortSignal.abort(new DOMException('Stopped', 'AbortError'));
  await assert.rejects(run(fetcher, { ...config, signal }), e => e === signal.reason);
  assert.equal(calls, 0);
});

test('refusal and incomplete status never become saved feedback even with valid-looking text', async () => {
  for (const [body, code] of [
    [{ ...envelope(), output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'refusal', refusal: 'PRIVATE_REFUSAL' }] }] }, 'provider_blocked'],
    [{ ...envelope(), status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }, 'provider_truncated'],
    [{ ...envelope(), status: 'incomplete', incomplete_details: { reason: 'content_filter' } }, 'provider_blocked'],
    [{ ...envelope(), status: 'incomplete', incomplete_details: { reason: 'PRIVATE_UNKNOWN' } }, 'provider_incomplete'],
    [{ ...envelope(), status: 'failed', error: { message: 'PRIVATE_ERROR' } }, 'provider_unavailable'],
    ...['in_progress', 'queued', 'cancelled'].map(status => [{ ...envelope(), status }, 'provider_incomplete']),
  ]) {
    let calls = 0; await assert.rejects(run(async () => { calls++; return Response.json(body); }), issue(code)); assert.equal(calls, 1);
  }
});

test('only assistant output_text is accepted; SDK helper, tool items, malformed envelope and model mismatch fail safely', async () => {
  const values = [
    [null, 'envelope'], [[], 'envelope'], [{ output_text: JSON.stringify(content), model: config.modelId }, 'envelope'],
    [{ ...envelope(), model: 'gpt-6.1-sol-unrecognized' }, 'model'],
    [{ ...envelope(), output: [{ type: 'function_call', arguments: 'PRIVATE' }, ...envelope().output] }, 'envelope'],
    [{ ...envelope(), output: [envelope().output[0]] }, 'envelope'],
    [{ ...envelope(), output: [envelope().output[1], envelope().output[1]] }, 'envelope'],
    [{ ...envelope(), output: [{ ...envelope().output[1], role: 'user' }] }, 'envelope'],
    [{ ...envelope(), output: [{ ...envelope().output[1], status: 'incomplete' }] }, 'envelope'],
    [{ ...envelope(), output: [{ ...envelope().output[1], content: [{ type: 'output_text', text: 1 }] }] }, 'content_type'],
    [envelope('PRIVATE_INVALID_JSON'), 'json_syntax'],
  ];
  for (const [value, stage] of values) await assert.rejects(run(async () => Response.json(value)), issue('provider_invalid_response', stage));
  await assert.rejects(run(async () => new Response('PRIVATE_INVALID_JSON', { headers: { 'Content-Type': 'application/json' } })), issue('provider_invalid_response', 'envelope'));
});

test('field, mandatory hidden structure, judgment and exact correction coverage are validated', async () => {
  const missing = { ...content }; delete missing.structure;
  for (const [value, stage] of [
    [missing, 'fields'], [{ ...content, extra: 'PRIVATE' }, 'fields'], [{ ...content, explanation: 'x'.repeat(1501) }, 'fields'],
    [{ ...content, grammar: 'natural' }, 'judgment'], [{ ...content, grammar: 'uncertain' }, 'judgment'],
    [{ ...content, structure: { ...content.structure, parts: content.structure.parts.slice(1) } }, 'structure'],
  ]) await assert.rejects(run(async () => Response.json(envelope(JSON.stringify(value)))), issue('provider_invalid_response', stage));
});

test('envelope bytes and text characters enforce both exact boundaries and dishonest Content-Length', async t => {
  t.mock.method(console, 'info', () => {});
  const body = { ...envelope(), padding: '' }; body.padding = ' '.repeat(OPENAI_RESPONSE_BYTES - Buffer.byteLength(JSON.stringify(body)));
  assert.equal(Buffer.byteLength(JSON.stringify(body)), OPENAI_RESPONSE_BYTES);
  await run(async () => Response.json(body));
  for (const header of [undefined, '1']) await assert.rejects(run(async () => new Response(JSON.stringify({ ...body, padding: body.padding + 'x' }), { headers: { 'Content-Type': 'application/json', ...(header ? { 'Content-Length': header } : {}) } })), issue('provider_invalid_response', 'content_limit'));
  let cancelled = false;
  const huge = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(1)); }, cancel() { cancelled = true; } });
  await assert.rejects(run(async () => new Response(huge, { headers: { 'Content-Type': 'application/json', 'Content-Length': String(OPENAI_RESPONSE_BYTES + 1) } })), issue('provider_invalid_response', 'content_limit'));
  assert.equal(cancelled, true);
  const text = JSON.stringify(content); const limitText = text + ' '.repeat(30000 - text.length);
  await run(async () => Response.json(envelope(limitText)));
  await assert.rejects(run(async () => Response.json(envelope(limitText + ' '))), issue('provider_invalid_response', 'content_limit'));
});

test('content type, invalid UTF-8 and absent body are rejected without leaking data', async () => {
  await assert.rejects(run(async () => new Response('PRIVATE_HTML', { headers: { 'Content-Type': 'text/html' } })), issue('provider_invalid_response', 'content_type'));
  await assert.rejects(run(async () => new Response(new Uint8Array([255]), { headers: { 'Content-Type': 'application/json' } })), issue('provider_invalid_response', 'content_type'));
  await assert.rejects(run(async () => new Response(null, { headers: { 'Content-Type': 'application/json' } })), issue('provider_invalid_response', 'envelope'));
});

test('HTTP status and whitelisted evidence distinguish account limits without inferring daily/minute quotas', async () => {
  for (const [status, code] of [[400, 'provider_request'], [401, 'provider_key_invalid'], [402, 'provider_billing'], [403, 'provider_permission'], [404, 'provider_model'], [408, 'provider_timeout'], [413, 'provider_request'], [422, 'provider_request'], [429, 'provider_limit'], [500, 'provider_unavailable'], [503, 'provider_unavailable'], [504, 'provider_timeout']]) {
    let calls = 0;
    await assert.rejects(run(async () => { calls++; return Response.json({ error: { message: 'PRIVATE_CREDENTIAL_AND_SENTENCE' } }, { status, headers: { 'Retry-After': '1.5' } }); }), e => issue(code)(e) && e.issue.providerStatus === status && e.issue.retryAfterSeconds === 2);
    assert.equal(calls, 1);
  }
  for (const code of ['credit_balance_exhausted', 'organization_spend_limit_exceeded', 'project_spend_limit_exceeded', 'insufficient_quota']) assert.equal(openAiHttpError(429, { error: { code } }, null).code, 'provider_billing');
  assert.equal(openAiHttpError(429, { error: { code: 'organization_usage_limit_exceeded' } }, null).code, 'provider_account_limit');
  for (const code of ['slow_down', 'rate_limit_exceeded', 'PRIVATE_UNKNOWN']) assert.equal(openAiHttpError(429, { error: { code, type: 'insufficient_quota', message: 'daily PRIVATE' } }, 'not-a-delay').code, 'provider_limit');
  assert.equal(openAiHttpError(429, {}, '604801').issue.retryAfterSeconds, undefined);
});

test('header and streaming body deadlines cancel once and never retry or change models', async t => {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  t.mock.method(AbortSignal, 'timeout', () => timeout(5));
  let calls = 0;
  await assert.rejects(run(async (_url, { signal }) => {
    calls++;
    return new Promise((resolve, reject) => { const timer = setTimeout(() => resolve(Response.json(envelope())), 50); signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true }); });
  }), issue('provider_timeout'));
  assert.equal(calls, 1);
  let cancelled = false, timer;
  await assert.rejects(run(async () => {
    calls++;
    return new Response(new ReadableStream({ start(c) { timer = setTimeout(() => { c.enqueue(new TextEncoder().encode(JSON.stringify(envelope()))); c.close(); }, 50); }, cancel() { cancelled = true; clearTimeout(timer); } }), { headers: { 'Content-Type': 'application/json' } });
  }), issue('provider_timeout'));
  assert.equal(calls, 2); assert.equal(cancelled, true);
});

test('external cancellation of body and network failure preserve safe outcomes without additional calls', async () => {
  const controller = new AbortController(); let calls = 0, cancelled = false;
  const reason = new DOMException('Stopped', 'AbortError');
  await assert.rejects(run(async () => {
    calls++; return new Response(new ReadableStream({ start() { setTimeout(() => controller.abort(reason), 1); }, cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'application/json' } });
  }, { ...config, signal: controller.signal }), e => e === reason);
  assert.equal(calls, 1); assert.equal(cancelled, true);
  await assert.rejects(run(async () => { calls++; throw new TypeError('PRIVATE_NETWORK'); }), issue('provider_network'));
  await assert.rejects(run(async () => { calls++; throw new Error('PRIVATE_NETWORK'); }), issue('provider_network'));
  assert.equal(calls, 3);
});

test('observations include only bounded model/version/timing/token/request metadata', async t => {
  const logs = []; t.mock.method(console, 'info', line => logs.push(JSON.parse(line)));
  const body = { ...envelope(), PRIVATE_UNUSED: input.sentence };
  await run(async () => Response.json(body, { headers: { 'x-request-id': 'req_safe_example' } }));
  assert.equal(logs[0].requestId, 'req_safe_example'); assert.equal(logs[0].inputTokens, 128); assert.equal(logs[0].reasoningTokens, 100);
  assert.deepEqual(Object.keys(logs[0]).sort(), ['durationMs', 'event', 'inputTokens', 'model', 'outputTokens', 'promptVersion', 'provider', 'reasoningTokens', 'requestId', 'requestedModel', 'validationVersion'].sort());
  await run(async () => Response.json({ ...envelope(), usage: { input_tokens: 'PRIVATE', output_tokens: -1 } }, { headers: { 'x-request-id': 'PRIVATE_HEADER' } }));
  assert.equal(logs[1].requestId, undefined); assert.equal(logs[1].inputTokens, undefined);
  const raw = JSON.stringify(logs); for (const privateText of ['PRIVATE', input.sentence, config.apiKey]) assert.equal(raw.includes(privateText), false);
});

test('local post-response TypeErrors are envelope failures, while fetch and body-read failures retain a network classification',async()=>{
 let calls=0,locked;
 await assert.rejects(run(async()=>{calls++;const response=Response.json(envelope());locked=response.body.getReader();return response;}),issue('provider_invalid_response','envelope'));locked.releaseLock();
 await assert.rejects(run(async()=>{calls++;const response=Response.json(envelope());Object.defineProperty(response,'headers',{get(){throw new TypeError('PRIVATE_LOCAL_ERROR');}});return response;}),issue('provider_invalid_response','envelope'));
 await assert.rejects(run(async()=>{calls++;return new Response(new ReadableStream({start(c){c.error(new TypeError('PRIVATE_BODY_READ'));}}),{headers:{'Content-Type':'application/json'}});}),issue('provider_network','envelope'));
 await assert.rejects(run(async()=>{calls++;throw new TypeError('PRIVATE_FETCH_ERROR');}),issue('provider_network'));
 assert.equal(calls,4);
});
