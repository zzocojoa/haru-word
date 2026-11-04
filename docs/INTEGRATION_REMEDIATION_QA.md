# 통합 수정 QA 재현

제품 수정 원본은 `work/integration-remediation-20261104`, Task Master·4318 대시보드 원본은 기본 폴더다. 아래 제품 명령은 구현 폴더에서 실행한다. Node 22.13 이상과 기존 npm lockfile을 사용한다. 설치가 필요하면 설치된 Sites 스킬의 `install-dependencies.mjs`를 사용한다.

## 로컬 Worker와 준비 조건

1. `npm run build`로 자료 지문과 앱 빌드를 확인한다. Windows에서 실행 중인 Worker가 `dist/client`를 잠그면 **자신이 시작한 해당 Worker만** 먼저 종료하고 다시 빌드한다.
2. 외부에 설치된 Playwright와 axe 경로를 지정한다. `QA_BASE_URL`은 루프백 origin이어야 한다. 운영 주소는 사전 검사에서 거부한다.
3. 이미지 활성 검사는 승인된 전체 WebP 3,809개가 있는 `QA_WORD_IMAGE_ASSET_ROOT`를 지정한다. `public/word-images-pilot`의20개만으로 대체하지 않는다. `data/word-image-web-manifest.json`의 각 `sha256.webp`와 해시를 대조한다.
4. 별도 터미널에서 아래처럼 테스트 전용 Worker를 시작한다. 이 helper는 합성 DB/R2 바인딩·가짜 비활성 키·AI false·문법v4로 새 로컬 상태를 만들고 SQL0000~0006을 적용한다. 출력된 origin/config를 검사 터미널에 설정한다. 운영 환경·비밀 값을 복사하지 않는다.

```powershell
New-Item -ItemType Directory -Force work | Out-Null
@'
const {grammarWorker}=require("./tests/qa/worker-profile.cjs");
(async()=>{
  const worker=await grammarWorker(4);
  console.log(JSON.stringify({QA_BASE_URL:worker.base,QA_WORKER_CONFIG:worker.configPath}));
  for(const signal of ["SIGINT","SIGTERM"])process.once(signal,async()=>{await worker.stop();process.exit(0);});
})().catch(error=>{console.error(error.message);process.exitCode=1;});
'@ | node -
```

Worker 시작 뒤 다른 터미널에서 경로를 실제 로컬 값으로 채운다.

```powershell
$env:QA_BASE_URL = 'http://127.0.0.1:<출력된 포트>'
$env:QA_WORKER_CONFIG = '<출력된 로컬 wrangler.json 절대 경로>'
$env:QA_PLAYWRIGHT_PATH = '<설치된 playwright 모듈 폴더>'
$env:AXE_CORE_PATH = '<axe.min.js 절대 경로>'
$env:QA_IMAGE_PILOT_MODE = 'enabled'
$env:QA_WORD_IMAGE_ASSET_ROOT = '<승인된 전체 WebP assets 폴더>'

node tests/qa/run.cjs functional --list
$env:QA_BROWSER = 'chromium'
npm run test:browser
$env:QA_BROWSER = 'webkit'
npm run test:browser

# 기능 검사와 겹치지 않게 순차 실행
$env:QA_BROWSER = 'chromium'
$env:QA_BASELINE_URL = 'http://127.0.0.1:<별도 기준 Worker 포트>'
$env:QA_BASELINE_DIST = '<같은 기준 소스를 빌드한 dist 절대 경로>'
npm run test:performance
```

이미지 성능 비교는 후보와 **서로 다른** 기준 Worker 주소 및 그 기준 소스의 빌드 폴더가 필요하다. 주소가 없거나 같으면 비교가 시작되지 않는다. 이번 검증은 제품 원본을 보존한 기본 폴더5bbd7a6을 기준으로 별도 빌드·합성 Worker를 만들었다. 다시 실행할 때도 기준 SHA와 고정 의존성을 확인한다. 기준 폴더에서 위 시작 예제의 require 경로를 구현 폴더의 `tests/qa/worker-profile.cjs` 절대 경로로 지정하면 기준 폴더의 dist와 별도 로컬 DB를 사용한다. 기존 빌드 근거를 덮어쓰는 경우 먼저 보존한다.

runner는 실제 로컬 `/api/sentence-feedback` 상태가 `enabled:false`인지 확인한 뒤 시작한다. 상태 GET은 생성 호출로 세지 않는다. AI 응답은 브라우저의 합성 POST fixture만 사용한다. 과거 Google/Groq·structured 의견은 과거 shape로 보존하며 현재 응답에만 계약4·문맥 종류/노트/지문·요청 모델·UUID영수증을 적용한다. 실제 AI 품질 검사는 포함하지 않는다.

## 조건과 종료 보존

- 원래 기능84조건을 유지하고 인증·저장 요약2조건과 `grammar-v4-compat new-v3`1조건을 더해 기능87조건이다. 기존 성능5조건은 별도다.
- 문법v2/v3/v4는 runner가 **각 버전의 새 생성 플래그**를 가진 소유 Worker에 연결한다. 호환 검사는 저장된v4 읽기와 새v3/v4 생성을 각각 확인한다. `QA_ENGINE`도 요청한 `QA_BROWSER`와 맞춘다. 예상 답만 바꾸거나 조건을 빼지 않는다.
- 정상/실패/중단 후 `outputs/browser-suite/<그룹>-<시각>/results.json`과 원본 로그의 exit·timeout·interrupted를 확인한다. 모든 조건이 끝나고 exit0일 때만 해당 모음 통과다.
- `work/browser-qa.lock`은 살아 있는 다른 PID의 실행을 보호한다. 임의 삭제하지 않는다. runner는 자신이 만든 문법 Worker만 종료하고 마지막에 자기 잠금을 해제한다. 별도 시작한 기본 Worker는 사용을 마친 터미널에서 Ctrl+C로 종료한다.
- `pr38-lazy-recovery`는 `unrouteAll({behavior:'wait'})`로 실행 중인 route handler를 기다린 뒤 context를 닫는다. 오류 무시 옵션이나 포괄 catch로 실패를 숨기지 않는다. [Playwright 공식 설명](https://playwright.dev/docs/api/class-browsercontext#browser-context-unroute-all)을 따른다.
- `node --experimental-strip-types --test tests/qa-process.test.mjs tests/qa-worker-profile.test.mjs tests/qa-preflight.test.mjs tests/qa-runner.test.mjs`는 실제 실패의 exit1·강제 시간 초과 트리 종료·중단 정리·살아 있는 잠금 보호·합성 프로필/사전 검사를 확인한다.

이 검사는 로컬 가상 계정·에뮬레이션이다. 실제 iPhone·VoiceOver·음성 청취·운영 장애 주입과 실제 API 품질을 확인한 것으로 표시하지 않는다. 원시 로그·합성 DB·환경은 Git에 추가하지 않는다.
