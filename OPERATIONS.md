# 하루단어 운영 안내

한국인 성인 학습자가 Oxford 목록을 하루 1~3개씩 익히는 비공개 Sites 앱입니다. 서버는 Cloudflare Workers/Vinext, 화면은 React/TypeScript, 저장소는 D1입니다. 선택형 문장 점검은 서버에서 Google Gemini API를 호출합니다.

## 데이터와 학습 기준

- 첨부 PDF 13쪽에서 3,000개 표제어, 3,308개 원문 행, 품사·수준별 3,809개 항목을 추출했습니다. `data/source-audit.json`에 원문 SHA-256 및 수준별 수가 있습니다.
- `data/words.json`, `data/content.json`은 배포에 사용하는 완성 데이터입니다. 일반 빌드에서는 외부 사전이나 Python이 필요 없습니다.
- `data/authored-*.tsv`의 뜻·예문은 학습용으로 작성했습니다. `data/meaning-overrides.tsv`는 참고 사전의 품사 오류 등을 보완합니다. 전문가의 모든 항목 검수를 거친 자료는 아니므로 카드의 사전 링크와 개인 수정 기능을 제공합니다.
- `public/sources/`에 원본 PDF, 추출 감사 자료, 사용 데이터와 문장별 기여 정보, 라이선스 안내가 있습니다. PDF의 Oxford 저작권은 별도로 유지됩니다.
- 친숙도는 정식 CEFR 시험이 아닙니다. 양방향 회상과 문장 결과는 자기 평가이며, 자동 문법 판정이 아닙니다. 처음 도움을 받은 결과는 재시도 성공으로 덮어쓰지 않습니다.

## 유지보수 명령

Node 22.13 이상과 저장된 lockfile을 사용합니다. `npm run install:ci`, `npm run dev`, `npm run build`, `npm start`가 기본 명령입니다. Windows의 npm.cmd 경로 인식 문제 시 설치된 npm-cli.js를 Node로 직접 실행할 수 있습니다.

검증:

```text
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js app lib db
node --experimental-strip-types --test tests/learning.test.mjs
node tests/browser-qa.cjs
node tests/resume-qa.cjs
```

브라우저 테스트는 로컬 빌드 미리보기 `127.0.0.1:8787`과 Playwright를 사용합니다. 테스트 파일의 Playwright 경로는 이 작업 환경의 번들 경로이므로 다른 기기에서는 설치 경로로 바꾸어야 합니다. 개발 모의 로그인 사용자와는 다른 임시 계정을 사용합니다. 테스트 계정 데이터는 로컬 D1에만 남으며 배포하지 않습니다.

콘텐츠를 다시 생성하려면 Python의 pdfplumber/nltk 및 WordNet·영어 품사 태거가 필요합니다. 원문 재추출: `python scripts/extract-oxford.py public/sources/oxford-source.pdf`. `work/` 폴더를 먼저 만드세요. `scripts/build-content.py`에는 무작위성이 없으며 `data/content.json`이 현재 승인된 결과물입니다. 원자료를 새로 다운로드하면 예문이 달라질 수 있으므로 결과 diff를 검토하세요.

콘텐츠 생성 입력은 다음과 같습니다.

- `work/dictionary-source.json`: https://raw.githubusercontent.com/jhseo1211/open-english-korean-dict/main/dict/words.json
- `work/dictionary-credits.md`: 이 사전의 CREDITS.md (현재 사본은 `public/sources/dictionary-credits.md`)
- `work/tatoeba/kor.txt`: https://www.manythings.org/anki/kor-eng.zip 의 문장 파일
- `work/nltk_data`: wordnet, averaged_perceptron_tagger_eng

생성 순서: `python scripts/build-content.py`, `python scripts/prepare-attribution.py`, 데이터 테스트, 타입 검사, 빌드.

## 저장과 보안

Sites가 검증해서 주입하는 ChatGPT 사용자 ID로 모든 쿼리를 제한합니다. 이 Worker를 인증 게이트웨이 없이 인터넷에 직접 공개해서는 안 됩니다. 본 배포는 소유자 전용 비공개입니다. API는 비로그인 거부, 동일 출처 확인, JSON 스키마 검증, 매개변수 SQL, 캐시 금지를 적용합니다.

단어 진행·회차·계정 설정을 나누어 저장합니다. 회차마다 변경분을 트랜잭션으로 저장하며 계정 revision이 달라지면 409를 반환합니다. 다른 기기의 변경을 조용히 덮어쓰지 않습니다. 저장 실패 시 화면 입력을 유지하고 재시도 또는 JSON 백업을 제공합니다. 아직 저장 버튼을 누르지 않은 입력은 브라우저를 강제 종료하면 손실될 수 있습니다.

## 장애와 관측

저장소 장애는 503과 복구 안내로 표시합니다. 서버는 `learning_state_load_failed` 또는 `learning_state_save_failed` 이벤트와 항목 수만 기록하며 문장·계정 식별자·인증 정보는 로그에 넣지 않습니다. 별도 외부 분석/오류 추적 서비스는 없습니다. CSV/JSON 내보내기로 개인 백업이 가능합니다. JSON 가져오기는 제공하지 않습니다.

## 마이그레이션과 롤백

초기 D1 마이그레이션은 `drizzle/0000_worthless_doctor_faustus.sql`이며 세 테이블을 새로 만들 뿐 기존 데이터를 삭제하지 않습니다. 스키마 생성 실패 시 배포가 중단될 수 있습니다. Sites가 배포 시 마이그레이션을 적용합니다.

이후 회귀가 생기면 직전 성공한 Sites 버전을 다시 배포합니다. 앱 롤백은 D1 데이터를 되돌리지 않습니다. 이번 JSON 필드 추가는 선택 필드이므로 기존 저장 문서와 호환됩니다. 향후 삭제·타입 변경은 별도 백업과 호환 마이그레이션이 필요합니다.

## 검증 범위와 한계

15개 도메인·데이터 테스트와 19개 브라우저 검증 시나리오를 통과했습니다. 타입 검사, 앱/도메인/DB ESLint, 프로덕션 빌드도 통과했습니다. Chrome 계열 데스크톱·390px 모바일 레이아웃을 확인했습니다. 실제 iOS/Safari, 기기별 TTS 음성, 장기 대규모 계정 데이터는 검증하지 않았습니다. WebMCP 미지원 환경에서도 일반 화면은 작동합니다. 실제 지원 브라우저의 WebMCP 실행은 별도 확인이 필요합니다.

초기 다운로드에는 전체 단어 데이터가 포함됩니다. 네트워크가 느리면 첫 화면 준비가 지연될 수 있습니다. 다음 성능 개선은 데이터 요청 분리와 필요 시 로딩이며, 현재 기능 완전성을 위해 데이터는 한 번에 제공합니다.


## Google 문장 교정

- Sites 비밀 설정 `google_api`를 서버에서만 읽습니다. `google_ai_enabled=true`일 때 활성화됩니다. 소유자가 해당 Google 프로젝트를 Free Tier로 확인한 뒤 켭니다. Google 결제 설정을 바꾸지 않으며, 이후 유료 등급으로 바뀌는지 앱이 자동 확인할 수는 없습니다.
- 고정 모델은 `gemini-3.1-flash-lite`입니다. 사용자 버튼 조작마다 현재 문장과 목표 단어·품사·뜻만 전송합니다. 이메일, 사용자 ID, 전체 학습 이력은 보내지 않습니다.
- 인증과 회차 소유권·현재 문장 단계 검증을 통과해야 호출합니다. 키는 URL·브라우저·로그에 포함하지 않습니다. 공급자 오류 원문은 전달하지 않습니다.
- 문장 길이는 2,000자, 출력은 최대 1,536토큰, 공급자 대기는 20초로 제한합니다. 자동 재호출이나 다른 유료 모델로 전환하지 않습니다.
- D1 `ai_daily_usage` 테이블에서 한국 날짜별 사용자 요청을 원자적으로 예약합니다. 10초 간격, 일일 30회이며 실패한 요청도 횟수에 포함됩니다. Google의 자체 한도가 더 낮을 수 있습니다.
- AI 결과는 원문과 함께 회차의 선택 필드 `aiFeedback`에 저장됩니다. 친숙도·회상 성적·문장 완료 여부는 자동 변경하지 않습니다. 수정 전 결과를 구분해서 표시하고 기록 화면·CSV·JSON 백업에 남깁니다.
- 장애 로그는 `sentence_feedback_succeeded`(모델), `sentence_feedback_failed`(오류 코드)만 기록합니다. 문장·키·계정 정보는 기록하지 않습니다. API/저장 실패 시 자기 점검과 기존 저장 재시도를 사용합니다.
- 추가 마이그레이션 `0001_ai_daily_usage.sql`은 횟수 제한용 테이블만 생성합니다. 기존 학습 테이블·행은 변경하지 않습니다. 검증에는 실제 SQLite와 로컬 Worker를 사용했습니다.
- 즉시 중지하려면 `google_ai_enabled=false`를 설정하고 현재 버전을 재배포합니다. 전체 코드를 이전 버전으로 되돌리면 새 `aiFeedback` 필드를 모르는 엄격한 저장 스키마가 이를 거부할 수 있으므로, UI만 되돌리면서 해당 선택 필드 파싱은 유지하는 패치가 안전합니다. 새 테이블은 비활성 상태로 남겨도 됩니다.
- 공급자 모의 응답으로 성공·한도·권한·형식 오류를 검사합니다. 실제 Google 키의 권한·무료 할당량·실시간 응답은 학습 화면의 첫 교정 호출에서 확인됩니다. 실제 키를 로컬에 내려받거나 비밀 값을 출력하지 않습니다.


## 완료한 일일 학습 다시 보기

- 홈·학습 종료·학습 기록에서 완료한 날짜의 단어 카드를 다시 열 수 있습니다. 열람은 API 저장이나 성적 변경을 하지 않습니다. 뜻·내 문장은 원래 회차에서, 표현·예문은 현재 단어장에서 읽습니다.
- 다시 학습은 `kind=practice`, `practiceMode=repeat`, `period=원래 학습일`로 별도 회차를 만듭니다. 해당 날짜의 완료된 일일 목표 전체와 학습 뜻을 사용하고, 성적·힌트·문장·AI 의견은 복사하지 않습니다. 기존 진행 중인 다시 학습이 있으면 같은 회차를 재개합니다.
- 순서는 단어 익히기 → 영어→뜻 → 뜻→영어 → 문장입니다. 원래 일일 기록, 친숙도, 신규 학습 날짜·단어 수는 유지합니다. 선택적인 재학습의 미측정은 이전 성공을 취소하지 않으며, 이번에 확인한 도움 필요·문장 보완은 이월에 반영됩니다.
- 위험도는 중간(서버 저장 문서에 새 연습 종류 추가)입니다. D1 마이그레이션은 없고 기존 문서는 그대로 호환됩니다. 오래 열린 이전 화면은 새 회차를 제대로 진행할 수 없으므로 배포 후 새로고침이 필요합니다.
- 롤백은 새 `repeat` 모드의 검증·진행 처리를 유지하면서 진입 버튼만 되돌리는 패치를 사용합니다. 이전 버전을 그대로 배포하면 새 모드를 모르는 저장 스키마가 진행 중인 회차 저장을 거부할 수 있습니다. 회차 삭제나 기존 데이터 초기화는 하지 않습니다.
- 기존 저장 실패/충돌 표시와 `learning_state_save_failed` 이벤트를 그대로 사용합니다. 새 외부 호출·권한·로그 항목은 없습니다. 저장 실패 시 화면에 남긴 상태를 다시 저장하고 같은 회차로 이어갑니다.
- 도메인 테스트 44개(이번 추가 8개), 새 모바일·데스크톱 브라우저 시나리오 7개로 원본 보존, 미측정 처리, 여러 기기 재개, 오류 복구를 검증합니다. 실제 iOS Safari 검증은 포함하지 않습니다.
