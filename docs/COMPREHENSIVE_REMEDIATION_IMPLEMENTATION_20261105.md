<!-- comprehensive-remediation-publication-current -->
## 현재 판정 · v146 운영 게시 완료

추가 사용자 승인으로 기존 Site에 v146을 게시했다. [게시 기록](COMPREHENSIVE_REMEDIATION_V146_ROLLOUT_20261105.md)·[native 영수증/검증](releases/2026-11-05-comprehensive-remediation-v146-rollout.json)이 현재 운영 근거다. 소스973/검증 입력737·빌드407대조, 공개 자산15·익명200/401/no-store, 환경77/공개 범위·DB/R2/기존SQL 유지 확인. 실제 AI/운영 학습 QA·GitHub 작업0. 아래32/33·79/81·게시 미승인/미실시 표현은 이전 로컬 완료 시점의 기록이다.
<!-- /comprehensive-remediation-publication-current -->

<!-- comprehensive-remediation-final -->
## 최종 로컬 판정 · 출시 준비 완료

감사29항목의 승인된 구현·통합 검증·출시 준비를 완료했다. Task Master 상위32/33·세부79/81 완료이며 #33 게시/세부2개는 미승인 보류다. [출시 준비 패키지](COMPREHENSIVE_REMEDIATION_RELEASE_READINESS_20261105.md)와 [최종 근거·해시](releases/2026-11-05-comprehensive-remediation-readiness.json)가 현재 판정이다. Node22/24 각838개, Chromium/WebKit 원본 각87개, 집중16사례/보호 제거 대조, 성능5개+느린망1825회차, Linux17개, 대시보드5+17+18+15개 및 보존 검증이 exit0이다. lint 기존15경고, 알려진 npm 권고0건. 추가 타입/집중 lint도 exit0이다.

게시·commit/push/PR·유료 AI/운영 학습 QA·실기기는 실행하지 않았다. 두 엔진 전체 실행은 같은 최종 제품 빌드의 원본을 완주했고 QA 준비 보완 후 영향 사례를 두 엔진에서 재검증했다. Chromium과 WebKit의 정확한 실행 폴더, 단위/빌드/성능의 명령 및 실패 이력은 기계 판정에 연결했다. 아래는 각 실행 시점의 경과이며 중간 미완료/실패 표현을 현재 미완료로 읽지 않는다.
<!-- /comprehensive-remediation-final -->

# 광역 감사 후속 수정 구현 기록 · 2026-11-05

사용자 `개선 착수 승인`에 따라 기존 SOURCE와 `codex/comprehensive-defect-audit-20261105`에서 구현·검증·출시 준비를 진행한다. tag `comprehensive-remediation`, planId `comprehensive-remediation-2026-11-05`를 유지한다. 게시·실제 AI 품질 평가·commit/push/PR은 별도 승인이다.

## 기준과 상태

- 시작 HEAD: `5609a8e6fa7d148ff4cf6582ae20fe0ed2669171`.
- 구현 시작 스냅샷: ROOT의 `outputs/comprehensive-remediation-implementation-20261105/baseline.json`.
- 기존 세 태그·닫힌 평가/예산·감사5파일·원시2,089파일을 보호한다. 계획 검증 결과는 당시 기록으로 유지하고 제품 검증을 별도로 남긴다.
- 현재 작업 수와 상태는 Task Master 및 기존 대시보드에 동기화한다. 아래 집중 검증은 통합·게시 게이트와 구분한다.

## 검증·실행 범위

가상 계정과 루프백의 기존 QA 절차를 사용한다. 신규 학습 AI 호출·운영 학습 행 조회/QA 쓰기·추가 OOM/부하 재현·실기기/VoiceOver는 실행하지 않는다. DATA-1의 제한 Worker fatal1회/운영128MB 미검증과 과거 WebKit85/87·Node24 최초799/800 이력은 그대로 보존한다.

## 복구·호환성

API/백업 envelope·revision 원자성·최초 답·도움·독립 성적·문법 진도·한국 날짜 계약을 유지한다. 새 SQL·Site/DB/R2 변경은 계획하지 않는다. 변경 실패 시 해당 코드만 되돌리며 학습 기록 삭제/원장 재개/역SQL로 복구하지 않는다. 비밀 값과 개인 문장·답변은 진단에 남기지 않는다.

## P1 구현 진행

- 공통 기준 #1 및 세부1.1/1.2 완료. 현재 사용자 승인·경로/브랜치/HEAD·portable/Node22·QA 루프백 거절과 기존637제품/32평가/7동결·3태그·2,089원시 근거 해시 확인.
- UI-5: 첫 mount에서 타 계정 초안을 삭제하던 connect를 검증된 상태 GET 완료까지 보류한다. 현재 페이지 세대와 기기 owner marker 변경도 확인하므로 늦은401/200 응답이 새 owner를 되돌리지 못한다. 정상 전환·로그아웃은 유지한다.
- AI-6: 문장 변경의 자기점검/의견만 초기화하고 과거 완료일·독립 review/schedule은 보존한다. stage5의 새 자기점검은 여전히 필요하다. 문장 재완료로 과거 완료일을 덮거나 legacy 기록에 새 복습 일정을 만들지 않는다.
- 이 중간 상태는 구형 reader의 스키마와 다르므로 문법 **클라이언트 프로토콜5**를 사용한다. 콘텐츠 버전은1~4 그대로다. 구형 요청은 새 중간 상태 읽기/덮어쓰기/전체·분할 복원에서426으로 보호하고, 무관한 단어 저장과 기존 기록·백업 reader는 유지한다.
- 새 핵심 회귀8개 수정 전 실패(exit1). 확장 집중81/81·전체 단위810/810, 타입·빌드 exit0, 린트 exit0(기존15경고). 초안 Chromium 합성 브라우저 회귀 exit0. 실제 built Worker/D1의 두 엔진 P1 회귀는 진행 중이며 아직 #2/#3 완료로 표시하지 않는다.
- 원시 로그는 ROOT의 `outputs/comprehensive-remediation-implementation-20261105`와 SOURCE의 `outputs/comprehensive-remediation-browser`에 보존한다. 운영 게시·실제 AI·학습 행 조회/QA 쓰기0.

## P1 게이트 완료
두 엔진 모두 실제 built Worker/가상 D1의 지연 A SSR→B 기기 초안→A hydration에서 B row1/ownerB 유지·A GET401을 확인했다. 문법은 수동 수정·저장·reload·합성 AI 제안 적용·되돌리기·자기점검·재완료 뒤 독립 passed2/사용세트/최근 review/과거 완료일이 유지되며 PUT6회 모두200이다. 실제 provider0, 가상 응답1회/엔진. #2/#3·세부6개와 CR-G1 완료. 다른27항목·통합 품질·출시 준비는 미완료다.

## 초안·문법·UUID 후속 수정

- UI-4/#7: AI-6 공통 문장 변경을 복구에도 사용하고, 완료 이력과 새 자기점검을 구분한다. legacy에 modern frame/checks를 섞지 않는다. 두 엔진에서 미완료 초안 복구 후 실제 PUT200과 독립 passed2/review/schedule/완료일 보존을 확인했다.
- AI-1/#8: 공유 feedbackOriginalMatches를 저장 검증에도 사용해 raw/trim 두 표현만 허용한다. SPACE/TAB/LF/NBSP와 원문 보존·내부 공백/다른 문장 거절 단위/API 집중62개 및 두 엔진 합성 v5 피드백 실제 저장200 확인.
- UI-1/#5: 복구/undo에서 현재·서버의 공개/도움/발음 이력은 단조 보존하고 공개된 최초 답은 후보로 덮지 않는다. 두 엔진 실제 D1 결과 help/hintEn=true/enAnswer 원래값을 확인했다. 변경 가능한 필드의 undo 지문은 실제 병합 결과를 사용한다.
- UI-2/#6: commit 전에 question/instance/값 지문의 정확한 row를 캡처하고 성공 응답만 compare-and-remove한다. 두 엔진 정상 문장21개 완료 뒤 완료 초안0·capacity 경고0. 실제 hook의 실패 승인·더 최신 입력·다른 탭 입력 보존을 Chromium/WebKit에서도 확인했다.
- UI-3/#4: replacement load/restore 구간만 문법 입력을 잠그고 hook 변경도 막는다. 일반 저장·실패 후 편집은 유지한다. 두 엔진의 저장소 거부/QuotaExceeded 각각에서 유효 합성PUT409+실제 D1 GET200 지연 중 입력이 잠겼고 epoch 이후 실제 D1·입력·기기 보관을 관찰했다. 합성409를 실제 충돌 발생으로 부풀리지 않는다.
- AI-2/#9: 유효한 동일 UUID의 명시 종결 receipt만 acknowledge한다. 실제 receipt GET의 DB 실패503/receipt없음도 pending. 집중22개 통과, 두 엔진 실제 React hook에서 word/grammar 모두 응답 유실→조회503→다음 명시 클릭이 같은UUID GET이며 새POST0임을 확인했다. 401은 파서 경계의 보존 검사이며 실제 인증UI가 재요청을 차단하는 동작과 구분한다.
- 집중27/62/22, 관련 린트 exit0. 초기 harness 연결 순서/타입 선언 오류는 제품 결함과 분리해 수정·재검증했다. 전체 Node22/24 및 전체 브라우저 품질은 #31에서 최종 변경 상태로 재실행한다.

## 입력 경계·판단·운영 안내 후속

- DATA-1: 배열 length/레코드 키 개수와 기존 도메인별 한도를 Object.entries/values 및 Zod 이전에 검사한다. 리터럴 뜻 키 처리와 한도 초과 과거 서버 기록의 읽기/내보내기를 유지한다. JSON 파서나 엔진의 키 수집 할당을 완전히 제한했다는 주장은 하지 않는다. 작은 프록시/101개 항목 검사 및 실제 로컬 SQLite API의400·revision 불변을 확인했다. 추가 OOM/부하 재현0, 운영128MB 미검증.
- AI-3/4/5: 명령문 whitelist 의존 제거, 양방향 발화행위 보호, 수량 순서/부호 및 절별 부정 연결 보완. 검증 버전 judgment-v6, 프롬프트 reference-v5·AI 클라이언트4 유지. 과거 v5 의견은 보존하고 현재 결과로 오인하지 않는다. 재평가/자동 호출0. 고정된 전환 전120요청 fixture는 보존하고 의도된 v6 provenance 차이만 독립 assertion 후 정규화하여 비교한다.
- DOCS-1: README의 현재 복구 진입점을 OpenAI 운영 절차로 바꾸고 구조 문서는 도입 이력으로 명시했다. 실제 차단 스위치 ai_feedback_enabled와 reader/백업 보존 순서를 안내한다.
- OPS-1: 공개 자료 생성기의 전송 안내를 현재 OpenAI 명시 요청 정책과 일치시켰다. 임시 폴더에서 실제 생성기를 실행하여 배포 중 공개 정책 블록과 동일함을 확인했다. 공개 데이터 일괄 재생성은 하지 않았다.
- 검증: DATA/API/백업33/33, 확대 DATA/복원/기록/판단/120요청 비교36/36, 판단 중심42/42, 문서·실제 생성기2/2 exit0. 중간 전체818/822 실패4건은 v6 비교의 의도된 차이·거절 사유 순서·에러 문구·과거10001회차 읽기 경계였으며 해당 확대 검사에서 수정 확인했다. 최종 전체 검사는 통합 단계에서 다시 수행한다. 타입 검사 exit0. 통합·품질·게시 완료를 뜻하지 않는다.

## 대시보드·QA 도구 소유권 경계

- DASH-1: registry 바이트를 source hash에 포함하고 검증된 live catalog를 교체한다. 새 플랜/라벨/이력 예산이 재로딩 없이 반영된다.
- DASH-2: 성공한 JSON 가져오기와 플랜 전환이 조회 세대를 무효화한다. 오래된 성공/실패/finally가 가져온 사본이나 새 조회를 덮지 않으며 명시적 원본 복귀는 유지한다.
- DASH-3: 실제 Node normalizer에서 named tag는 tagged tasks 또는 같은 planId를 요구한다. master의 구형 bare 배열 지원은 유지한다.
- 기존4318 서버의 ROOT health identity·프로세스를 확인하여 변경한 런타임2파일을 관리 원본에 반영하고 서버를 다시 시작했다. 새/과거 플랜·현재33/81·진행률·새로고침·보존 검사15그룹, 신규 Node/두 브라우저5개, 기존15·18그룹 exit0. 계획 당시 원시 실패 기록과 보고서는 보존했다.
- OPS-3: .recovery의 배타적 생성으로 stale 판독/회수/새 소유자 생성을 직렬화한다. 중단된 보조 잠금은 fail-closed이며 PID와 suite 종료 확인 후 수동 복구한다. 단순 재조회 후 unlink 방식이 아니다.
- OPS-2: isolated resource Worker에 준비 전부터 소유권 정리를 설치했다. 시간 초과 IPC와 신호가 별도 그룹·후손 종료 및 로그 닫기를 기다린다. leader가 먼저 종료해도 살아 있는 후손을 정리한다. 정상 종료도 await한다.
- TEST-3: 합성 준비 마커를 임시 파일→rename으로 게시하고 완전한 PID/포트 JSON만 준비 완료로 읽는다. 정리에서 재파싱 오류가 최초 실패를 가리지 않으며 이미 확보한 소유권을 우선 사용한다. 최초 EOF 발생 원인은 확정하지 않는다.
- 검증: Windows 잠금/프로세스6·중단7·격리 Worker4개 통과. Ubuntu-24.04의 실제 Linux Node22.22.2에서 같은17/17 exit0, 포트 종료·자식 정리·검사 부모 생존 확인. 실제 메모리 고갈/부하/운영 Worker 검사는 아니다.

## AI QA positive control·저장 대기

- TEST-1: refactor-boundaries/navigation/request-timeout의 늦은 의견에 실제 요청 UUID 영수증과 현재 OpenAI 모델/context·v6 provenance를 사용한다. 동일 문법·단어 fixture의 활성 요청은 실제 로컬 D1에 저장되고 새로고침 후 유지되는 positive control을 추가했다. Back/tab/tool/시간 초과의 지연 응답은 미부착이며 전송 결과 fulfilled/aborted도 구분한다. 이번 두 엔진의 해당 전송은 fulfilled였다.
- 격리 실제 useGrammarFeedback 훅 재생은 실제 응답/영수증 parser를 유지하고 abort에 무관하게 끝나는 합성 promise로 훅의 generation/abort 경계만 검사한다. 정상 두 엔진: 활성1·무효화0. 별도 번들에서 invalidate의 generation/abort를 제거한 변이는 활성1·무효화1이 되어 실제 assertion exit1이었다. 소스 파일은 변이하지 않았으며 여러 제품 보호 중 한 경계를 분리한 근거다. 전체 앱 보호를 한 줄 제거만으로 우회했다는 주장이 아니다. 최초 변이 빌드의 CRLF 패턴 불일치는 보존하고, 실제 부착 assertion까지 도달한 후속 로그로만 변이 검증을 판정했다.
- TEST-2: 즉시 isEnabled assertion을 의미 있는 요청 준비 상태 폴링으로 바꾸고, 문법 의견의 정확한 context/provenance가 로컬 D1에 반영될 때까지 대기한다. 기존 구조·호환·성적·화면 assertion은 유지했다.
- 검증: refactor-boundaries/navigation/request-timeout/sentence-structure 4개 원본 스크립트가 Chromium·WebKit 모두 exit0. 새 훅 정상4시나리오 exit0, 보호 제거 변이의 stale-attachment assertion exit1 확인. build·typecheck·집중 lint exit0(새 훅 타입은 통합 검사에서 다시 확인).

## 의존성 정비 진행 · 검증 중

- 원래23개 권고의 공식 GitHub advisory 범위 및 Zod4 migration/수정 commit을 확인했다. 목록은 SOURCE outputs/dependency-official-sources.json. 의존성 위험을 현재 앱의 실제 RCE/장애로 표현하지 않는다.
- 후보 설치: undici7.30.1, Vite8.1.6, Next/eslint-config-next16.4.1, Zod4.6.6, fast-uri3.1.9, typescript-estree 하위 minimatch11.0.1. 기존 minimatch3 소비자는 유지한다. Wrangler 번들 내부 pnpm/undici@7.30.1 경로를 별도 확인했다.
- Wrangler4.153.0 단독 override는 기존 Cloudflare Vite1.37.1의 unstable API와 충돌하여 build exit1이었다. Cloudflare Vite1.66.0/Wrangler4.154.0 대응 조합은 build를 통과했다. workers-types5.20261023.1 및 Miniflare5 beta/workerd1.20261023.1 변화는 통합 검증 대상이다. 사이트 식별자/바인딩/compatibility_date는 바꾸지 않는다.
- Zod4의 enum record 전수 키 요구를 partialRecord로 바꾸어 문법 일부 진도·빈 상태를 보존했다. 고정 진단 어휘를 유지하기 위해 누락 enum의 존재만 일시 확인하며 원문/오류 input을 진단에 보관하지 않는다. 사전 컬렉션 제한은 그대로 유지한다. 첫 전체830/831의 누락 enum 진단1건을 수정한 집중102/102 exit0. 타입 검사 exit0. 최종 전체는 미실시.
- OG1.0.3→Satori0.33.5는 수정된 SVG escaping을 포함한다. 새 Satori의 fflate0.7.3 유입을 발견하여 공식 수정0.7.5로 제한했고 audit0을 확인했다. 원래23권고에 이 새 유입1건을 합산/재분류하지 않는다.
- 그러나 Vinext beta5에서는 새 OG가 Node ESM의 fs require 및 실제 Worker의 self.location.href 경계에서 실패했다. 임시 로컬 PNG route의 실제500을 보존했고, hash 확인 후 임시 route는 제거했다. 설치본 archive를 비교하여 beta9~12에는 없는 HarfBuzz 대응이 beta13부터 있음을 확인했다. 최초 안정1.0.0도 검토했으나 더 작은 변경인 beta13과 요구 RSC0.5.34 조합으로 검증을 이어간다. 관련 공식 소스: https://github.com/cloudflare/vinext/blob/vinext@1.0.0-beta.13/packages/vinext/src/plugins/og-harfbuzz.ts . 설치 중 네트워크 ECONNRESET1회는 재시도 중이며 완료로 세지 않는다.
- 시스템 Node22.22.2/내장6.24.1은 npm override로 바뀌지 않는다. 별도로 공식 SHASUMS256과 대조한 로컬 Node22.23.4/내장6.29.1 및 Node24.22.1/내장7.30.1을 SOURCE work/toolchains에 준비했다. 전역 설치/설정 변경0. 이후 검증은 이 격리 runtime으로 실행한다.

### 의존성 후보의 최종 선택과 집중 확인

| 감사 작업 | 적용한 조합 | 확인 |
|---|---|---|
| DEP-UNDICI | 외부7.30.1 / Wrangler4.154.0 사전 번들7.30.1 / Cloudflare Vite1.66.0 | npm override와 번들 내부를 별도 확인. Node22.23.4의6.29.1·Node24.22.1의7.30.1은 공식 SHA 대조한 격리 배포본 |
| DEP-VITE | 8.1.6 | 5권고 수정 범위. 소비자 조합의 최종 build exit0 |
| DEP-ZOD | 4.6.6 + partialRecord/제한된 진단 분류 호환 | 빈/일부 문법 진도·API/백업/최대 기록/진단102개 exit0. 추가 OOM 재현0 |
| DEP-SATORI | Vinext beta.13 + RSC0.5.34 → OG1.0.3 → Satori0.33.5 / fflate0.7.5 | beta9~12 archive에 없는 HarfBuzz 대응이 beta13에 존재. 실제 로컬 Worker PNG200·1409bytes. 임시 route hash 확인 후 제거·최종 build에서 해당 route 없음 |
| DEP-NEXT | Next/eslint-config-next16.4.1 | 3권고 수정 범위. 운영 RCE 재현 주장 없음 |
| DEP-FASTURI | 3.1.9 | schema-utils/Ajv의 상대 schema 참조·정상/부정 입력 소비자 검사 exit0; 네트워크 조회 없음 |
| DEP-MINIMATCH | typescript-estree 하위11.0.1 | 실제 소비자의 named API/dot-file 정책 확인. 기존 minimatch3.1.5 유지 |

- npm ls 대상 tree exit0, 최종 npm audit0(정보/낮음/중간/높음/심각 모두0), postinstall braces guard 유지. 이 결과는 알려진 패키지 권고와 일반 동작의 확인이며 악성 TLS/SSE/SVG/glob/ZIP 공격·운영 악용 재현이 아니다.
- 최초 설치/빌드/PNG 실패 로그는 보존했다. 수정된 조합에서 전체833개 예정 단위·두 Node·두 브라우저·성능 및 느린망 검증은 아직 통합 단계에 남는다. 의존성만 갱신하여 전체 품질이 통과했다고 판단하지 않는다.
- 범위: Sites 식별자·DB/R2·환경·compatibility_date 변경0, 새 SQL0, 전역 Node 설치 변경0. Miniflare5 beta 및 Vinext/RSC 변경은 통합/출시 위험에 포함한다. 시스템22.22.2의 내장6.24.1은 남아 있으므로 이번 검증의 격리 runtime과 구분한다.

검증 재실행 예(해당 SOURCE에서, 세션 PATH만 변경):

```powershell
$env:PATH=(Join-Path (Get-Location) 'work/toolchains/node-v22.23.4')+';'+$env:PATH
npm test
npm run typecheck
npm run lint
npm run check:grammar-review
npm run build
npm audit
```

공식 확인일2026-11-05. 원래23개 URL/범위는 `outputs/dependency-official-sources.json`에 보존했다. 주요 출처: [Undici](https://github.com/advisories/GHSA-4qv8-2p9j-2685), [Vite](https://github.com/advisories/GHSA-698v-4r3x-3vcv), [Zod 수정](https://github.com/colinhacks/zod/commit/a0ebf97)·[migration](https://zod.dev/v4/changelog), [Satori](https://github.com/vercel/satori/security/advisories/GHSA-wx4j-mvgx-mqwp), [Vinext HarfBuzz 대응 소스](https://github.com/cloudflare/vinext/blob/vinext@1.0.0-beta.13/packages/vinext/src/plugins/og-harfbuzz.ts), [Next](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [fast-uri](https://github.com/fastify/fast-uri/security/advisories/GHSA-w74x-v6f9-j3xg), [minimatch](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249), [추가 유입 fflate 수정 범위](https://github.com/advisories/GHSA-px8p-9vwx-vf98), [Cloudflare Vite 대응 릴리스](https://github.com/cloudflare/workers-sdk/releases/tag/@cloudflare%2Fvite-plugin@1.66.0), [Node 공식 배포 목록](https://nodejs.org/dist/index.json).

- 운영 계약 보완: 새 Cloudflare 플러그인은 compatibility_date 기본값을2026-10-23으로 바꿨다. ROOT 기존 dist와 초기 QA profile의2026-05-15를 대조하여 vite.config.ts에 기존 날짜를 명시했다. 환경/바인딩 변경 없이 이 날짜의 PNG·최종 빌드를 다시 검증한다. 패키지 기본값 변화를 운영 날짜 변경으로 흘려보내지 않는다.

## 통합 검증 진행

- 보존 날짜2026-05-15로 실제 Worker PNG200·1409bytes를 다시 확인했다. 임시 route 제거 후 최종 build exit0·해당 route 없음·기존 date 일치, 최종 타입 exit0. 전체 lint exit0/기존15경고, grammar v4 source/hash 검사 exit0. 시험 코드 변경 후 해당 lint도 exit0.
- Node22.23.4 첫 전체831/833 실패2건은 Miniflare5의 생성자 API가 더 이상 단일 script/modules 플래그를 받지 않기 때문이었다. 실제 설치 schema에 맞게 workers[].config.manifest와 dev.outboundService로 이동했다. 실제 workerd·로컬 응답 가로채기·모든 모델/두 계약401 처리·redirect 미추종/자격 증명 보호 단언은 유지했다. 집중2/2 후 전체 재실행 Node22.23.4 **833/833**, Node24.22.1 **833/833**, 모두 exit0.
- 현재 원본 functional87개를 기존 source inventory로 Chromium→WebKit 순차 실행 중이다. QA_BASE_URL은 소유한 루프백 Worker, 실제 AI 비활성, 승인된 기존3809 WebP 경로를 사용한다. 결과 완료 전에는 브라우저 게이트를 통과로 표시하지 않는다. 최종 성능5개·느린망·Linux/대시보드 통합 판정 및 출시 준비는 남아 있다.

### 첫 native 통합에서 발견한 후속 경계

- 첫 Chromium 원본 전체87개는83통과/4실패로 종료했다. 실패는 request-body(413 헤더 후 route.fetch ECONNRESET), 독립 feedback-correction harness의 합성 owner 미확인, 단어 의견 재요청2건이었다. 기록과 원본 case 결과는 보존한다. 진행 중 WebKit은 이전 built artifact를 사용하며 최종 판정이 아니다.
- 단어 오류 정규화가 유효한 failed receipt를 버리는 경계를 찾았다. 학습 API transport 회귀가 수정 전10/11(exit1), 검증된 metadata만 보존하도록 수정 후 회복 정책과22/22(exit0). 원문/임의 오류 필드는 전달하지 않는다. 누락/잘못된 영수증은 계속 pending이다. AI-2의9.2/9.3 및 변경 후 전체31.1을 재검증 상태로 갱신했다. 앞의833/833은 이 후속 코드 전 상태의 결과다.
- 독립 correction harness는 계정 API가 없으므로 명시적으로 고정 합성 owner를 connect/confirm하도록 구성했다. 실제 앱의 인증 확인 보호는 유지한다.
- request-body는 Node APIRequestContext의 응답 버퍼링 대신 browser route.continue로 동일한 초과 upload를 실제 Worker에 전달하고 브라우저 response의413을 관측하도록 변경했다. 6개 스트리밍/Content-Length 조기 거부·D1 불변·입력 보존·수정 후 단일 재저장 단언은 유지한다. 아직 해당 변경 통과를 주장하지 않는다. 관련 공개 근거는 [workerd unread-body 경계](https://github.com/cloudflare/workerd/issues/7634)와 [Playwright 초기 거부 경계](https://github.com/microsoft/playwright/issues/42074)이며 현상 일치에 대한 참고이고 운영 장애의 입증이 아니다. 서버에서 무조건 본문을 읽거나 자동 재시도하는 우회는 추가하지 않는다.
### 통합 후속 수정의 집중 결과

- 오류 본문을 읽지 못해도 이미 받은 비성공 HTTP 상태를 보존한다. deadline/사용자 취소 및 성공 응답의 malformed JSON은 그대로 실패한다. 413 고정 안내는 상태를 실제 받은 경우만 사용하며 추가 요청은 하지 않는다. 해당 회귀는 수정 전11/12, 수정 후 영수증/복구와32/32(exit0).
- 새 judgment-v6를 판정·교정 참고/수업 목표 안내에 포함했다. 렌더링 회귀는 수정 전7/8, 수정 후8/8(exit0). 과거 버전 표시는 유지한다.
- 후속 native 검사에서 단어 의견·교정 harness·시간 초과는 두 엔진 exit0. 첫 WebKit purpose-improvements의 검색 미발견은 후속 두 실행에서 통과했고 원인은 확정하지 않는다. 실패 시 public 검색어/버튼 목록을 남기는 진단을 추가했다.
- 초과 native upload는 Chromium에서도 간헐적으로 상태 도착 전 reset이 관측됐다. 실제 413를 받은 경우와 상태를 받지 못한 network failure를 분리하여 입력/D1 불변을 단언한다. 추가로 실제 로컬 Worker의 작은413 JSON을 bounded Node HTTP relay로 전달해 원래의 413 오류 표시·입력 보존·수정 후 단일 저장/reload·세 폭 검사를 유지했다. WebKit 해당 경계 exit0. relay를 native 직접413 성공으로 표현하지 않는다. 운영 영향·빈도·실기기 재현은 미검증이다. 서버의 제한/취소를 늦추거나 본문 전체를 강제로 읽는 변경은 없다.
- 레이아웃 집중 실행의 다음 실패는 SOURCE 기본 axe 경로가 없는 실행 환경 오류였다. ROOT의 기존 axe 경로를 명시한 재실행으로 접근성까지 다시 검증한다. 실패 로그는 보존한다.
- 최종 transport 수정은 unreadable 본문 중 실제 받은413만 예외적으로 보존한다. 첫 광범위 처리에서 기존401/복원 검증2개가 실패한 로그를 보존했고, 범위를 좁힌 뒤 기존 계정 무효화·복원까지 집중48/48 exit0, 전체 Node22.23.4와24.22.1 **각838/838 exit0**, 타입/린트/빌드 exit0. 린트는 기존15경고이며 새 오류0. 문법 자료 검사는 앞선 동일 자료에서 exit0. 단위 로그 전체의 실패 목록·요약과 실행 exit를 직접 대조했다.
- 최종 request-body fixture는 native full upload의 status 도착 여부/안전한 실패를 기록하고, 같은 초과 Content-Length를 실제 Worker가 본문 수신 전에413으로 거부하는 상태를 중계한다. 중계 본문은 비어 있으므로 실제 클라이언트의413 fallback도 검사한다. JSON 자체 중계를 시도한 후속 reset 로그도 보존했다. 새 방식의 request-body 및 레이아웃/axe는 각각 두 엔진 exit0. 직접 업로드와 중계 검증의 차이를 최종 위험 표에도 유지한다.
### 최종 native 실행의 초점 준비 경계

- 같은 제품 빌드의 Chromium 원본87/87 exit0, WebKit 원본85/87 exit1이었다. 실패는 purpose-improvements와 study-controller-render이며 새 실행 폴더와 실패 화면/JSON을 보존했다. 첫 전체(Chromium83/87·WebKit82/87) 및 과거 감사85/87과 구별한다.
- purpose 진단은 would 입력 시 query=train과 train 버튼 초점 복귀를 보여줬다. 닫기 후 두 프레임의 destination focus와 빠른 fill이 겹치는 정황을 확인하여, 고정 sleep/재입력 대신 실제 trigger 초점 복귀를 기다리고 검색값 자체도 단언한다.
- controller harness는 질문 heading commit 뒤 focus effect 준비를 관찰한다. 현재 답 반영을 먼저 확인하고 늦은 setter를 flushSync로 실행하여 그 렌더가 끝난 뒤 답/AI lock 불변을 검사한다. 제품의 generation/abort 보호는 바꾸지 않았다. 하네스의 비공개 question 필드 가정으로 난 타입 오류1회와 당시 browser pass는 최종 근거에서 제외했다. 공용 studyQuestionKey로 고친 타입/집중 lint exit0 및 두 엔진 집중 실행 exit0을 최종 근거로 사용한다. 최초 빈 답의 정확한 이벤트 순서는 기록하지 않았으므로 해당 실패만으로 제품 stale setter 결함을 확정하지 않는다.
- 이 변경은 QA3파일뿐이다. 앞의 Node22/24 각838/838과 제품 빌드 결과는 같은 런타임 소스의 근거다. WebKit 원본 전체를 다시 실행하여 focused pass만으로 전체 통과를 대신하지 않는다.
- WebKit 재실행 초반의 local-draft 실패는 UI-2 다른 탭 검사에서 복구 완료 전에 새 입력을 쓰던 준비 경계였다. 원래 탭의 보관은 available/active=true와 Newer 초안1개로 유지됐다. 새 탭에서 기존 Newer 초안의 복구와 저장소 사용 가능을 먼저 확인하도록 수정했고 두 엔진의 전체 local-draft 시나리오가 exit0이다. 기존 실패/새 편집/다른 탭 보존 및 정확한 acknowledgement 삭제 단언은 유지했다.
- 해당 재실행은 실패가 확인된 뒤 소유한 wrapper31648의 functional 자식45200을 부모/명령행으로 다시 확인하고 그 트리만 종료했다. wrapper는 살아서 자신의 Worker를 finally 정리했으며 중간 결과를 별도 보존했다. 이 중단된 실행을87개 완료나 제품 합격으로 세지 않는다. 다음 전체 실행이 stale QA lock을 소유권 확인 후 회수하도록 기존 절차를 따른다.
- 중단 직전 connection-integrity의 빈 초안 assertion도 발생했으므로 이를 단순한 프로세스 종료 영향으로 분류하지 않는다. 입력 전 제목 초점과 실제 입력값을 확인하는 조건을 추가했고 다음 WebKit 실행의 해당 검사는 통과했다. D1 선언 비교 차이는 migrations_dir의 새 도구 정규화 필드뿐이며 실제 DB binding/name/id와 R2·compatibility_date·nodejs_compat는 같다. 새 SQL/마이그레이션 실행0.
- 이어 balanced-daily에서도 새 질문 직후 입력이 비어 버튼이 비활성인 실패가 발생했다. 소유한 wrapper12648/functional65100 트리를 같은 방식으로 중단하고 부분 실행을 보존했다. 여러 빈 입력을 계속 QA 대기로만 넘기지 않고 공통 컨트롤러 초점의 첫 커밋 경계를 검증했다.
- 새 React commit 관찰은 기존 useEffect 초점에서 즉시 assertion exit1이었다. 제품 초점을 useLayoutEffect로 옮겨 새 질문의 입력이 보이기 전 완료하게 했다. 같은 초기/질문 전환·늦은 setter/AI lock 검사 모두 Chromium·WebKit exit0이다. 늦은 콜백 generation 보호·성적·저장 동작은 바꾸지 않았다. 이 추가 런타임 수정 때문에 #31.1과 전체 빌드/두 엔진 검증을 다시 진행하며 이전838/838·87/87을 최종 변경 상태의 성공으로 사용하지 않는다.
- 초점 layout 수정 후 Node22.23.4·24.22.1 각838/838, 타입/린트/빌드 모두 exit0이다(로그 comprehensive-*-focus-runtime). 린트 기존15경고. 균형 학습·연결 무결성·컨트롤러 세 원본 검사가 두 엔진 모두 exit0이다. 첫 커밋 초점 회귀의 RED와 수정 후 GREEN을 별도 보존한다. 이제 최종 P1/복구·성능을 먼저 확인한 뒤 같은 최종 제품 빌드의 원본87×2를 실행한다.
- 성능 준비 helper의 ROOT 경로 가정을 수정했다. 실제 비교 기준은 보존된 ROOT dist이며 감사 HEAD와378개 런타임 파일 중7개가 다르다(CRLF 무시). 따라서 정확한 수정 전후 개선 주장에 사용하지 않는다. 기준 provenance JSON과 기존 raw 성능 결과는 별도로 보존한다.
- 첫 원본 성능은 문법 입력/긴 기록/이미지/시작4개 통과, backup-resource는 Miniflare5에서 옛 serializeConfig 문자열 guard가 준비 단계에서 거절했다. cap 미설정 상태로 검사를 계속하지 않았다. 설치본 및 [Cloudflare 병합 PR14702](https://github.com/cloudflare/workers-sdk/pull/14702)를 확인해 같은96/4MB를 MINIFLARE_WORKERD_V8_FLAGS로 주입하고 실제 해석 copy를 확인하는 fail-closed guard를 유지한다. 설치 의존성·배포 설정은 패치하지 않는다.
- 원본 성능 후 기록 실행기의 Node22 native exit -1073741819로 느린망 완료가 확인되지 않았다. 정확한 native 원인은 미확정이다. 해당 baseline60374/candidate60444 포트가 닫혔고 그 profile의 runtime 프로세스가 없음을 확인했다. Node24.22.1 실행기로 재실행하며 이번에는 Worker PID/포트/소유 폴더를 시작 시 기록한다. 첫 로그를 성공으로 바꾸거나 지우지 않는다.
- Node24.22.1 실행기의 최종 원본 성능5/5 exit0, 별도 느린망1825회차 exit0이다. backup-resource20,000,000bytes/1825회차/96·4MB V8 cap에서174표본, 관측 합계 peak67,064,906bytes(약64MiB), 32요청 최고1339ms였다. 동기 구간 누락 가능·실제 운영 전체128MB/기기 성능 미검증 조건은 유지한다. 이미지 비교36표본·오류0, 기준은 앞의 제한된 ROOT 빌드 비교이며 정확한 audit HEAD 전후 개선 주장은 하지 않는다. normal과slow 산출물을 별도 보존했고 실행기 finally 정리까지 exit0을 확인했다.
- 최종 제품 빌드의 Chromium 전체 수집 중 clock-continuity에서 호출 수2 대 기준1이 관측됐다. 요청 이벤트 완료와 route handler의 clockCalls 증가 사이에서 기준을 읽던 QA 경계를 수정했다. handler가 실제 요청을 보류한 뒤 기준을 잡고, 보류된 새 요청이 정확히1개라는 단언을 추가했다. 반복focus/pageshow/online 및 timeout 뒤 중복 없음 단언은 유지했다. 두 엔진 집중 실행 exit0이며 제품 시계/일자 코드는 바꾸지 않았다. 해당 부분 실행은 소유한 wrapper59064와 전체 자식만 확인하여 종료했으며 완주 결과로 세지 않는다.
- 같은 최종 제품 빌드의 Chromium87/87 exit0, WebKit86/87 exit1을 확인했다. WebKit 실패는 pronunciation의 첫 편집창 discard 뒤 read 검색이었다. for-loop 안의 후속 닫기에는 초점 복귀 대기가 있었지만 첫 닫기에는 없었다. 첫 trigger 초점 복귀와 검색값 실제 반영을 확인하도록 보완했고 두 엔진의 pronunciation 원본 검사가 exit0이다. IPA/레이아웃/접근성/무기록 쓰기 단언은 유지했다. 제품 코드는 변경하지 않았다. Chromium 전체와 해당 수정 집중 결과를 보존하고 WebKit 원본87개를 다시 실행한다.
- request-timeout의 네 가상 deadline도 UI pending 이후 실제 held route 도달을 먼저 확인하도록 강화했다. 20/25/35/45초와 단일 호출·사용자 재시도 조건은 그대로이며 해당 코드가 시작되기 전에 반영했고 Chromium 전체에서 통과했다.

- 다음 WebKit 전체는86/87(exit1), local-draft의 grammar UUID 복구 전 reload 한 곳이 실패했다. 최근 tail만 보고 초반 실패를 놓친 설명을 정정했으며 이후 results.json 전건의 code/timedOut과 전체 로그를 집계한다.
- 실패 시 보관은 request UUID1개뿐이었다. 합성 하네스는 live store가 React의 committed state보다 앞선 ready를 노출하고, open은 확인 전 ready만 기다렸다. 하네스가 committed state를 표시하고 available/active까지 기다리도록 변경했다. AI 직전 입력 문장 행 보관도 추가 단언했다. 이 경계의 정확한 이벤트 순서 전체를 기록한 것은 아니므로 원인 확정과 운영 발생 주장은 하지 않는다. 두 엔진 local-draft 모든 시나리오 exit0, 타입/관련 lint exit0. 제품 코드는 그대로이며 WebKit 전체를 다시 확인한다.
- 실제 Ubuntu24.04 Node22.22.2에서 최종 잠금/owned Worker 수명/하위 프로세스/중단 검사17/17 exit0. 이는 Linux 프로세스 소유권·포트 fixture의 결과이며 운영 workerd/메모리/Node 보안 패치 확인과 구분한다.

- DOCS-1 최종 안내 점검에서 OpenAI 운영 문서의 과거 클라이언트2/연결 평가 절차가 남아 있어 현재 미게시 후보4/v6/문법 reader5 및 새 평가 승인 없음 표제를 추가했다. 과거 내용은 이력으로 보존하고 master 차단/호환 reader 원칙은 유지했다. 실제 공개 생성기/문서 집중2/2 exit0(최종 제품 코드 변경0).

- WebKit 전체 functional-1793878068365는86/87(exit1), local-draft/발음은 통과하고 grammar-plan의 수업 복귀 뒤 검색값만 빈 값이었다. 빠른 최초 fill 전에 탭 복귀 준비를 기다리지 않던 fixture를 보완했다. 첫 search 초점 고정 대기는 이전 목록 컨트롤 복귀도 허용하는 실제 정책과 달라 두 엔진에서 실패했으며 해당 로그를 보존했다. 목록 visible 이후 실제 restoration의 두-frame callback을 완료한 뒤 값을 넣고 즉시 값도 단언하는 최종 fixture는 Chromium/WebKit 전체 grammar-plan 시나리오 exit0, 관련 lint exit0이다. 검색값/페이지/필터/스크롤/복귀 초점 및 AI·실패/충돌 단언은 유지한다. 이 경계의 운영 발생/정확한 모든 이벤트 순서는 미검증이며 제품 코드는 그대로다.

- 최종 대시보드 검사는 새 회귀5·기존 단일17·다중 플랜18·실제4318/현재 플랜15그룹 모두 exit0이다. 실제 report의 checks 전건/개수와 runner exit를 대조했다. 초기 메모의 기존15개 가정은17개로 정정했으며 과거 기록은 수정하지 않는다. 최초 final 명령의 Playwright 환경 경로 누락 실패도 보존하고 명시 경로의 재실행을 최종 근거로 쓴다.

- 최종 WebKit functional-1793879876663는 원본87/87·시간초과0·wrapper/finally exit0이다. 결과 JSON 전건과 동결된87개 이름/순서를 직접 대조했다. Chromium functional-1793873422778의 동일 최종 제품87/87 및 이후 QA-only 영향3사례의 두 엔진 집중6개를 함께 보존한다. 앞선 실패/중단은 별도 실행으로 남긴다. 최종 통합 #31·출시 준비 #32 완료, 게시 #33/세부2개 deferred다. 20검사/29매핑/249근거·소스737/빌드407개 지문을 수집했다. 수집 요약에서 targeted 행의 aggregate exitCode 누락을 발견해 실제 성공 실행기 exit0을 명시하고 재생성했다. README 현재 표제 추가 뒤 문서·실제 생성기2/2도 exit0으로 재확인했다. 게시/실제 AI/운영 학습 QA0.

- 최종 native MCP get_tasks는 요청 tag=comprehensive-remediation과 응답 metadata가 일치하고 상위32/33·세부79/81 done,33/세부2개 deferred다. next_task에는 같은 절대 SOURCE/tag를 전달했지만 응답 metadata.tag=master, nextTask=null이므로 신규 tag 완료 증거로 사용하지 않는다. 실제 get_tasks와 SOURCE/ROOT 원본·DAG 검증으로 완료 범위를 판단했다. 소유 SOURCE runtime 프로세스0·QA lock/recovery guard0·두 체크아웃 staged 파일0이며 기존4318은 유지한다. 최종 보존/출시 준비5그룹 및 git diff --check exit0. 비민감 재조회/정리는 ROOT outputs/comprehensive-remediation-implementation-20261105/taskmaster-and-cleanup-final.json에 남긴다.

- 최종32/33·79/81 및 G1–6 passed/G7·PAID held 상태에서 실제4318의 새/과거4플랜 표시·선택·새로고침·출처/무결성을 Chromium/WebKit15그룹으로 다시 확인해 exit0이다. 과거 knownLimits3개는 전부 fixed=true이며 실제 normalizer 근거와 브라우저 근거 구분을 유지한다. 이 최종 UI 결과로 판정의 근거 해시를 갱신했다.

- 추가 게시 승인에 따라 v146 native succeeded, 운영 익명200/401/no-store·공개 자산15해시·환경77/접근/자동화 유지 확인. Task Master 명시tag native 재조회33/33·81/81 done, G7passed/PAIDheld다. 최종 dashboard15·문서2·보존/게시6그룹·git diff --check exit0, Source 소유QA runtime0. 게시 후 QA의 이전 경로 재사용은 구형 결과 요약의 원래 SHA/bytes와 정확히 일치하는 복구 및 새 게시 폴더 분리로 해결했고 기존251근거 해시도 전부 재확인했다. QA 출력경로 변경은 로컬 관리 전용이며 검증 제품737/빌드407은 그대로다.
