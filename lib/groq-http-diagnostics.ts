import { readBoundedJsonText, RequestBodyError } from './server/request-body';

// Evaluation only. Never retain messages, failed_generation, unknown strings,
// headers, keys or sentences. A recognized provider code is evidence about the
// response, not proof of a billing/account cause or permission to retry.
const codes = ['json_validate_failed', 'context_length_exceeded', 'invalid_api_key', 'model_not_found', 'rate_limit_exceeded', 'invalid_request_error', 'schema_validation_error', 'unsupported_response_format'] as const;
const types = ['invalid_request_error', 'authentication_error', 'permission_error', 'rate_limit_error', 'server_error'] as const;
const parameters = ['model', 'messages', 'response_format', 'response_format.json_schema', 'reasoning_effort', 'max_completion_tokens', 'service_tier', 'stream', 'include_reasoning'] as const;
export type GroqHttpDiagnostic = {
  body: 'parsed' | 'oversized' | 'unreadable';
  code: typeof codes[number] | 'unknown';
  type: typeof types[number] | 'unknown';
  parameter: typeof parameters[number] | 'unknown';
};
const select = <T extends string>(value: unknown, allowed: readonly T[]): T | 'unknown' => typeof value === 'string' && allowed.includes(value as T) ? value as T : 'unknown';
export function parseGroqHttpDiagnostic(value: unknown): GroqHttpDiagnostic | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join(',') !== 'body,code,parameter,type' || typeof v.body !== 'string' || !['parsed', 'oversized', 'unreadable'].includes(v.body)) return;
  if (select(v.code, [...codes, 'unknown']) !== v.code || select(v.type, [...types, 'unknown']) !== v.type || select(v.parameter, [...parameters, 'unknown']) !== v.parameter) return;
  if (v.body !== 'parsed' && [v.code, v.type, v.parameter].some(v => v !== 'unknown')) return;
  return v as GroqHttpDiagnostic;
}
export async function captureGroqHttpDiagnostic(response: Response, signal?: AbortSignal): Promise<GroqHttpDiagnostic> {
  const result: GroqHttpDiagnostic = { body: 'unreadable', code: 'unknown', type: 'unknown', parameter: 'unknown' };
  if (response.ok) return result;
  try {
    const copy = response.clone();
    const request = new Request('https://diagnostic.invalid/', { method: 'POST', body: copy.body, headers: copy.headers, signal, ...{ duplex: 'half' } });
    const value: unknown = JSON.parse(await readBoundedJsonText(request, { bytes: 16_384 }));
    const error = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>).error : undefined;
    const fields = error && typeof error === 'object' && !Array.isArray(error) ? error as Record<string, unknown> : {};
    result.body = 'parsed';
    result.code = select(fields.code, codes); result.type = select(fields.type, types); result.parameter = select(fields.param, parameters);
  } catch (error) {
    if (error instanceof RequestBodyError && error.code === 'body_too_large') result.body = 'oversized';
  }
  return result;
}
