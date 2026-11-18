# 한 번의 AI 응답에서 완성 교정문 받기

T6.2·T7.2에서 단어 연습 답안 `Two luggage block aisle.`을 같은 앱 경로에 다시 넣었다. 수정 전에는 `Two items of luggage block the aisle.`가 내용 변경으로 거절됐고, `Two luggage blocked the aisle.`는 저장됐다.

새 지침 `reference-v7`은 확인된 문법 오류를 한 문장에서 모두 고치고, 원문의 시제·시점·수량·부정·참여자를 유지하도록 명시한다. 요청의 구조와 저장 형식은 유지한다. 짧은 주어·동사·목적어 구조에서 교재의 동사 형태로 판단할 수 있는 경우, 수량 단위와 빠진 관사를 한꺼번에 보완하도록 앱 검사도 수정했다. 보호되는 수량·부정·시점·참여자·발화 유형 검사를 먼저 적용한다.

| 합성 교정문 | 수정판 결과 |
| --- | --- |
| `Two items of luggage block the aisle.`, `Two pieces of luggage block the aisle.` | 저장·재조회, Chromium과 WebKit 표시 |
| `Two luggage block the aisle.` | 수량 단위 오류가 남아 차단 |
| `Two luggage blocked the aisle.`, `Two items of luggage blocked the aisle.` | 시제가 바뀌어 차단 |
| `Three items of luggage block the aisle.`, `Two items of furniture block the aisle.` | 수량 또는 대상이 바뀌어 차단 |

가상 계정과 합성 응답으로 단어 API 7건을 재생했다. 각 요청에서 합성 제공자 호출은 한 번이었고, 저장 결과를 재조회하거나 같은 요청을 보내도 호출이 늘지 않았다. 단위 테스트 891건, 타입 검사·린트·빌드가 종료 코드 0이다. 기존 린트 경고 15개를 확인했다.

T26.2의 60문항용 고정 슬롯 360개를 새 후보와 다시 대조했다. 기준판 180개 본문은 동일하고, 후보 180개는 지침만 바뀌었다. 정식 예비평가의 실제 생성과 교차 채점은 각각 0/360과 0/1,440이다. 다른 문장 구조에 적용되는 단어 비교 검사는 남아 있고, 새 지침의 실제 모델 품질과 출시 자격은 확인 전이다.
