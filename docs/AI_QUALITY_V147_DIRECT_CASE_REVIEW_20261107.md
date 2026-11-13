# G12/N04 직접 진단과 토큰 계산 준비 · 2026-11-07

G12 원문·기존 판단/교정 제안·N04의 실제 표시 설명을4개 출처와 함께 심사하는 **6개 직접 진단 본문**을 구현했다. 기존 공개 통제36개와 합친 **42개 본문별 토큰 계산 준비 객체**를 기존 input-count 구성요소로 만들었다. 실제 AI/토큰 계산 호출·키값 읽기쓰기·추가 과금 승인/사용0이다. T34/4자식 review·상위24/40·세부77/133 완료를 유지한다.

## 확인한 빈틈과 정정

기존 lexical의3개 G12 반대 근거 요청은 새 예문 작성용이다. **G12 원문은 이미 exposureEvidence의 사용 제외 목록에 포함되어 있었다.** 원문이 본문 전체에 없었다는 최초 가정은 틀렸다. 다만 G12를 심사 대상으로 지정하거나 N04의 실제 표시 설명을 전달하지 않았다. 첫 검사6/7 실패와 당시 코드를 남기고,역할/필드를 나눠 비교하도록 바로잡았다. 목록에 문장이 있다는 것과 그 문장의 기존 판단을 심사하라는 요청은 다르다.

새 요청은 정확한 원문 `She is speaking quiet.`,기존 `quietly` 교정 제안과 현재 N04 표시 설명을 별도 record에 싣는다. 현재 설명은 일반 안내이며 is speaking을 고쳤다는 구체적 주장이 없다. 옛 rationale에서 그런 오류가 실제 현재 화면에 있다고 추론하지 않는다. 새 진단은 기존5차원 all-pass·원점수를 모델에게 정답으로 주거나 다시 채점하지 않는다. 기대점수/referenceNotes/wire 내부 이유와 원본 전체 행 지문은 모델용 projection에서 제외한다. 공개 필드만으로 계산한 지문은 비공개 기대 점수를 바꿔도 같음을 확인했다.

## 근거와 질문

기존 Cambridge quiet·Merriam-Webster quiet·British Council manner의 출처 묶음을 보존하고,Oxford quietly의 편집 용례를 추가했다. [Merriam-Webster](https://www.merriam-webster.com/dictionary/quiet)의 별도 부사 항목과 [British Council](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/adverbials-manner)의 보통 -ly 학습 설명은 공존한다. [Oxford quietly](https://www.oxfordlearnersdictionaries.com/definition/english/quietly)의 speak quietly 용례는 교정 형태의 결합을 뒷받침한다. 이것만으로 정확한 원문이 모든 문체에서 틀리거나 자연스럽다고 확정하지 않는다. Oxford 직접 open403을 보존하고 검색에서 확인한 짧은 편집 발췌만 해시했다. status/rawPageSha256은 null이며 전체 페이지 수신으로 표시하지 않는다. 댓글·자동 수집 뉴스 예시는 근거로 쓰지 않았다.

진단 질문5개:

1. quiet의 부사 용법이 출처에 등재되어 있는가.
2. speak quietly라는 교정 결합이 출처로 지지되는가.
3. 정확한 원문의 문체/변이별 자연스러움이나 오류가 이번 근거로 확정되는가.
4. 문체가 미정인 현재 단정적 오류 참조를 확정해도 되는가.
5. N04의 실제 설명이 변경되지 않은 is speaking의 교정을 주장하는가.

3모델×자료순서2=6개 본문,6326–6328바이트다. 출력4096·본문131072바이트·출처 묶음8KiB·store/stream=false를 유지한다. 실제 토큰 수나 호출 비용이 아니다. 이 명시적 공개 진단은 blind 판정·새 미공개 가족·편향 제거를 증명하지 않는다.

응답은 질문별 근거/판정·원문 판단·문체·남은 불확실성을 구조화한다. 외부 출처 ID·없는 인용·현재 설명에 없는 is-speaking 문구·질문/요청 누락·중복·본문 변경을 거절한다. 출처의 인용이 존재한다는 것은 그 해석이 맞다는 보증이 아니다. 합성6개 응답이 일치해도 미확정 근거가 남으면 보류하며,문체가 다르면 합의로 합치지 않는다. 근거 없는 gold 적합 주장도 별도 표시한다. 현재 모듈은 calibrationGoldEligible/actualEnglishQualityMeasured/actualRoleQualificationMeasured를 true로 내보내지 않는다.

## 토큰·가격·승인

공개 통제36개와 직접 진단6개는 서로 다른 목적이며 총42개 요청 후보다. 원래 준비180/예비1872에 기포함된 것으로 세지 않는다. 각 요청의 model/instructions/input/reasoning/text-schema를 실제 최종 본문에서 투영해 토큰 계산 객체42개를 구성했다. 이것은 **계산 요청 준비**이며 실제 endpoint 전송/측정은0이다. 합성7000/설정8192는 binding 검사 값이고 실제 본문 상한이 아니다. 실제 표시 설명이나 지침이 달라지면 이전 계산 영수증을 재사용할 수 없음을 대조했다.

[공식 토큰 계산 지침](https://developers.openai.com/api/docs/guides/token-counting)과 [count API reference](https://developers.openai.com/api/reference/resources/responses/subresources/input_tokens/methods/count)를 검색 후 가져와 확인했다. 역할/경계/schema 등은 로컬 일반 텍스트 토큰화로 정확히 반영되지 않을 수 있어 바이트 수/문자수 추정을 실제 측정으로 올리지 않는다. [공식 가격](https://developers.openai.com/api/docs/pricing)의 지정3모델 Standard 표도 재확인했다. 계정별 실제 접근·청구서는 확인하지 않았다.

확인한 문서만으로 count endpoint의 별도 요금을 확정하지 못했다. 미확인을 무료로 가정하지 않는다. 실제 토큰 미측정·count 요금 미확정·진단 단계/비용 미승인·G12/N04 참조 미확정의4개 사유로 paymentQuoteReady=false를 유지한다. 준비 객체의 quoteHash는 미완료 초안 식별자이며 유료 승인/최대 금액이 아니다. 42개 계산과42개 진단을 이미 승인/실행한 호출로 합산하지 않는다. 새 금액·최종 본문/단계 승인 전 실제 API를 실행하지 않는다. 기존 키 재사용 결정은 기승인으로 유지한다.

## 검증·보존·다음 조건

새7검사와 공개 통제7/lexical6/input-count11의 관련24회귀가 Node22/24에서 각각 통과했다. 이전 body에 G12가 없다고 한 첫 검사 실패와 lint의 미사용 helper1경고를 보존했다. 가정을 고치고 미사용 helper/import를 제거한 최종 코드를 다시 검사했으며 lint는 오류/경고0·exit0다. 기존 모듈·제품547입력과 G12/N04 원본 라벨·기대점수·닫힌 평가 점수·예산은 바꾸지 않았다. 이번 제품879/타입/린트/빌드·Worker/2052전체/강제 종료 행렬은 기존 입력/코드 지문을 확인해 재사용했고 재실행하지 않았다.

실제 독립 비자기 AI 검토·사용 문체/정확한 용례·12참조/6통제 자격·위험/표본/효과·전체 가족 독립성·토큰/요금/단계별 금액·예비/확인/일반화·학습 대리 지표/운영·출시·1일/7일은 남아 있다. 사람 섭외는 필수 조건이 아니다. 직접 진단 도구에는 제공자 전송·키 검색/저장·새 유료 원장 구현을 추가하지 않았다. 기존 Site/DB/API/마이그레이션/관측 이벤트·Git을 바꾸거나 미병합 산출물을 삭제하지 않았다. 최종 관리/대시보드/보존은 phase41/execution-verification.json 및 progress-final.json을 따른다.
