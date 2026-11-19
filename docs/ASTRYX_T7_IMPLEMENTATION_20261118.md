# Astryx T7 공통 프레임·4탭 이관

2026-11-18 · tag `astryx-adoption` · task7

**T7 및 세부4개 구현·검증 완료. 전체7/18·24/62(39%)이며 다음 T8은 대기다.** 일반 화면·학습 전체 관문 G2와 최종 품질·실기기·게시 관문을 완료로 처리하지 않았다.

제품은 `work/astryx-adoption-20261118`, 브랜치는 `codex/astryx-foundation`이다. 기준은 main33f5de5 위의 T1–T6 검증 상태이며, 착수 때1938개 파일 지문을 고정하고 기존500개 제품 기준선 일치를 확인했다. 기본 폴더의 Task Master와 기존 [4318 대시보드](http://127.0.0.1:4318/)를 그대로 사용한다.

## 구현

- 실제 Astryx `AppShell(height="auto", mobileNav={false})`과 `TabList/Tab`을 사용했다. 서버 page/layout을 client로 바꾸지 않고 Core/테마/프레임 CSS를 홈에 연결했다.
- AppShell 하나가 main 랜드마크와 한국어 건너뛰기 링크를 소유한다. 기존 StartupScreen은 초기화 전 단계로 유지한다. 탐색의 초점 fallback은 실제 main 역할을 함께 찾는다.
- 기존 `NavigationProvider → useTabNavigation → 문법 flush → useTabPosition` 경로를 보존한다. 승인된 tab 값만 선택 상태로 표시하고 focus/click 중복을 합친다. 저장 거절 시 연결된 현재 선택 탭으로 초점을 돌린다.
- 네 패널을 id/aria-controls/aria-labelledby로 연결하고 hidden 상태로 마운트를 유지한다. 검색·펼침·초안·진도를 새 상태로 옮기지 않았다.
- `haru-shell` 레이어의 공개 컴포넌트 클래스 어댑터로 기존640px 경계, 하단 고정, 키보드 숨김, safe-area 식, 헤더 여백과18/20px 아이콘을 유지한다. 팔레트는 기존 테마/의미 변수에 연결한다.

핵심 소스는 `app/haru-frame.tsx`, `app/haru-shell.css`, `app/learning-app.tsx`, `app/page.tsx`, `app/navigation.tsx`, `themes/haru/haru.theme.ts`다. [구조화 근거](../.taskmaster/docs/astryx-adoption-t7-implementation.json)·[소스 지문](../outputs/astryx-t7-20261118/final-fingerprints.json)·[검증 범위](../outputs/astryx-t7-20261118/requirements.json)를 보존했다.

## 실제 검증

| 명령·범위 | 결과 |
| --- | --- |
| npm test · Node22.22.2 | 926/926, 실패/건너뜀0, exit0 |
| npm run typecheck · Node22/24 | 각각 exit0 |
| npm run build · Node22/24 | 실제 Worker 빌드 각각 exit0 |
| npm run lint | 오류0·기존15경고, exit0 |
| npm run check:grammar-review | 자료/해시 일치, exit0 |
| QA runner 목록 검사 | 신규 검사 등록·기존 목록 보존, exit0 |
| npm run astryx -- doctor --built dist/client | pass11/warn1/fail0, exit0 |
| 12개 관련 브라우저 스크립트 | 래퍼24회 모두 exit0·타임아웃0. 시작 화면 스크립트는 내부에서 두 엔진을 자체 실행하므로 별도 엔진 수로 중복 합산하지 않음 |
| 프레임·탭 집중 검사 | 양 엔진, 320/390/430/640/641/768/1440px×100/200%, 단일 main/skip·탭/패널 연결·44px·키보드·정확한 스크롤·저장 대기/실패/재시도·Back/Forward 통과 |
| 기존 디자인 대조 | 두 엔진×모바일/데스크톱×4탭, 미이관 조작·제목의 계산 스타일16/16 일치. 컴포넌트 교체 후 전체 화면의 픽셀 동일성을 주장하지 않음 |
| 정착 화면 확인 | 선택 탭과3프레임을 기다린16캡처, main1개·모바일 날짜 숨김/데스크톱 날짜 표시·헤더61/64px·하단 inset0일 때6px 확인 |

관련 스크립트는 astryx-navigation, design, ui-plan-contract, navigation, local-draft, backup-workflow, settings-dialog, sheet-dismiss, study-layout, sentence-feedback-layout, astryx-foundation, startup-render다. 문장 피드백80항목과 학습 단계 레이아웃, 백업 revision 충돌·불확실 commit·복원 후 재조회, 저장 실패 후 초안/문법 답안 보존, 종료/시트 guard와 느린 글꼴·JS/API 대기·JS 없는 시작 화면을 포함한다. 실제 AI 호출 없이 소유한 루프백 Worker·합성 계정만 사용했다.

## 발견과 보완

1. Astryx 기본 position/padding이 하단 탭을 본문으로 밀어 스크롤 복원을 깨뜨렸다. 실제 실패를 남기고 공개 클래스 어댑터에서 기존 고정/헤더/키보드 규칙을 복구했다.
2. 기존 터치 검사가 포커스 전1px로 clip된 건너뛰기 링크를 보이는 조작으로 셌다. clip된 요소만 제외하고, 새 집중 검사에서 포커스 시 실제44px 이상과 main 초점 이동을 별도로 확인했다.
3. 초기 시각 캡처가 뷰포트/탭 갱신보다 먼저 실행돼 불안정했다. 선택 상태와3프레임 정착 후 다시 캡처했고 날짜 표시·프레임 계측을 남겼다. 제품 조건이나 기존 기능 검사를 완화하지 않았다.

초기 실패와 복구는 outputs/astryx-t7-20261118/visual-smoke, visual-attempt2, visual-attempt3에 보존했다. 최종 기능 결과는 visual-final/results.json, 정착 캡처는 visual-settled다.

## 호환·위험·복구

npm/lockfile·React19.2.9·Site 식별자/DB 바인딩·학습/저장/복원 API·SQL과 기존 저장/탭 위치 훅의 지문은 유지했다. 새 DB migration·저장 필드·의존성·결제 변경은 없다. 실제 AI·운영 QA쓰기·배포·GitHub commit/push/PR은0이다. 이전5플랜/예산/품질 보류와 T1–T6 검증 원본을 보존한다.

실제 iPhone·IME·VoiceOver와 비영(非零) safe-area, Linux 원격 CI, 운영 배포/성능은 미검증이다. WebKit 에뮬레이션·Windows Node22/24 결과와 구분한다. 기존 safe-area 식과0일 때의 동작은 확인했으며 실기기 gate는 보류다. Core CSS를 실제 홈에서 사용하기 시작했으므로 기기 성능 최종 판정은 T17에 남긴다.

Windows의 npm cmd shim 판별 경고와 CLI 표본 PNG의 neutral 색상 잔존은 T1부터 알려진 제한이다. 실제 built Worker 화면·계산 스타일을 판단 근거로 썼다. doctor의 source-purity 미검사 안내도 전체 소스 품질 통과로 해석하지 않는다.

복구는 이번 T7 프레임/탭 연결·홈 CSS·탐색 fallback·테마/어댑터 변경을 한 묶음으로 되돌려 T1–T6 상태로 복원한다. 전체 checkout을 HEAD로 초기화하면 미커밋 T1–T6까지 지워지므로 수행하지 않는다. 데이터·원장·백업을 되돌리거나 삭제하지 않는다. 새 개인 진단 로그/이벤트는 추가하지 않았다.

| 경로 또는 정리 범위 | 분류 | 보관·삭제·보류 | 근거 또는 재생성 방법 | 검증 결과 |
| --- | --- | --- | --- | --- |
| work/astryx-adoption-20261118의 T7 소스·정적 테마 | 제품/필수 생성 코드 | 보관 | 미병합·검토/복구 필요, npm run theme:build/build | 타입·두 Node 빌드 통과 |
| 신규 프레임 QA와 보완한 기존 QA | 회귀/재사용 도구 | 보관 | guard·접근성·디자인 재발 방지 | 브라우저24회·단위926 통과 |
| outputs/astryx-t7-20261118·Task Master 새 근거 | 검증 근거 | 보관 | 실패/복구·지문·스크린샷·로그 보존 | 최종 결과/이력 대조 |
| T1–T6/과거5플랜·예산·기존 작업 사본 | 기존 근거/이력 | 보관 | 동결 근거와 원본 지문 유지 | 보존 대조 |
| dist·폰트 캐시·합성 QA DB·테마 미리보기 | 생성/검증 자료 | 정리 보류 | 미병합·후속 복구 필요, 폴더 일괄 삭제 없음 | 소유 Worker 종료, 삭제0 |

Task Master/대시보드 최종 대조는 별도 T7 dashboard-validation 파일에 저장해 T1 검증 파일을 덮어쓰지 않는다. 다음 작업은 T8이며 T7 완료를 일반 조작·학습 전체 이관 완료로 표시하지 않는다.

최종 관리 검증: 계획/실제4318/갱신·보존6그룹 + 기존 sidebar15그룹 + 과거 플랜 전환18그룹 =39그룹, 세 명령 exit0. Task Master MCP는 완료상위1–7·세부24와 다음 T8 pending을 반환했다. 실제 API의7/18·24/62·T7 실행 결과 표시, 이전5플랜 작업/표시예산·문맥 일치, T1 검증4파일 지문 보존을 확인했다.
