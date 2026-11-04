# OpenAI 피드백 책임 분리 · 2026-11-04

범위는 `codex/refactor-openai-feedback`, 기준 `7d7c368fbd9c7398712600e5bfae2f1fd1c2ad05`의 로컬 리팩토링이다. 시작 시 HEAD가 기준과 같고 작업 트리는 clean이었다. 기본 폴더·동결 후보·유료 평가 원장은 수정하지 않는다. 운영 v143/source36dc66f/환경77과 PR54의 미배포 공백 경계 수정을 구분한다.

## 관찰한 문제와 변경 경계

| 문제와 근거 | 정리한 책임 | 유지한 계약과 확인 방법 |
|---|---|---|
| 두 `app/api/*-feedback/route.ts`의 영수증 콜백에 집계·호출·출처·안전 검사·구형 응답 변환이 중복 | `lib/server/feedback-generation.ts`의 `executeFeedbackRequest`로 공통 실행. 각 경로는 인증·저장 문서·모델·목표·revision·지문과 생성 입력을 결정 | claim 이후에만 집계/한 번 호출. 모델·목표 검사는 기존 순서. `feedback-requests`, `openai-routes`, `judgment-api`, `feedback-safety-api` 검사 |
| `lib/openai-feedback.ts`가 모델/프로필 실행과 스트림·HTTP 오류·Responses envelope 검사를 함께 담당 | `lib/openai-response.ts`에 바이트 제한·취소 정리·HTTP 오류·assistant 출력 추출을 이동. 기존 공개 상수/오류 함수는 재내보내기 | 28초·256KiB·UTF-8·refusal/incomplete·모델 exact 검사와 오류 단계 유지. `openai-feedback`, `feedback-validation-stages` 검사 |
| `lib/judgment-feedback-contract.ts` 안에 wire/판정 검증과 의미 보존용 단어·역할 비교가 혼재 | `lib/judgment-correction.ts`가 제한된 의미 변경 감지만 담당. 기존 `correctionConflict` 진입점 유지 | 프롬프트·wire·검사 순서·거절 이유·문맥 보류·검토한 설명 유지. 결정표/판정 검사와 요청 지문 대조 |
| `lib/recoverable-feedback.ts`가 기기 UUID 저장·조회와 응답 수용/종료 판독·화면 결과 선택까지 담당 | `feedback-recovery-response.ts`는 순수 응답 정책, `feedback-selection.ts`는 현재 조건 우선 선택, 기존 모듈은 기기 쓰기와 조회 우선 실행 | 불명/형식 오류에는 UUID 유지. 알려진 종료를 확인한 클릭은 새 POST를 하지 않음. `recoverable-feedback`, `local-learning-drafts`, 공백/브라우저 검사 |
| 두 hook과 복구 응답이 원문·요청 모델·문맥 동일성 조건을 반복 | `feedbackMatchesRequest`를 공유. 화면의 현재 버전/목표 판단은 별도 `feedbackMatchesContext` 유지 | 단어는 이미 trim한 문장과 비교, 문법은 raw 또는 정확한 trim만 허용. 내부 공백·대소문자·문장부호 변경 거부 |

이미 공통인 요청 영수증·기기 보관·교정 비교/되돌리기 모듈을 재사용한다. hook 수명주기를 하나로 합치지 않는다. 문법은 먼저 `flush()`하고 세대/최신 문장으로 늦은 응답을 버리며, 단어는 상위 저장 배너가 결과 저장 실패와 재시도를 처리한다. 두 경로의 헤더와 HTTP 클라이언트도 그대로다.

## 실제 흐름과 수정 시 점검할 순서

1. 단어: `SentenceStage` → `SentenceFeedbackPanel`/문맥 지문 → `useSentenceFeedback`. 문법: `GrammarLesson`/문맥 지문 → `useGrammarFeedback`/`flush`.
2. `useFeedbackRecovery` → `runRecoverableFeedback`: 기기 보관 가능 여부·계정/clear 세대를 확인하고 UUID를 먼저 저장한다. 기존 pending이면 GET만 수행한다.
3. POST 경로는 인증·origin/본문 한도·capability·계정 문서/모델 snapshot·학습 단계·목표/문맥 지문을 검증한다. 단어와 문법의 입력/프롬프트 선택과 영수증 지문은 각 경로에 남는다.
4. `executeFeedbackRequest` → 기존 `withFeedbackRequest`: 소유 계정/UUID/revision claim을 통과한 콜백만 집계하고 OpenAI를 한 번 호출한다. 중복/불명 claim은 재실행하지 않는다.
5. `openai-feedback`은 모델/허용 목록·요청·deadline을 관리하고 `openai-response`에서 제한된 REST 응답을 읽는다. 프로필의 parser가 wire·판정·최소 교정을 검증한다. HTTP/네트워크/판정 오류를 섞지 않는다.
6. 공통 실행은 기존 출처·문맥 필드, 설명 안전 검사, 구형 structure projection을 적용하고 영수증에 결과/실패를 보관한다. 진단은 기존 고정 코드·모델·버전·시간·수업 식별자만 쓴다.
7. 클라이언트 응답 정책은 영수증·출처·원문·모델·문맥을 확인한다. 기기 보관 후 각 hook이 최신 요청인지 다시 확인하고 기존 저장 경로로 넘긴다.
8. `currentFeedback`은 현재 원문/목표/모델/버전/문맥을 날짜보다 먼저 비교한다. 기존 `FeedbackDetail`/`FeedbackCorrection`이 표시·비교·확인·취소·되돌리기를 처리한다. 성적·첫 답·학습일은 이 경로에서 다시 계산하지 않는다.

변경 예: 문법 입력 `" I am happy. "`의 응답 원문은 그 문자열 또는 `"I am happy."`만 수용한다. `"I  am happy."`, `"i am happy."`, `"I am happy!"`는 다른 원문이다. 표시의 현재성 판단은 요청 수용보다 엄격하며 구형 의견을 현재 판정으로 승격하지 않는다.

## 동등성과 검증

관찰 가능한 성공 기준은 기존 전체 회귀 유지, 요청/프롬프트 불변, 안전한 오류/복구 상태 전이 불변, 저장·호환·UI 동작 유지다. 기준선 `npm test`는 **780/780, exit 0**이었다. 잠금 설치도 exit 0이며 npm은 Windows 선택 의존성 정리 EPERM와 기존 deprecated 경고를 냈다. lockfile은 바꾸지 않았다.

`tests/fixtures/openai-request-equivalence.json`은 제품 수정 전에 기준 소스에서 고정했다. `openai-request-equivalence.test.mjs`는 3모델 × 2프로필 × 4문맥 형식 × (단어 + 문법 v1~v4)의 **120조합**에서 전송 URL/메서드/헤더/직렬화 본문과 생성 결과의 SHA-256을 대조한다. 본문의 키 순서·공백·프롬프트도 지문에 포함하고 결과의 `createdAt`만 제외한다. 유효한 합성 응답 한 번만 반환하며 네트워크 호출은 없다. 기대값을 새 구현에 맞춰 재생성하지 않는다.

재현 명령:

```powershell
npm test
npm run check:grammar-review
npm run typecheck
npm run lint
npm run build
node tests/local-draft-qa.cjs
node tests/feedback-correction-qa.cjs
node tests/openai-migration-qa.cjs
node tests/refactor-boundaries-qa.cjs
```

브라우저는 설치된 `QA_PLAYWRIGHT_PATH`/`AXE_CORE_PATH`, 루프백 built Worker와 새 가상 계정만 사용한다. Worker의 실제 AI는 비활성이고 응답은 fixture로 대체한다. `QA_BROWSER=chromium`과 `webkit`을 순차 실행한다.

### 최종 실행 결과

Node **v22.22.2**에서 최종 제품 코드로 실행했다. 모든 아래 명령은 **exit 0**이다. 로그·검사 집계·소스 지문은 Git 제외 `outputs/feedback-refactor/`에 보존한다.

| 명령/검사 | 결과 |
|---|---|
| `npm test` | 781/781, 실패·취소·skip·TODO 0. 기존 780개와 새 120조합 대조 테스트 1개 |
| `npm run check:grammar-review` | v4 원문·내용 지문 검증 통과 |
| `npm run typecheck` | 통과 |
| `npm run lint` | 오류 0, 기존 경고 15. 변경 파일의 새 경고 0 |
| `npm run build` | Worker 빌드 통과. `punycode` deprecation 및 500kB 초과 청크 경고 유지 |
| `node tests/local-draft-qa.cjs` | Chromium/WebKit 각각 19개. 강제 종료·빈 입력·계정/탭·공백·유실 응답의 GET 복구 |
| `node tests/feedback-correction-qa.cjs` | 각각 15개. 비교·확인 무효화·편집 후 되돌리기 보호·초점·구형/v5 설명 |
| `node tests/openai-migration-qa.cjs` | 각각 12개. 실제 built Worker 저장·모델 선택·문맥·혼합 모델 백업/분할 복원·409/426·axe |
| `node tests/refactor-boundaries-qa.cjs` | 각각 4개. 늦은 AI 응답 폐기·탭/도구 이탈·저장 실패와 초안/성적 보존 |
| 기준 코드와 복구 정책 차등 대조 | 합성 1,782조건, 차이 0. 결과/오류·POST/GET 순서·완전한 기기 요청 레코드 비교 |
| `git diff --check`, 최종 소스/의존성 검토 | 공백 오류 0. 이동한 guard는 원문 그대로, 응답 프로토콜은 export 이름 외 동일. 모델·프롬프트·판정 지시·schema·교정 UI·바인딩 10파일 원문 불변 |

브라우저 합계는 **100개(엔진별 50개)**다. harness 검사와 built Worker 통합 검사를 위처럼 구분한다. 실제 제공자·운영 쓰기는 0이다. 새 체크아웃의 로컬 D1에 기존 0000~0006 SQL을 순서대로 적용했으며 모두 exit 0이었다. 운영 migration이나 새 migration 생성이 아니다.

복구 차등 검사는 Git의 기준 `recoverable-feedback.ts`와 현재 코드를 각각 번들해 수행했다. 시각·UUID·기기 instance를 고정하고, 신규/기존 pending × 11 HTTP 상태 × 9 영수증 상태/손상 × 9 피드백 조건을 비교했다. raw/trim·내부 공백·대소문자·문장부호·다른 모델/제공자/지문·손상을 포함한다. 실행 스크립트 `work/recovery-parity.mjs`와 `recovery-equivalence.json`은 로컬 검증 자료로 보존한다.

최종 재검토에서 기존 공개 export의 모든 소비자, claim 안 단일 호출, body deadline 정리, 실패 영수증, 조회 우선/동일 클릭 재전송 금지, 계정/clear 세대, raw 문법 입력·첫 답 보존, 수정 뒤 비교 무효화와 늦은 응답 폐기를 확인했다. 미해결 신규 결함은 발견하지 않았다. 모델 품질 평가나 모든 영어 의미 동치의 증명으로 확대하지 않는다.

리팩토링 검증 완료 시점(커밋·푸시 전)의 기록: 변경은 로컬 미커밋 상태였으며 커밋·푸시·새 PR·PR 병합·운영 배포·환경 변경은 수행하지 않았다. 기존 PR54/운영 출처와 종료한 평가 원장은 그대로다.

전체 기능 브라우저 모음과 성능 모음은 실행하지 않았으며 위 영향 범위만 검증했다. 검사 후 소유한 루프백 서버를 종료했다. 종합 원본은 `outputs/feedback-refactor/verification.json`이다.

## 위험·호환·복구

스키마/마이그레이션·백업 형식·모델 설정·Site/DB/R2 바인딩 변경은 없다. 기존 import 경로의 공개 export를 유지한다. 영수증 24시간/7일 보관과 계정 격리·revision·복원 trigger·기기 한도는 기존 모듈을 사용한다. 별도 유료 평가·API 호출·배포·병합은 수행하지 않는다.

주요 위험은 공통 실행 이동 시 claim 밖 호출, 응답 실패를 종료로 잘못 처리하는 경우, raw 문법 입력을 trim해 저장하는 경우다. 요청 지문/영수증·복구·공백·저장 회귀로 검증한다. 의미 보존 검사는 기존의 제한된 규칙이며 일반 영어 의미 동치나 실제 모델 품질을 증명하지 않는다. 롤백은 이 리팩토링 소스만 되돌리는 방식이며 DB down migration이나 과거 reader로의 운영 롤백을 요구하지 않는다. 기존 진단 event/code와 개인정보 비기록 정책을 유지한다. 실제 iPhone/VoiceOver·운영/실제 유료 모델 호출은 검증 범위 밖이다.
