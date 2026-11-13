# 실제 AI 응답으로 완성 교정·저장·표시 확인

T34.4 개발 진단에서 수정된 `reference-v7` 단어 연습 앱으로 GPT-6.1 Sol의 실제 응답을 세 건 받았다. 가상 계정으로 각각 한 번 요청했고 동일 요청을 다시 열어도 새 모델 호출이 없었다. 앱에서 세 건의 원래 판정과 교정문을 저장·재조회했다. [고정 문항과 실행 범위](AI_QUALITY_V147_COMPLETE_CORRECTION_LIVE_SCOPE_20261109.md)

| 합성 답안 | 실제 모델 결과 | 앱 화면 |
| --- | --- | --- |
| `Two luggage block aisle.` | `Two pieces of luggage block the aisle.` | 완성 교정문 표시 |
| `She avoid drive at night.` | `She avoids driving at night.` | 완성 교정문 표시 |
| `The guard does not move the luggage at night.` | 원문 그대로 | 교정 제안 없음 |

Chromium과 WebKit에서 저장 응답으로 피드백 화면을 각각 세 건씩 확인했다. 계산 요청과 모델 응답은 각각 3회다. 별도 십진 검산에서 원장 보수 사용액 US$0.122753과 일치했다. 이 값은 관측 토큰을 바탕으로 한 모델 비용 상한 US$0.017753과 입력 계산료 여유 US$0.105000을 포함한다. 추가 US$35 원장 사용액 US$33.352466, 가용액 US$1.647534, 예약액 US$0이다. [공식 모델 단가](https://developers.openai.com/api/docs/models/gpt-6.1-sol)

세 문장과 한 모델의 개발 진단이다. T26의 고정 60문항 예비평가 생성 0/360, 교차 채점 0/1,440, 출시 보류를 유지한다.
