# 무료 계정 성분 분석 후보 평가 · 2026-10-01

**게시 보류. Google 44/60, Groq 34/60으로 제공자별 54/60 기준을 충족하지 못했다.** 성분별 단어 수로 문구를 복원하는 후보는 기존 Sites v90에 준비했지만 `feedback_chunked_enabled`는 누락/false다. 기존 Google 우선·Groq 대체와 학습 요청을 유지한다. 영어 정확도 개선 전체가 완료된 것은 아니다.

사용자가 두 계정 모두 무료 요금제라고 확인하고 무료 호출을 승인해 별도 120회를 실행했다. 계정 콘솔·청구서는 독립 확인하지 않았다. 이번에 HTTP·한도·결제·지역/선행 조건 오류는 관찰되지 않았으며 요금제·결제·키·지역은 변경하지 않았다. 이 결과를 독립적인 무과금 인증으로 표현하지 않는다. 과거 360회 원장은 그대로이며 누적 **480회**로 이번 승인 상한을 모두 사용했다. 재시도·fallback·CI 실제 호출은 0회다. 원장을 초기화하거나 추가 호출하지 않는다.

## 재현 자료와 실행

- 수집: **2026-10-01 10:23:46–10:38:00 KST** (`01:23:46.916Z–01:38:00.118Z`). 작성된 동일 60문장 × Google/Groq 직접 호출이다. 개인 학습 문장·답변·운영 학습 DB는 평가에 사용하지 않았다.
- 프로필 `chunked-free-v1`, 소스 `718870e21b453c484387814f879ed7685bfd3048`, 기존 Sites **v90**, 수집 당시 환경 revision **23**.
- Google `gemini-3.1-flash-lite`, Groq `openai/gpt-oss-120b`. 운영과 공통 요청 생성·직접 제공자 전송을 재사용했으며 비교 실행에는 대체 호출을 쓰지 않았다.
- 입력·모델·프롬프트·검증 정책 `chunk-count-v1+original-judgment-v1`·소스를 고정하고 HTTP 전에 슬롯을 기록했다. 실패도 호출 수에 포함했다. 완료 원장 복구는 새 HTTP 요청을 보내지 않는다.
- 120행과 차원별 판정·모델·요청 해시·안전한 실패 코드·종료 근거는 [평가 데이터](data/evaluations/english-accuracy-2026-10-01-chunked-free.json)에 있다. 원장·가림 매핑·검토 메모는 Git 제외 `.sites-runtime/english-accuracy/chunked-free-v1/`에 보존한다. 후보 계약과 실행/복구 절차는 [CHUNKED_FEEDBACK.md](CHUNKED_FEEDBACK.md)를 따른다.

| 고정 자료 | SHA-256 |
|---|---|
| 기존 fixture byte | `02a84a0c86252524e2627cbf7cd69f8d725ade70ebbf107c8aed986eabcd8e54` |
| fixture canonical LF | `76e3a339ff9562633c47c3a7b143eac5224fd108f4ee227b3ddc334401f4518a` |
| 과거 240회 | `0e6a30364b116d5eae393c298738211a3773a78336923369546c628fd9e91aa6` |
| 원문 우선 추가 120회 | `63e648f649d9af4ddadbe8bd5d48e7c33cc35324ba4dce6c8ead3e8cc597253d` |
| 부모 합계 360회 | `9739a780b434369ecdf066c61d34234d958636e71e3c1d5bea19c6190aeac5f1` |
| 이번 120회 시도 | `ef06b87c27d9a222a42a9fd13d7329a970abbcf8e992caac06290568072a5494` |
| 이번 제공자 가림 자료 | `c32c622cbc31fd8636332ea979d5d4f2870799a061c3c9e734ad6894a320c1cc` |
| 단어 프롬프트 | `02c51da26752e08ad6de1533f5a338c6f4de7ecf4c18b7a77b85a339f10b7f9b` |
| 문법 프롬프트 | `649948ee5c596d2169e921152e9adf9c4db35b158c032c18f8d84c0bf9c49f90` |

## 결과와 게시 기준

전체 120회 중 유효 응답 **95**, 종합 통과 **78**, 유효 응답의 언어 판정 실패 **17**, 출력 검증 거절 **25**다. 한 응답의 여러 차원이 실패할 수 있으므로 차원별 실패 수를 더해 언어 실패 수로 쓰지 않는다. HTTP 실패·제공자 중단·미호출은 모두 0이다.

| 제공자 | 호출 | 유효 응답 | 종합 통과 | 언어 실패 | 출력 거절 |
|---|---:|---:|---:|---:|---:|
| Google | 60 | 51 | **44/60** | 7 | 9 |
| Groq | 60 | 44 | **34/60** | 10 | 16 |

각 칸은 **통과 / 실패 / 평가 불가**다. 출력 거절을 정확한 영어 응답으로 간주하지 않는다.

| 제공자 | 뜻·목표 사용 | 문법·설명 | 교정·의미 보존 | 성분 분석 |
|---|---|---|---|---|
| Google | 48 / 3 / 9 | 49 / 2 / 9 | 50 / 1 / 9 | 47 / 4 / 9 |
| Groq | 41 / 3 / 16 | 42 / 2 / 16 | 44 / 0 / 16 | 38 / 6 / 16 |

Google의 출력 거절 9건은 모두 `structure/chunk_count`다. Groq는 `fields/wire_fields` 15건, `structure/chunk_count` 1건이다. 모두 제공자 HTTP200 이후 검증 거절이며 `judgment` 거절은 0이다. 안전 enum만 보존하여 개별 필드·타입·길이 중 무엇이 문제였는지는 확정할 수 없다. 원문 오류 본문·헤더·요청 ID·비밀을 추가 기록하지 않았다.

지정 핵심 사례는 제공자별 32개, 합계 64개다. Google 25개·Groq 29개를 평가해 사전 지정한 비문 승인/의미 반전/주어·목적어 뒤바뀜 유형 오류는 0개를 관찰했다. **10개는 출력 거절로 평가하지 못했으며 평가한 54개 중 14개도 다른 차원에서 종합 실패했다.** 따라서 핵심 문제가 전부 해결되었다고 주장하지 않는다. 아래 word-37의 불충분 입력 승인은 사전 지정 핵심에 포함되지 않아 이 0건 집계에 들어가지 않는다.

| 게시 조건 | Google | Groq |
|---|---|---|
| 종합 54/60 이상 | 실패: 44 | 실패: 34 |
| 지정 핵심 유형 오류 0 | 관찰한 25개에서 0 | 관찰한 29개에서 0 |
| 지정 핵심 전부 평가 가능 | 실패: 7개 불가 | 실패: 3개 불가 |
| 최초 기준 25/18 대비 통과 감소 0 | 충족 | 충족 |
| 최종 gate | **보류** | **보류** |

직전 원문 우선 후보의 Google 25/60·Groq 28/60, 유효 64개에서 이번 44/60·34/60, 유효 95개로 증가했다. 직전 HTTP 실패 25개가 이번 0개이며 출력 거절은 31개에서 25개다. 프롬프트·wire 계약·호출 간격·실행 시간이 함께 달라졌고 과거 HTTP400 원인은 미확정이므로 증가분을 단어 수 복원 하나의 효과로 해석하지 않는다.

이전 세 핵심 사례를 다시 보면 Google grammar-47(관사)·Groq word-30(`readed`)은 종합 통과했다. Google grammar-45는 유효한 `I am now writing.`을 보존했지만 `writing`을 시간 부사로 표시하여 성분 분석은 실패했다. 세 문제 모두 해결됐다는 결론은 낼 수 없다. `now`가 첫 조동사 뒤에 올 수 있다는 기준은 그대로다. [Cambridge: now](https://dictionary.cambridge.org/us/grammar/british-grammar/now).

## 남은 언어 판정 실패 17개

아래는 제공자 매핑을 복원한 뒤의 표시다. 기준 판정은 매핑 복원 전에 저장했다. 뜻/목표 라벨 불일치는 허용된 평가 계약의 실패이며 모든 항목을 영어 문법 자체의 오류로 동일시하지 않는다.

| 제공자 · 가림 ID · 사례 | 실패 차원 | 실제 문제 |
|---|---|---|
| Google B060 · word-08 | 성분 | `Her present`를 주어로 묶지 않고 `present`를 과거 동사로 설명하고 `was a book`을 보어로 표시한다. |
| Google B088 · word-26 | 성분 | `am interested`를 동사, `science`를 보어로 나눠 `interested`의 형용사 보어 기능을 제대로 설명하지 못한다. |
| Google B040 · word-37 | 네 차원 모두 | 불충분한 `object or subject`를 appropriate/natural로 승인하고 교정문·구조를 생성한다. 두 uncertain과 교정 보류가 기준이다. |
| Google B061 · grammar-45 | 성분 | `am now`를 be+분사라고 하고 `writing`을 시간 부사로 설명한다. |
| Google B068 · grammar-51 | 뜻·목표 | 대명사 기능은 드러나는데 목표 사용까지 needs_work로 판정한다. `He likes her.` 교정 자체는 통과다. |
| Google B022 · grammar-55 | 뜻·목표 | 부정사 기능을 확인하면서 목표 사용 라벨은 고정 기준 appropriate 대신 needs_work다. 교정·성분은 통과다. |
| Google B062 · grammar-56 | 문법 설명 | 둘 이상이면 명사에 -s/-es를 붙인다고 예외 없는 규칙으로 설명한다. `books` 교정은 통과다. |
| Groq B087 · word-22 | 문법 설명 | `bought`로 제대로 고치지만 buy의 규칙 과거형이라고 설명한다. |
| Groq B078 · word-25 | 뜻·목표 | 듣는 의미는 드러나는데 뜻 사용을 needs_work로 판정한다. 누락된 `to`와 교정은 문법 차원이며 성분은 통과다. |
| Groq B052 · word-26 | 성분 | be+interested+in을 모두 동사로 묶고 science를 목적어로 표시해 형용사 보어 기능을 잃는다. |
| Groq B093 · word-27 | 성분 | 목적지 전치사구 `to the park` 전체를 목적어로 표시한다. |
| Groq B053 · word-32 | 성분 | 장소 전치사구 `at the station` 전체를 arrive의 목적어로 표시한다. |
| Groq B073 · grammar-42 | 문법·성분 | `to work` 전체를 목적어라고 표시하고 본문 설명에서도 같은 혼동을 반복한다. |
| Groq B117 · grammar-48 | 성분 | `under the chair`를 장소 보어라고 설명하면서 O로 표시한다. |
| Groq B018 · grammar-49 | 성분 | `Was the`를 주어, `window broken`을 동사로 잘라 실제 주어 경계를 잃는다. 주어/목적어 반전 사례로 집계하지는 않는다. |
| Groq B054 · grammar-51 | 뜻·목표 | Google과 같은 대명사 목표 라벨 불일치다. 교정은 통과다. |
| Groq B114 · grammar-57 | 뜻·목표 | `Music`이 명사라는 사실만으로 문맥·목표가 불충분한 입력의 사용을 appropriate로 확정한다. 나머지 판단 보류는 통과다. |

명사 복수에는 불규칙형·동형 복수가 있으며 buy–bought도 불규칙이다. [Cambridge: nouns form](https://dictionary.cambridge.org/us/grammar/british-grammar/nouns-form), [irregular verbs](https://dictionary.cambridge.org/us/grammar/british-grammar/table-of-irregular-). 형용사구의 보어 기능과 실제 명사구/주어 경계를 기준으로 성분 설명을 검토했다. [Cambridge: adjective phrases](https://dictionary.cambridge.org/us/grammar/british-grammar/adjective-phrases), [subject complements](https://dictionary.cambridge.org/us/grammar/british-grammar/parts-of-speech), [subjects](https://dictionary.cambridge.org/grammar/british-grammar/subjects?q=Subjects).

고정 기준은 전치사 목적어라는 한정 설명과 전치사 동사를 하나의 V로 묶는 분석을 인정한다. 따라서 `listens to`+`music` 같은 통과 분석을 새 기준으로 소급 거절하지 않았다. 목적지/장소 전치사구 전체를 O라고 붙이는 것은 구분했다. [Cambridge: prepositional verbs](https://dictionary.cambridge.org/grammar/british-grammar/prepositional-verbs).

## 판정·검증의 한계

root 작성자가 제공자·모델·시간·시도 번호를 가린 개별 응답 120행을 모두 읽고 유효 95개의 네 차원을 판정했다. 제공자별 집계된 실패 수는 판정 전에 알고 있었다. 가림 판정을 저장한 다음 매핑과 통계를 복원했다. 독립 인간 영어 전문가나 다른 모델의 판정이 아니다. 영어 문자열 하나와의 일치로 채점하지 않았으며 형태가 다른 유효 교정과 허용 성분 분석을 인정했다.

fixture와 과거 판정/결과는 변경하지 않았다. 기존 grammar-52/54/56 목표 라벨 기준에 적힌 한계는 그대로 공개한다. appropriate/needs_work를 함께 인정하는 민감도 계산도 이번 44/34와 같았으며 게시 판정에 사용하지 않았다. 공식 근거는 직접 열기에서 접근 거절된 경우 같은 Cambridge 페이지의 검색 색인 본문으로 확인했다. 이 소규모 합성 평가를 전체 영어 정확도 인증으로 표현하지 않는다.

회귀 검사는 단어 수 복원·범위 거절·원문 판단 보호·공통 요청과 실제 두 POST의 플래그 전달·API 응답 형식 보존, 실패 슬롯/중단/잠금/해시/완료 복구와 공개 데이터의 집계/gate/가림 해시/종료 근거를 확인한다. HTTP429/402 비JSON 중단을 검토 중 보완했다. 수집 종료 뒤 Google 상위402가 API503으로 포장돼 중단을 놓칠 수 있는 도구 결함도 수정하고 evaluator→API→collector 합성 회귀로 검증했다. **이번 수집에서 402는 발생하지 않았고 이 수정은 당시 원장·요청 해시·게시된 Worker를 바꾸지 않는다.** 검토는 같은 모델의 분리된 보안/API·검사·유지보수/성능·Red Team 문맥을 사용했으며 인간/cross-model 인증은 아니다.

최종 로컬 전체 **480/480**, 타입·Worker 빌드·diff 검사를 통과했다. 린트 오류0·기존 경고13이며 결과 데이터4검사와 수집기12검사를 포함한다. 최종 HEAD Node22/24 CI 결과는 PR에 기록한다. UI·저장 경로는 변경하지 않아 이번에 브라우저 QA를 다시 수행하지 않았다. 실제 iPhone 청취·VoiceOver·독립 인간 영어 교열은 미검증이다.

## 평가 종료와 호환 롤백

1. 만료를 과거로 설정한 **환경24**를 같은 v90으로 게시해 native succeeded를 확인했다. 이전 평가 토큰을 포함한 고정 invalid-case 요청은 **10:40:49 KST, 404/evaluation_disabled**, 제공자 호출0이었다.
2. 임시 token/expiry/profile 세 키를 삭제한 **환경25**를 같은 v90으로 게시했다. 배포 `appgdep_6abdba2bea748191b1bb381a73b8e62a`는 **10:41:16 KST succeeded**다. 이전 토큰을 포함한 최종 고정 invalid-case도 **10:46:12 KST, 404/evaluation_disabled**, 제공자 호출0이었다.
3. 원래 7개 환경 키·v3 생성 true·후보 플래그 누락/false·기존 Site ID/DB/public 접근을 유지했다. 운영 기록 QA 쓰기, 학습 성적/첫 답 재계산, 백업/저장 스키마 변경·새 의존성·DB 마이그레이션은 없다. 평가 코드의 관측은 안전 enum/숫자만 사용한다.

위험도 중간이다. 후보의 출력/언어 실패가 남아 학습 활성화를 보류한다. 장애 시 후보와 평가를 닫은 채 v3를 지원하는 버전을 유지한다. v3 읽기·저장·백업·충돌 보호는 유지하고 **v84로 단순 복귀하지 않는다**. 이후 관리 문서·공개 합성 결과·수집기/검사 변경은 GitHub에 남기며 런타임 소스가 같으면 Sites 재배포하지 않는다.

다음 개선은 추가 실제 호출 없이 이번 95개 합성 응답과 고정 fixture로 전치사구/형용사 보어/주어 경계, 판단 불충분과 목표 라벨 분리, 규칙 예외 설명을 재현하는 것이다. 실패 원문이 없는 wire_fields 원인을 확정했다고 주장하지 않는다. 새로운 실제 평가가 필요해지면 별도 범위를 정해야 하며 이번 480회 원장과 상한은 보존한다.
