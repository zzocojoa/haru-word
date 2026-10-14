# Oxford 이미지 회상 연습 20개 — 로컬 검증 보고서

2026-10-14~15 KST. **로컬 구현과 필수 검증을 마쳤다. 사용자 캡처 확인은 대기 중이다.** 운영 게시·전체 이미지 호스팅·이미지 재생성·실제 AI 호출은 실행하지 않았다.

## 구현과 보존 범위

- 구현 위치: `C:/Users/user/.codex/worktrees/word-image-pilot/하루단어`, 브랜치 `codex/word-image-pilot`. 기준 `github/main@c6c5ed9`, 화면 코드 `1e55cd1`. 로컬 커밋이며 원격 PR·병합·배포는 이번 산출물이 아니다.
- 이미지 원본: 승인 제작 체크아웃 `228f8ba`의 시범 ID 20개와 최신 승인 PNG. 1086×1448 원본 20개, 총 41,080,212바이트를 해시 주소로 로컬 복사했다. 최초 복사 20개, 재실행 복사 0개·재사용 20개다.
- 준비 명령은 승인 상태·정확한 20개·교재 및 항목 지문·PNG 해시/크기·안전한 파일명·기존 파일 일치를 검사한다. 다르면 중단하며 다른 파일을 덮어쓰지 않는다. 작은 목록만 앱에 넣고 PNG는 Git에서 제외했다.
- `resolveWordImage(word, selectedMeaning)`는 ID·품사·기본 뜻을 대조한다. 은행/강둑 등 같은 철자의 다른 뜻, 개인 단어, 미지원 항목을 섞지 않는다.
- 오늘 학습 개요의 별도 `이미지 연습`은 화면 메모리만 사용한다. 이미지 앞면 → 영단어 뒷면 → 다음/재시작 흐름이다. 뜻·발음은 뒷면의 접힌 도움말에서 제공한다. 현재와 다음 한 장만 요청하며 로딩 중 확인을 막고 오류는 정답 없이 건너뛴다. 닫기·탭 이동·새로고침 후 초기화한다.
- 편집창 제목 옆 미리보기는 같은 선택 로직을 사용한다. 다른 뜻·새 뜻 초안이면 숨기고 기존 초안·저장 재시도·닫기 보호를 유지한다.
- `imagePilotEnabled`의 기본은 false이며 서버가 개발 모드에서만 켠다. 운영 빌드의 진입·미리보기·이미지 요청은 0이다.
- `State`·`Session`·`Progress`, 저장/복원 API, 백업·DB 스키마, lockfile, Sites 식별자·바인딩은 변경하지 않았다. 새 DB 마이그레이션은 없다. 가상 계정 검사를 위해 기존 SQL 5개를 이 체크아웃의 빈 **로컬** D1에만 적용했다.
- 기본 프로젝트의 `codex/card-automation-topic-alignment@429d966`과 기존 미커밋 파일 18개, 제작 원장·manifest 및 사용한 원본 PNG 20개의 해시를 보존 검사로 확인했다. 원래 계획 문서의 SHA도 유지했다.

## 실행 결과

실제 argv·시각·종료 코드·원자료 SHA는 [기계 판독 결과](oxford-word-image-pilot-verification.json)에 있다. 전체 stdout/stderr는 이 체크아웃의 Git 제외 `work/pilot-evidence/<label>.json`에 보관했다. Node 22.22.2, 설치된 Playwright의 Chromium·WebKit을 사용했다.

| 명령/검사 | 결과 | 종료 코드/증거 라벨 |
|---|---|---|
| `npm run images:pilot:prepare` | 승인 20개 검증, 복사·재사용 확인 | 0 · `prepare-real`, `final-prepare-reuse` |
| `npm test` | 579 통과, 실패·스킵 0 | 0 · `final-tests` |
| `npm run typecheck` | 통과 | 0 · `final-typecheck` |
| `npm run lint` | 오류 0, 경고 15 | 0 · `final-lint` |
| 최종 QA 파일 ESLint | 오류·경고 0 | 0 · `final-exit-qa-lint` |
| `npm run build` | 통과 | 0 · `final-build-unlocked` |
| 이미지 연습 9개 시나리오 | Chromium·WebKit 모두 통과 | 0 · `final-chromium`, `final-webkit-exit-ready` |
| 실제 로컬 D1 전후 대조 | 두 엔진 모두 상태·revision 동일 | 0 · `final-d1-chromium`, `final-d1-webkit` |
| 운영 빌드 비활성 검사 | 두 엔진 모두 진입·미리보기·이미지 요청 없음 | 0 · `final-production-chromium`, `final-production-webkit` |
| 기존 편집 저장/재시도 | 두 엔진 모두 통과 | 0 · `regression-editor-chromium`, `regression-editor-webkit` |
| 기존 친숙도·회상 흐름 | Chromium 통과 | 0 · `regression-familiarity-chromium`, `regression-workflow-chromium` |
| 기존 시트·초안·복원 보호 | 두 엔진 모두 통과 | 0 · `regression-sheet-*-complete-flags` |
| 원본·주 작업·API·스키마 보존 | 통과 | 0 · `final-preservation` |

앞면·뒷면·편집창(긴 `bicycle` 제목 포함)은 320/390/1440px, 글자 100/200%에서 가로 넘침·axe 오류가 없었다. Enter/Space/Escape·진입 버튼으로 포커스 복귀·앱 뒤로가기 제스처도 확인했다. 앞면 20개에서 영단어/뜻을 숨기고 모든 이동에서 다음 한 장까지의 요청만 허용했다. 로딩 지연·503·이전 이미지의 늦은 이벤트·0개/19개 적합 목록을 검사했다.

로컬 D1 검사는 전용 가상 계정에 합성 기록을 준비하는 PUT 1회를 **연습 전** 실행한다. 이후 20개 연습·재시작·닫기·재접속을 거쳐 친숙도·최초 풀이·영어/한국어 답·913초 수업 기록·학습일·복습 관련 필드와 revision을 포함한 전체 문서를 그대로 대조했다. **연습 중 저장·AI 요청은 각각 0회**다. 모의 HTTP 대조와 실제 로컬 D1 대조를 구분했다.

린트 경고 15개 중 13개는 수정하지 않은 기존 파일, 2개는 로컬 PNG를 그대로 표시하는 `<img>`다. 시범 원본과 해시 주소를 유지하기 위해 이미지 최적화 경로로 바꾸지 않았다. 빌드에는 `punycode` 폐기 예정 경고와 500KB 초과 청크 경고가 남는다.

## PDCA 과정과 발견 사항

준비·선택·화면·미리보기 단계는 실패 행동 검사 → 최소 구현 → 통과 커밋 순으로 진행했다. 준비 계약 10개, 작은 목록/선택 검사 3개와 실제 컴포넌트 브라우저 검사를 사용했다. 컴파일 오류를 RED로 취급하지 않았다. 네트워크 검사 한 번의 사전 설명을 누락했으며 완전한 절차 준수로 기록하지 않는다.

실제 화면 결함은 **WebKit 닫기 뒤 포커스 경쟁**이었다. 직접 포커스를 주면 기존 화면 이동 복원이 덮어쓸 수 있어 공통 `useViewRestoration`의 destination 우선순위를 재사용했다. 실패 `red-webkit-focus-target`와 통과 `green-webkit-focus-target`를 보존했고 최종 양쪽 전체 검사로 확인했다.

다음 실패는 제품의 학습 오류로 집계하지 않고 원인 확인 후 검사 환경/선택자를 수정했다.

- 모듈 파일명 `feedback`을 AI API로 오인한 초기 라우팅, 로컬 개발의 모의 로그인 쿠키 누락.
- 숨겨진 IPA까지 잡은 영어 선택자, 읽기 전용 저장 뜻을 직접 수정하려던 검사, `미기록`을 정답 `기록`으로 본 부분 문자열 비교.
- 창의 실제 종료·포커스 복원 전에 다음 검색을 채운 WebKit 검사. 기존 저장 검사와 같이 overlay 분리 뒤 실제 클릭·입력을 사용했다.
- 기존 시트 검사가 기대하는 `grammar_enabled=true`·`large_backup_restore_enabled=true` 로컬 옵션 누락. 운영 설정은 변경하지 않았다.
- Windows CRLF 파일과 Git LF blob의 바이트 비교, 실행 중인 로컬 Worker의 `dist/client` 잠금. 시작 해시/Git diff로 보존을 확인하고 Worker 종료 뒤 빌드를 완료했다.
- 초기 의존성 설치 helper의 npm 경로 오류는 네이티브 `npm.cmd run install:ci`로 복구했다. 장면 검수용 브라우저 문서는 같은 로컬 HTML origin에서 원본 20개를 디코딩한 뒤 검수했다. 원본 파일 편집은 0이다.

## 재현·회귀 실행

[README](../README.md)의 준비/개발 명령을 따른다. 신규 검사는 `tests/qa/manifest.cjs`에 등록했다. 환경 변수는 해당 명령 세션에서만 설정한다.

```powershell
$env:QA_BASE_URL='http://127.0.0.1:5197'
$env:QA_IMAGE_PILOT_MODE='development'
# 설치된 경로로 QA_PLAYWRIGHT_PATH, AXE_CORE_PATH를 설정
node tests/image-practice-qa.cjs
$env:QA_BROWSER='webkit'
node tests/image-practice-qa.cjs
node tests/image-practice-qa.cjs isolation
```

`isolation`은 이 전용 QA 체크아웃의 모의 로그인 계정에 합성 자료를 넣는다. 개인 로컬 기록이 있는 작업 폴더에서 실행하지 않는다. 기존 시트 회귀에는 빌드한 Worker를 다음 로컬 옵션으로 실행했다.

```powershell
npm start -- --port 5198 --var grammar_enabled:true --var large_backup_restore_enabled:true --log-level warn
```

이때 `QA_BASE_URL`은 5198로, `QA_IMAGE_PILOT_MODE`는 제거하거나 `production` 인수를 사용한다. 추가 빌드 전 이 Worker를 종료하여 Windows 출력 폴더 잠금을 피한다. 실제 명령은 원자료 JSON에 있다.

## 캡처·복구·후속

- [앞면](../outputs/word-image-pilot/chromium/front.png), [뒷면](../outputs/word-image-pilot/chromium/back.png), [편집창](../outputs/word-image-pilot/chromium/editor.png): 실제 로컬 화면 390×844. 별도 크기/확대 캡처와 WebKit 결과도 `outputs/word-image-pilot/`에 있다. PNG와 검사 산출물은 Git 제외이며 로컬에서 보존한다.
- 사용자의 캡처 확인을 요청했다. 답변 전에는 확인 완료로 기록하지 않는다. 실제 iPhone 청취/기기 검사는 수행하지 않았고 데스크톱 Chromium/WebKit 결과와 구분한다.
- CI·원격 PR/병합은 실행하지 않았다. 로컬 통과를 Node 24 CI 통과나 전체 브라우저 QA 목록 통과로 표현하지 않는다.
- 비활성화는 운영 빌드를 사용하거나 `app/page.tsx`의 `imagePilotEnabled`를 false로 전달하면 된다. 저장 기록이 없어 데이터 역변환/복구가 필요 없다. 원본·승인 원장·기존 기록을 삭제하지 않는다. 이번 변경으로 새로운 관측 로그·비밀 값/개인 문장 기록을 추가하지 않았다.
- 이미지 단서는 유효한 단어 하나를 보장하지 않는다. 특히 관사·접속사·조동사는 사용자 시범 확인 후 다루며 이번에 자동 채점/영어 정확도 인증을 추가하지 않는다.

**ACT 개선점 3개:** (1) 닫기 포커스는 기존 복원 우선순위에 연결하고 정확한 대상까지 검증한다. (2) 브라우저 검사 시작 전에 로그인·기능 플래그·종료 애니메이션 계약을 맞추고 빌드/운영 미리보기를 순서대로 실행한다. (3) 원본 약 41MB는 로컬 시범용이다. 사용자 확인 뒤 별도 계획에서 웹용 압축·전체 3,809개 호스팅·캐시/실패 처리·운영 반영을 정한다.
