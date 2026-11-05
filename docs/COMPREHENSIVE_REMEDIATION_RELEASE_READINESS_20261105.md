# 광역 감사 수정 후보 · 출시 준비

이 문서는 `comprehensive-remediation-2026-11-05`의 로컬 수정 후보를 검토하는 자료다. 기존 SOURCE `work/comprehensive-defect-audit-20261105`, 브랜치 `codex/comprehensive-defect-audit-20261105`, 기준 HEAD `5609a8e6fa7d148ff4cf6582ae20fe0ed2669171`를 유지한다. 사용자 `개선 착수 승인`은 구현·검증·출시 준비에 적용한다. 운영 게시, commit/push/PR, 실제 AI 평가를 포함하지 않는다.

현재 최종 판정과 파일 해시는 [기계 판정](releases/2026-11-05-comprehensive-remediation-readiness.json)을 따른다. 이 파일의 상태가 `ready-for-publication-review`가 되기 전에는 전체 검증 완료로 읽지 않는다. [구현 기록](COMPREHENSIVE_REMEDIATION_IMPLEMENTATION_20261105.md)의 이전 실패·중단·중간 결과는 그대로 보존한다. 기존 [감사 보고서](COMPREHENSIVE_DEFECT_AUDIT_20261105.md)는 수정 전 당시 기록이다.

## 변경과 관측 가능한 결과

감사 22결함(제품12·도구/운영/문서10)과 의존성7정비를 원래29항목에 연결했다. Task Master의 상위1–30이 공통 기준 및 개별 수정을,31이 통합 검증을,32가 이 검토 패키지를 추적한다.33은 운영 게시이며 승인 전 보류다. 원래23권고와 기존 플랜의 평가·예산·점수는 이번 결과와 합산하지 않는다.

| 범위 | 바뀐 동작 | 주요 검증 |
|---|---|---|
| UI-5·UI-2 | 인증 확인 전에는 이전 문서가 새 계정 초안을 삭제하지 않는다. 성공한 정확한 페이지·질문·값의 초안만 정리한다. | 늦은 SSR/401·새 owner 보관, 실제 D1 문장21개 후 완료 초안0, 실패/신규 편집/다른 탭 보존 |
| AI-6·UI-4 | 문장 수정·교정/undo·기기 복구가 자기점검만 갱신하고 독립 review/schedule·완료일을 보존한다. | 문법 v2–4 순수 함수/스키마, built v4 수동 수정·합성 AI 적용·복구·재완료·reload |
| UI-1·UI-3 | 공개/도움·첫 답을 복구로 낮추지 않는다. snapshot 교체 대기 중만 문법 입력을 잠근다. | 두 탭 복구/undo·실제 D1 성적, 유효 합성409와 실제 D1 GET/불가·quota 저장소 |
| AI-1·AI-2 | 원문의 가장자리 공백만 허용한다. 응답 유실·영수증 없는503은 같은 UUID의 명시 조회로 복구한다. | 실제 저장·원문 공백 보존, 새 POST 없음, 유효 receipt 보존/임의 오류 필드 제거 |
| AI-3·AI-4·AI-5 | 명령문을 작은 동사 목록으로 한정하지 않는다. 발화행위·수량 순서/부호·절별 부정을 교정 보호에 반영한다. | judgment-v6 결정표, 고정120요청 fixture 보존·의도한 버전 차이만 비교 |
| DATA-1·DEP-ZOD | 큰 컬렉션은 값 순회/검증 전 기존 도메인 한도로 거절한다. 오래된 큰 기록의 읽기/내보내기는 유지한다. | 작은 proxy/한도 경계·API400/revision 불변·백업/복원 원자성 |
| DOCS-1·OPS-1 | 복구 진입점과 자료 생성기의 공개 안내가 현행 OpenAI 명시 요청 정책을 따른다. | 실제 생성기 임시 출력·문서/공개 정책 비교 |
| DASH-1·DASH-2·DASH-3 | 새 플랜 등록·새로고침·import/source 전환이 올바른 출처·세대를 유지한다. | 실제4318과 독립 fixture, 네 플랜/과거 예산 보존·두 엔진 |
| OPS-2·OPS-3·TEST-3 | 소유한 Worker 자식과 포트를 정리한다. stale lock 회수를 직렬화하고 원자적 준비 마커를 읽는다. | Windows와 실제 Linux의 잠금 경합·signal/IPC·부모 종료·하위 프로세스·마커 |
| TEST-1·TEST-2 | 실제 UUID/문맥/버전으로 정상 저장을 확인하고 늦은 AI 응답은 붙이지 않는다. 저장 준비를 D1 지문으로 확인한다. | 정상 대조군·지연/취소·실제 hook mutant 실패 확인, 원본 전체 회귀 |

통합 중 확인한 질문 전환의 늦은 초점은 첫 layout commit에서 완료하도록 수정했다. 기존 코드의 commit 관찰은 실패했고, 수정 후 두 엔진에서 초기/전환 초점·입력·늦은 setter 보호가 통과했다. 모달 닫기·가상 deadline·합성 초안 검사는 실제 준비 조건을 기다리도록 보완했으며 원래 데이터 보존·단일 호출·접근성 단언은 유지했다.

## 호환성과 데이터

- 학습/JSON·CSV 백업 envelope와 revision 충돌·복원 트랜잭션 원자성을 보존한다. 한국 학습일, 단어 목표·친숙도·회상 성적·문법 진도를 합치지 않는다.
- 문법 콘텐츠는1–4다. reader/writer 프로토콜은5로 올렸다. 과거 완료일/독립 이력을 가진 채 stage5에서 새 문장을 점검하는 상태는 구형 클라이언트에426을 반환한다. 해당 상태의 구형 읽기·덮어쓰기·전체/분할 복원을 차단하며 무관한 단어 쓰기는 유지한다. 구형 화면은 새로고침 후 다시 사용한다.
- 판단은 `judgment-v6`, 프롬프트는 `reference-v5`, AI 클라이언트는4다. 과거 Google/Groq·OpenAI 의견/점수는 보존하며 현재 조건의 새 판단으로 표시하지 않는다. 신규 학습 AI는 명시적 사용자 요청의 OpenAI Responses만 사용한다. 자동 대체·자동 재평가·임의 일일 한도·결제 변경은 없다.
- 새 SQL/마이그레이션 실행은0이다. `.openai/hosting.json`은 기준 해시와 같다. 실제 D1 binding/name/id와 R2는 같다. Worker 날짜 `2026-05-15`, flags `nodejs_compat`를 명시하여 패키지 기본 날짜 변경을 막았다. 새 생성 도구가 D1 설정에 `migrations_dir: ../../migrations`를 정규화했으므로 생성 설정 전체의 바이트 동일성을 주장하지 않는다.
- 운영 학습 행 조회/QA 쓰기·운영 설정/Secret/접근 변경은0이다. 브라우저/성능 검사는 루프백 Worker와 가상 계정/합성 자료로 실행했다. 비밀·개인 문장/답변을 진단에 추가하지 않는다.

## 의존성과 런타임

| 정비 | 최종 선택과 경계 |
|---|---|
| DEP-UNDICI | npm 및 Wrangler 번들7.30.1. 별도 Windows Node22.23.4(내장6.29.1)/24.22.1(7.30.1), 공식 SHASUMS 확인. 전역 Node22.22.2/내장6.24.1은 변경하지 않았다. Worker 출력148 JS에서 npm Undici import0이며 Cloudflare의 실제 fetch와 Node 소비자를 구별한다. |
| DEP-VITE | Vite8.1.6·Wrangler4.154.0·Cloudflare Vite1.66.0·workers-types5.20261023.1. Miniflare5.20261023.1-beta/workerd1.20261023.1은 기존 QA 수명 API에 맞춰 검증했다. |
| DEP-ZOD | Zod4.6.6. 부분 grammar record와 안전한 오류 분류를 맞췄고 reportInput/원문 로그를 넣지 않았다. |
| DEP-SATORI | Vinext1.0.0-beta.13·RSC0.5.34·OG1.0.3·Satori0.33.5·fflate0.7.5. beta5의 HarfBuzz PNG500을 보존하고 최소 지원 beta13으로 실제 Worker PNG200/1409bytes를 확인했다. 임시 QA route는 최종 빌드에서 제거했다. |
| DEP-NEXT | Next/eslint-config-next16.4.1. |
| DEP-FASTURI | 3.1.9, 실제 schema-utils/Ajv의 상대 참조/정상·부정 입력 소비자를 확인했다. |
| DEP-MINIMATCH | typescript-estree 하위11.0.1, 실제 API/dot-file 소비자를 확인했다. 기존3.1.5는 유지했다. |

`npm audit --json` 알려진 권고0건, 대상 `npm ls --all` 및 도달성 검사 exit0이다. 이 결과는 운영 RCE/악용 가능성·모든 보안 문제 부재의 증명이 아니다. 원래23권고의 공식 근거와 범위는 SOURCE `outputs/dependency-official-sources.json`에 보존했다. 기존 ws/esbuild/image-size/sharp override와 postinstall braces guard를 유지했다.

재실행은 SOURCE에서 격리 Node를 먼저 지정한다. 전역 `npm.cmd`는 자체 부모 Node를 사용할 수 있으므로 다음처럼 npm CLI도 명시한다.

```powershell
$env:PATH=(Join-Path (Get-Location) 'work/toolchains/node-v24.22.1')+';'+$env:PATH
node 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' test
node 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run typecheck
node 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run lint
node 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run check:grammar-review
node 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run build
node 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' audit --json
```

## 검증 증거와 한계

최종 기계 판정은 명령·exit·사례 수·파일 SHA-256을 기록한다. 원본 functional은 각 실행 폴더 `results.json`의87개 `code`/`timedOut` 전건과 전체 로그를 확인한다. 집중 통과를 전체 통과로 대신하지 않는다. Node 단위838개씩, 두 엔진 기능87개씩, 별도 P1/복구16사례·정상 hook/실제 보호 제거 mutant, 원본 성능5개·느린망1825회차, Linux17개, 대시보드 회귀를 각각 구분한다. 기존 lint 경고15개는 남아 있다.

다음 범위는 이번 로컬 합격과 별개다.

1. 실제 iPhone/VoiceOver·운영 인증 SSO 전환·운영 학습 AI 요청·독립 영어 품질 평가를 실행하지 않았다. 합성 모델 응답과 Windows WebKit을 이 결과로 표현하지 않는다. 실제 유료 호출0이며 닫힌 원장·이전 예산을 재개하지 않는다.
2. DATA-1 추가 OOM/부하 재현0. JSON 파서/엔진 키 수집 할당·실제 운영 전체128MB 영향은 미검증이다. 승인된 원본 성능의 V8 old96/semi4MB 조건은 Miniflare 내부 debug flag에만 적용한다. 설치 소스 guard가 바뀌면 실패하도록 두며 배포 설정은 바꾸지 않는다. [공식 PR14702](https://github.com/cloudflare/workers-sdk/pull/14702)를 확인했다.
3. 최종 backup-resource는20,000,000bytes/1825회차,174개 V8 heap 표본의 합계 peak67,064,906bytes였다. 동기 구간 누락 및 heap 외 메모리가 있어 운영 메모리 상한 증거가 아니다. 느린망은4배 CPU·150ms/500KBps 내려받기·125KBps 업로드의 합성 조건이다.
4. 성능 비교 기준은 보존된 ROOT dist다. 감사 HEAD와 런타임378파일 중7파일이 다르므로 정확한 수정 전후 개선 주장을 하지 않는다. provenance와 normal/slow 산출물을 분리 보존한다.
5. Node22 Windows 실행기의 native exit `-1073741819` 정확한 원인은 미확정이다. 소유 Worker/포트 정리를 확인하고 같은 검사를 Node24.22.1 실행기로 완료했다. Node22 단위/빌드 통과와 실행기 native 실패를 모두 기록한다. 실제 Linux 검사는 Ubuntu24.04 Node22.22.2의 프로세스/포트 fixture이며 Linux workerd 성능·보안 패치 검증은 아니다.
6. 초과 upload의 조기 거부 뒤 unread body reset으로 두 엔진 모두 상태 헤더를 받지 못하는 경우가 있었다. 실제413를 받은 경우와 네트워크 실패를 구분하여 입력/D1 불변을 검사한다. 별도로 실제 Worker의 Content-Length 조기413 상태를 빈 본문으로 중계해 클라이언트 fallback·입력 보존·수정 후 단일 저장을 확인했다. 중계를 native 직접413 성공으로 표현하지 않는다. 본문 강제 drain·자동 재시도는 추가하지 않았다. 관련 [workerd 경계](https://github.com/cloudflare/workerd/issues/7634)·[Playwright 경계](https://github.com/microsoft/playwright/issues/42074)는 참고 근거이며 운영 원인의 확정이 아니다.
7. Beta Vinext/RSC/Miniflare와 내부 cap API는 업그레이드 위험이다. 향후 버전 변경 시 OG·기본 Worker 날짜·D1 생성 경로·백업/revision·브라우저 전체를 다시 확인한다.

## 관측과 복구

운영 상태를 새로 조회하지 않았다. 기존 [v145 게시 영수증](releases/2026-11-05-provider-network-rollout.json)은 당시 `succeeded`와 저장 소스/버전을 제공한다. 이번 후보는 미게시다. v145가 지금도 운영 중이라는 신규 실측을 주장하지 않는다.

| 관측할 신호 | 데이터 보존 대응 |
|---|---|
| state/restore426 | 오래된 탭을 새로고침하고 호환 reader5로 재시도한다. 구형 writer로 우회하거나 DB/백업 값을 줄이지 않는다. |
| revision409·교체 GET 실패 | 자동 덮어쓰기 없이 입력/보관을 유지한다. 최신 기록 확인·비교 후 명시 저장한다. |
| provider_network503·응답 유실·영수증 없는 오류 | pending UUID를 유지하고 사용자가 결과 확인을 선택한다. 자동 신규 POST/다른 provider로 전환하지 않는다. |
|413 또는 헤더 없는 network failure | 현재 입력/DB를 유지한다. 실제 상태를 받은 경우만413 안내를 사용하며 사용자가 입력을 줄여 다시 저장한다. |
| local draft unavailable/capacity/owner invalid | 현재 화면 입력과 수동 내보내기 경로를 유지한다. 타 계정/다른 탭/신규 변형을 강제로 삭제하지 않는다. |
| QA lock recovery guard·Worker 종료 오류 | PID·명령행·시작 시각·suite 소유권을 확인한다. 공유 프로세스 일괄 종료나 임의 lock 삭제를 하지 않는다. |

관측에는 기존 오류 코드·종류·개수/비민감 시각만 사용한다. 원문·학습 답·API 키·토큰·새 개인 데이터 로그는 추가하지 않는다.

후보 사용 후에는 stage5와 과거 completedAt/review/schedule이 공존할 수 있다. **v145 저장 버전으로 단순 롤백하면 새 상태의 구형 reader 호환을 보장하지 못한다.** 호환 복구 소스는 reader5·소유권 fence·정확한 초안 승인 정리·영수증 보호를 유지해야 한다. 이 소스와 파일 지문을 검토 자료에 보존하며, 운영 복구도 별도 승인 후 기존 Site로 수행한다.

AI 장애만 격리할 때에는 [기존 운영 절차](OPENAI_FEEDBACK.md)에 따라 승인된 담당자가 master `ai_feedback_enabled`를 끄는 경로를 검토한다. 학습/읽기/백업과 호환 reader는 유지한다. Google/Groq fallback, DB 역SQL, 학습 문서/백업 전체 덮어쓰기로 되돌리지 않는다. 운영 설정 변경은 이번 실행에 포함하지 않았다.

## 게시 전 검토 체크리스트

- [ ] 사용자가 기존 Site 게시 범위와 필요한 commit/push/PR을 명시 승인했다.
- [ ] 기계 판정의 소스/lock/빌드 해시와 게시할 소스가 같다. 이후 제품·패키지가 바뀌면 관련 검증을 다시 실행한다.
- [ ] 설치된 Sites 공식 소스 동기화·검증·패키징 절차로 기존 project/binding을 유지한다. 새 Site/DB/R2는 만들지 않는다.
- [ ] 구형 탭426·reader5·새 중간 상태의 호환 복구 소스를 확인한다. 신규 SQL이 필요해지면 이 문서의 무마이그레이션 결론을 다시 검토한다.
- [ ] 기존 Site 게시 receipt가 `succeeded`이고 실제 게시 tree/버전이 후보와 같다.
- [ ] 승인 범위의 익명 홈/시계200·state401/no-store·정적 파일 해시만 확인한다. 운영 학습 QA 쓰기는 하지 않는다.
- [ ] 비민감 오류 관측 및 위 호환 복구 경로를 기록한다. 미검증 기기/품질을 완료로 표시하지 않는다.

현재 모든 게시 체크는 미실행이다. 게시 보류는 로컬 구현·검증·출시 준비의 실패와 구별하며 Task Master33과 CR-G7/CR-PAID에 남긴다.
