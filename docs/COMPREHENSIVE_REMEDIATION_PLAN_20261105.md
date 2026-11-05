<!-- implementation-approval-current -->
2026-11-05 사용자 **개선 착수 승인**으로 SOURCE/기존 브랜치의 구현·검증·출시 준비를 시작한다. 아래 계획 등록 당시 미승인/미착수 문구는 당시 이력이다. 게시·실제 AI 평가·commit/push/PR은 별도 승인이다. 최신 진행은 [구현 기록](COMPREHENSIVE_REMEDIATION_IMPLEMENTATION_20261105.md)과 manifest/Task Master를 따른다.
<!-- /implementation-approval-current -->

# 광역 결함 감사 후속 수정 계획 · 2026-11-05

현재 상태: **계획 작성·등록 단계, 제품 구현 미착수**. tag `comprehensive-remediation` / planId `comprehensive-remediation-2026-11-05`. 상위33개·세부81개, 모든 상태 pending. 감사29항목은 각각 독립 상위 작업에1:1로 연결했다.

- 작업 원본: `C:\Users\user\Documents\ChatGPT\하루단어\work\comprehensive-defect-audit-20261105`
- 유지 브랜치: `codex/comprehensive-defect-audit-20261105` / HEAD `5609a8e6fa7d148ff4cf6582ae20fe0ed2669171`
- 관리 원본/기존 대시보드: `C:\Users\user\Documents\ChatGPT\하루단어` / http://127.0.0.1:4318/
- 상세 RPG: [PRD](../.taskmaster/docs/comprehensive-remediation-prd.md)
- [manifest](../.taskmaster/docs/comprehensive-remediation-manifest.json), [매핑](../.taskmaster/docs/comprehensive-remediation-mapping.json), [수동 복잡도 검토](../.taskmaster/docs/comprehensive-remediation-complexity.json)
- [계획 검증 결과](../.taskmaster/docs/comprehensive-remediation-validation.json): 실제 실행한 검사·미실시 범위·보존 결과를 별도로 기록한다.

## 실행 순서와 진입 조건
이번에는 아래 구현을 시작하지 않는다. 후속 착수 승인 후 #1 보존 기준→P1 #2 UI-5/#3 AI-6→의존성 순서별 개별 수정→#31 전체 통합 품질→#32 출시 준비→별도 승인 후 #33 기존 Site 게시 순서다. AI-6 수정 없이 UI-4에 현행 문장 변경 함수를 재사용하지 않는다. UI-2/5는 owner 세대와 성공 row 정리를 함께 검증한다. DATA-1/DEP-ZOD는 같은 저장 경계를 조정하지만 제품 결함은1건이다.

### Phase 0
진입: 명시 구현 착수 승인·기준 HEAD/보존 캡처 확인.
작업: #1. 같은 단계에 의존 관계는 없다. 공유 파일은 순차 편집한다.
종료: 각 작업의 완료 조건·positive/negative·보존 회귀 근거가 충족되고 미검증/실패가 숨겨지지 않음. #31은 통합 품질, #32는 출시 검토 패키지, #33은 실제 게시 receipt로만 종료한다.
제공: 재현/보존 기준.

### Phase 1
진입: 선행 #1 완료 및 해당 품질 근거 확인.
작업: #2, #3. 같은 단계에 의존 관계는 없다. 공유 파일은 순차 편집한다.
종료: 각 작업의 완료 조건·positive/negative·보존 회귀 근거가 충족되고 미검증/실패가 숨겨지지 않음. #31은 통합 품질, #32는 출시 검토 패키지, #33은 실제 게시 receipt로만 종료한다.
제공: 해당 항목의 검증된 보장과 다음 단계의 신뢰 가능한 입력.

### Phase 2
진입: 선행 #2,#3 완료 및 해당 품질 근거 확인.
작업: #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #16, #17, #18, #19, #21, #23, #24, #25, #26, #27, #28, #29, #30. 같은 단계에 의존 관계는 없다. 공유 파일은 순차 편집한다.
종료: 각 작업의 완료 조건·positive/negative·보존 회귀 근거가 충족되고 미검증/실패가 숨겨지지 않음. #31은 통합 품질, #32는 출시 검토 패키지, #33은 실제 게시 receipt로만 종료한다.
제공: 해당 항목의 검증된 보장과 다음 단계의 신뢰 가능한 입력.

### Phase 3
진입: 선행 #2,#3,#9,#10,#19 완료 및 해당 품질 근거 확인.
작업: #15, #20, #22. 같은 단계에 의존 관계는 없다. 공유 파일은 순차 편집한다.
종료: 각 작업의 완료 조건·positive/negative·보존 회귀 근거가 충족되고 미검증/실패가 숨겨지지 않음. #31은 통합 품질, #32는 출시 검토 패키지, #33은 실제 게시 receipt로만 종료한다.
제공: 해당 항목의 검증된 보장과 다음 단계의 신뢰 가능한 입력.

### Phase 4
진입: 선행 #2,#3,#4,#5,#6,#7,#8,#9,#10,#11,#12,#13,#14,#15,#16,#17,#18,#19,#20,#21,#22,#23,#24,#25,#26,#27,#28,#29,#30 완료 및 해당 품질 근거 확인.
작업: #31. 같은 단계에 의존 관계는 없다. 공유 파일은 순차 편집한다.
종료: 각 작업의 완료 조건·positive/negative·보존 회귀 근거가 충족되고 미검증/실패가 숨겨지지 않음. #31은 통합 품질, #32는 출시 검토 패키지, #33은 실제 게시 receipt로만 종료한다.
제공: 해당 항목의 검증된 보장과 다음 단계의 신뢰 가능한 입력.

### Phase 5
진입: 선행 #31 완료 및 해당 품질 근거 확인.
작업: #32. 같은 단계에 의존 관계는 없다. 공유 파일은 순차 편집한다.
종료: 각 작업의 완료 조건·positive/negative·보존 회귀 근거가 충족되고 미검증/실패가 숨겨지지 않음. #31은 통합 품질, #32는 출시 검토 패키지, #33은 실제 게시 receipt로만 종료한다.
제공: 해당 항목의 검증된 보장과 다음 단계의 신뢰 가능한 입력.

### Phase 6
진입: 선행 #32 완료 및 해당 품질 근거 확인; 별도 명시 게시 승인 필수.
작업: #33. 같은 단계에 의존 관계는 없다. 공유 파일은 순차 편집한다.
종료: 각 작업의 완료 조건·positive/negative·보존 회귀 근거가 충족되고 미검증/실패가 숨겨지지 않음. #31은 통합 품질, #32는 출시 검토 패키지, #33은 실제 게시 receipt로만 종료한다.
제공: 해당 항목의 검증된 보장과 다음 단계의 신뢰 가능한 입력.


## 감사29항목 추적표
| 감사 ID | 원래 우선순위 | 상위 ID | 세부 ID | 선행 숫자 ID | 복잡도(수동) |
|---|---|---|---|---|---|
| UI-5 | P1 | 2 | 2.1, 2.2, 2.3 | 1 | 9 |
| AI-6 | P1 | 3 | 3.1, 3.2, 3.3 | 1 | 9 |
| UI-3 | P2 | 4 | 4.1, 4.2, 4.3 | 2,3 | 8 |
| UI-1 | P2 | 5 | 5.1, 5.2, 5.3 | 2,3 | 8 |
| UI-2 | P2 | 6 | 6.1, 6.2, 6.3 | 2,3 | 8 |
| UI-4 | P2 | 7 | 7.1, 7.2, 7.3 | 2,3 | 8 |
| AI-1 | P2 | 8 | 8.1, 8.2 | 2,3 | 6 |
| AI-2 | P2 | 9 | 9.1, 9.2, 9.3 | 2,3 | 8 |
| DATA-1 | P2 | 10 | 10.1, 10.2, 10.3 | 2,3 | 9 |
| DOCS-1 | P2 | 11 | 11.1, 11.2 | 2,3 | 3 |
| OPS-1 | P2 | 12 | 12.1, 12.2 | 2,3 | 4 |
| DEP-UNDICI | P2 | 13 | 13.1, 13.2, 13.3 | 2,3 | 8 |
| DEP-VITE | P2 | 14 | 14.1, 14.2, 14.3 | 2,3 | 7 |
| DEP-ZOD | P2 | 15 | 15.1, 15.2, 15.3 | 2,3,10 | 9 |
| AI-3 | P2 | 16 | 16.1, 16.2 | 2,3 | 5 |
| AI-4 | P2 | 17 | 17.1, 17.2 | 2,3 | 5 |
| AI-5 | P2 | 18 | 18.1, 18.2, 18.3 | 2,3 | 7 |
| DASH-1 | P2 | 19 | 19.1, 19.2 | 2,3 | 6 |
| DASH-2 | P2 | 20 | 20.1, 20.2 | 2,3,19 | 6 |
| DASH-3 | P2 | 21 | 21.1, 21.2 | 2,3 | 4 |
| TEST-1 | P2 | 22 | 22.1, 22.2 | 2,3,9 | 6 |
| OPS-2 | P2 | 23 | 23.1, 23.2, 23.3 | 2,3 | 7 |
| DEP-SATORI | P3 | 24 | 24.1, 24.2 | 2,3 | 4 |
| DEP-NEXT | P3 | 25 | 25.1, 25.2 | 2,3 | 6 |
| DEP-FASTURI | P3 | 26 | 26.1, 26.2 | 2,3 | 4 |
| DEP-MINIMATCH | P3 | 27 | 27.1, 27.2 | 2,3 | 4 |
| OPS-3 | P3 | 28 | 28.1, 28.2, 28.3 | 2,3 | 7 |
| TEST-2 | P3 | 29 | 29.1, 29.2 | 2,3 | 4 |
| TEST-3 | P3 | 30 | 30.1, 30.2 | 2,3 | 6 |

## 검증·게이트
- **CR-P 계획 구조·등록·보존 검증**: 29/29 매핑·숫자 참조·DAG·MCP 재조회·ROOT/SOURCE 신규 tag 일치·기존3태그/감사 원본 보존·4플랜 전환 확인. 최초 상태 pending: 계획 검증 실행 후 갱신. 구현 완료 게이트와 별개.
- **CR-G1 P1 데이터 보존**: 지연 owner가 새 입력을 삭제하지 않고 문장 수정/undo가 독립 review/schedule을 보존. 최초 상태 pending: 제품 구현 미착수
- **CR-G2 제품12건·API/백업/revision**: 12제품 항목의 원인별 negative/positive·서버 roundtrip·호환성 통과. 최초 상태 pending: 제품 구현 미착수
- **CR-G3 도구·문서10건**: 10항목 회귀·Linux 수명·다중플랜 출처/갱신·현행 정책 안내 일치. 최초 상태 pending: 도구/문서 결함 구현 미착수
- **CR-G4 의존성7정비·23권고**: 권고별 fixed范围/소비자/도달성/호환성과 최소 패치 또는 명시 잔여 위험 판단. 최초 상태 pending: 권고는 운영 RCE/장애 입증과 다름
- **CR-G5 전체 통합 품질**: Node22/24·두 엔진 원본·타입·린트·자료·빌드·성능/느린망·보존 통과. 최초 상태 pending: 과거 WebKit/Node24 최초 실패는 보존
- **CR-G6 출시 준비**: 호환성·위험·복구·관측·미검증 및 승인 검토 패키지 완성. 최초 상태 pending: 구현/품질/게시 상태 분리
- **CR-G7 운영 게시**: 품질 근거와 명시 승인 후 기존 Site 게시·읽기 검증. 최초 상태 held: 이번 범위는 계획만; 운영 게시·commit/push/PR 미승인
- **CR-PAID 실제 AI 품질 평가**: 새 목적/데이터/예산을 별도 승인받은 경우에만 검토. 최초 상태 held: 이번 실제 학습 AI 평가0; 과거 닫힌 원장/잔액 재개·합산 금지

## 위험·호환성·복구·관측
API/JSON·CSV 백업 하위 호환, revision 충돌 보호·트랜잭션 원자성, 한국 학습일, 첫 답·도움·독립 성적·문법 진도의 분리를 보존한다. 운영 학습 행 조회/QA 쓰기0. 신규 AI는 명시 요청 OpenAI Responses만 사용하며 Google/Groq 자동대체·임의 한도·결제 변경0. 비밀/개인 문장을 진단에 남기지 않는다.
실패 시 해당 최소 변경만 되돌리고 새 입력/독립 이력은 삭제하지 않는다. DB 역SQL/백업 덮어쓰기 없이 기존 reader·envelope를 유지한다. 관측은 오류 코드·종류·개수 등 기존 비민감 필드만 사용하며 새 개인 데이터 로그는 금지한다. 계획상 새 SQL은 필요하지 않으며 필요성이 생기면 호환성·복구 설계를 다시 검토한다.
P1 두 건은 데이터 보존 위험. DATA-1은 제한된 로컬 fatal1회이고 반복성·할당 단계·운영128MB 미검증이다. 이번 추가 OOM/부하0. UI-3의409는 합성 주입이며 실제 built 입력창·D1 GET/최종 상태·기기 보관 관찰과 구분한다. DASH-1/2는 브라우저 반복, DASH-3은 Node normalizer 반복. TEST-3 준비/정리 결함과 최초 EOF 원인의 추론을 분리한다. 의존성 advisory는 운영 장애/RCE 입증이 아니다.

## 이력·범위 보존
감사5산출물과 원시2089파일은 해시 기준으로 보존 검증한다. 과거 master15/35, judgment-remediation18/49, integration-remediation12/41의 작업 상태·게이트·원점수·비용·게시 이력은 합산하거나 초기화하지 않는다. Node22 800/800; Node24 최초799/800·단독6/6·재실행800/800; Chromium87/87; WebKit85/87 실패; 성능5개/느린망 통과를 당시 기록으로 유지한다.
이번 계획은 제품 구현·배포·commit/push/PR·운영 학습 QA 조회/쓰기·실제 AI 평가를 승인하지 않는다. 신규 지출0. 닫힌 옛 평가 원장/잔액은 재사용하지 않는다. 실제 iPhone·VoiceOver는 사용자 지정 후속이다.

## 도구·공식 문서
설치 Task Master CLI/MCP0.43.1, 명시 수동 add_task/add_subtask를 사용한다. PRD 자동 파싱·AI 복잡도 분석·자동 expand는 구성/credential이 없어 실행하지 않는다. 수동 복잡도 검토와 실제 도구 등록/검증 결과를 분리한다. init/reset/마이그레이션0. 공식 문서 확인일2026-11-05 KST.
- [TM-RPG](https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/assets/example_prd_rpg.txt) — 기능·구조 분해, 그래프, 로드맵, 검사, 위험의 RPG 절 구성
- [TM-STRUCTURE](https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/docs/task-structure.md) — 태그별 tasks.json, 숫자 ID, 의존성, 상태와 세부 작업
- [TM-MANUAL](https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/mcp-server/src/tools/add-task.js) — 명시 title/description/details/testStrategy 수동 등록
- [TM-MCP](https://docs.task-master.dev/capabilities/mcp) — MCP 도구와 구성 확인
- [TM-CLI](https://docs.task-master.dev/capabilities/cli-root-commands) — 조회·next·검증 명령 확인

## 대시보드 관리 예
```text
# SOURCE 또는 ROOT 각각에서 단일 HTML 재생성
node .taskmaster/scripts/build-openai-dashboard.mjs
# SOURCE: 계획 구조·두 사본 동기화·보존 검사
node .taskmaster/scripts/verify-comprehensive-remediation-plan.mjs
# 기존4318과 격리 fixture의4플랜 회귀(설치된 QA_PLAYWRIGHT_PATH 지정)
node .taskmaster/scripts/test-comprehensive-remediation-dashboard.mjs
```
계획 검증 결과 JSON은 이 검사들을 실제 실행한 후 갱신한다. 기존 열린 화면의 catalog가 고정되는 DASH-1 때문에 새 플랜 최초 등록은 전체 reload가 필요하다. 이 제한을 고쳤다고 보고하지 않는다.

## Task Master 보존 주의
설치0.43.1의 새 태그 쓰기가 다른 기존 태그의 ID 형식/기본 메타데이터도 정규화하는 동작을 실제 보존 검사에서 발견했다. 이번에는 시작 스냅샷의 기존 태그 객체만 정확히 복원하고 신규33/81은 유지했다. 이후 쓰기도 전후 기존 태그 객체를 대조한다. 수동 복잡도/명시 필드 등록과 이 보존 복구를 구분해 원시 근거에 기록했다.

## 등록용 최소 표시 보완
새 감사 근거의 긴 영문 파일명이 검색 후 펼쳐진 작업 설명에서320px/200% 가로 넘침을 일으켜 `.task-description{overflow-wrap:anywhere}`1규칙만 기존 CSS에 추가했다. 제품 결함 구현과 DASH-1~3 JavaScript/normalizer는 변경하지 않았다. 최초 실패와 진단·최종 회귀를 각각 보존한다.

## 이번 계획 검증 결과
Task Master 상위33/세부81 실제 등록·양쪽 get_tasks 재조회, next_task #1, 의존성138개 유효(exit0). 계획 구조·매핑·보존10그룹, 새 대시보드 두 엔진15그룹, 기존 회귀18그룹 exit0. 기본 선택 새 플랜·기존 세 플랜 유지. CR-P만 통과이며 제품 품질 CR-G1~6은 대기, 게시/실제 AI 평가는 보류다. 최초 보존/레이아웃/검증 스크립트 실패와 복구 기록도 보존했다.
