# T6.2·T7.3 수량 단위 교정 후속

기존 동결 후보에서 `Two luggage block aisle.`의 교정은 통과했다. 동사 일치를 함께 고치거나 과거형을 유지하면서 관사를 넣으면, 같은 짧은 구조에서도 완성 교정문이 거절됐다. 목적지를 그대로 둔 채 수량 단위만 넣는 경우도 거절됐다. 수정 전후 빌드에서 같은 합성 응답을 재생해 비교했다.

| 원문 | 수정판에 표시한 교정문 |
| --- | --- |
| `One luggage block aisle.` | `One piece of luggage blocks the aisle.` |
| `Two luggage blocks aisle.` | `Two pieces of luggage block the aisle.` |
| `Two luggage blocked aisle.` | `Two pieces of luggage blocked the aisle.` |
| `I brought two luggage to the airport.` | `I brought two pieces of luggage to the airport.` |

수량 단위가 필요한 짧은 주어·동사·목적어 구조에서 교재에 있는 동사의 현재형 일치를 보완할 수 있게 했다. 확인된 규칙 과거형은 그대로 유지한다. 목적지를 나타내는 전치사구 앞에서는 나머지 문구가 그대로인 수량 단위 삽입을 수용한다. 수량, 시제, 목적지 변경, 합성명사 오해, 단위·동사 일치 오류가 남은 대조군 6개는 차단했다.

단어 연습의 기존 사례와 새 네 사례를 Chromium·WebKit에서 각각 확인했다. 열 번 모두 가상 계정의 답안과 완성 교정문을 저장했고, 다시 열 때 추가 모델 요청 없이 같은 교정문이 표시됐다. 단위 검사 898개, 타입 검사, 빌드, 린트가 종료 코드 0이었다. 린트는 기존 경고 15개를 냈다. 첫 브라우저 검사에서 실패 영수증 조회를 200으로 가정한 테스트를 실제 계약인 502로 바로잡았고, 원래 실패 로그도 보존했다.

이 로컬 빌드는 T24.1에서 기존 동결 후보와 구분한다. 새 빌드를 정식 예비평가에 연결하려면 후보 재동결과 요청·화면 대조가 필요하다. 이번 실제 AI 호출과 토큰 계산은 0회이며, 이전 동결 자료와 원장은 지문으로 보존을 확인했다. [로컬 대조 근거](../outputs/ai-quality-v147-implementation-20261106/phase143/count-repair-audit.json)
