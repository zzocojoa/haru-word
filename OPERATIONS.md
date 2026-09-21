# 하루단어 운영 안내

한국인 성인 학습자가 Oxford 목록을 하루 1~3개씩 익히는 비공개 Sites 앱입니다. 서버는 Cloudflare Workers/Vinext, 화면은 React/TypeScript, 저장소는 D1입니다. 별도 AI API는 호출하지 않습니다.

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
