// Fixed, once-only review collection; accounting is automatic within the existing grant.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { durableEvaluationV3 as save, prepareEvaluationBudgetV3, evaluationBudgetContextV3, openEvaluationBudgetV3 } from './ai-quality-v147-evaluation-budget-v3.mjs';
import { prepareClosedDayProvisionAuditV2 } from './ai-quality-v147-closed-day-provision-audit-v2.mjs';
import { parseGroupedProductReviewV1, quoteGroupedProductReviewV1, validateGroupedProductReviewRequestV1 } from './ai-quality-v147-grouped-product-review-v1.mjs';
import { quoteBilingualReferencesV1 } from './ai-quality-v147-bilingual-reference-v1.mjs';
import { parseV3Json } from './ai-quality-v147-wire-v3.mjs';

export const FIXED_REVIEW_EXECUTOR_V1 = 'ai-quality-v147-fixed-product-review-v1';
export const FIXED_REVIEW_MAX_MICROS = 1899480n;
const allowance = 420000n, general = 156241n, restricted = FIXED_REVIEW_MAX_MICROS - general;
const root = fileURLToPath(new URL('../..', import.meta.url));
const scopeFile = '.taskmaster/docs/ai-quality-v147-actual-app-review-scope-v1.json';
const profileFile = '.taskmaster/docs/ai-quality-v147-actual-app-review-budget-profile-v1.json';
const grantFile = '.taskmaster/docs/ai-quality-v147-additional-budget-authorization-20261108.json';
const claimName = '20261109-provision-129-actual-app-review-once.json';
const sha = raw => createHash('sha256').update(raw).digest('hex');
const check = (ok, code) => { if (!ok) throw Error('FRE1_' + code); };
const fileSha = file => sha(readFileSync(file));
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const safe = error => /^(?:FRE1|GPR1|BPR1|PF2|W3)_[A-Z0-9_]+$/.test(error?.message ?? '') ? error.message : 'FRE1_LOCAL_OR_TRANSPORT_HELD';

export async function collectFixedReviewsV1({ plan, directory, loadKey, transport, mode = 'synthetic', binding = {}, onProgress = () => {}, testFault = () => {} }) {
  check(['synthetic', 'evaluation'].includes(mode), 'MODE');
  if (mode === 'evaluation') check(/^[a-f0-9]{64}$/.test(binding.planHash) && /^[a-f0-9]{64}$/.test(binding.collectorPlanHash), 'SCOPE_BINDING');
  check(plan.requests.length === 12 && plan.logicalSlots === 24 && plan.requests.every(r => r.itemCount === 2), 'FIXED_SCOPE');
  for (const r of plan.requests) validateGroupedProductReviewRequestV1(r);
  check(realpathSync(directory) === directory && lstatSync(directory).isDirectory(), 'DIRECTORY');
  save(resolve(directory, 'ONCE.json'), { protocol: FIXED_REVIEW_EXECUTOR_V1, requests: plan.requests.map(r => r.requestSha256), automaticRetry: false });
  let countCalls = 0, modelCalls = 0, keyReads = 0, failureCode = null, observed = 0n, measured = null, key;
  const receipts = [], records = [], grades = [], ids = new Set();
  async function capture(kind, index, requestRaw) {
    save(resolve(directory, `${kind}-${index}-request.json`), requestRaw);
    save(resolve(directory, `${kind}-${index}-intent.json`), { consumedBeforeTransport: true, requestSha256: sha(requestRaw) });
    if (kind === 'count') countCalls++; else modelCalls++;
    await testFault('after-consume', kind, index);
    const response = await transport({ kind, body: requestRaw, key });
    check(typeof response.raw === 'string' && Buffer.byteLength(response.raw) <= 262144, 'RESPONSE_BYTES');
    if (response.raw.includes(key) || /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/.test(response.raw)) {
      save(resolve(directory, `${kind}-${index}-capture.json`), { status: response.status, secretEcho: true, rawPersisted: false });
      throw Error('FRE1_SECRET_ECHO');
    }
    save(resolve(directory, `${kind}-${index}-response.json`), response.raw);
    save(resolve(directory, `${kind}-${index}-capture.json`), { status: response.status, persisted: true, responseSha256: sha(response.raw) });
    check(response.status === 200 && /^application\/json(?:;|$)/i.test(response.type), 'HTTP');
    return parseV3Json(response.raw, 262144);
  }
  try {
    keyReads++; key = await loadKey(); check(typeof key === 'string' && key.length >= 16, 'KEY');
    for (let i = 0; i < plan.requests.length; i++) {
      const r = plan.requests[i], c = await capture('count', i, r.countRequestRaw);
      check(Object.keys(c).sort().join('|') === 'input_tokens|object' && c.object === 'response.input_tokens'
        && Number.isSafeInteger(c.input_tokens) && c.input_tokens > 0 && c.input_tokens <= 10000, 'COUNT_SHAPE_OR_LIMIT');
      receipts.push({ key: r.key, countRequestSha256: r.countRequestSha256, inputTokens: c.input_tokens, provenance: 'api-count' });
      onProgress({ kind: 'count', completed: receipts.length, total: 12 });
    }
    measured = quoteGroupedProductReviewV1(plan, receipts);
    check(BigInt(measured.totalMicros) <= FIXED_REVIEW_MAX_MICROS, 'MEASURED_CAP');
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
      onProgress({ kind: 'model', completed: records.length, total: 12 });
    }
  } catch (error) { failureCode = safe(error); }
  key = null;
  const combined = failureCode ? modelCalls ? FIXED_REVIEW_MAX_MICROS : allowance : observed + allowance;
  const terminal = { protocol: FIXED_REVIEW_EXECUTOR_V1, ...binding, mode, status: failureCode ? 'held' : 'collected-fixed-product-review', failureCode,
    automaticRetry: false, automaticResume: false, clientCountAttempts: countCalls, clientModelAttempts: modelCalls,
    actualCountCalls: mode === 'evaluation' ? countCalls : 0, actualProviderCalls: mode === 'evaluation' ? modelCalls : 0,
    actualKeyReads: mode === 'evaluation' ? keyReads : 0, receipts, records, grades,
    stageUsedUpperMicros: String(general), countAllowanceRetainedMicros: String(general),
    combinedUsedUpperMicros: String(combined), combinedCountAllowanceRetainedMicros: String(allowance),
    restrictedUsedUpperMicros: String(combined - general), restrictedUnusedMicros: String(FIXED_REVIEW_MAX_MICROS - combined),
    independentJudgments: grades.length, formalPilotGenerations: 0, formalPilotReviews: 0,
    referencesQualified: 0, groupedEquivalenceEstablished: false, mainDispatchAuthorized: false, englishTruthCertified: false };
  save(resolve(directory, 'terminal.json'), terminal); return terminal;
}

async function send({ kind, body, key }) {
  const response = await fetch('https://api.openai.com/v1/responses' + (kind === 'count' ? '/input_tokens' : ''), {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(120000), body,
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Accept: 'application/json' },
  });
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body ?? []) { bytes += chunk.length; check(bytes <= 262144, 'RESPONSE_BYTES'); chunks.push(Buffer.from(chunk)); }
  return { status: response.status, type: response.headers.get('content-type') ?? '', raw: Buffer.concat(chunks).toString('utf8') };
}

export async function executeAuthorizedFixedReviewsV1({ scopeHash, loadKey, onProgress }) {
  check(process.version === 'v24.22.1', 'NODE');
  const scopePath = resolve(root, scopeFile), scope = read(scopePath);
  check(fileSha(scopePath) === scopeHash && scope.protocol === FIXED_REVIEW_EXECUTOR_V1, 'SCOPE');
  const source = resolve(scope.sourceRoot), grant = read(resolve(root, grantFile));
  check(grant.currentUserApproved && grant.apiKeyReuseAlreadyApproved && grant.additionalTrancheCapMicros === '35000000'
    && grant.scope === '후속 AI 품질 개선 평가; 기존 US5 실행안과 원장 분리' && !grant.oldClosedApprovalsReactivated, 'EXISTING_GRANT');
  check(scope.authorizationBasis === 'existing-additional-budget-authorization' && scope.authorizationSha256 === fileSha(resolve(root, grantFile)), 'GRANT_BINDING');
  for (const [file, hash] of Object.entries(scope.executionSha256)) check(fileSha(resolve(root, file)) === hash, 'EXECUTION_PIN');
  check(fileSha(resolve(source, scopeFile)) === scopeHash, 'SCOPE_MIRROR');
  const plan = read(resolve(root, scope.planFile)); check(fileSha(resolve(root, scope.planFile)) === scope.planSha256, 'PLAN_PIN');
  const runtime = resolve(root, 'outputs', scope.runtimeDirectoryName);
  check(!existsSync(runtime), 'ONCE_RUNTIME');
  const audit = prepareClosedDayProvisionAuditV2(root);
  check(audit.currentLedgerSha256 === scope.beforeLedgerSha256 && audit.inputHash === scope.provisionAuditInputHash
    && audit.result.candidateProvisionAdjustmentMicros === '4515000', 'PROVISION_BASIS');
  check(scope.maximumCombinedMicros === String(FIXED_REVIEW_MAX_MICROS) && scope.generalMaximumMicros === String(general)
    && scope.newEarmarkMicros === String(restricted), 'LIMITS');
  const prepared = prepareEvaluationBudgetV3(source), context = evaluationBudgetContextV3(prepared, 'evaluation');
  const claimFile = resolve(context.directory, claimName), profilePath = resolve(source, profileFile);
  check(!existsSync(claimFile) && fileSha(profilePath) === fileSha(resolve(root, profileFile)), 'FUNDING_ONCE');
  const profile = read(profilePath);
  check(profile.studyPlanHash === scopeHash && profile.runId === scope.runId && profile.reservationMicros === String(general)
    && profile.countAllowanceMicros === String(general) && profile.expectedModelCalls === 12 && profile.expectedCountCalls === 12
    && profile.collectorProtocol === FIXED_REVIEW_EXECUTOR_V1 && profile.runtimeDirectoryName === scope.runtimeDirectoryName, 'PROFILE');
  const session = openEvaluationBudgetV3({ prepared, context });
  try {
    check(session.current().availableMicros === String(general), 'AVAILABLE');
    check(fileSha(resolve(root, '.taskmaster/docs/ai-quality-v147-evaluation-budget-ledger-v3.json')) === scope.beforeLedgerSha256, 'LEDGER_CHANGED');
    save(claimFile, { protocol: FIXED_REVIEW_EXECUTOR_V1, scopeHash, sourceCohortDay: '2026-11-09', sourceReceipts: 129,
      sourceProvisionMicros: '4515000', assignedMicros: String(restricted), unassignedProvisionHeldMicros: String(4515000n - restricted),
      authorizationFile: grantFile, authorizationSha256: scope.authorizationSha256,
      authorizationBasis: scope.authorizationBasis, provisionAuditInputHash: audit.inputHash, newGrantCreated: false,
      originalFiveDollarReopened: false, prior245ReceiptsReused: false, countApiProvenFree: false });
    mkdirSync(runtime);
    session.reserve({ profileFile: profilePath, collectorPlanHash: scope.planSha256, runtimeRoot: runtime });
    const terminal = await collectFixedReviewsV1({ plan, directory: runtime, loadKey, transport: send, onProgress, mode: 'evaluation',
      binding: { planHash: scopeHash, collectorPlanHash: scope.planSha256 } });
    const terminalPath = resolve(runtime, 'terminal.json');
    save(resolve(runtime, 'closed-day-funding-settlement.json'), { protocol: FIXED_REVIEW_EXECUTOR_V1, scopeHash,
      claimSha256: fileSha(claimFile), terminalSha256: fileSha(terminalPath),
      assignedMicros: String(restricted), restrictedUsedUpperMicros: terminal.restrictedUsedUpperMicros,
      restrictedUnusedMicros: terminal.restrictedUnusedMicros, unassignedProvisionHeldMicros: String(4515000n - restricted),
      automaticReleaseToGeneralLedger: false, newGrantCreated: false });
    save(resolve(runtime, 'general-settlement.json'), session.settle({ runId: scope.runId, runtimeTerminalFile: terminalPath,
      usedUpperMicros: terminal.stageUsedUpperMicros, held: Boolean(terminal.failureCode) }));
    return terminal;
  } finally { session.release(); }
}
