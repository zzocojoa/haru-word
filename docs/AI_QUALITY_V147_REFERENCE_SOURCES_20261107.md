# 1차 출처와 참조 검토용 통제 후보 · 2026-11-07

상태: **1차 문법 출처18개 확인·15수업 부분 연결·공개 통제 후보6개 준비**. 최종 평가 문항과 영어 정답은 확정하지 않았다. T34/4자식 review·완료 상위24/40·세부77/133을 유지한다. 기존 키 재사용은 기승인이며 실제 AI/count/키 값 읽기·쓰기·새 과금 승인/사용·배포/Git0이다.

Cambridge English Grammar Today의 공개 원문을 직접 조회했다. 브라우징 도구의403/시간초과 뒤 인증 없는 일반 HTTPS 조회로 편집 본문을 확인했다. 이용자 댓글은 출처 자료로 쓰지 않았다. 최초19조회 중4개가 실패했고,3개는 별도 재조회로 해결했다. 명사 landing 페이지는 필요한 본문 선택자가 없어 미채택했다. 성공18개만 catalog에 포함하고 최초 실패도 보존한다. 다른 기관을 조회했던 빈약한 landing 설명/댓글을 문법 정답 근거로 승격하지 않았다.

각 출처에 URL·확인시각·원본 페이지 지문·정규화한 편집 본문 지문·선택 문단 지문·25단어 이내 발췌/지문과 조회 기록 연결을 남겼다. 원문 전체는 저장하지 않는다. 지문은 당시 받아 본 내용의 연결 근거이며,출처를 독립적으로 인증하거나 미래 원문 불변을 보장하지 않는다. `source-checked`는 해당 발췌를 확인했다는 뜻이다. AI의 영어 판단 전체,수업의 모든 규칙,방언/용례나 학습 효과를 인증하는 등급이 아니다.

자료는 `.taskmaster/evaluation/ai-quality-v147/reference-source-catalog-v1.json`과 `reference-control-candidates-v1.json`이다. 기존 제품의 grammar-index.json 15개 실제ID·설명과 연결했고 제품 자료를 수정하지 않았다. 명사/동사/대명사/형용사/부사/한정사/두 관사/수사/전치사/접속사/기본 조동사/법조동사/부정사 표지/감탄사가 포함된다. 현재 발췌는 부분 근거이므로 모든 수업 규칙과 모든 조건을 포괄하지 않는다. 특히 관사 소개만으로 특정성/첫 언급 판단 전체를 뒷받침할 수 없다. 단어 영역의 뜻·품사별 출처와 실제 목표 배정은 아직 준비하지 않았다.

| 출처ID | 직접 확인한 페이지 |
| --- | --- |
| classes | [Cambridge](https://dictionary.cambridge.org/grammar/british-grammar/phrase) |
| verbs | [Cambridge](https://dictionary.cambridge.org/us/grammar/british-grammar/verbs-types?q=linking+verbs) |
| forms | [Cambridge](https://dictionary.cambridge.org/grammar/british-grammar/basic) |
| pronouns | [Cambridge](https://dictionary.cambridge.org/uk/grammar/british-grammar/pronouns-personal-i-me-you-he-it-etc) |
| adverbs | [Cambridge](https://dictionary.cambridge.org/grammar/british-grammar/adverbs-and-adverb-phrases-position) |
| determiners | [Cambridge](https://dictionary.cambridge.org/us/grammar/british-grammar/modifiers) |
| articles | [Cambridge](https://dictionary.cambridge.org/grammar/british-grammar/the) |
| numbers | [Cambridge](https://dictionary.cambridge.org/grammar/british-grammar/number) |
| prepositions | [Cambridge](https://dictionary.cambridge.org/de/grammatik/british-grammar/prepositional-phrases) |
| conjunctions | [Cambridge](https://dictionary.cambridge.org/us/grammar/british-grammar/coordinating-conjunctions) |
| progressive | [Cambridge](https://dictionary.cambridge.org/grammar/british-grammar/present-continuous-) |
| modals | [Cambridge](https://dictionary.cambridge.org/grammar/british-grammar/modality-forms) |
| infinitives | [Cambridge](https://dictionary.cambridge.org/us/grammar/british-grammar/infinitives-and-) |
| agreement | [Cambridge](https://dictionary.cambridge.org/grammar/british-grammar/subject-verb-agreement) |
| ellipsis | [Cambridge](https://dictionary.cambridge.org/grammar/british-grammar/ellipsis) |
| adjectives | [Cambridge](https://dictionary.cambridge.org/grammar/british-grammar/adjective-phrases-position) |
| interjections | [Cambridge](https://dictionary.cambridge.org/grammar/british-grammar/interjections-ouch-hooray) |
| negation | [Cambridge](https://dictionary.cambridge.org/grammar/british-grammar/negation_2) |

공개 통제 후보는 정상 주어/동사 일치,잘못된 정상 라벨,목표ID 불일치,교정 중 부정 소실,출처에 없는 주장 귀속,앞 메시지가 없는 답변의 과도한 단정6개다. 기대 실패 차원/중대 플래그는 Codex가 제안한 부분 기준이다. 실제 다른 AI의 판정·전체7차원 정답표·통제 자격은 미확정이며,기존 strict controlExpectedGrade로 바로 사용할 수 없게 표시했다. 사람 검토자는 요구하지 않는다. 잘못된 예문과 잘못된 출처 귀속은 의도적인 검토용 데이터이며 교육 규칙이 아니다.

이 후보들은 공개 개발 자료로 노출됐다. 실제 미공개60문항에 재사용하지 않고,문자열 해시뿐 아니라 구조 가족도 제외해야 한다. 표현을 바꾼 같은 틀을 새 독립 가족으로 세지 않는다. 현재 과거 개발/예비/확인 노출을 모두 포함한 완전한 목록은 아직 없다.

새로 확인한 실제 입력의 빈틈이 있다. reference-v4의 anonymousItem은 exposureInventoryHash를 withheld 지문으로 바꾸고 실제 노출 목록을 보내지 않는다. 구성한18개 검토 본문의36개 익명 항목에서 이를 확인했다. 작성 배정에도 목록 대신 지문만 들어간다. 그러므로 검토 AI가 기존 공개 문장/구조와 직접 대조했다고 가정할 수 없다. 이 차원을 미리 pass로 채우지 않는다. 공개 통제 기준의 expectedUnavailableWithoutAdditionalEvidence와 knownGap에 이를 기록했다. 이는 이미 실행된 실제 AI의 오판을 발견한 결과가 아니라,실제 평가 전 요청에 필요한 비교 근거가 빠진 것을 확인한 결과다.

Node22/24 각6개 오프라인 검사/exit0로 출처 캡처 연결·15개 trusted target/부분범위·기존 작성45본문/익명 검토18본문·공개6후보·변경/외부출처 거절·위 노출 증거 공백을 확인했다. 기존 wire/schema도 검사했고 sourcePack8KiB/본문131072바이트·출력4096 설정을 유지했다. 본문 바이트 수는 실제 토큰 수가 아니다. 실제 모델 응답을 만들거나 가상 성공 응답으로 통제 자격을 입증하지 않았다. 의도적인 거짓 출처 귀속도 구조 검사 자체는 통과하는 것을 대조해,스키마 통과가 출처 정직성의 증명이 아님을 확인했다.

관련 checker/verifier lint는 오류0·경고0/exit0다. 기존 실행기/제품547입력이 그대로여서 phase33의 실행/복구·Worker와 phase18e 제품 단위 각879/타입·린트·빌드 근거를 재사용한다. 이번에는 제품 전체 검사와 Worker를 재실행하지 않았다. 전체 관리/브라우저 최종 결과는 phase34/execution-verification.json과 progress-final.json을 따른다. 과거 원장/원점수·실패·동결 자료는 보존하고 미병합 산출물 삭제0이다.

다음 작업 점검:

- 작성/검토 모델이 실제 노출 근거를 볼 수 있게 하되,정답·모델 정체·본평가 결과를 누설하지 않는 계약과 대조 검사를 보완한다.
- 부족한 수업 규칙/단어 출처·실제 목표·가족 배정을 보완하고,6개 후보의 전체 판정 기준과 역할별 자격 검증을 사전에 확정한다.
- 위험/주장 선택·독립 가족 분포·표본/반복·효과/검정력은 미확정이다. phase29 질문은 미응답 상태이며 키 재사용 답변을 위험 승인으로 해석하지 않는다.
- count 요금/제한·별도 비용 처리와 실제 본문 토큰 상한/새 단계별 견적/금액 승인을 확정한 뒤 실제 참조 작성·AI 보정·예비/확인/일반화·학습 대리지표·운영/출시/1일/7일로 진행한다. 현재 유료 실행은 승인하지 않는다.
