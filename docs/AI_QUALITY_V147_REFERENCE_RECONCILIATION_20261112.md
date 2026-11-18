# T24.2·T24.3 기준 초안 차이·출처 보류 보완

실제 묶음 검토 뒤 남은 작성 기준 차이 18문항과 출처 보류 4문항을 대조했다. 기존 기준·원점수는 보존하면서 **18개 별도 수정안**, **출처 요약 6개**, **4문항·8판정을 위한 가린 요청 2개**를 준비했다. 새 AI 응답·입력 계산·키 읽기·예산 변경은 0회다. 실행 수집기와 새 범위 승인은 아직 없다.

## 18문항의 차이

18문항은 모두 문맥 부족 유형이다. 실제 두 AI는 17문항에서 목표 용법을 적절하다고, 1문항에서 목표 용법도 보완해야 한다고 판단했다. 문장으로서의 불완전함과 부족한 메시지는 별도로 기록했고, 완성 교정문은 18문항 모두 제시하지 않았다.

예를 들어 ‘문장을 끝낼 정보가 없다’는 판단과 ‘현재 사용한 목표 단어가 적절하다’는 판단은 함께 기록할 수 있다. 최초 기준 초안은 여러 축을 불확실로 묶었고, 실제 제안은 판단 가능한 축을 구분했다. 이 결과는 기준 수정 **제안**으로 저장했으며 동결된 60문항이나 예전 점수에 적용하지 않았다. 참조 역할·정책 채택 검토 전 정답표로 승격하지 않는다.

## 확인한 출처

| 보류 문항 | 새 자료와 확인 범위 |
| --- | --- |
| insufficientContext-03 | [British Council의 부사 강화 표현](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/intensifiers-mitigators), [Merriam-Webster unusually](https://www.merriam-webster.com/dictionary/unusually): 다른 부사를 강화하는 표현의 구조와 unusually의 부사형을 각각 연결 |
| insufficientContext-04 | [Cambridge every](https://dictionary.cambridge.org/grammar/british-grammar/every): 집단의 각 구성원을 가리키는 every와 단수 가산명사의 결합. 수량·간격 표현과 구분 |
| insufficientContext-07 | [British Council 과거완료](https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2/past-perfect): had와 과거분사의 구성 및 연결된 과거 사건의 선후 관계 |
| insufficientContext-08 | [Cambridge staff 일치](https://dictionary.cambridge.org/grammar/british-grammar/word-choice-stuff-or-staff), [Merriam-Webster staff](https://www.merriam-webster.com/dictionary/staff): 집단과 구성원 뜻, 복수 staff 및 단수·복수 일치 자료를 함께 제공 |

2026-11-12 확인했다. Cambridge 두 페이지는 직접 열기가 403이어서 공식 검색 결과의 해당 문법 설명으로 확인했음을 기록했다. 나머지 네 자료는 편집 본문을 열어 확인했다. 페이지 전체나 장문의 저작권 문장을 저장하지 않고 출처·확인 방식·범위를 단 짧은 의역을 보관했다. staff의 특정 문장을 미국 영어에서 어떻게 채택할지는 아직 판정하지 않았다.

## 새 요청과 보존

Sol·Astra에 각각 기존 보류 4문항을 제공하는 요청 2개를 만들었다. 원래 과제·문맥·모든 출처를 유지하고 위 요약만 추가했다. 전체 메시지를 추정하거나 교정을 유도하는 기대값은 본문에 넣지 않았다. 요청당 최대 출력은 2,048토큰이다. 이전 응답은 달라진 요청의 새 판정으로 재사용하지 않으며 **새 8판정은 전부 미측정**이다.

실제 결과 50/54 출처 양쪽 충분·4건 출처 보류, 54/54 언어 축 일치와 첫 6문항·과거 보정 이력은 그대로다. 정식 참조 0/60·예비 생성 0/360·채점 0/1,440, 묶음 동등성·참조 역할·노출/가족·1% 확인 평가·학습·운영·출시 관문도 유지한다. 추가 US$35 원장 및 조건부 잔액 US$1.355999를 변경하지 않았다.

## 검증

Node 22.22.2·24.22.1에서 원기준 보존, 과제·출처 대조, 과거 응답 승계 차단, 출처 변조·누락·가짜 인용·임의 완성문 차단을 각각 8/8 확인했다. 두 도구 파일의 ESLint와 준비 명령은 exit 0이다.

```powershell
node --test outputs/ai-quality-v147-implementation-20261106/phase164/test-reference-reconciliation.mjs
node node_modules/eslint/bin/eslint.js --no-ignore outputs/ai-quality-v147-implementation-20261106/phase164/prepare-reference-reconciliation.mjs outputs/ai-quality-v147-implementation-20261106/phase164/test-reference-reconciliation.mjs
```

첫 준비 검사는 재검토 출처 수를 임의로 4개로 제한해 중단됐다. 기존 응답 스키마의 인용 상한 8개를 따르도록 수정해 기존 자료를 삭제하지 않고 최대 5개 출처를 보존했다. 실패 로그는 보관한다. 제품 코드·실행 설정 변경이 없어 제품 단위·타입·빌드는 재실행하지 않았다. Task Master·대시보드 최종 검증은 phase164 `closeout-verification.json`을 따른다.

- [18개 기준 수정안](../outputs/ai-quality-v147-implementation-20261106/phase164/reference-reconciliation.json)
- [확인한 출처 요약·방식·범위](../outputs/ai-quality-v147-implementation-20261106/phase164/checked-source-pack.json)
- [미실행 요청 2개·8판정](../outputs/ai-quality-v147-implementation-20261106/phase164/source-patch-plan.json)

| 정리 범위 | 분류 | 처리 | 근거 | 검증 |
| --- | --- | --- | --- | --- |
| 실제 응답·기존 기준·점수·원장·승인 | 평가·예산 근거 | 보관 | 원점수·단일 소비·재현 | 원본 지문 보존 |
| 기준 수정안·출처 요약·새 요청·검사 | 후속 검증 준비 | 보관 | 기준 차이와 출처 보류 해결 | Node 22/24 각 8/8·린트 |
| work·outputs·브랜치 | 진행 중 자료 | 정리 보류 | 후속 검토·병합 전 | 삭제 0 |
