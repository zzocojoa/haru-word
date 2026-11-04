# OpenAI 전환 구현 기록

2026-11-03 KST. 상위 15개·세부 35개 전체 구현에 착수했다. 작업 완료 여부는 `.taskmaster/tasks/tasks.json`의 `master`와 HTML 대시보드가 원본이다. 이 문서는 근거와 미검증 범위를 기록한다.

## 기준 소스와 보존

- 운영 Site v141: `3fe640c50cabd12519fc7490361e84b1ad72aed8`, tree `138158efe7e6f0aed9bb18cfca0172a9e27efc5e`. Sites 네이티브 조회와 공식 source helper로 다시 확인했다.
- GitHub main: `e746e97612c060808ca689f54f243995a5121c6b`, tree `e0165259f1ab5bfa014bad9e45fa6295997b5d1f`. 운영 소스와 차이 10개는 v141 배포 기록 등 문서뿐이며 제품 코드·의존성·바인딩은 같다.
- 구현 위치: `work/openai-api-migration-20261103`, 브랜치 `codex/openai-api-migration-20261103`. 최신 main을 기준으로 별도 checkout을 사용한다. 최초 clean 상태를 확인했다.
- 기본 폴더의 기존 변경 176개는 보존한다. 최초 `git status --short -z` 해시: `9f4d55a6e8d151b7f0d3d00be3a3dbf4b6352c74f6e117868765f2fbe71b268f`. 기존 변경을 기본 폴더에서 커밋하거나 게시하지 않는다.
- 공식 portable 프로필 설정, 기존 lockfile의 공식 의존성 설치가 exit 0으로 끝났다. 제품 검사 결과는 아직 없다.
- Site ID·DB·R2·공개 범위·한국 학습일·성적 분리·revision·전체/분할 복원 원자성을 유지한다. 이번 사용자의 OpenAI 전용 전환 요구가 기존 Google 우선/Groq 대체 지침을 대체하며, 다른 안전 지침은 유지한다.

## 호출·호환 변경 경계

| 경계 | 현재 지점 | 완료를 입증할 검사 |
|---|---|---|
| 단어 | `app/api/sentence-feedback/route.ts`, `lib/feedback-fallback.ts` | 모델 고정·409/426·OpenAI 단일 호출·개인 입력 비기록 |
| 문법 | `app/api/grammar-feedback/route.ts`, `lib/grammar/feedback.ts` | v1~v4 타깃·저장 확인·동일 모델 계약 |
| legacy 전송 | `lib/gemini-feedback.ts`, `lib/groq-feedback.ts` | 키/플래그가 있어도 두 외부 도메인 요청 0 |
| 평가 | `app/api/english-accuracy-evaluation/route.ts`, `lib/english-accuracy.ts`, `lib/original-feedback-evaluation.ts`, `lib/free-feedback-evaluation.ts`, `scripts/evaluate-{english-accuracy,original-feedback,free-feedback}.mjs` | live 진입 차단·기존 고정 자료와 순수 오프라인 재생 보존 |
| 저장 계약 | `lib/sentence-feedback.ts`, `lib/state-shape.ts`, `lib/learning/model.ts`, `lib/response-validation.ts` | 과거/신규/혼합·비활성 모델 왕복·임의 생성 모델 거부 |
| 구형 클라이언트 | state GET/PUT, AI, 전체/분할 restore, DB compatibility | `X-Study-AI-Contract: 2`, 새 필드 유실 전 426·revision 충돌 보존 |
| 사용자 선택 | `app/learning/settings-dialog.tsx`, 단어/문법 hooks, `lib/learning-api.ts`, `lib/restore-client.ts` | 계정별 선택·재접속·요청 중 잠금·모델 변경 자체 호출 0 |
| 출처·내보내기 | `app/feedback-attribution.tsx`, `app/feedback-detail.tsx`, `lib/learning/feedback-identity.ts`, `lib/learning/exports.ts` | 기존 출처·CSV 열 보존·신규 버전 표시·비공개 입력/키 없음 |
| 운영 | `cloudflare-env.d.ts`, Sites env revision 72 | 독립 AI 스위치·legacy 차단·새 reader를 보존하는 복구 |

## 자격 증명과 실제 호출 승인

사용자가 새 키 생성을 선택했고 안전한 Platform 선택에서 `DailyWords`를 지정했다. 로컬 확인 도구가 승인한 기본 폴더 `.env.local`의 `OPENAI_API_KEY`에 저장했다. 해당 파일은 Git 제외이며 추적되지 않는다. 키 값·개인 계정 식별자는 기록하지 않는다. 다른 저장 위치나 운영 Secret 등록은 이 저장 승인과 구별한다.

`GET /v1/models`는 HTTP 200이었고 후보 `gpt-6.1-sol`, `gpt-6.1-terra`, `gpt-6-astra`가 목록에 있었다. 목록 조회와 아래 실제 생성 검증을 구분한다. 모델 카탈로그는 실제 연결 검증 전 운영 활성화를 허용하지 않는다.

사용자는 합성 문장으로 모델당 1회·총 3회 이하, 요청당 출력 최대 4,096토큰, 전체 세전 US$0.50 이내의 연결 검증을 승인했다. 입력 본문 byte 상한과 Standard 처리 등급으로 비용의 보수적 상한을 사전 계산하고, 실패/시간 초과 요청도 소진된 호출로 기록했다. 개인 학습 기록·계정 ID·이메일은 보내지 않았다. 아래 3회를 모두 소진했으며 추가 호출은 이 승인으로 실행하지 않는다.

## 다음 완료 기준

모델 카탈로그 → 저장/복원 호환 → Responses 어댑터 → 단어/문법 전환·legacy 차단 → 설정·출처 → 최종 회귀/실연결/브라우저 → 기존 Site 게시 순으로 진행한다. 판단 개선 12~15는 전환 이후 고정 평가 기준과 별도 평가 예산을 확보한 뒤 진행한다. 로컬 검사·실호출·운영 게시를 서로 대체하는 증거로 사용하지 않는다.

## 완료한 구현과 검사

- Task 3: exact ID 카탈로그·명시적 활성 목록·기본값 읽기 해석·low reasoning·Standard 가격/확인일을 구현했다. 후보별 공식 모델 페이지와 현재 가격을 다시 확인했다. 자동 모델 대체와 임의 ID/접미사 수용을 거부하는 2개 검사가 통과했다. 운영 활성화는 아직 없다.
- Task 4: 저장 모델과 생성 허용 목록을 분리하고, optional `aiModelId`·명시적 OpenAI 출처/요청 모델/프롬프트/검증 버전을 추가했다. 이전 화면의 GET/PUT/AI/전체·분할 복원에서 새 필드 유실을 426으로 차단한다. 클라이언트는 계약 2와 요청 시작 당시 모델을 전달하며, 공통 요청 카운터를 통해 설정 잠금에 사용할 상태를 공유한다.
- 관련 검사: `node --experimental-strip-types --test --test-reporter=dot tests/ai-contract.test.mjs tests/ai-models.test.mjs tests/state-api.test.mjs tests/state-response.test.mjs tests/restore-jobs.test.mjs tests/backup.test.mjs tests/restore-client.test.mjs tests/learning-api.test.mjs` — 70개, exit 0. `npm run typecheck` — exit 0. 전체 제품 검사·새 전송·UI·운영 검증을 뜻하지 않는다.
- 신규 합성 호환 검사는 Google/Groq/OpenAI/미래 모델·구조 유무·설정 누락/비활성 모델, 혼합 단어/문법 기록의 저장→조회→내보내기→전체/분할 복원, 409/426, 커밋 응답 유실 재시도와 혼합 복원 트랜잭션의 각 statement 실패를 확인한다. 최초 검사의 빈 grammar 응답 기대값 차이를 현행 계약에 맞춰 보완한 뒤 최종 70개를 다시 실행했다.
- Task Master의 상태 변경 도구가 상위 ID를 문자열로 저장하는 동작을 확인했다. 대시보드는 정상 처리했고, 계획 검증기는 숫자/문자열을 같은 ID로 해석하도록 보완했다. 현재 구조 검사 318개가 통과했다.

## 진행 중인 전송·UI·회귀 검증

- Task 5의 `lib/openai-feedback.ts`: Responses·strict text.format·store false·default tier·28초·256KiB/30,000자·refusal/incomplete·exact 반환 모델·안전 오류와 관측을 구현했다. 새 전송 검사 11개가 통과했다. 기존 회귀에서 fetch가 일반 Error로 실패할 때 잘못된 응답으로 분류되는 문제를 확인해 fetch 경계에서 네트워크 오류로 처리하도록 수정했고, 두 예외 유형을 검사한다.
- Task 6: 새 단어/문법 API는 계정 모델과 학습 문서를 한 D1 batch에서 읽고 expectedModelId를 비교하며 OpenAI만 호출한다. Google/Groq helper·fallback은 무조건 거부하고 평가 API는 410이다. source import graph·CLI 진입 차단·문법 v1~v4·계정 격리·모델 변경 경합의 새 12개 검사가 통과했다. 오프라인 복구 검증을 보완하는 동안 Task 6.2는 review 상태다.
- 기존 평가 CLI에 명시적인 `--offline` 복구를 구현했다. 완료한 원장·모든 슬롯이 소진된 원장의 완료 표시 누락을 추가 API/사전 호출 없이 복구한다. 미완료 원장으로 새 호출을 만들 수 없으며 `--live`는 거부한다. 부모 원장·시도·고정 요청/프롬프트 해시·엄격한 진단 파서를 보존한다. 관련 50개 검사, 별도의 parser/프레젠테이션/본문 경계 36개, 과거 원장·판정 24개와 문장/문법/구조/새 전송 85개 관련 실행이 각각 exit 0이었다. 범위가 겹치므로 합산한 전체 검사 수로 표시하지 않는다.
- Task 7: `app/ai-request-context.tsx`, `app/learning/ai-model-settings.tsx`에 계정 선택·가격·비활성 모델 안내·요청 중 잠금·명시적 재조회·취소를 연결했다. 새 선택은 서버의 활성 목록으로 검증하며 과거 비활성 선택의 그대로 저장/복원은 허용한다. UI의 실제 브라우저 검증은 아직이다.
- Task 8: 신규 안내·오류·제공사/모델 표시·개인정보 설명을 OpenAI 기준으로 정리했다. `store:false`를 제로 보관으로 표현하지 않는다. 구현 checkout의 README/OPERATIONS와 `docs/OPENAI_FEEDBACK.md`에 현재 계약과 reader를 유지하는 롤백을 기록했다. 아직 미게시다.
- 최초 전체 `npm test`: 665개 중 605 통과·60 실패, exit 1(`work/openai-api-migration-20261103/outputs/openai-migration/unit.log`). Node 직접 TS import의 새 확장자 누락, 기존 legacy 실호출/자동 대체 기대, 새 capability 없는 본문 검사 및 오프라인 복구를 수정 중이다. 고정 `data/evaluations` 원장·점수·17개 알려진 영어 실패를 변경하지 않는다.
- 최초 lint는 새 모델 UI의 effect 오류 1개와 기존 경고 15개로 exit 1이었다. 비동기 조회 시작·취소를 보완한 이후 lint는 오류 0·기존 경고 15개, exit 0이었다. 그 후 CLI/테스트 변경이 있어 현재 전체 단위·lint·typecheck를 다시 실행 중이다. 최종 전체 통과·빌드·브라우저·실호출·게시 완료로 해석하지 않는다.
- 위 단락은 최초 검사·수정 이력이다. 최종 상태는 다음 갱신을 따른다.

## 2026-11-03 14:30 KST 검증 갱신

- 수정 후 두 번째 전체 `npm test`: **682/682 통과**, exit 0(`outputs/openai-migration/unit-2.log`). 당시 `typecheck` exit 0, 공식 Sites 빌드 exit 0. 이후 오류 출처 표시와 QA 보완이 있어 최종 상태에서 다시 검사한다.
- Chromium과 WebKit의 새 전환 QA는 각각 9개 흐름을 통과했다. 계정 격리·모델 저장/재접속·503 재저장·다른 기기 409·입력 백업·요청 중 잠금·다음 단어/문법 요청의 모델·전체/분할 복원·구형 GET 426·128자 과거 비활성 모델·320/390/768/1440px 및 200%·44px·키보드·axe를 확인했다. 가상 계정과 합성 AI 응답만 사용했고 실제 제공자 호출·운영 쓰기는 0이다. 실제 iPhone·VoiceOver 검사를 뜻하지 않는다.
- 브라우저 오류 상세에 새 OpenAI 오류를 Google로 표시하는 잔여 문구를 발견해 수정했다. 명시적 과거 Google 오류와 과거 dual-provider 오류 출처는 유지한다. 출처 회귀를 포함한 오류 단위 7개가 exit 0이었다. 최종 관련 브라우저 QA를 실행 중이다.
- 승인한 **Responses 3회/3모델 모두 성공**, 자동 재호출 0. 실제 제품 어댑터·고정 v1 프롬프트·strict 구조·28초/4,096토큰·store false·Standard 등급을 그대로 사용했다. Sol 5,294ms(입력/출력 683/219), Terra 3,241ms(683/171), Astra 4,379ms(683/218). 각 반환 모델·메타데이터·안전 검증을 통과했다. 원문·응답 전문·키는 기록하지 않았다.
- 호출 전 UTF-8 요청 본문 3,816/3,818/3,816 byte와 추가 512 입력 토큰, cache-write 1.25배 및 지역 10% 가산을 보수적으로 적용한 총 비용 상한 **US$0.37022975, 세금 제외**였다. 이는 실제 청구액이 아니다. 원장 `work/openai-api-migration-20261103/outputs/openai-migration/live-connection-ledger.json`은 전송 전에 호출 슬롯을 기록하고 재실행을 거부한다.
- 이 소수 합성 검사는 영어 정확도·품질·통계적 지연 비교의 인증이 아니다. 운영 Secret 등록·게시·OpenAI 활성화는 아직 실행하지 않았다.

## 2026-11-03 게시 준비 완료 · 운영 미적용

- 최종 `npm test` **683/683**, `npm run typecheck`, `npm run lint`(오류 0·기존 경고 15), 공식 Sites 빌드는 모두 exit 0. 구현 checkout의 `outputs/openai-migration/{unit-final,typecheck-final,lint-final-qa,build-final-3}.log`에 결과를 남겼다. 마지막 제품 변경은 요금 링크의 44px 터치 영역이며 해당 빌드와 두 브라우저 검사에 포함됐다.
- 관련 브라우저 **20개 × Chromium/WebKit = 40개**, 모두 exit 0. 전체 functional inventory를 실행한 것은 아니다. 최종 각 로그를 읽어 실패/예외/timeout이 없음을 확인했고 `outputs/openai-migration/related-final.json`에 매핑했다. 전환 전용 검사는 각 11개 흐름이며 목록 조회 실패·저장 응답 유실 후 409·현재 입력 백업도 포함한다. v2 전용, v3(v4 off), v4 및 legacy v1/mixed/compat를 실제 플래그별로 분리했다. 실제 iPhone·VoiceOver·영어 품질은 미검증이다.
- 잔여 OpenAI 오류 출처 문구와 요금 링크의 작은 터치 영역을 발견해 수정했다. 이전 실행의 테스트 문구/fixture 기대값·v2/v4 프로필 혼용 실패도 보존하며, 최종 재실행만 통과 근거로 쓴다. 코드·공식 프롬프트·고정 평가 원장/17개 알려진 영어 실패를 품질 성공처럼 바꾸지 않았다.
- 게시 전 위험·호환·롤백·관측·마이그레이션·미검증은 구현 checkout의 `docs/releases/2026-11-03-openai-migration-prepublish.json`에 기록했다. package/lockfile·hosting·SQL·고정 평가 자료의 기준 대비 차이는 없다. lockfile SHA-256은 `990e71a24eb00a6887e452aeebce9bea5eecc6dd006defc5dbec4853adc5181a`다.
- GitHub 기준과 Sites 게시 스냅샷은 별도 이력이었다. 배포 이력을 부모로 보존하는 병합 `ca34f04053e008b1d856d8f33a3ec02230d1b524` 전후에 검증 소스 tree `059642b8c0acd1e721634d25451291f3eea2f955`가 정확히 같음을 확인했다. 구현 commit **`8f312b3a4217d0118d3971578a05dd63db7f5624`**를 공식 helper로 기존 Site 소스 저장소에 push했다. GitHub main과 기본 폴더의 기존 변경을 덮어쓰지 않았다.
- Node 22.22.2의 공식 아카이브 복사 child가 `3221225477`로 종료됐다. 같은 공식 도구를 설치된 Node 24.22.1로 실행해 성공했다. 제품 테스트/빌드는 22.22.2 결과이며 런타임·의존성을 변경하지 않았다. 종료한 미리보기가 남긴 빌드 안의 빈 `.wrangler` 디렉터리만 절대 경로와 파일/링크 부재를 확인한 뒤 제거했다. 원본 QA DB와 학습 기록은 삭제하지 않았다.
- 최종 공식 helper는 exit 0, 구현 checkout은 clean이다. 아카이브 `outputs/openai-migration-release/site.tar.gz`: gzip 4,856,548 byte, SHA-256 `e57e75a00a1616498376f3d9f39c893c3a4af55dda09b31ba482294e0a983a26`. 압축 해제한 메모리에서 새 실제 키 일치 0, 환경 파일/개발 캐시/작업 폴더 0, Site ID·DB·BUCKET 보존을 검사했다. 세부 근거는 같은 폴더의 `verification.json`이다.
- 네이티브 **v142 저장 성공·미배포**. version ID `appgprj_6ab0a3cbaaa08191a05b0bcdf62df225~appgver_1f70774257488191a8bd31df1e635dde`, source는 위 구현 commit, deployment ID는 null이다. 네이티브 아카이브 hash `sha256:797f8b0ce50e4d02cadc16ff9a01ec5da6cceda4474d419fcde0dab23bb9a31b`, 파일 235개. 이 hash와 byte는 플랫폼의 content 표현이며 로컬 gzip hash/크기와 구분한다.
- 운영은 v141·환경 revision72이며 운영 Secret·환경 플래그·학습 기록을 변경하지 않았다. 다음 단계는 기존 Site 운영 `OPENAI_API_KEY` 저장 목적지에 대한 명시적 승인이다. 앞선 승인 범위는 로컬 `.env.local`이었다. 승인 후 같은 v142를 AI-off → 검증한 세 모델의 OpenAI-only 순서로 적용한다. 3회 연결 예산은 모두 소진됐으므로 추가 유료 호출을 하지 않는다.
- 판단 개선 12~15는 아직 deferred다. 전환 게시 후 고정 기준선·holdout·별도 평가 예산 승인부터 진행한다. 전체 15개/35개 완료로 보고하지 않는다. 다음 재개 정보는 `outputs/openai-migration-release/release-state.json`에 있다. 검사를 위해 띄운 앱 Worker는 종료했고, 사용자가 요청한 실시간 작업 대시보드 서버는 유지한다.

## 운영 Secret 저장 승인 후 도구 연결 문제

- 사용자가 기존 Site의 운영 `OPENAI_API_KEY` Secret 등록을 승인했다. 승인은 유지되며 재확인하지 않는다. 네이티브 재조회에서 v142 source/미배포 상태, 환경 revision72, OpenAI Secret 부재를 확인했다.
- Sites 환경 도구는 값 문자열만 받으며 로컬 파일 참조 입력이 없다. 비밀 값을 출력하지 않는 입력 경로를 확인하려 했으나 브라우저 `cua.getState()`와 컴퓨터 사용 `@oai/sky` 초기화가 모두 `failed to write kernel assets: 지정된 경로를 찾을 수 없습니다. (os error 3)`로 실패했다. 두 커널을 reset한 후 동일 호출도 같은 오류였다. 창 제어·키 입력·운영 설정 변경·추가 유료 API 요청은 실행되지 않았다.
- 사용자는 직접 등록을 선택하고 키 경로를 요청했다. 기본 폴더 `.env.local`에 `OPENAI_API_KEY`가 존재함만 확인해 경로를 안내했으며 값은 출력하지 않았다. 웹앱의 학습 설정에는 키 입력란이 없다. 실제 Sites 관리 UI의 진입 경로는 확인하지 못했으므로 직접 등록 메뉴가 확인된 것처럼 안내한 부분을 정정했다. 키 값을 채팅에 받지 않는다. 도구 복구 또는 사용자의 실제 Secret 등록 후에 네이티브 환경 상태를 다시 확인하고 게시한다.
- 독립적으로 할 수 있는 오프라인 근거 확인을 진행했다. 기존 `node scripts/replay-accuracy-causes.mjs`는 exit 0, 호출 0, 95개 형식 통과 중 기존 실패 17개 통과를 재현했다. `.taskmaster/scripts/inspect-judgment-baseline.mjs`도 exit 0이며 네 고정 보고서의 480회·60개 공통 사례·요약/행/차원 수치·현재 파서 해시·원본 불변을 검증했다. 실패 17개 응답은 고유 사례 15개다. 관련 한계와 후속 평가 기준은 `.taskmaster/docs/JUDGMENT_EVALUATION_PREPARATION.md`에 정리했다.
- 이 작업은 Task 12~15를 시작/완료한 것으로 세지 않는다. 제품 checkout은 여전히 위 v142 commit의 clean 상태이며, 상위 10/15·세부 25/35 완료 상태다. 남은 핵심 작업은 운영 등록/전환과 이후 별도 품질 gate다.

## v142 운영 전환 완료

- 사용자가 기존 Site에 `OPENAI_API_KEY`를 직접 등록했다. 네이티브 조회로 revision73·해당 키의 Secret 표시를 확인했다. 값은 조회/출력/로컬 키와 비교하지 않았다. 등록 승인은 유지되며 도구 초기화 문제는 이번 등록의 차단 조건에서 해소됐다.
- 당시 접근 설정은 이전 public과 다른 **custom, policy revision5**였다. 사용자의 현재 설정을 그대로 유지했고 배포 후에도 동일함을 확인했다.
- 환경 revision74에서 Google/Groq/새 AI를 모두 false로 설정하고 저장한 v142를 게시했다. `appgdep_6ae97eadbd5c8191ad6c6c72e9a37eb1`가 2026-11-03 06:27:12 UTC succeeded였다. 네이티브 version/source를 다시 읽어 v142와 정확한 구현 commit을 확인했다.
- 이후 `OPENAI_ALLOWED_MODELS=gpt-6.1-sol,gpt-6.1-terra,gpt-6-astra`, `ai_feedback_enabled=true`를 설정했다. Google/Groq false와 Secret을 유지한 revision75로 같은 v142를 게시했다. `appgdep_6ae97f88d37c8191922ef5fc73e7e6f7`가 06:30:50 UTC succeeded였다. 사이트 URL은 `https://wordgrain-oxford-study.hoihou-o.chatgpt.site`다.
- 최종 네이티브 조회는 v142/source `8f312b3a4217d0118d3971578a05dd63db7f5624`·환경75·세 모델 목록·독립 AI 스위치·legacy false·Secret·접근 정책 보존을 확인했다. D1 메타데이터에서 DB 바인딩과 기존 테이블 9개가 AI-off/활성화 전후 같았다. 운영 행/학습 문장을 읽거나 쓰지 않았고 신규 SQL 마이그레이션도 없다. R2/DB 선언은 게시한 아카이브의 BUCKET/DB를 유지한다.
- 5분 오류 조회에 `/api/state` GET 401 세 건(06:31:30~48 UTC)이 있었다. Worker outcome은 모두 ok, 예외는 없었다. 로그인 요청의 사용자 ID가 로그에 없었지만 로그의 완전성/차단 원인을 확정하지 않았으며 이메일을 계정 ID로 대체하거나 인증을 우회하지 않았다. 이전 v141 문서에도 인증 401 원인이 UNKNOWN으로 기록되어 있다. 후속 1분 조회에서는 오류 0이었으나 실제 로그인/트래픽 검증을 대신하지 않는다.
- 추가 유료 API 호출은 0이다. 실연결 3회는 로컬 키/후보 모델 검증 근거이며, 마스킹된 운영 키의 동일 값 비교·로그인 후 실제 운영 AI 생성 검증·실제 iPhone·영어 정확도를 완료로 주장하지 않는다.
- 위험/호환/롤백/관측/마이그레이션/미검증과 네이티브 ID는 `outputs/openai-migration-release/publication.json`에 남겼다. 장애 시 v142 reader를 유지한 채 `ai_feedback_enabled=false`로 같은 저장 버전을 다시 게시한다. 새 기록 뒤 v141 재게시나 Google/Groq 재활성화는 하지 않는다. 실제 AI-off 단계와 로컬 수동 학습/복원 검증을 복구 근거로 보존한다.
- 전환 1~11을 완료하고 G3 준비인 Task12로 이동한다. 품질 작업 12~15는 완료하지 않았으며, 새 평가 호출은 별도 승인 전 실행하지 않는다.

## Task 12.1 평가 자료·실행기 준비 완료 / 12.2 새 예산 승인 대기

- 운영을 다시 조회해 v142·배포 succeeded·환경 revision75·OpenAI Secret·새 AI true·Google/Groq false·custom 접근 policy5가 같음을 확인했다. 키 값을 읽거나 출력하지 않았고 추가 운영 AI 요청도 없다. 운영 로그인 401의 원인과 로그인 후 실제 AI 생성은 계속 미검증이다.
- `.taskmaster/evaluation/judgment-v1/`에 개발 60개+새 합성 holdout 30개, 5차원 rubric과 모델별 분모/critical 0/90%/기준 대비 비악화 조건을 작성했다. holdout은 정상 15·수정 필요 11·불충분 4개, 단어 15·문법 수업 15종/교재 v1~v4다. 출제한 구현 작성자가 보았으므로 독립 인간 인증이나 작성자 미공개 자료로 부르지 않는다. 기준선 holdout 결과는 후보 1개를 동결하기 전 열지 않는다.
- 과거 문법 3개 사례의 목표 활용 허용 대안은 새 rubric sidecar로 명시했다. 기존 480회 원장·점수·17개 실패는 변경하지 않았다. 오프라인 baseline 감사는 exit 0, 실제 호출 0, 제품 source clean을 재확인했다.
- 실행기는 승인 전 키 읽기/외부 요청을 차단하고 요청 전 슬롯/최대 비용을 원자 저장한다. 실패·시간 초과·중단은 슬롯을 소진하고 다시 보내지 않는다. 모델·토큰·본문·store/tier/reasoning·strict schema·변경 불가 요청 해시를 확인한다. 준비 출력의 새 네트워크 수와 과거 소비 슬롯 수를 분리해 재개 후 호출 수를 0으로 오인하지 않도록 했다.
- 최종 `node --test .taskmaster/tests/judgment-evaluation.test.mjs`: **10/10 통과, exit 0**. 가상 승인·가상 키·가상 응답으로 540개 요청 수집과 재개 추가 요청 0, 승인 전 실제 키/네트워크 접근 0, 원장 비밀 값 부재를 확인했다. 영어 정확도 검사나 실제 유료 호출로 세지 않는다. 로그는 `outputs/openai-migration-release/judgment-harness-tests.log`다.
- 최종 오프라인 실행 exit 0, plan hash **`f64b5d05762dbf00cc722286af3dfd377b73cea403cf41e3fc7b360ccf0f93ea`**, 기준선 요청 270개·본문 3,820~4,173 byte·승인 파일 없음·실제 평가 호출 0이다. 자료/실행기/요청 해시와 검증 근거는 `freeze.json`에 보관했다. 실행 기준은 같은 폴더 `README.md`다.
- 새 예산 제안은 90사례×3모델×기준선/후보 2버전의 생성 최대 540회+교차 채점 최대 540회, 총 최대 **1,080회·세금 제외 US$165**다. 생성 4,096토큰/10,000 byte, 채점 1,024토큰/18,000 byte, 28초·순차·store false, 자동 재시도/대체/튜닝 호출 없음이다. 입력 cache-write 2.5배·형식 512토큰·지역 10% 여유를 포함한 최대 계산 US$161.07012는 실제 청구액 예상치가 아니다. 아직 승인받지 않았으며 연결 검증 3회나 과거 480회 승인을 재사용하지 않는다.
- 12.1을 완료하고 12.2를 승인 대기로 진행 중으로 표시한다. 현재 상위 **11/15**, 세부 **28/35** 완료이며 Task12 전체/G3/13~15는 미완료다. 제품 소스·의존성·DB·현재 배포를 변경하지 않았으므로 제품 검사/게시를 반복하지 않았다. 자료와 대시보드는 관리 산출물이다.

## 평가 승인·기준선 실행 / 사용자 총 US$5 한도 변경

- 사용자가 원래 고정 계획의 최대 1,080회·세전 US$165를 승인해, 같은 plan hash의 승인 기록을 저장한 후 기준선 실행 세션 80917을 시작했다. 키는 메모리로만 읽었고 개인 학습 기록/운영 DB를 사용하지 않았다.
- 기준선 진행 중 보고서 집계·가린 검토 도구를 준비했다. `.taskmaster/scripts/judgment-report-core.mjs`, `report-openai-judgment.mjs`와 `REPORTING.md`에 분모 유지·언어/표시 안전 분리·모델/holdout별 gate·raw/작성자 판정 보존·source/body/비용 검증을 구현했다. 후보 동결 전 실제 결과 읽기를 거절하며, 모의 원장의 13개 검사 exit 0이었다. 실제 언어 품질이나 Task15 완료를 주장하지 않는다.
- 실제 승인 파일이 있는 환경에서도 모의 검사가 그 파일과 실제 원장을 변경하지 않도록 테스트 namespace를 격리했다. 평가 실행기의 같은 10개 검사를 다시 통과했다(exit 0). 현재의 새 테스트 해시는 사전 동결 당시 테스트 해시와 구분하며, 원래 승인 제안과 준비 시점 freeze를 보존한다. 고정 plan/rubric/holdout/core/runner 해시는 변경하지 않았다.
- 사용자가 비용 의미를 확인한 뒤 **기존 실행분을 포함한 이번 평가 총액을 세전 US$5로 변경**했다. 즉시 run.lock의 PID63388과 실제 Node 명령을 대조해 해당 평가 프로세스만 중단했다. 세션80917은 exit -1로 종료했다. 원래 US$165 승인 기록을 `approval-original-165usd.json`에 보존하고, 현재 `approval.json`은 철회/차단 상태로 변경했다. 축소한 예산 보호를 갖추기 전 추가 유료 요청을 보내지 않는다.
- 중단 원장: 슬롯 342개, 완료 338·실패 3(`provider_invalid_response/judgment`)·처리/과금 불명 1이다. 기록된 실제 네트워크 요청은 341개이며, 불명 슬롯은 추가 1회 과금 가능성을 버리지 않는다. 동일 요청 재전송은 없다. holdout 언어 결과는 열지 않았다.
- 사용량이 기록된 338건의 표준요금 환산은 **US$1.545079**다. 이는 청구서가 아니다. 확인된 토큰에는 입력 cache-write 최대2.5배·지역1.1배와 요청별 올림을 반영하고, 실패/중단/미확인 4슬롯은 기존 전체 최대 비용을 유지했다. 보수적 누적액은 **US$3.335471**, 총 US$5 안의 남은 여유는 **US$1.664529**다.
- 현재 v142의 동결 요청 본문과 기존 토큰 상한으로 생성+교차채점 1쌍의 최대 비용은 Sol US$0.127354·Terra US$0.148493·Astra US$0.410604다. 남은 여유로 보수적으로 확보 가능한 추가량은 각각 **13사례/26요청, 11사례/22요청, 4사례/8요청**이다(모델별 대안, 합산하지 않음). 3모델 모두 같은 새 사례를 평가하면 2사례/12요청, 기준선/후보까지 새로 모두 비교하면 1사례/12요청이다. 실제 사용량이 더 작게 확정되면 여유가 생길 수 있으나 이를 미리 비용 절감으로 확정하지 않는다.
- 자세한 요청별 비용 연결과 현재 한도는 `outputs/judgment-evaluation/<planHash>/budget-5usd.json`에 기록했다. 원래 90사례·3모델·기준선/후보 gate는 아직 미완료이며 축소 진단을 전체 품질 통과로 보고하지 않는다. 제품 source·운영 배포·기록·의존성 변경은 없다. Task12.2/13~15와 전체 목표는 계속 미완료다.

## G3 준비 확정 및 Task13 판단 계약 구현

- 계획의 G3는 평가 준비/버전/예산/승인 동결 gate이며 영어 품질 통과 gate인 G4와 다름을 실제 manifest에 대조했다. 고정 90사례/5차원/3모델/품질 기준은 유지한다. 사용자의 현재 총 US$5, 기사용분 원장, 기존 실행 철회, 미확인 비용을 포함하는 누적 정산과 새 요청 그룹의 원자 예약을 `.taskmaster/scripts/judgment-budget.mjs`로 검증했다. 7개 검사 exit 0, 현재 추가 호출 0이다. 따라서 Task12는 준비 범위로 완료했고 전체 기준선/품질 비교는 미완료인 채 Task15의 보류 조건으로 유지한다.
- 고정 자료의 35개 문법 입력과 나머지 단어 입력을 운영 v142의 실제 목표 선택·v1~v4 loader와 직접 대조했다. `.taskmaster/tests/judgment-profile-parity.test.mjs` 2개 exit 0이며, 선택한 사례의 parity만 증명한다. 교재 모든 수업×버전의 전수 품질 검사로 확대 해석하지 않는다.
- 현재 배포와 같은 `8f312...`에서 별도 worktree `work/judgment-improvements-20261103`, branch `codex/judgment-improvements-20261103`를 만들었다. 공식 portable 설정과 의존성 helper를 사용했고 lockfile/Site ID/DB/BUCKET은 그대로다. 기존 전환 checkout과 기본 폴더 제품 코드를 수정하지 않았다.
- Task13은 structure 없는 신규 wire의 목표/원문 문법/교정 이유/추가 문맥, 자연스러운 원문 동일성·불충분 교정 보류·최소 교정, 부정/단순 수량/선별 시간·초점/전달 구문 참여자 보호를 구현했다. 구조 없이도 실제 표시 설명의 진행형/arrive 전치사구 모순을 보류하고 정상 부정 설명·전치사 내부 목적어·동명사/형용사 대조군을 유지한다. 이는 제한된 모순 검사이며 일반 영어 정확도 인증이 아니다.
- 저장은 기존 4개 의견 필드+출처·버전으로 유지하고 legacy structure는 원형 보존한다. 신규 메타데이터는 `reference-v2`/`judgment-v2`이며 v142 경로는 정확한 v1 메타데이터를 유지한다. `feedback_judgment_enabled`가 정확히 true일 때만 새 API 계약을 사용하고 기본 비활성이다. 과거 평가용 프롬프트 export를 별도로 고정해 과거 요청·점수를 바꾸지 않았다.
- 최초 전체 검사는 693개 중 6개 실패였다. 새/구형 진입점·프롬프트 연결을 분리하고 structure 있는 v1/없는 v2의 단어·문법 혼합 왕복을 추가한 최종 상태는 **697/697, exit 0**이다. 신규 판단/실제 API 경로 14개, 기존 관련 왕복 48개는 이 전체 수와 겹치므로 합산하지 않는다. 최종 타입 exit 0, lint exit 0/기존 경고15개, 공식 Sites build exit 0이다. 실제 API 호출 없이 합성 응답으로 검증했다.
- Task13 코드를 commit `3a64bad`에 저장했다. 전체 SHA/tree와 검증은 `outputs/openai-migration-release/judgment-contract-verification.json`, 계약·위험·복구·한계는 후보 checkout의 `docs/JUDGMENT_FEEDBACK_V2.md`다. 운영 게시/환경/DB 변경은 0이며 후보 첫 유료 호출용 source로 등록하지 않았다. Task13을 완료하고 Task14.1을 진행 중으로 표시한다. 현재 상위13/15·세부31/35 완료이며 전체 목표와 G4는 미완료다.

## Task14.1 명시적 재점검·비교·되돌리기 구현 완료

- 같은 문장의 정상/판단 보류/과거 모델 의견도 사용자가 다시 요청할 수 있게 했다. 빈 입력·저장/요청 중 잠금과 단일 fetch를 유지한다. 화면 진입·편집·모델 변경·조회로 자동 요청하지 않는다.
- 단어/문법 양쪽에 공통 교정 적용 보호를 구현했다. 수정 전 제안은 현재 입력과 비교한 뒤 별도로 확인한다. 비교 후 문장/AI 응답이 바뀌면 확인을 무효화한다. 적용 전 입력을 기억해 바로 되돌리되 이후 편집은 덮어쓰지 않고 이전 문장을 확인/복사할 수 있게 했다. 문법 입력이 저장 feedback을 해제해도 화면의 제안·되돌리기는 유지한다. 이 단계는 화면 메모리 동작이며 재시작 후 내구성은 아직 Task14.2다.
- 최종 전체 단위 **703/703, exit 0**, 타입 exit 0, 공식 Sites build exit 0이다. lint는 오류0이었고 새 harness 경고1개를 수정한 뒤 변경한 harness/QA 파일을 다시 lint exit0으로 확인했다. 나머지 기존 경고15개는 보존했다. 6개 신규 교정 단위 검사는 전체 수에 포함한다.
- Chromium/WebKit의 합성 React interaction harness는 각각 **13개, 총26개**를 통과했다. 명시적 재요청·pending 중복 방지·단어/문법 비교/취소/적용/되돌리기·비교 후 편집/응답 변경·적용 뒤 편집·초점/공백을 확인했다. 초기 harness의 reset/렌더 완료 대기를 수정하고 최종 두 엔진을 재실행했다. 페이지 예외/실제 네트워크/운영 계정/실제 제공자 요청은0이다. 빌드 Worker 통합·모든 앱 흐름·실제 iPhone 검사로 확대하지 않는다. 현재의 26개를 이전 전환 QA40개에 합쳐 같은 소스 전체 통과처럼 표현하지 않는다.
- commit **`668460a5e4cbdd4ddf4c6ba6b76bf04a00dd53df`**, tree **`d8c8e2faba5092503ed929b17305d43f16ff017d`**에 저장했다. 검증은 `outputs/openai-migration-release/correction-interaction-verification.json`, 제품 설명과 다음 보관/삭제/요청 복구 정책은 후보 `docs/FEEDBACK_RECHECK_AND_RECOVERY.md`다. 그 문서의 Task14.2 절은 구현 예정임을 명시한다.
- Task14.1 완료, 14.2 진행 중으로 변경했다. 현재 상위 **13/15**, 세부 **32/35** 완료다. 다음은 계정 범위의 브라우저 초안 내구화·충돌/삭제/로그아웃 정책, UUID 영수증/중복 실행·응답 유실 복구, 집계 실패 비차단, 보류 export와 최종 회귀다. 신규 D1 테이블이 필요하면 migration/소유권/정리/복원/reader 유지 rollback을 검증하고 Task15의 게시 절차를 따른다.
- 한도 변경 뒤 새 유료 요청은 계속0이며 기존 원장 해시/차단 승인 파일이 같음을 재검증했다. 현재 보수적 누적 US$3.335471·잔여 US$1.664529를 유지한다. 운영 v142/Secret/환경/DB 변경은0이고 새 판단 후보는 비활성·미게시다. 고정 품질 gate/G4/전체 목표는 미완료다.

## US$5 추가 평가 가능량 재확인 및 Task14.2 중간 검증

- 사용자 추가 질문에 대해 비용 보호 검사 7개를 재실행해 모두 exit0으로 확인했다. 이번 평가의 총 한도는 기존 실행분을 포함한 세전 US$5다. 중단한 원장을 그대로 유지하고, 보수적 누적 US$3.335471·잔여 US$1.664529와 v142 고정 요청/토큰 상한으로 추가 Sol13사례/26요청, Terra11사례/22요청, Astra4사례/8요청을 재확인했다. 각 수량은 서로 합산하지 않는 대안이다. 3모델 동일 사례는2사례/12요청, 개선 전후까지 모두 새로 비교하면1사례/12요청의 예산 범위다. 새 후보의 실제 요청 본문 동결/예약 확인 전 실행 가능 여부와 구분한다. 한도 변경 뒤 새 유료 호출0, 청구서 검증은 미실시다.
- Task14.2의 **미커밋 중간 상태**에 계정별 로컬 초안 저장소/복구 UI/삭제 설정, 단어·문법 편집 필드 복구, 화면 계정 바인딩을 구현했다. 새 클라이언트는 상대 `/api/` 요청에 화면의 계정 ID를 붙이고 실제 로그인 ID/이메일과 일치하지 않으면 서버에서 DB·AI 접근 전에 거절한다. 과거 계정 요청의 늦은401이 새 계정 화면을 무효화하지 않도록 등록 세대를 비교한다. 기존 헤더 없는 클라이언트 계약은 보존한다. 인증 불명 시 브라우저 초안은 숨기고, 명시 로그아웃/검증된 계정 전환의 삭제와 구분한다.
- CSV의 기존24개 열 순서를 보존한 뒤 `AI 의견 상태`를 덧붙였다. 설명 모순/판단 불충분/수정 전 의견의 교정·설명은 tutor/CSV 전달에서 제외하고 원본 기록은 바꾸지 않는다. 공통 순수 안전 정책을 learning 모듈로 옮기고 기존 import 진입점은 재수출해 도메인 모듈의 비순환 경계를 유지했다. 최초 전체720개 중2개 실패는 기존 의존 경계와 CSV 헤더 검사였으며, 최종 전체 **720/720, exit0**으로 확인했다. 최종 typecheck/lint/공식 Sites build도 exit0, lint는 기존 경고15개다. 비용 보호 검사7개와 제품720개는 별도 범위다.
- 브라우저의 새 초안 통합/프로세스 종료 회귀, 요청 UUID 영수증·중복 실행/응답 유실 복구·통계 쓰기 비차단, 관련 복원 회귀는 아직 남았다. 이번 검사로 Task14.2를 완료 처리하지 않는다. 현재 상위13/15·세부32/35 완료, 운영 게시/환경/DB 변경0이다. 중간 소스와 검사 기록은 `outputs/openai-migration-release/task14-working-tree-verification.json`에 구분해 남긴다.

## Task14.2 구현·로컬 검증 완료 — Task15 진행

- 후보 checkout `work/judgment-improvements-20261103`의 commit **`9fe09fd2c8b474c7809a65c4df1be158e63a6eb0`**, tree **`ea8e86eca7569074aa33156283f95a8fad52caac`**에 구현을 저장했고 clean을 확인했다. 위 중간 상태의 미완료 항목을 구현/검증한 최종 기록은 `outputs/openai-migration-release/request-recovery-verification.json`이다. 전환 v142 checkout은 기존 `8f312...`의 clean 상태로 보존했다.
- 기기 초안은 계정/질문/페이지 단위로 분리해 최대7일/20행/합계1MiB/단일64KiB에 보관한다. 명시 빈 입력·회상 도움 표시·문법의 마지막 제안을 복구하되 첫 답/성적/학습일/완료를 덮지 않는다. 살아 있는 탭·종료 불명 탭의 자료를 자동 인계 삭제하지 않고 동일한 복사본은 선택지에서 묶는다. 삭제 epoch와 실제 편집 지문을 함께 비교해 삭제 직후 메타데이터 변화로 초안이 되살아나는 문제도 수정했다. 설정의 삭제/로그아웃·저장소 오류·계정 전환/인증 불명 경로를 구현했다.
- 새 D1 `feedback_requests`의 계정+UUID 원자 claim을 제공자 호출 전에 기록한다. 동일 ID의 다른 입력/목표/모델/프롬프트/반환 계약은409이며, 입력을 읽은 revision이 claim 전에 바뀌어도 제공자0회다. 완료 결과는24시간, 중복 방지 정보는7일 유효하며 다음 접근 때 정리한다. 처리/실패/불명/만료를 조회할 뿐 자동 재실행·takeover·모델 대체는 없다. 결과 저장 실패는 `persisted:false`로 구분하고 claim은 유지한다. 운영 통계 쓰기 실패는 생성을 막지 않는다.
- `npm run db:generate -- --name feedback_request_receipts` exit0으로 schema/SQL/metadata를 생성했다. `0006`에 대상 DELETE 시 응답을 무효화하고 tombstone은 보존하는 trigger를 추가했다. 기존0000~0005는 변경하지 않았다. 처음 시도한 Wrangler `migrations apply`는 빌드 config에 migrations_dir가 없어 실패했다. README의 공식 `d1 execute ... --local --file` 절차로 별도 `.wrangler/task14-state`에0000~0006을 순서대로 적용해 모두 exit0이었다. 운영 migration은 적용하지 않았다.
- 전체/분할 복원은 receipt body를 원자적으로 무효화하며, 각 statement 실패의 rollback에서 영수증도 보존됨을 검사했다. 클라이언트의 확인된 복원 또는 복원 시도 후 서버 재조회는 기기 초안/이전 결과 확인 자료를 정리해 복원한 내용을 다시 덮지 않게 한다. 복원 창에서 이를 알리고 먼저 안전 백업을 받는다. 알림은 시작 당시 계정의 등록 세대가 같을 때만 적용하므로 늦은 이전 계정 응답이 새 계정 캐시를 삭제하지 않는다. JSON 원본 백업은 raw 의견과 legacy structure를 유지한다.
- 최종 전체 **741/741**, typecheck exit0, lint exit0/기존 경고15개, 공식 Sites build exit0이다. 마지막 QA 스크립트 변경도 별도 lint exit0이었다. 새 영수증 서버/클라이언트 검사에는 실제 word/grammar route·SQLite/D1 원자 claim·중복·정리/claim/완료/통계 실패·소유권·만료·복원 invalidation이 포함된다. 모든 제공자 응답은 합성이며 실제 API 호출로 계산하지 않는다.
- Chromium/WebKit 각각 **초안·요청 복구 React harness16개**, **교정 상호작용 harness13개**를 통과했다. 실제로 고유 QA 프로필의 브라우저 main process만 종료하고 다시 열어 단어/문법 입력을 복구했다. 두 탭·명시 삭제·앱 로그아웃·계정 전환·회상 도움 표시·잘린 AI 응답 후 reload→사용자 GET1/새 POST0을 확인했다. 설치된 Windows WebKit의 한국어 persistent profile에서는 단순 localStorage 값도1초 뒤 사라지는 최소 재현이 있었고, ASCII 임시 프로필에서는 보존돼 해당 경로를 사용했다. 실제 iPhone/Safari 검사가 아니다.
- 같은 최종 빌드 Worker에서 두 엔진 각각 **모델/호환/내보내기·분할 복원11개**, **전체/실패/충돌/3MB+ 백업9개**를 통과했다. 복원 전 기기 자료가 정리되는 것도 실측했다. 새 로그아웃 링크의 작은 터치 영역을44px로 수정했고, WebKit의 로컬 결과 표시와 서버 저장 사이를 구분해 실제 revision snapshot 도착을 기다리도록 검사를 보완했다. 별도 실제 Worker+D1 API10개는 AI master off에서도 결과 GET·계정 격리·401·202·409·410·잘못된 UUID를 확인했다. React harness와 Worker 흐름, 단위 검사 수는 구분해 기록한다. 전체 브라우저 inventory/남은 관련 스크립트는 Task15 최종 회귀 범위다.
- hosting/Site ID/DB·BUCKET, package/lockfile, 고정 평가 자료·기존17개 실패는 그대로다. 운영 게시/환경/DB 변경0, 한도 변경 뒤 추가 유료 호출0이다. 기존 평가 원장 hash와 철회한 옛 승인도 같고 총 US$5·보수적 누적 US$3.335471/잔여 US$1.664529를 유지한다. 청구서 확인이나 새 언어 품질 통과를 뜻하지 않는다.
- Task14.2와14를 완료하고15/15.1을 진행 중으로 변경했다. 현재 상위 **14/15**, 세부 **33/35** 완료다. 남은 것은 Task15의 후보 source/body 동결·총 US$5 누적 보호 실행기·독립 품질 비교/holdout/미측정 분리·남은 관련 회귀·출시 또는 후보 보류 판정이다. 판단 v2는 기본 비활성·미게시이며, 기존90사례×3모델×전후 gate/G4/전체 목표는 아직 완료하지 않았다.

## 총 US$5에서 가능한 횟수와 Task15 중간 검증

- 기존 품질 평가 사용분을 포함한 총 한도 세전 **US$5**, 보수적 누적 **US$3.335471**, 잔여 **US$1.664529**를 원본 원장 hash 그대로 재확인했다. 완료338회의 기록상 표준 토큰 단가 계산은 US$1.545079이며 청구서 확인액이 아니다. 실패/중단/불명4건은 원래 전체 예약액을 유지한다. 한도 변경 뒤 새 유료 호출은 계속0이다.
- 새 후보의 실제90사례×3모델 요청 본문도 오프라인으로 생성했다. baseline 최대4171/4173byte, candidate 최대3861/3863byte이며 생성4096·채점1024토큰 한도를 유지한다. 두 버전 모두 한 모델/한 버전만 진행할 때 Sol13사례/26요청, Terra11사례/22요청, Astra4사례/8요청분이 보수적으로 확보된다. 각 수량은 합산하지 않는 대안이다. 세 모델 동일 사례는2사례/12요청, 세 모델 개선 전후 모두 새로 비교하면1사례/12요청분이다. 실제 응답이 짧으면 더 진행할 수 있지만 다음 묶음의 최대비용이 잔여 예산에 들어올 때만 허용한다. 근거는 `outputs/judgment-evaluation/f64b5d05762dbf00cc722286af3dfd377b73cea403cf41e3fc7b360ccf0f93ea/candidate-capacity-5usd.json`이다.
- 원래 US$165 승인/실행기는 철회 상태를 보존했다. 대체 누적 보호·수집·보고 도구와 합성/오프라인 검사33개를 준비했고 모두 exit0이다. 동결 전 결과/키 읽기·네트워크 차단, 기존 원장 비용과 합산, 정확한 본문을 HTTP 전에 영속 예약, 전체 생성/채점 묶음 여유 확인, 실패/중단 재전송 금지, 모델/역할/전체 상한과 provider 오류 중단을 검사했다. 소스 동결과 동결 정보에 결합한 US$5 승인 기록을 아직 만들지 않아 live 실행은 차단된다. 새 승인을 사용자에게 다시 요청하지 않는다.
- 회귀 중 성공 HTTP에 완료 영수증이 없을 때 불명 오류로 표시하던 문제를 `invalid_response`로 수정했다. pending UUID를 보존하고 다음 사용자 클릭은 GET만 수행한다. QA fixture의 receipt와 명시적 재점검/수정 전 제안 읽기 전용 정책 기대값도 현재 계약에 맞췄다. 기존 검사를 삭제하거나 영어 자료·점수를 바꾸지 않았다.
- 후보 commit **`f273886f43324d4a668ecc6550a97bb8ebcfda56`**, tree **`b4a5ef1d359ababf4797bea1491f5a92d8003518`**, clean이다. 최종 전체 단위 **742/742**, 타입/린트/공식 Sites build 모두 exit0, lint 기존경고15개다. 현재 최종 빌드의 관련16개×Chromium/WebKit **32실행**은 모두 exit0이며 각 JSON/텍스트 보고서도 확인했다. 초기 실패8개와 최종 통과8개 재실행도 별도로 보존한다. 아직 v2전용/v3/v4 플래그별15수업과 OpenAI 영수증 통합8실행, 후보 동결·예산 내 언어 비교·미실측 분리·출시/보류 판정이 남아 있다. 전체40실행이나 Task15 완료로 보고하지 않는다.
- 진행 증거는 `outputs/openai-migration-release/task15-capacity-verification.json`이다. 상위14/15·세부33/35, G4 미완료, 판단 후보 미게시·기본 비활성, 운영 환경/DB/학습 기록 변경0을 유지한다. 작업 대시보드의15번 세부 설명에도 총 US$5와 추가 가능량을 반영했다.

## 최종 · 15개/35개 구현·검토 종료, 판단 후보 보류

- 최종 후보 `f273886f43324d4a668ecc6550a97bb8ebcfda56` / tree `b4a5ef1d359ababf4797bea1491f5a92d8003518`를 clean 상태로 동결했다. 실제 v4 loader의90사례 입력·모델별 요청 body가 기준선의 기존 동결 자료와 같음을 대조했다. 수집 순서·실행/보고 코드·버전·총 US$5 승인을 결합한 뒤 실행했고, 결과를 본 뒤 제품 소스·프롬프트·기준을 바꾸지 않았다.
- 총 US$5 누적 보호 실행기는 **추가251요청**에서 종료했다(완료250·실패1). 기존 원장 포함 기록된 실제 요청592회·전송 불명 과거 슬롯1개다. 보수적 누적 **US$4.879124**, 잔여 **US$0.120876**, 남은 가장 작은 생성/채점 묶음의 최대예약 **US$0.123531**로 새 묶음0개임을 확인했다. 정상 사용량의 표준 단가 합계 US$2.315138은 청구액이 아니다. 사용량 불명5건은 전체 예약액을 유지한다. 옛 US$165 승인과 원본 원장을 되살리거나 초기화하지 않았다.
- 모델별 고정 전체90·개발60·holdout30의 분모를 유지했다. 후보 유효 채점은 Sol38·Terra33·Astra18개,5차원 검토 통과는32·28·15개다. 전체 언어 범위는 미측정이 남는다. 가린 작성자 검토150개는 모두 개별 근거와 함께 저장하고 원점수는 보존했다. Terra 후보의 낱말→명령문 의도 창작1건을 확인했으며, 다른 생략 표현의 과도한 확신·목표 라벨 경계의 모호함과 구분했다. 독립 인간 영어 전문가 인증으로 표현하지 않는다.
- 같은 사례가 양쪽 모두 수집된 사후 진단에서도 기준선→후보 통과 수는 Sol34→32(공통38), Terra29→27(31), Astra17→15(18)였다. 이 진단은 동결 gate를 바꾸거나 작은 일부의 정확도로 일반화하기 위한 결과가 아니다. 일부 차이는 실제 영어 교정 오류가 아니라 목표/문법 라벨의 경계와 관련된다. 전체 미측정·핵심 오류·기준 미충족으로 **G4 실패, 후보 전체 미게시·비활성 보존**을 판정했다.
- 실패 응답의 가시 이유로 wire를 재구성한3개를 현재 파서에 넣어 모두 통과함을 오프라인 재현했다. 문맥 질문을 모델의 uncertain 자기 판정에 의존하고, 부정/수량/시간/일부 참여자만 검사하는 보호가 문장 의도 창작을 놓치는 설계 원인이다. 프롬프트 한 문장의 인과 효과나 일반 ChatGPT와 동일 조건의 모델 성능 차이는 입증하지 않았다. API·모델 자체만을 원인으로 단정하지 않는다.
- 최종 소스의 **단위742/742·타입/린트/공식 Sites build exit0**, 기존 lint 경고15개다. 관련20개 브라우저 스크립트를 실제 v1/mixed/v2전용/v3/v4 및 신규2+기존4/혼합3 프로필로 **42회** 실행해 모두 exit0이었다. 평가·비용·보고·진단37개, 최종 대시보드17개도 통과했다. 전체 functional/performance inventory·실제 iPhone/VoiceOver 검사로 확대하지 않는다.
- 네이티브 재조회에서 운영은 **v142·8f312b3a4217d0118d3971578a05dd63db7f5624·환경75·custom 접근5**이며 OpenAI-only/Secret 등록 상태를 확인했다. 운영 Secret 실값·로컬키와의 일치는 조회하지 않았다. 게시 후 운영 계정을 통한 유료 생성 QA도 하지 않았다. 후보 DB0006·환경·게시·운영 학습 기록 변경은0이다. 과거 사전 문서의 public 표기는 현재 네이티브 정책을 대신하지 않는다.
- Task15는 계획의 **출시 또는 보류 판정** 중 보류로 닫았다. 현재 상위 **15/15**, 세부 **35/35** 완료다. 이는 구현·검토·판정의 완료이며 전 범위 언어 실측·정확도 개선 입증·G4 통과·후보 활성화의 완료가 아니다. 대시보드에서도35개 구현 완료와 G4 활성화 보류를 따로 표시한다.
- 최종 근거: `docs/OPENAI_JUDGMENT_EVALUATION_RESULT.md`, `outputs/openai-migration-release/judgment-release-decision.json`, `completion-audit.json`, `task15-browser-final.json`, `judgment-root-causes.json`, `final-runtime-verification.json`. 완료 대조는 R01~R14와15/35 각각의 source/test/log를 확인하며, 명령 `node .taskmaster/scripts/audit-openai-migration-completion.mjs --closed`로 재현한다. 관리 문서와 대시보드만 갱신하고 기본 폴더의 구버전 제품 코드·복구용 사본·동결 소스를 수정하거나 게시하지 않았다.
