# 한 번의 AI 응답에서 완성 교정문 받기 · 실제 개발 진단

T34.4에서 `reference-v7`을 사용하는 로컬 단어 연습 앱과 GPT-6.1 Sol의 실제 응답을 연결한다. 가상 계정의 합성 답안 세 개를 각각 한 번 전송한다. 합성 응답으로 같은 요청을 세 번 확인했고 저장·재조회도 세 건 일치했다.

| 목표 단어 | 합성 답안 | 기대 결과 |
| --- | --- | --- |
| luggage | `Two luggage block aisle.` | `Two items of luggage block the aisle.` 또는 `Two pieces of luggage block the aisle.` |
| avoid | `She avoid drive at night.` | `She avoids driving at night.` |
| luggage | `The guard does not move the luggage at night.` | 원문 그대로, 화면에 교정 제안 없음 |

의미와 문법을 보존한 다른 교정은 별도로 기록한다. 모델 원문, 앱 저장·재조회, 화면을 구분하며, 재시도나 재전송 없이 실패를 보존한다. 고정 요청 지문은 `5dfdb2b6c76f30aeb0b528c182393927deabb015c49c91d8389b8ad35ffbdc19`이다.

기존 추가 US$35 평가 승인 범위 안에서 실행 전 일반 가용액은 US$1.770287이다. 실제 모델 응답 최대 3회와 입력 토큰 계산 최대 3회를 예약한다. 상한 **US$0.302043**에는 입력 계산료 여유 US$0.105000이 포함된다. 요청별 계산값이 6,000 이하인지 먼저 확인하고 제품 출력 한도 4,096과 보수 여유를 적용한다. 실제 청구액은 사용량 원장과 구분한다. [공식 모델 단가](https://developers.openai.com/api/docs/models/gpt-6.1-sol)

이 개발 진단은 고정 60문항 예비평가와 별도로 기록한다.
