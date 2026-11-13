# 단어 출처와 평가 기준의 의미 감사 · 2026-11-07

단어의 품사·뜻 근거를 추가하고,현재 공개 기준의 미확인 사항을 새 준비 검사에서 보류하도록 구현했다. **lexical 출처8개·ask/book/help의3개 목표 연결·9개 작성 본문과 G12 반대 근거3개 본문**을 구성했다. 실제 모델 호출/판정이나 영어 정답 확정은 아니다. T34/4자식 review·상위24/40·세부77/133 완료를 유지한다.

## 먼저 확인해야 할 기준

기존 G12는 `She is speaking quiet.`를 교정 필요로 두고 있으며,N04의 현재 기준은5차원 모두 pass다. [Merriam-Webster의 quiet](https://www.merriam-webster.com/dictionary/quiet)는 별도 부사 항목을 싣는다. [British Council](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/adverbials-manner)은 보통 -ly로 만드는 학습 형태와 quiet→quietly를 설명한다. 이 근거로 quiet가 언제나 형용사이며 -ly가 반드시 필요하다고 단정할 수 없다. 반대로 사전의 부사 항목 하나가 해당 speaking 구문의 모든 문체/방언에서 자연스러움을 입증하지도 않는다.

따라서 이번 결론은 **기존 문장이 무조건 맞거나 틀리다는 새 판정이 아니라,문체/변이와 해당 결합을 정하기 전에는 단정적 문법 오류/all-pass 보정 기준으로 확정하지 않는 것**이다. 출처의 적용 범위 차이를 곧바로 상호 모순이나 특정 문장의 정답으로 바꾸지 않는다. 새 준비 도구는 G12/N04를 명시적 blocker로 표시하며,--qualification-ready는 ready=false·exit2다. 이는 의도한 보류이며 실제 검사 실패나 AI 영어 오답이 아니다.

N04의 현재 표시 설명은 이미 확인되지 않은 상세 문법 규칙을 단정하지 않는 일반 안내다. 이번에 is speaking을 잘못 고친 설명을 새로 발견했다는 뜻이 아니다. 현재 목표/문법/교정 pass 참조의 전제가 재검토 대상이라는 뜻이다. 옛 G12/N04의 라벨·허용 대안·기대 점수와 닫힌 실제 평가/원점수는 수정하지 않았다. 원본 행과 파일 지문을 고정하고 새 감사 결과를 별도 자료로 남겼다.

## 출처와 적용 범위

| 출처 | 확인한 범위 | 저장한 근거 |
| --- | --- | --- |
| [Cambridge ask](https://dictionary.cambridge.org/dictionary/english/ask) | 질문 의미의 동사,자동/타동 표시 | 인증 없는 HTTPS·선택 dictionary entry 본문 지문/발췌 |
| [Cambridge book](https://dictionary.cambridge.org/us/dictionary/english/book/) | 명사 TEXT와 동사 ARRANGE 구분 | 공식 검색 본문에서 확인한 발췌 지문만 |
| [Cambridge help](https://dictionary.cambridge.org/dictionary/english/help) | 도움을 뜻하는 명사와 동사 구분 | HTTPS·선택 entry 본문 지문/발췌 |
| [Merriam-Webster careful](https://www.merriam-webster.com/dictionary/careful) | 형용사와 carefully 부사 표기 | 공식 web open 발췌 지문만 |
| [Cambridge quiet](https://dictionary.cambridge.org/dictionary/english/quiet) | 학습 사전의 형용사 항목 | HTTPS·선택 entry 본문 지문/발췌 |
| [Merriam-Webster quiet](https://www.merriam-webster.com/dictionary/quiet) | 별도 부사 정의/편집 예시 | 공식 web open 발췌 지문만 |
| [Cambridge skillfully](https://dictionary.cambridge.org/dictionary/english/skillfully) | 부사와 미국/영국 철자 관계 | HTTPS·선택 entry 본문 지문/발췌 |
| [British Council manner](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/adverbials-manner) | 보통의 부사 형성과 학습 형태 | 공식 편집 수업 본문의 확인 발췌 지문만 |

4개는 일반 HTTPS의 선택 본문 전체를 해시했고,나머지4개는 브라우징 도구에서 확인한 발췌만 해시했다. 뒤4개의 rawPageSha256/status는 null이며 전체 HTML을 받았다고 주장하지 않는다. 최초/재조회에서 book 발췌 선택 불일치2·Merriam-Webster403 2·British Council 시간초과2의6회 미채택 시도도 보존했다. 본문/발췌 구분을 낮추거나 실패를 성공으로 덮지 않았다. 원문 전체와 커뮤니티 댓글은 저장하지 않고,출처마다25단어 이내의 짧은 발췌와 URL·확인시각·지문을 남겼다. 지문은 내용 연결이며 출처 인증/영어 진실/독립 심사의 증명이 아니다.

ask의 자동사 용례 근거를 단어마다 목적어가 필수라는 규칙으로 바꾸지 않는다. book의 명사가 문법적으로 맞는 문장에 있다는 사실과 선택한 예약 동사 의미를 썼는지는 별개다. help의 동사 항목이 있다는 이유만으로 명사 목적어 용례를 동사 목록으로 처리하지 않는다. 이3개 연결은 기존 공개 G01/G06/G11의 원자적 어휘 근거를 보강하며,문장 전체의 화용/문법/의도와 전체 제품 단어 영역을 인증하지 않는다.

## 요청 구성과 준비 차단

새 단어 출처 묶음은 기존 reference-v4의5개 source 필드에 맞춰 작성하며,품사/뜻·무엇을 입증하지 않는지 별도 메타데이터로 기록한다. 기존 GEX1의 전체 선택426개 로컬 비교와 과제별 partial 자료를 그대로 사용했다. G12용에는 quiet의 학습 형용사·별도 부사·보통의 -ly 지침을 모두 포함한3출처 묶음을 만들고3모델 작성 요청에 반대 근거가 실제 들어가는 것을 확인했다. 불편한 근거를 뺀 요청으로 준비 완료를 만들지 않는다. 이3본문은 근거를 포함한 진단용 작성 요청이며,N04를 실제 AI가 재채점한 결과가 아니다.

단어9본문/반대 근거3본문은 기존8KiB 출처 묶음·131072바이트 요청·출력4096 설정 안에서 구조 검사를 통과했다. 실제 토큰 상한·최종 실제 본문·가격이나 유료 실행 승인이 아니다. 비공개 기대 점수는 source projection에 포함하지 않는다. 출처 변경/잘못된 membership은 기존 배정 hash 검증으로 거절된다.

공개 통제 후보6개는 현행 GEX1의 fresh-reference 비교 규칙에서 이미 알려진 원문이다. 이 규칙에서 exposure fail/knownExposureLeak가 필요하다는 기계적 결론과,그 문장 자체의 영어 문법 판정은 구분한다. 과거 unavailable 설명을 새 영어 gold나 전체 가족 독립성 판정으로 승격하지 않았다. 기존 컴파일러는 meaningUsage=appropriate/contextNeeded=none을 공통으로 넣는다. 부정 소실과 앞 메시지 없는 답변 통제에서는 원래 라벨·목표·문맥 차원의 추가 오류도 섞일 수 있어,의도한 실패 차원 외를 자동 pass로 채울 수 없다. 이 두 항목은 Codex의 재검토 제안이며 다른 AI가 독립 검증한 새 정답표가 아니다.

전체7차원 통제 벡터6개와 공개12참조 행은 아직 해당 정책에 따른 검토/동결이 끝나지 않았다. 준비 도구는 blocker 목록만 삭제하거나 ready 플래그만 바꿔도 미검토 행을 무시하지 못하게 한다. 기존 합성 실행기는 과거12벡터를 호환/도구 회귀용으로 보존한다. **새 준비 도구의 차단을 기존 합성 실행기 전체나 실제 유료 평가 경로까지 새로 연결했다고 주장하지 않는다.** 실제 영어/역할 자격 합격을 내보내는 단계는 계속 보류다.

평가 기준 확정 전 점검:

1. 지원할 문체/변이와 해당 구문의 허용 범위를 출처와 함께 명시한다. 사전 항목 존재만으로 정확한 문장 판정을 결정하지 않는다.
2. 기존 기준을 보존한 채12참조/6통제의 전체 차원과 의도하지 않은 추가 실패를 검토하고 새 기준을 봉인한다. 결과를 본 뒤 점수를 올리기 위한 변경을 하지 않는다.
3. 그다음 실제 비자기 AI 역할 자격·본문/토큰/금액 승인과 예비/확인/일반화로 진행한다. AI 동의율과 실제 영어 정답률·학습 효과는 구분한다. 사람 섭외는 필수 조건이 아니다.

최종 Node22/24 각각6/6·exit0이며 관련 도구2개/관리 verifier lint는 오류·경고0/exit0다. 출처 범위/캡처·품사/뜻 연결·12본문·반대 근거·원본 보존·6개 노출·보류 exit2·flag/blocker 우회·private grade 제외를 검사했다. 최초 자료 생성 스크립트는 일부 witness에 선택적인 goldCaseId가 없다는 점을 놓쳐 실패했다. 실패 코드/부분 생성 파일을 보존하고 해당 필드가 있는 행만 찾도록 고쳤다. 그 뒤 기준 자료를 덮어쓰지 않고 기존 부분 출력 지문을 대조해 이어갔다.

이번에는 기존 평가 실행기/제품547입력을 바꾸지 않아 phase38의 새9/회귀60/Worker12·중단2 및 phase18e의 제품 각879/타입·린트·빌드를 재사용했다. 제품 전체·실행기/Worker·2052전체/프로세스 강제 종료를 다시 실행하지 않았다. 기존426 로컬 corpus·원장/예산·과거 실패·동결 증거를 보존했다. 실제 AI/count/키 값 읽기·쓰기·추가 과금 승인/사용·운영 학습 QA·배포/Git·미병합 산출물 삭제0이다. 키 재사용은 기승인이다. T34 위험/표본·출처/가족·실제 자격·영어 품질·금액 승인·학습/운영/출시/1일/7일은 남아 있다. 최종 관리/브라우저/보존은 phase39/execution-verification.json 및 progress-final.json을 따른다.

관리 동기화의 보존 대조에서 관리 파일 목록을 전체 입력 원장으로 잘못 조회해1회 실패했다. 원본 gold/witness가 없어진 것은 아니다. 보존된 v2 목록 준비의 sourceBindings와 당시 관리 지문을 대조해 원본 불변을 확인하고 남은 동기화만 이어갔다. 최초 스크립트/실패는 보존했다.

출처 묶음의 provenance hash도 공개할5개 출처 필드만으로 계산한다. 가상의 비공개 grade를 catalog에 추가해도 최종 묶음/지문이 바뀌지 않는 것을 대조해,전체 catalog 메타데이터를 모델용 지문에 섞지 않도록 했다. 해당 수정 후 새6검사를 두 Node에서 다시 통과했고 lint도 다시 확인했다.
