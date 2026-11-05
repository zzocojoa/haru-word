> 2026-11-05 로컬 수정 후보: AI 클라이언트4·판단 `judgment-v6`·프롬프트 `reference-v5`, 문법 reader5(콘텐츠1–4)를 사용한다. [광역 수정 출시 준비](COMPREHENSIVE_REMEDIATION_RELEASE_READINESS_20261105.md)의 최신 판정·호환 복구 조건을 따른다. 미게시이며 새 실제 AI 평가/예산 승인은 없다. 아래 전환 당시 클라이언트2·연결 평가/Secret 등록/게시 절차는 당시 이력이고 이번 실행 권한이 아니다. master 차단 후 호환 reader/백업을 유지하는 원칙은 그대로다.

> 2026-11-04 당시: 아래 기능은 판단 v5를 포함해 기존 Site v143에 적용됐다. 당시 상태·검증 범위·복구 조건은 [v143 기록](releases/2026-11-04-openai-judgment-v143.json)을 따른다. 아래 미게시/후보 표기는 구현 당시 기록이다.

# OpenAI AI 참고 의견

2026-11-03 사전 검증 완료. [검증 기록](releases/2026-11-03-openai-migration-prepublish.json)에 단위 683개·관련 브라우저 40개·합성 실제 연결 3회의 범위와 한계를 남긴다. 운영 Secret·기존 Site 게시·활성화는 별도 절차이며 사전 검증 성공만으로 전환 완료를 보고하지 않는다.

## 사용자 동작

학습 설정의 **AI 참고 의견 모델**에서 사용 가능한 모델을 선택한다. 선택은 기존 revision 보호로 계정별 저장하며 다음 명시적인 의견 요청부터 적용한다. 요청 중에는 모델을 변경할 수 없다. 모델 변경·설정 열기·기록 조회·복원·저장 재시도는 AI 의견을 자동 생성하지 않는다. 과거 의견·원문·교정·첫 답·회상·친숙도·문법 진도·학습일을 변환하거나 재채점하지 않는다.

서버는 요청의 `expectedModelId`와 계정의 모델·학습 문서를 한 D1 batch에서 읽어 비교한다. 다르면 제공자 호출과 사용 집계 전에 409 `model_changed`를 반환한다. 요청 시작 후 다른 기기가 모델을 바꾸더라도 시작한 모델로만 처리한다. 자동 재전송·다른 모델 대체는 없다.

## 서버와 모델

| 항목 | 계약 |
|---|---|
| 전송 | 서버에서 `POST https://api.openai.com/v1/responses`, Bearer 인증 |
| 스위치 | `ai_feedback_enabled=true`일 때만 새 의견 요청 허용 |
| 키 | 서버 전용 `OPENAI_API_KEY`; 클라이언트·로그·소스 manifest에 전달하지 않음 |
| 허용 모델 | `OPENAI_ALLOWED_MODELS`의 쉼표 구분 exact ID와 `lib/ai-models.ts` 카탈로그의 교집합. 비어 있으면 모두 비활성 |
| 초기 후보 | `gpt-6.1-sol` 기본 해석, `gpt-6.1-terra`, `gpt-6-astra`. 실제 검증·운영 활성은 별도 근거 필요 |
| 매개변수 | `reasoning.effort=low`, `service_tier=default`, `store=false`, strict `text.format=json_schema`, 도구 없음 |
| 제한 | upstream 28초, client 35초, 후속 저장 25초, 출력 4,096토큰, envelope 256KiB, 최종 텍스트 30,000자·기존 필드 한도 |
| 과거 플래그 | Google/Groq 키·플래그·실험 플래그로 기존 전송을 다시 활성화할 수 없음 |

이 상한은 앱의 계약이다. 추론 토큰도 출력 토큰 예산에 포함될 수 있다. 시간 초과 후 처리·과금 여부는 불명확할 수 있어 자동 재호출하지 않는다. 응답은 raw REST `output` 배열의 assistant message/output_text에서 읽고 reasoning·refusal·incomplete를 분리한다. 실제 반환 model을 exact 매핑으로 확인한다. 첫 전환은 기존 판정 의미와 필수 structure wire 계약을 보존하며 판단 개선으로 인증하지 않는다.

표준 단기 문맥 입력/출력 단가는 100만 토큰당 Sol $2/$10, Terra $1/$5, Astra $10/$50이다(2026-11-03 확인). 캐시·다른 처리 등급·지역·세금에 따라 실제 청구액은 달라진다. [모델·매개변수](https://developers.openai.com/api/docs/guides/latest-model), [가격](https://developers.openai.com/api/docs/pricing)을 확인한다. 계정 한도·결제·플랜을 앱이 변경하지 않는다.

## 개인정보와 출처

필요한 문장·단어/뜻 또는 문법 목표만 보내며 계정 ID·이메일·전체 기록을 넣지 않는다. OpenAI API 데이터는 기본적으로 모델 학습에 사용하지 않지만, abuse monitoring 보관은 별도다. `store:false`는 응답 application state의 저장을 제어하며 제로 보관을 보장하지 않는다. 기본 안전 점검 로그는 최대 30일이며 법률·안전 사유의 예외와 별도 승인된 보관 설정이 있다. [OpenAI 데이터 정책](https://developers.openai.com/api/docs/guides/your-data)을 따른다.

신규 의견은 `provider=openai`, requestedModel, 실제 model, promptVersion, validationVersion, createdAt를 보존한다. 과거 Google/Groq 모델과 알 수 없는 과거/미래 모델은 현재 생성 카탈로그와 별도의 유한 길이 스키마로 읽는다. CSV의 기존 열과 수식 이스케이프, JSON 백업의 원문은 유지한다.

로그에는 고정 event/code·검증 단계·모델·버전·시간·정수 토큰 수·허용된 비식별 request ID만 남긴다. 키·개인 문장·AI 원문·제공자 raw 오류 메시지를 출력하지 않는다. 429만으로 분당/일일/결제 부족을 추정하지 않는다. `credit_balance_exhausted`, project/organization spend limit, organization usage limit처럼 허용한 error.code와 Retry-After만 안전하게 해석한다. [오류 코드](https://developers.openai.com/api/docs/guides/error-codes)를 따른다.

## 저장·백업·구형 화면

`settings.aiModelId`는 선택 필드이며 누락한 과거 설정을 읽기만 해도 저장하거나 revision을 올리지 않는다. 저장·조회·단어/문법 AI·전체/분할 복원 클라이언트는 `X-Study-AI-Contract: 2`를 보낸다. 새 필드를 모르는 이전 화면은 새 설정/의견을 읽거나 덮어쓰기 전에 426을 받고 입력 백업 후 새로고침한다. 새 결과를 제거한 성공 응답으로 위장하지 않는다.

`haru-words-v1` 백업 envelope, byte/count 한도, 계정 소유권, 원자 D1 batch와 revision, 분할 복원의 commit receipt를 유지한다. 과거·혼합·비활성/미래 모델 기록도 복원할 수 있다. 모델 설정을 새로 변경할 때는 현재 활성 목록을 검증하지만 과거 값을 그대로 보존하는 저장·백업 복원을 막지 않는다. DB 테이블 마이그레이션은 없다.

## 게시와 복구 체크리스트

1. 최종 코드의 전체 단위·타입·린트·공식 빌드·Chromium/WebKit 검사와 legacy egress 0 근거를 확보한다.
2. 승인한 합성 연결 검증은 후보당 1회·총 3회·출력 최대 4,096토큰·세전 US$0.50 이내다. 실패/시간 초과도 소진한 슬롯으로 기록하고 재호출하지 않는다. 연결 성공을 영어 품질 검증으로 해석하지 않는다.
3. 승인한 운영 Secret 목적지에 키를 등록한다. 기존 Site ID·DB/R2·공개 범위를 대조하고 신규/legacy AI가 모두 꺼진 환경에서 검증 소스를 먼저 게시한다.
4. legacy 차단·저장/복원 호환성을 확인한 뒤 실제 연결이 확인된 모델만 `OPENAI_ALLOWED_MODELS`에 등록하고 새 AI 스위치를 활성화한다. 환경 변경은 기존 저장 버전 게시 절차로 적용한다.
5. 장애 시 새 reader와 백업 호환성을 유지한 채 `ai_feedback_enabled=false`로 새 호출을 끈다. 새 OpenAI 기록이 생긴 뒤 모델을 모르는 v141로 단순 롤백하지 않는다. Google/Groq는 복구 수단으로 재활성화하지 않는다.

운영 학습 기록은 QA로 수정하지 않는다. WebKit 에뮬레이션은 실제 iPhone·VoiceOver 검사를 대신하지 않는다. 판단 개선은 전환 후 고정 사례·holdout·판정 기준·별도 실제 평가 예산을 먼저 확보하고 시작한다.
