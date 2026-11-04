# 통합 검사 후속 수정 · v144 게시 완료

사용자 “진행”을 게시12 승인으로 기록하고 기존 [하루단어](https://wordgrain-oxford-study.hoihou-o.chatgpt.site)에 **2026-11-04 22:28:51 KST v144**를 게시했다. 배포 `appgdep_6aeb32fea7b0819187342115c02777dc`는 succeeded, 소스는 `d41d4e72e9107747d10ae0a83122f0d5778a529a`다. Task Master와 기본 폴더4318 대시보드는 **상위12/12·세부41/41 완료**로 갱신했다. [배포 증거](releases/2026-11-04-integration-remediation-v144-rollout.json)와 아래 게시 전 검증을 구분한다.

검증 후보 `fcefe7c98244b2913e7b5f78601d890ea26423fd`와 전체 Git tree `934bdb8c868e663ba11d6abef0365c73081bc658`가 같다. 기존 Sites의36dc66f 이력에서 공식 helper로 연 `work/integration-remediation-publish-20261104`에 후보 tree를 적용하고, 706파일·직접 의존42개·기존 Site/DB/R2·SQL 불변을 확인했다. 빌드가 통과한 후 추가 검사에서 기존 `.env.example`을 실제 비밀 파일로 잘못 분류한 검사를 바로잡았다. 공식 패키저의 Node22 파일 복사 프로세스는 native code3221225477로 종료됐고, 같은 소스를 Node24.22.1 공식 helper로 패키징해 exit0·242파일을 저장/게시했다. 제품이나 플러그인 소스는 우회 수정하지 않았다. 최종 게시 checkout과 구현 후보는 동결하며 현재 관리 문서는 기본 폴더를 따른다.

게시 전후 환경revision77/14항목의 값 전체·public 접근revision6·자동화0·DB 바인딩/10테이블 이름과 hosting의 DB/R2 선언이 일치한다. 익명 GET 점검에서 홈200, JS/CSS13개와 출처1개가 게시 빌드와 SHA256 일치, 상태API401, 공개 서버시계200/`serverTime`만/no-store를 확인했다. 최초 점검기의 일반 `/assets/`·출처 루트 경로·시계 인증 가정을 실제 `/_next/static/`·`/sources/content-attribution.txt`·공개 시계 계약으로 바로잡았으며 실패 기록을 보존했다. 운영 제품 오류 수정이나 추가 배포는 없었다.

새 SQL·진단 이벤트·환경 변경·유료 AI·운영 학습 QA 쓰기는0이다. 이번 사용자 행 전체 대조·새 운영 DB 전체 백업은 미실시이며 메타데이터 일치를 전체 학습 상태 대조로 확대하지 않는다. v143 저장 버전과 소스 사본 `outputs/integration-remediation-deploy-20261104/rollback-v143-source.tar`를 보관했다. 복구 시 현재 운영/오류 확인 → 정상 OpenAI 전용 코드 재게시 → 환경/바인딩·읽기 검증 순서로 진행하며 역SQL·사용자 데이터 덮어쓰기·종료 기능 재활성화는 하지 않는다. 롤백은 실행하지 않았다. 실제 iPhone·VoiceOver·음성 청취·추가 유료 AI 품질·인증된 운영 학습 QA는 미실시다. 인증·요약 경계의 운영 회귀가 잔여 관측 대상이다.

## GitHub 게시 준비 · QA 중단 정리 보완

GitHub 브랜치는 `codex/integration-remediation-v144`, checkout은 `work/github-integration-remediation-20261104`이며 기준은 `github/main@5bbd7a6`다. 제품·공개 자산·DB·자료·SQL·hosting·package/lockfile·빌드 입력은 동결 fcefe7c/v144와 같다. 독립 검토에서 QA 준비/케이스 사이 중단 때 잠금·소유 Worker가 남는 결함을 재현해 QA helper와 회귀9파일만 별도 보완했다. 첫 INT/TERM과130/143을 유지하고 준비/상태조회 취소·중복stop을 검증했다.

수정 전 재현exit1을 보존했고 Windows Node22/24 집중16개씩 exit0이다. 최종 전체 단위는 각798/798·exit0, 전체 린트는 exit0·기존15경고/새경고0이다. 최초 전체 단위의 옛 결과 shape 기대값 실패exit1도 보존하고 `signal:SIGINT` 계약을 명시해 재검했다. 앞선 자료·타입·공식 빌드 exit0은 같은 제품/빌드 입력에 대한 결과다. [별도 GitHub 검증 근거](releases/2026-11-04-integration-remediation-github.json)를 따른다.

아래174조건·성능·706파일 지문·단위789는 동결 fcefe7c 및 동일 tree의 v144 당시 이력이다. 새 QA helper에서 전체 기능174조건/성능 모음을 다시 실행하지 않았다. 이 후속 QA 보완은 운영 제품 소스를 바꾸거나 새 배포·유료 호출을 실행하지 않는다. POSIX 전체 종료 보장과 실기기·추가 AI 품질은 미검증이다.

## 게시 전 로컬 구현·검증 기록

2026-11-04 사용자 “수정 착수 승인” 범위의 작업1~11 로컬 구현·검증을 완료했다. 전체 계획12/41 중38개 세부 작업 완료·게시12의3개는 보류다. 운영 게시·유료 평가·운영 학습 QA 쓰기는 실행하지 않았다.

- 구현 폴더: `work/integration-remediation-20261104`
- 브랜치/기준: `codex/integration-remediation-20261104` / `5bbd7a6d4d82e9aea86a0b0a8679242ba64e9535`
- 기본 폴더는 현재 `codex/feature-integration-qa-audit`이며 과거 main 표기와 구분한다. 기존 관리 문서의 미커밋 변경은 보존했다.
- Task Master·기존4318 대시보드의 원본은 기본 폴더다. 구현 상태·manifest를 양쪽 폴더에 동기화하며 이전 두 태그·평가 증거를 보존한다.
- 원시 근거: `outputs/integration-remediation-implementation-20261104/` (기본 폴더, Git 제외).

## 기준·환경

`baseline.json`에 제품/자료/검사637파일·기존 평가/검증32파일·과거 두 태그·계획 파일의 해시를 기록했다. 운영 읽기 조회는 v143·public revision6·automations0이며 실제 운영 로그인/학습 쓰기는 실행하지 않았다.

기본 폴더와 구현 폴더 모두 공식 잠금 설치 exit0, 직접 의존성42개가 lockfile과 일치한다. source-map-js1.2.2·sharp0.35.5 일치를 확인했다. 기본 폴더 단위781/781·exit0과 환경/runner 사전 검사3개·exit0을 확인했다. 기존84조건을 보존하고 인증·저장 요약2조건과 신규v3 호환1조건을 추가한87조건을 실행 목록에 연결했다.

로컬 Worker는127.0.0.1:8798·별도 D1/R2·가상 계정이다. SQL0000~0006은 검사 DB에만 적용했다. 실제 AI 생성 플래그는 false이며 사전 검사가 실제 상태 조회로도 이를 확인한다. 문법 버전/그림 원본 누락·비루프백/AI활성 조건은 검사 준비 오류로 구분한다.

## 제품 수정과 집중 검증

새 단위 검사에서 익명401의 잘못된 무효화를 재현했다(7개 중6통과/1실패). Chromium/WebKit의 정식 `auth-boundary-qa.cjs`도 각각 로그인 링크 대기에서 실패했다. 구문 준비 오류는 수정한 뒤 실제 원인을 다시 재현했으며 구문 오류를 제품 실패 근거로 사용하지 않았다.

로그인 수정 후 인증 단위7/7·exit0이며, auth-boundary/local-draft/ux-text는 두 엔진·startup-lifecycle은 내부 두 엔진 모두 exit0이다. 이 재현으로 과거v141 등의 startup/401 원인 미확정을 소급 해소하지 않는다. 익명401만 정상 로그인 경계로 취급하고 인증된 만료/계정 전환에는 폼·이전 초안을 계속 숨긴다. 만료 화면에 명시적인 로그인 링크와 새로고침을 제공한다.

저장 요약은 `current`의 미저장 입력 대신 마지막 성공 조회/저장/복원의 확인 스냅샷을 읽는다. 최초 미확인은 오류로 거절하고 읽기 사본을 반환하며, 폐기된 도구 handler는 사용할 수 없다. 수정 전에는 저장 진행 중 목표6을 요약해 서버3과 달랐고, 수정 후 두 엔진에서 진행/503/409에는3·성공 후6, 화면 입력6 유지·조회/복원/실패·탭 이동 쓰기0을 확인했다. `core-results.json`의9개 명령은 모두 exit0이다. 합성 WebMCP 등록 검사를 실제 플랫폼 지원으로 확대하지 않는다.

## 검사 정비와 통합 검증

현재 합성 AI에만 계약4·문맥 종류/노트/지문·모델·영수증을 부여한다. 과거 Google/Groq/structured 기록과 오류 사례는 보존했다. 상태 GET과 생성 POST를 분리하며 교정 비교 확인·이전 요청 GET 우선 정책을 그대로 검사한다. 잘못된 원문/문맥/모델/요청ID와 정상 응답, 명시 재시도·실패 뒤 저장만 재시도를 확인했다. 공개 `content-attribution.txt`의 옛 자동 전환 안내를 현재 OpenAI 전용 정책으로 정정했다.

문법 신규v2/v3/v4는 각자 소유한 로컬 Worker로 분리하고 저장v4/신규v3 호환을 추가했다. 전체 WebP3,809개·128,592,754바이트 SHA256 일치를 확인했다(`full-image-proof.json`). 자원 제한 Worker도 같은 합성 바인딩·AI false·전체7SQL을 사용하며 V8 96MB/4MB 제약은 유지한다. 비동기 route는 wait로 배출한 뒤 context를 닫는다. 프로세스/잠금·시간 초과·중단·실제 실패 검출 등 준비/수명주기7단위가 exit0이다. [재현 절차](INTEGRATION_REMEDIATION_QA.md)를 따른다.

Node22.22.2/24.22.1 단위 각각789/789·exit0, 문법 자료·타입·린트도 exit0이다. 린트는 기존15경고·새 경고0이다. 자료 지문 검사를 포함한 빌드는 exit0이다. 최초 추가 빌드의 EBUSY는 자신의 실행 중 Worker가 dist/client를 잠근 준비 오류였고 해당 Worker만 종료한 뒤 재빌드했다. 원본84+새3의 최초 전체 실행은 Chromium86/87·WebKit83/87로 **각exit1**이었다. 이 결과는 덮어쓰지 않았다. AI 후속 저장의 옛 결과를 기다린 대기와, 지연 화면 초기초점 전에 synthetic fill한 경합·초기 서버시간 응답 전에 모의 시간을 진행한 경합을 정비했다. 기존 수명주기 검사의 관찰 가능한 준비 조건을 재사용했으며 입력/날짜/정답 은닉/저장 불변 단언은 유지했다. 마지막 이미지 학습의 다른 뜻 전환도 같은 초점 대기를 적용했다.

바뀐6 QA와 반복pr38를 두 엔진에서14명령 재검해 모두 exit0이다. 변경하지 않은 조건은 원본 파일 지문을 대조했으며 공유 의존성과 제품 소스는 전체 실행 이후 불변이다. `verify-final-coverage.cjs`는 모든 변경 조건의 현재 지문과 재검 결과를 요구하고 **87×2=174조건**의 최종 커버리지를 exit0으로 검증했다. 최초 whole-suite exit1을 exit0으로 바꾼 기록이 아니다. `final-coverage.json`·`final-recheck-results.json`·`word-recheck-results.json`에 구분했다.

제품 소스 지문은 `01dbb306e20ce2939d95ecc4dd286efb7d5b972fe42915a85c0e15501882d2c5`, 제품+검사706파일 지문은 `b7e37162eeb5001aefd4647ffe3cbc9f7a1279577ebda0eef97dbaec49618147`이다. 실제 앱 예외 주입은 예상대로 exit1(`failure-detection.json`), 소유 문법 Worker6개의 포트는 종료됐다(`profile-cleanup.json`).

최종 성능5묶음은 모두 검증했다. 최초 전체 성능 모음exit1과, 주소가 같은 비교 준비 오류·올바른 기준에서19표본 후 발생한 준비 관찰 오류는 보존했다. 저장 배너가 텍스트 노드로만 바뀌면 기존 관찰기가 놓치는 최소 재현을 확인해 `characterData:true`만 추가했다. 저장됨+두 프레임·CPU4배·일반/느린망·0/365/1,825일·3회 반복 조건을 바꾸지 않고 **36표본·exit0**으로 다시 측정했다. 여섯 조건의 중앙값 차이는 -1.2~+7.2%였으며3회 표본의 관측값이지 일반 성능·실기기 보증이 아니다. 홈 그림/위치 요청0·연습 그림2·학습 상태/revision 불변이다. `performance-final-coverage.json`을 따른다.

최종 정적 재검도 Node22/24 각789·자료·타입·린트 exit0(기존15경고)이다. 추가로 그림 비활성4조건도 두 엔진 exit0이며, 소유 QA9포트·두 잠금은 종료/제거하고 기존4318 대시보드만 유지했다. [출시 검토 자료](releases/2026-11-04-integration-remediation.json)에 원시 근거 해시·검증 방법·위험·미확인을 묶었다. 초기 전체 실행의 nonzero를 최종 whole-suite exit0으로 표현하지 않는다.

## 운영과 미배포 차이·복구

21:43 KST 최종 읽기 재조회에서도 기존 Site v143·소스36dc66f·succeeded·환경77·public revision6·자동화0을 확인했다(`production-observation.json`). 21:00 KST D1 메타데이터 조회는 DB 바인딩·10테이블·잘림 없음이며 사용자 행은 읽지 않았다(`database-observation.json`). 운영 학습 API/DB 쓰기·환경 변경·게시·실제 유료 AI는0이다.

운영36dc66f와 이번 기준5bbd7a6 사이에는 **이미 미배포인15개 런타임 파일**이 있다. PR54 문법 앞뒤 공백 수용 경계 수정과 PR55 [피드백 책임 분리](OPENAI_FEEDBACK_REFACTOR.md)이며 이번 변경과 구분한다. 이후 후보 전체를 게시하면 이 차이도 함께 포함되므로 검토 범위에서 누락하지 않는다. 새 변경은 로그인/저장 요약5개 제품 파일·공개 안내1개와 검사/관리 문서다. 프롬프트·선택 모델·API/백업 envelope·SQL0000~0006과 DB/R2 식별자는 변경하지 않았다.

위험은 인증 경계와 읽기 요약 시점의 회귀, 테스트 프로필/종료 정리의 오판이다. 실패 시 당시 운영 상태와 승인 범위를 확인한 뒤 마지막 정상 OpenAI 전용 코드/저장 버전으로 복구한다. 역SQL·학습 기록 삭제·옛 백업 덮어쓰기·종료 카드/옛 AI 자동 대체 재활성화는 하지 않는다. 이번 수정의 새 마이그레이션0, 새 진단/분석 이벤트0이며 기존 비밀·개인 문장 비출력 규칙을 유지한다.

실제 iPhone·VoiceOver·음성 청취·외부 AI 품질·운영 장애 주입은 미확인이다. 게시12와 유료 평가는 별도 승인 전 보류다.


## 대시보드·검토 자료

현재/과거 플랜의 두 엔진 전환·실제 작업 수·파일 사본·자동/수동 갱신·오류 복구·320~1440px/100~200%·axe와 과거 세 회귀를 통과했다. 기존 회귀 기록 폴더 누락은 격리 fixture에서만 보완했으며, 완료 수가 두 자리가 된390px/200%에서17px 넘치던 통계는560px 이하 두 열로 보완했다. 이전 두 태그·32개 평가/검증·기본 폴더 제품637파일은 동일하다. 실제4318 서버는 계속 기본 폴더 원본을 읽는다.

검증용 SourceSnapshot SHA-256과 Git 기준5bbd7a6을 구분한다. 로컬 후보 커밋은 `outputs/integration-remediation-implementation-20261104/candidate-commit.json`에서 이 지문과 연결한다. 원격 push·PR·Sites 소스 동기화·저장 버전 생성·배포는0이다. Task Master의 게시12와 gate IR-G7은 명시 승인 전 보류를 유지한다.
