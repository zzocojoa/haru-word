# 학습 로직 리팩토링 완료 기준 감사

2026-09-23. 원래 범위를 v41(`c1468d7613dfc9aaf7d8aa40a84c78b39df23701`)과 대조했다. v42 후속 감사에서 재개 위치 검증, 회차 단일 순회, 브라우저 종료 처리를 보완했다. 기존 디자인·학습 정책·API 경로·DB·학습 자료·의존성을 변경하지 않았다.

## 요구사항별 근거

| 요구사항 | 구현과 검증 근거 |
| --- | --- |
| 입력 보존 | `use-editor-submission`, WordLibrary 인스턴스 비교, WordEditor/PersonalWord의 Promise<boolean> 계약. `editor-save-qa`가 입력/뜻 잠금, 닫기·다른 단어·같은 단어 재열기, 실패·재시도·재접속과 개인 단어를 검사한다. |
| 저장·복원 계약 | `state-shape`의 공통 실제 날짜·목표 기록·종료/진행·재시도·재개/묶음 위치. `invalid-session-cases` 10개를 실제 일반 저장/복원 경로에 넣어 양쪽 DB 미변경을 검사했다. `backup.test`는 유효한 구형 자료와 실제 전환/배치/연습 단계를 확인한다. 전체 상태 참조 검사는 복원에 남아 있다. |
| 응답 검증 | `response-validation`과 `learning-api`의 조회 구조·정확한 revision 증가. `learning-api.test`의 누락/타입/증가/구조/JSON/HTTP 오류, `response-contract-qa`의 저장된 뒤 잘못된 응답·초안 보존·명시적 재조회, `request-timeout-qa`의 응답 지연을 확인했다. 자동 재전송은 없다. 번들 metafile로 사전 JSON 미포함을 확인한다. |
| 배정 출처 공유 | `dailyOriginSummary`가 회차를 한 번 순회해 단어별 출처와 합계를 만든다. 상위 useMemo와 TodayOverview가 공유한다. 기존 `dailyOrigins` 합계 계약은 유지한다. `study-date.test`가 날짜·당일 배정·실제 점검 결과·미측정·새 뜻과 원본 불변성을 확인한다. |
| 컨트롤러 분리 | `useFamiliarityFlow`, `useSessionCommands`, 명시적인 `LearningViewProps`, `learning-commands`를 확인했다. `learning-commands.test`와 `refactor-lifecycle-qa`는 성적·초안·타이머를, `study-controller-render-qa`와 `draft-interaction-qa`는 오래된 콜백·세대를 검사한다. `refactor-contracts.test`가 새 경계까지 런타임 의존성 순환을 검사한다. 단일 저장소와 시계를 유지한다. |
| 검사 환경 통합 | 모든 브라우저 스크립트가 공통 Playwright/axe/주소/계정/launchBrowser/closeBrowser를 사용한다. 명시적 manifest와 실제 파일을 대조해 누락을 거부한다. 기능/성능 공통 잠금, 종료 코드·시간 초과 집계, IPC 종료와 소유한 프로세스 트리 정리를 적용했다. `qa-runtime.test`가 주소·계정·종료 실패·시간 초과·중단 처리를 확인한다. |

## 최종 로컬 검증

- 전체 단위 232개 통과: `work/goal-unit-final.log`.
- 번역 데이터 7개 통과. 기본 3,809개 자료·공개 데이터·DB 마이그레이션·lockfile은 기준 버전과 차이가 없다.
- 브라우저 기능 39/39, 일괄 실행 종료 코드 0: `outputs/browser-suite/functional-1790165505901/results.json`. A1~B2, 자정·3→10·이월/월말·다시 학습, 모바일 5폭/확대·접근성, 저장/재접속을 포함한다. 이전 실패 기록은 보존했다.
- 타입 검사, app/lib/db 린트, 빌드, diff 검사 통과. 마지막 제품 코드 빌드는 `work/goal-build.log`다.
- 장기 기록/초기 진입 성능 2개 통과: `work/goal-performance.log`. 기능 검사와 동시에 실행하지 않았다.

## 성능과 남은 위험

같은 390px Chromium·CPU 4배 지연·loopback·3회 조건에서 초기 준비 중앙값은 365회차 571→665ms, 1,825회차 1,212→1,616ms였다. 1,825회차 목표 저장은 1,117→1,098ms였다. 전체 응답 검증 비용 때문에 초기 조회는 빨라지지 않았다. 원본은 `outputs/refactor-performance-before/measurements.json`, 최종은 `outputs/goal-performance-after/measurements.json`에 있다.

위험도 중간. 이미 잘못 저장된 자료를 자동 삭제·보정하지 않는다. 잘못된 저장 응답은 입력을 남기고 서버 확인을 요구한다. 진단에는 본문·문장·키를 추가하지 않는다. 실제 iPhone/VoiceOver/Google 제공자는 이번 자동 보장 범위 밖이다.

## 배포 후 확인과 롤백

기존 owner-only 사이트를 유지한다. 후속 배포에서는 로그인된 브라우저로 조회, 목표 설정 저장 후 원래 값 복구, 새로고침 후 유지 여부를 확인하고 학습 단어·문장·성적에 시험 값을 입력하지 않는다. 인증되지 않은 직접 검증 요청은 401로 끝났으며 운영 저장을 실행하지 않았다. 실제 후속 확인 증거는 `outputs/goal-hosted-check.json`에 기록한다.

이번 추가 수정의 롤백은 v42(`58d5d31ecf6ff17cf6b018583c19d7d8d9ed2a2c`), 리팩토링 전체의 기준은 v41이다. DB 역변환은 없다. 코드 롤백으로 이미 유실된 입력을 복구할 수는 없다.
