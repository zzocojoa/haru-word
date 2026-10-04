# 영어 카드 작업실 통합

## 최신 카드 소스 정리 — 2026-10-04

EN_Card `master@98832db`에서 화면 129개와 AI 릴레이를 정식 exporter로 재생성해 운영 v114의 카드 파일과 대조한다. **AI 자동 제작**은 독립 메뉴이며 모바일 하단에서 바로 연다. 추가 한 장 시험의 `/automation/trial` POST도 기존 소유자·Origin·4KiB 본문 검사를 거쳐 연결한다. 시험 자체의 일일 제한·버전·예약 보호는 EN_Card가 담당한다.

이번 변경은 이미 운영에 있는 카드 소스를 GitHub main 기준으로 정리하는 작업이다. main의 강화된 릴레이·보안 테스트와 카드 QA를 유지한다. Site 재게시·Worker 배포·DB 마이그레이션·실제 AI/카카오 호출은 수행하지 않는다. 전체 Site의 실험 소스까지 main과 같아진 것으로 해석하지 않는다. [제품 관리·출시 기록](PRODUCT_MANAGEMENT.md)을 현재 기준으로 사용하고, 아래 설명은 각 당시의 구현·검증 기록으로 읽는다.

## GitHub main 카드 자동화 통합 — 2026-10-04

기존 Sites v111의 카드 자동화만 GitHub main으로 분리한다. 학습 AI 정확도 실험·평가 원장·PR12/17과 운영 사이트의 접근 설정은 포함하지 않는다. 기존 학습 API·백업·revision 계약과 Google 우선/Groq 대체 정책은 유지한다. 실제 AI 생성·카카오 수신·클라우드 CPU 실측은 이 통합의 로컬 모의 검사와 구분한다.

검토 수정은 일시정지 뒤 편집 초안 보존, 상태 조회 중/실패 표시, 카드 편집 단일 요청·화면 이동 시 취소, 제작 기록 제목 단계와 relay 오류 구분이다. 요청 본문 초과는 413, 잘못된 요청은 400, 제공자 응답 오류는 502이며 안전한 `invalid` 코드와 기존 소비 계약을 유지한다. 생성 파일은 EN_Card 원본에서 내보내며 직접 수정하지 않는다. EN_Card에 진행 중인 별도 '오늘 한 장 시험'은 내보내기 소스 사본에서 제외했고, 수정 전 UI129개·relay2개의 기존 산출물 해시를 모두 재현한 뒤 수정했다.

DB 변경은 `0004_card_automation_nonces.sql`의 짧은 nonce 영수증 테이블·만료 인덱스 추가뿐이다. 기존 테이블·개인 문장·학습 진도·백업·revision을 수정하지 않는다. 새 환경에서는 기존0000~0003 다음0004를 적용한 뒤 서버 relay를 사용한다. 테이블·키가 없으면 준비 상태 false이며 AI 호출을 차단한다. 이번 GitHub 통합에서 운영 DB 마이그레이션이나 Sites 배포는 실행하지 않는다.

회귀 검사: Node22/24 각각559개, 문법 원장·타입·린트·Worker 빌드, 카드 서버19개, Chromium/WebKit의 저장 실패/재시도·일시정지 초안·화면 이동/재접속·편집 취소·320/390/1440px·100/200% 글자·키보드·axe를 확인한다. 브라우저 회귀는 `node tests/card-automation-qa.cjs`이며 기존 `QA_PLAYWRIGHT_PATH`·`AXE_CORE_PATH`를 사용한다. 이 검사는 루프백 정적 서버와 합성 카드 API만 사용한다. 실제 iPhone·AI 언어 정확도·발송 완료를 뜻하지 않는다.

복구는 먼저 카드 자동 제작 화면에서 일시정지해 대기 중인 자동 예약을 중단하고, 필요한 경우 `card_studio_enabled=false`를 저장·재배포한다. 이미 접수된 메시지는 회수되지 않는다. nonce 테이블을 삭제하거나 기존 Sites를 오래된 GitHub 소스로 덮어쓰지 않는다. GitHub 후보에 문제가 있으면 카드 변경만 forward fix/revert하고 nonce 테이블과 학습 기록을 보존한다. 관측은 기존 안전한 오류 코드와 제공자 HTTP 상태뿐이며 키·개인 문장·AI 원문을 추가 기록하지 않는다.

아래 운영·검사 수치는 각 시점의 기록이다.

## AI 자동 제작 연결 — 2026-10-03 로컬 구현 완료

`codex/ai-card-automation`에서 EN_Card의 AI 자동 제작 화면과 API를 연결했다. 카드 만들기에서 주제·기준 표현·난이도·종류·기간·시각을 저장하고 시작·일시정지·날짜별 검토/발송 결과·PNG 다운로드·최신 카드 편집을 이용한다. Gemini 작성과 Groq 검토는 이 Site의 기존 `google_api`·`groq_api` Secret으로 수행하고, 1080 PNG·진행 상태·예약은 EN_Card의 비공개 SQLite DO가 담당한다. 기존 학습 AI 경로와 학습 기록 스키마는 유지한다.

- `lib/server/card-studio.ts`: 기존 소유자·Origin 확인 아래 automation 네 경로와 최신 카드 조회를 허용한다. 자동화 설정 본문은 4KiB로 제한한다.
- `tests/card-studio.test.mjs`: 본인 접근, 경로/메서드, 위조 출처, 본문 제한 회귀를 추가했다. 관련 11개와 전체 테스트·타입·빌드를 통과했다.
- `public/card-studio`: EN_Card의 내보내기 명령으로 생성한 129개 파일과 SHA256 명세다. 원본 EN_Card는 전체 Chromium38개·새 자동화 흐름 WebKit도 통과했다. 모의 AI/발송이며 실제 iPhone·실제 AI·카카오 시험은 아니다.

API 키를 새 Worker에 복사하거나 다시 등록하지 않는다. `app/api/card-automation/route.ts`는 기존 bridge/owner에서 별도 용도로 파생한 키의 HMAC 서명·60초 시각·5초/64KiB 본문을 검증한다. `drizzle/0004_card_automation_nonces.sql`의 별도 테이블에서 nonce를 원자적으로 소비한 요청만 AI를 호출하며 기존 학습 테이블은 바꾸지 않는다. 상태 조회는 키·테이블 준비 확인만 하고 AI를 호출하지 않는다. 서버 생성 번들은 `lib/server/card-automation.generated.*`이며 공개 정적 자산에 포함하지 않는다.

게시 순서는 EN_Card D1 백업·0014 적용 → 비공개 DO off → 발송 Worker → 주 Worker → 이 Site의0004·서버/화면 게시다. 기본 자동화는 off이며 기존 Site 환경·소유자·브리지 Secret·접근 정책을 유지한다. 사용자가 키 등록을 확인했고 Sites 환경 revision59에서 두 Secret 이름을 확인했다. 실제 키의 무료 계정 연결·제품 전체 원격 검증은 별도로 확인한다. 상세 절차는 EN_Card `docs/AI_CARD_AUTOMATION_IMPLEMENTATION.md`에 있다.

후속 검증: 생성 번들·proxy15개, 타입 검사 통과. EN_Card 최종relay16개는 서명/만료/본문 지연·중단, 동시 nonce, DB 실패·마이그레이션 누락을 포함한다. 실제 제공사·카카오 호출은 없다. 중복 지적과 운영 준비 확인을 `review` 후 수정했다.

아래 v104 기록은 기존 수동 제작 기능의 당시 검증이며 새 자동 제작의 운영 검증을 뜻하지 않는다.

2026-10-02 / 운영 v104·GitHub 기능 병합·본인 예약 발송/수신·iPhone Safari PNG 저장 확인 완료

기존 하루단어 로그인으로 본인만 `/cards`에서 카드 제작·PNG 저장·카카오 예약을 사용한다. 학습 화면에 영어 카드 버튼을 추가하며 이동 전 학습·문법 작성 보호를 따른다. 다른 ChatGPT 계정에는 카드 API와 작업실을 허용하지 않는다.

카드 화면은 같은 출처의 `public/card-studio`에 배치하여 제3자 쿠키 없이 동작한다. `app/api/card-studio/[...path]/route.ts`와 `lib/server/card-studio.ts`가 본인 ID·출처·메서드·경로·본문 한도를 검사하고 기존 EN_Card 서버와 통신한다. 기존 D1/KV/Cron과 이미지 URL을 그대로 사용한다. 학습 기록·AI 제공자·피드백 후보·Site ID·DB 바인딩·공개 정책을 바꾸지 않는다.

## 운영 설정

- `card_studio_enabled`: `true`로 설정하기 전에는 비활성.
- `card_studio_owner_id`: 이 Site에 로그인한 운영자 본인의 `userId`. 다른 Site의 ID나 이메일로 대체하지 않는다.
- `card_studio_bridge_secret`: 기존 카드 서버의 `STUDIO_BRIDGE_SECRET`과 일치하는 서버 전용 난수.
- `card_studio_origin`: 기존 EN_Card HTTPS 출처.
- 카드 서버에는 동일한 `STUDIO_OWNER_ID`와 반환 출처 `STUDIO_ORIGIN`도 필요하다. 이 값들은 브라우저나 Git에 넣지 않는다.

초기 본인 계정 매핑에는 해당 사용자가 로그인한 `/api/card-studio/account`를 사용한다. 이 경로는 로그인한 자신의 ID와 기능 사용 가능 여부만 반환하며 전체 사용자 목록·카드·학습 답안은 반환하지 않는다. 기능을 비활성 상태로 먼저 게시하고 운영자 매핑과 서버 키를 설정한 뒤 활성화한다. 카카오 연결은 기존 것을 유지하며 재연결 시 일회용 요청과 기존 카카오 운영자 검사 후 `/cards`로 돌아온다.

## 빌드·검증

브라우저가 JSON API의 직접 탐색을 차단하면 로그인한 `/cards`의 잠금 화면에서 **계정 연결 정보**를 펼쳐 본인의 사이트별 식별자를 확인한다. 이 정보도 현재 로그인한 본인에게만 표시한다.

UI 원본은 EN_Card 저장소에 있다. 그 체크아웃에서 `node scripts/export-haru.mjs --target <이 체크아웃의 절대 경로>`로 내보낸다. `public/card-studio/source.json`은 원본·산출물 SHA256을 기록한다. `.gitattributes`는 이 생성 폴더의 Git 줄바꿈 변환을 막아 Windows에서도 해시를 유지한다. 생성된 번들을 손으로 수정하지 않는다. 이 경로만 eslint에서 제외하며 원본은 EN_Card의 타입·서식·브라우저 검사로 검증한다.

```powershell
New-Item -ItemType Directory -Path work -Force
npm test
npm run typecheck
npm run lint
npm run build
```

전체 테스트 714개·타입 통과, lint 오류 0·기존 경고 13. 별도 EN_Card 검사에서 Chromium·WebKit 모두 하루단어 로그인→표현형/비교형 PNG→검토·예약→학습 복귀와 기록 불변을 확인했다. 로컬 전용 `.env`의 가짜 계정·키·localhost를 운영에 사용하지 않는다. 배포용 빌드에서는 이 파일을 제외한다. 본인 로그인과 운영 CPU는 아래 운영 확인에서 별도로 검증했다. 새 카카오 재연결·실제 발송·iPhone은 이번 통합에서 검증하지 않았다.

## 게시·복구 확인표

- [x] 기존 Site의 정상 source 동기화·빌드·게시 절차 사용, 접근 정책과 기존 환경 값 보존.
- [x] 카드 서버 배포와 본인 ID/서버 키 일치 확인 후 기능 활성화.
- [x] 익명/위조 계정 요청 거부·카드 데이터 보존·기존 학습 기록 표시 확인. 실제 AI 요청과 운영 기록 저장 QA는 하지 않았다.
- [x] 별도 승인한 본인 1장 예약 발송·수신·이미지·원본 보기 확인. 아래 완료 기록 참조.
- [ ] 장애 시 `card_studio_enabled` 비활성화 후 기존 EN_Card 주소 사용. 데이터 이전·스키마 변경 없음.

이 변경은 운영 소스 b3b686f에서 분리한 `codex/card-studio-integration` 브랜치에 있다. 현재 진행 중인 정확성 개선 PR을 임의로 병합하지 않고 통합 변경만 검토한다.

## 운영 확인 — 2026-10-02 16:09 KST

- 기존 Site **v101**, 제품 소스 `abd915346cbe3dce8d982c2d0a8b0da8ec6b197a`, 환경48, 배포 `appgdep_6abf589d577081918af7fee44d8f3435` succeeded. 공개 정책revision4·기존 환경7개·DB 바인딩을 유지했다. 운영자 식별자와 서버 연결 키는 Secret으로 보관한다.
- 실제 ChatGPT 로그인 → 홈의 영어 카드 버튼 → /cards의 기존 카드14장·미리보기·예약 화면을 확인했다. PNG 다운로드78331바이트·1080×1080 확인. 익명/위조 플랫폼 사용자 헤더401, 카드 서버의 다른 사용자403이다. 실제 다른 사람의 계정 시험은 없다.
- EN_Card 최종 메인 버전 `a51bde4f-24d9-4fab-ba82-a2393d0cb334`, 제품 `cd8d2232e6164e1023e6925ec4fdb9f4359fd703`. DB15테이블 해시 일치, 기존 이미지5·활성예약0·발송예산8/20 유지. 조회 CPU2~5ms·무작업 Cron1~3ms와 Workers Free를 확인했다. 발송 Worker·Cron·DB/KV는 유지했다.
- 새 운영 카드·예약·AI 요청·카카오 재연결·메시지 발송은 없다. 제작·저장·예약 쓰기는 앞선 로컬 dry_run 검사로 확인했다. 실제 iPhone과 새 카카오 재연결/발송은 미검증이다.
- 장애 시 `card_studio_enabled=false`를 저장하고 **저장 버전을 다시 배포**해 적용한다. 데이터 이전·삭제가 없으며 기존 EN_Card는 계속 사용할 수 있다. 필요하면 통합 전 Site v99와 메인 Worker 버전으로 복구한다.
- Sites 게시 소스는 동기화했다. GitHub PR 병합은 수행하지 않았으며 정확성 개선 PR도 그대로다. 이후 운영 문서 변경만으로 새 배포하지 않는다.

## GitHub 병합용 분리와 후속 검토 — 2026-10-02

- `codex/card-studio-main`은 GitHub `main`의 `6be78ee`에서 카드 통합 커밋만 분리한 브랜치다. 정확성 개선 초안 PR #12의 제품 변경은 포함하지 않는다.
- 운영에는 이후 정확성 작업이 추가된 v103 (`af2ca8e`)이 있다. 후속 게시용 `codex/card-studio-release`는 이 운영 소스를 보존하고 카드 수정만 합친다. GitHub main 전체를 그대로 운영에 게시해 정확성 작업을 되돌리지 않는다.
- 검토에서 비소유자 화면의 계정 전환 링크와 통합 홈 버튼의 접근성 이름을 보완했다. 계정 전환은 기존 Sites `/signout-with-chatgpt`와 고정된 `/cards` 복귀 경로를 사용한다. 허용 계정·서버 인증·카카오 연결은 바꾸지 않는다.
- main 기준 단위 500개·타입·빌드 통과, lint 오류 0·기존 경고 13. 기존 진단 검사 1개는 과거 번들의 환경별 경로 해시를 현재 값과 비교해 실패했다. 현재 소스 해시와 동시 실행 결과를 검증하고 과거 판정 결과 전체는 유지하도록 테스트만 수정했다. 정확성 후보나 과거 평가 자료는 변경하지 않았다.
- 운영 기준 전체 722개와 추가된 최신 평가/카드 검사 19개가 통과했다. 후속 UI 수정은 DB·마이그레이션·환경 설정을 바꾸지 않으며 문제가 있으면 저장 버전 v103으로 복귀할 수 있다.

## 최종 운영·수동 확인 완료 — 2026-10-02

- 최신 게시 **v104**, 소스 `c2457b746a3a8a8fafdbf317735bbe14a6816de4`, 환경49/정책4, 배포 `appgdep_6abf653ed81481919afaccb27116f9b6`가 **17:03:29 KST succeeded**다. v103의 기존 정확성 작업을 보존했다. 후속 UI 작업에서 환경 값·DB·유료 자원을 변경하지 않았다.
- [하루단어 PR #13](https://github.com/zzocojoa/haru-word/pull/13)은 Node22/24 push·PR 검사4개 통과 후 17:14:05 KST `06fbd83`으로, [EN_Card PR #5](https://github.com/zzocojoa/EN_Card/pull/5)는 로컬 전체342개·빌드·무료 구성·독립 검토 후 17:22:06 KST `cd56013`으로 병합됐다. 정확성 PR #12는 OPEN/draft로 유지한다.
- 추가 학습·문법 초안 저장 지연/503/이동 잠금/백업/재시도/카드 왕복·새로고침 보존 검사 Chromium/WebKit **2/2** 통과. 합성 학습 상태 복원·기존 카드/예약 불변·AI 요청0 확인. WebKit 첫 포인터 재개가 기존 시계 준비 잠금과 겹치는 관찰은 남겼고, 재열기 보조 단계만 Enter를 사용했다. 관련 학습 코드는 통합에서 변경하지 않았다.
- 사용자 승인한 기존 `That makes sense` 카드 **1장**을 정상 `/cards` 화면에서 17:16 KST/08:16 UTC로 1회 예약했다. 17:17:00.898 KST **live/sent·API 호출1회**, 예약종료·활성0·미해결0·일일9/20 확인. 사용자도 **1장 수신·이미지·원본 보기 정상**을 직접 확인했다.
- 해당 실제 Cron CPU5ms·준비3ms·발송4ms, 모두 ok/예외0. 카드14·이미지5/402286바이트·카카오connected/version11 유지. 새 카카오 재연결·추가 발송·운영 학습 QA 쓰기 없음. CPU 수집기는 종료했다.
- 사용자가 **실제 iPhone Safari 로그인·카드 미리보기·PNG 다운로드·파일 앱 저장 모두 정상**이라고 확인했다. 사용자 수동 결과이며 자동 WebKit 검사와 구별한다. VoiceOver/키보드/날짜의 모든 조작·새 카카오 재연결·미래 전체 부하를 확인한 결과는 아니다.
- 상세 EN 원본 검증은 [HARU_INTEGRATION.md](https://github.com/zzocojoa/EN_Card/blob/master/docs/HARU_INTEGRATION.md), 안전한 배포 증거는 릴리스 체크아웃 `.sites-runtime/card-review-deployment.json`에 보관한다. 완료 문서만으로 운영을 재배포하지 않는다. 다음 게시 전 Sites 최신 소스를 먼저 열어 정확성 작업과 이 통합을 보존한다.
