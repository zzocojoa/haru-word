# 한국어·영어 30쌍 실제 AI 검토 결과 — 2026-11-12

승인한 **AI 응답3회·입력 토큰 계산3회**를 모두 완료했다. 한국어 의도와 영어 답안30쌍을 서로 다른 두 AI가 검토해60판정을 수집했다. Sol·Terra·Astra 각각20판정이며, **30문항 모두 두 모델의 목표 사용·원문 문법·문맥 질문 종류·교정문이 일치**했다. 미측정0건, 자동 재전송0회다. 이번 실행의 보수 사용액은 **US$0.330172**다.

이 결과는 가린 언어 참조 제안의 실제 관측이다. 영어 정답률 인증이나 실제 제품 교정 생성360회·5차원 채점1,440회 완료가 아니다. 정식 참조 자격0/60·예비 생성0/360·제품 채점0/1,440·출시 보류를 유지한다. 두 AI의 일치만으로 정답을 확정하지 않는다.

## 확인된 동작

정상10개는 원문을 유지했고, 교정 필요10개는 교정을 제안했다. 한국어도 핵심 내용·수량·시점을 제공하지 못한10개에는 문맥을 물었다. 영어 원문의 문법과 한국어 의도 차이를 분리했다.

| 실제 한국어 의도 | 실제 영어 답안 | 두 AI의 관측 결과 |
| --- | --- | --- |
| 연은 다리 위쪽을 떠다녔어. | The kite drifted under the bridge. | 원문 문법 정상 유지, 의도에 맞게 The kite drifted over the bridge. 제안 |
| 타오는 나에게 조언 두 가지를 해 줬어. | Tao gave me two advices. | Tao gave me two pieces of advice. 제안 |
| 내 친구는 미라가 아니라 준에게 초대장을 보냈어. | My friend sent the invitation to Mira, but he did not send one to Jun. | 원문 문법 정상 유지, 받는 사람을 Jun·받지 않은 사람을 Mira로 교정 |
| 연필은 나리 거야. | These pencil belongs to Nari. | 한국어에서 수량이 명시되지 않았다는 판단으로 수량 질문, 교정문 미제시 |

위 내용은 두 모델의 판단을 보고한 것이며 별도의 검증된 영어 정답으로 표현하지 않는다. 문법 판단 전체는 정상13·보완 필요14·불확실3, 교정 결과는 원문 유지10·변경10·문맥 요청10이다.

작성자 초안과 다른 문항은5개다.4개는 미완성 절에 대한 질문 종류를 작성자의 relationship 대신 두 AI가 message로 선택했다. 나머지1개는 안내문의 시각을 seven으로 고치는 데 ‘not six’를 함께 보존한 표현 차이다. 두 모델 사이의 이견은 아니며 새 제품 버그5건으로 세지 않는다. 작성자의 초안이나 기존 원점수를 덮어쓰지 않았다.

## 실측 입력과 보수 정산

| 모델 | 실측 입력 토큰 | 출력 토큰 | 10% 여유 포함 보수 모델액 US$ |
| --- | ---: | ---: | ---: |
| gpt-6.1-sol | 4,860 | 2,374 | 0.039479 |
| gpt-6.1-terra | 4,883 | 1,479 | 0.014849 |
| gpt-6-astra | 5,005 | 1,855 | 0.170844 |

합계 입력14,748·출력5,708토큰이다. 입력3개를 먼저 측정했고 각25,000토큰 이하였다. Astra의 모델 최대 입력량 대신 실제5,005토큰을 사용했다. 입력25%·최대 출력·요금10% 여유로 계산한 전송 전 상한은0.801862달러로 승인1.249323달러 이하였다.

정산은 [공식 가격](https://developers.openai.com/api/docs/pricing)의 Standard 짧은 문맥 단가를 기준으로, 관측 입력 전체에 보수적인30분 캐시 쓰기 단가와 관측 출력을 적용하고10% 여유를 유지했다. 모델 상한 합계0.225172달러와 계산료 충당액0.105000달러를 더해0.330172달러다. 최종 청구서와 계산 API의 별도 단가는 미확정이며 계산료가 무료라고 단정하거나 충당액을 해제하지 않았다.

일반 원장에는0.105000달러, 전용 자금에는0.225172달러를 반영했다. 일반 가용0.366241달러와 전용 미사용0.659586달러는 구분한다. 재배정 시 조건부 합계는1.025827달러이며 이번 범위를 다시 실행할 권한이나 전체 평가 자금으로 자동 전환하지 않는다. 기존 추가35달러 한도와 원래5달러의 닫힌 잔액을 보존했다.

## 전체 문항별 관측

긴 답안과 한국어는 표에서 앞부분만 표시한다. 전문·두 원응답·작성자 차이는 `outputs/ai-quality-v147-implementation-20261106/phase171/language-case-evidence.json`에 있다. 원 API 요청·응답·영수증·전송 의도·정산은 `outputs/ai-quality-v147-bilingual-reference-runtime-20261112/`에 보관했다.

| 문항 | 목표 | 한국어 의도(긴 입력은 앞부분) | 영어 답안(긴 입력은 앞부분) | 두 AI의 교정·질문(긴 출력은 앞부분) |
| --- | --- | --- | --- | --- |
| ko-word-normal-01 | fold | 마라는 담요를 접었어. | Mara folded the blanket. | Mara folded the blanket. |
| ko-word-normal-02 | beside | 랜턴은 공구 상자 옆에 있어. | The lantern is beside the toolbox. | The lantern is beside the toolbox. |
| ko-word-normal-03 | borrow | 우리는 토요일에 쓸 텐트를 빌렸어. | We borrowed a tent for Saturday. | We borrowed a tent for Saturday. |
| ko-word-normal-04 | quiet | 대기실은 계속 조용했어. | The waiting room remained quiet. | The waiting room remained quiet. |
| ko-word-normal-05 | compare | 리나는 더 싼 램프를 가게에 반품하기 전에 영수증 두 장을 비교했어. | Rina compared the two receipts before she returned the cheaper lamp to the shop. | Rina compared the two receipts before she returned the cheaper lamp to the shop. |
| ko-word-normal-06 | avoid | 운전자는 물에 잠긴 차로를 피하고 표지판을 따라 북쪽 입구로 향했어. | The driver avoided the flooded lane and followed the signs toward the northern entrance. | The driver avoided the flooded lane and followed the signs toward the northern entrance. |
| ko-word-normal-07 | depend | 출발 시각은 조수가 바뀌기 전에 페리가 안전하게 접안할 수 있는지에 달려 있어. | The departure time depends on whether the ferry can dock safely before the tide changes. | The departure time depends on whether the ferry can dock safely before the tide changes. |
| ko-word-normal-08 | allow | 박물관은 관람객이 비상구를 막지 않는 조건으로 연필로 스케치하는 것을 허용해. | The museum allows visitors to sketch in pencil, provided that they keep the emergency exit clear. | The museum allows visitors to sketch in pencil, provided that they keep the emergency exit clear. |
| ko-word-normal-09 | distinguish | 기록관에 옛 역 북쪽 출입구를 그린 무서명 도면 두 장이 왔다. 하나는 연필 원본, 하나는 복사본이며 인쇄 날짜는 복사일이다.… | Two unsigned drawings of the northern entrance to an old railway station have arrived at a local archive. One … | Two unsigned drawings of the northern entrance to an old railway station have arrived at a local archive. One … |
| ko-word-normal-10 | restore | 엘린은 마을 극장의 나무 인형을 복원하고 있다. 인형은 수해 뒤 건조된 채 창고에서 발견됐다. 한쪽 팔의 끈과 파란 외투 단추… | Elin is restoring a wooden puppet that once belonged to the village theater. It was found dry in a storeroom a… | Elin is restoring a wooden puppet that once belonged to the village theater. It was found dry in a storeroom a… |
| ko-word-needsCorrection-01 | advice | 타오는 나에게 조언 두 가지를 해 줬어. | Tao gave me two advices. | Tao gave me two pieces of advice. |
| ko-word-needsCorrection-02 | insist | 그녀는 자기가 계산하겠다고 고집했어. | She insisted to paying the bill. | She insisted on paying the bill. |
| ko-word-needsCorrection-03 | over | 연은 다리 위쪽을 떠다녔어. | The kite drifted under the bridge. | The kite drifted over the bridge. |
| ko-word-needsCorrection-04 | carefully | 그는 유리잔들을 조심스럽게 포장했어. | He packed the glasses careful. | He packed the glasses carefully. |
| ko-word-needsCorrection-05 | offer | 엘리베이터가 층 사이에서 멈췄을 때 레나는 방문객들이 가방을 옮기는 것을 도와주겠다고 제안했어. | Lena offered helping the visitors carry their bags when the lift stopped between floors. | Lena offered to help the visitors carry their bags when the lift stopped between floors. |
| ko-word-needsCorrection-06 | friend | 내 친구는 미라가 아니라 준에게 초대장을 보냈어. | My friend sent the invitation to Mira, but he did not send one to Jun. | My friend sent the invitation to Jun, but he did not send one to Mira. |
| ko-word-needsCorrection-07 | late | 안내문에 따르면 지연된 열차는 내일 아침 여섯 시가 아니라 일곱 시에 항구에 도착할 거야. | According to the notice, the late train will reach the harbor at six tomorrow morning. | According to the notice, the late train will reach the harbor at seven, not six, tomorrow morning. |
| ko-word-needsCorrection-08 | know | 우리가 공장 연수생이었을 때부터 나는 새 관리자를 알고 지냈어. | I have knew the new manager since we were trainees at the factory. | I have known the new manager since we were trainees at the factory. |
| ko-word-needsCorrection-09 | equipment | 지난 금요일 학교가 기상 관측용 풍속 기록기와 우량계 두 장비를 받았다. 교사는 과학실에서 주문과 표지를 대조했고 학생들이 포… | Last Friday, the school received two new equipments for its weather station: a device for recording wind and a… | Last Friday, the school received two new pieces of equipment for its weather station: a device for recording w… |
| ko-word-needsCorrection-10 | require | 수요일 소극장 축제에서 담당자는 무대 뒤 자원봉사자가 번호 배지를 달도록 요구한다. 초록은 분장실, 파랑은 입구, 주황은 장비… | The coordinator requires every volunteer wearing a numbered badge while working behind the stage. The badges b… | The coordinator requires every volunteer to wear a numbered badge while working behind the stage. The badges b… |
| ko-word-insufficientContext-01 | across | 좁은 육교를 건너서 | Across the narrow footbridge | 문맥 질문: message |
| ko-word-insufficientContext-02 | fresh | 그 싱싱한 복숭아들 | Those fresh peaches | 문맥 질문: message |
| ko-word-insufficientContext-03 | arrive | 소포가 도착한다면 | If the package arrives | 문맥 질문: message |
| ko-word-insufficientContext-04 | pencil | 연필은 나리 거야. | These pencil belongs to Nari. | 문맥 질문: quantity |
| ko-word-insufficientContext-05 | rehearsal | 지휘자와 대화한 연주자들이 연습실로 돌아오기 전에 | Before the musicians return to the rehearsal room after their conversation with the conductor | 문맥 질문: message |
| ko-word-insufficientContext-06 | hinge | 그들의 여분 경첩 운반 가능성(시점은 아직 정하지 않음) | They might brought the spare hinge from the workshop across the road. | 문맥 질문: time |
| ko-word-insufficientContext-07 | bowl | 손님들이 오기 전에 나무 그릇을 싱크대 옆에 두었어. | That wooden bowls were placed beside the sink before the guests arrived. | 문맥 질문: quantity |
| ko-word-insufficientContext-08 | accurate | 동쪽 능선 너머에 있던 마을을 유난히 정확하게 묘사한 내용 | An unusually accurate description of the village that used to stand beyond the eastern ridge | 문맥 질문: message |
| ko-word-insufficientContext-09 | inventory | 도예 동아리가 축제 판매 후 재고를 확인한 상황 메모다. 대여 그릇과 판매 그릇은 분리하고 금 간 것은 판매하지 않는다. 판매… | The pottery club is checking its inventory after a weekend sale in the school hall. Bowls borrowed for serving… | 문맥 질문: message |
| ko-word-insufficientContext-10 | boundary | 학교 정원과 운동장 사이 경계 재검토의 상황 메모다. 이전 울타리와 새 지도 선이 다르고 폭풍 뒤 말뚝 하나가 사라졌다. 학생… | The school is reviewing the boundary between its garden and the neighboring playing field. A line on the new p… | 문맥 질문: message |

## 검증과 남은 작업

새 실제 요청6개와 응답6개의 지문·허용 본문·순서·응답ID·사용량·60개 분모·정산·원장 두 사본을 대조했다. 수집기31검사와 미승인 차단은 실행 전 근거로 보존한다. 승인 파일이 생긴 뒤 미승인 전용 검사를 재실행하거나 같은 수집기를 다시 실행하지 않았다. 현재 제품 소스·설정·SQL은 바뀌지 않아 단위·타입·제품 린트·빌드를 반복하지 않는다. 대시보드와 최종 보존 검사는 phase171 `closeout-verification.json`을 따른다.

다음 단계는 이 실제 언어 근거를 현재 후보의 판정·표시와 연결하고, 정식 예비평가 입력·참조·보정·비용 자격을 마무리하는 것이다. 새 문항 가족·노출 자격, 실제 앱의 동결 프롬프트 생성, 5차원 채점,1% 확인 평가, 학습 대리 지표, 운영·출시·후속 점검은 여전히 별도다. 과거 문법30·기존 점수·예산·실패/복구 근거를 유지한다. Task Master40/133의 범위를 축소하거나 완료율을 올리지 않는다.
