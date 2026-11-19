# Astryx T8 공통 조작·상태·오류 이관

2026-11-18 · `astryx-adoption` · T8 및 세부3개 완료. 전체 **8/18·27/62(44%)**, 다음은 T9 오늘·친숙도·읽기 화면이다. G2 전체 화면 관문과 최종 품질·실기기·게시는 미완료다.

제품 작업 위치는 `work/astryx-adoption-20261118`, 브랜치는 `codex/astryx-foundation`이다. T1–T7 검증 상태를 기준으로 비교했다. 관리 원본과 [기존4318 대시보드](http://127.0.0.1:4318/)를 유지했다.

## 구현과 보존 계약

- 실제 Core Button/IconButton/TextInput/TextArea/Selector/Banner/ProgressBar/Text/Spinner를 공통 어댑터와 실제 사용처에 연결했다. 표현 입력·한국어 의도/문맥 선택, 네 진행률, 저장/시계 오류·재시도/백업/진단 다운로드, 상태 문구·학습 안내 닫기가 대상이다. 화면 전체 이관은 후속 작업이다.
- 기존 event 핸들러, 라벨과 ref, name/form·required·readOnly·길이 제한을 유지한다. TextArea의 soft counter를 native 제한으로 오인하지 않고 htmlMaxLength에 연결했다. emoji UTF-16 한도와 서버 렌더링된 제약을 검사했다.
- 비활성/로딩 중 click·Enter·Space·implicit submit을 막고, 완료 전 동일 행동을 합친다. 자동 clickAction/changeAction은 도메인 저장/AI에 연결하지 않는다. 실제 저장 오류 재시도 연속3클릭은 대기 PUT1회만 발생했다. 기존 store는 재시도 중 오류 표면을 저장 상태로 전환하며 그 동작도 유지했다.
- 오류는 명시적 role=alert, Banner는 collapsible=false/isDismissable=false다. 오류 상태에서 긴 내용과 재시도·백업·충돌 복구를 상시 표시한다. 단순 성공 안내의 기존 수명·hover/초점/숨김·Escape 규칙은 별도 기존 훅을 유지했다.
- 진행 계산·학습 성적을 바꾸지 않는다. 기록 완료·독립 회상·미측정·월말 점검 대기를 분리한다. 수량 Badge 대신 줄바꿈 가능한 Text와 기존 아이콘을 사용했다.
- `haru-controls` 레이어에서 공개 target과 어댑터 클래스만 보완했다. 기존 색·입력16px·조작44/48px·수업/학습 진행4px·일반8px, 저장 상태12px/보조색/가로 배치를 유지한다. 서버 page/layout 경계와 정적 CSS 로딩을 보존했다.

새 핵심 파일은 `app/haru-controls.tsx`, `app/haru-controls.css`, opt-in `app/astryx-foundation/control-contracts.tsx`, `tests/astryx-controls-qa.cjs`다. 사용 규칙은 제품의 `docs/ASTRYX_FOUNDATION.md`에 예제와 제한을 정리했다. [구조화 결과](../.taskmaster/docs/astryx-adoption-t8-implementation.json)와 [소스 지문](../outputs/astryx-t8-20261118/final-fingerprints.json)을 보존했다.

## 실제 검증

| 명령·범위 | 실제 결과 |
| --- | --- |
| npm test · Node22.22.2 | 926/926·실패/건너뜀0·exit0 |
| npm run typecheck · Node22/24 | 각각 exit0 |
| npm run build · Node22/24 | 실제 Worker 빌드 각각 exit0 |
| npm run lint | 오류0·기존15경고·exit0 |
| 변경 QA의 node --check / eslint | exit0 |
| npm run check:grammar-review | 원본/해시 일치·exit0 |
| QA runner functional --list | 새 검사 등록과 목록 검증·exit0 |
| astryx doctor --built dist/client | pass11/warn1/fail0·exit0. source-purity는 검사되지 않음 |
| 관련 브라우저19스크립트×Chromium/WebKit | 최종38개 조합 모두 exit0·타임아웃0 |

관련 검사는 common controls, Foundation, navigation, editor-save, clock-continuity, local-draft, learning-message, today-status, feedback-safety, openai-migration, study-layout, sentence-feedback-layout, grammar-v4, design, ui-plan-contract, settings-dialog, sheet-dismiss, 기존 navigation, backup-workflow다. [최종38개 조합](../outputs/astryx-t8-20261118/browser-final-results.json)과 원시 실패/복구 이력을 함께 남겼다. 여러 회차에서 같은 조합의 최종 성공을 취합했으며 실패를 통과 수에 합산하지 않았다.

공통 계약은 실제 라벨/필수/emoji 제한/refs/FormData/readOnly, 비활성·로딩·동기 연타·키보드·폼 제출, 긴 오류와 복구, 0/100 진행, 모바일/데스크톱 저장 상태를 검사한다. 320–1440px·200%·axe·SSR도 확인했다. 기존 앱 검사는 단어/개인 단어 저장 중복·실패 재시도·충돌, 한국 날짜/중단 답안 연속성, 백업 복원 revision·원자성·불확실 commit, 9시트 보호, 문장 피드백80항목, 문법15수업·135문항을 포함한다. 오늘 상태 검사에서는 일일 완료/월말 대기/실제 어려움이 다른 브라우저와 새로고침 후에도 구분됐다.

## 발견과 보완

1. 필수 표시가 기존 접근 이름을 바꾸고 Selector 안쪽 버튼을 작게 만들었다. 기존 aria-label과 실제 버튼44px를 복구했다. 보이는 조작을 터치 검사에서 제외하지 않았다.
2. Banner의 오류 색은 alert를 자동 보장하지 않았고, 진행 track의100% 높이는 중간 부모에서 사라졌다. 명시적 role과4/8px 높이로 보완했다.
3. Core Text가 저장 상태를16px/본문색/block으로 바꿨다. 실제 계측을 보존하고12px/보조색/flex를 복구해 두 화면 폭·두 엔진에서 단언했다.
4. 오래된 AI QA는 현재 필수 한국어 의도 없이 요청하고 과거 v7/v6 응답을 새 결과로 사용했다. 명시적 합성 의도를 입력하고 기존 currentOpenaiFeedback helper를 재사용했다. 요청수·원문/첫 답·성적/저장/receipt 보존 단언은 유지했다.
5. WebKit에서는 의도 입력 뒤 비동기 문맥 지문 계산 전에 키보드 검사가 실행됐다. 실제 요청 버튼의 활성화를 기다리고, 그 전 자동 호출0을 확인했다. 제품 요청 조건을 바꾸지 않았다.
6. 새 실제 재시도 검사가 저장 중에도 오류 버튼이 남는다고 가정했다. 기존 오류→저장 상태 전환을 검사하도록 맞추고 동기3클릭 PUT1회와 별도 공통 키보드 차단 검사를 유지했다.

## 호환·위험·복구와 미검증

공통 UI 여러 화면에 영향을 주는 변경이다. API·lib·SQL·저장/학습 훅·package/lockfile·Site 설정 등 보호190개 파일은 변경 전과 일치했다. 전체 비교1945개 중 변경25개·추가4개·삭제0이다. 새 API/저장 필드/DB migration/의존성은 없다. 새 개인 진단 수집도 추가하지 않았다. 이전5플랜·manifest와 T1/T7 검증 원본4개를 보존한다.

단일 값 Selector를 모든 native select의 required/form/ref·다중 선택 계약으로 확대하지 않는다. 버튼만으로 외부 form.requestSubmit/API 직접 호출까지 막는다고 해석하지 않으며 기존 도메인 guard를 유지한다. 다른 화면/variant는 해당 이관 단계에서 검증한다.

실제 iPhone·IME·VoiceOver·비영 safe-area, Linux 원격 CI·최종 기기 성능·운영 게시는 미검증이다. WebKit은 실기기 검사와 구분한다. 화면 픽셀 동일성은 주장하지 않는다. Windows npm shim의 doctor 경고와 CLI 표본 PNG의 neutral 색상 잔존은 기존 제한이며 실제 built Worker를 검증 근거로 썼다. 새 유료 AI·운영 QA쓰기·배포·GitHub commit/push/PR은0이다.

복구는 T7 프레임/테마를 유지하면서 T8 어댑터·공통 사용처/import·CSS·관련 QA만 한 묶음으로 되돌린다. 전체 checkout의 HEAD 초기화나 학습 데이터/원장 삭제로 복구하지 않는다. 최종 관리 대조는 별도 T8 dashboard-validation 파일에 저장해 이전 검증을 덮어쓰지 않는다.

| 경로 또는 정리 범위 | 분류 | 보관·삭제·보류 | 근거 또는 재생성 방법 | 검증 결과 |
| --- | --- | --- | --- | --- |
| work/astryx-adoption-20261118의 T8 소스·어댑터 | 제품 코드 | 보관 | 미커밋 작업·검토/복구 필요, npm run build | 타입·Node22/24 빌드 성공 |
| 신규 공통 계약과 보완한 기존 QA | 회귀/재사용 도구 | 보관 | 입력·저장·상태 재발 방지, 기존 QA runner | 최종38조합 통과 |
| outputs/astryx-t8-20261118·Task Master 새 근거 | 검증 근거 | 보관 | 실패/복구·지문·로그·스크린샷 재현 | 최종 결과·보존 대조 |
| T1–T7/이전5플랜·예산·기존 사본 | 기존 근거/이력 | 보관 | 과거 근거·승인·품질 보류 유지 | 원본 지문 일치 |
| dist·합성 QA DB·실행 설정·미리보기 | 생성/검증 자료 | 정리 보류 | 검토/후속 복구 필요, 폴더 일괄 삭제 없음 | 소유 Worker 종료·lock 해제·제품/근거 삭제0 |

최종 관리 검증: 계획/실제4318/새로고침·보존6그룹 + sidebar15그룹 + 기존 플랜 전환18그룹 = **39그룹**, 세 명령 exit0. Task Master MCP는 완료상위1–8·세부27 및 다음T9 pending을 반환했다. 실제 API/HTML의8/18·27/62(44%)와 T8 결과 표시, 이전5플랜의 전체 표시·예산·작업 동일, MCP 조회 후 canonical source 지문 일치까지 확인했다. [완료 대조](../outputs/astryx-t8-20261118/completion-audit.json).
