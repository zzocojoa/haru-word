# 이미지 연습 20개 — 기존 Sites 반영

2026-10-15 KST. 사용자가 기존 사이트에서 시범을 직접 확인하도록 게시를 요청했다. 최초 계획의 로컬 전용 범위를 이 후속 작업에서 확장한다. 현재 작업은 `codex/word-image-pilot-site`이며 최초 로컬 브랜치 `codex/word-image-pilot@b1a772e`는 보존한다.

## 변경 범위와 사용법

- 기존 하루단어 사이트의 **오늘의 학습 → 이미지 연습**에서 그림 → 단어 확인 → 다음으로 20개를 살펴본다. 학습 중이면 저장 후 홈으로 이동한다. 별도 연습 성적은 저장하지 않는다.
- **전체 단어장 → apple → 편집창**의 제목 옆에서 작은 미리보기를 확인한다. 기본 뜻이 달라지거나 개인 단어면 표시하지 않는다.
- 원본 생성·수정 없이 1086×1448 PNG 20개(41,080,212바이트)를 640×853 WebP 20개(**649,694바이트**, 개별 최대 57,656바이트)로 변환했다. 원본 SHA와 웹 파일 SHA를 별도로 보존한다.
- 작은 웹 목록과 WebP만 Git/배포에 포함한다. 원본은 `work/oxford-image-pilot/`로 옮겼으며 원본 PNG가 공개 폴더에 남으면 빌드를 차단한다. 웹 파일은 해시 이름과 1년 immutable 캐시를 사용한다.
- 운영에서는 `word_image_pilot_enabled=true`로 켠다. 미설정/false는 비활성이다. 개발 모드는 기존처럼 활성화한다.

## 운영 소스 보존

기준은 실제 운영 **v127의 `87ed7b3a823779eb8e0c877bdf034ea21c12a4e5`**다. GitHub main 기반 로컬 시범을 통째로 게시하지 않고, 시범 커밋만 운영 기반에 옮겼다. README 충돌에서는 시범 안내만 반영했으며 main의 별도 카드 Git 정리 문단을 끌어오지 않았다.

카드 작업실 생성 파일/릴레이/진단 API와 교재·저장 API·백업/DB 스키마·lockfile·Sites 식별자/바인딩은 이 운영 기준과 동일하게 유지한다. 운영 DB 마이그레이션·AI 호출·카카오 발송·새 사이트·접근 범위 변경은 없다. 기존 환경 설정은 보존하고 시범 플래그 하나만 추가한다. GitHub main 병합은 별도 상태이며 Sites 게시와 혼동하지 않는다.

## 재현 명령

```powershell
npm run images:pilot:prepare
npm run images:pilot:web
npm run images:pilot:check
npm test
npm run typecheck
npm run lint
npm run build
npm start -- --port 5198 --var word_image_pilot_enabled:true --var grammar_enabled:true --var large_backup_restore_enabled:true
```

일반 clone/CI는 체크인한 WebP를 검사하므로 제작 PC나 원본 파일이 없어도 테스트·빌드할 수 있다. 원본 준비/변환만 제작 PC에서 수행한다. Sharp는 기존 lockfile의 의존성을 사용하며 새 의존성을 추가하지 않았다.

로컬 가상 계정만 검사한다. `QA_BASE_URL=http://127.0.0.1:5198`, `QA_IMAGE_PILOT_MODE=enabled`, 설치된 Playwright/axe 경로를 설정한 뒤 다음을 실행하고 `QA_BROWSER=webkit`으로 반복한다.

```powershell
node tests/image-practice-qa.cjs
node tests/image-practice-qa.cjs isolation
node --experimental-strip-types tests/editor-save-qa.cjs
```

별도 플래그 없는 built Worker에는 `node tests/image-practice-qa.cjs production`으로 진입/편집 미리보기/이미지 요청 부재를 검사한다. QA 산출물은 Git 제외 `outputs/word-image-pilot-site/`, 명령 원자료는 `work/pilot-evidence/site-*.json`에 보관한다. 최초 로컬 검증 증거를 덮어쓰지 않는다.

## 검증과 제한

전체 단위 검사 590개·타입·린트·빌드, Chromium/WebKit의 9개 시나리오와 실제 로컬 D1 전후 대조를 실행했다. 세부 종료 코드와 게시 결과는 [출시 기록](releases/2026-10-15-word-image-pilot.json)에 남긴다. 320/390/1440px·글자 100/200%·키보드/포커스·axe, 모든 이미지의 실제 디코딩, 실패/늦은 이벤트, 뜻 불일치, 기록 격리와 편집 실패/재시도를 포함한다. 실제 iPhone·VoiceOver·운영 개인 기록 QA·Node 24 CI는 수행하지 않았다. 이미지 단서는 유일한 정답을 보장하지 않으며 영어 정확도 인증이나 자동 채점이 아니다.

첫 전체 검사에서 추가한 빌드 검사가 기존 보안 가드 테스트의 격리 fixture에 없는 파일을 정적 import해 2건 실패했다. 검사를 npm build 진입으로 옮기고 기존 실행기를 보존한 뒤 590개 전체가 통과했다. 새 무결성 테스트의 디렉터리 `cpSync`는 이 Windows Node 환경에서 프로세스 종료를 재현했으며 파일별 복사로 바꿔 통과했다. Sites build helper의 npm shim 경로 실패는 네이티브 npm CLI로 같은 build script를 실행해 복구했다. helper 실패를 성공으로 집계하지 않는다.

## 복구 및 관측

위험도 낮음. 기존 API/DB/백업 호환성과 revision 보호를 유지하며 새 마이그레이션·관측 로그·개인 문장/답변 기록은 없다. 이미지 실패 시 정답 없이 건너뛸 수 있고, 현재/다음 한 장만 요청한다. 기존 학습·성적은 시범 연습과 분리한다.

1. 장애 시 `word_image_pilot_enabled=false`로 변경하고 **같은 저장 버전**을 기존 Sites에 재배포한다.
2. 새로 연 페이지에서 연습 진입·편집 미리보기가 사라지는지 확인한다. 이미 열린 탭은 입력을 저장한 뒤 새로고침한다. 캐시한 파일이 있어도 앱 진입은 플래그로 차단된다.
3. 필요하면 직전 **v127**을 재배포한다. 이번에는 기록 형식 변경이 없으므로 역마이그레이션이 없다. DB·학습 기록·원본·승인 원장을 삭제하지 않는다.

전체 3,809개 공개 호스팅/시범 확대는 후속 범위다. 이번 게시 후 사용자 휴대전화에서 이미지·뜻·조작을 직접 확인한다.
