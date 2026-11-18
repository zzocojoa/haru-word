# T34.3·34.4 보정 기준의 출처 검토 사전등록

2026-11-09. 공개 개발 문항의 교정·설명과 영어 근거가 사전에 정한 기대 판정을 뒷받침하는지 확인한다. 이전 실제 응답, 점수, 보정 등록부는 보존한다. 예비 평가와 출시에는 별도 진입 조건이 적용된다.

## 고정 실행 범위

- 보정 후보 `MC01`~`MC12`와 통제 2개를 Sol·Terra·Astra가 각각 검토한다. 후보의 기존 점수·기대값과 통제 표시는 각 요청에서 숨긴다. 모델별로 문항 순서와 별칭을 바꾼다.
- 통제는 `might brought`가 맞다는 거짓 설명과, 영어 사용 범위가 정해지지 않은 `speaking quiet` 사례다. 두 통제를 모두 통과한 검토만 후보의 근거로 사용한다.
- 평가 모델별로 자신을 제외한 두 모델이 기대 등급·중대 오류 표시·증거 판정에 모두 동의해야 한다. 앱의 응답 규칙은 별도로 기록한다. 모델 간 불일치와 근거 부족은 보류한다. 같은 공급자의 모델을 사용하므로 공동 편향은 검증 범위에 남는다.
- 계획 지문 `22fdd8cb551afb8e1e45b6b55450dd4e9c9368c1384743aa11cff65e07aeb149`. 요청과 비공개 기대값을 포함한 계획 파일의 SHA-256은 `f8181d953dc6ffc39724784161fa2f4495d3b841bea99e72490da49d371c0f80`이다.

## 비용 및 중단

- 추가 US$35 원장의 기존 가용액은 US$6.415846이다. 실제 입력 계산 3회와 모델 응답 최대 3회에 US$0.800052를 보수적으로 예약한다. 계산료 여유 US$0.105000을 포함한다. 계산 API 개별 청구액은 미확인 상태다.
- 세 입력 계산이 모두 요청당 18,000토큰 이하여야 모델 요청을 보낸다. 요청당 출력 상한은 4,096토큰이다. 오류 또는 상한 초과 시 중단하고 자동 재전송이나 재개를 하지 않는다.
- 평가 실행 뒤에도 보정 등록부와 예비·본평가의 진입 상태는 별도 증거로 결정한다. 이 실행은 사람 영어 검토, 학생 학습 효과, 운영 배포를 증명하지 않는다.

출처는 [공식 모델 가격](https://developers.openai.com/api/docs/pricing), [go](https://www.merriam-webster.com/dictionary/go), [own](https://www.merriam-webster.com/dictionary/own), [quiet](https://www.merriam-webster.com/dictionary/quiet), [British Council 방식 부사](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/adverbials-manner)다.
