# GitHub 개발·검토 절차

두 저장소의 책임·변경 순서·병합과 배포 상태는 [제품 관리 기준](PRODUCT_MANAGEMENT.md)과 [출시 기록](docs/releases/product-status.json)을 먼저 확인한다.

## 저장소와 배포 연결

- 저장소: [zzocojoa/haru-word](https://github.com/zzocojoa/haru-word), 비공개.
- 기본 브랜치: `main`. 초기 소스는 운영 v83의 `87fb546`과 기존 Git 이력을 보존한다.
- 이 체크아웃의 `origin`은 기존 Sites 소스 동기화 연결이다. GitHub는 `github` 원격을 사용한다. 기존 원격을 덮어쓰지 않는다.
- GitHub에서 새로 clone한 체크아웃은 `origin`이 GitHub다. Sites 연결·실행 프로필은 설치된 Sites 스킬 절차로 확인한다.
- `.openai/hosting.json`의 사이트 식별자와 DB 바인딩은 유지한다. GitHub Actions는 소스 검사만 수행한다. 운영 게시는 기존 Sites 절차를 따른다.

## 로컬 개발

Node.js 22.13 이상과 기존 npm lockfile을 사용한다. 새 clone에는 로컬 실행 프로필이 없으므로 기본 `portable`로 동작한다. Sites 플러그인 작업 시 프로필 설정은 README의 절차를 따른다.

```sh
npm run install:ci
npm test
npm run typecheck
npm run check:grammar-review
npm run lint
npm run build
```

로컬 미리보기는 루프백 주소에서만 실행한다. 운영 환경 변수는 GitHub에 복사하지 않는다. 비밀 값·개인 학습 기록·`.env`·`.sites-runtime`·`.wrangler`·`work`·`outputs`는 커밋하지 않는다. 이 PC의 `AGENTS.md`와 `PROJECT_HANDOFF.md`는 로컬 관리 문서로 유지한다.

## 변경과 코드 검토

현재 체크아웃에서는 변경 파일을 먼저 확인하고 최신 GitHub 기본 브랜치에서 시작한다. `git status`가 깨끗하지 않으면 진행 작업을 보존한 뒤 전환한다. Sites 운영 소스의 긴 실험 브랜치를 새 제품 작업의 기준으로 사용하지 않는다.

```sh
git status --short --branch
git fetch github main
git switch --no-track -c codex/작업명 github/main
git push -u github HEAD
gh pr create --repo zzocojoa/haru-word --base main
```

새 GitHub clone에서는 push 원격을 `origin`으로 바꾼다. PR에는 문제·검증·호환성·실패 모드·롤백을 기록하고 `/review`를 실행한다. 이 체크아웃의 검토 기준은 `github/main`이다. Sites 원격의 최신 커밋을 GitHub PR 기준으로 사용하지 않는다.

`git fetch`와 분기 기준도 새 clone에서는 `origin/main`을 사용한다. `origin`이라는 이름만 보고 GitHub로 판단하지 말고 `git remote -v`로 확인한다. 카드 원본 변경은 EN_Card PR과 내보낸 원본 커밋을 함께 기록한다. 최초 운영/main 차이 정리가 완료되기 전에는 main을 운영에 그대로 재게시하지 않는다.

## CI 범위

- `main`·`codex/**` push, `main` 대상 PR과 수동 실행을 검사한다.
- Ubuntu 24.04에서 Node 22·24와 npm 10.9.7, 잠금 의존성 설치, 단위 테스트, 타입, 린트, Worker 빌드를 검사한다.
- 첫 Node 24 실행의 기본 npm 11.19.0은 기존 lockfile의 esbuild 선택 의존성 검증에서 설치를 거절했다. Node 22와 로컬 설치에서 사용한 npm 10.9.7로 두 작업을 고정하며 의존성·lockfile을 재생성하지 않는다. npm을 올릴 때는 빈 체크아웃의 잠금 설치부터 검증한다.
- GitHub Actions는 읽기 권한만 사용하며 외부 action을 전체 커밋 SHA로 고정한다. 체크아웃 토큰을 Git 설정에 남기지 않는다.
- 동일 브랜치의 이전 검사는 새 실행이 시작되면 취소한다. 각 실행의 제한 시간은 20분이다.
- 린트 오류는 실패한다. 기존 경고 13개는 별도 정리 대상이며 이번 환경 구축에서 차단 기준을 바꾸지 않는다.
- 브라우저·성능 모음은 외부 Playwright/axe 런타임과 로컬 D1 준비가 필요하므로 이 CI에 포함하지 않는다. UI·저장·복원 변경에서는 `tests/README.md`에 따라 별도로 실행하고 PR에 결과를 남긴다.
- 실제 iPhone·VoiceOver·운영 AI·운영 데이터 검사는 CI로 대체하지 않는다. Windows/macOS는 이 CI의 대상이 아니다.

## 병합과 복구

`Validate (Node 22)`·`Validate (Node 24)` 성공과 코드 검토 후 병합한다. 2026-09-30 현재 계정은 비공개 저장소의 브랜치 보호 API에서 플랜 제한(HTTP 403)을 반환했다. 따라서 필수 검사·PR 병합을 서버에서 강제하지 못하며 직접 확인해야 한다. 공개 전환이나 유료 플랜 변경은 하지 않았다.

GitHub 설정 변경은 앱·DB·API·백업을 바꾸지 않고 마이그레이션이 없다. CI 실패는 병합 준비 실패이며 운영 앱은 기존 Sites 버전을 계속 사용한다. 설정은 해당 커밋을 revert하여 복구한다. 현재 앱의 롤백은 [GRAMMAR_PRACTICE_V3.md](GRAMMAR_PRACTICE_V3.md)를 따른다. v3 활성화 후에는 이전 v82/v84 재게시 대신 v3 지원을 유지하면서 신규 생성만 중단한다.

검사 결과는 GitHub Actions에 기록한다. 운영 저장·충돌·AI 진단은 유지하며 학습 답안이나 API 키를 CI 로그에 추가하지 않는다.
