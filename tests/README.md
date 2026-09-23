# 학습 앱 검증

- `study-clock-race-qa.cjs`: 실제 시간 훅의 중복 재시도, 화면 복귀 이벤트 묶음, 숨김 시 취소, 늦은 이전 응답, unmount를 검사합니다. `CLOCK_BASELINE=1`은 수정 전 구현 전용 재현 모드입니다. 수정 전 결과는 `outputs/clock-reliability/before.json`이며 일반 모드는 기준 파일 없이 실행합니다.
- `client-diagnostics.test.mjs`: 진단 허용 필드, 비공개 입력 제외, 오류/취소/시간 초과 구분, 중복 종료 및 최대 120개 제한을 검사합니다.
- `clock-continuity-qa.cjs`: 10초 시간 동기화 실패와 전체 탭 복구, 진단 다운로드, 자정과 연결 복구, 두 기기의 동일 초안 재개·revision 충돌·입력 백업·최신 기록 확인을 검사합니다. 가상 로컬 계정만 사용하며 Google 호출은 없습니다.
- `review-calendar.test.mjs`, `review-calendar-qa.cjs`: 중복 날짜·서로 다른 학습일·과거/선택 기간·뜻별 대상/자료/순서 불변성, 기본 선택기의 키보드 조작·탭 복귀·읽기 전용·axe 2상태를 검사합니다. OS 선택 팝업 내부와 실제 VoiceOver는 자동 검사 범위 밖입니다.
- 이번 3단계 변경의 재현 결과·성능 측정 조건·남은 한계는 [RELIABILITY_PLAN.md](../RELIABILITY_PLAN.md)에 정리합니다.

- `study-draft.test.mjs`: 문제 소속·복습/양방향/재시도 초안 복원과 직렬화, 성적 미변경, 객체 불변성, 자료 출처, 쓰기 차단 64조합과 독립 성공 조건.
- `study-controller-render-qa.cjs`: 실제 컨트롤러와 테스트용 React 화면에서 매 DOM 반영을 관찰합니다. 새 문제에 이전 답·힌트·공개 상태가 전달되지 않는지, 방향/재시도 전환·동일 문제 저장·늦은 콜백을 확인합니다. 서버나 Google을 호출하지 않습니다. `study-controller-harness.tsx`는 테스트 전용이며 배포 앱에서 import하지 않습니다.
- `draft-interaction-qa.cjs`: 빌드한 로컬 Worker의 가상 계정으로 복습/양방향/재시도 저장 지연·실패·잠금 해제·재접속, 빈 답의 힌트 유지, 시계 재동기화를 통제합니다. 실패 진단은 `outputs/draft-refactor/`에 남기며 운영 계정으로 실행하지 않습니다.

- `state-api.test.mjs`: 실제 SQLite에서 일반 저장의 단일 batch·revision 충돌·응답 유실 후 재전송·중간 실패 롤백·계정 격리·날짜 및 426 호환성 검사. 인증·출처·UTF-8 제한은 DB 변경 전에 거부되는지 확인합니다.
- `learning-api.test.mjs`: 분리한 클라이언트의 조회·저장·백업 요청 형식, 호환성 헤더, 상태 코드 전달, 요청 취소 및 자동 재전송 없음을 확인합니다.
- `daily-topup-qa.cjs`: 저장 대기 외의 상호작용 실패도 `interaction-failure.json/png`에 기록합니다. 최초 병렬 실행의 버튼 비활성 대기 초과는 단독 재검사에서 재현되지 않았으며 원인은 미확정입니다. 진단 수집은 테스트 기대값을 완화하지 않습니다.

- `refactor-contracts.test.mjs`: 기존 공개 API, 학습 모듈의 순환·역방향 의존성, 변경하지 않은 객체 참조와 저장 변경분, 무변경 재개의 동일성을 확인합니다.
- `refactor-lifecycle-qa.cjs`: 임시 로컬 계정으로 초안의 탭 전환/설정 변경/재접속 보존, 타이머의 가시성·일시 정지, 다음 문제 초기화·초점, axe 3상태를 확인합니다. 타이머 시나리오만 가상 시간을 사용합니다. 결과는 `outputs/refactor-audit/`입니다.

Node 22.13 이상에서 `npm test`, `npm run typecheck`를 실행합니다. 앱 소스 린트는 `node node_modules/eslint/bin/eslint.js app lib db`입니다.

브라우저 검증은 프로덕션 빌드 후 로컬 Worker의 8787 포트에서 실행합니다. 각 `*-qa.cjs`를 Node로 실행하며, 로컬 임시 계정만 생성합니다. 배포 URL에 테스트 인증 헤더를 보내거나 운영 학습 기록을 수정하지 마세요. Playwright 경로는 현재 Codex 번들에 맞춰져 있으므로 다른 환경에서는 해당 경로를 변경해야 합니다.

- `comprehensive-qa.cjs`: 월말 120/310개 저장, 날짜·주·월 경계, 입력 보존, 충돌·계정 격리, UTF-8 크기 제한, 아이콘·출처, 반응형 화면.
- `daily-topup-qa.cjs`, `daily-goal-qa.cjs`: 목표 1~10개와 당일 추가 학습.
- `browser-qa.cjs`, `workflow-qa.cjs`, `resume-qa.cjs`: 일일·주간·월간, 보완 연습, 저장 실패와 재개.
- `familiarity-qa.cjs`, `familiarity-reveal-qa.cjs`: 20개 표본, 답 숨기기·비교·확정.
- `repeat-learning-qa.cjs`, `purpose-improvements-qa.cjs`: 완료 후 재학습, 실제 학습일, 뜻별 보존, 이월.
- `sentence-feedback.test.mjs`, `sentence-feedback-qa.cjs`: 모의 Google 응답, 30회 초과·연속 요청 허용, 실제 공급자 429 후 재요청 성공, 임의 남은 횟수 제거, 오류·한도·기록 보존. 실제 유료 호출이나 실제 한도 소진을 하지 않습니다.
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
## 학습 기록 접기·펼치기 검사

- `learning-journal.test.mjs`: 동일 날짜 회차 묶기·학습일 수정·입력 불변·필터 후 번호 유지·빈 날짜 제거·날짜 단위 페이지 경계·보완 연습 종류를 검증합니다.
- `journal-navigation-qa.cjs`: 로컬 built Worker의 임시 계정에 23일·26회차(같은 날 4회차)를 생성합니다. 날짜별 단일 표시·날짜/회차/단어 펼침·결과·AI 의견·기억 깨우기·탭 복귀·종류 필터·10일씩 더 보기·CSV/백업 전체 범위·읽기 전용을 확인합니다. 날짜 수정은 선택한 회차만 이동하고 다른 회차/성적을 보존하는지 재접속까지 검사합니다. 320–1440px·200% 글자·키보드·모션 감소·axe 3상태를 포함합니다.
- `node tests/journal-navigation-qa.cjs`로 실행합니다. 선택적으로 `JOURNAL_BASELINE=1`은 해당 빌드의 목록 높이와 화면만 기록합니다. 일반 검사는 기준 파일 없이 단독 실행하며 결과와 이미지를 `outputs/journal-navigation/`에 저장합니다.
- 기존 디자인·반복 학습·백업·통합 검사는 날짜와 회차를 펼친 뒤 기록 작업을 실행합니다. 장기 기록 검사는 10일/20일 표시 수를 확인합니다. 운영 계정과 Google API를 호출하지 않습니다.

- `expression-translation.test.mjs`: 3,809개 표현 해석의 정확한 표현/뜻 대응, 구형 자료의 읽기 보완, 명시적 빈값·사용자 수정 보존, 뜻별 저장·재학습·서버 검증·구형/신형 백업을 검사합니다.
- `expression-translation-qa.cjs`: 로컬 Worker의 임시 계정으로 완료 자료·단어장·표현 수정·뜻 전환·중단/재개·두 번째 브라우저·회상 숨기기·전체 다운로드와 API 무호출을 확인합니다. 320–1440px, axe 3화면을 포함하며 결과는 `outputs/expression-translation/`입니다.
- 표현 리팩토링: `expression-translation.test.mjs`는 공통 편집의 불변성·공백 처리, 보완 우선순위, material/progress/sense의 선택 필드·필수 필드·길이 제한·strict 검증도 확인합니다. `study-controller-render-qa.cjs`는 일괄 함수형 입력과 같은 카드 재방문 후 늦은 표현/해석 콜백의 무효화를 포함합니다.
- `python tests/expression_translations_test.py`: 표준 라이브러리만 사용하는 7개 데이터 검사입니다. 전체 검증 후 불변 병합, 누락/추가 ID·문맥·형식 오류, 적용된 해석 검증, 3,809개 공개 자료의 바이트 단위 동일성과 실패 시 기존 출력 보존을 검사합니다. 출력은 임시 디렉터리에만 생성합니다.
- `today-status.test.mjs`: 오늘 신규 배정·오늘 완료와 월말 대기의 공존·실제 회상/문장 보완·미측정 문장·점검 확장·뜻별 격리·이전 학습 미완료·근거 없는 구형 복습 표시·입력/배정 불변성을 검사합니다.
- `today-status-qa.cjs`: 로컬 임시 계정으로 진행 중/완료/점검 대기/실제 보완 표시, 월말과 수동 신규 쉬기 안내, 완료 자료 다시 보기, 별도 브라우저 재접속, 월말 점검 종료 후 일일 기록 보존을 확인합니다. 320–1440px·200% 글자·axe 2화면을 포함하며 `outputs/today-status/`에 결과를 저장합니다.
- `daily-boundary-qa.cjs`: 월말 점검이 남은 상태의 한국 시간 자정 전환·날짜/완료 수 변경, 미완료 우선+남은 목표의 새 단어 배정, 수동 신규 쉬기, 목표 3→10에서 전체 날짜 목록/완료 3개·진행 7개 표시, 이전 성적·점검 보존, 다른 브라우저 재개를 확인합니다. 로컬 임시 계정만 사용하며 320–1440px·200% 글자·axe 1화면과 결과는 `outputs/daily-boundary/`에 저장합니다.
- `today-status.test.mjs`는 같은 날짜 여러 회차의 전체 집계와 다음 날 분리, 목표 1/10에서 월말 미완료와 새 단어 배정의 공존, 입력 기록 불변성을 추가로 검사합니다.
- `monthly-carryover-repair.test.mjs`: 월말 미측정과 실제 실패 분리, 구형 표시 정리, 오늘 미입력 자리 교체, 과거/다른 뜻/초안/편집/힌트/재시도/진행 위치 보존, 멱등성, 수동 쉬기·후보 부족·목표 축소를 검증합니다.
- `monthly-carryover-repair-qa.cjs`: 로컬 임시 계정에서 보정 미리보기·원자적 저장 실패/재시도·기기 충돌·재접속·월말 재중단·수정 교재 보존과 구버전 426을 확인합니다. 320–1440px·200% 글자·axe 2화면, 결과는 `outputs/monthly-carryover-repair/`입니다. 실제 운영 계정의 성적을 테스트용으로 생성하지 않습니다.
