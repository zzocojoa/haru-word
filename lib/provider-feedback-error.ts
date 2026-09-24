import { FEEDBACK_ISSUES, type FeedbackIssue, type FeedbackIssueCode } from './feedback-issue';

export class FeedbackError extends Error {
  readonly code: FeedbackIssueCode;
  readonly status: number;
  readonly issue: FeedbackIssue;
  constructor(code: FeedbackIssueCode, status: number, details: Omit<FeedbackIssue, 'code'> = {}) {
    super(FEEDBACK_ISSUES[code][1]); this.code = code; this.status = status; this.issue = { code, ...details };
  }
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
function seconds(value: unknown) {
  if (typeof value !== 'string' || !/^\d+(\.\d+)?s?$/.test(value.trim())) return;
  const result = Math.ceil(Number(value.trim().replace(/s$/, '')));
  return result > 0 && result <= 604800 ? result : undefined;
}
/** Read structured evidence, but never return provider text, IDs or metadata. */
export function providerHttpError(status: number, body: unknown, retryHeader: string | null): FeedbackError {
  const error = record(record(body).error);
  const details = Array.isArray(error.details) ? error.details.map(record) : [];
  const reasons = details.filter(d => d['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo').map(d => d.reason);
  const quota = details.filter(d => d['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure')
    .flatMap(d => Array.isArray(d.violations) ? d.violations.map(record) : [])
    .flatMap(v => [v.quotaId, v.quotaMetric].filter((x): x is string => typeof x === 'string'));
  const delays = details.filter(d => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo').map(d => seconds(d.retryDelay));
  delays.push(seconds(retryHeader));
  const delay = Math.max(0, ...delays.filter((s): s is number => s !== undefined));
  const metadata = { providerStatus: status, ...(delay ? { retryAfterSeconds: delay } : {}) };
  let code: FeedbackIssueCode;
  if (status === 429) {
    code = quota.some(q => /PerDay|per_day/.test(q)) ? 'provider_daily_limit'
      : quota.some(q => /PerMinute|per_minute/.test(q)) ? 'provider_minute_limit' : 'provider_limit';
  } else if ([400, 401, 403].includes(status) && typeof error.message === 'string' && error.message.includes('Your API key was reported as leaked.')) code = 'provider_key_blocked';
  else if (status === 401 || reasons.some(r => r === 'API_KEY_INVALID' || r === 'API_KEY_EXPIRED')) code = 'provider_key_invalid';
  else if (status === 403) code = 'provider_permission';
  else if (status === 404) code = 'provider_model';
  else if (status === 400 && error.status === 'FAILED_PRECONDITION') code = 'provider_precondition';
  else if (status === 400) code = 'provider_request';
  else if (status === 504) code = 'provider_timeout';
  else code = 'provider_unavailable';
  return new FeedbackError(code, status === 429 ? 429 : 503, metadata);
}
export function providerFinishError(finish: unknown, block: unknown): FeedbackError | undefined {
  const blocked = ['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY', 'IMAGE_PROHIBITED_CONTENT', 'PUP_LIMITED_DISABLED'];
  let code: FeedbackIssueCode | undefined;
  if (blocked.includes(String(block)) || blocked.includes(String(finish))) code = 'provider_blocked';
  else if (block && block !== 'BLOCK_REASON_UNSPECIFIED') code = 'provider_incomplete';
  else if (finish === 'MAX_TOKENS') code = 'provider_truncated';
  else if (finish === 'RECITATION') code = 'provider_recitation';
  else if (finish === 'LANGUAGE') code = 'provider_language';
  else if (finish !== 'STOP') code = 'provider_incomplete';
  return code ? new FeedbackError(code, 502, { providerStatus: 200 }) : undefined;
}
