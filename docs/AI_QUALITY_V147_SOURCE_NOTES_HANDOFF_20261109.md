# T24.2·T24.3·T26.2 실제 참조 검토 근거를 채점 요청에 연결

첫 검토에서 두 AI와 작성 기준이 일치했고 출처를 확인할 수 있었던 세 문항의 실제 응답 6개를 다시 대조했다. 당시 전송된 과제와 최신 로컬 후보의 입력이 일치하는 것을 확인한 뒤, 각 문항의 채점용 근거를 구성했다.

| 문항 | 연결한 근거 |
| --- | --- |
| `The lacquer looks glossy under the lamp.` | `glossy`가 연결동사 `looks` 뒤에서 주어를 설명한다. 연습 예시의 주제는 문법과 별도다. [British Council 연결동사](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/link-verbs) |
| `The museum guide handed she the brochure.` | 받는 사람 자리에 목적격 `her`를 사용한다. 가이드, 받는 사람, 안내 책자를 유지하는 교정이다. [British Council 인칭대명사](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/personal-pronouns) |
| `The fresco depicts a winter market.` | 벽화가 시장을 그려 보여 준다는 뜻으로 `depicts`가 자연스럽게 쓰였다. [Merriam-Webster depict](https://www.merriam-webster.com/dictionary/depict) |

세 문항의 합성 화면을 다루는 채점 요청 **72개**에 출처 요약을 연결했다. 두 판과 세 생성 모델, 다른 두 채점 모델, 두 입력 순서를 모두 보존했다. 바뀐 요청에는 새 요청·토큰 계산 지문을 붙였다. 나머지 1,368개 요청은 이전과 같고 화면이 없는 12개는 보류를 유지한다. [기존 실제 검토 결과](AI_QUALITY_V147_FIRST_REFERENCE_WAVE_RESULT_20261109.md)

잘못된 문항 ID, 다른 과제 지문, 검토자 메타데이터 포함, 출처 요약 변조, 실제 실행 전송을 막는 다섯 대조를 통과했다. 편성·전송 전 검사 7개와 변경 스크립트 린트도 통과했다.

근거를 채점 본문에 담아 볼 수 있는 로컬 재현이다. 정식 참조 채택은 0/60이며 새 AI 호출과 토큰 계산은 0회다. 첫 묶음에서 남은 출처 이견과 문맥 분류 차이는 원래 상태로 보존했다. [요청별 근거와 지문](../outputs/ai-quality-v147-implementation-20261106/phase155/source-note-evidence.json)
