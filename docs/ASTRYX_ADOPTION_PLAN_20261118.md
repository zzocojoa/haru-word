## 2026-11-18 · Astryx T8 공통 조작·상태·오류 완료

실제 공통 입력/선택/진행·저장 오류/복구 이관 완료. 단위926·Node22/24 타입/빌드·관련19스크립트×2엔진38회 통과. 전체8/18·27/62(44%), 다음T9 대기. 제품은 `work/astryx-adoption-20261118`, 관리 원본과 기존4318을 유지한다. [T8 구현·검증](ASTRYX_T8_IMPLEMENTATION_20261118.md). 기존 디자인·학습·저장·복원/과거5플랜·예산 보존. 최종품질·실제iPhone·게시 미완료이며 아래 상태는 각 기록 당시 이력이다.

**T7까지 완료: 전체7/18·24/62(39%), 다음 T8 대기.** [T7 구현·검증](ASTRYX_T7_IMPLEMENTATION_20261118.md). 아래 T1–T6 표시는 해당 단계 종료 당시 기록이다.

# Astryx 단계적 도입 플랜

2026-11-18 · tag `astryx-adoption` · planId `astryx-adoption-2026-11-18`

**현재: T1–T6·1단계6/6·20/20 완료, AX-G0/G1 통과. 전체6/18·20/62(32%)이며 다음 T7은 대기다.** [구현·검증 결과](ASTRYX_ADOPTION_IMPLEMENTATION_20261118.md)를 따른다. 아래 미착수/미검증 표현은 최초 계획 등록 당시 기록이다. 후속 사용자 목표로 T1–T6 로컬 구현·검증을 승인받았으며 T7 이후·게시·유료 AI는 수행하지 않았다.

## 시작 순서

1. 최신 제품·기존 디자인·보존 계약을 고정한다(T1). 기본 폴더의 구버전 제품에 설치하지 않는다.
2. AI 결과 검사 fixture와 이미지 QA 프로필을 보완하고 원본 전체를 두 엔진에서 통과시킨다(T2).
3. 같은 버전의 Core/CLI/테마와 필요한 peer를 확인하고 CSS layer·전역 선택자·토큰 충돌을 검증한다(T3–4).
4. 하루단어 테마와 실제 Astryx Foundation을 검증한다(T5–6). G0/G1 미통과이면 화면 이관을 보류한다.
5. 일반 화면부터 학습 입력으로 확대하고 시트·백업/복원은 마지막에 이관한다(T7–16).
6. 최종 품질/성능·실기기와 별도 승인 게시를 각각 판정한다(T17–18).

## 작업과 의존성

1단계는 T1–6(세부20개)의 검사 보완·테마/CSS 검증, 2단계는 T7–18(세부42개)의 화면 이관·품질·게시다. 구체적인 세부 작업·완료 검사는 Task Master 원본과 대시보드에서 펼쳐 볼 수 있다.

| 작업 | 범위 | 세부 | 선행 작업 |
| --- | --- | ---: | --- |
| 1 | v149 기준 소스·디자인·보존 계약 고정 | 3 | 없음 |
| 2 | 검사 데이터·QA 프로필 보완과 기준선 재검증 | 3 | 1 |
| 3 | 프로젝트 Astryx 버전·peer·Codex 설정 준비 | 3 | 1, 2 |
| 4 | CSS layer·전역 선택자·토큰 충돌 격리 | 4 | 3 |
| 5 | 하루단어 테마·크기·한국어·상태 표현 구현 | 4 | 4 |
| 6 | Foundation 통과 판정과 단계 확대 허용 | 3 | 2, 3, 4, 5 |
| 7 | 공통 프레임·4탭·스크롤·초점 이관 | 4 | 6 |
| 8 | 일반 조작·상태·오류 표현 공통 이관 | 3 | 6, 7 |
| 9 | 오늘·친숙도·읽기 화면 이관 | 3 | 7, 8 |
| 10 | 단어장 검색·목록·뜻별 편집 이관 | 3 | 8, 9 |
| 11 | 단어 학습 입력·초안·AI 결과 이관 | 4 | 8, 10 |
| 12 | 문법 목록·v4 수업·작성·진도 이관 | 4 | 11 |
| 13 | 복습·기록·다시 보기·내보내기 이관 | 3 | 10, 11, 12 |
| 14 | 설정·모델·이미지·발음·도움말 이관 | 3 | 9, 10, 12, 13 |
| 15 | 시트9종·중첩 확인·미저장 보호 이관 | 4 | 11, 12, 13, 14 |
| 16 | 백업·복원·학습일 수정의 마지막 이관 | 4 | 15 |
| 17 | 전체 회귀·성능·실기기·출시 준비 판정 | 4 | 6, 16 |
| 18 | 별도 승인 후 기존 Site 게시·관측·산출물 정리 | 3 | 17 |

## 고정할 동작

- 화이트·차콜·라임, DM Sans/Noto Sans KR, 본문/입력16px·보조14px·작은 조작44px·주 행동48px, 초기 light 모드를 유지한다.
- 모바일4탭·window 스크롤/초점 복원, 한국 학습일과 친숙도/목표/회상/문법 진도 분리를 보존한다.
- 초안·첫 답/도움·계정 분리·revision·실패 재시도·영수증·백업 envelope·큰 복원 한도/원자성·불확실 commit 보호를 유지한다.
- 입력만으로 AI를 호출하지 않는다. 이번 플랜의 실제 AI/유료 평가 예산·사용은0이며 과거 승인/원장은 이전하지 않는다.
- 오류/미저장/복구 행동은 접거나 Toast만으로 숨기지 않는다. native dialog의 purpose만으로 기존 닫기 guard를 대체하지 않는다.
- 전체 CSS/61개 UI 파일의 일괄 재작성·50개 미연결 후보 자동 삭제·새 Site/DB·다크모드·결제/AI 한도 변경은 하지 않는다.

## 검증 관문과 승인 범위

AX-P는 계획/대시보드 등록 검증이며 구현 진행률에 합산하지 않는다. AX-G0는 원본 검사 데이터/프로필, AX-G1은 실제 Foundation, AX-G2는 화면/학습, AX-G3는 시트/복원, AX-G4는 최종 품질/성능이다. AX-IOS는 실제 iPhone/IME/VoiceOver 미검증 보류이며 WebKit으로 통과시키지 않는다. AX-PUB는 이 변경의 품질/실기기와 게시 승인이 확보될 때까지 보류한다.

검토 당시36회 중32통과/4실패·진단2회는 기존 앱 기준선이다. 원본 AI 결과 레이아웃의 이후 항목과 실제 Astryx 빌드는 아직 미검증이다. 이를 새 플랜 완료로 가져오지 않는다. 실제 변경 후에는 해당 기존 회귀와 npm test/check:grammar-review/typecheck/lint/build, 영향을 받는 브라우저/성능 검사를 실행한다. 문서/계획 등록 때문에 제품 검사를 반복하지 않는다.

이번 등록은 제품 구현·게시·GitHub commit/push/PR·유료 AI/운영 QA 쓰기를 승인하지 않는다. 구현 착수 요청이 있으면 최신 source/승인 범위를 갱신한다. 복구는 UI 도입 변경만 되돌리고 React19.2.9·v149 초안 분리·현재 reader·종료 카드·사용자 데이터를 유지한다.

## 원본·대시보드·이력

- [Task Master 원본](../.taskmaster/tasks/tasks.json), [manifest](../.taskmaster/docs/astryx-adoption-manifest.json), [플랜 등록부](../.taskmaster/docs/dashboard-plans.json)
- [기존 전수 검토](../outputs/astryx-audit-20261118/REVIEW.md), [계획 검증](../.taskmaster/docs/astryx-adoption-validation.json)
- 기존 조회 주소: [대시보드](http://127.0.0.1:4318/) · 새 기본 선택: Astryx. 이전5플랜을 같은 화면에서 전환한다.
- AI 품질 이전 플랜은30/40·103/133과 T39/1%/학습효과 미완료를 보존한다. 나머지4플랜의 작업·검증·평가/예산도 합산/초기화하지 않는다.
- Task Master MCP get_tasks/next_task에는 현재 기본 폴더의 projectRoot와 tag=astryx-adoption을 명시한다.
- 재생성: node .taskmaster/scripts/build-openai-dashboard.mjs. 계획/보존 검사: node .taskmaster/scripts/test-astryx-adoption-plan.mjs. 기존 UI 회귀: node .taskmaster/scripts/test-dashboard-sidebar.mjs 및 test-multi-plan-dashboard.mjs.

계획 등록/검증의 원시 근거는 outputs/astryx-adoption-plan-20261118에 보존한다. Task Master 수동 필드 API를 사용했고 별도 모델 호출은0이다.

## 등록 검증 결과

Task Master MCP 재조회에서18/62 모두 pending, next_task는 T1로 확인했다. `node .taskmaster/scripts/build-openai-dashboard.mjs`가 기존 단일 HTML을6플랜·새 기본18/62로 생성했다(exit0).

`test-astryx-adoption-plan.mjs` 6그룹, `test-dashboard-sidebar.mjs` 15그룹, `test-multi-plan-dashboard.mjs` 18그룹이 모두 exit0이었다. Chromium/WebKit의6플랜 선택·작업 수/검증/예산 표시·새로고침·단일 HTML·모바일/200%·키보드·axe를 확인했다. 등록 검증 AX-P만 passed이며 구현/품질은 pending, 실기기/게시 관문은 held다.

과거5태그 객체·manifest와50개 보호 파일, 이전5플랜의 실효 표시/예산을 그대로 보존했다. 검토 기준 제품323파일 지문도 불변이다. 제품 구현·패키지 설치·새 유료 AI·운영 QA 쓰기·배포·파일 삭제는0이다. 제품 변경이 없어 제품 단위·타입·린트·빌드는 이번 계획 등록에서 반복하지 않았다.
