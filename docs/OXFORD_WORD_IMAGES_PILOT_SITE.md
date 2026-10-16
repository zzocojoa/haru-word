# 이미지 연습 20개 — 기존 Sites 반영

**시범 단계 이력:** 아래 v128/v129·20개 화면·정적 파일 MIME/캐시 한계는 당시 기록이다. 이후 원격 이미지 경로의 호스팅·전체 3,809개 UI·긴 단어 편집창 수정과 PR #35 병합을 완료했다. 현재 Site v132의 범위와 복구는 [전체 UI](OXFORD_WORD_IMAGES_FULL_UI.md)와 [최종 상태](releases/2026-10-16-oxford-images-release-status.json)를 따른다. 현재 운영을 이 문서의 이전 시범 버전으로 되돌리지 않는다.

2026-10-15 KST. 사용자가 기존 사이트에서 시범을 직접 확인하도록 게시를 요청했다. 최초 계획의 로컬 전용 범위를 이 후속 작업에서 확장한다. 현재 작업은 `codex/word-image-pilot-site`이며 최초 로컬 브랜치 `codex/word-image-pilot@b1a772e`는 보존한다.

**시범 단계 마지막 게시 v129 — 뜻·품사 즉시 표시 보완:** 소스 `1f6c2b5266061dc95d940da0e9176b57209c0a17`, 환경 revision65였다. 아래 후속 보완과 별도 출시 기록은 당시 결과다.

최초 v128 소스는 `283ce3f21659501df6779bc566289c35607bb9ef`, 환경 revision65, 공개 정책 revision4다. 사이트 저장소 동기화·게시는 완료했고 GitHub main 병합은 수행하지 않았다.

## 변경 범위와 사용법

- 기존 하루단어 사이트의 **오늘의 학습 → 이미지 연습**에서 그림 → 단어 확인 → 다음으로 20개를 살펴본다. 학습 중이면 저장 후 홈으로 이동한다. 별도 연습 성적은 저장하지 않는다.
- **전체 단어장 → apple → 편집창**의 제목 옆에서 작은 미리보기를 확인한다. 기본 뜻이 달라지거나 개인 단어면 표시하지 않는다.
- 원본 생성·수정 없이 1086×1448 PNG 20개(41,080,212바이트)를 640×853 WebP 20개(**649,694바이트**, 개별 최대 57,656바이트)로 변환했다. 원본 SHA와 웹 파일 SHA를 별도로 보존한다.
- 작은 웹 목록과 WebP만 Git/배포에 포함한다. 원본은 `work/oxford-image-pilot/`로 옮겼으며 원본 PNG가 공개 폴더에 남으면 빌드를 차단한다. 파일명은 해시를 사용한다. `_headers`의 1년 immutable 설정은 로컬 Worker에서 확인했지만, **현재 Sites 운영 응답에는 적용되지 않는다**. 운영 실측은 `application/octet-stream`과 `public, max-age=0, must-revalidate`다. 장기 캐시가 적용되었다고 주장하지 않으며 플랫폼 캐시 지원은 후속 확인 사항이다.
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

게시 후 공개 홈의 시범 플래그 true와 이미지 **20/20 HTTP 200·총 649,694바이트·해시 일치**를 읽기 전용으로 확인했다. 학습 API는 호출하지 않았다. 실제 운영에서 관측한 MIME/캐시 헤더와 `nosniff`를 로컬 가상 계정 앱에 재현하여 Chromium/WebKit 각각 20개 디코딩·정답 표시·저장/AI 요청 0을 확인했다. 이 검사는 운영 개인 기록 UI 검사나 실제 iPhone 확인과 구분한다. 초기의 엄격한 운영 헤더 비교는 실패했으며 바이트 불일치가 아닌 플랫폼 헤더 차이로 진단했다.

첫 전체 검사에서 추가한 빌드 검사가 기존 보안 가드 테스트의 격리 fixture에 없는 파일을 정적 import해 2건 실패했다. 검사를 npm build 진입으로 옮기고 기존 실행기를 보존한 뒤 590개 전체가 통과했다. 새 무결성 테스트의 디렉터리 `cpSync`는 이 Windows Node 환경에서 프로세스 종료를 재현했으며 파일별 복사로 바꿔 통과했다. Sites build helper의 npm shim 경로 실패는 네이티브 npm CLI로 같은 build script를 실행해 복구했다. helper 실패를 성공으로 집계하지 않는다.

Sites 패키징은 기본 Bash의 Windows 경로 처리, Node22의 디렉터리 복사 종료, GNU tar의 드라이브 문자 해석 때문에 실패했다. 애플리케이션 소스나 플러그인을 수정하지 않고 **번들 Node24.19.0·Git Bash·세션 한정 `TAR_OPTIONS=--force-local`**로 같은 공식 source helper를 실행해 패키징을 완료했다. 앱 테스트·빌드는 Node22.22.2 결과이며 이를 Node24 CI 통과로 바꾸지 않는다. 압축 아카이브 7,096,032바이트의 Worker 진입점·20개 웹 파일 해시·Sites manifest·기존 SQL 바이트와 원본 PNG 미포함을 별도로 확인했다.

## 복구 및 관측

위험도 낮음. 기존 API/DB/백업 호환성과 revision 보호를 유지하며 새 마이그레이션·관측 로그·개인 문장/답변 기록은 없다. 이미지 실패 시 정답 없이 건너뛸 수 있고, 현재/다음 한 장만 요청한다. 기존 학습·성적은 시범 연습과 분리한다.

1. 장애 시 `word_image_pilot_enabled=false`로 변경하고 **같은 저장 버전**을 기존 Sites에 재배포한다.
2. 새로 연 페이지에서 연습 진입·편집 미리보기가 사라지는지 확인한다. 이미 열린 탭은 입력을 저장한 뒤 새로고침한다. 캐시한 파일이 있어도 앱 진입은 플래그로 차단된다.
3. 필요하면 직전 **v127**을 재배포한다. 이번에는 기록 형식 변경이 없으므로 역마이그레이션이 없다. DB·학습 기록·원본·승인 원장을 삭제하지 않는다.

전체 3,809개 공개 호스팅/시범 확대는 후속 범위다. 이번 게시 후 사용자 휴대전화에서 이미지·뜻·조작을 직접 확인한다.

## 후속 보완 — 같은 철자의 뜻 구분

사용자가 서로 다른 이미지에 같은 단어가 나온다고 보고했다. 20개 항목은 철자 16개이며 `about`(~에 관하여/대략), `bank`(은행/강둑), `light`(밝은/가벼운), `record`(기록/녹음하다)가 두 번씩 포함된다. 이미지 20개·ID 20개·승인 원본 연결은 서로 다르다. 뒷면에서 뜻까지 접어 두어 차이가 보이지 않는 표시 문제를 수정한다.

- 앞면은 그림만 유지한다. **단어 확인 후 영단어 → 해당 이미지의 뜻 → 한국어 품사와 사전 코드**를 바로 표시한다. 발음 도움말만 `발음`으로 접어 둔다.
- 예: 9번은 `bank / 은행 / 명사 (n.)`, 10번은 `bank / 강둑 / 명사 (n.)`다. 항목을 삭제하거나 합치지 않는다. 기존 기록과 이미지·교재 내용은 변경하지 않는다.
- 변경 전 built Worker에서 뜻이 바로 보이지 않는 회귀 실패(`sense-red-back`, 종료1)를 확인한 뒤 최소 화면·CSS 변경을 적용했다.
- [후속 검증·게시 기록](releases/2026-10-15-word-image-senses.json)에 전체 테스트·타입·린트·빌드, Chromium/WebKit 9개 시나리오·20개 전환·네 쌍의 뜻/품사 구분·긴 뜻 320/390/1440px/200%·axe와 로컬 D1 불변 결과를 남긴다. 캡처는 Git 제외 `outputs/word-image-sense/<engine>/`다.
- 위험도 낮음. API/DB/백업/성적/revision, 이미지 원본·연결 목록, 환경·접근 범위·의존성·관측 로그 변경과 마이그레이션이 없다. 기존 플래그 false 재배포로 시범을 끌 수 있고, 필요하면 직전 v128로 복구한다. 실제 iPhone·VoiceOver·Node24 CI·관계없는 전체 브라우저 모음은 이번 수정에서 검사하지 않는다. 운영 MIME/캐시 한계는 위 v128 기록과 같다.
