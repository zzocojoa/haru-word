# 전체 화면·학습 연결 점검

2026-09-23. 기준 v36 (`e1dc7b1459449e9f896da6db1667557af0ca4940`). OpenDesign의 frontend-design 지침과 승인한 화이트·차콜·라임 방향을 적용했다. 아래는 확인한 경로의 범위이며 모든 가능한 입력·기기 조합의 무결함을 보장하지 않는다.

## A–Z 확인 범위

| 구간 | 확인한 내용 | 근거 / 개선 |
|---|---|---|
| A 진입 | 불러오기·인증·빈 상태 | design, request-timeout; 가짜 성적 없음 |
| B 화면 이동 | 네 탭·키보드 선택·초안 | design, refactor-lifecycle; 방문 상태 보존 |
| C 친숙도 시작 | 영어만 표시, 뜻 숨김 | familiarity-reveal |
| D 친숙도 확정 | 추측 → 공개 → 비교·확정 | familiarity-reveal, workflow; 짧은 확인 문구 |
| E 학습 범위 | 수준 탐색·준비만 마치기 | workflow, resume; 정식 판정과 구분 |
| F 오늘 배정 | 한국 날짜·신규·복습 구분 | daily-boundary, today-status; 날짜와 행동 우선 |
| G 목표 변경 | 1~10, 3→10 추가, 감소 | daily-goal, daily-topup; 기존 결과 보존 |
| H 진행 필터 | 전체·남은 단어·탭 복귀 | ui-refresh; 서버 쓰기 없이 표시 전환 |
| I 기억 깨우기 | 힌트·독립 회상·재접속 | workflow, draft-interaction |
| J 단어 익히기 | 뜻·품사·예문·발음 링크 | design, expression-translation |
| K 표현 해석 | 뜻 전환·빈 값·과거 기록 | expression-translation, 단위 검사; 3,809개 유지 |
| L 양방향 회상 | 답 숨김·도움·재시도 | draft-interaction, workflow |
| M 문장 작성 | 입력·자기 점검·말하기 | workflow, refactor-lifecycle |
| N AI 피드백 | 명시적 호출·한도·응답 지연 | sentence-feedback, request-timeout; 실제 Google 호출 없음 |
| O 종료·재학습 | 기록·성공 구분, 다시 보기 | repeat-learning, ui-refresh; 단어별 접기 |
| P 단어장 | 검색·친숙도·수준·초기화 | design, integration-consistency, ui-refresh |
| Q 단어 상세 | 뜻별 자료·성적·읽기 메모 | expression-translation, workflow; 설명 그룹 접기 |
| R 개인 단어 | 공식 목록과 구분·입력 폭 | backup, ui-refresh; 품사 버튼 44px |
| S 주간 점검 | 기간·문장 포함·대상 확장 | review-calendar, review-extension |
| T 월말 점검 | 모든 대상·15개 묶음·재개 | resume, comprehensive; 월말 미측정은 일일 실패 아님 |
| U 이어서 점검 | 중복 버튼·옛 회차 유지 | ui-refresh; 같은 회차 ID만 중복 제외 |
| V 기록 탐색 | 날짜·회차·단어·페이지 | journal-navigation; 23일·26회차 검사 |
| W 백업·내보내기 | 전체 내용·취소·충돌·복원 | backup, journal-navigation; 기록 관리 메뉴 |
| X 날짜·동기화 | 자정·기기 시계·학습일 수정 | daily-boundary, study-date, comprehensive |
| Y 오류 복구 | 실패·재시도·타임아웃·입력 | draft-interaction, request-timeout; 오류는 항상 표시 |
| Z 반응형·접근성 | 320·390·430·768·1440px, 200% | ui-refresh, accessibility, design; 모바일·데스크톱 시각 확인 |

## 검사 중 바로잡은 문제

- 체크박스가 일반 입력의 너비를 상속해 상세 화면에서 글자가 세로로 밀림: 텍스트 입력 선택자에서 체크박스·라디오 제외.
- 확대 글자가 오늘 통계·하단 메뉴·기록 필터에서 넘침: 최소 열 너비·줄바꿈·필터 최대 너비 수정.
- 상세 창의 고정 제목이 닫기 버튼을 가림: 닫기 버튼의 쌓임 순서 수정.
- 기록 관리 메뉴가 배경을 접근성 트리에서 숨김: 비모달 메뉴로 변경하고 ESC 초점 복귀·복원 창 전환 검사.
- 완료 수가 성공과 혼동됨: 공통 표시 집계로 기록 완료·독립 성공·보완·미측정을 구분. 판정 정책은 그대로 사용.
- 점검 탭에서 같은 회차를 두 번 이어서 시작하도록 표시: 현재 카드에 있는 회차 ID만 중복 제외. 같은 기간의 다른 회차는 유지.

## 검증 결과와 한계

- 단위 검사 **212/212** 통과. 브라우저 검사 스크립트 **25개** 통과(성능·접근성 포함). 모든 변경 테스트는 로컬 Worker의 격리된 테스트 계정을 사용한다.
- TypeScript, 앱·학습·DB ESLint, 빌드, diff 검사 통과. 별도 브라우저의 초안 복구, 저장 실패·충돌, 큰 백업과 월말 목록도 확인했다.
- 기본 데이터·공개 학습 파일·API·DB 스키마·패키지 파일의 변경이 없다. 읽기 전용 UI 조작은 revision과 모든 기록이 그대로임을 비교했다.
- 12개 기본 접근성 화면과 8개 새 인터랙션 화면에서 axe 위반 0건. 개별 회귀 검사도 오류·복원·기록·표현 화면을 검사한다. 자동 검사로 실제 VoiceOver 사용성을 보장하지 않는다.
- 키보드는 visualViewport 축소를 모사해 확인했다. 이번 디자인의 실제 iPhone Safari·VoiceOver는 별도 확인이 필요하다. 이전 디자인의 기기 검증을 이번 결과로 계산하지 않는다.
- 로컬 CPU 4배 감속·새 Chromium 컨텍스트 3회 성능 측정은 `outputs/startup-performance/measurements.json`에 남긴다. 실제 모바일 네트워크나 현장 Web Vitals를 뜻하지 않는다. 기존 약 440KB gzip UI 번들 경고는 남아 있으며 이번 범위에서 데이터 로딩 구조를 바꾸지 않는다.

## 배포·운영

위험도 중간. DB 마이그레이션·저장 형식 변경·추가 AI 호출·새 의존성이 없다. 기존 저장·충돌·서버 시간 진단을 유지하며 학습 문장과 키를 새로 기록하지 않는다. 예상 실패 모드는 기기별 키보드·고정 요소 겹침이나 오래된 스타일 캐시다. 입력 내용·성적을 지우지 않고 재접속 상태를 확인한다.

기존 소유자 비공개 사이트에 반영한다. 문제 발생 시 v36을 재게시한다. 데이터 역변환 없이 이전 화면으로 돌아갈 수 있다. 자세한 화면 규칙은 `DESIGN.md`, 운영 절차는 `OPERATIONS.md`를 따른다.
