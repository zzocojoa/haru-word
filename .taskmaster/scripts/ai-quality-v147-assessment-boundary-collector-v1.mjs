import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAssessmentBoundariesV1 } from './ai-quality-v147-assessment-boundaries-v1.mjs';
import { inspectAssessmentBoundaryContrastV1, prepareAssessmentBoundaryContrastV1 } from './ai-quality-v147-assessment-boundary-contrast-v1.mjs';
import { digest } from './ai-quality-v147-calibration.mjs';
import { durableEvaluationV3, evaluationBudgetContextV3, openEvaluationBudgetV3, prepareEvaluationBudgetV3 } from './ai-quality-v147-evaluation-budget-v3.mjs';
import { meaningContrastBudgetV1 } from './ai-quality-v147-meaning-contrast-v1.mjs';
import { parseTargetMeaningPayloadV2 } from './ai-quality-v147-target-meaning-v2.mjs';
import { parseV3Json } from './ai-quality-v147-wire-v3.mjs';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const protocol = 'ai-quality-v147-assessment-boundary-collector-v1';
const runId = '85f95b75-a68e-4658-bec5-d2852a31786c';
const profileFile = '.taskmaster/docs/ai-quality-v147-assessment-boundary-budget-profile-v1.json';
const reservation = 4283592n, allowance = 1260000n, slots = 36, windowSize = 3;
const rates = { 'gpt-6.1-sol': [2n, 10n, 10n], 'gpt-6.1-terra': [1n, 5n, 5n], 'gpt-6-astra': [10n, 50n, 100n] };
export const SYNTHETIC_KEY = 'synthetic-assessment-boundary-key';
const sha = value => createHash('sha256').update(value).digest('hex');
const hashFile = file => sha(readFileSync(file));
const read = file => parseV3Json(readFileSync(file, 'utf8'), 4194304);
const check = (condition, code) => { if (!condition) throw new Error('ABC1_' + code); };
const safe = error => /^(?:ABC1|AB1|TM2|TM1|EB3|W3|PF2|MC1)_[A-Z0-9_]+$/.test(error?.message ?? '') ? error.message : 'ABC1_LOCAL_OR_TRANSPORT_HELD';

function usageUpper(model, input, output, details) {
  const [inputRate, outputRate, readRate] = rates[model];
  const allInput = BigInt(input);
  let priced = 125n * inputRate * allInput;
  const ttl = details?.cache_write_tokens_details;
  check(!ttl || ttl.ttl_12h_tokens === 0, 'UNEXPECTED_CACHE_TTL');
  if (Number.isSafeInteger(details?.cached_tokens) && Number.isSafeInteger(details?.cache_write_tokens)) {
    const reads = BigInt(details.cached_tokens), writes = BigInt(details.cache_write_tokens);
    check(reads >= 0n && writes >= 0n && reads + writes <= allInput && (!ttl || ttl.ttl_30m_tokens === details.cache_write_tokens), 'CACHE_PARTITION');
    priced = 100n * inputRate * (allInput - reads - writes) + readRate * reads + 125n * inputRate * writes;
  }
  return (11n * (priced + 100n * outputRate * BigInt(output)) + 999n) / 1000n;
}

async function official({ kind, body, key }) {
  const suffix = kind === 'count' ? '/input_tokens' : '';
  const response = await fetch('https://api.openai.com/v1/responses' + suffix, { method: 'POST', body, redirect: 'error',
    signal: AbortSignal.timeout(120000), headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Accept: 'application/json' } });
  const reader = response.body?.getReader();
  check(reader, 'RESPONSE_BODY');
  const chunks = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 262144) { await reader.cancel(); throw new Error('ABC1_RESPONSE_SIZE'); }
    chunks.push(Buffer.from(value));
  }
  return { status: response.status, type: response.headers.get('content-type') ?? '', raw: Buffer.concat(chunks).toString('utf8') };
}

async function collect({ legacy = null, syntheticRoot = null, loadKey, transport }, live) {
  const fund = prepareEvaluationBudgetV3(source, legacy);
  const context = evaluationBudgetContextV3(fund, live ? 'evaluation' : 'synthetic', syntheticRoot);
  const evidence = resolve(fund.root, 'outputs/ai-quality-v147-implementation-20261106');
  const frozen = resolve(evidence, 'phase96/prepared.json');
  const proof = resolve(evidence, 'phase96/progress-final.json');
  const prices = resolve(evidence, 'phase97/official-price-check.json');
  check(hashFile(frozen) === '5b9ce2c36bebee568d93f1d794f5078161a9c5677153cd0fc6d24256a1aca349' &&
    hashFile(proof) === '91fe72d8f059fdac86ac2067ac8ad99d8507942d2d165d138da2e4546e758d3f' &&
    hashFile(prices) === 'bc51ea6541075b0668354f1242c697d9f87f06dcb5936a51990507bb1a5c58cf', 'FROZEN_INPUTS');
  const prepared = prepareAssessmentBoundaryContrastV1(evidence);
  check(prepared.hash === read(frozen).hash && prepared.upper.totalMicros === String(reservation), 'STUDY');
  const { requests, countCeiling, outputCeiling } = prepared.plan;
  check(requests.length === slots && countCeiling === 8000 && outputCeiling === 1024, 'SCOPE');
  for (const request of requests) {
    const body = parseV3Json(request.requestRaw);
    check(body.prompt_cache_options === undefined && body.prompt_cache_retention === undefined && body.input.length === 1 &&
      typeof body.input[0].content === 'string' && body.max_output_tokens === outputCeiling && body.store === false && body.service_tier === 'default', 'WIRE_CACHE_POLICY');
  }
  const profilePath = resolve(source, profileFile), profile = read(profilePath);
  check(profile.runId === runId && profile.studyPlanHash === prepared.hash && profile.collectorProtocol === protocol &&
    profile.expectedModelCalls === slots && profile.expectedCountCalls === slots && profile.reservationMicros === String(reservation) &&
    profile.countAllowanceMicros === String(allowance) && profile.defaultCacheTtl === '30m', 'PROFILE');
  const preparationFile = resolve(source, '.taskmaster/docs/ai-quality-v147-assessment-boundary-preparation-v1.json');
  const preparation = read(preparationFile);
  check(preparation.planHash === prepared.hash && hashFile(preparationFile) === read(proof).evidenceSha256['work/ai-quality-v147-20261106/.taskmaster/docs/ai-quality-v147-assessment-boundary-preparation-v1.json'], 'PREPARATION');
  const modules = Object.entries(preparation.moduleSha256).map(([file, hash]) => [resolve(source, file), hash]);
  const pins = [...[frozen, proof, prices, profilePath, preparationFile, fileURLToPath(import.meta.url)].map(file => [file, hashFile(file)]), ...modules];
  const collectorPlanHash = digest({ mode: context.mode, planHash: prepared.hash, pins });
  const runtime = live ? resolve(fund.root, 'outputs', profile.runtimeDirectoryName) : resolve(context.directory, 'runtime-' + runId);
  const session = openEvaluationBudgetV3({ prepared: fund, context });
  try {
    if (!existsSync(context.claimFile)) session.initialize();
    const before = session.current();
    check(before.reservedMicros === '0' && BigInt(before.availableMicros) >= reservation && !before.ledger.allocations.some(x => x.runId === runId), 'AVAILABLE');
    if (live) check(before.usedUpperMicros === '29064247' && before.availableMicros === '5935753', 'BALANCE');
    check(realpathSync(dirname(runtime)) === dirname(runtime) && !existsSync(runtime), 'RUN_ONCE');
    mkdirSync(runtime);
    const claim = { protocol, runId, collectorPlanHash, planHash: prepared.hash, automaticRetry: false, automaticResume: false };
    const claimFile = resolve(runtime, 'ONCE.json');
    durableEvaluationV3(claimFile, claim);
    const budgetProfile = live ? profilePath : resolve(context.directory, 'scope-input-' + runId + '.json');
    if (!live) durableEvaluationV3(budgetProfile, profile);
    const reserved = session.reserve({ profileFile: budgetProfile, collectorPlanHash, runtimeRoot: runtime });
    durableEvaluationV3(resolve(runtime, 'grant-reservation.json'), reserved);
    const verify = () => {
      check(digest(session.verify().ledger) === digest(reserved.ledger) && digest(read(claimFile)) === digest(claim), 'CLAIM_OR_BUDGET');
      for (const [file, hash] of pins) check(hashFile(file) === hash, 'SOURCE_CHANGED');
    };
    const receipts = [], records = [], payloadFailures = [], charged = new Map(), ids = new Set();
    let countAttempts = 0, modelAttempts = 0, keyReads = 0, failureCode = null, inspection = null, measured = null;
    let unexpectedExposure = false;
    const capture = async (kind, i, body, key) => {
      const prefix = resolve(runtime, kind + '-' + i);
      durableEvaluationV3(prefix + '-request.json', body);
      durableEvaluationV3(prefix + '-intent.json', { kind, index: i, requestSha256: sha(body), consumedBeforeTransport: true });
      if (kind === 'count') countAttempts++; else modelAttempts++;
      const { status, type, raw } = await transport({ kind, index: i, body, key });
      check(Number.isInteger(status) && typeof type === 'string' && typeof raw === 'string' && Buffer.byteLength(raw) <= 262144, 'TRANSPORT');
      const persisted = status === 200 && /^application\/json(?:\s*;|$)/i.test(type) && !raw.includes(key) && !type.includes(key);
      if (persisted) durableEvaluationV3(prefix + '-response.json', raw);
      durableEvaluationV3(prefix + '-capture.json', { kind, index: i, status, persisted, responseSha256: sha(raw) });
      check(persisted, 'RESPONSE_HELD');
      return parseV3Json(raw);
    };
    const windows = async callback => {
      for (let start = 0; start < slots; start += windowSize) {
        verify();
        const results = await Promise.allSettled(requests.slice(start, start + windowSize).map((r, index) => callback(r, start + index)));
        const failure = results.find(result => result.status === 'rejected');
        if (failure) throw failure.reason;
      }
    };
    try {
      verify();
      const key = await loadKey();
      keyReads++;
      check(typeof key === 'string' && key.length > 0 && (live || key === SYNTHETIC_KEY), 'KEY');
      await windows(async (r, i) => {
        const c = await capture('count', i, r.countRequestRaw, key);
        check(c.object === 'response.input_tokens' && Object.keys(c).length === 2 && Number.isSafeInteger(c.input_tokens) && c.input_tokens > 0, 'COUNT_SHAPE');
        const receipt = { key: r.key, inputTokens: c.input_tokens, requestSha256: r.requestSha256, countRequestSha256: r.countRequestSha256 };
        durableEvaluationV3(resolve(runtime, 'count-' + i + '-receipt.json'), receipt);
        receipts[i] = receipt;
        check(c.input_tokens <= countCeiling, 'COUNT_LIMIT');
      });
      measured = meaningContrastBudgetV1(prepared, receipts);
      const caps = requests.map((r, i) => usageUpper(r.model, Math.ceil(receipts[i].inputTokens * 5 / 4), outputCeiling));
      check(caps.reduce((sum, cap) => sum + cap, allowance) === BigInt(measured.totalMicros) && BigInt(measured.totalMicros) <= reservation, 'MEASURED_BUDGET');
      durableEvaluationV3(resolve(runtime, 'measured-budget.json'), measured);
      await windows(async (r, i) => {
        charged.set(i, caps[i]);
        const v = await capture('model', i, r.requestRaw, key);
        const u = v.usage;
        const usageBounded = v.model === r.model && v.service_tier === 'default' && Number.isSafeInteger(u?.input_tokens) && u.input_tokens > 0 &&
          u.input_tokens <= Math.ceil(receipts[i].inputTokens * 5 / 4) && Number.isSafeInteger(u.output_tokens) && u.output_tokens >= 0 &&
          u.output_tokens <= outputCeiling && u.total_tokens === u.input_tokens + u.output_tokens;
        const ttl = u?.input_tokens_details?.cache_write_tokens_details;
        if (!usageBounded || (ttl && ttl.ttl_12h_tokens !== 0)) unexpectedExposure = true;
        check(usageBounded, 'USAGE');
        const actual = usageUpper(r.model, u.input_tokens, u.output_tokens, u.input_tokens_details);
        if (actual > caps[i]) unexpectedExposure = true;
        check(actual <= caps[i], 'SLOT_COST');
        charged.set(i, actual);
        check(v.status === 'completed' && /^resp_[A-Za-z0-9_-]{1,150}$/.test(v.id) && !ids.has(v.id) && Array.isArray(v.output), 'MODEL_STATUS');
        ids.add(v.id);
        const texts = v.output.flatMap(x => x.type === 'message' && Array.isArray(x.content) ? x.content.filter(c => c.type === 'output_text').map(c => c.text) : []);
        check(v.output.every(x => ['reasoning', 'message'].includes(x.type)) && texts.length === 1 && typeof texts[0] === 'string', 'MODEL_OUTPUT');
        records[i] = { key: r.key, requestRaw: r.requestRaw, payloadRaw: texts[0], providerResponseId: v.id };
        try {
          if (r.version === 8) parseAssessmentBoundariesV1({ ...records[i], baseRequestRaw: r.baseRequestRaw });
          else parseTargetMeaningPayloadV2(records[i]);
        } catch (error) { payloadFailures.push({ index: i, code: safe(error) }); }
      });
      check(payloadFailures.length === 0, 'PAYLOAD_CONFLICT');
      inspection = inspectAssessmentBoundaryContrastV1(prepared, records);
    } catch (error) { failureCode = safe(error); }
    const used = unexpectedExposure ? reservation : [...charged.values()].reduce((sum, cost) => sum + cost, allowance);
    check(used <= reservation, 'ACCOUNTING_CAP');
    const result = { protocol, planHash: prepared.hash, collectorPlanHash, status: failureCode ? 'held' : profile.successStatus, failureCode,
      clientModelAttempts: modelAttempts, clientCountAttempts: countAttempts, actualProviderCalls: live ? modelAttempts : 0,
      actualCountApiCalls: live ? countAttempts : 0, actualKeyReads: live ? keyReads : 0, records: records.filter(Boolean), receipts: receipts.filter(Boolean),
      measured, inspection, payloadFailures, unexpectedExposure, chargedUpperMicros: Object.fromEntries([...charged].map(([i, cost]) => [i, String(cost)])),
      stageUsedUpperMicros: String(used), countAllowanceRetainedMicros: String(allowance), defaultCacheTtl: '30m',
      automaticRetry: false, automaticResume: false, sourceQualified: false, mainDispatchAuthorized: false };
    const terminal = resolve(runtime, 'terminal.json');
    durableEvaluationV3(terminal, result);
    durableEvaluationV3(resolve(runtime, 'grant-settlement.json'), session.settle({ runId, runtimeTerminalFile: terminal, usedUpperMicros: String(used), held: !!failureCode }));
    return result;
  } finally { session.release(); }
}

export const runSyntheticAssessmentBoundaryV1 = options => collect(options, false);
export function runAuthorizedAssessmentBoundaryV1({ loadKey }) {
  check(process.version === 'v24.22.1', 'LIVE_RUNTIME');
  return collect({ loadKey, transport: official }, true);
}
