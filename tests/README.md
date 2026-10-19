# 학습 앱 검증

- `ux-text.test.mjs`: UI 표시와 저장 계약의 분리를 검사한다. 두 AI 전송 고지·이미지 위치의 조회 실패/저장 결과 미확인, AI 오류 47종의 안전한 진단·학습자 안내, 상세/단독 출처의 참고 고지, 양방향 회상 정답 은닉과 도움 사용, 긴 원문 보존, CSV 24개 열과 기존 결과 값을 확인한다.
- `ux-text-qa.cjs`: built loopback Worker·가상 계정에서 조회 실패/재시도, 친숙도 저장 성공 전 이탈 차단, 실패 시 입력 백업·재시도, 친숙도 진행/완료·단어 준비의 복원 차단 안내, 모바일 320/390px와 100/200% 글자, 한국어 닫기, 설정 선택값 줄바꿈을 검사한다. 긴 뜻·문장·메모·과거 AI 입력/제안/설명을 모바일/데스크톱에서 펼쳐 원문·state/revision 보존을 확인한다. 실제 컴포넌트 fixture로 재로딩 차단 이유와 키보드 `더 보기`도 확인한다. `QA_BROWSER=chromium` 또는 `webkit`으로 `node tests/ux-text-qa.cjs`를 실행한다. 결과는 `outputs/ux-text/<engine>/`에 남는다. 실제 iPhone/VoiceOver 검사는 아니다.
- 이번 문구 개선의 관련 회귀 묶음·환경·결과·한계는 [UI 구현 기록](../docs/UX_TEXT_IMPLEMENTATION_2026-10-19.md)을 따른다. 테스트 선택자는 새 UI 이름을 사용하며 쓰기 수·성적·revision·백업 보호 조건은 유지한다.
- PR 최종 검토에서 `ux-text-qa.cjs`에 짧은 기록의 문단 경계 검사를 추가했다. 교정문이 없는 AI 원문/설명, 완료 기록 제목/문장, 데스크톱 표의 개선 상태/메모가 서로 다른 줄인지 실제 좌표로 검사하고 state/revision 무변경을 확인한다. 수정 전 WebKit 실패와 수정 후 두 엔진의 통과는 [최종 검증 기록](../docs/ux-copy-audit-2026-10-19/final-review.json)에 남긴다.
- [계획 대조 검토](../docs/UX_TEXT_PLAN_REVIEW_2026-10-19.md)의 10개 실행과 예전 `sentence-feedback-layout-qa.cjs` 실패는 당시 이력이다. 후속 [광역 로직 검토](../docs/UX_TEXT_WIDE_REVIEW_2026-10-19.md)는 해당 검사를 현재 AI 구조 비노출·원문 보존 계약으로 보완하고, 당시 런타임의 manifest83파일을 기능156·별도 프로필10·성능6조건으로 검증했다. [광역 실행 근거](../docs/ux-copy-audit-2026-10-19/wide-review.json)는 각 검사/소스/로그 지문과 한계를 포함한다. 성능 모음은 기능 모음과 분리해 순차 실행했다. 위 문단 경계 수정 후에는 영향 범위 검사를 다시 실행했으며 광역 172조건 전체의 재실행으로 계산하지 않는다.

- `card-retirement-qa.cjs`: 종료된 영어 카드 메뉴·정적 화면 제거, 이전 `/cards` 주소의 학습 홈 이동, 기존 카드 API 7개 메서드의 410 응답, 학습 문서/revision 불변·단어 검색·재접속을 로컬 가상 계정에서 검사한다. `QA_BROWSER=webkit`도 지원한다. 실제 AI·카카오 호출은 없다.

- `image-practice-position-api.test.mjs` / `image-practice-position.test.mjs`: 독립 위치 API의 무쓰기 GET·인증·계정·출처·1KB 스트림 제한·동시 revision 충돌과 클라이언트의 직렬 저장·최신 대기 위치·응답 유실·시간 초과·충돌 선택·계정 전환·손상/차단 캐시를 검사한다. 같은 중간 카드를 다른 탭/기기가 저장한 경우의 재시도·재개, 최종 위치 동일 시 GET만으로 복구, 원격 선택 전/후의 다른 탭 초안 순서와 선택 실패·취소도 포함한다.
- `image-practice-qa.cjs back`: 이미지/뜻 클릭·반복 터치·Enter/Space 양방향 뒤집기, 별도 확인 버튼 제거, 앞면의 정답 DOM/접근성 트리 숨김, 초점·발음 분리·닫기 후 앞면 재개, 위치 쓰기/추가 이미지 요청/방문 이력 없음 검증. `front`·`error`는 로딩/실패 중 이동, `matrix`는 320/390/865/1440px·100/200%·axe, `lifecycle`은 카드 이동 후 앞면을 검사한다.
- `image-practice-resume-qa.cjs`: 별도 로컬 D1 가상 계정에서 닫기·탭·새로고침·별도 브라우저 이어 보기, 번호/경계/이미지 실패, 두 기기 충돌, 실패·시간 초과·응답 유실 후 조회 우선 재시도, 제외/빈 카드·계정 전환과 학습 문서/revision/백업 불변을 확인한다. Chromium/WebKit·320/390/1440px·100/200%·키보드·axe와 현재 번호 live region·이동 버튼 초점 유지·외곽선 잘림 방지를 포함한다. 실제 스크린리더 발화는 별도 확인 대상이다.
- 같은 브라우저 두 탭에서 원격 선택 GET을 보류하고 다른 탭이 C→B→C로 이동하는 회귀도 위 두 위치 검사에 포함한다. 최신 C 미저장 캐시 유지, 새로고침 후 C에서 충돌 선택, 자동 PUT 0건을 확인한다. unit 검사는 식별자 없는 기존 version 1 캐시, 식별자 있는 캐시의 조회/영수증 유지, 손상된 식별자도 확인한다.
- 위치 요청 동시성은 원래 연습 페이지의 `request`부터 `requestfinished`/`requestfailed`까지 추적한다. 다른 탭의 독립 요청이나 API fixture 요청은 합산하지 않는다. `route.continue()` 반환과 응답 헤더 도착은 요청 완료가 아니다. `maxConcurrentPositionRequests`와 `pendingPositionRequestsAtEnd`는 이 범위의 최대·종료 시 미완료 요청 수다.
- `node tests/request-concurrency-qa.cjs`는 자체 루프백 서버에서 응답 본문 2개를 실제 보류해 최대 동시 요청 2를 검증한다. 응답 헤더 후 유지, 첫 완료 후 1·503 본문 완료 후 0, 취소 후 0, 다른 페이지 제외와 감시 해제도 확인한다. 앱 Worker·D1·외부 서비스는 필요 없으며 설치된 `QA_PLAYWRIGHT_PATH`를 사용한다. `QA_BROWSER=webkit`으로 반복하고 기능 QA 등록부에도 포함한다. 결과는 `outputs/request-concurrency/<engine>/report.json`이다.
- `image-practice-performance-qa.cjs`: `QA_BASELINE_URL`/`QA_BASELINE_DIST`와 `QA_BASE_URL`의 별도 루프백 Worker를 같은 0/365/1,825회차 자료·CPU 4배·기본/느린망·3표본으로 비교한다. 첫 저장 화면까지 시간·초기 JS/바이트·위치/이미지 요청 0과 진입 후 그림 두 장을 확인한다. 다른 브라우저 검사를 동시에 실행하지 않는다.

- `material-line-endings.test.mjs`는 두 자료 생성기에 LF/CRLF 원문과 실제 Git `core.autocrlf=false/true` 체크아웃을 제공한다. 정규화 지문·LF 생성물·빌드 검사 통과와 원문 변경 감지/실패 시 출력 보존을 확인한다. 원문 지문은 CRLF만 LF로 정규화하며 생성 JSON은 `.gitattributes`의 LF 정책을 따른다.
- `pr38-lazy-recovery-qa.cjs`는 완료 기록의 지연/실패/재시도 모달과 닫힌 뒤 늦은 응답을 검사한다. 오래된 문서의 실제 import 주소를 로컬에서 바꿔 404/410 복구, 이탈 취소, 지속 503의 재로딩 차단과 전체 기록/revision 불변도 확인한다. `node tests/pr38-lazy-recovery-qa.cjs all`로 실행하며 `completed` 또는 `obsolete`로 범위를 선택한다. `QA_BROWSER=webkit`을 지원하고 공통 `QA_BASE_URL`·`QA_PLAYWRIGHT_PATH`·`AXE_CORE_PATH`를 사용한다. 320/390/1440px·100/200% 글자·키보드·axe를 포함한다. `QA_FIX_DIST`는 비교 빌드, `QA_FIX_OUTPUT`은 증거 폴더를 지정할 때만 사용한다. 운영/실제 AI 호출은 없다.
- `catalog-basics.test.mjs`는 교재 3,809개 기본 뜻과 생성 원본 지문, 사용자 수정/빈 뜻·개인 단어, 초기 의존성에서 전체 예문·이미지 목록 제외를 검사한다. `lazy-materials-qa.cjs`는 로컬 가상 계정으로 첫 화면의 자료 미요청, 모듈 실패·재시도, 편집 자료/탭 상태, 이미지 로딩 중 닫기·재접속과 전체 기록·revision 불변을 Chromium/WebKit에서 검사한다. `node scripts/prepare-catalog-basics.mjs`로 기본 뜻 목록을 만들고 빌드가 `--check`로 원본 일치를 확인한다.
- 자료 재시도는 정적 JS 캐시만 갱신한 뒤 명시적으로 페이지를 다시 연다. 학습 API를 재전송하지 않으며, 미저장/저장 중/복원 중에는 차단한다. `lazy-materials-qa.cjs`는 편집기와 공통 교재 파일 각각의 실패, 브라우저 이탈 취소, 재시도 중 편집창 닫기 후 늦은 재로딩 차단도 검사한다. 단어 목록 진입에는 전체 예문·이미지·문법 교재를 요청하지 않는다.
- `learning-chunks.test.mjs`는 초기 정적 의존성만 묶고 동적 교재 경계와 서버 빌드를 보존하는지 확인한다. 문법 도움말의 작은 목록은 `node --experimental-strip-types scripts/prepare-grammar-index.mjs`로 생성한다. 빌드의 `--check`가 원본 해시와 15개 품사·제목·역할·첫 예문을 대조하므로 생성 파일을 직접 수정하지 않는다.
- 비동기 편집기 검사는 로딩 중 대화상자가 아닌 실제 표현 입력란이 준비된 뒤 이미지·저장·레이아웃을 검사한다. `grammar-ui-qa.cjs`도 문법 목록 제목이 준비된 뒤 목록을 확인한다. 대기 없이 0개임을 확인해 잘못 통과시키지 않는다.
- `refactor-lifecycle-qa.cjs --drafts-only`는 뜻·회상 답·영작 초안의 탭 유지/목표 변경/종료 저장/재접속 및 axe만 실행한다. 새 수업의 초점 준비 후 입력한다. 타이머 구간을 생략한 결과는 전체 수명주기 검사 통과와 구분한다. WebKit 모의 시계의 초 단위 경계 오차는 변경 전 빌드에서도 재현되므로 이 모드를 사용하며, 전체 타이머 구간은 Chromium에서 확인한다.

- `learning-dates.test.mjs`는 재사용하는 날짜 포매터의 한국 자정·연말·윤일, 기본 날짜 갱신·입력 불변·잘못된 날짜 거부를 검사한다. `pending-reviews-render.test.mjs`는 실제 컴포넌트를 렌더링해 점검 없음/전체 제외 시 라벨 계산 생략, 완료·제외 회차를 포함한 번호와 최신 표시 보존을 확인한다.


- `grammar-content-review.test.mjs`와 `grammar.test.mjs`는 v4 교재342단위의 원장 무결성·출처 매핑, 정적30분석의 원문 보존, 버전별 정답·혼합 진도·구형426·전체/분할 복원·revision·실패 후 재시도를 검사한다. `grammar-v4-qa.cjs`는15수업·135기본/복습문제·정적분석·읽기·쓰기의 Chromium/WebKit 검사용이다. `grammar-v4-compat-qa.cjs`는 신규 생성 true/false 각각 별도 로컬 Worker에서 실행한다(`QA_NEW_GRAMMAR_VERSION=4` 또는3). false에서도 저장된v4를 읽고 기존3의 첫답·일정을 보존한다. 실제AI 호출은 모의 응답으로 대체한다.

- `pronunciation.test.mjs`는 동형이의어 16개·35항목의 품사/뜻 일치 보호, 개인 단어 fallback, 복수 발음 및 가족 번역을 검사한다. `pronunciation-qa.cjs`는 로컬 가상 계정의 오늘 학습·문장 연습·완료 기록·편집에서 사전 우선 표시, 다른 뜻의 IPA 제거, 기록 불변성, 320/390/1440px·200%·axe·키보드를 검사하며 `QA_BROWSER=webkit`을 지원한다. 사전 링크만 확인하며 외부 음원 재생·실제 iPhone 청취는 포함하지 않는다.

- `request-body.test.mjs` / `request-body-qa.cjs`: 저장·AI·전체/분할 복원 6개 경로의 스트림 조기 취소, UTF-8·문자/바이트 경계·허위 Content-Length·인증 선행·중단·원본 보존을 검사합니다. 로컬 Worker는 EOF 이전 413을 확인하고, 브라우저는 실제 거절 안내·입력 유지·정상 재시도·재접속과 320/390/1440px를 확인합니다. `QA_BROWSER=webkit`을 지원합니다. 운영 데이터나 실제 AI를 사용하지 않습니다.

- `state-roundtrip.test.mjs` / `state-roundtrip-qa.cjs`: 사용자 뜻 키의 안전한 저장·조회·전체/분할 복원과 계정 누적 5,000단어·10,000회차·UTF-8 20 MB 경계, 구형 복원의 문법 보존 합산, 동시 저장 및 원본 불변성을 검사합니다. 브라우저는 단어 편집·검증된 백업·실제 복원·한도 안내와 320/390/1440px·axe를 확인하며 `QA_BROWSER=webkit`도 지원합니다.
- 상태 왕복 검사는 세 가상 계정과 새로고침 모두 외부 폰트 CSS를 빈 로컬 응답으로 고정합니다. 한글 폰트 조각이 클릭 도중 적용되어 행이 이동하는 타이밍을 저장/복원 검사에서 분리하고, 폰트 파일 요청이 생기면 실패합니다. 기존 `node tests/state-roundtrip-qa.cjs` 명령을 그대로 사용합니다. 폰트 지연/실패 중 앱 조작은 `node tests/startup-render-qa.cjs`로 양 엔진에서 별도 확인합니다. 시스템 폰트 결과를 운영 웹폰트의 배치·실기기 검사로 해석하지 않습니다.
- `startup-render-qa.cjs --fonts-only`는 앱이 요청한 실제 Google CSS/WOFF2로 부분 폰트 로딩 중 클릭, 첫 클릭/Enter 도중 CSS 도착, 정상 로딩을 양 엔진에서 검사합니다. 320/390/1440px·200% 글자를 포함하며 일반 실행에도 포함됩니다. 최초 실행에는 Google Fonts 접근이 필요하고, 고정 Safari UA로 받은 원문을 Git 제외 `outputs/startup-render/font-assets/`에 캐시합니다. 응답·부분 폰트가 없으면 실패하며 대체 CSS로 통과시키지 않습니다. `font-assets.json`은 사용한 URL/응답 SHA를 기록합니다. 브라우저 캐시가 따뜻한 실제 iPhone 검사와는 별개입니다.

- `study-recovery-qa.cjs`: 저장 중 다음 카드 입력 → 다른 기기의 실제 revision 충돌 → 현재 입력 백업 → 실제 복원 → 이어 하기·재접속을 검사합니다. 문장·보완점·학습 뜻과 명시적 빈 값, 기존 성적·진행 위치 보존을 확인하며 `QA_BROWSER=webkit`도 지원합니다. 로컬 가상 계정만 사용합니다.

- `sheet-body-swipe-qa.cjs`: 단어 편집창 본문을 맨 위에서 아래로 당겨 닫는 동작, 기본 스크롤·입력·텍스트 선택 보존, 미저장 확인과 초점 복귀를 검사한다. Chromium은 브라우저 터치 입력도 사용하며 WebKit은 이벤트 계약을 확인한다. 실제 iPhone 조작은 별도 확인 대상이다.

- `ui-continuity-qa.cjs`: 다시 보기의 뜻별 선택·고정 이동·스크롤 복귀·보완점, 오늘 단어 출처, 빈 배정/기록의 복구 동선, 친숙도 진입, 저장 실패→재시도 표시를 로컬 가상 계정으로 검증한다. `QA_BROWSER=webkit`으로 WebKit 실행. 5폭×200% 글자·axe·기록 불변성 및 스크린샷을 포함한다. 세부 범위와 한계는 `UI_CONTINUITY.md`를 참조한다.

- `node tests/copy-density.cjs`: 기준 커밋과 현재 안내 컴포넌트를 같은 CSS로 비교한다. 4개 폭 × 글자 100/200% × 3개 화면에서 높이 증가·가로 넘침과 AI 필수 안내 누락을 검사한다. 결과와 이미지는 `outputs/copy-density/`에 저장한다. 정적 렌더링 비교이며 실제 화면 동작은 기존 브라우저 회귀 검사로 확인한다.

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

브라우저 검증은 프로덕션 빌드 후 로컬 Worker의 8787 포트에서 실행합니다. 각 `*-qa.cjs`를 Node로 실행하며, 로컬 임시 계정만 생성합니다. 배포 URL에 테스트 인증 헤더를 보내거나 운영 학습 기록을 수정하지 마세요. Playwright는 설치된 모듈 또는 `QA_PLAYWRIGHT_PATH`로 찾습니다.

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
- `dependency-security.test.mjs`: percent-encoded 호스트의 대소문자 정규화와 Undici BalancedPool의 사용자 connector 함수·거절 보존을 검사합니다. 외부 네트워크·실제 인증서를 사용하지 않으며 실제 TLS 검증 전체를 대체하지 않습니다.
- `startup-performance-qa.cjs`: 캐시 없는 390px Chromium·CPU 4배 지연의 초기 화면 3회와 자산 크기를 측정합니다. 다른 브라우저 검사를 함께 실행하지 마세요. 실기기·운영망 성능이 아닙니다. 최종 광역 결과는 `outputs/final-audit/`입니다.

- `state-delta.test.mjs`: 변경하지 않은 기록은 직렬화하지 않고, 값이 같은 복제본은 전송하지 않습니다. 실제 학습·이월·실패 후 재시도의 변경분으로 다음 상태를 재구성하고 기존 상태 불변성을 확인합니다.
- `history-performance-qa.cjs`: `PERF_OUTPUT`으로 출력 디렉터리를 구분할 수 있습니다. `SLOW_NETWORK=1`은 1,825회차에서 캐시를 끄고 150ms 지연·다운로드 500,000 B/s·업로드 125,000 B/s로 브라우저를 1회 측정합니다. 별도 API 클라이언트 측정에는 이 제한이 적용되지 않습니다. 운영망 성능으로 일반화하지 마세요.
- 추가 학습 저장 대기가 실패하면 `daily-topup-qa.cjs`가 상태 API의 메서드·상태 코드·소요 시간, 저장 배너·오류·학습 단계를 `save-wait-failure.json`에 남깁니다. 임시 로컬 계정만 검사합니다.

- `review-extension.test.mjs`: 목표 설정과 실제 주간/월말 대상 구분, 3→10 추가, 기존 모든 단계와 재시도 위치 보존, 뜻별 중복 방지, 월말 구간·추가 확장·백업 전이 검증.
- `review-extension-qa.cjs`: 기존 3개 주간/월말 회차에 추가 7개 반영, 미점검 수, 실패 후 재시도·새로고침·초안 보존, 구형 클라이언트 거부, 새 항목 전체 단계 완료와 과거 기록 보존. 로컬 임시 계정만 사용하며 `outputs/review-extension/`에 결과를 남깁니다.

## 기기 음성 UI 검사

- `device-speech-ui-qa.cjs`: 사진과 같은 quickly 학습 화면에서 준비·재생·오류·재시도·지원하지 않는 브라우저의 표시와 키보드 도움말을 검사합니다. Chromium/WebKit, 320/390/1440px·200% 글자·44px 터치·axe, 음성 조작 후 학습 revision/기록 불변을 확인합니다. 준비 상태 검사는 모의 시계로 실제 처리 속도에서 격리하고, 3,999ms·4,000ms 경계를 별도로 확인합니다. 공유 문법 문장은 실제 컴포넌트를 빌드 CSS가 있는 메모리 fixture에 렌더링해 초기 도움말·구체적인 오류·재시도를 검사합니다. 음성 이벤트와 학습 API는 모의이며 실제 iPhone 청취나 DB 저장을 증명하지 않습니다. 비교 이미지는 `outputs/pronunciation-ui/`에 저장합니다.

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

- `ui-plan-contract-qa.cjs`: 승인한 UI 계약의 후속 검사. 기록 탭 650px 위치와 펼침 복원, 상세창의 제목/닫기/저장과 본문 스크롤 분리, 키보드 모사, 5개 폭·200% 글자·16px 학습 내용·44px 조작·상태 아이콘·과거 성적 보존을 검사합니다. `UI_AUDIT_BASELINE=1`은 수정 전 재현 기록 전용입니다. 실제 iPhone 검사를 대신하지 않습니다.

- `study-layout-qa.cjs`: 실제 일일 회차의 8개 학습 화면 상태를 320/390/430/768/1440px × 100/200% 글자 크기로 검사합니다. 가로 넘침·44px 미만 학습 조작·브라우저 오류와 뜻/문장 성적 변경을 거부합니다. 로컬 격리 계정만 사용하며 증거는 `outputs/completion-matrix`에 기록합니다.

- `settings-dialog-qa.cjs`: 설정창의 반투명 배경, 16px 행 간격, 5폭×100/200% 글자, 고정 제목/닫기와 44px 조작을 확인한다. 시간 대기/오류/재확인, 저장 대기/오류/재시도, 충돌 백업/취소/명시적 재조회, 재접속 후 목표 값과 기존 성적 보존을 검사한다. 로컬 가상 계정만 사용하고 Google API는 호출하지 않는다. 상태별 axe 결과와 이미지는 `outputs/settings-dialog/`에 저장한다.

- 상태 표시 리팩토링: `learning-notices.test.mjs`는 32개 상태 조합의 설정 안내 우선순위와 페이지 표시 제외를 검증한다. `today-status.test.mjs`는 기록 완료와 보완 필요/회차 진행의 공존 및 내부 상태 코드를 검사한다. `learning-display.test.mjs`는 새 뜻·누락 기록을 포함한 월간/주간 점검 집계와 입력/배정 불변성을 검사한다. `settings-dialog-qa.cjs`는 설정창 닫기/키보드 재열기 전후 단일 복구 버튼과 기존 재시도 동작을 검증한다.

## 저장 계약·편집기 리팩토링

- `refactor-boundaries-qa.cjs`: 뜻 전환 확인·취소·Escape·재접속과 기존 성적 보존, 탭/WebMCP의 늦은 AI 응답 폐기·저장 실패 시 이동 차단을 검사한다. AI는 합성 응답만 사용한다.
- `grammar-input-performance-qa.cjs`: 모든 탭을 방문한 뒤 0/1,825회차의 문법 입력을 각 3회 측정하고 단어 기록·목표·회차 미변경을 확인한다. 기능 검사와 별도로 performance 그룹에서 실행한다.

- `editor-save-qa.cjs`: 저장·재시도 중 입력·뜻 전환·닫기와 중복 클릭을 차단하고, 실패 후 창 안에서 최신 입력을 다시 저장한다. 다른 편집창의 미저장 잠금, 시계 복구, 개인 단어 중복 방지, 실제 revision 충돌·백업/재조회, 재접속과 320/390/1440px·200% 글자·접근성을 검사한다. `QA_BROWSER=webkit`을 지원하며 실기기 검사와 구분한다.
- `response-contract-qa.cjs`: 서버가 저장했지만 성공 본문의 revision이 누락된 경우를 주입한다. 초안과 미저장 상태, 백업·명시적 재조회, 자동 재전송 없음을 확인한다.
- `learning-commands.test.mjs`: 단어장 수정·기억 깨우기·중단 초안의 불변성과 성적 보존을 검사한다. `learning-api.test.mjs`와 `state-api.test.mjs`는 잘못된 응답과 회차 내부 오류의 저장 거부를 확인한다.
- 공통 `tests/qa/runtime.cjs`는 Playwright·axe 경로와 loopback 주소, 충돌 없는 가상 계정을 제공한다. 특정 PC 사용자 경로는 소스에 넣지 않는다. `QA_PLAYWRIGHT_PATH`에는 설치된 Playwright 모듈 디렉터리를 지정하며, 생략 시 일반 모듈 해석을 사용한다. `AXE_CORE_PATH` 기본값은 `work/axe/package/axe.min.js`, `QA_BASE_URL` 기본값은 `http://127.0.0.1:8787`이다.
- 빌드한 로컬 Worker를 시작한 뒤 `npm run test:browser`로 기능 검사를 순서대로 실행한다. A1~B2 콘텐츠와 이미지 위치 재개 시나리오가 포함된다. `npm run test:performance`는 초기 로딩·장기 기록·문법 입력·백업 자원·이미지 위치 변경의 성능 다섯 검사를 단독 실행한다. 이미지 비교를 위해 `QA_BASELINE_URL`/`QA_BASELINE_DIST`에 기준 빌드의 별도 루프백 Worker와 빌드 폴더를 지정한다. 이미지 기능 검사는 플래그를 활성화하고 `QA_WORD_IMAGE_ASSET_ROOT`에 검토한 전체 WebP 폴더를 지정한다. `node tests/qa/run.cjs functional --list`와 `node tests/qa/run.cjs performance --list`로 실행 목록을 확인할 수 있다. `qa-runner.test.mjs`는 실제 두 목록 명령의 성공과 기능/성능 분류를 검사한다.
- 문법 버전별 전체 흐름은 해당 생성 플래그로 시작한 별도 로컬 Worker에서 직접 실행한다. v2는 v3/v4 false, v3는 v3 true/v4 false, v4는 v3/v4 true다. v4 호환 검사에서는 `QA_NEW_GRAMMAR_VERSION=3`(v4 false)과4(v4 true)를 각각 사용한다. 등록부는 전체 검사 목록이며 서로 다른 플래그를 요구하는 문법 사례를 하나의 Worker 설정으로 전부 통과했다고 보고하지 않는다.
- 실행 도구는 각 검사 전에 로컬 서버 응답 본문까지 확인한다. 재접속 회귀 검사는 브라우저 초점을 먼저 확보하고 이어가기 요청의 실제 저장 응답을 기다린다. 이전 저장 상태 표시나 검사 자동 재시도로 실패를 숨기지 않는다.
- 결과와 검사별 로그는 `outputs/browser-suite/<group>-<run>/`에 모인다. 실패·시간 초과·미완료는 전체 성공으로 처리하지 않는다. 각 브라우저 스크립트의 직접 실행도 유지한다. 실제 사용자 계정이나 운영 URL을 환경변수로 넣지 않는다.
- `manifest.cjs`는 전체 브라우저 검사 등록부다. 파일 추가·삭제를 등록부와 대조하며 누락을 거부한다. 기능/성능 실행은 공통 잠금으로 겹치지 않는다. `launchBrowser`와 `closeBrowser`가 컨텍스트·브라우저 종료를 공유하고, 시간 초과에는 IPC로 종료를 요청한 뒤 이 실행이 만든 프로세스 트리만 정리한다. 시간 초과 후 정상 종료해도 실패로 집계한다.
