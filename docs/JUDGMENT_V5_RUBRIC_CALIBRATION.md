# v5 채점 기준 보정 · 공개 개발 자료

운영은 v142, 제품 후보는 별도 커밋36dc66f다. 이번 문서는 새 평가 전의 기준 정렬이며 과거 원점수·기대값·원장을 바꾸지 않는다. 새 실제 모델 평가나 독립 영어 전문가 검토를 수행한 자료가 아니다.

5개 차원은 목표 사용, 원문 문법, 교정의 의미 보존, 가시 설명, 문맥 보류다. 모델별30개 중27개 이상·핵심 오류0·쌍별 회귀0·필수 수집/검토 완료 조건을 그대로 유지한다. 실패·불확실·이용 불가는 고정 분모의 비통과다. 목표 라벨 불일치·앱 거절·영어 오교정을 같은 오류로 집계하지 않는다.

문법 필드는 안전한 교정을 보류하는 상태도 표현한다. `You might brought a torch.`처럼 형태 오류는 알지만 시점을 모르면 v5 제품 지시는 목표 needs_work·grammar uncertain·교정 비움·시간 질문을 요구한다. 평가에서 원문의 형태 오류를 needs_work로 짚은 사실과, 그 뒤에 선택한 교정의 시간 동등성은 별도로 본다. 이 경우 grammar 라벨 정책 일치는 보조 지표이며, 문법적으로 옳은 완료형을 선택했다는 이유만으로 올바른 교정이라고 통과시키지 않는다. 시점 보존이 불명확하면 교정 uncertain, 필요한 시간 질문을 생략하면 보류 fail이다. 다음 새 사례의 허용 라벨·조건을 결과 확인 전에 명시해야 하며 과거 사례에 이 기준을 소급하지 않는다.

| 공개 채점 예시 | 참조 판정 |
|---|---|
| 동사 book 목표에 자연스러운 명사 문장 | 목표 보완·문법 자연스러움·원문 유지가 적절 |
| to를 정확히 넣었지만 부정사 목표 라벨만 틀림 | 목표 fail, 문법·교정 pass |
| He help her.의 관련 없는 동사 수 일치 | 대명사 목표 적절, 문법·교정 보완 |
| Him helps I.의 주격/목적격 오류 | 목표와 문법 모두 보완 가능 |
| 일반 문장 작성의 Although the broth | 두 판단 보류·교정 비움·앞뒤 내용 질문 |
| 시점 없는 might brought의 안전한 보류 | 알려진 형태 오류와 교정에 필요한 시점 부족을 분리 |
| 시점 없는 might brought를 might have brought로 교정 | 원문 문법 판정 pass, 교정 uncertain, 보류 fail; 문법 오교정·critical로 단정하지 않음 |
| 가시 설명에서 goes를 과거형으로 가르침 | 설명 fail; 다른 차원을 자동 fail로 만들지 않음 |
| 숨긴 모델 이유의 오류를 앱이 검토한 설명으로 대체 | 가시 설명만 평가; 모델 자유 설명 정확도는 별도 |
| 단편을 모델이 명령문으로 만들었으나 앱이 보류 | 제품 보류 pass; 모델 자체가 보류했다는 주장 금지 |
| 앱 보호가 없는 가상 가시 명령문 창작 | 실제 발화 행위 창작이므로 critical |
| 질문 누락으로 앱이 응답을 거절 | 이용 불가·비통과; 영어 문법 fail로 만들어 집계하지 않음 |

가시 오설명·명령문 창작 두 예시는 채점용 가상 출력이다. 현재 제품의 재현된 결함으로 주장하지 않는다. 12예시 중9개는 실제36dc66f parser를 통과하고,1개는 지정한 질문 누락 코드로 거절되며,2개는 가시 출력 채점 예시다. 참조 점수는 작성자가 미리 정한 값이고 실제 모델 judge의 채점 능력은 미측정이다. 실제 기존 집계 함수에 참조 점수를 넣어5차원·critical·이용 불가가 구분되는지만 확인했다. 가상 회계 값은 메모리에만 존재하며 실제 호출·원장을 생성하지 않았다.

별도로 제품 소스를 수정하지 않고 시험용 빌드에서9개 검증 분기를 하나씩 제거했다.10개 증인 입력이 동작 또는 고정 오류 코드 차이를 검출했다. 자연문장의 빈 교정 검사는 다른 원문 변경 검사도 거절하므로, 그 변이는 안전 거절을 우회하지 않고 오류 코드가 달라진다. 이를 일반적인 우회 탐지와 구분해 기록했다. 전체 변이 공간이나 모델 정확도를 검증한 결과는 아니다.

재현:

```powershell
node .taskmaster/scripts/validate-judgment-v5-calibration.mjs
node .taskmaster/scripts/test-judgment-v5-mutations.mjs
node outputs/judgment-criteria-alignment-20261104/verify.mjs
```

세 명령 모두 exit0이다. 제품 소스·이전 유료 평가 파일은 보존했고 추가 유료 요청·운영 변경은0이다. [새 루브릭안](../.taskmaster/docs/judgment-v5-rubric-candidate.json), [12개 공개 예시](../.taskmaster/docs/judgment-v5-calibration-cases.json), [채점 기준 검증](../outputs/judgment-criteria-alignment-20261104/rubric-calibration-verification.json), [변이 검사](../outputs/judgment-criteria-alignment-20261104/mutations/results.json)를 참조한다.

새 평가에는 이 문서와 구분한 source/body/rubric/cases/collection order/financial protocol 동결, 새30사례, 새 비용 승인이 필요하다. 이전US$7 승인은 aef7d0a 평가로 종료했고 잔액은 새 후보에 이전하지 않는다. 실제 품질 통과와 기존 Site의 백업·배포·운영 확인이 남아 전체18/49는 미완료다.
