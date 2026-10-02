# 전치사·절 범위·원문 근거를 구분하는 후속 후보

`lib/relational-evidence-feedback.ts`는 [71회 평가](ENGLISH_ACCURACY_ANNOTATED.md)에서 확인한 목적어·설명·문맥 오류에 대응하는 **평가 전용 후보**다. 학습자 API는 선택하지 않는다. [새 평가 경로·수집기·계획](ENGLISH_ACCURACY_RELATIONAL.md)을 소스에 연결했다. 준비 시점은 추가 실제 호출0·누적806회·기존 Sitesv98/환경47·평가키0·학습후보false이며, 이후 정확 CI·닫힌 게시 근거는 Git 제외 PROJECT_HANDOFF.md에서 확인한다. 기존17결함의 실제 해결과54/60 게시 기준은 미완료다.

## 무엇을 바꾸는가

| 관측 원인 | 새 계약과 검사 |
|---|---|
| 동사·형용사 문자열을 governor로 인정 | 전치사를 별도 `preposition` 부분으로 선언하고 `governorPart`가 그 부분을 참조하도록 한다. 동사/형용사 부분을 참조한 목적어는 거절한다. |
| 전치사구 전체와 내부 명사를 같은 목적어로 표시 | 전체 구는 `prepositional-phrase`의 수식어/보어, 내부 보충어는 전치사 참조를 가진 부분으로 구분한다. 전치사 뒤 배치도 허용한다. |
| 부분 부정사와 내부 명사를 두 바깥 목적어로 표시 | `infinitive-clause` 전체의 바깥 역할과 내부 `children`을 구분한다. 내부 참조는 자기 절의 배열에서만 해석하고, 부분 범위/같은 동사의 두 인접 직접목적어/잘못된 연결을 거절한다. |
| 원문에 없는 주어·의도를 추가 | 원문의 주어·서술어 근거를 고유한 전체 단위 span으로 요구한다. 주어 없는 명령문에 새 주어를 구조도로 추가하면 거절한다. 불충분 입력은 두 판정·교정·구조를 보류한다. |
| 진행형의 본동사를 보어로 표시 | 조동사/본동사/연결동사/비정형 동사를 구분하도록 지시한다. 조동사/연결동사의 직접목적어 주장은 거절하되, 실제 동명사 보어는 허용한다. |
| 원문 용법 설명과 구조도 모순·타동사 거짓 설명 | 자유 `observedUse` 문구를 받지 않고 관측 category와 어휘 gloss로 중립적인 용법 설명을 만든다. 모델의 자유 역할/타동사 주장을 덧붙이지 않는다. |
| 일반 규칙만으로 실제 오류 설명 부족 | 불가산 수량·상태 용법의 진행형·조동사 기본형·빠진 부정사 표지의 구체 원인을 선택할 수 있게 한다. 기존 교정 검증 뒤 앱의 설명으로 조합한다. |

전치사구는 전치사와 그 보충어로 구성되며, 전체 구의 역할과 내부 명사의 역할을 구분해야 한다. 전치사 보충어는 명사뿐 아니라 -ing절 등도 가능하고 전치사가 뒤에 남는 어순도 있다. [Cambridge 전치사구](https://dictionary.cambridge.org/us/grammar/british-grammar/prepositional-phrases), [전치사 위치](https://dictionary.cambridge.org/grammar/british-grammar/prepositions_2). 동사·전치사 결합 및 직접목적어와의 구별은 [복합 동사](https://dictionary.cambridge.org/us/grammar/british-grammar/phrasal-verbs-and-multi-word-verbs)와 [목적어](https://dictionary.cambridge.org/grammar/british-grammar/direct-objects)를 대조했다. 부정사·-ing형의 선택은 동사와 의미에 따른다. [동사 결합](https://dictionary.cambridge.org/us/grammar/british-grammar/infinitive-or-verb-ing).

구체 교정 설명은 상태/행동 용법을 구별하는 [British Council 상태동사](https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2/stative-verbs), 수량을 유지하는 [Cambridge advice](https://dictionary.cambridge.org/grammar/british-grammar/advice-or-advise), 조동사 뒤 기본형과 필요한 to를 구별하는 [부정사 형식](https://dictionary.cambridge.org/us/grammar/british-grammar/to-infinitive)을 대조했다. 상태동사의 진행형을 모든 용법에서 일괄 금지하거나 유효한 -ing형을 수업에 맞게 고치도록 하지 않는다.

## 계약 예시와 저장 경계

예를 들어 `We intend to repair the gate.`는 주어·intend 동사·부정사절 전체로 표시할 수 있다. 절 내부의 repair 동사와 the gate 목적어는 내부 배열의 참조로 검증하고, 화면/저장에는 부정사절 전체와 그 역할·뜻을 제공한다. root와 children의 단위는 각각 정확히 전부 일치해야 한다. children은 한 단계이며 각 배열은20부분 이하, 텍스트는 기존30,000자 한도를 따른다.

후속 wire만 새로 정의한다. 원문/교정의 문자·띄어쓰기·대소문자·아포스트로피 suffix를 기존 단위 규칙으로 묶고, 기존 compiler의 변경 앵커·교정 재구성·target·원문 보존 검사를 재사용한다. 선언한 참조와 기능을 검증한 뒤 기존 S/V/O/C/M/X 저장 형식으로 조합한다. 전치사 목적어·동사 목적어의 설명에는 실제 참조한 부분을 명시한다. 최종 피드백은 기존 저장 검증기를 다시 통과해야 한다. 과거의 거절 응답을 새 형식으로 수정해 재채점하지 않는다.

단어·문법 진도·최초 답·성적·개인 편집·revision/백업 형식·v3 읽기/저장/생성 정책을 확장하거나 재계산하지 않는다. 기존 token/annotated/evidence 계약의 기본값·schema·60개 annotated 요청 해시와 실제 판정/원장은 그대로다. 새 DB·의존성·마이그레이션은 없다.

## 검증 범위와 남은 한계

`tests/relational-evidence-feedback.test.mjs`의18검사는 전치사/동사 참조·전체 구 역할·전치사 뒤 배치·앞으로 이동한 목적어·수동태·질문·명령문·주어 부정사/for절·절의 단위와 참조·진행형과 실제 동명사 보어·타입형 용법·구체 교정 설명·안전한 진단·두 제공자 모의 전송·동결60요청 해시를 검증한다. 원문 span의 중복/부분 경계/중첩과 정상 단어 안의 같은 글자, 모든 반환 분기의2000자 저장 상한, 긴 governor와60자 뜻을 조합한140자 설명도 검사한다. 관사·수 표현·기본/법조동사를 포함한15수업의 관측 category를 표현할 수 있다. 모의 전송에는 가짜 키와 로컬 응답만 사용한다. 실제 계정·요금제·모델·키·지역·환경·배포를 바꾸거나 제공자를 호출하지 않는다.

분리 문맥 검토에서 찾은 span 경계 검사 누락·조기 반환의 저장 검증 우회·긴 참조 설명의 저장 한도 초과·단어 내부 글자를 중복으로 세던 문제를 수정했다. 모든 반환은 기존 저장 검증을 통과해야 하며, 긴 동사 참조는 화면 설명에서만 Unicode 문자가 깨지지 않게 발췌한다. 전체 뜻과 관계, 내부 참조는 보존한다.

계약 준비 커밋a51c60f는 로컬 전체677/677과 정확HEAD Node22/24 CI를 통과했다. 계약18검사는 Node22/24에서 각각 통과했다. 평가 연결 뒤 로컬 전체704/704·타입 검사·린트0오류(기존13경고)·Worker 빌드·diff를 통과했다. 같은 모델의 분리 문맥 testing/security/API/maintainability/performance/red-team/fresh adversarial 검토에서 남은 확정 finding은0이다. 평가 연결의 정확HEAD CI·닫힌 게시 근거는 Git 제외 PROJECT_HANDOFF.md에서 확인한다. adversarial의 테스트/fixture/평가 JSON은 요약 모드로 검토했으며, 독립 인간이나 다른 모델의 영어 검토를 대신하지 않는다.

형식·참조 일치만으로 품사, 한국어 뜻, 영어 문법 또는 교정의 의미 보존을 증명할 수 없다. 모델이 동사를 새로 전치사라고 잘못 선언하거나, 전치사구를 일반 목적어라고 잘못 분류하거나, 조동사 be를 연결동사로 잘못 판단하는 오류는 남을 수 있다. 관련 한계를 검사에도 명시한다. 중립 문구는 거짓 자유 설명의 경로를 줄이며 target category/gloss의 정확성은 실제 평가가 필요하다. 원문 span은 단어 존재를 증명하고 명령/문장 해석의 타당성까지 증명하지 않는다. unavailable 구조에서의 잘못된 교정도 실제 의미 평가가 필요하다.

JSON 객체는 모두 closed/required이고 anyOf로 분기하며 재귀 schema를 사용하지 않는다. 공식 문서의 JSON Schema 지원과 앱 검증 필요성을 확인했지만 실제 현재 모델의 수락·영어 효과는 미검증이다. 큰/깊은 schema가 거절될 수 있다는 Google 한계도 유지한다. [Google Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output), [Groq Structured Outputs](https://console.groq.com/docs/structured-outputs). 이것은 이전 Groq400 원인 확인이나 해결의 증거가 아니다. 키·개인 문장·provider 오류 원문은 로그에 남기지 않는다.

다음 게시 전 검증: 평가 연결의 전체 회귀·타입·린트·빌드·Node22/24 CI와 같은 모델의 분리 문맥 review를 완료한다. 기존 Sites 닫힌 게시를 준비하고, 고정60×두 제공자의 별도 호출 승인을 받은 뒤에만 실제 평가한다. 종료49행·이전94행/5슬롯을 새 후보나 재시도에 전용하지 않는다. 54/60·기준44/34 감소0·지정 핵심 오류/미평가0·기존17결함 해소·새 차원 회귀0를 낮추지 않는다.

위험도는 새 평가 계약에 중간이다. 현재 새 소스 게시0이며 Google 우선/Groq 대체·명시적인 학습 요청 정책을 유지한다. 연결 장애 시 평가만 닫고 소비 원장·가림 판정·과거 점수와 v3 지원을 유지한다. v3 기록 이후 v84로 단순 복귀하지 않는다. 실제 영어 효과·독립 인간/다른 모델 검토·실제iPhone은 미검증이다.
