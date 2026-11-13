import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { observedCacheModelUpperV1 } from './ai-quality-v147-cache-reconciliation-v1.mjs';
import { digest } from './ai-quality-v147-calibration.mjs';
import { durableEvaluationV3, evaluationBudgetContextV3, openEvaluationBudgetV3, prepareEvaluationBudgetV3 } from './ai-quality-v147-evaluation-budget-v3.mjs';
import { inspectReferenceSupplementV1, prepareReferenceSupplementV1, quoteReferenceSupplementV1 } from './ai-quality-v147-reference-supplement-v1.mjs';
import { parseV3Json } from './ai-quality-v147-wire-v3.mjs';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const protocol = 'ai-quality-v147-reference-supplement-collector-v1';
const profileFile = '.taskmaster/docs/ai-quality-v147-reference-supplement-budget-profile-v1.json';
const runId = '5a174341-9d55-4987-9dbf-dc5bd265fd5c';
const reservation = 2308192n, allowance = 840000n, calls = 24;
export const SYNTHETIC_KEY = 'synthetic-reference-supplement-key';
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const check = (condition, code) => { if (!condition) throw new Error('RSC1_' + code); };
const safe = error => /^(?:RSC1|RS1|EB3|W3|PF2)_[A-Z0-9_]+$/.test(error?.message ?? '') ? error.message : 'RSC1_LOCAL_OR_TRANSPORT_HELD';

async function send({ kind, body, key }) {
  const response = await fetch('https://api.openai.com/v1/responses' + (kind === 'count' ? '/input_tokens' : ''), {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(180000), body,
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Accept: 'application/json' },
  });
  const reader = response.body?.getReader();
  check(reader, 'MISSING_BODY');
  let size = 0;
  const chunks = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 262144) { await reader.cancel(); throw new Error('RSC1_RESPONSE_SIZE'); }
    chunks.push(Buffer.from(value));
  }
  return { status: response.status, type: response.headers.get('content-type') ?? '', raw: Buffer.concat(chunks).toString('utf8') };
}

async function collect({ legacy = null, syntheticRoot = null, loadKey, transport }, live) {
  const fund = prepareEvaluationBudgetV3(source, legacy);
  const context = evaluationBudgetContextV3(fund, live ? 'evaluation' : 'synthetic', syntheticRoot);
  const root = fund.root;
  const frozen = resolve(root, 'outputs/ai-quality-v147-implementation-20261106/phase109/prepared.json');
  check(sha(readFileSync(frozen)) === 'b94d9e90fc1c7836cf91a3144a507ab3ee77f1a3ffcbc8435820db44f7ec15b2', 'FROZEN_PLAN');
  const prices = resolve(root, 'outputs/ai-quality-v147-implementation-20261106/phase103/official-price-check.json');
  check(sha(readFileSync(prices)) === '3e746c93f4b975862083494941daeccc566f44d65e85d16b81a0a9cb0aaf902c', 'PRICE');
  const prepared = prepareReferenceSupplementV1(root);
  check(prepared.hash === read(frozen).hash, 'PLAN');
  for (const request of prepared.plan.requests) {
    const wire = parseV3Json(request.requestRaw);
    check(wire.prompt_cache_options === undefined && wire.prompt_cache_retention === undefined &&
      wire.input.length === 1 && typeof wire.input[0].content === 'string', 'CACHE_POLICY');
  }
  const path = resolve(source, profileFile), profileBytes = readFileSync(path);
  const profile = JSON.parse(profileBytes);
  check(profile.runId === runId && profile.studyPlanHash === prepared.hash && profile.collectorProtocol === protocol &&
    profile.expectedModelCalls === calls && profile.expectedCountCalls === calls && profile.reservationMicros === String(reservation) &&
    profile.countAllowanceMicros === String(allowance) && profile.inputCeiling === prepared.plan.inputCeiling && profile.outputCeiling === prepared.plan.outputCeiling, 'PROFILE');
  const pins = [frozen, prices, path, fileURLToPath(import.meta.url), resolve(source, '.taskmaster/scripts/ai-quality-v147-reference-supplement-v1.mjs')]
    .map(file => [file, sha(readFileSync(file))]);
  const collectorPlanHash = digest({ mode: context.mode, planHash: prepared.hash, profileSha256: sha(profileBytes), pins });
  const runtime = live ? resolve(root, 'outputs', profile.runtimeDirectoryName) : resolve(context.directory, 'runtime-' + runId);
  const session = openEvaluationBudgetV3({ prepared: fund, context });
  try {
    if (!existsSync(context.claimFile)) session.initialize();
    const initial = session.current();
    check(initial.reservedMicros === '0' && !initial.ledger.allocations.some(x => x.runId === runId) && BigInt(initial.availableMicros) >= reservation, 'AVAILABLE');
    if (live) check(initial.availableMicros === '3039780' && initial.usedUpperMicros === '31960220', 'BALANCE_CHANGED');
    check(realpathSync(dirname(runtime)) === dirname(runtime) && !existsSync(runtime), 'RUN_ONCE');
    mkdirSync(runtime);
    const seal = { protocol, runId, collectorPlanHash, scopeHash: prepared.hash, automaticRetry: false, automaticResume: false };
    const once = resolve(runtime, 'ONCE.json');
    durableEvaluationV3(once, seal);
    const budgetProfile = live ? path : resolve(context.directory, 'scope-input-' + runId + '.json');
    if (!live) durableEvaluationV3(budgetProfile, profileBytes.toString('utf8'));
    const reserved = session.reserve({ profileFile: budgetProfile, collectorPlanHash, runtimeRoot: runtime });
    durableEvaluationV3(resolve(runtime, 'grant-reservation.json'), reserved);
    let keyReads = 0, countAttempts = 0, modelAttempts = 0, failureCode = null, inspection = null, measured = null;
    const receipts = [], records = [], providerIds = new Set();
    let observedUpper = 0n, cacheDetailsComplete = true;
    const locked = context.ledgerFiles.map(file => sha(readFileSync(file)));
    const lease = sha(readFileSync(context.leaseFile));
    const verify = () => {
      check(sha(readFileSync(context.leaseFile)) === lease &&
        context.ledgerFiles.every((file, index) => sha(readFileSync(file)) === locked[index]), 'RESERVATION_CHANGED');
      check(digest(read(once)) === digest(seal), 'CLAIM_CHANGED');
      for (const [file, hash] of pins) check(sha(readFileSync(file)) === hash, 'SOURCE_CHANGED');
    };
    const capture = async (kind, index, body, key) => {
      const prefix = resolve(runtime, kind + '-' + index);
      durableEvaluationV3(prefix + '-request.json', body);
      durableEvaluationV3(prefix + '-intent.json', { kind, index, requestSha256: sha(body), consumedBeforeTransport: true });
      if (kind === 'count') countAttempts++; else modelAttempts++;
      const { status, type, raw } = await transport({ kind, index, body, key });
      check(typeof raw === 'string' && typeof type === 'string' && Number.isInteger(status), 'TRANSPORT_SHAPE');
      const persisted = status === 200 && /^application\/json(?:\s*;|$)/i.test(type) && !raw.includes(key) && !type.includes(key) && Buffer.byteLength(raw) <= 262144;
      if (persisted) durableEvaluationV3(prefix + '-response.json', raw);
      durableEvaluationV3(prefix + '-capture.json', { kind, index, status, persisted, responseSha256: sha(raw) });
      check(persisted, 'RESPONSE_HELD');
      return parseV3Json(raw);
    };
    const inWaves = async action => {
      for (let start = 0; start < calls; start += 6) {
        verify();
        const results = await Promise.allSettled(prepared.plan.requests.slice(start, start + 6).map((request, i) => action(request, start + i)));
        const failed = results.find(result => result.status === 'rejected');
        if (failed) throw failed.reason;
      }
    };
    try {
      verify();
      const key = await loadKey();
      keyReads++;
      check(typeof key === 'string' && key.length > 0 && (live || key === SYNTHETIC_KEY), 'KEY');
      await inWaves(async (request, i) => {
        const c = await capture('count', i, request.countRequestRaw, key);
        check(c.object === 'response.input_tokens' && Object.keys(c).length === 2 && Number.isInteger(c.input_tokens) && c.input_tokens > 0, 'COUNT_SHAPE');
        const receipt = { key: request.key, requestSha256: request.requestSha256, countRequestSha256: request.countRequestSha256, inputTokens: c.input_tokens };
        receipts[i] = receipt;
        durableEvaluationV3(resolve(runtime, 'count-' + i + '-receipt.json'), receipt);
        check(c.input_tokens <= profile.inputCeiling, 'COUNT_LIMIT');
      });
      measured = quoteReferenceSupplementV1(prepared, receipts);
      check(BigInt(measured.reserveMicros) <= reservation, 'PRICE_LIMIT');
      durableEvaluationV3(resolve(runtime, 'measured-budget.json'), measured);
      await inWaves(async (request, i) => {
        const v = await capture('model', i, request.requestRaw, key), u = v.usage;
        check(v.status === 'completed' && v.model === request.model && v.service_tier === 'default' && /^resp_[\w-]{1,150}$/.test(v.id) &&
          !providerIds.has(v.id) && Number.isInteger(u?.input_tokens) && u.input_tokens > 0 && u.input_tokens <= Math.ceil(receipts[i].inputTokens * 5 / 4) &&
          Number.isInteger(u.output_tokens) && u.output_tokens >= 0 && u.output_tokens <= profile.outputCeiling && u.total_tokens === u.input_tokens + u.output_tokens, 'USAGE_OR_STATUS');
        providerIds.add(v.id);
        check(Array.isArray(v.output) && v.output.every(o => ['message', 'reasoning'].includes(o.type)), 'OUTPUT');
        const texts = v.output.flatMap(o => o.type === 'message' && Array.isArray(o.content) ? o.content.filter(t => t.type === 'output_text').map(t => t.text) : []);
        check(texts.length === 1 && typeof texts[0] === 'string', 'OUTPUT_TEXT');
        records[i] = { key: request.key, requestRaw: request.requestRaw, payloadRaw: texts[0], providerResponseId: v.id };
        const cache = u.input_tokens_details;
        const ttl = cache?.cache_write_tokens_details;
        check(!ttl || ttl.ttl_12h_tokens === 0, 'UNEXPECTED_CACHE_TTL');
        try {
          observedUpper += observedCacheModelUpperV1({ ...v, usage: { ...u, input_tokens_details: {
            ...cache, cache_write_tokens_details: ttl ?? { ttl_30m_tokens: cache?.cache_write_tokens, ttl_12h_tokens: 0 },
          } } });
        } catch { cacheDetailsComplete = false; }
      });
      verify();
      inspection = inspectReferenceSupplementV1(prepared, records);
    } catch (error) { failureCode = safe(error); }
    const actualCap = observedUpper + allowance;
    const used = modelAttempts === 0 ? allowance : !failureCode && cacheDetailsComplete && actualCap <= reservation ? actualCap : reservation;
    const terminal = { protocol, planHash: prepared.hash, collectorPlanHash, status: failureCode ? 'held' : profile.successStatus, failureCode,
      clientCountAttempts: countAttempts, clientModelAttempts: modelAttempts, actualCountApiCalls: live ? countAttempts : 0,
      actualProviderCalls: live ? modelAttempts : 0, actualKeyReads: live ? keyReads : 0, receipts: receipts.filter(Boolean), records: records.filter(Boolean), inspection, measured,
      stageUsedUpperMicros: String(used), countAllowanceRetainedMicros: String(allowance), cacheDetailsComplete,
      accountingModelUpperMicros: String(used - allowance), observedCacheUpperMicros: cacheDetailsComplete ? String(observedUpper) : null,
      automaticRetry: false, automaticResume: false, sourceQualified: false, mainDispatchAuthorized: false };
    const terminalFile = resolve(runtime, 'terminal.json');
    durableEvaluationV3(terminalFile, terminal);
    const final = session.settle({ runId, runtimeTerminalFile: terminalFile, usedUpperMicros: String(used), held: !!failureCode });
    durableEvaluationV3(resolve(runtime, 'grant-settlement.json'), final);
    return terminal;
  } finally { session.release(); }
}

export const runSyntheticReferenceSupplementV1 = options => collect(options, false);
export function runAuthorizedReferenceSupplementV1({ loadKey }) {
  check(process.version === 'v24.22.1', 'LIVE_RUNTIME');
  return collect({ loadKey, transport: send }, true);
}
