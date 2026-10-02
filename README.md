# 하루단어 · Oxford 3000

본인 전용 카드 제작·PNG 저장·카카오 예약의 로컬 통합안과 활성화·복구 절차는 [영어 카드 통합](CARD_STUDIO_INTEGRATION.md)을 참조하세요. 아직 운영에 반영하지 않았습니다.

한국어 설명·원문 기능·성분 분석 후보는 승인된 최대120회 중71회·누적806회를 평가했습니다. **Google42/60·Groq3/60, 기존17결함의 과거 실패 차원 해소 관찰3·반복5·불가9**로 학습 적용을 보류합니다. Groq HTTP400 뒤49행은 미호출이며 평가 임시세키를 제거하고 실제 토큰404를 두 번 확인했습니다. [실제 결과·확인/미확정 원인·호환 롤백](ENGLISH_ACCURACY_ANNOTATED.md)을 따릅니다. 운영 학습 후보는false이며 기록·점수·v3 지원과 과거 판정을 유지합니다.

전치사·절 범위·원문 근거를 구분하는 [후속 후보](RELATIONAL_FEEDBACK.md)와 [평가 전용 경로·수집기](ENGLISH_ACCURACY_RELATIONAL.md)를 소스에 연결했습니다. 준비 검사는 전체704개·타입·린트·Worker 빌드를 통과했습니다. 준비 시점에는 추가 실제 호출0이며 새 최대120회 범위의 별도 승인은 없습니다. 정확한 CI·닫힌 게시 상태는 Git 제외 `PROJECT_HANDOFF.md`에서 확인합니다. 실제17건 해결은 추가 평가가 필요합니다.

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

반복 미달의 확인/미확정 원인과 영어 오류17건 개선 후보는 [원인 조사](ENGLISH_ACCURACY_ROOT_CAUSE.md)를 참조하세요. 추가60회·누적540회에서 기존 오류13건 해소 관찰·3건 반복·1건 불가·회귀1짝으로 후보 적용을 보류했습니다. [실제 짝 비교 보고서](ENGLISH_ACCURACY_CAUSE_PILOT.md)에 남은 원인과 평가 종료를 기록하며 기존 점수·판정·480회 원장은 유지됩니다.

후속 출력 계약은 별도 최대120회 무료 승인 뒤115회·누적655회를 실행했고 Groq 한도로5건을 중단했습니다. Google7/60·Groq4/60·출력 거절98·언어 오류4·기존17건 중반복1/불가16으로 후보 적용을 보류했습니다. [실제 평가와 종료 보고서](ENGLISH_ACCURACY_EVIDENCE.md)를 참조하세요. 학습 후보는 비활성·평가 키는 제거됐고 기존 기록과 과거 판정은 유지됩니다. [준비 당시 승인·원장/해시·가림·종료 절차](ENGLISH_ACCURACY_ROOT_CAUSE.md#전체60문장-후보-평가-준비--추가120회는-미승인)는 과거 준비 기록이며 실행 옵션이 새 승인을 대신하지 않습니다.

별도 출력 진단20회·누적675회에서 확인한 첫 거부 분기와 후보는 [진단 보고서](ENGLISH_ACCURACY_DIAGNOSTICS.md)를 참조하세요. 후속 후보는 새 최대120회 무료 승인 뒤26회·누적701회에서 Google 실행 조건400·Groq 한도429로 중단했습니다. 유효14개 중12통과·설명 누락2개, 출력 거부10·미호출94이며 **Google1/60·Groq11/60·기존17건 전부 평가 불가**로 적용을 보류합니다. [실제 결과·확인/미확정 원인·종료](ENGLISH_ACCURACY_COUNTED.md)에 근거를 남겼습니다. 실제 사용 토큰의 만료/삭제 뒤404를 두 번 확인했으며 학습 후보·기록·과거 점수와 원장을 유지합니다. [동결 계획과 실행/종료 절차](ENGLISH_ACCURACY_ROOT_CAUSE.md#표면-단위-후보의-전체-평가-준비--승인-전-기록)는 준비 당시 기록이며94미호출 행을 새 후보나 재시도에 전용하지 않습니다.

원문 단위 목록과 한국어 뜻 보호 후보는 승인된34회·누적735회 평가를 마쳤습니다. 유효17개 중 영어 통과10·언어 오류7, 출력 거절17입니다. 기존17결함은 과거 실패 차원 해소 관찰4·반복3·평가 불가10이며 전체 해결·학습 활성화를 보류합니다. [표적 평가·구체 원인·종료 보고서](ENGLISH_ACCURACY_TOKEN.md)에 근거를 남겼습니다. 실제 토큰의 만료/삭제 뒤404를 두 번 확인하고 임시세키를 제거했습니다. 과거 기록·94미호출 행·5슬롯을 유지하며34회 진단으로54/60 게시 기준을 대신하지 않습니다.

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
