# T24.2·T24.3 예비 문항의 출처 보완

문항 초안에서 출처 식별자 필드가 생략된 52문항을 다시 대조했다. 실제 검토 요청에는 별도 편성 단계에서 출처를 연결해 두었다. 이전 요청과 보존된 첫 검토 요청을 합쳐 **60문항 모두 출처가 있음**을 확인했다.

검토 자료에 불필요한 출처가 붙었거나 출처가 설명하는 범위가 모호한 문항 **16개**를 골라 보완했다. 아래와 같이 문장과 직접 관련된 규칙을 제시하고, 문맥 확인이 필요한 조각에는 완성 의도를 추정할 수 없다는 경계를 유지했다.

| 확인 사례 | 출처 보완 |
| --- | --- |
| `The shelves is sturdy enough for these crates.` | 일반 일치 규칙 대신 `be`의 단수·복수 현재형 근거를 제공. [British Council](https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2/present-simple-be) |
| `A honest witness …` / `An heir …` | 관사 규칙과 각 단어의 첫소리 확인을 분리. [British Council](https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2-grammar/articles-a-an-the) · [honest](https://www.merriam-webster.com/dictionary/honest) · [heir](https://www.merriam-webster.com/dictionary/heir) |
| `Without her approval` | `her`가 명사를 꾸미는 소유 한정사라는 근거를 사용. 기존 문장 조각 자료는 유지. [한정사](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/specific-general-determiners) · [문장 조각](https://owl.purdue.edu/owl/general_writing/mechanics/sentence_fragments.html) |
| `Unusually slowly near the landing` | 문장에 등장하지 않는 `reckless` 출처를 제거하고 부사와 문장 조각 자료를 유지. |
| `Because of the lift failed …` | `because` 뒤의 절과 `because of` 뒤의 명사구를 직접 대조하는 자료를 연결. [BBC Learning English](https://downloads.bbc.co.uk/worldservice/learningenglish/grammarchallenge/pdfs/10_because_table.pdf) |

두 검토 모델용 본문 **32개**와 각각의 토큰 계산 본문을 별도 초안으로 만들었다. 나머지 **78개**와 첫 6문항의 실제 응답, 승인 대기 중인 Noor 출처 재검토 범위는 기존 지문으로 보존했다. 교정문·작성자의 판정·문항 식별자를 새 검토 입력에 추가하지 않았다. 출처 추가로 바뀐 본문은 새 입력 계산을 받아야 한다.

Node 22와 24에서 동일한 결과와 합성 통제 7개를 확인했다. 공식 자료를 확인했지만 문항의 정식 기준 답안 채택은 **0/60**이다. 실제 모델 요청과 입력 계산은 0회이며, 원장 두 사본의 지문을 대조했다. [검토 초안과 16문항의 출처 연결](../outputs/ai-quality-v147-implementation-20261106/phase146/source-backed-reference-draft.json)
