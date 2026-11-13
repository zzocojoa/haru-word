// Reusable bounded grouped collector. Frozen v1 execution and receipts remain immutable.
import { createHash } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { durableEvaluationV3 as save } from './ai-quality-v147-evaluation-budget-v3.mjs';
import { parseGroupedProductReviewV1, quoteGroupedProductReviewV1, validateGroupedProductReviewRequestV1 } from './ai-quality-v147-grouped-product-review-v1.mjs';
import { quoteBilingualReferencesV1 } from './ai-quality-v147-bilingual-reference-v1.mjs';
import { parseV3Json } from './ai-quality-v147-wire-v3.mjs';
import { inspectResponseCredentialsV1 } from './ai-quality-v147-response-credential-guard-v1.mjs';
export const GROUPED_REVIEW_EXECUTOR_V3 = 'ai-quality-v147-grouped-review-executor-v3';
const sha = raw => createHash('sha256').update(raw).digest('hex');
const check = (ok,code) => { if (!ok) throw Error('GRV3_' + code); };
const safe = error => /^(?:GRV3|GPR1|BPR1|PF2|W3)_[A-Z0-9_]+$/.test(error?.message ?? '') ? error.message : 'GRV3_LOCAL_OR_TRANSPORT_HELD';

export async function collectGroupedReviewsV3({ plan, directory, loadKey, transport, mode = 'synthetic', binding = {}, limits, onProgress = () => {}, testFault = () => {} }) {
  check(['synthetic', 'evaluation'].includes(mode), 'MODE');
  check(limits && Number.isSafeInteger(limits.requests) && limits.requests > 0 && limits.requests <= 180
    && Number.isSafeInteger(limits.judgments) && limits.judgments > 0 && Number.isSafeInteger(limits.maximumInputTokens)
    && limits.maximumInputTokens > 0 && limits.maximumInputTokens <= 50000 && /^[0-9]+$/.test(limits.maximumMicros), 'LIMITS');
  const maximum = BigInt(limits.maximumMicros), allowance = BigInt(limits.requests) * 35000n;
  check(maximum >= allowance && maximum <= 35000000n, 'CAP');
  if (mode === 'evaluation') check(/^[a-f0-9]{64}$/.test(binding.planHash) && /^[a-f0-9]{64}$/.test(binding.collectorPlanHash), 'SCOPE_BINDING');
  check(plan.requests.length === limits.requests && new Set(plan.requests.map(r => r.key)).size === limits.requests && plan.logicalSlots === limits.judgments
    && plan.requests.reduce((n,r) => n + r.itemCount, 0) === limits.judgments, 'FIXED_SCOPE');
  for (const r of plan.requests) validateGroupedProductReviewRequestV1(r);
  check(realpathSync(directory) === directory && lstatSync(directory).isDirectory(), 'DIRECTORY');
  save(resolve(directory, 'ONCE.json'), { protocol: GROUPED_REVIEW_EXECUTOR_V3, requests: plan.requests.map(r => r.requestSha256), automaticRetry: false });
  let countCalls = 0, modelCalls = 0, keyReads = 0, failureCode = null, observed = 0n, measured = null, key;
  const receipts = [], records = [], grades = [], ids = new Set();
  async function capture(kind, index, requestRaw) {
    save(resolve(directory, `${kind}-${index}-request.json`), requestRaw);
    save(resolve(directory, `${kind}-${index}-intent.json`), { consumedBeforeTransport: true, requestSha256: sha(requestRaw) });
    if (kind === 'count') countCalls++; else modelCalls++;
    await testFault('after-consume', kind, index);
    const response = await transport({ kind, body: requestRaw, key });
    check(typeof response.raw === 'string' && Buffer.byteLength(response.raw) <= 262144, 'RESPONSE_BYTES');
    const credential = inspectResponseCredentialsV1(response.raw, key);
    if (credential.blocked) {
      save(resolve(directory, `${kind}-${index}-capture.json`), { status: response.status,
        secretEcho: credential.reason !== 'unparseable-json', guardReason: credential.reason,
        ...credential.metadata, rawPersisted: false });
      throw Error(credential.reason === 'unparseable-json' ? 'GRV3_RESPONSE_JSON' : 'GRV3_SECRET_ECHO');
    }
    save(resolve(directory, `${kind}-${index}-response.json`), response.raw);
    save(resolve(directory, `${kind}-${index}-capture.json`), { status: response.status, persisted: true, responseSha256: sha(response.raw),
      ...credential.metadata, embeddedCredentialMarkerIgnored: credential.embeddedMarkerIgnored });
    check(response.status === 200 && /^application\/json(?:;|$)/i.test(response.type), 'HTTP');
    return parseV3Json(response.raw, 262144);
  }
  try {
    keyReads++; key = await loadKey(); check(typeof key === 'string' && key.length >= 16, 'KEY');
    for (let i = 0; i < plan.requests.length; i++) {
      const r = plan.requests[i], c = await capture('count', i, r.countRequestRaw);
      check(Object.keys(c).sort().join('|') === 'input_tokens|object' && c.object === 'response.input_tokens'
        && Number.isSafeInteger(c.input_tokens) && c.input_tokens > 0 && c.input_tokens <= limits.maximumInputTokens, 'COUNT_SHAPE_OR_LIMIT');
      receipts.push({ key: r.key, countRequestSha256: r.countRequestSha256, inputTokens: c.input_tokens, provenance: 'api-count' });
      onProgress({ kind: 'count', completed: receipts.length, total: limits.requests });
    }
    measured = quoteGroupedProductReviewV1(plan, receipts);
    check(BigInt(measured.totalMicros) <= maximum, 'MEASURED_CAP');
    save(resolve(directory, 'measured-budget.json'), measured);
    for (let i = 0; i < plan.requests.length; i++) {
      const r = plan.requests[i], response = await capture('model', i, r.requestRaw), u = response.usage;
      check(response.status === 'completed' && response.model === r.model && response.service_tier === 'default'
        && typeof response.id === 'string' && !ids.has(response.id), 'MODEL_IDENTITY'); ids.add(response.id);
      check(u && Number.isSafeInteger(u.input_tokens) && u.input_tokens > 0 && u.input_tokens <= Math.ceil(receipts[i].inputTokens * 1.25)
        && Number.isSafeInteger(u.output_tokens) && u.output_tokens >= 0 && u.output_tokens <= r.outputTokenMax
        && u.total_tokens === u.input_tokens + u.output_tokens, 'USAGE');
      observed += quoteBilingualReferencesV1(r.model, u.input_tokens, u.output_tokens);
      check(observed + allowance <= BigInt(measured.totalMicros), 'OBSERVED_CAP');
      const texts = response.output?.flatMap(m => m.type === 'message' ? (m.content ?? []).filter(c => c.type === 'output_text').map(c => c.text) : []) ?? [];
      check(texts.length === 1, 'OUTPUT');
      const parsed = parseGroupedProductReviewV1(r, texts[0]);
      records.push({ key: r.key, requestSha256: r.requestSha256, providerResponseId: response.id,
        inputTokens: u.input_tokens, outputTokens: u.output_tokens, payloadRaw: texts[0] }); grades.push(...parsed);
      onProgress({ kind: 'model', completed: records.length, total: limits.requests });
    }
  } catch (error) { failureCode = safe(error); }
  key = null;
  const combined = failureCode ? modelCalls ? maximum : allowance : observed + allowance;
  const terminal = { protocol: GROUPED_REVIEW_EXECUTOR_V3, ...binding, mode, limits, status: failureCode ? 'held' : 'collected-grouped-product-review', failureCode,
    automaticRetry: false, automaticResume: false, clientCountAttempts: countCalls, clientModelAttempts: modelCalls,
    actualCountCalls: mode === 'evaluation' ? countCalls : 0, actualProviderCalls: mode === 'evaluation' ? modelCalls : 0,
    actualKeyReads: mode === 'evaluation' ? keyReads : 0, receipts, records, grades,
    stageUsedUpperMicros: String(combined), countAllowanceRetainedMicros: String(allowance),
    combinedUsedUpperMicros: String(combined), combinedCountAllowanceRetainedMicros: String(allowance),
    restrictedUsedUpperMicros: String(combined), restrictedUnusedMicros: String(maximum - combined),
    logicalJudgments: grades.length, formalPilotGenerations: 0, formalPilotReviews: 0,
    referencesQualified: 0, groupedEquivalenceEstablished: false, mainDispatchAuthorized: false, englishTruthCertified: false };
  save(resolve(directory, 'terminal.json'), terminal); return terminal;
}

