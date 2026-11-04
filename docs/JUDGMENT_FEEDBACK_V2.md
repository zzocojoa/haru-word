> 2026-11-04 현재: 아래 기능은 판단 v5를 포함해 기존 Site v143에 적용됐다. 현재 상태·검증 범위·복구 조건은 [v143 기록](releases/2026-11-04-openai-judgment-v143.json)을 따른다. 아래 미게시/후보 표기는 구현 당시 기록이다.

# 판단 전용 AI 의견 후보 v2

2026-11-03. 판단 개선 후보의 구현 문서다. 운영 v142는 기존 계약을 사용하며 이 후보는 기본 비활성이다. 고정 품질 gate와 최종 회귀를 통과하기 전 `feedback_judgment_enabled`를 켜지 않는다. 부분 기준선이나 합성 검사 통과를 영어 정확도 개선으로 보고하지 않는다.

## 판단과 교정

신규 wire는 `meaningUsage`, `grammar`, `correctedSentence`, `targetReason`, `grammarReason`, `correctionReason`, `contextNeeded`만 요구한다. 표시하지 않는 structure·성분 역할·번역은 생성하지 않는다. 목표 적합성, 원문 문법, 교정 이유, 필요한 추가 문맥을 분리하며 이유는 한국어로 짧게 쓴다.

| 상황 | 계약 |
|---|---|
| 원문 문법 natural | 목표 단어가 없어도 원문을 그대로 반복 |
| 원문 문법 uncertain | 교정은 빈 문자열, 필요한 문맥 명시 |
| 목표 uncertain + 문법 needs_work | 의도를 만들지 않고 교정 보류 |
| 두 판단이 명확하고 문법 needs_work | 원문과 다른 최소 교정 및 교정 이유 필수 |
| 어느 판단이든 uncertain | 최소한의 추가 문맥 필수 |
| 판단이 명확함 | 추가 문맥 질문 없음 |

예를 들어 목표 단어가 없는 `She sings well.`의 문법을 틀렸다고 하거나, 목표를 넣기 위해 새 문장으로 바꾸지 않는다. `She sing well.`의 동사 형태는 최소 교정할 수 있다. `A blue notebook`에서 임의의 소유자/행동을 만들어 교정하지 않는다. 완전한 대명사 문장에서 실제 인물의 이름을 요구하지 않는다.

wire 이유는 화면에 보이는 `explanation`의 목표/문법/교정/추가 문맥 문단으로 합친다. 저장은 기존 4개 의견 필드와 OpenAI 출처·실제 모델·요청 모델·`reference-v2`/`judgment-v2` 버전·시각을 사용한다. 새 저장 필드·백업 envelope·SQL 마이그레이션·의존성을 추가하지 않는다.

## 유효성 검사와 한계

- natural의 원문 동일성, uncertain의 교정 보류, needs_work의 실제 변경, 이유/문맥의 유무와 유한 길이를 검사한다. 모순은 판정 값을 고쳐 통과시키지 않고 기존 안전한 형식 오류로 거절한다.
- 변경한 교정에서 부정 표지 수, 숫자/0~20의 단순 수량, 선별한 시간/초점 부사, give/lend/tell의 짧은 전달 구문 행위자·대상을 대조한다. 숫자 표기를 바꾸거나 문체를 다시 쓰지 않도록 요청한다.
- 구조 없는 v2의 실제 표시 설명에서도 선별한 짧은 진행형의 -ing를 목적어/보어/명사 등으로 단정하거나 arrive at/in의 전치사구 전체를 직접목적어로 단정하는 모순을 보류한다. 잘못된 분석을 명시적으로 부정하는 설명과 전치사 내부 명사구의 목적어 분석은 허용한다.
- v1 및 과거 Google/Groq 의견은 기존 structure 안전 검사와 원형을 유지한다. 새 검증 조건을 저장 스키마에 넣어 과거 기록을 무효화하거나 재채점하지 않는다.

이는 제한된 모순 검사이며 일반 문법·의미 동등성·모든 역할/시제 오류를 판별하지 못한다. 복잡한 수량 표현, 전달 구문 밖의 참여자 관계, 설명의 중의성에는 한계가 있다. 보수적인 거절로 올바른 대안이 보류될 수도 있다. 파서 통과, 생성 실패 감소, 영어 판단 통과율과 표시 가능률은 각각 따로 평가한다.

## 활성화와 호환 복구

- 단어·문법 API는 `feedback_judgment_enabled === 'true'`일 때만 새 계약/프롬프트를 사용한다. 누락·false·다른 값에서는 v142의 필수 structure 계약과 정확한 `reference-v1`/`structured-v1` 메타데이터를 사용한다.
- `generateOpenAiFeedback`는 평가 대상인 v2 함수이고, `generateStructuredOpenAiFeedback`는 v142 호환 함수다. 이들은 같은 Responses 전송·28초·4,096토큰·store false·단일 요청을 공유한다. 계약 실패 시 다른 계약/모델/제공자로 재호출하지 않는다.
- 과거 평가 요청을 구성하는 Google export와 영어 평가 helper는 v142/과거 프롬프트를 명시적으로 참조한다. 기존 480회 원장·요청 해시·점수는 바꾸지 않는다.
- 현재 총 US$5 한도 변경으로 기준선은 부분 수집 후 중단됐다. 새 후보 동결 전 holdout 채점 결과를 열지 않는다. 전체 90사례·3모델·기준선/후보 품질 gate를 부분 진단으로 대체하지 않으며 미실측이면 후보를 켜지 않는다.
- 이상 시 reader를 유지하고 새 판단 스위치를 false로 돌린다. 필요하면 AI master를 끄고 수동 학습을 유지한다. 사용자 기록·초안·성적·백업을 지우지 않고 Google/Groq 호출을 다시 켜지 않는다.

## 검증 근거

```powershell
node --experimental-strip-types --test tests/judgment-feedback.test.mjs tests/judgment-api.test.mjs
node --experimental-strip-types --test tests/ai-contract.test.mjs tests/feedback-safety.test.mjs
npm test
npm run typecheck
npm run lint
```

신규 검사는 합성 응답만 사용한다. 세 모델의 strict JSON·버전·단일 요청, 실제 단어/문법 라우트의 스위치·v1~v4 목표·422 보류·계약 불일치 거절, 정상 대조군을 확인한다. 혼합 저장/조회/전체·분할 복원에는 structure 있는 v1과 structure 없는 v2의 단어·문법 의견을 함께 포함한다. 실제 API 영어 평가·브라우저/실제 iPhone·최종 출시 판정은 별도 단계다. 실행 결과는 기본 작업 폴더의 구현 기록과 이 checkout의 `outputs/judgment-*.log`를 따른다.
