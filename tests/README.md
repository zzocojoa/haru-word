# 학습 앱 검증

Node 22.13 이상에서 `npm test`, `npm run typecheck`를 실행합니다. 앱 소스 린트는 `node node_modules/eslint/bin/eslint.js app lib db`입니다.

브라우저 검증은 프로덕션 빌드 후 로컬 Worker의 8787 포트에서 실행합니다. 각 `*-qa.cjs`를 Node로 실행하며, 로컬 임시 계정만 생성합니다. 배포 URL에 테스트 인증 헤더를 보내거나 운영 학습 기록을 수정하지 마세요. Playwright 경로는 현재 Codex 번들에 맞춰져 있으므로 다른 환경에서는 해당 경로를 변경해야 합니다.

- `comprehensive-qa.cjs`: 월말 120/310개 저장, 날짜·주·월 경계, 입력 보존, 충돌·계정 격리, UTF-8 크기 제한, 아이콘·출처, 반응형 화면.
- `daily-topup-qa.cjs`, `daily-goal-qa.cjs`: 목표 1~10개와 당일 추가 학습.
- `browser-qa.cjs`, `workflow-qa.cjs`, `resume-qa.cjs`: 일일·주간·월간, 보완 연습, 저장 실패와 재개.
- `familiarity-qa.cjs`, `familiarity-reveal-qa.cjs`: 20개 표본, 답 숨기기·비교·확정.
- `repeat-learning-qa.cjs`, `purpose-improvements-qa.cjs`: 완료 후 재학습, 실제 학습일, 뜻별 보존, 이월.
- `sentence-feedback-qa.cjs`: 모의 Google 응답, 오류·한도, 기록 보존. 실제 유료 호출을 하지 않습니다.
- `design-qa.cjs`: 화면 너비, 모바일 시트, 초점·스크롤·로딩·기록.
- `accessibility-qa.cjs`: axe-core WCAG A/AA 자동 검사. 별도 `axe.min.js` 경로를 `AXE_CORE_PATH`로 지정합니다. 현재 감사는 axe-core 4.13.0을 `work/axe/package/axe.min.js`에 풀어 사용했습니다. 실제 VoiceOver 검사를 대체하지 않습니다.
- `a1-content-qa.cjs`: 기본 A1이며 `node tests/a1-content-qa.cjs A2` 또는 `B1`, `B2`로 해당 수준을 검사합니다. 각 수준의 대표 교정 카드 8개, 전체 내려받기 자료, 과거 회차 스냅샷·재학습·뜻만 있는 구형 기록의 예문 보존을 확인합니다. `set (put)`처럼 공식 표제어에 구분이 있는 버튼도 전체 접근성 이름으로 찾습니다. `content-review.test.mjs`는 전체 항목 구조와 A1/A2/B1/B2 검토 원장의 정확한 콘텐츠 해시를 검사하며 의미의 무오류를 자동 증명하지 않습니다.

최종 재현 결과는 `outputs/comprehensive-audit/`에 보관합니다. 현재 로컬 Miniflare에서 독립 API 클라이언트의 첫 GET이 간헐적으로 시간 초과할 수 있습니다. 서버 준비 상태를 확인한 뒤 실패한 읽기 시나리오를 재실행하고, 최초 실패도 결과에 남기세요. 대형 UTF-8 요청 검사는 실제 브라우저 fetch로 실행합니다.

A1/A2/B1/B2 후속 검토 결과와 수정 전후 표는 `outputs/a1-content-review/`, `outputs/a2-content-review/`, `outputs/b1-content-review/`, `outputs/b2-content-review/`에 보관합니다. 사이트용 배포에는 이 검토 보고서를 학습 데이터로 포함하지 않습니다.

- `backup.test.mjs`: 백업 형식·참조·상태 전이·UTF-8 분할, 실제 SQLite를 사용한 원자적 교체·롤백·revision 충돌·계정/AI 사용량 격리. Node의 실험적 `node:sqlite`를 사용합니다.
- `backup-qa.cjs`: 가져오기 미리보기·확인·복원·취소, 기기 간 재개·충돌, 서버 실패, 커밋 후 응답 유실, 큰 JSON 복원, 320/390/1440px·200% 글자, axe 5상태. `work/axe/package/axe.min.js`가 필요합니다. 결과는 `outputs/backup-restore/`에 저장합니다. 실제 사용자의 백업을 이 검사에 넣지 않습니다.

- `client-request.test.mjs`: 응답 헤더/본문 제한, 취소 구분, 타이머/이벤트 정리, HTTP 오류 전달과 자동 재전송 없음.
- `request-timeout-qa.cjs`: 불러오기 20초·저장 25초·AI 35초·복원 45초 지연, 적용 후 응답 유실, 초안 백업·재시도·늦은 응답 무시·수동 학습. 가상 시계를 이용해 실제로 수십 초씩 기다리지 않습니다. 결과는 `outputs/request-reliability/`입니다.
- `history-performance-qa.cjs`: 365/1,825개 가상 회차를 별도 로컬 계정에 생성하고 3회씩 조회·탭·설정 저장을 측정합니다. Chromium 390px와 CPU 4배 지연이며 운영 성능/Safari 성능 검증이 아닙니다. 이 측정 중 다른 브라우저 검사는 실행하지 않는 것이 좋습니다. 결과는 `outputs/history-performance/`입니다.

- `toolchain.test.mjs`: 보안 패치한 compiler를 구형 Drizzle 로더가 사용해 TypeScript CJS/ESM을 변환하고 실행하는지 검사합니다. 단순 버전 검사와 구분합니다.
- `startup-performance-qa.cjs`: 캐시 없는 390px Chromium·CPU 4배 지연의 초기 화면 3회와 자산 크기를 측정합니다. 다른 브라우저 검사를 함께 실행하지 마세요. 실기기·운영망 성능이 아닙니다. 최종 광역 결과는 `outputs/final-audit/`입니다.

- `state-delta.test.mjs`: 변경하지 않은 기록은 직렬화하지 않고, 값이 같은 복제본은 전송하지 않습니다. 실제 학습·이월·실패 후 재시도의 변경분으로 다음 상태를 재구성하고 기존 상태 불변성을 확인합니다.
- `history-performance-qa.cjs`: `PERF_OUTPUT`으로 출력 디렉터리를 구분할 수 있습니다. `SLOW_NETWORK=1`은 1,825회차에서 캐시를 끄고 150ms 지연·다운로드 500,000 B/s·업로드 125,000 B/s로 브라우저를 1회 측정합니다. 별도 API 클라이언트 측정에는 이 제한이 적용되지 않습니다. 운영망 성능으로 일반화하지 마세요.
- 추가 학습 저장 대기가 실패하면 `daily-topup-qa.cjs`가 상태 API의 메서드·상태 코드·소요 시간, 저장 배너·오류·학습 단계를 `save-wait-failure.json`에 남깁니다. 임시 로컬 계정만 검사합니다.

- `review-extension.test.mjs`: 목표 설정과 실제 주간/월말 대상 구분, 3→10 추가, 기존 모든 단계와 재시도 위치 보존, 뜻별 중복 방지, 월말 구간·추가 확장·백업 전이 검증.
- `review-extension-qa.cjs`: 기존 3개 주간/월말 회차에 추가 7개 반영, 미점검 수, 실패 후 재시도·새로고침·초안 보존, 구형 클라이언트 거부, 새 항목 전체 단계 완료와 과거 기록 보존. 로컬 임시 계정만 사용하며 `outputs/review-extension/`에 결과를 남깁니다.
