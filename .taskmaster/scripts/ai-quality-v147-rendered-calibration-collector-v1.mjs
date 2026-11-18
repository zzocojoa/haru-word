import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from './ai-quality-v147-calibration.mjs';
import { observedCacheModelUpperV1 } from './ai-quality-v147-cache-reconciliation-v1.mjs';
import { durableEvaluationV3, evaluationBudgetContextV3, openEvaluationBudgetV3, prepareEvaluationBudgetV3 } from './ai-quality-v147-evaluation-budget-v3.mjs';
import { quoteMainCalibrationV8 } from './ai-quality-v147-main-panel-v8.mjs';
import { inspectRenderedCalibrationV1, prepareRenderedCalibrationV1 } from './ai-quality-v147-rendered-calibration-v1.mjs';
import { readClosedDayCalibrationFundingV1 } from './ai-quality-v147-closed-day-calibration-funding-v1.mjs';
import { parseV3Json } from './ai-quality-v147-wire-v3.mjs';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const root = resolve(source, '../..');
const evidence = resolve(root, 'outputs/ai-quality-v147-implementation-20261106');
const protocol = 'ai-quality-v147-rendered-calibration-collector-v1';
const admissionHash = '778e872a20b302fd92a5ca82346559d005485ac5101233da4a318b1de48c2e30';
const proofHash = '5c8245e87ef987ee3ad55a9a9e8bc74520593bf51ea4930c96b058991b2f5cd0';
const liveClaimHash = 'eb4dab8ba1044c64b5e4d5e67cb71ffe5205dd5a2956e0f762ef923853d21993';
const runtimeName = 'ai-quality-v147-rendered-calibration-runtime-20261109';
const marker = '20261108-count-provision-rendered-calibration-consumption.json';
const limit = 72;
const width = 6;
const bytesLimit = 262144;
export const SYNTHETIC_KEY = 'synthetic-rendered-calibration-key';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (condition, code) => { if (!condition) throw new Error('RCC1_' + code); };
const safe = error => /^(?:RCC1|RC1|MC1|EB3|W3|PF2|CF1)_[A-Z0-9_]+$/.test(error?.message ?? '') ? error.message : 'RCC1_LOCAL_OR_TRANSPORT_HELD';

function plain(file) {
  const stat = lstatSync(file);
  check(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && realpathSync(file) === file, 'FILE_SCOPE');
  return readFileSync(file);
}
function bound(file, hash) {
  const raw = plain(file);
  check(sha(raw) === hash, 'EVIDENCE');
  return JSON.parse(raw);
}

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
    if (size > bytesLimit) { await reader.cancel(); throw new Error('RCC1_RESPONSE_SIZE'); }
    chunks.push(Buffer.from(value));
  }
  return { status: response.status, type: response.headers.get('content-type') ?? '', raw: Buffer.concat(chunks).toString('utf8') };
}

async function collect({ syntheticDirectory = null, loadKey, transport }) {
  const live = syntheticDirectory === null;
  const funding = readClosedDayCalibrationFundingV1({ syntheticDirectory });
  const budget = funding.funding.plan;
  const frozen = resolve(evidence, 'phase104/prepared.json');
  const prepared = prepareRenderedCalibrationV1(root);
  check(bound(frozen, budget.preparedSha256).hash === prepared.hash && prepared.hash === budget.studyPlanHash &&
    prepared.plan.requests.length === limit && budget.standardModelRequests === limit && budget.countRequests === limit, 'PLAN');
  const admissionFile = resolve(evidence, 'phase107/admission.json');
  const admission = bound(admissionFile, admissionHash);
  check(admission.studyPlanHash === prepared.hash && admission.admitted === 12 && admission.publicCalibrationOnly &&
    !admission.mainDispatchAuthorized && !admission.englishTruthCertified &&
    admission.rows.every(row => row.admittedForPublicCalibration &&
      row.screenHash === prepared.plan.sourceBindings.find(x => x.caseId === row.caseId)?.screenHash), 'ADMISSION');
  check(sha(plain(resolve(root, admission.document))) === admission.documentSha256, 'ADMISSION_DOCUMENT');
  const proof = bound(resolve(evidence, 'phase106/progress-final.json'), proofHash);
  check(proof.earmarkIssued && proof.scopeHash === funding.funding.scopeHash &&
    (!live || funding.sha256 === liveClaimHash), 'FUNDING_SCOPE');
  const prices = resolve(evidence, 'phase103/official-price-check.json');
  bound(prices, '3e746c93f4b975862083494941daeccc566f44d65e85d16b81a0a9cb0aaf902c');
  const reservation = BigInt(budget.earmarkMicros), allowance = BigInt(budget.countAllowanceMicros);
  check(reservation === 8567184n && allowance === 2520000n && budget.capMicros === '35000000', 'AMOUNT');
  for (const request of prepared.plan.requests) {
    const wire = parseV3Json(request.requestRaw, 131072);
    check(wire.service_tier === 'default' && wire.prompt_cache_options === undefined && wire.prompt_cache_retention === undefined &&
      wire.input.length === 1 && wire.max_output_tokens === prepared.plan.outputCeiling && !wire.store && !wire.stream, 'REQUEST_PROFILE');
  }
  const fund = live ? prepareEvaluationBudgetV3(source) : null;
  const context = live ? evaluationBudgetContextV3(fund, 'evaluation') : null;
  const runtime = live ? resolve(root, 'outputs', runtimeName) : resolve(syntheticDirectory, 'runtime');
  const journal = resolve(dirname(funding.file), marker);
  const session = live ? openEvaluationBudgetV3({ prepared: fund, context }) : null;
  try {
    if (live) {
      const snapshot = session.current();
      check(snapshot.reservedMicros === '0' && snapshot.ledger.capMicros === budget.capMicros &&
        context.ledgerFiles.every(file => sha(plain(file)) === budget.priorLedgerSha256), 'LEDGER_CHANGED');
    }
    check(realpathSync(dirname(runtime)) === dirname(runtime) && !existsSync(runtime) && !existsSync(journal), 'RUN_ONCE');
    const pins = [frozen, prices, funding.file, admissionFile, resolve(root, admission.document), fileURLToPath(import.meta.url)]
      .map(file => [file, sha(plain(file))]);
    const collectorPlanHash = digest({ mode: funding.funding.mode, planHash: prepared.hash, pins, reservation: String(reservation) });
    const seal = { protocol, mode: funding.funding.mode, collectorPlanHash, studyPlanHash: prepared.hash,
      fundingScopeHash: funding.funding.scopeHash, fundingClaimSha256: funding.sha256, reservedMicros: String(reservation),
      runtime, automaticRetry: false, automaticResume: false };
    const sealRaw = JSON.stringify(seal) + '\n';
    durableEvaluationV3(journal, sealRaw);
    mkdirSync(runtime);
    const once = resolve(runtime, 'ONCE.json');
    durableEvaluationV3(once, sealRaw);
    const sealHash = sha(sealRaw);
    const lockHash = live ? sha(plain(context.leaseFile)) : null;
    const verify = () => {
      check(sha(plain(journal)) === sealHash && sha(plain(once)) === sealHash, 'CLAIM_CHANGED');
      if (live) check(sha(plain(context.leaseFile)) === lockHash &&
        context.ledgerFiles.every(file => sha(plain(file)) === budget.priorLedgerSha256), 'LEASE_OR_LEDGER_CHANGED');
      for (const [file, hash] of pins) check(sha(plain(file)) === hash, 'SOURCE_CHANGED');
    };

    let keyReads = 0, countAttempts = 0, modelAttempts = 0, failureCode = null, inspection = null, measured = null;
    let observedUpper = 0n, cacheDetailsComplete = true;
    const receipts = new Map(), records = new Map(), providerIds = new Set();
    const capture = async (kind, index, body, key) => {
      const prefix = resolve(runtime, kind + '-' + index);
      durableEvaluationV3(prefix + '-request.json', body);
      durableEvaluationV3(prefix + '-intent.json', { kind, index, requestSha256: sha(body), consumedBeforeTransport: true });
      if (kind === 'count') countAttempts++; else modelAttempts++;
      const { status, type, raw } = await transport({ kind, index, body, key });
      check(typeof raw === 'string' && typeof type === 'string' && Number.isInteger(status), 'TRANSPORT_SHAPE');
      const persisted = status === 200 && /^application\/json(?:\s*;|$)/i.test(type) && !raw.includes(key) && !type.includes(key) && Buffer.byteLength(raw) <= bytesLimit;
      if (persisted) durableEvaluationV3(prefix + '-response.json', raw);
      durableEvaluationV3(prefix + '-capture.json', { kind, index, status, persisted, responseSha256: sha(raw) });
      check(persisted, 'RESPONSE_HELD');
      return parseV3Json(raw);
    };
    const ordered = map => [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row);
    const inWaves = async action => {
      for (let start = 0; start < limit; start += width) {
        verify();
        const results = await Promise.allSettled(prepared.plan.requests.slice(start, start + width).map((request, i) => action(request, start + i)));
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
        durableEvaluationV3(resolve(runtime, 'count-' + i + '-receipt.json'), receipt);
        receipts.set(i, receipt);
        check(c.input_tokens <= prepared.plan.countCeiling, 'COUNT_LIMIT');
      });
      measured = quoteMainCalibrationV8(prepared, ordered(receipts)).totals;
      check(BigInt(measured.totalMicros) <= reservation && BigInt(measured.countAllowanceMicros) === allowance, 'PRICE_LIMIT');
      durableEvaluationV3(resolve(runtime, 'measured-budget.json'), measured);
      await inWaves(async (request, i) => {
        const v = await capture('model', i, request.requestRaw, key), u = v.usage;
        check(v.status === 'completed' && v.model === request.model && v.service_tier === 'default' && /^resp_[\w-]{1,150}$/.test(v.id) &&
          !providerIds.has(v.id) && Number.isInteger(u?.input_tokens) && u.input_tokens > 0 && u.input_tokens <= Math.ceil(receipts.get(i).inputTokens * 5 / 4) &&
          Number.isInteger(u.output_tokens) && u.output_tokens >= 0 && u.output_tokens <= prepared.plan.outputCeiling &&
          u.total_tokens === u.input_tokens + u.output_tokens, 'USAGE_OR_STATUS');
        providerIds.add(v.id);
        check(Array.isArray(v.output) && v.output.every(o => ['message', 'reasoning'].includes(o.type)), 'OUTPUT');
        const texts = v.output.flatMap(o => o.type === 'message' && Array.isArray(o.content) ? o.content.filter(t => t.type === 'output_text').map(t => t.text) : []);
        check(texts.length === 1 && typeof texts[0] === 'string', 'OUTPUT_TEXT');
        records.set(i, { key: request.key, requestRaw: request.requestRaw, payloadRaw: texts[0], providerResponseId: v.id });
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
      inspection = inspectRenderedCalibrationV1(prepared, ordered(records));
    } catch (error) { failureCode = safe(error); }
    const actualCap = observedUpper + allowance;
    const used = modelAttempts === 0 ? allowance : !failureCode && cacheDetailsComplete && actualCap <= reservation ? actualCap : reservation;
    const terminal = { protocol, planHash: prepared.hash, collectorPlanHash, fundingScopeHash: funding.funding.scopeHash, claimSha256: sealHash,
      status: failureCode ? 'held' : 'collected-rendered-calibration', failureCode,
      clientCountAttempts: countAttempts, clientModelAttempts: modelAttempts, actualCountApiCalls: live ? countAttempts : 0,
      actualProviderCalls: live ? modelAttempts : 0, actualKeyReads: live ? keyReads : 0,
      receipts: ordered(receipts), records: ordered(records), inspection, measured, stageUsedUpperMicros: String(used),
      earmarkMicros: String(reservation), countAllowanceRetainedMicros: String(allowance), cacheDetailsComplete,
      accountingModelUpperMicros: String(used - allowance), observedCacheUpperMicros: cacheDetailsComplete ? String(observedUpper) : null,
      publicReferencesAdmitted: admission.admitted, automaticRetry: false, automaticResume: false,
      mainDispatchAuthorized: false, englishTruthCertified: false };
    const terminalFile = resolve(runtime, 'terminal.json');
    durableEvaluationV3(terminalFile, terminal);
    durableEvaluationV3(resolve(runtime, 'earmark-settlement.json'), { protocol, claimSha256: sealHash, terminalSha256: sha(plain(terminalFile)),
      fundingScopeHash: funding.funding.scopeHash, settledUpperMicros: String(used), earmarkMicros: String(reservation),
      automaticReleaseToGeneralLedger: false, originalLedgerUnchanged: true });
    return terminal;
  } finally { session?.release(); }
}

export function runSyntheticRenderedCalibrationV1(options) {
  check(typeof options?.syntheticDirectory === 'string' && options.syntheticDirectory.length > 0, 'SYNTHETIC_SCOPE');
  return collect(options);
}
export function runAuthorizedRenderedCalibrationV1({ loadKey }) {
  check(process.version === 'v24.22.1', 'LIVE_RUNTIME');
  return collect({ loadKey, transport: send });
}
