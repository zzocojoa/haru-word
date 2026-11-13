// Bounded prospective compact review: six actual input counts, budget check,
// then at most six responses. Public diagnostic history stays frozen.
// No retry/resume. Side funding consumes a settled child, never old closed grants.
import { readFileSync, existsSync, mkdirSync, lstatSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from './ai-quality-v147-budget-v3.mjs';
import { compileReferenceRoleCompactV1, inspectReferenceRoleCompactV1, REFERENCE_ROLE_COMPACT_V1 } from './ai-quality-v147-reference-role-compact-v1.mjs';
import { quoteBilingualReferencesV1 } from './ai-quality-v147-bilingual-reference-v1.mjs';
import { parseV3Json, validateV3Output } from './ai-quality-v147-wire-v3.mjs';
import { inspectResponseCredentialsV1 } from './ai-quality-v147-response-credential-guard-v1.mjs';
import { durableEvaluationV3 as save, prepareEvaluationBudgetV3, evaluationBudgetContextV3, openEvaluationBudgetV3 } from './ai-quality-v147-evaluation-budget-v3.mjs';
const source = fileURLToPath(new URL('../..', import.meta.url));
const scopeFile = '.taskmaster/docs/ai-quality-v147-reference-role-compact-scope-v1.json';
const sha = x => createHash('sha256').update(x).digest('hex');
const fileSha = f => sha(readFileSync(f)), read = f => JSON.parse(readFileSync(f, 'utf8'));
const check = (ok, code) => { if (!ok) throw Error('RRCC1_' + code); };

export async function collectReferenceRoleCompactV1({ prepared, directory, loadKey, transport, mode = 'synthetic', onProgress = () => {} }) {
  const { plan, hash } = prepared;
  check(['synthetic', 'evaluation'].includes(mode) && hash === digest(plan) && hash === compileReferenceRoleCompactV1().hash, 'PLAN');
  save(resolve(directory, 'ONCE.json'), { protocol: REFERENCE_ROLE_COMPACT_V1, planHash: hash, automaticRetry: false, automaticResume: false });
  const allowance = BigInt(plan.countProvisionMicros), receipts = [], records = [], ids = new Set();
  let key, keyReads = 0, countCalls = 0, modelCalls = 0, observed = 0n, pending = 0n, inspection = null, failureCode = null;
  async function capture(kind, index, raw) {
    save(resolve(directory, kind + '-' + index + '-request.json'), raw);
    save(resolve(directory, kind + '-' + index + '-intent.json'), { consumedBeforeTransport: true, requestSha256: sha(raw) });
    if (kind === 'count') countCalls++; else modelCalls++;
    const response = await transport({ kind, body: raw, key });
    check(typeof response.raw === 'string' && Buffer.byteLength(response.raw) <= 262144, 'RESPONSE_SIZE');
    const guard = inspectResponseCredentialsV1(response.raw, key);
    if (guard.blocked) {
      save(resolve(directory, kind + '-' + index + '-capture.json'), { status: response.status, persisted: false, guardReason: guard.reason, ...guard.metadata });
      throw Error('RRCC1_CREDENTIAL_OR_JSON');
    }
    save(resolve(directory, kind + '-' + index + '-response.json'), response.raw);
    save(resolve(directory, kind + '-' + index + '-capture.json'), { status: response.status, persisted: true, responseSha256: sha(response.raw) });
    check(response.status === 200 && /^application\/json(?:;|$)/i.test(response.type), 'HTTP');
    return parseV3Json(response.raw, 262144);
  }
  try {
    keyReads++; key = await loadKey(); check(typeof key === 'string' && key.length >= 16, 'KEY');
    for (const [i, r] of plan.requests.entries()) {
      const c = await capture('count', i, r.countRequestRaw);
      check(Object.keys(c).sort().join('|') === 'input_tokens|object' && c.object === 'response.input_tokens' && Number.isSafeInteger(c.input_tokens)
        && c.input_tokens > 0 && c.input_tokens <= plan.maximumInputTokens, 'COUNT_LIMIT');
      receipts.push({ key: r.key, inputTokens: c.input_tokens, countRequestSha256: r.countRequestSha256 });
      onProgress({ kind: 'count', completed: receipts.length, total: 6 });
    }
    const measured = receipts.reduce((n, c, i) => n + quoteBilingualReferencesV1(plan.requests[i].model, Math.ceil(c.inputTokens * 1.25), plan.outputTokenMax), allowance);
    check(measured <= BigInt(plan.maximumMicros), 'MEASURED_CAP');
    save(resolve(directory, 'measured-budget.json'), { upperMicros: String(measured), receipts, countProvisionMicros: String(allowance) });
    for (const [i, r] of plan.requests.entries()) {
      pending = quoteBilingualReferencesV1(r.model, Math.ceil(receipts[i].inputTokens * 1.25), plan.outputTokenMax);
      const value = await capture('model', i, r.requestRaw), u = value.usage;
      check(value.status === 'completed' && value.model === r.model && value.service_tier === 'default'
        && /^resp_[\w-]+$/.test(value.id) && !ids.has(value.id), 'RESPONSE_IDENTITY'); ids.add(value.id);
      check(Number.isSafeInteger(u?.input_tokens) && u.input_tokens > 0 && u.input_tokens <= Math.ceil(receipts[i].inputTokens * 1.25)
        && Number.isSafeInteger(u.output_tokens) && u.output_tokens >= 0 && u.output_tokens <= plan.outputTokenMax
        && u.total_tokens === u.input_tokens + u.output_tokens, 'USAGE');
      observed += quoteBilingualReferencesV1(r.model, u.input_tokens, u.output_tokens); pending = 0n;
      check(observed + allowance <= measured, 'OBSERVED_CAP');
      const texts = value.output?.flatMap(m => m.type === 'message' ? (m.content ?? []).filter(t => t.type === 'output_text').map(t => t.text) : []) ?? [];
      check(texts.length === 1, 'OUTPUT'); validateV3Output(r.requestRaw, texts[0]);
      records.push({ key: r.key, requestSha256: r.requestSha256, payloadRaw: texts[0], providerResponseId: value.id, inputTokens: u.input_tokens, outputTokens: u.output_tokens });
      onProgress({ kind: 'model', completed: records.length, total: 6 });
    }
    inspection = inspectReferenceRoleCompactV1(plan, records);
  } catch (e) {
    failureCode = /^(?:RRCC1|RRC4|RRC2|W3|BRR1|RR1|REF4|EX1)_[A-Z0-9_]+$/.test(e?.message ?? '') ? e.message : 'RRCC1_LOCAL_OR_TRANSPORT_HELD';
  }
  key = null;
  const used = observed + pending + allowance;
  check(used <= BigInt(plan.maximumMicros), 'TERMINAL_CAP');
  const terminal = { protocol: REFERENCE_ROLE_COMPACT_V1, planHash: hash, mode,
    status: failureCode ? 'held' : 'collected-public-reference-role-calibration', failureCode,
    actualProviderCalls: mode === 'evaluation' ? modelCalls : 0, actualCountCalls: mode === 'evaluation' ? countCalls : 0,
    actualKeyReads: mode === 'evaluation' ? keyReads : 0, clientCountAttempts: countCalls, clientModelAttempts: modelCalls,
    receipts, records, inspection, modelUpperMicros: String(observed), unresolvedAttemptUpperMicros: String(pending),
    combinedUsedUpperMicros: String(used), countProvisionMicros: String(allowance), automaticRetry: false, automaticResume: false,
    mainDispatchAuthorized: false, englishTruthCertified: false };
  save(resolve(directory, 'terminal.json'), terminal); return terminal;
}

async function send({ kind, body, key }) {
  const r = await fetch('https://api.openai.com/v1/responses' + (kind === 'count' ? '/input_tokens' : ''),
    { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(120000), body,
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Accept: 'application/json' } });
  const chunks = []; let size = 0;
  for await (const chunk of r.body ?? []) { size += chunk.length; check(size <= 262144, 'RESPONSE_SIZE'); chunks.push(Buffer.from(chunk)); }
  return { status: r.status, type: r.headers.get('content-type') ?? '', raw: Buffer.concat(chunks).toString('utf8') };
}

export async function executeReferenceRoleCompactV1(scopeHash) {
  check(process.version === 'v24.22.1', 'NODE');
  const scope = read(resolve(source, scopeFile)), root = resolve(scope.dashboardRoot);
  check(scope.protocol === REFERENCE_ROLE_COMPACT_V1 && fileSha(resolve(source, scopeFile)) === scopeHash && fileSha(resolve(root, scopeFile)) === scopeHash, 'SCOPE');
  const grant = read(resolve(root, scope.authorizationFile));
  check(fileSha(resolve(root, scope.authorizationFile)) === scope.authorizationSha256 && grant.currentUserApproved && grant.apiKeyReuseAlreadyApproved
    && grant.additionalTrancheCapMicros === '35000000' && !grant.oldClosedApprovalsReactivated, 'GRANT');
  for (const [f, h] of Object.entries(scope.sourceBindings)) check(fileSha(resolve(root, f)) === h, 'EVIDENCE_CHANGED');
  for (const [f, h] of Object.entries(scope.codeBindings)) check(fileSha(resolve(source, f)) === h, 'CODE_CHANGED');
  const parent = read(resolve(root, scope.parentSettlementFile));
  check(parent.conditionalRemainingMicros === '1213206' && parent.remainingFormalCountProvisionMicros === '1038206' && parent.restrictedUnusedMicros === '175000', 'PARENT_FUNDING');
  const prepared = read(resolve(root, scope.preparedFile)), current = compileReferenceRoleCompactV1();
  check(prepared.hash === scope.preparedHash && prepared.hash === current.hash && prepared.hash === digest(prepared.plan)
    && scope.maximumMicros === prepared.plan.maximumMicros && BigInt(scope.maximumMicros) <= 1213206n, 'PREPARED');
  const fund = prepareEvaluationBudgetV3(source), context = evaluationBudgetContextV3(fund, 'evaluation'), session = openEvaluationBudgetV3({ prepared: fund, context });
  try {
    check(session.current().availableMicros === '0' && session.current().reservedMicros === '0'
      && fileSha(resolve(root, scope.ledgerFile)) === scope.ledgerSha256, 'LEDGER');
    const runtime = resolve(root, 'outputs', scope.runtimeDirectoryName);
    const claims = ['reference-role-compact-parent-phase187-unused-once.json', 'reference-role-compact-parent-phase187-formal-provision-once.json'];
    check(!existsSync(runtime) && claims.every(f => !existsSync(resolve(context.directory, f))), 'ONCE');
    for (const f of claims) save(resolve(context.directory, f), { protocol: REFERENCE_ROLE_COMPACT_V1, scopeHash,
      parentSettlementSha256: scope.sourceBindings[scope.parentSettlementFile], combinedMaximumMicros: scope.maximumMicros,
      conditionalUnusedSourceMicros: '175000', formalCountProvisionSourceMicros: '1038206',
      originalClosedFiveReopened: false, originalFormalClaimReissued: false, newGrantCreated: false });
    mkdirSync(runtime);
    const terminal = await collectReferenceRoleCompactV1({ prepared, directory: runtime, mode: 'evaluation', transport: send,
      onProgress: e => console.log(JSON.stringify(e)), loadKey: async () => {
        const f = resolve(root, '.env.local'), st = lstatSync(f);
        check(st.isFile() && !st.isSymbolicLink() && st.nlink === 1 && realpathSync(f) === f, 'KEY_PATH');
        const keys = [...readFileSync(f, 'utf8').matchAll(/^OPENAI_API_KEY=([^\r\n]+)$/gm)];
        check(keys.length === 1, 'KEY_ENTRY'); return keys[0][1].trim().replace(/^("|')(.*)\1$/, '$2');
      } });
    const used = BigInt(terminal.combinedUsedUpperMicros), first = used < 175000n ? used : 175000n;
    save(resolve(runtime, 'funding-settlement.json'), { protocol: REFERENCE_ROLE_COMPACT_V1, scopeHash,
      terminalSha256: fileSha(resolve(runtime, 'terminal.json')), usedUpperMicros: String(used),
      previousUnusedDrawMicros: String(first), formalProvisionDrawMicros: String(used - first),
      previousUnusedRemainingMicros: String(175000n - first), formalCountProvisionRetainedMicros: String(1038206n - used + first),
      conditionalRemainingMicros: String(1213206n - used), generalLedgerUnchanged: fileSha(resolve(root, scope.ledgerFile)) === scope.ledgerSha256,
      automaticGeneralCredit: false, originalClosedFiveReopened: false, originalFormalClaimReissued: false, invoiceVerified: false, countApiProvenFree: false });
    return terminal;
  } finally { session.release(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    check(process.argv.length === 4 && process.argv[2] === '--execute-authorized-reference-role-compact-v1', 'EXPLICIT_MODE');
    const t = await executeReferenceRoleCompactV1(process.argv[3]);
    console.log(JSON.stringify({ status: t.status, failureCode: t.failureCode, actualProviderCalls: t.actualProviderCalls,
      actualCountCalls: t.actualCountCalls, matched: t.inspection?.matched ?? 0, denominator: 60, usedUpperMicros: t.combinedUsedUpperMicros }));
    if (t.failureCode) process.exitCode = 2;
  } catch (e) { console.error(/^(?:RRCC1|EV3)_[A-Z0-9_]+$/.test(e?.message ?? '') ? e.message : 'RRCC1_LOCAL_HELD'); process.exitCode = 1; }
}

