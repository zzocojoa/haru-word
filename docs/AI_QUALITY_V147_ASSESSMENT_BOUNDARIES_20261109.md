# T34.3·34.4 문법 판정·교정 문맥·과제 형식 분리

2026-11-09. 이전 세 모델의 이견 `MC02`, `MC05`, `MC08`을 바탕으로 평가 코드에 기준 v8 후보를 구현했다. v7의 영어 뜻·품사 판정과 중대 오류 정의를 이어받는다. 새 기준은 제안한 교정의 문맥 `repairContext`와 교정문이 따라야 할 명시적 절 형식 `assignmentForm`을 따로 받는다.

- 원문에 문법 오류가 있다는 판단이 맞아도, 교정문이 주어지지 않은 시점을 정하면 교정은 불확실로 평가할 수 있다. 과거 가능성을 나타내는 `might have`의 사용과 화자가 의도한 시점을 따로 판단한다. [British Council 과거 추측 표현](https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2/modals-deductions-about-past)
- `to we`를 맞다고 설명한 경우 실제로 표시된 문법 설명을 평가한다. 바꾼 문장이 화면에 없으면 교정문에 필요한 문맥은 `not_applicable`로 기록한다. [British Council 인칭대명사](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/personal-pronouns)
- 동일한 `Close the gate.`는 명령문을 요구한 과제에는 맞고 평서문을 요구한 과제에는 어긋난다. 과제 위반은 교정 점수에 반영하고 원문 문법 판정은 그대로 평가한다. [Cambridge 절의 종류](https://dictionary.cambridge.org/us/grammar/british-grammar/clause), [British Council 명령문 설명](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/personal-pronouns)

## 대조 범위

이전 은행과 문장 문자열이 다른 세 대조군을 구성했다. 과거 시점 명시 여부, 잘못된 목적격 설명과 최소 교정, 허용 절 형식의 차이로 각각 2개 사례를 만들었다. 사례 6개 × 모델 3개 × 기준 2개로 36개 요청을 고정했다. 동일 모델의 v7·v8 쌍은 입력·교정·출처·순서·출력 상한이 같으며 채점 지시와 응답 형식만 다르다. 기대값은 요청 밖에 둔다. 세 대조군은 공개 개발 자료이며, 확인 평가의 미공개 표본 자격은 없다.

후속 실제 비교에서 후보 18개 모두가 사전 기준 및 추가 판정에 일치하고, 기존 기준보다 1개 이상 개선해야 제한된 범위의 개선으로 기록한다. 보류·누락·오류를 성공에 포함하지 않는다. 기존 채점 결과, 정식 보정 등록부와 본평가 승인 상태는 해당 결과에 따로 유지한다.

계획 지문 `11a2c9d3deeb21091aab5dc17309325db104cd07b5ee452602803a7dca1ac029`. 후보 기준 지문 `bbb3f66845b43403d7b404e7c7b3df86e119ec448c066150fdfb68fe6062d5f0`. 요청당 입력 계산 8,000토큰, 출력 1,024토큰의 보수 상한은 US$4.283592다. 입력 계산료 여유 US$1.260000을 포함한다. 이 계산은 이전 검증 단가를 사용한 준비 상한이며, 실제 전송 전에 당시 단가와 입력량을 확인한다.

## 확인 범위

가상 응답 검사에서 판정 축 분리, 예전 요청과 같은 증거, 출력 상한, 불완전한 분모, 형식 변조, 서로 모순되는 판정, 회귀 보고를 확인한다. 실제 응답·입력 계산·키 읽기·예산 예약은 0건이다. 제품 교정 품질, 전체 본평가, 운영 및 출시 자격은 후속 검증 범위다.
