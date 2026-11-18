# T25.1·T34.3–4 기존 예산 안의 MC12 재검토 범위

11월 8~9일 UTC의 비용 CSV를 Default project에서 다시 내려받았다. 직전 파일과 바이트 단위로 일치했다. 11월 8일 US$11.060663, 11월 9일 당시 US$3.09927545이며 별도 입력 토큰 계산 항목은 표시되지 않았다. 공식 API 참조는 토큰 계산 응답을 정의한다. 공식 비용 제어 예시는 모델 토큰 비용을 다루며, 계산 API의 별도 요율은 이 문서들에서 확인되지 않았다. 회당 US$0.035 여유금과 기존 원장은 유지한다. [공식 토큰 계산](https://developers.openai.com/api/docs/guides/token-counting) · [공식 API 가격](https://developers.openai.com/api/docs/pricing) · [OpenAI Cookbook 비용 제어](https://developers.openai.com/cookbook/articles/per_run_spending_controller_responses_api)

공개 보정의 이전 결과 71/72에서 유일한 판정 이견은 MC12였다. `They is studying.`에 `They are studying.`을 제시하는 화면의 문법 표시가 이후 바뀌었다. 현재 화면을 Sol·Terra·Astra 각각 두 입력 순서로 검토하는 요청 여섯 개와 계산 요청 여섯 개를 최신 후보 지문에 연결했다. 이 묶음은 이전 이견이 현재 화면에서도 발생하는지 보는 진단이다. [현재 보정 근거](AI_QUALITY_V147_CALIBRATION_EVIDENCE_REUSE_20261109.md)

| 승인 검토 범위 | 요청 | 보수적 예약 상한 |
| --- | --- | ---: |
| Noor 출처 재검토 | AI 검토 2회, 입력 계산 2회 | US$0.097209 |
| MC12 현재 화면 재검토 | AI 채점 6회, 입력 계산 6회 | US$0.713932 |
| 두 범위 합계 | AI 응답 8회, 입력 계산 8회 | US$0.811141 |

두 묶음의 최대액을 예약하면 가용액 US$1.152100 중 US$0.340959가 남는다. MC12의 상한은 모델비 US$0.503932와 계산료 여유 US$0.210000을 포함한다. 요청별 실제 입력을 먼저 측정해 8,000토큰을 넘으면 생성 전 중단하며, 출력 상한은 1,024토큰이다. 같은 보수 조건에서 달라진 54건 전부의 예약 상한은 US$6.425388이다. 이 수치는 조건부 예산 상한이며 실제 청구액은 입력과 사용량을 확인한 뒤 정산한다.

Node와 Python에서 두 범위의 금액과 남는 한도를 대조했다. 지문·배정·중단선을 확인했고 입력 한도 초과 대조는 거절했다. MC12 실행기 연결 및 두 범위의 실행 승인은 대기 중이다. 새 API 호출·토큰 계산·예약은 0회다. 정식 참조·예비평가·전체 보정 상태는 그대로 유지한다. [Noor 요청 범위](AI_QUALITY_V147_SUGGEST_SOURCE_FOLLOWUP_SCOPE_20261109.md) · [MC12 요청 지문과 비용](../outputs/ai-quality-v147-implementation-20261106/phase153/scope-summary.json)
