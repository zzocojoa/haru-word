import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
await build({ entryPoints: ['lib/provider-feedback-error.ts', 'lib/feedback-issue.ts', 'lib/client-feedback-error.ts', 'lib/client-request.ts', 'lib/gemini-feedback.ts'], outdir: 'work/feedback-issue-tests', bundle: true, splitting: true, format: 'esm', platform: 'node', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const { providerHttpError, providerFinishError } = await import('../work/feedback-issue-tests/provider-feedback-error.mjs');
const { parseFeedbackIssue, feedbackErrorBody, issueFromResponse, FeedbackIssueError } = await import('../work/feedback-issue-tests/feedback-issue.mjs');
const { clientFeedbackIssue } = await import('../work/feedback-issue-tests/client-feedback-error.mjs');
const { RequestTimeoutError, InvalidResponseError } = await import('../work/feedback-issue-tests/client-request.mjs');
const { generateSentenceFeedback } = await import('../work/feedback-issue-tests/gemini-feedback.mjs');
const detail = (type, values) => ({ '@type': 'type.googleapis.com/google.rpc.' + type, ...values });
const body = (...details) => ({ error: { message: 'PRIVATE_KEY_SENTENCE', details } });

test('only structured quota evidence distinguishes minute and daily limits; delay stays bounded', () => {
  for (const [quotaId, code] of [['GenerateRequestsPerMinutePerProject', 'provider_minute_limit'], ['GenerateRequestsPerDayPerProject', 'provider_daily_limit'], ['unknown', 'provider_limit']]) {
    const error = providerHttpError(429, body(detail('QuotaFailure', { violations: [{ quotaId }] }), detail('RetryInfo', { retryDelay: '12.3s' })), '20');
    assert.equal(error.code, code); assert.equal(error.status, 429);
    assert.deepEqual(error.issue, { code, providerStatus: 429, retryAfterSeconds: 20 });
    assert.doesNotMatch(JSON.stringify(feedbackErrorBody(error.code, error.issue)), /PRIVATE|GenerateRequests|quotaId/);
  }
  const generic = providerHttpError(429, { error: { message: 'Daily quota exceeded but no structured evidence' } }, null);
  assert.equal(generic.code, 'provider_limit');
  for (const retry of ['-1', '999999999', 'tomorrow', 'Infinity', '0']) assert.equal(providerHttpError(429, {}, retry).issue.retryAfterSeconds, undefined);
  const daily = providerHttpError(429, body(detail('QuotaFailure', { violations: [{ quotaMetric: 'requests_per_day' }, { quotaId: 'TokensPerMinute' }] })), null);
  assert.equal(daily.code, 'provider_daily_limit');
});
test('provider status and authentication details map to safe, distinct reasons', () => {
  for (const [status, code] of [[400,'provider_request'], [401,'provider_key_invalid'], [403,'provider_permission'], [404,'provider_model'], [500,'provider_unavailable'], [503,'provider_unavailable'], [504,'provider_timeout']]) {
    const error = providerHttpError(status, body(), null);
    assert.equal(error.code, code); assert.doesNotMatch(error.message, /PRIVATE/);
  }
  assert.equal(providerHttpError(400, body(detail('ErrorInfo', { reason: 'API_KEY_INVALID', metadata: { key: 'PRIVATE' } })), null).code, 'provider_key_invalid');
  assert.equal(providerHttpError(400, { error: { status: 'FAILED_PRECONDITION' } }, null).code, 'provider_precondition');
  assert.equal(providerHttpError(403, { error: { message: 'Your API key was reported as leaked. Please use another API key.' } }, null).code, 'provider_key_blocked');
  assert.equal(providerHttpError(403, { error: { message: 'Unspecified key issue' } }, null).code, 'provider_permission');
});
test('finish reasons distinguish content rejection, output truncation, unsupported language and unknown results', () => {
  for (const [reason, code] of [['SAFETY','provider_blocked'], ['BLOCKLIST','provider_blocked'], ['MAX_TOKENS','provider_truncated'], ['RECITATION','provider_recitation'], ['LANGUAGE','provider_language'], ['OTHER','provider_incomplete'], [undefined,'provider_incomplete']]) assert.equal(providerFinishError(reason)?.code, code);
  assert.equal(providerFinishError(undefined, 'SAFETY').code, 'provider_blocked');
  assert.equal(providerFinishError(undefined, 'OTHER').code, 'provider_incomplete');
  assert.equal(providerFinishError('STOP'), undefined);
  assert.equal(providerFinishError('STOP', 'BLOCK_REASON_UNSPECIFIED'), undefined);
});
test('error metadata is allowlisted and raw messages never become UI descriptions', () => {
  assert.deepEqual(parseFeedbackIssue({ code: 'provider_limit', error: 'PRIVATE', providerStatus: 429, retryAfterSeconds: 13, details: ['PRIVATE'] }), { code: 'provider_limit', providerStatus: 429, retryAfterSeconds: 13 });
  assert.deepEqual(parseFeedbackIssue({ code: 'unknown', providerStatus: 999, retryAfterSeconds: -1 }), { code: 'unknown' });
  for (const code of ['constructor', '__proto__', 'untrusted', 123]) assert.equal(parseFeedbackIssue({ code }), undefined);
  assert.equal(issueFromResponse({ code: 'untrusted', error: 'PRIVATE' }, 429).code, 'request_limited');
  assert.equal(issueFromResponse(null, 503).code, 'site_error');
  assert.equal(issueFromResponse({}, 409).code, 'stale_input');
  assert.equal(issueFromResponse({}, 401).code, 'login_required');
});
test('client failures distinguish deadline, network, parsing and unknown errors without leaking exception text', () => {
  for (const [error, code] of [[new RequestTimeoutError(),'client_timeout'], [new TypeError('PRIVATE'),'client_network'], [new SyntaxError('PRIVATE'),'invalid_response'], [new InvalidResponseError(),'invalid_response'], [new Error('PRIVATE'),'unknown'], [new FeedbackIssueError({ code:'save_required' }),'save_required']]) assert.deepEqual(clientFeedbackIssue(error), { code });
});
test('provider transport distinguishes aborted deadline from connection failure, including body reads', async () => {
  const input = { word: 'arrive', pos: 'v.', meaning: '도착하다', sentence: 'I arrive home.' };
  await assert.rejects(generateSentenceFeedback('synthetic', input, async () => { throw new TypeError('PRIVATE'); }), e => e.code === 'provider_network');
  const originalTimeout = AbortSignal.timeout;
  try {
    AbortSignal.timeout = () => AbortSignal.abort(new DOMException('Synthetic deadline', 'TimeoutError'));
    await assert.rejects(generateSentenceFeedback('synthetic', input, async (_url, init) => { throw init.signal.reason; }), e => e.code === 'provider_timeout');
    await assert.rejects(generateSentenceFeedback('synthetic', input, async () => ({ ok: true, status: 200, json: async () => { throw new TypeError('PRIVATE'); } })), e => e.code === 'provider_timeout');
  } finally { AbortSignal.timeout = originalTimeout; }
  await assert.rejects(generateSentenceFeedback('synthetic', input, async () => ({ ok: true, status: 200, json: async () => { throw new TypeError('PRIVATE'); } })), e => e.code === 'provider_network');
  await assert.rejects(generateSentenceFeedback('synthetic', input, async () => new Response('malformed')), e => e.code === 'provider_invalid_response');
  await assert.rejects(generateSentenceFeedback('synthetic', input, async () => Response.json({ promptFeedback: { blockReason: 'SAFETY' } })), e => e.code === 'provider_blocked');
});
