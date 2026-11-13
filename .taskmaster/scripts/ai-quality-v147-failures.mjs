// Pure diagnostic projection. Never read messages, stacks, bodies, Zod issues or secrets.
import {account, digest, slotKey} from './ai-quality-v147-budget.mjs';

export const FAILURE_STAGES = Object.freeze(['preflight', 'generation_transport', 'generation_body', 'generation_format', 'app_safety',
  'repackage', 'receipt_storage', 'judge_transport', 'judge_body', 'judge_format', 'app_pipeline_unknown', 'review', 'unknown']);
const validationStages = ['envelope', 'model', 'content_type', 'content_limit', 'json_syntax', 'fields', 'structure', 'judgment'];
const rejectionReasons = ['natural_empty_correction', 'natural_changed_correction', 'uncertain_nonempty_correction', 'needs_work_missing_correction',
  'missing_context_question', 'unexpected_context_question', 'missing_correction_reason', 'unexpected_correction_reason',
  'negation', 'quantity', 'time_or_focus', 'participants', 'speech_act', 'content_change'];
const appCodes = ['model_unavailable', 'not_configured', 'provider_network', 'provider_timeout', 'provider_billing', 'provider_account_limit',
  'provider_limit', 'provider_key_invalid', 'provider_permission', 'provider_model', 'provider_request', 'provider_unavailable',
  'provider_invalid_response', 'provider_blocked', 'provider_truncated', 'provider_incomplete'];
const stopCodes = new Set(['model_unavailable', 'not_configured', 'provider_network', 'provider_timeout', 'provider_billing', 'provider_account_limit',
  'provider_limit', 'provider_key_invalid', 'provider_permission', 'provider_model', 'provider_request', 'provider_unavailable']);
const check = (ok, code) => { if (!ok) throw new Error(code); };
// Data properties only. Even a throwing getter/proxy cannot echo arbitrary error text.
function own(value, key) {
  if (!value || typeof value !== 'object') return undefined;
  try { const d = Object.getOwnPropertyDescriptor(value, key); return d && Object.hasOwn(d, 'value') ? d.value : undefined; }
  catch { return undefined; }
}
const known = (value, choices) => choices.includes(value) ? value : null;
const status = value => Number.isSafeInteger(value) && value >= 100 && value <= 599 ? value : null;
function appCodeOf(error) {
  const code = known(own(error, 'code'), appCodes);
  return code && own(own(error, 'issue'), 'code') === code && status(own(error, 'status')) ? code : null;
}

// Translate only current application-owned safe metadata. An arbitrary TypeError
// has no such metadata and remains unknown; its name/message never imply transport.
export function stageForAppFailure(error, role = 'generation') {
  check(['generation', 'judge', 'calibration'].includes(role), 'DIAGNOSTIC_ROLE');
  const code = appCodeOf(error), prefix = role === 'generation' ? 'generation' : 'judge';
  if (['model_unavailable', 'not_configured'].includes(code)) return 'preflight';
  if (code === 'provider_network') return own(error, 'validationStage') === 'envelope' ? prefix + '_body' : prefix + '_transport';
  if (code === 'provider_invalid_response') {
    const validation = known(own(error, 'validationStage'), validationStages);
    if (!validation || validation === 'envelope') return 'app_pipeline_unknown';
    return role === 'generation' && validation === 'judgment' ? 'app_safety' : prefix + '_format';
  }
  if (['provider_blocked', 'provider_truncated', 'provider_incomplete'].includes(code)) return prefix + '_format';
  return code ? prefix + '_transport' : 'unknown';
}

export function diagnoseFailure({spec, ledger, key, stage, error, httpStatus, evidenceHash}) {
  // Read-only projection supports a future authorized evaluation ledger too;
  // neither a diagnostic nor its next-action label authorizes or sends a request.
  check(['synthetic', 'evaluation'].includes(spec?.mode), 'DIAGNOSTIC_CONTEXT');
  check(FAILURE_STAGES.includes(stage), 'DIAGNOSTIC_STAGE'); account(spec, ledger);
  check(typeof key === 'string', 'DIAGNOSTIC_SLOT');
  const d = spec.batches.flatMap(b => b.requests).find(d => slotKey(d) === key), row = ledger.slots[key];
  check(d && row, 'DIAGNOSTIC_SLOT');
  check(!(stage.startsWith('generation_') || stage === 'app_safety') || d.role === 'generation', 'DIAGNOSTIC_ROLE_STAGE');
  check(!stage.startsWith('judge_') || ['judge', 'calibration'].includes(d.role), 'DIAGNOSTIC_ROLE_STAGE');
  const appCode = appCodeOf(error), validationStage = known(own(error, 'validationStage'), validationStages);
  const judgmentReason = stage === 'app_safety' ? known(own(error, 'judgmentReason'), rejectionReasons) : null;
  const observedStatus = status(httpStatus) ?? status(own(own(error, 'issue'), 'providerStatus'));
  const mayHaveBeenSent = !['reserved', 'unused'].includes(row.state);
  check(observedStatus === null || mayHaveBeenSent, 'DIAGNOSTIC_EVIDENCE_CONFLICT');
  check(evidenceHash === undefined || typeof evidenceHash === 'string' && /^[a-f0-9]{64}$/.test(evidenceHash), 'DIAGNOSTIC_EVIDENCE_HASH');
  let code, category = 'local_failure', nextAction = 'stop-run';
  const remoteStage = /_(transport|body|format)$/.test(stage);
  if (remoteStage && observedStatus === 402) { code = 'HTTP_402_PAYMENT_REQUIRED'; category = 'provider_failure'; }
  else if (remoteStage && observedStatus === 429) {
    code = appCode === 'provider_billing' ? 'HTTP_429_BILLING' : appCode === 'provider_account_limit' ? 'HTTP_429_ACCOUNT_LIMIT' : 'HTTP_429_UNCLASSIFIED'; category = 'provider_failure';
  } else if (stage === 'preflight') {
    code = appCode === 'model_unavailable' ? 'MODEL_UNAVAILABLE' : appCode === 'not_configured' ? 'NOT_CONFIGURED' : 'PREFLIGHT_HELD';
  } else if (stage.endsWith('_transport')) {
    code = appCode === 'provider_timeout' ? 'TRANSPORT_TIMEOUT' : appCode === 'provider_network' ? 'TRANSPORT_FAILURE'
      : appCode ? 'PROVIDER_REJECTED' : 'TRANSPORT_OUTCOME_UNKNOWN'; category = 'provider_failure';
  } else if (stage.endsWith('_body')) { code = 'BODY_READ_FAILURE'; category = 'provider_failure'; }
  else if (stage.endsWith('_format')) {
    code = appCode === 'provider_blocked' ? 'PROVIDER_BLOCKED' : appCode === 'provider_truncated' ? 'PROVIDER_TRUNCATED'
      : appCode === 'provider_incomplete' ? 'PROVIDER_INCOMPLETE' : 'FORMAT_INVALID'; category = 'format_failure';
    if (validationStage || ['provider_blocked', 'provider_truncated', 'provider_incomplete'].includes(appCode)) nextAction = 'continue-other-slots';
  } else if (stage === 'app_safety') { code = 'APP_SAFETY_REJECTED'; category = 'app_rejection'; nextAction = 'continue-other-slots'; }
  else if (stage === 'repackage') code = 'LOCAL_REPACKAGE_FAILURE';
  else if (stage === 'receipt_storage') code = ['EPERM', 'EACCES'].includes(own(error, 'code')) ? 'STORAGE_DENIED'
    : own(error, 'code') === 'ENOSPC' ? 'STORAGE_FULL' : 'STORAGE_FAILURE';
  else if (stage === 'review') code = 'REVIEW_EVIDENCE_FAILURE';
  else { code = stage === 'app_pipeline_unknown' ? 'APP_PIPELINE_OR_ENVELOPE_UNKNOWN' : 'FAILURE_UNKNOWN'; category = 'unknown'; }
  if (stopCodes.has(appCode) || [402, 429].includes(observedStatus)) nextAction = 'stop-run';
  // A reported failure never rewrites financial state or proves one network call.
  const boundedSettledUsage = row.state === 'completed' && row.usage && row.usage.inputTokens <= d.inputTokenMax && row.usage.outputTokens <= d.outputTokenMax;
  return {schemaVersion: 1, planId: spec.planId, runId: spec.runId, runMode: spec.mode, specHash: digest(spec), slotHash: digest(key), requestId: row.requestId,
    phase: d.phase, targetModelId: d.targetModelId, modelId: d.modelId, role: d.role, stage, code, category,
    appCode, validationStage, judgmentReason, httpStatus: observedStatus, dispatchState: row.state, mayHaveBeenSent,
    networkCalls: mayHaveBeenSent ? null : 0, reportedUsage: row.usage ? {...row.usage} : null,
    costEvidence: boundedSettledUsage ? 'bounded-settled' : row.state === 'unused' ? 'unused-unsent' : 'maximum-retained',
    nextAction, slotRetry: 'never-resend', ledgerAction: 'unchanged', evidenceHash: evidenceHash ?? null};
}

export function failureJson(input) { return JSON.stringify(diagnoseFailure(input)); }
