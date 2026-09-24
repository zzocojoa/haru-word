import { InvalidResponseError, requestJson, REQUEST_TIMEOUT_MS } from './client-request';
import { parseRevision, parseSnapshot } from './response-validation';
import type { State } from './learning';
import type {
  ApiError, FeedbackRequest, FeedbackResponse, SaveStateRequest, StateRevision, StateSnapshot,
} from './api-contracts';

type ApiResult<T> =
  | { ok: true; response: Response; data: T }
  | { ok: false; response: Response; data: ApiError };

// Preserve HTTP failures for callers to handle (401/409/426 are not network failures).
// Runtime validation of AI content stays at the feedback consumer boundary.
async function requestApi<T>(url: string, init: RequestInit, timeoutMs: number, validate?: (value: unknown) => T): Promise<ApiResult<T>> {
  const { response, data } = await requestJson<T | ApiError>(url, init, timeoutMs, (raw, response) => {
    if (response.ok) return validate ? validate(raw) : raw as T;
    const error = raw as Partial<ApiError> | null;
    return { error: typeof error?.error === 'string' ? error.error : '요청을 처리하지 못했어요.', ...(error?.conflict === true ? { conflict: true } : {}) };
  }).catch(error => {
    if (validate && error instanceof SyntaxError) throw new InvalidResponseError();
    throw error;
  });
  return response.ok
    ? { ok: true, response, data: data as T }
    : { ok: false, response, data: data as ApiError };
}

export function loadLearningState() {
  return requestApi<StateSnapshot>('/api/state', { cache: 'no-store', headers: { 'X-Study-Grammar': '1' } }, REQUEST_TIMEOUT_MS.load, parseSnapshot);
}

export function saveLearningState(data: SaveStateRequest) {
  return requestApi<StateRevision>('/api/state', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Study-Review-Resume': '1',
      'X-Study-Server-Clock': '1',
      'X-Study-Monthly-Carryover': '1',
    },
    body: JSON.stringify(data),
  }, REQUEST_TIMEOUT_MS.save, value => parseRevision(value, data.revision));
}

export function restoreLearningState(state: State, revision: number) {
  return requestApi<StateRevision>('/api/state/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Study-Revision': String(revision) },
    body: JSON.stringify({ format: 'haru-words-v1', exportedAt: new Date().toISOString(), state }),
  }, REQUEST_TIMEOUT_MS.restore, value => parseRevision(value, revision));
}

export function requestSentenceFeedback(input: FeedbackRequest, signal: AbortSignal) {
  return requestApi<FeedbackResponse>('/api/sentence-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  }, REQUEST_TIMEOUT_MS.feedback);
}
