// Only these application-owned descriptions and bounded metadata may reach UI/logs.
// Provider error messages, quota IDs, credentials and learner text are never copied.
export const FEEDBACK_ISSUES = {
  not_configured: ['API 키 미설정', '사이트에 Google API 키가 등록되어 있지 않아요.', '사이트의 google_api 설정을 확인해 주세요.'],
  disabled: ['AI 기능 꺼짐', '사이트 설정에서 AI 문장 점검이 비활성화되어 있어요.', 'AI 기능 설정을 확인하거나 자기 점검으로 계속해 주세요.'],
  login_required: ['로그인 필요', '로그인 상태를 확인할 수 없어 요청을 보내지 못했어요.', '입력을 보관한 뒤 다시 로그인해 주세요.'],
  save_required: ['문장 저장 필요', '현재 수업이나 문장이 저장되지 않아 AI 점검을 시작하지 못했어요.', '저장 상태를 확인한 뒤 다시 눌러 주세요.'],
  stale_input: ['문장·학습 위치 변경', '요청한 문장이나 학습 위치가 현재 기록과 일치하지 않아요.', '현재 문장을 저장한 뒤 다시 점검해 주세요.'],
  invalid_request: ['요청 확인 필요', '문장이나 요청 형식을 확인하지 못했어요.', '2,000자 이내의 문장을 입력하고 다시 시도해 주세요.'],
  site_error: ['사이트 처리 실패', '사이트가 AI 요청을 처리하지 못했어요. 응답만으로 세부 원인은 확인할 수 없어요.', '잠시 후 다시 눌러 주세요. 계속되면 확인 코드를 알려 주세요.'],
  request_limited: ['요청이 제한됐어요', '사용 한도로 요청이 거절됐지만, 응답에 한도 종류가 포함되지 않았어요.', '잠시 후 다시 시도하거나 자기 점검으로 계속해 주세요.'],
  provider_limit: ['Google 사용 한도', 'Google의 현재 요청·사용 한도에 도달했어요. 분당·일일 중 어느 한도인지는 알려오지 않았어요.', 'Google AI Studio에서 사용 한도를 확인해 주세요.'],
  provider_minute_limit: ['Google 분당 한도', 'Google이 분당 요청 또는 토큰 한도 초과를 알려왔어요.', '잠시 후 다시 눌러 주세요. 일일 사용량 소진을 뜻하지는 않아요.'],
  provider_daily_limit: ['Google 일일 한도', 'Google이 일일 사용 한도 초과를 알려왔어요.', 'Google AI Studio에서 한도 갱신을 확인하거나 자기 점검으로 계속해 주세요.'],
  provider_key_invalid: ['Google 키 인증 실패', 'Google이 API 키 인증을 거절했어요.', 'Google AI Studio의 키와 사이트의 google_api 설정을 확인해 주세요.'],
  provider_key_blocked: ['Google 키 차단', 'Google이 노출된 것으로 보고된 API 키의 사용을 차단했어요.', 'Google AI Studio에서 키 상태를 확인하고 새 키로 교체해 주세요.'],
  provider_permission: ['Google 사용 권한 오류', 'Google이 이 요청에 대한 사용 권한을 거절했어요.', '키의 API 제한과 프로젝트·모델 접근 권한을 확인해 주세요.'],
  provider_model: ['Google 모델 사용 불가', 'Google이 요청한 모델 또는 API 리소스를 찾지 못했다고 응답했어요.', '사이트에 설정된 모델과 API 지원 여부를 확인해 주세요.'],
  provider_precondition: ['Google 프로젝트 설정 확인', 'Google이 현재 프로젝트 상태에서 이 요청을 실행할 수 없다고 응답했어요.', 'AI Studio에서 해당 모델의 무료 사용 가능 여부와 프로젝트 상태를 확인해 주세요.'],
  provider_request: ['Google 요청 거절', 'Google이 요청 형식이나 매개변수를 받아들이지 않았어요.', '반복되면 확인 코드를 알려 주세요. 같은 요청을 자동 재전송하지 않아요.'],
  provider_timeout: ['Google 응답 시간 초과', '사이트가 Google의 응답을 기다리다가 제한 시간에 도달했어요.', '잠시 후 다시 눌러 주세요. 이전 요청이 사용량에 포함될 수 있어요.'],
  provider_network: ['Google 연결 실패', '사이트에서 Google로의 통신을 완료하지 못했어요. 구체적인 연결 실패 원인은 확인되지 않았어요.', '잠시 후 다시 눌러 주세요. 이전 요청이 사용량에 포함될 수 있어요.'],
  provider_unavailable: ['Google 서비스 오류', 'Google 서버가 현재 요청을 처리할 수 없다고 응답했어요.', '잠시 후 다시 시도해 주세요. 응답만으로 장애 원인이나 복구 시각은 알 수 없어요.'],
  provider_blocked: ['Google 정책에 따른 응답 중단', 'Google이 안전 정책 또는 콘텐츠 제한에 따라 응답을 중단했다고 알려왔어요.', '개인정보나 민감한 표현이 있는지 확인하거나 자기 점검으로 계속해 주세요.'],
  provider_recitation: ['Google 인용 제한', 'Google이 기존 자료의 재현·인용 제한에 따라 응답을 중단했어요.', '직접 쓴 짧은 문장으로 다시 시도해 주세요.'],
  provider_language: ['Google 언어 처리 제한', 'Google이 지원하지 않는 언어 때문에 응답을 중단했다고 알려왔어요.', '짧은 영어 문장으로 다시 시도해 주세요.'],
  provider_truncated: ['AI 응답 길이 초과', 'AI 답변이 설정된 최대 출력 길이에 도달해 중간에 끝났어요.', '문장을 짧게 나누어 다시 점검해 주세요. 사용 횟수 한도 초과는 아니에요.'],
  provider_incomplete: ['AI 응답 미완료', 'Google이 완성된 교정 결과를 보내지 않았고, 구체적인 중단 원인은 확인되지 않았어요.', '다시 시도하거나 자기 점검으로 계속해 주세요.'],
  provider_invalid_response: ['AI 교정 형식 오류', 'Google의 응답이 교정 결과 형식에 맞지 않아 사용할 수 없어요.', '다시 시도해 주세요. 잘못된 응답을 학습 결과로 저장하지 않았어요.'],
  groq_not_configured: ['Groq 키 미설정', 'Google 대신 사용할 Groq API 키가 등록되지 않았어요.', '사이트의 groq_api 설정을 확인해 주세요.'],
  groq_disabled: ['Groq 전환 꺼짐', '사이트 설정에서 Groq 자동 전환이 꺼져 있어요.', 'Groq 자동 전환 설정을 확인하거나 자기 점검으로 계속해 주세요.'],
  groq_limit: ['Groq 사용 한도', 'Groq가 요청·토큰 사용 한도 초과를 알려왔어요. 구체적인 한도 종류는 확인되지 않았어요.', 'Groq Console에서 무료 계정의 사용 한도를 확인해 주세요.'],
  groq_key_invalid: ['Groq 키 인증 실패', 'Groq가 API 키 인증을 거절했어요.', 'Groq Console의 키와 사이트의 groq_api 설정을 확인해 주세요.'],
  groq_permission: ['Groq 사용 권한 오류', 'Groq가 현재 키나 프로젝트의 사용 권한을 거절했어요.', '키와 모델 접근 권한을 확인해 주세요. 유료 플랜으로 자동 전환하지 않아요.'],
  groq_billing: ['Groq 요금·계정 제한', 'Groq가 결제 또는 계정 한도 관련 오류를 반환했어요.', '무료 계정 상태를 확인해 주세요. 앱이 결제나 업그레이드를 진행하지 않아요.'],
  groq_model: ['Groq 모델 사용 불가', 'Groq가 요청한 모델 또는 API 리소스를 찾지 못했어요.', '현재 모델의 제공 여부와 계정 접근 권한을 확인해 주세요.'],
  groq_request: ['Groq 요청 거절', 'Groq가 요청 형식이나 매개변수를 받아들이지 않았어요.', '반복되면 확인 코드를 알려 주세요. 자기 점검으로 계속할 수 있어요.'],
  groq_timeout: ['Groq 응답 시간 초과', '사이트가 Groq 응답을 기다리다가 제한 시간에 도달했어요.', '잠시 후 다시 눌러 주세요. 이전 요청이 사용량에 포함될 수 있어요.'],
  groq_network: ['Groq 연결 실패', '사이트에서 Groq로의 통신을 완료하지 못했어요. 구체적인 연결 실패 원인은 확인되지 않았어요.', '잠시 후 다시 시도하거나 자기 점검으로 계속해 주세요.'],
  groq_unavailable: ['Groq 서비스 오류', 'Groq 서버가 현재 요청을 처리할 수 없다고 응답했어요.', '잠시 후 다시 시도해 주세요. 복구 시각은 확인되지 않았어요.'],
  groq_blocked: ['Groq 응답 제한', 'Groq가 콘텐츠 제한 또는 응답 거절을 알려왔어요.', '문장을 확인하거나 자기 점검으로 계속해 주세요.'],
  groq_truncated: ['Groq 응답 길이 초과', 'Groq 답변이 최대 출력 길이에 도달해 중간에 끝났어요.', '문장을 짧게 나누어 다시 점검해 주세요. 사용 횟수 한도 초과는 아니에요.'],
  groq_incomplete: ['Groq 응답 미완료', 'Groq가 완성된 교정 결과를 보내지 않았어요. 세부 원인은 확인되지 않았어요.', '다시 시도하거나 자기 점검으로 계속해 주세요.'],
  groq_invalid_response: ['Groq 교정 형식 오류', 'Groq 응답이 교정 결과 형식에 맞지 않아 사용할 수 없어요.', '다시 시도해 주세요. 잘못된 응답을 학습 결과로 저장하지 않았어요.'],
  client_timeout: ['사이트 응답 시간 초과', 'AI 응답이 늦어 35초 후 기다림을 끝냈어요. Google·Groq 처리 결과는 확인되지 않았어요.', '연결 상태를 확인한 뒤 다시 눌러 주세요. 이전 요청이 사용량에 포함될 수 있어요.'],
  client_network: ['사이트 연결 실패', '기기와 사이트 사이의 통신을 완료하지 못했어요. Google·Groq 처리 여부는 확인되지 않았어요.', '인터넷 연결을 확인한 뒤 다시 눌러 주세요. 이전 요청이 사용량에 포함될 수 있어요.'],
  invalid_response: ['사이트 응답 형식 오류', '사이트에서 확인 가능한 교정 응답을 받지 못했어요.', '다시 시도해 주세요. 반복되면 확인 코드를 알려 주세요.'],
  unknown: ['원인 확인 불가', '현재 확인 가능한 정보만으로 AI 점검이 중단된 이유를 판단할 수 없어요.', '다시 시도하거나 자기 점검으로 계속해 주세요.'],
} as const;
export type FeedbackIssueCode = keyof typeof FEEDBACK_ISSUES;
export type FeedbackFailure = { code: FeedbackIssueCode; providerStatus?: number; retryAfterSeconds?: number };
export type FeedbackIssue = FeedbackFailure & { previous?: FeedbackFailure };
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
function parseFailure(value: unknown): FeedbackFailure | undefined {
  const raw = object(value);
  if (typeof raw.code !== 'string' || !Object.hasOwn(FEEDBACK_ISSUES, raw.code)) return;
  return { code: raw.code as FeedbackIssueCode,
    ...(Number.isInteger(raw.providerStatus) && Number(raw.providerStatus) >= 100 && Number(raw.providerStatus) <= 599 ? { providerStatus: Number(raw.providerStatus) } : {}),
    ...(Number.isInteger(raw.retryAfterSeconds) && Number(raw.retryAfterSeconds) > 0 && Number(raw.retryAfterSeconds) <= 604800 ? { retryAfterSeconds: Number(raw.retryAfterSeconds) } : {}),
  };
}
export function parseFeedbackIssue(value: unknown): FeedbackIssue | undefined {
  const issue = parseFailure(value);
  if (!issue) return;
  const previous = parseFailure(object(value).previous);
  return { ...issue, ...(previous ? { previous } : {}) };
}
export function feedbackErrorBody(code: FeedbackIssueCode, details: Omit<FeedbackIssue, 'code'> = {}) {
  const issue = parseFeedbackIssue({ ...details, code })!;
  return { error: FEEDBACK_ISSUES[code][1], ...issue };
}
export function issueFromResponse(value: unknown, status: number): FeedbackIssue {
  return parseFeedbackIssue(value) ?? { code: status === 401 ? 'login_required' : status === 429 ? 'request_limited' : status === 409 ? 'stale_input' : status === 400 || status === 413 ? 'invalid_request' : status >= 500 ? 'site_error' : 'unknown' };
}
export class FeedbackIssueError extends Error {
  readonly issue: FeedbackIssue;
  constructor(issue: FeedbackIssue) { super(FEEDBACK_ISSUES[issue.code][1]); this.issue = issue; }
}
