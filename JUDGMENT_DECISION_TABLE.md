# 판정 결정표 · 비과금 후속 v5 개발 기준

범위는 15수업 × 7유형 =105개 공개 합성 개발 사례다. 영어 전체를 전수 검증하거나 모델 정확도를 측정한 자료가 아니다. 구현 전에 노출한 결정표이며, 새 holdout이나 과거 원점수의 재채점에 사용하지 않는다. 현재 운영은v142, 마지막 유료 평가 소스aef7d0a는 동결·출시 보류 상태다.

## 우선순위

1. 의도한 메시지를 충분히 파악할 수 있는지 먼저 확인한다. 일반 문장 작성의 미완성 구절·절·단어열은 두 판정을 보류한다. 보이는 모든 단어가 영어학적으로 틀렸다는 주장이 아니다.
2. 실제 명령·인사·감탄은 유효하다. 명시적으로 선택한 답변/제목/명령 문맥은 생략을 허용할 수 있다. 문맥 메모 속 단어·부정·인용은 형식 선택을 대신하지 않는다.
3. 충분한 메시지에서는 원문 목표 사용과 원문 문법을 따로 판단한다. 목표가 없어도 자연스러운 원문은 그대로 둔다. 확정된 목표 형태 오류와, 안전한 교정을 선택할 정보 부족은 함께 존재할 수 있다.
4. 의미가 같은 최소 대안 여러 개는 허용한다. 시점·뜻·참여자·발화행위를 달리 선택해야 하는 대안은 문맥을 먼저 요청한다. 시간 없는 might brought의 base/perfect 대안을 임의 선택하지 않는다.
5. 과제 예문 변경·학습 점수·진도·실세계 사실 확인은 이 판정과 별개다. API/형식/후처리 실패도 영어 문법 판정으로 바꾸지 않는다.

## 질문과 호환성

v5 생성 wire의 contextNeeded는 자유 질문 대신 none/message/time/target_meaning/relationship 중 하나다. 앱은 검토한 한국어 질문을 표시한다. time은 문법uncertain·교정비움과 함께만 허용한다. 모델 자유 설명이나 임의 질문을 검토한 문법 규칙으로 노출하지 않는다.

프롬프트 reference-v5·검증 judgment-v5를 별도 기록한다. 저장 피드백 필드/복원 형식과 capability4는 유지하며, capability3 이하에서는 v4/v5를 업그레이드 보호한다. 구형 v4 기록은 변환하지 않고 과거 의견으로 읽는다. 새 모델 품질은 아직 미검증이며 이 문서의 로컬 계약 검사를 그 증거로 대신하지 않는다.

## 검증 범위

- 모델 지시: 아래105개의 판단 차이를 15수업 기준과 공통 메시지/교정 정책에 명시한다. 로컬 wire 참조 주입은 이 상태가 표현 가능한지만 증명한다.
- 독립 입력 검사: 단일 단편·동사열·수량·짧은 slash열과, 관계/위치 머리말+관사+한 토큰의 제한된 패턴만 보류한다. 일반 품사/절/의미 분석기가 아니다. 그 밖의 불충분 여부·시점·뜻은 모델 판단과 별도 품질 검증에 의존한다.
- 교정 보호: 기존 부정/수량/명시 시점/조동사 강도/참여자/일부 활용 검사는 유지한다. 모든 의미 동등성을 기계적으로 증명하지 않는다.
- 오류 분류: fetch 거절과 응답 body의 실제 읽기 실패를 network로, locked reader·후처리 TypeError는 응답 형식 실패로 구분한다. 과거 실패의 실제 원인을 이 새 검사만으로 확정하지 않는다.

## 전체 개발 사례

표의 판정은 원문 기준이다. natural=자연스러움, needs_work=보완, uncertain=보류. unchanged는 원문 유지, withhold는 교정 비움이다. 형식이 reply이면 함께 기록한 질문 문맥을 전제로 한다.


### noun

| 유형 | 입력 / 명시 문맥 | 목표 / 문법 | 교정 | 필요한 정보 |
|---|---|---|---|---|
| natural | The artist owns a bicycle. | appropriate / natural | unchanged | none |
| target_error | I bought three box. | needs_work / needs_work | I bought three boxes. | none |
| unrelated_error | These lanterns glows. | appropriate / needs_work | These lanterns glow. | none |
| missing_target | She runs. | needs_work / natural | unchanged | none |
| default_fragment | A green suitcase | uncertain / uncertain | withhold | message |
| supported_fragment | A red kite. / 질문 What did you see above the meadow?에 대한 답변입니다. [reply] | appropriate / natural | unchanged | none |
| interpretation_control | I saw her duck. | uncertain / natural | unchanged | target_meaning |

### verb

| 유형 | 입력 / 명시 문맥 | 목표 / 문법 | 교정 | 필요한 정보 |
|---|---|---|---|---|
| natural | Mina understands the map. | appropriate / natural | unchanged | none |
| target_error | She carry a basket. | needs_work / needs_work | She carries a basket. | none |
| unrelated_error | She carries two box. | appropriate / needs_work | She carries two boxes. | none |
| missing_target | Hello! | needs_work / natural | unchanged | none |
| default_fragment | write leave | uncertain / uncertain | withhold | message |
| supported_fragment | Running. / 질문 What was Ben doing?에 대한 짧은 답변입니다. [reply] | appropriate / natural | unchanged | none |
| interpretation_control | You might brought a torch. | needs_work / uncertain | withhold | time |

### pronoun

| 유형 | 입력 / 명시 문맥 | 목표 / 문법 | 교정 | 필요한 정보 |
|---|---|---|---|---|
| natural | They helped us. | appropriate / natural | unchanged | none |
| target_error | Her greeted we. | needs_work / needs_work | She greeted us. | none |
| unrelated_error | She deliver snacks to them. | appropriate / needs_work | She delivers snacks to them. | none |
| missing_target | Birds migrate. | needs_work / natural | unchanged | none |
| default_fragment | Him | uncertain / uncertain | withhold | message |
| supported_fragment | Us. / 질문 Who did they invite?에 대한 짧은 답변입니다. [reply] | appropriate / natural | unchanged | none |
| interpretation_control | They are here. | appropriate / natural | unchanged | none |

### adjective

| 유형 | 입력 / 명시 문맥 | 목표 / 문법 | 교정 | 필요한 정보 |
|---|---|---|---|---|
| natural | The corridor looks narrow. | appropriate / natural | unchanged | none |
| target_error | The child spoke quiet. | needs_work / needs_work | The child spoke quietly. | none |
| unrelated_error | Those baskets looks heavy. | appropriate / needs_work | Those baskets look heavy. | none |
| missing_target | Birds migrate. | needs_work / natural | unchanged | none |
| default_fragment | Extremely narrow | uncertain / uncertain | withhold | message |
| supported_fragment | Very tall. / 질문 How tall is your neighbor?에 대한 답변입니다. [reply] | appropriate / natural | unchanged | none |
| interpretation_control | They are light. | appropriate / natural | unchanged | none |

### adverb

| 유형 | 입력 / 명시 문맥 | 목표 / 문법 | 교정 | 필요한 정보 |
|---|---|---|---|---|
| natural | She folded it carefully. | appropriate / natural | unchanged | none |
| target_error | The cyclist rode careful. | needs_work / needs_work | The cyclist rode carefully. | none |
| unrelated_error | He quickly opened two box. | appropriate / needs_work | He quickly opened two boxes. | none |
| missing_target | The sailor opened a box. | needs_work / natural | unchanged | none |
| default_fragment | Quite slowly | uncertain / uncertain | withhold | message |
| supported_fragment | Carefully. / 질문 How did she carry the vase?에 대한 답변입니다. [reply] | appropriate / natural | unchanged | none |
| interpretation_control | She works hard. | appropriate / natural | unchanged | none |

### determiner

| 유형 | 입력 / 명시 문맥 | 목표 / 문법 | 교정 | 필요한 정보 |
|---|---|---|---|---|
| natural | Those boxes are empty. | appropriate / natural | unchanged | none |
| target_error | This books are heavy. | needs_work / needs_work | These books are heavy. | none |
| unrelated_error | Those boxes is empty. | appropriate / needs_work | Those boxes are empty. | none |
| missing_target | Birds migrate. | needs_work / natural | unchanged | none |
| default_fragment | Those drawers | uncertain / uncertain | withhold | message |
| supported_fragment | Those boxes. / 질문 Which boxes should we open?에 대한 답변입니다. [reply] | appropriate / natural | unchanged | none |
| interpretation_control | Her book is new. | appropriate / natural | unchanged | none |

### indefinite-article

| 유형 | 입력 / 명시 문맥 | 목표 / 문법 | 교정 | 필요한 정보 |
|---|---|---|---|---|
| natural | An artist lives here. | appropriate / natural | unchanged | none |
| target_error | She found a umbrella. | needs_work / needs_work | She found an umbrella. | none |
| unrelated_error | An artist work here. | appropriate / needs_work | An artist works here. | none |
| missing_target | These dogs bark. | needs_work / natural | unchanged | none |
| default_fragment | An orange folder | uncertain / uncertain | withhold | message |
| supported_fragment | An umbrella. / 질문 What do you need?에 대한 짧은 답변입니다. [reply] | appropriate / natural | unchanged | none |
| interpretation_control | I saw an old seal. | appropriate / natural | unchanged | none |

### definite-article

| 유형 | 입력 / 명시 문맥 | 목표 / 문법 | 교정 | 필요한 정보 |
|---|---|---|---|---|
| natural | I opened a bag. The bag was empty. | appropriate / natural | unchanged | none |
| target_error | She plays the tennis. / tennis는 특정 행사나 작품 이름이 아니라 일반적인 운동 종목을 뜻합니다. | needs_work / needs_work | She plays tennis. | none |
| unrelated_error | The gate near the stairs are open. | appropriate / needs_work | The gate near the stairs is open. | none |
| missing_target | Some dogs bark. | needs_work / natural | unchanged | none |
| default_fragment | The side gate | uncertain / uncertain | withhold | message |
| supported_fragment | The blue one. / 질문 Which of these two hats is yours?에 대한 답변입니다. [reply] | appropriate / natural | unchanged | none |
| interpretation_control | The door is open. | appropriate / natural | unchanged | none |

### number

| 유형 | 입력 / 명시 문맥 | 목표 / 문법 | 교정 | 필요한 정보 |
|---|---|---|---|---|
| natural | Three birds landed. | appropriate / natural | unchanged | none |
| target_error | Two cat are sleeping. | needs_work / needs_work | Two cats are sleeping. | none |
| unrelated_error | Three candles is burning. | appropriate / needs_work | Three candles are burning. | none |
| missing_target | Those dogs bark. | needs_work / natural | unchanged | none |
| default_fragment | Nearly twelve... | uncertain / uncertain | withhold | message |
| supported_fragment | Three. / 질문 How many tickets do you want?에 대한 답변입니다. [reply] | appropriate / natural | unchanged | none |
| interpretation_control | I have two apples. | appropriate / natural | unchanged | none |

### preposition

| 유형 | 입력 / 명시 문맥 | 목표 / 문법 | 교정 | 필요한 정보 |
|---|---|---|---|---|
| natural | The keys are on the shelf. | appropriate / natural | unchanged | none |
| target_error | They are interested on jazz. | needs_work / needs_work | They are interested in jazz. | none |
| unrelated_error | The keys is on the shelf. | appropriate / needs_work | The keys are on the shelf. | none |
| missing_target | Birds migrate. | needs_work / natural | unchanged | none |
| default_fragment | Under the chair | uncertain / uncertain | withhold | message |
| supported_fragment | Under the chair. / 질문 Where is the bag?에 대한 답변입니다. [reply] | appropriate / natural | unchanged | none |
| interpretation_control | She is at the bank. | appropriate / natural | unchanged | none |

### conjunction

| 유형 | 입력 / 명시 문맥 | 목표 / 문법 | 교정 | 필요한 정보 |
|---|---|---|---|---|
| natural | I stayed home because it rained. | appropriate / natural | unchanged | none |
| target_error | Although it rained, but we walked. | needs_work / needs_work | Although it rained, we walked. / It rained, but we walked. | none |
| unrelated_error | We stayed home because the roads was icy. | appropriate / needs_work | We stayed home because the roads were icy. | none |
| missing_target | Birds migrate. | needs_work / natural | unchanged | none |
| default_fragment | Although the broth | uncertain / uncertain | withhold | relationship |
| supported_fragment | Because it rained. / 질문 Why did you stay home?에 대한 답변입니다. [reply] | appropriate / natural | unchanged | none |
| interpretation_control | I stayed home, but I was happy. | appropriate / natural | unchanged | none |

### auxiliary

| 유형 | 입력 / 명시 문맥 | 목표 / 문법 | 교정 | 필요한 정보 |
|---|---|---|---|---|
| natural | They are preparing lunch. | appropriate / natural | unchanged | none |
| target_error | They is cooking dinner. | needs_work / needs_work | They are cooking dinner. | none |
| unrelated_error | They are opening two box. | appropriate / needs_work | They are opening two boxes. | none |
| missing_target | Birds migrate. | needs_work / natural | unchanged | none |
| default_fragment | has been | uncertain / uncertain | withhold | message |
| supported_fragment | I am. / 질문 Are you cooking?에 대한 답변입니다. [reply] | appropriate / natural | unchanged | none |
| interpretation_control | They have a car. | needs_work / natural | unchanged | none |

### modal

| 유형 | 입력 / 명시 문맥 | 목표 / 문법 | 교정 | 필요한 정보 |
|---|---|---|---|---|
| natural | She can swim well. | appropriate / natural | unchanged | none |
| target_error | She can swims well. / 지금의 수영 능력을 말합니다. | needs_work / needs_work | She can swim well. | none |
| unrelated_error | She can carry two box. | appropriate / needs_work | She can carry two boxes. | none |
| missing_target | Birds migrate. | needs_work / natural | unchanged | none |
| default_fragment | might have | uncertain / uncertain | withhold | message |
| supported_fragment | I can. / 질문 Can you carry this box?에 대한 답변입니다. [reply] | appropriate / natural | unchanged | none |
| interpretation_control | You might brought a torch. | needs_work / uncertain | withhold | time |

### infinitive

| 유형 | 입력 / 명시 문맥 | 목표 / 문법 | 교정 | 필요한 정보 |
|---|---|---|---|---|
| natural | We decided to repair the fence. | appropriate / natural | unchanged | none |
| target_error | They decided to repaired the gate tomorrow. / 내일 수리 작업을 하기로 결정했다는 뜻입니다. | needs_work / needs_work | They decided to repair the gate tomorrow. | none |
| unrelated_error | They decided to repair two gate. | appropriate / needs_work | They decided to repair two gates. | none |
| missing_target | Birds migrate. | needs_work / natural | unchanged | none |
| default_fragment | To repair | uncertain / uncertain | withhold | message |
| supported_fragment | To rest. / 질문 What do you want to do?에 대한 답변입니다. [reply] | appropriate / natural | unchanged | none |
| interpretation_control | I went to school. | needs_work / natural | unchanged | none |

### exclamation

| 유형 | 입력 / 명시 문맥 | 목표 / 문법 | 교정 | 필요한 정보 |
|---|---|---|---|---|
| natural | Hooray! | appropriate / natural | unchanged | none |
| target_error | Hooray! Our house burned down. / 집이 타서 슬프고 유감스러운 반응을 나타내려는 뜻입니다. | needs_work / natural | unchanged | none |
| unrelated_error | Wow! Those boats is huge. | appropriate / needs_work | Wow! Those boats are huge. | none |
| missing_target | Birds migrate. | needs_work / natural | unchanged | none |
| default_fragment | Wow, the... | uncertain / uncertain | withhold | message |
| supported_fragment | Wow! / 큰 폭포를 보고 놀란 반응입니다. [reply] | appropriate / natural | unchanged | none |
| interpretation_control | Oh, I see. | appropriate / natural | unchanged | none |
