# 하루단어 아이콘 연결과 검증

확정된 `haru-icons-v1` 패키지의 P001–P105를 현재 컴포넌트 구조에 연결합니다.
원래 연결표의 위치·심볼·크기·조건은 [placements.json](./placements.json)에 보존하고,
리팩터링 후 실제 파일을 `implemented_in`에 기록했습니다.

## 범위

| 위치 | 화면 또는 기능 | 주요 구현 |
| --- | --- | --- |
| P001–P009 | 공통 헤더·메뉴 | `app/learning-app.tsx`, `app/learning/save-status.tsx` |
| P010–P017 | 오늘 학습 | `app/learning/today-overview.tsx` |
| P018–P029 | 일일 학습 단계·조작·저장 요약 | `app/study-session.tsx`, `app/study/` |
| P030–P036 | 이미지 연습 | `app/learning/image-practice-launcher.tsx`, `app/learning/image-practice.tsx` |
| P037–P042 | 단어장 | `app/word-library.tsx` |
| P043–P053 | 품사와 문장 연습 | `app/grammar/`의 목록·단계·문제·쓰기·요약 컴포넌트 |
| P054–P060 | 복습 점검 | `app/review/review-desk.tsx` |
| P061–P067 | 학습 기록·기록 관리 | `app/review/`, `app/session-records.tsx`, `app/study-ui.tsx` |
| P068–P072 | 백업·복원 | `app/backup-export-dialog.tsx`, `app/backup-dialog.tsx` |
| P073–P078 | 발음·사전·타이머 | `app/ui.tsx`, `app/word-pronunciation.tsx` |
| P079–P080 | AI 참고 의견 | `app/sentence-feedback.tsx` |
| P081–P086 | 학습·AI 설정 | `app/learning/settings-dialog.tsx`, `app/learning/ai-model-settings.tsx` |
| P087–P090 | 기기 임시 입력·복구 | `app/local-draft-settings.tsx`, `app/draft-recovery-notice.tsx` |
| P091–P094 | 자료 출처 | `app/learning/source-dialog.tsx` |
| P095–P100 | 대화상자·안내·선택·체크박스 | `components/ui/`, `app/learning/learning-message.tsx` |
| P101–P105 | 파비콘·앱 아이콘·시작 심볼 | `public/brand/`, `public/startup/`, `app/startup-screen.tsx` |

## 표현과 동작 기준

- 공통 `HaruIcon`은 승인 원본의 16px·24px 도형을 사용합니다. 16px 이하에는 compact,
  그보다 큰 표시 크기에는 regular 도형을 선택하며, 호출부의 크기·색상·스타일 API를 유지합니다.
- 연결표의 66종과 기존 Select 스크롤에 필요한 승인 `chevron-up`을 포함해 67종을 사용합니다.
- 심볼은 기존 문구를 보조합니다. 장식 SVG는 접근성 트리와 키보드 순서에서 제외합니다.
- 선택·수정·다운로드·저장 핸들러, 비활성화 조건, native 입력과 Radix의 역할·상태를 보존합니다.
- 이미지 연습의 위치 저장은 성적 저장과 구분합니다. 학습·문법 요약은 기존 저장 확인 조건을 따릅니다.
- 이미지 연습창은 확대된 설명에 전체 폭을 제공하고, 카드 본문과 조작부를 창 안에 배분합니다.
  작은 화면에서 글자를 키워도 본문을 스크롤할 수 있고 조작부가 창 아래로 밀리지 않도록 검사합니다.
- P059·P060의 복습 카드 심볼은 기존 `.review-icon` 숨김을 유지합니다.
- P099는 재사용 가능한 하위 메뉴 컴포넌트이며 현재 앱 화면의 소비처가 없습니다.
- P100은 기존 Radix 체크박스의 시각 표시를 교체합니다. 기존 승인·확인 절차를 생략하지 않습니다.
- 복원 최종 확인창의 설명과 버튼은 확대된 글자에서 줄바꿈하고 창 안에서 스크롤할 수 있습니다.
  백업 보관·확인 체크·최종 확인 및 취소 순서는 유지합니다.
- 가로로 넘치는 기록 표는 이름이 있는 영역으로 Tab 접근과 방향키 스크롤을 지원합니다.
  표·행·열 머리글의 native 의미와 기존 데이터는 유지합니다.
- P105는 기존 기기별 시작 이미지 26장의 중앙 심볼만 교체합니다. 캔버스 크기·배경·기기 조건은 유지합니다.

## 브랜드 자산 재생성

승인 원본은 `public/brand/`에 보존합니다. 다음 명령은 기존 경로에 앱 PNG,
16/32/48px ICO, 32px PNG와 26개 시작 PNG를 재생성합니다.

```sh
node --experimental-strip-types scripts/generate-startup-images.mjs
node --experimental-strip-types --test tests/startup-assets.test.mjs
```

`app/layout.tsx`와 `public/manifest.webmanifest`의 기존 연결 경로를 그대로 사용합니다.

## 브라우저 검증

```sh
npm run build
node scripts/qa-haru-icons.mjs
```

Playwright와 axe-core가 준비된 환경에서 실행합니다. GitHub Actions의
`Haru icon UI verification` 워크플로가 동일한 실행 환경과 아티팩트를 제공합니다.
모든 데이터는 격리한 로컬 Worker의 합성 계정에 생성하며 실제 AI 생성은 비활성화합니다.

| 검증 파일 | 책임 |
| --- | --- |
| `tests/haru-icons-qa.cjs` | 공통 메뉴·헤더·오늘 학습과 읽기 전후 기록 비교 |
| `tests/haru-session-icons-qa.cjs` | 일일 학습 전 과정, 저장 503와 재시도, 과거 기록 보존 |
| `tests/haru-content-icons-qa.cjs` | 이미지 연습·단어장·문법 학습의 아이콘과 실제 조작 |
| `tests/haru-record-icons-qa.cjs` | 복습·기록·백업·복원·발음·타이머·AI 참고 의견 |
| `tests/haru-system-icons-qa.cjs` | 설정·출처·임시 입력·공통 컨트롤·브랜드 |
| `tests/backup-workflow-qa.cjs` | 복원 revision 충돌, 응답 손실, 서버 재확인과 기록 보존 |

기존 편집 저장·오늘 학습 상태·추가 학습·반복 학습·화면 흐름·학습 레이아웃 검증도 함께 실행합니다.
새 아이콘 검사는 화면 폭 320/390/430/768/1440px와 글자 크기 100/200%를 기준으로,
가로 넘침·SVG 크기·장식 의미·axe 결과·실제 버튼 가림을 확인합니다.
검사별 정확한 실행 조합, 예외적인 상태, 캡처 목록과 실패 원인은 각 JSON 보고서에 남깁니다.

읽기 전후 비교는 현재 앱의 grammar protocol 5, feedback structure, sense-key 지원 헤더를 사용하여
서버 revision과 전체 state를 비교합니다. 학습·설정처럼 쓰기가 필요한 검사에서는 의도한 변경과
보존되어야 하는 과거 회차를 구분합니다.

검증 결과는 `outputs/haru-icons/suite-<engine>.json`과 각 검증 폴더에 저장됩니다.
실제 iPhone/iPad와 Safari의 설치·시작 화면 동작은 Chromium 뷰포트 검증에 포함되지 않습니다.
