# 하루단어 · Oxford 3000

**로컬 구현 · 2026-10-17:** 이미지 연습에 계정별 위치 저장과 이전·다음·번호 이동을 추가했다. 운영 미게시 상태이며 [사용·실패 복구·마이그레이션](docs/IMAGE_PRACTICE_POSITION.md)과 [검증 결과](docs/IMAGE_PRACTICE_POSITION_VERIFICATION.md)를 따른다.

**출시 상태 확인 · 2026-10-16:** 전체 이미지 연결과 긴 단어 편집창 수정은 [PR #35](https://github.com/zzocojoa/haru-word/pull/35)로 GitHub `main@c79be6b`에 병합됐고, 기존 사이트는 **v132**를 운영합니다. 10월 15일 최종 검사에서 이미지 3,809개 전체의 GET/HEAD·해시·용량·헤더와 운영 화면 파일을 확인했습니다. [최종 상태·검증 요약](docs/releases/2026-10-16-oxford-images-release-status.json)에 당시 검증과 이번 상태 조회를 구분했습니다. GitHub CI의 계정 차단, 실제 iPhone 및 외부 이미지 백업·복구 확인은 남아 있습니다.

**CI 재조사 · 2026-10-16:** GitHub Free 계정의 월 무료 실행시간 2,000분을 하루단어 저장소만으로 소진한 것을 사용량 API로 확인했습니다. PR #36의 Node 22/24 작업 네 개는 실행 서버 배정 전 차단됐으며 CI 통과가 아닙니다. 추가 실행 차단의 세부 결제·예산 조건은 미확정입니다. 사용자는 최종 로컬 문서 검증을 근거로 이 문서 PR의 병합을 승인했으며, 결제 설정·워크플로·운영 사이트는 변경하지 않습니다. 상세 근거와 한계는 위 최종 요약의 `githubCI.followUpInvestigation`에 기록했습니다.

**긴 단어 편집창 확대 수정 v132**를 기존 사이트에 게시했습니다. 제목과 이미지가 공간에 맞춰 줄바꿈되며 320/390/1440px·글자 100/200%의 Chromium/WebKit 검사를 통과했습니다. 운영 CSS가 검증한 빌드와 일치합니다. [출시 결과](docs/releases/2026-10-15-word-image-editor-wrap-rollout.json)에 런타임 커밋과 GitHub CI의 계정 결제·사용 한도 차단을 구분해 기록했습니다.

**전체 이미지 연결 v131**은 오늘 학습 개요의 이미지 연습을 3,809개로 확대하고, 단어 익히기·단어 편집창에 선택한 뜻과 품사가 일치하는 그림을 표시합니다. 기본 뜻과 다른 선택 뜻·개인 단어에는 추정한 그림을 연결하지 않습니다. 첫 답을 입력하는 진단·회상 단계에는 그림을 표시하지 않습니다. 이미지 연습은 성적을 기록하지 않습니다. 현재 로컬 후보는 닫기·탭 이동·새로고침 뒤 저장 위치의 앞면으로 이어 봅니다. [전체 UI 범위·검증·복구](docs/OXFORD_WORD_IMAGES_FULL_UI.md)와 [v131 배포 증거](docs/releases/2026-10-15-oxford-image-full-ui-rollout.json)를 참조하세요. 아래 시범·v130 기록은 전체 UI 반영 전의 호스팅 단계입니다.

`npm run images:ui:prepare`는 검증된 전체 가공·원격 목록에서 351KB 클라이언트 인덱스를 만듭니다. `npm run images:ui:check`와 빌드는 교재·뜻·품사·출처 지문·원격 연결이 다른 경우 중단합니다. 원본 생성 정보는 클라이언트에 포함하지 않습니다. 원격 이미지는 기존 사이트의 `/word-images/v1/<해시>.webp`에서 현재 항목과 다음 한 장만 요청합니다.

전체 승인 이미지 **3,809개**는 [로컬 웹용 가공](docs/OXFORD_WORD_IMAGES_WEB_PREPARATION.md)과 [결과 보고서](docs/oxford-word-images-web-preparation.json)에 따라 검증·WebP 변환·배포용 목록 작성을 완료했습니다(8.28GB → 128.6MB). 전체 연결 목록은 `data/word-image-web-manifest.json`, 바이너리와 업로드 목록은 Git 제외 `outputs/oxford-web/`에 있으며 실제 위치는 가공 문서에 적었습니다. 이후 호스팅과 전체 학습 UI 연결도 완료했습니다. 시범 20개는 전체 목록의 앞부분에 보존합니다.

[전체 이미지 호스팅](docs/OXFORD_WORD_IMAGES_HOSTING.md)은 **v130 운영 게시·3,809개 업로드·권한 폐기 후 전체 재검증**을 완료했습니다. 임시 키를 명시적으로 무효화한 뒤 삭제했고 최종 환경은 revision71·원래13개 항목입니다. 이전 키의 PUT404와 전체 파일의 SHA·MIME·캐시·GET/HEAD를 확인했습니다. 원격 연결은 `data/word-image-hosted-manifest.json`, [배포·검증 증거와 복구 절차](docs/releases/2026-10-15-oxford-image-hosting-rollout.json)를 참조하세요. v130 당시 화면은 시범 20개였으며, 현재 v132는 전체 3,809개를 연결합니다.

배포용 WebP 20개는 `public/word-images-pilot/`에 포함되며 `npm run images:pilot:check`와 빌드가 해시·뜻·용량을 검사합니다. 원본이 있는 제작 PC에서는 `npm run images:pilot:prepare` 다음 `npm run images:pilot:web`으로 재현합니다. PNG는 Git 제외 `work/oxford-image-pilot/`에 보관합니다. 기본 입력은 사용자 홈의 `.codex/worktrees/oxford-word-images/하루단어`와 `Documents/ChatGPT/하루단어/outputs/oxford-images/`이며 다른 위치는 `--source "<승인 체크아웃>" --assets "<원본 PNG 폴더>"`를 준비 명령에 전달합니다. 교재·승인·파일 해시가 다르면 중단하고 다른 파일을 덮어쓰지 않습니다.

개발 모드는 활성화되며 운영 빌드는 `word_image_pilot_enabled=true`일 때만 켭니다(기본 false). 이 플래그는 시범부터 현재 전체 이미지 화면까지 같은 이름을 유지합니다. 설정 변경은 기존 Sites 저장 버전 재배포 후 적용됩니다. 이미지 연습은 AI 채점을 호출하지 않습니다.

브라우저 검사에는 설치된 Playwright·axe 경로를 `QA_PLAYWRIGHT_PATH`, `AXE_CORE_PATH`로 설정합니다. 로컬 built Worker를 플래그 true로 실행하고 `QA_BASE_URL`을 그 루프백 origin으로, `QA_IMAGE_PILOT_MODE=enabled`로 설정하여 `node tests/image-practice-qa.cjs`를 실행합니다. `QA_BROWSER=webkit`으로 반복하며 `isolation` 인수는 로컬 D1 가상 계정 전후 대조입니다. 별도 플래그 없는 built Worker의 `production` 인수는 비활성 진입·미리보기·이미지 요청 0을 확인합니다. 운영 DB는 QA에 사용하지 않습니다.

아래 표현 사전 선정 설명은 2026-10-08 Git 통합 당시의 기록입니다.

표현을 먼저 예약한 뒤 AI 카드를 만드는 기능과 호환 릴레이·생성 파일의 Git 통합을 진행했습니다. [원본 커밋·로컬 검증·Git 상태 확인](docs/releases/2026-10-08-expression-selection-github.json)을 따르세요. 추가 실제 계정·CPU·휴대전화 검증은 사용자 선택으로 미실시이며 과거 관측 공백은 유지합니다. 마지막 배포 기록은 Site v123/0023이고 이번 Git 작업은 운영 게시·Worker 배포를 포함하지 않습니다. 아래 v121 등은 당시 기록입니다.

최종 품질 탈락 뒤 새 후보를 한 번 만드는 기능을0021·Site v121에 배포했습니다. [이번 시험](docs/releases/2026-10-06-automation-replacement-trial.json)은5장 모두 서버접수와 사용자 이미지·원본링크 정상 확인을 마쳤습니다. 과거 제작 준비 CPU 자료 공백은 사용자 승인에 따라 미검증으로 남기고 EN_Card PR11·하루단어 PR32를 병합했습니다.

개발·병합·배포 상태는 [하루단어 제품 관리](PRODUCT_MANAGEMENT.md)에서 두 저장소를 함께 확인합니다. 카드 화면의 수정 원본은 EN_Card이며, 이 저장소의 카드 생성 파일은 정식 exporter로만 갱신합니다. 최신 운영은 [Site v121·새 후보 DO 반영](docs/releases/2026-10-06-automation-replacement-rollout.json)이며, 실제5장 수신은 확인했습니다. 아래 버전 표시는 과거 기록입니다.

AI 카드 자동 제작의 설정·시작·일시정지·결과 화면과 본인 전용 서버 API를 연결합니다. 기존 Sites의 Google/Groq Secret을 사용하며, 서명·만료·중복 요청 보호를 적용합니다. 학습 AI 정확도 실험과 별도로 관리하며, 실제 무인 제작·카카오 수신 검증은 GitHub 통합 검사와 구분합니다. [카드 자동 제작 연결·마이그레이션·복구](CARD_STUDIO_INTEGRATION.md)를 참조하세요.

AI 결과를 정답 판정과 구분하는 공통 표시와 구조도 비노출·기록 보존은 [AI 참고 의견 정책](AI_REFERENCE_OPINIONS.md)을 참조하세요. 모델·요청 형식은 유지하며 정확도 개선 인증으로 표현하지 않습니다.

저장된 AI 설명의 모순 보류·기록 보존은 [AI 설명 보호](AI_FEEDBACK_SAFETY.md), 평가 자료의 진단 호환성과 실험 코드 분리 범위는 [런타임 조정 기록](docs/RUNTIME_RECONCILIATION.md)을 참조하세요.

15개 수업의 검토한 교재·정적 예문 분석·문법 v4 호환·신규 생성 중단 절차는 [문법 교재 v4 검토 보고서](GRAMMAR_REVIEWED_V4.md)를 참조하세요.

본인 전용 카드 제작·PNG 저장·카카오 예약을 [영어 카드 작업실](https://wordgrain-oxford-study.hoihou-o.chatgpt.site/cards)에서 사용할 수 있습니다. 기존 ChatGPT 로그인 후 홈의 **영어 카드**로 이동하세요. 운영 v101에 반영했으며 설정·검증 범위·복구 절차는 [영어 카드 통합](CARD_STUDIO_INTEGRATION.md)을 참조하세요.

GitHub 저장소·CI·PR 검토와 기존 Sites 배포 연결은 [GITHUB_WORKFLOW.md](GITHUB_WORKFLOW.md)를 참조하세요.

단어 편집·개인 단어 추가의 창 안 저장 재시도와 충돌 보호는 [EDITOR_SAVE_RETRY.md](EDITOR_SAVE_RETRY.md)를 참조하세요.

저장·AI·복원 요청의 스트림 크기 제한과 취소·오류 계약은 [REQUEST_BODY_LIMITS.md](REQUEST_BODY_LIMITS.md)를 참조하세요.

저장·조회·전체/분할 복원의 뜻 키·누적 한도·구형 페이지 보호는 [STATE_ROUNDTRIP.md](STATE_ROUNDTRIP.md)를 참조하세요.

저장 충돌 뒤 최신 학습 입력의 백업·복원과 성적 보존은 [RECOVERY_DRAFTS.md](RECOVERY_DRAFTS.md)를 참조하세요.

AI 제공자 공통 계약·읽기 전용 결과·재점검 버튼 상태의 리팩토링과 검증은 [REFACTORING_2026-09-30.md](REFACTORING_2026-09-30.md)를 참조하세요.

오늘 학습의 영어 품사 코드와 S/V/O/C 도움말·회귀 검사 범위는 [GRAMMAR_TERMS.md](GRAMMAR_TERMS.md)를 참조하세요.

AI 교정문의 역할별 구조·해석과 저장·구형 호환·복구 지침은 [AI_SENTENCE_STRUCTURE.md](AI_SENTENCE_STRUCTURE.md)를 참조하세요.

입력·화면 이동·집계·응답 검증·백업 복원의 리팩토링 경계와 회귀 검사는 [REFACTORING_2026-09-27.md](REFACTORING_2026-09-27.md)를 참조하세요.

iPhone 홈 화면 실행 시 초기 흰 화면의 원인, 폰트·시작 화면 개선과 검증·롤백은 [STARTUP_RENDERING.md](STARTUP_RENDERING.md)를 참조하세요.

완성된 학습 기능, 출처, 테스트, 보안·롤백 안내는 [OPERATIONS.md](OPERATIONS.md)를 참조하세요. 사전 발음 우선 정책·뜻 일치 보호·번역 교열과 복구는 [ENGLISH_ACCURACY.md](ENGLISH_ACCURACY.md)를 참조하세요. 화면은 한국어이며 전체 3,809개 학습 항목을 제공합니다. 아래는 기반 런타임의 유지보수 문서입니다.

단어장 내 15개 품사 수업의 읽기·135문제·문장 틀·복습 추천과 신구 진도 호환/배포 지침은 [GRAMMAR_PRACTICE_V2.md](GRAMMAR_PRACTICE_V2.md)를 참조하세요. 기존 90문제(v1)와 초기 구조는 [GRAMMAR_LEARNING.md](GRAMMAR_LEARNING.md)에 보관합니다.

승인 플랜 대조 검사에서 발견한 문제와 회귀 검증은 [GRAMMAR_PLAN_AUDIT.md](GRAMMAR_PLAN_AUDIT.md)에 정리합니다.

iPhone 스와이프·브라우저 뒤로가기의 화면 범위와 저장 보호·검증·롤백은 [NAVIGATION.md](NAVIGATION.md)를 참조하세요.

AI 실패 사유의 구분, 안전한 오류 계약과 검증·롤백은 [AI_FEEDBACK_ERRORS.md](AI_FEEDBACK_ERRORS.md)를 참조하세요.

AI 원문 판정·교정의 모순 차단과 비활성 원문 우선 요청 후보의 검증·게시·롤백은 [ORIGINAL_SENTENCE_FEEDBACK.md](ORIGINAL_SENTENCE_FEEDBACK.md)를 참조하세요.

추가120회·누적360회 실제 평가의 결과와 후보 게시 보류·남은 결함은 [ENGLISH_ACCURACY_ORIGINAL_FIRST.md](ENGLISH_ACCURACY_ORIGINAL_FIRST.md)를 참조하세요.

성분별 단어 수로 문구를 복원하는 비활성 후보의 비교·중단·복구는 [CHUNKED_FEEDBACK.md](CHUNKED_FEEDBACK.md)를 참조하세요. 사용자 확인 무료 계정의 추가120회·누적480회 결과와 후보 게시 보류·남은 오류는 [ENGLISH_ACCURACY_CHUNKED_FREE.md](ENGLISH_ACCURACY_CHUNKED_FREE.md)에 기록합니다.

반복 미달의 확인 원인·미확정 원인, 추가 호출 없는 재생과 안전한 출력 진단은 [ENGLISH_ACCURACY_ROOT_CAUSE.md](ENGLISH_ACCURACY_ROOT_CAUSE.md)를 참조하세요. 영어 실패 17건과 기존 점수는 유지됩니다.

AI 출처·모바일 탭·설정 문구·린트 정리와 초기 로딩 분할 실험 결과는 [CONSISTENCY_IMPROVEMENTS.md](CONSISTENCY_IMPROVEMENTS.md)에 기록합니다.

# vinext-starter

A clean full-stack starter running on [vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git is required only for publishing

## Sites Lifecycle

The Sites initializer copies the shared starter and selects managed-linux only when `SITES_MANAGED_LINUX_CONTAINER=1`; otherwise it selects portable. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Whenever reopening or moving a checkout, run `node <plugin-root>/scripts/configure-execution-profile.mjs` before project commands. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

This starter does not use `wrangler.jsonc`.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

The installer preserves the caller's lifecycle-script policy. When install scripts are enabled, `postinstall` runs the temporary `scripts/guard-braces.mjs` mitigation; `npm run dev` and `npm run build` apply or reject the guard themselves even with `npm_config_ignore_scripts=true`. The guard authenticates the exact locked `braces@3.0.3` sources, limits nesting to 100, and rejects changed versions or sources, paths outside this checkout, and source hardlinks. This is a local mitigation, not an official patched release; the braces high-severity advisory remains in npm audit metadata. Review upstream changes before updating or removing the guard during a future dependency upgrade.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are disposable and ignored by Git.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

For browser QA on managed Linux, use `sites-preview start`. The project's dev script runs Vite and accepts the supervisor's `--host 0.0.0.0 --port 4173 --strictPort` arguments. The internal browser uses `http://terminal.local:4173/`; it is not a user-facing URL. The supervisor owns the preview lifecycle. The ignored local profile survives the supervisor's cleared process environment.

The portable profile simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. Mock auth is disabled in the managed-linux profile and is not included in production builds; hosted authentication remains dispatch-owned.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm start` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm start -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Local D1 migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: preview the built Worker locally with D1/R2 support
- `npm run db:generate`: generate Drizzle migrations after schema changes

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)

## JSON 백업 복원

학습 기록의 ‘백업 가져오기’에서 기존 전체 백업과 이전 ‘현재 입력 백업’ JSON을 복원합니다. 형식과 참조를 확인한 뒤 현재·백업 기록의 차이를 보여 주며, 현재 기록 다운로드와 명시적 교체 확인을 거칩니다. 백업 시점의 설정·기록으로 전체 교체하므로 자동 병합은 하지 않습니다.

대용량 복원이 활성화되면 최대 **20 MB(20,000,000바이트)**, 단어 기록 5,000개, 회차 10,000개를 지원합니다. 기록별로 1.8 MB 이하 조각을 전송하고 전체 검증 후 한 번에 교체합니다. 한 기록 자체가 한도를 넘으면 일부를 버리지 않고 거절합니다. 한도를 넘는 원본도 보관용 다운로드는 가능합니다. 기능이 비활성인 경우 기존 8 MB 복원 경로와 안전 백업 검증을 유지합니다.

파일 크기·기록 수·복원 가능 여부를 다운로드 전에 확인합니다. 진행 중 작성하던 답은 ‘오늘 종료 · 저장’ 후 홈으로 돌아와 보관합니다. 전송이 중단되면 24시간 안에 같은 파일을 다시 선택하여 이어갈 수 있습니다. 파일명이 바뀌어도 내용이 같으면 이어집니다. 다른 기기의 저장 충돌이나 반영 결과가 불확실한 경우 ‘서버 기록 확인하기’로 최신 상태부터 확인합니다. 결과가 불확실한 상태에서 자동으로 다시 교체하지 않습니다.

운영 수명·기능 플래그·롤백·실기기 확인 범위는 [완료 감사](BACKUP_RESTORE_AUDIT.md)와 [운영 기록](OPERATIONS.md)을 참조합니다. `npm run test:browser`는 기능 검사, `npm run test:performance`는 장기 기록·초기 로딩·20 MB 복원/조회 자원 검사입니다. 성능 모음은 다른 검사와 겹치지 않게 실행합니다. 자원 검사는 테스트용 V8 제한을 적용한 별도 로컬 Worker를 사용하며 배포 설정을 바꾸지 않습니다.

학습 기록은 날짜별로 묶어 10일씩 펼쳐 볼 수 있습니다. 검색·기간 선택과 작성 중 답은 탭을 바꿔도 유지하며, CSV·전체 백업에는 모든 회차가 포함됩니다. 네트워크 응답이 오래 지연되면 화면에서 다시 시도하거나 입력을 백업할 수 있습니다. AI 응답 지연 후에는 같은 문장을 자기 점검으로 이어갑니다.

문법 v3의 버전 협상과 단계적 게시·롤백은 [GRAMMAR_PRACTICE_V3.md](GRAMMAR_PRACTICE_V3.md)를 따른다.

실제 AI 평가 실행·판정·중단 복구는 [ENGLISH_ACCURACY_EVALUATION.md](ENGLISH_ACCURACY_EVALUATION.md)를 따른다.

2026-09-30 실제 120회 평가와 프롬프트 게시 보류 판정은 [ENGLISH_ACCURACY_RESULTS.md](ENGLISH_ACCURACY_RESULTS.md)에 기록했다.

출력 실패 단계 조사·평가 전용 후보·두 번째 비교의 게시 기준은 [AI_FEEDBACK_IMPROVEMENT.md](AI_FEEDBACK_IMPROVEMENT.md)를 따른다.

후보 재평가240회 종료·Google48/60/Groq55/60·핵심 오류로 인한 게시 보류와 평가 경로 종료는 [ENGLISH_ACCURACY_REEVALUATION.md](ENGLISH_ACCURACY_REEVALUATION.md)를 따른다.
