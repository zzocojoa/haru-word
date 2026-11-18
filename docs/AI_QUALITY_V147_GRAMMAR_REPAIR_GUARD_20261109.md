# T6·T7 교정 검사에서 문법 표현과 내용 변경 분리

앱의 내용 검사는 비교 대상 단어의 개수와 순서를 기준으로 삼았다. 그래서 `Two luggage blocked the aisle.`를 `Two items of luggage blocked the aisle.`로 고칠 때 수량 검사 이후에도 `items`가 추가된 것을 내용 변경으로 처리했다. 두 문장을 대조해 수량과 대상이 유지되는 문법 수정으로 인정할 수 있는 조건을 추가했다. 예외는 원문과 제안에서 해당 문법 구간만 바뀌고 나머지 문장이 같은 경우에 적용한다. [수량 단위 설명](https://dictionary.cambridge.org/us/grammar/british-grammar/nouns-countable-and-uncountable?q=countable+nouns)

| 재현한 교정 | 수정 빌드의 결과 |
| --- | --- |
| `Two luggage` → `Two items of luggage` | 같은 수량과 대상의 단위 표현을 허용 |
| `This fabric feels softly` → `This fabric feels soft` | 재질을 설명하는 형용사 교정을 허용 |
| `She very enjoys sailing` → `She very much enjoys sailing` | 기존 강조 표현을 완성하는 수정 허용 |
| `the most quietest` → `the quietest` | 최상급 표지를 중복해 쓴 경우 허용 |
| `did not need no help` → `did not need any help` | 부정의 적용 범위와 문맥을 기계적으로 확정하기 어려워 기존 차단 유지 |

각 분류는 문장 전체를 암기하는 대신 수량 단위, 서술형용사, 강조 표현, 중복 최상급의 구조를 검사한다. 확인 가능한 문법 구간을 벗어나는 변화에는 기존 검사가 적용된다. 단어 차이가 있는 모든 영어 문장을 일반적으로 판단하는 단계는 남아 있다. [연결동사 설명](https://dictionary.cambridge.org/grammar/british-grammar/adjective-phrases-functions~) · [강조 표현 설명](https://dictionary.cambridge.org/us/grammar/british-grammar/much) · [이중부정의 용법](https://dictionary.cambridge.org/us/grammar/british-grammar/double-negatives-and-usage)

기존 합성 응답 15개를 같은 요청·같은 응답 지문으로 수정 빌드의 단어·문법 API에 다시 넣었다. 4문항에 해당하는 12개 교정이 모두 저장·재조회됐고, Chromium·WebKit에서 교정문 표시 8건을 확인했다. 이중부정 3개와 수량·대상·내용·발화행위 변경 대조 4개는 차단했다. 집중 36/36, 전체 889/889, 타입·린트·빌드가 종료 코드 0이다. 기존 린트 경고 15개를 확인했다. 60문항용 외부 생성 요청은 이전과 360/360 동일하다. [수정 전 합성 실행](AI_QUALITY_V147_PILOT_REVIEW_HANDOFF_20261109.md)

실제 신규 AI 호출은 0회다. 정식 예비평가의 실제 생성 0/360과 교차 채점 0/1,440 및 출시 보류를 유지한다. 기존 빌드·출처·평가 결과를 보존했다.
