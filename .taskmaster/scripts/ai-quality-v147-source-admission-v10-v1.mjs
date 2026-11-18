// A narrowly scoped source gate. It grants no calibration, pilot or release pass.
import { readFileSync, realpathSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { digest } from './ai-quality-v147-calibration.mjs';
import { inspectSourceReviewV10 } from './ai-quality-v147-source-review-v10-v1.mjs';

export const SOURCE_ADMISSION_V10_V1 = 'ai-quality-v147-source-admission-v10-v1';
const here = fileURLToPath(new URL('../..', import.meta.url));
const registryFile = '.taskmaster/evaluation/ai-quality-v147/source-admission-v10-v1.json';
const registrySha = '241860545b1332760bb9328e6f772aff4a6617d68ee7cac79320a741e86e8e63';
const read = f => JSON.parse(readFileSync(f, 'utf8'));
const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex');
const check = (ok, code) => { if (!ok) throw Error('SA10_' + code); };
const fingerprint = p => digest(Object.fromEntries(['input', 'feedback', 'reference', 'expectedGrade', 'expectedAxes'].map(k => [k, p[k]])));
function ordinary(file) { check(lstatSync(file).isFile() && !lstatSync(file).isSymbolicLink() && realpathSync(file) === file, 'ORDINARY_FILE'); }

export function loadSourceAdmissionV10(projectRoot = null) {
  const manifest = read(resolve(here, '.taskmaster/docs/ai-quality-v147-manifest.json'));
  const root = resolve(projectRoot ?? manifest.baseline.existingDashboardRoot), source = resolve(manifest.baseline.sourceRoot);
  check(root === resolve(manifest.baseline.existingDashboardRoot) && realpathSync(root) === root && realpathSync(source) === source, 'ROOT');
  for (const base of [root, source]) { const f = resolve(base, registryFile); ordinary(f); check(sha(f) === registrySha, 'REGISTRY_CHANGED'); }
  const registry = read(resolve(root, registryFile));
  check(registry.protocol === SOURCE_ADMISSION_V10_V1 && registry.qualifiedWitnesses === 12 && registry.entries.length === 12, 'REGISTRY');
  for (const [f, h] of Object.entries(registry.evidenceSha256)) { const p = resolve(root, f); ordinary(p); check(sha(p) === h, 'EVIDENCE_CHANGED'); }
  const scope = read(resolve(root, registry.scopeFile));
  for (const [f, h] of Object.entries(scope.codeBindings)) { const p = resolve(source, f); ordinary(p); check(sha(p) === h, 'CODE_CHANGED'); }
  for (const [f, h] of Object.entries(scope.sourceBindings)) { const p = resolve(root, f); ordinary(p); check(sha(p) === h, 'SOURCE_CHANGED'); }
  const prepared = read(resolve(root, registry.preparedFile)), terminal = read(resolve(root, registry.runtimeTerminalFile));
  check(prepared.hash === registry.sourceReviewPlanHash && digest(prepared.plan) === prepared.hash && terminal.planHash === prepared.hash
    && terminal.mode === 'evaluation' && terminal.actualProviderCalls === 3 && terminal.actualCountCalls === 3 && terminal.actualKeyReads === 1 && terminal.failureCode === null, 'ACTUAL_REVIEW');
  const inspection = inspectSourceReviewV10(prepared.plan, terminal.records);
  check(inspection.sourceQualifiedForDeclaredAiOnlyPolicy && inspection.controlsPassed === 6 && digest(inspection.entries) === digest(registry.entries), 'SOURCE_SUPPORT');
  check(!registry.englishTruthCertified && !registry.freshHoldout && !registry.sameProviderIndependenceEstablished && !registry.formalCalibrationQualification
    && !registry.calibrationAcceptanceAllowed && !registry.mainDispatchAuthorized && registry.pilotReferencesQualified === 0, 'CLAIM_BOUNDARY');
  return { registry, registrySha256: registrySha, prepared, projectRoot: root };
}

export function assertCurrentWitnessSourcesV10({ packets, policyHash, projectRoot = null }) {
  const trusted = loadSourceAdmissionV10(projectRoot), registry = trusted.registry;
  check(policyHash === registry.policyHash, 'POLICY');
  check(Array.isArray(packets) && packets.length === 12, 'DENOMINATOR');
  const keys = packets.map(fingerprint);
  check(new Set(keys).size === 12 && keys.every(k => registry.entries.some(e => e.contentHash === k)), 'WITNESS_CONTENT');
  return { protocol: SOURCE_ADMISSION_V10_V1, sourceQualified: true, qualifiedWitnesses: 12, registrySha256: trusted.registrySha256,
    qualificationScope: 'declared-AI-only-public-v10-witness-sources', formalCalibrationQualification: false,
    calibrationAcceptanceAllowed: false, referencesQualified: 0, mainDispatchAuthorized: false, englishTruthCertified: false };
}
