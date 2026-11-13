# AI 품질 개선 실행 기록 — 2026-11-06

사용자의 “보완한 플랜의 우선순위에 따라 실제 개선 작업에 착수” 지시에 따라 `ai-quality-v147` / `ai-quality-v147-2026-11-06`의 로컬 구현을 시작했다. 이전 계획 작성 단계의 구현 미승인 문구는 당시 이력이다. 현재 승인 범위는 로컬 원인 조사·제품 수정·검증·진행 상태 반영이다. 새 유료 평가·운영 QA 쓰기·게시·Git 커밋/푸시/PR은 별도 관문으로 남긴다.

SOURCE: `work/ai-quality-v147-20261106`, branch `codex/ai-quality-v147`, 기준 HEAD `7ce85ed49465b352e8304a741c8505124f86deb8`. ROOT는 대시보드 관리 원본으로 유지하며 ROOT의 학습 앱 코드는 이 작업으로 교체하지 않는다. 최근 보존된 게시 기준은v147이며 이 작업에서 운영 상태를 변경하지 않는다. 이전 평가·예산 원장은 보존한다.

## 착수 기준과 보존

- Sites portable 실행 프로필을 SOURCE에 설정하고 기존 npm lockfile로669개 의존성을 설치했다. 설치 exit0, 새 의존성 선언/lockfile 변경0이다.
- 수정 전 Node24.22.1 전체 단위 검사852/852, 실패0, exit0이다. 이 결과는 로컬 기존 코드 검사이며 운영 AI 성능 증거가 아니다.
- 별도 착수 baseline에 ROOT/SOURCE의 branch/HEAD·기존 파일 지문·5태그와 등록 정보를 보존했다. 과거 원시 근거2482파일을 동결하고 원점수·옛 승인·닫힌 예산을 이전하지 않는다.
- 과거 H01–H30의 문제·출처·증거 수준은 기존 mapping을 유지한다. `ai-quality-v147-cause-register.json`에서 현재 보호 범위/남은 불확실성을 구분한다. 역사적으로 수정된 결함을 다시 미수정 결함으로 세지 않는다.

## 판정 계약의 기준

1. **목표:** 충분한 메시지에서 원문의 단어 뜻/품사와 문법 수업의 목표 사용을 구분한다. 단어의 식별 가능한 활용 오류와 수업 목표의 격/형태 오류는 같은 기준이 아니다.
2. **원문 문법:** 목표가 없거나 다른 뜻이라는 이유만으로 원문 문법을 틀렸다고 하지 않는다. `natural`은 원문 보존, `uncertain`은 교정 없음이다.
3. **교정:** `needs_work`에서 의미를 보존한 다른 교정을 요구한다. 수량·부정·시점·인물/역할·발화행위·내용 변경의 제한된 독립 보호를 유지한다. 제한된 검사가 일반 의미 동등성을 증명하지 않는다.
4. **설명:** 목표/문법 의견과 검토된 교정 참고를 구분한다. 모델의 자유 설명을 검증된 교육 규칙으로 노출하지 않는다. 상세 학습 이해는 T37에서 별도 확인한다.
5. **보류:** 문맥 질문은 enum으로 생성하고 앱의 검토된 질문으로 표시한다. 앱이 강제 보류한 결과와 모델이 보류한 결과는 평가에서 분리한다. 통신/형식 실패는 영어 판단이 아니다.

기존105개 공개 개발 결정표와15수업×4버전×3모델의 합성 어댑터 검사는 이 계약의 전달/수용을 확인한다. 합성 응답은 실제 모델 정확도·독립 gold 검토·미공개 일반화의 증거가 아니다. 위험 허용치/N/r/출시 판정은 T34의 사전 설계·승인이 필요하며 현재 출시 보류다.

| 차원 | 계약/표시 | 모순 처리 |
| --- | --- | --- |
| 목표 | `appropriate/needs_work/uncertain` → 목표 사용·뜻/용법 확인·판단 보류 | 충분성 보류와 알려진 목표 오류를 구분한다. |
| 원문 문법 | `natural/needs_work/uncertain` → 원문 유지·교정 제안·교정 보류 | 자연문 변경/보류 중 교정/보완 중 동일 교정은 거절한다. |
| 교정 | 의미를 보존하는 최소 변경 또는 보류 | 제한된 독립 모순 검사 실패를 모델의 영어 오류와 별도로 집계한다. |
| 설명 | 검토된 앱 안내/규칙과 원문·교정 비교 | 자유 생성 이유를 사실로 대체 노출하지 않는다. |
| 문맥 | `none/message/time/target_meaning/relationship` | 질문 필요와 라벨/교정의 모순은 정해진 오류 코드로 거절한다. |

중대 오류 분류에는 의도하지 않은 인물/역할·내용·부정·수량·시점/조동사 강도·발화행위 변경, 사실과 다른 단정적 교육 설명, 사용자 기록 손실·잘못된 계정 노출을 포함한다. 관측된 중대 오류는 원인과 차단/복구를 검토하기 전 적격으로 판단하지 않는다. 관측0은 모집단 위험0의 증명이 아니다. 구체적인 평가 위험 한계와 통계 판정은 사전 승인 전 확정하지 않는다. 원점수·미측정·보류를 사후 유리하게 재정의하지 않는다는 기존 플랜 조건을 유지한다.

## 현재 원인 조사와 첫 수정

**AQ-C01 / H09:** 입력의 두 토큰이 작은 명령 동사 목록에 모두 있으면 무조건 `verb_list`로 보는 독립 보류가, 정상적인 bare-verb 보문 구문에도 적용됐다. 같은 합성 wire를 사용해 `insufficientInput`과 실제 `parseJudgmentFeedback`을 통과시키면 보류 단계에서만 라벨과 교정이 덮어써진다. 공급자/파서 JSON 오류나 모델의 원 판단 변경이 아니다.

대안은 (A) 문장별 허용 목록, (B) 모든 두 단어 검사를 제거, (C) 생산적인 `go/come/help + bare verb` 경계를 인식해 그 경우만 독립 나열 판정을 유보하는 것이다. C를 선택했다. 문장별 예외와 무조건 정상 판정을 추가하지 않으며 나머지 보호를 유지한다. `go/come`의 bare-infinitive 및 `help`의 bare-infinitive 사용은 [헬싱키 대학의 문법 연구 §3.3.1](https://varieng.helsinki.fi/series/volumes/04/chapter3_3.html)의 설명과 대조했다(2026-11-06). 지역/문맥에 따른 자연스러움은 모델 및 후속 독립 검토 대상이다.

- 수정 파일: `lib/judgment-input.ts`.
- 유지할 회귀 검사: `tests/ai-quality-input-boundaries.test.mjs`.
- 수정 전3검사 중2실패/1통과 → 수정 후 관련22/22 통과, exit0.
- 정상 구문뿐 아니라 모델의 보류/교정 의견을 유지하는 대조, 명시적인 분리 기호·기존 불충분 입력의 보류를 검사했다.
- 아직 남은 범위: 다른 동사/명사 겸용 두 단어 표현, 보류 규칙 전반의 오거절, 실제 모델 응답, 미공개 오류 가족, 전문 영어 검토·학습자 이해·운영 AI는 미검증이다. T4 전체 완료나 일반화 성공으로 표시하지 않는다.

## 검증·예산·산출물

원본 로그와 지문은 ROOT `outputs/ai-quality-v147-implementation-20261106/`에 보관한다. 실행 상태는 `.taskmaster/docs/ai-quality-v147-execution.json`과 실제 Task Master 원본을 따른다. 전체 수정 후 Node22/24·타입·린트·빌드·필요한 로컬 가상 계정 QA 결과는 실행한 뒤 갱신한다.

현재 추가 유료 AI0·운영 학습 행 조회/QA 쓰기0·게시0이다. 코드/fixture·새 공개 개발 사례를 최종 미공개 평가 자료로 재사용하지 않는다. 새 예비/확인/운영 평가의 비용은 옛 원장과 합치지 않는다.

| 경로 또는 범위 | 산출물 분류 | 처리 | 근거/후속 조치 |
| --- | --- | --- | --- |
| `tests/ai-quality-input-boundaries.test.mjs` | 회귀 테스트 | 보존 | 독립 보류의 오거절 재발 검사 |
| 구현 기록·cause register·execution JSON | 관리/검증 근거 | 보존 | 원인·미검증·진행 상태 추적 |
| ROOT `outputs/ai-quality-v147-implementation-20261106/` | 착수/RED/GREEN/실행 근거 | 보존 | 현재 검증과 향후 대조에서 참조 |
| SOURCE `work/decision-table-tests/` | 생성 테스트 번들 | 병합 후 판단 | 해당 테스트가 재생성하며 후속 검증 중에는 유지 |
| SOURCE `node_modules`, `.sites-runtime` | 실행 환경 | 유지 | 현재 작업에 필요; 설정/DB를 단순 캐시로 간주하지 않음 |

브랜치 미병합·목표 진행 중이므로 현재 산출물 삭제는 수행하지 않는다. 수정된 ROOT `AGENTS.md`의 병합 후 보관/정리 규칙을 따른다.

## 단계1 실행 상태와 첫 후보 검증 결과 (당시 기록)

T1 착수/보존·T2 공통 계약·T33 원인 지도와 대안/통제 비교 설계를 완료했다. 이는 원인별 후속 구현에 진입할 근거이며 전체 결함/실제 모델 문제가 해결됐다는 뜻이 아니다. T3 목표/문법 경계·T4 입력 보류 경계를 진행 중이다. 전체 상위3/40·세부11/133 완료, 취소1/3은 이력으로 유지한다.

동일 wire에서 입력 정책만 교체한3프로필×9사례의 통제 비교가 통과했다. 기준선의 잘못된 보류가 후보에서 해제되고, 전체 입력 보호를 제거하면 명사/나열 단편 보호가 사라짐을 확인했다. 그래서 모든 보류를 없애는 대안 대신 해당 생산 구문의 경계만 보완했다. 다른 어휘/구문과 모델의 원인 가설은 cause register에 미상으로 남겼다.

첫 후보 최종 상태: Node22.23.4 및 Node24.22.1 각각855/855·실패0, 타입·린트(기존15경고/오류0)·문법자료·빌드 exit0이다. 처음 타입 검사 launcher가 휴대 Node 폴더에 없는 npm 경로를 사용한 것은 검사 실행 환경 오류였다. 설치된 npm-cli 경로로 바로잡아 해당 검사부터 실행했으며 이미 통과한 단위 검사는 반복하지 않았다. 원래 실패 로그를 보존했다.

이번 변경은 입력 판단의 제한된 범위이며 API/백업 schema·SQL·reader5/judgment-v6·학습 성적·한국 학습일은 바꾸지 않았다. 전체 목표는 진행 중이며 실제 AI 평가·독립 영어/학습자 검토·운영 인증 AI·출시 후 관찰은 미완료다. 현재 결과를 출시 적격으로 해석하지 않는다.

## 단계2 — 목표·입력·질문·형태·역할 경계

T3–T7의 로컬 구현과 단계2 최종 검증을 완료했다. 프롬프트 후보는 **reference-v6**, 검증/저장 형식은 judgment-v6·AI 계약4를 유지한다. 이전 reference-v5 의견은 보존해 읽을 수 있고 새 기준의 현재 결과로 선택하지 않는다. 새 요청 없이 AI를 자동 실행하지 않는다.

- T3: 굴절과 품사 파생을 구분했다. 단어 뜻/품사의 목표와 문법 수업의 correct-use 기준을 구별하고, 자연문에 목표를 억지로 삽입하지 않는다. 실제 어댑터에33개 합성 응답을 전달한 경계 검사와 기존15수업×4버전×3모델 검사를 사용한다. 실제 모델의 판정 능력을 검증한 것은 아니다.
- T4: 첫 후보의 go/come/help 예외만으로는 Give help·Enjoy sleep의 정상 명사 보문을 보호하지 못했다. 따라서 동사 사전 포함 여부로 두 토큰을 단편이라 추론하는 규칙을 제거했다. 명시적 slash 목록·검토된 명사/수량/종속절/위치 단편과 선택한 표현 형식의 경계는 유지한다. 공백으로 연결된 동사열은 모델 판단 대상이며, 모델이 잘못 승인할 위험은 실제 평가에서 반드시 확인한다. 주어/사건 창작 교정은 의미 보호에서 계속 거절한다. 과거의 합성 eat go 검사를 명시 목록 eat / go로 보완한 이유와 이전 실패 로그를 보존했다.
- T5: 수량 단서가 충돌할 때 하나/여러 개 중 무엇인지 묻는 quantity 질문을 추가했다. 알려진 목표 오류와 안전한 교정 보류를 구분하며, 수량 질문 중 확정 문법/선택한 교정은 허용하지 않는다. 원뜻이 명시된 합성 문맥에서는 단수/복수 대안을 각각 전달할 수 있다. 실제 모델이 적절히 질문하는지는 미측정이다.
- T6: canonical 단어 자료의 형용사 POS와 -ful/-less 철자군으로 작은 생성 인덱스를 만든다. 런타임에 전체 단어 자료를 싣지 않는다.14개 형용사 가족의 정방향/역방향 교정과 hard/hardly·late/lately·명사에서 임의 -ly 파생·의미 변경 음성 대조를 검사했다. 전 어휘·일반 의미 동등성을 증명하지 않는다.
- T7: 단순 who 질문에서 알려진 사람과 미지의 사람의 주체/대상 역할을 뒤집는 교정을 차단했다. 정상적인 who/whom 격 교정은 같은 꼬리 표현 또는 확인 가능한 동일 역할에서 허용한다. 복합 구문 전체의 역할 분석기라고 주장하지 않는다.

기존 request-equivalence 원본 fixture와120개 과거 요청/응답 해시는 유지한다. v147의6개 정책 모듈을 별도 보존한 오프라인 fixture로 과거 결과를 재구성하고, 새 후보는 지시·선언된 schema 설명/질문 enum·프롬프트 출처만 달라지는지 비교한다. 옛 해시를 새 출력으로 덮어써 통과시키지 않는다. legacy60개 요청은 현재 코드에서도 원래 바이트 동등성을 확인한다.

첫 단계2 전체 검사는 Node22 869개 중867통과/2실패였다. 하나는 의도적으로 바뀐 프롬프트에 옛 요청 해시를 그대로 요구하던 검사였고, 다른 하나는 두 단어를 무조건 단편으로 보던 합성 전제였다. 원본 검사/실패 로그를 남기고 각각 버전별 허용 변화 대조와 명시 목록 대조로 보완했다. 최종 결과는 ROOT outputs/ai-quality-v147-implementation-20261106/phase2b/checks.json 및 source-before/scope-check를 따른다. 단계2b Node22/24 각869/869·실패0, 생성 인덱스·타입·린트(기존15경고/오류0)·문법자료·빌드 exit0, 검사 전후544개 입력 지문 일치를 확인했다. 이후 변경의 검증 근거로 이 과거 스냅샷을 재사용하지 않는다.

새 산출물 중 scripts/prepare-feedback-manner-forms.mjs와 lib/feedback-manner-adjectives.ts는 재생성 도구와 제품 필수 생성 코드로 보존한다. tests/fixtures/openai-v147-policy-source.json은 과거 계약 재현 근거로 보존한다. 새 회귀 테스트·RED/GREEN·실패/재시도 결과도 보존하며, 현재 브랜치가 미병합이므로 정리 삭제를 수행하지 않는다.

## 단계3 — 실제 교정 차이에 근거한 참고 설명

T8에서 전체 문장의 정규식 일치만으로 교정 규칙을 고르는 문제를 재현했다. 예를 들어 `She is speaking quiet. → She is speaking quietly.`에서 바뀌지 않은 진행형을 교정 이유로 설명했다. `They needs help and want to read. → They need help and want to read.`에서도 그대로인 want to가 다른 교정의 설명을 가로챌 수 있었다.

`verifiedCorrectionRule`은 공통 토큰 앞뒤를 제외한 실제 변경 구간을 비교한다. 문장부호도 토큰으로 유지하며, 단일 to 삽입·검토된 단순 주어/be 일치·동일 인물의 주격 보완·단순 불규칙 과거형 변경에만 기존 규칙을 연결한다. 여러 수정이나 미지원 구문에는 원문/교정문 비교 안내를 사용한다. 그대로인 be + -ing를 보고 진행형이라 설명하는 포괄 규칙은 제거했다. 별도 구문 분석기·새 AI 요청·구조 출력은 추가하지 않았다.

진행형은 be와 동사의 -ing형을 함께 쓰지만, 문장 안에 그 형태가 있다는 사실과 그 부분을 실제로 고쳤다는 사실은 다르다. [British Council 진행형 설명](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/present-continuous), [부정사를 따르는 동사](https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2/verbs-followed-ing-or-infinitive), [Cambridge listen의 결합](https://dictionary.cambridge.org/grammar/british-grammar/word-patterns-listen)을 2026-11-06 확인했다. 제품의 기존 검토 교재와 함께 제한된 규칙의 사실 관계만 대조했으며 독립 자격 검토자/학습자 검증을 수행했다는 의미는 아니다. 해당 검증은 T37에 남는다.

새 검사 `tests/ai-quality-explanation.test.mjs`는 그대로인 구문·다중 수정·규칙 미일치·모델 오설명 주입·보류/자연문·실제 FeedbackDetail/RecordText 렌더와 240/241자·4/5줄 경계를 다룬다. 최초 RED에서 제품 모순3건과 검사 번들러의 util 동적 require 오류가 발생했다. React를 기존 방식으로 외부 참조하고, 짧은 표시에서는 없는 더보기 라벨을 요구한 검사 전제도 바로잡았다. 관련26/26 exit0. 최초/후속 실패 로그를 별도로 보존했다. 실제 브라우저/영어 이해 효과 인증으로 확대하지 않는다. 최종 전체 검사와 입력 지문은 `ROOT:outputs/ai-quality-v147-implementation-20261106/phase3/`를 따른다.

원문·교정문·저장된 과거 설명은 수정하지 않는다. API/백업·revision/DB·reader5·검증 형식 judgment-v6는 유지하며 새 후보의 서버 생성 설명만 달라진다. 문제가 있으면 신규 후보 배포/평가를 보류하고 같은 호환 reader에서 설명 변경을 되돌린다. 이번 단계 추가 과금0·운영 쓰기0·배포0·Git 게시0이며 출시 판단은 held다.

## 단계4 — 생성 규격과 원본 응답 검증의 길이 일치

T9에서 이유 필드의 trim→max 순서가 생성 schema의 원본 길이 상한과 어긋남을 재현했다. 300자 이유 뒤에 공백1자를 붙인 wire는 생성 schema상 범위 밖인데 공개 단어 API가200으로 받아들였다. 세 이유 필드를 max→trim 순서로 바꿔 원본 길이를 먼저 제한했다. 양 끝 공백·개행을 포함한 상한/초과, 정규화 후 빈 이유, 자연문 원문 보존, natural의 교정 모순, 숨긴 structure 추가를 실제 parser와 두 API 경로에서 대조했다. 초과/모순은 정해진 provider_invalid_response로 분리하고 합성 사유/재작성/키가 공개 응답이나 진단 로그에 남지 않음을 검사했다. 추가 요청/자동 대체0이다.

초기 관련9검사 중2실패 → 수정 후 관련35/35 exit0. 전체 Node22/24 각877/877·실패0, 생성 인덱스·타입·린트(기존15경고/오류0)·문법자료·빌드 exit0이며 검사 전후546개 입력 지문 일치를 확인했다. 실제 입력 개수는 phase4/scope-check를 원본으로 한다. 과거 단계별 검증은 해당 후보의 스냅샷으로 유지한다.

이 검증은 출력 형식/판정 사이의 형식적 모순과 알려진 의미 변경 경계에 대한 것이다. 형식이 일치하는 natural 응답의 실제 영어가 언제나 옳다고 인증하는 것은 아니다. raw 모델 정확도·책임 있는 보류·미공개 일반화는 T24–T27/T34–T37의 별도 실제 근거가 필요하며 출시 held를 유지한다. 저장 schema/백업/SQL/검증 버전은 바꾸지 않았고 기존 과거 응답에는 새 parser를 재적용하지 않는다.

T10에서는 현재 후보에 대해 기존 초안/영수증/저장/복원 보호를 다시 검증한다. 가상 계정의 로컬 React 브라우저 흐름과 단위/상태 저장 검사를 구분해 기록하며, 운영 자료를 읽거나 쓰지 않는다.

## 단계5 — 저장/초안 호환·실제 Worker 비교·평가 설계

T10의 현재 후보 검증에서 기존 제품 보호를 유지했다. 전체 단위 검사의 기존 state/backup/restore/receipt/reader5/judgment-v6 회귀와 별도로 Chromium/WebKit에서 초안20·교정 적용/undo15씩, 총70항목이 exit0이다. 로컬 React 실제 훅과 합성 서버만 사용했다. 응답 유실/조회503 뒤 같은 UUID 보존·조회만 재시도, 강제 소유 QA 브라우저 종료/재개, 명시적 빈 입력·앞뒤 공백·두 탭·계정 전환·첫 답/독립 성적 보호를 확인했다. 운영 계정·D1에 대한 E2E나 실제 iPhone 검사로 표현하지 않는다. 근거는 phase4/compat-browser이며 이후 제품/harness 입력 지문이 같음을 확인해 재사용했다.

T11에서 새 `tests/ai-quality-worker-equivalence.test.mjs`로 실제 workerd의 합성 outbound와 Node를 비교했다. 3모델×단어/문법×현재/legacy 계약=12조합의 요청 본문·선택 모델·출력 상한/옵션과 생성시각 제외 가시 결과가 동일하다. native Worker 본문 stream 실패는 provider_network/503/envelope, 수신 후 envelope/fields 거절은 provider_invalid_response/502의 각 단계로 구분했다. 기존3xx 5상태 거절·외부 재전달 없음 및120개 과거 요청 지문 검사도 통과했다. 첫 실행은 본문 읽기 오류의 기존 envelope 메타데이터를 기대값에서 빠뜨려1실패했고, 실제 구현을 확인해 기대값을 바로잡은 뒤5/5 exit0이다. 제품 전송 코드·모델/가격·28000ms/4096토큰 제한은 바꾸지 않았다. 실제 OpenAI API/환경/키는 읽거나 호출하지 않았고 과거 Astra 오류의 원인을 확정하지 않는다.

최종 단계5 Node22/24 각879/879·실패0, 생성 인덱스·타입·린트(기존15경고/오류0)·문법자료·빌드 exit0이다. phase5/checks.json·source-before.json·scope-check.json이 최종 제품 근거다. T10/T11에서는 새 제품 변경이 필요하지 않아 보호를 임의로 재작성하지 않았다. AQ-C06의 과거문제 연결을 H02에서 H06으로 정정했고 이전 register는 phase5에 보존했다.

T12의 평가 설계는 `.taskmaster/docs/ai-quality-v147-evaluation-design.json`이다. 예비60칸을 단어30(정상10/교정12/보류8), 문법30(10/13/7)으로 나눴으며 실제15수업 각2칸이다. 147개 노출된 코드/자료 지문과 기존2482근거 목록을 연결했다. H01–H30은 영어 문항 또는 별도 상태/예산/진단/운영 검증 채널로 추적한다. 단순 단어 교체·이름 변경·유사 바꿔쓰기를 새 가족으로 취급하지 않는다. 현재는 같은 작성자의 설계이고 독립 작성/검토는 수행하지 않았다. 새 문항 본문0·채점기 실행0·추가 유료 승인/호출0이다. 후보 동결 후 T24의 새 예비 문항, 이후 T35의 별도 확인 가족을 분리한다. 60/60이나57/60은 출시 적격을 인증하지 않는다. 설계3그룹 및 배분/수업 누락/조기 문항/미승인 예산의 음성 대조4개가 통과했다.

현재 로컬 완료 상위13/40·세부43/133, T13 허용 대안/5차원 gold 기준을 진행한다. 전체 등록에는 취소 상위1/세부3 이력이 포함된다. 유료 실제 평가·자격 있는 독립 검토·학습자 이해/전이·운영 합성 AI·배포/후속 관찰은 미완료이고 출시 held다. 모든 기존 원장/원점수와 처음 실패/재시도 근거를 유지하며 미병합 산출물 삭제는 하지 않는다. 새 Worker 회귀/평가 설계·검증 도구는 후속 재현에 필요하므로 보존한다.

## T13 — 단일 문자열 대신 허용 조건을 미리 정하는 참조 기준

T13의 `.taskmaster/docs/ai-quality-v147-gold-policy.json`은 새 실제 결과를 보기 전의 공개 개발 기준이다. I asked·충돌 단복수·careful/carefully·미완성 접속절·시점 없는 조동사 등12개 알려진 예시에 목표/문법/교정/설명/보류의5차원을 연결했다. 질문 의미의 ask는 자동사로도 쓸 수 있으므로 목적어가 없다는 이유만으로 틀렸다고 처리하지 않는다. 수량 단서가 충돌하면 단수/복수 중 하나를 선택하지 않고 질문하며, 명시된 문맥이 있으면 해당 대안을 허용한다. 단어 목표가 틀렸다고 자연스러운 원문을 다시 쓰지 않는다. 동일 문자열만 통과시키거나 유창한 대안을 무조건 의미 동등하다고 승인하지 않는다.

공식 [Oxford ask](https://www.oxfordlearnersdictionaries.com/definition/english/ask_1?q=ask)와 [Cambridge 지시사](https://dictionary.cambridge.org/grammar/british-grammar/this-)의 검색 결과, [British Council 과거 조동사 추론](https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2/modals-deductions-about-past)의 본문을 2026-11-06 확인했다. Cambridge ask 본문403을 읽었다고 주장하지 않는다. 과거형 형태 오류를 안다는 사실, 시간상 동등한 교정을 고를 수 있다는 사실, 질문을 해야 한다는 사실을 분리했다. 실제 parser가 조동사 완료형 대안을 받아들여도 의도 시점이 없으면 교정 차원은 uncertain·보류 차원은 fail이고, 그 불확실성만으로 critical 의미 역전이라고 단정하지 않는다. 이는 남은 모델/평가 위험을 드러내는 대조 예시다.

현재 parser의 허용 개발12tuple·차원 분리1probe·과거 기준 지문 보존이4그룹 exit0으로 확인됐다. 작성자는 같은 Codex 세션이며 자격 있는 독립 검토를 받았다는 의미가 아니다. 과거 점수/기대값/원장과 옛 rubric 파일은 보존했다. 새 문항의 gold/작성자/검토자/가족/전제 조건은 T24/T35에서 결과 전에 봉인한다. 참고 계약 v4는 v3를 SHA256으로 잇고, 기존 복사 정의의 v5 표기를 현재 reference-v6·quantity 경계로 명확히 했다. 제품 코드·프롬프트 버전을 추가 변경한 것은 아니다.

최신 진행은 상위14/40·세부46/133 완료, T14 채점기 보정 자료/독립 재검토 절차 준비다. 이전 단락의13/43은 그 당시 상태다. 전체 목표는 진행 중이며 실제 평가·독립 검토·운영 관문은 계속 held다.

## T14 — 채점기 보정 자료·원점수/검토/조정 분리

현재 reference-v6 parser를 통과한 공개 개발 예시와 명시적으로 꾸민 가시 오류를 구분하여 정상 피드백4·명백 오류4·모호/보류4의12개 증인을 준비했다. 명백 오류4개는 현재 제품의 실제 결함 재현이라고 주장하지 않는다. 보류군에는 안전한 시점/수량 질문, 시점 미확정 교정, 실제 parser의 missing_context_question 거절이 포함된다. 가시 결과가 없으면5차원 unavailable이며 영어 문법 fail/critical로 바꾸지 않는다. 역할 교환/방향 역전처럼 둘 이상의 critical 플래그가 겹쳐도 관찰1건을 독립 사건2개로 세지 않는다.

`.taskmaster/scripts/ai-quality-v147-calibration.mjs`는 네트워크·키·원장 입출력이 없는 오프라인 집계/검토 core다. 각 judge12개 전부 수집·11/12 이상 정확한 참조 판정·필수 critical 누락0을 따로 확인한다. 응답 누락/실패/중복은 분모를 줄이거나 대체하지 않는다. 3 judge×12=36은 향후 T25의 호출 계획이며 현재 실제 호출0이다. 모의 참조36개의 집계가 맞아도 modelCalibrationMeasured=false를 유지한다.

검토 묶음은 실제 원문/목표/문맥과 가시 피드백 또는 이용 불가만 포함한다. 모델/버전/원채점·예상값/내부 메타데이터는 별도 매핑으로 분리하고 임의 salt의 opaque ID 순서로 가린다. 문구와 작성자의 지식으로 후보를 알아볼 수 있어 부분 가림·같은 작성자 검토이며 독립 영어 전문가 검토가 아니다. 검토 grade와 그 evidenceHash, 명시적 조정과 reviewHash를 별도로 연결한다. 미검토·미조정·미해결·stale 해시·바뀐 원자료는 held이고 원점수를 덮어쓰지 않는다.

Node22/24에서 보정 절차9/9씩 exit0이다. 11/12 허용과 critical1개 누락의 불합격, 미수집/실패/중복, 패킷 메타데이터 비노출, 원점수/검토/조정 분리, stale/tamper/미해결 보류를 검사했다. 새 도구의 초기 검증 오류가 잘못된 필드 이름/문장을 assert 진단에 붙일 수 있음을 RED로 확인하여, 오류에는 앱 소유의 일반 메시지만 남기도록 보완했다. 이 도구 자체의 개발 중 실패와 수정 로그는 phase6에 보존했다. materializer의 첫 상대 import 경로 오류도 보존했으며 SOURCE의 설치된 esbuild를 찾는 방식으로 바로잡았다.

준비 근거는 `.taskmaster/docs/ai-quality-v147-calibration-preparation.json`과 `.taskmaster/evaluation/ai-quality-v147/calibration-witnesses.json`이다. 기존 원점수/원장/평가 runner는 실행·수정하지 않았다. 제품 소스 입력547개가 이전 phase5와 같으므로 제품 Node22/24 879/879·타입/린트/빌드 결과는 해당 동일 제품의 증거로 유지하고, 새 도구 검사는 위9개와 별도로 보고한다. 실제 judge의 영어 평가 능력과 독립 검토는 미측정이며 출시 held다.

## T15 — 실제 전체 빌드 Worker·로컬 D1·화면 경로

v147의 보존된 게시 빌드를 기준선으로 재사용했다. 당시 자격 아카이브의407파일 중406개는 바이트가 같고 hosting JSON은 값이 같다. 게시 checkout의 HEAD/tree를 바꾸지 않았다. 후보는 phase5와 같은 제품547입력의 빌드다. 두 빌드407개씩 총814파일과 기존 SQL이 실행 전후 같음을 대조했다. 새 빌드·새 Site·운영 조회를 수행하지 않았다.

설치된 Miniflare5-beta의 v4 호환 변환을 사용해 전체 Vinext server148모듈과 실제 client 자산을 workerd에서 실행했다. DB/R2는 각기 다른 합성 namespace이며 루프백에만 노출한다. OpenAI 목적지 요청은 가짜 키를 검증한 뒤 반드시 로컬 합성 응답으로 처리한다. .env나 Sites 연결 값을 로드하지 않는다. 같은 합성 계정의 학습 상태는 프로필 사이에 분리됐고, 각 프로필 안에서는 다른 계정의 영수증을 읽을 수 없음을 확인했다.

세 모델×단어/문법v4×기준선/후보12개 실제 API 흐름에서 생성→parser→D1 영수증→동일 UUID 조회/POST 재사용→실제 상태 API 저장/재조회가 통과했다. 계약3 요청426·모델 불일치409·2001자400은 발송 전에 막혔다. raw input과 합성 응답7쌍은 같으며, 알려진 Give help의 같은 natural wire가 기준선에서는 앱 보류·후보에서는 natural로 이어짐을 실제 전체 빌드에서 확인했다. 이는 개발 사례의 앱 원인 근거이며 실제 모델 정확도/일반화 점수가 아니다.

Chromium/WebKit에서 두 프로필의 단어/문법 결과8개를 실제 빌드 화면으로 확인했다. Chromium 단어에서는 명시적 재요청의 서버 응답을 실제 생성/영수증 저장 뒤 잘린 JSON으로 전달했다. 다음 버튼은 동일 UUID의 D1 영수증만 조회했고 재생성 없이 결과를 다시 저장했다. 두 언어 첫 답·독립 성적·친숙도와 문법 첫 답/관찰 답을 보존했다. 프로필당 API6회+UI1회, 최종 실행의 합성 제공자14회이며 실제 OpenAI0회다. 기존 호출 로그를 초기화하거나 실패한 유료 요청을 재발송한 것이 아니다.

최종24그룹 exit0, 양쪽 소유 workerd PID/생성시각과 종료 후 포트 폐쇄를 확인했다. 로컬 합성 DB와 증거는 유지한다. Node24.22.1에서 실행했으며 Node22 통합 검사나 실제 iPhone/VoiceOver·운영 AI 성공으로 표현하지 않는다. 폰트 등 비루프백 브라우저 요청은 차단했고 실제 원격 DB/R2/AI로 연결하지 않았다. 근거는 phase6/built-worker-final과 worker-preparation JSON이다.

초기 실패도 보존했다. 호환 변환에 user Worker 선언이 없어500이 났고, 이를 보완한 뒤에는 강제로 worker-first로 둔 자산 경로가404여서 화면이 시작되지 않았다. 자격 빌드의 기본 asset-first를 유지하도록 도구 설정을 바로잡았다. 실제 API 저장 검사에서 필수 progress/sessions 빈 객체를 빠뜨린400, 닫힌 조동사 수업 그룹을 먼저 열지 않은 UI 대기도 검사 도구의 전제 오류였다. 제품 코드/검증을 약화시키지 않고 준비 코드만 고쳤다. 단순 API smoke 통과를 당시 자산/화면 성공으로 해석하지 않으며 최초/후속 실패 로그·임시 D1 사본을 보존했다.

## 현재 진행과 다음 단계

T14/T15의 로컬 완료로 상위16/40·세부52/133이다. 전체 등록에는 취소1/3 이력이 포함된다. T17의 새 프로토콜 예산 예약을 착수했다. 기존 비용 계산의 예약/미상 유지 개념은 검토했지만, 옛 core의 고정7달러 승인·원장 경로·runner를 가져오거나 실행하지 않는다. 승인액0을 기본으로 생성360+본채점360+보정36의 최대756호출을 분리하고, 가짜 가격/usage로 정수 단위·완전 묶음·실패/미상·동시 예약의 경계를 먼저 구현/검증한다. 실제 가격/새 금액/승인은 T24 이후의 별도 관문이다. T16 동결 프로토콜과 T18–T22 실행/복구/관측·집계도 남는다.

제품547입력과 기존879/879·타입/문법자료/빌드 증거는 phase5 그대로이며 새 도구의 Node9/9와 Worker24그룹은 phase6로 분리했다. 최신 Task Master/대시보드 검증은 phase6에 기록해 동결된 phase5 결과를 덮어쓰지 않는다. 전체 실제 영어 품질·독립 자격 검토·학습자 이해·운영 인증 생성·출시 후 점검은 미완료이고 실제 API 과금/운영 QA쓰기/게시/Git 작업/산출물 삭제0이다.


## T17 · 별도 예산 사전 예약 도구 · phase7

현재 실제 추가 승인/사용은 US$0/US$0, 실제 제공자 호출0이다. `.taskmaster/scripts/ai-quality-v147-budget.mjs`·`ai-quality-v147-budget-store.mjs`·`test-ai-quality-v147-budget.mjs`를 추가했다. 이전7달러 core는 읽기만 했으며 import/실행·원장/잔액 이전은 하지 않았다. 새 프로토콜은 계획과 새 runId/소스·가격·요청 사양·승인 지문을 결합한다. 생성360+본채점360+보정36=756은 예비의 상한이며 확인 평가/운영 smoke 승인으로 사용하지 않는다.

정수 micro-USD와 유리수 계산 후 요청별 올림을 사용한다. 묶음 전체를 먼저 예약하고 새 디렉터리에 영속화한다. 잔액 부족은 묶음 전체를 거절한다. 실패/사용량 미상은 최대 예약을 유지한다. 사용량이 입력/출력 경계를 벗어나면 결과 지문과 최대 예약을 보관하고 신규 소비를 중단한다. 승인 축소/철회에도 발송된 예약은 초기화하지 않는다. 완료/실패/미상 슬롯은 다시 예약하지 않는다.

Node22.23.4/24.22.1에서 각각23/23, 오류·실패·skip0, 전용 ESLint 오류/경고0·exit0이다. 동일/다른 묶음을 놓고 실제 두 자식 프로세스가 경쟁하는 검사, 정확 경계와1micro 부족, 합계756/역할 상한, 가짜 사용량·오승인/옛 잔액, 저장 rename EPERM 주입과 이전 HEAD/준비 근거 보존, 외부 lock·변조 거부를 포함한다. 최초22통과, 추가 동시 경계23통과와 린트1경고, 경고 수정 후최종23통과 근거를 모두 phase7에 보관했다.

핵심은 네트워크·키 접근이 없는 도구이며 `realDispatchAuthorized=false`이다. 시험의 양수 한도/가격/승인은 합성 fixture다. 실제 발송 전에는 T16/24에서 실제 가격·토큰 경계·승인 출처·동결 사양 검증이 필요하다. T18의 발송/영수증 연결, T19의 엄격 복구·강제 중단/fsync 검사와 하드웨어 전원 장애는 이 검사로 완료됐다고 하지 않는다.

재현(각 실행의 QA_OUTPUT_DIR은 새 빈 경로 지정):
```powershell
$env:QA_OUTPUT_DIR='<새 근거 절대경로>'
& '<Node22 또는24의 node.exe>' --test .taskmaster/scripts/test-ai-quality-v147-budget.mjs
& '<node.exe>' node_modules/eslint/bin/eslint.js --no-ignore .taskmaster/scripts/ai-quality-v147-budget.mjs .taskmaster/scripts/ai-quality-v147-budget-store.mjs .taskmaster/scripts/test-ai-quality-v147-budget.mjs
```

현재 상위17/40·세부55/133 완료, T18 진행 중이다. `.taskmaster/docs/ai-quality-v147-budget-preparation.json`과 `ROOT:outputs/ai-quality-v147-implementation-20261106/phase7/budget-checks.json`이 지문/명령/검증 근거다. 제품547입력·기존 동결 근거는 별도 대조한다. 미병합이므로 삭제0·배포/운영QA/Git변경0이다.


## T18 · 요청 중복 전송 통제 준비 · phase8

`.taskmaster/scripts/ai-quality-v147-dispatch.mjs`와 `test-ai-quality-v147-dispatch.mjs`를 추가했다. 이 어댑터는 **합성 검사 전용이며 evaluation 모드를 즉시 거절**한다. 실제 키·네트워크 어댑터는 없고 실제 AI 호출/승인/사용0이다. 새로운 run/spec/소스 버전·모델·사례·역할·반복을 묶은 동일 요청 UUID를 유지하고, 본문/모델/출력상한 대조→영속 consumed 기록→한 번의 합성 전송→검사합이 있는 결과 보관→영속 정산 순서를 따른다.

시간 초과나 중단으로 consumed에 남은 요청은 발송됐을 수 있는 것으로 처리하여 최대 예약을 유지한다. 다시 보내거나 새 UUID로 바꾸지 않는다. 재전송 인자가 없는 복구 함수로 동일 요청의 보관 결과 또는 로컬 합성 영수증을 검증·반영한다. 이미 정산한 결과는 동일 지문만 확인하고 원점수/usage를 바꾸지 않는다. 오염된 결과·다른 요청/본문/소스는 거절한다.

Node22.23.4/24.22.1 각각13/13, 실패/skip0, 전용 ESLint 오류/경고0·exit0이다. 각 런타임에서 실제 자식 프로세스를 소비 전·소비 후 발송 전·발송 후 결과 보관 전·보관 후 정산 전의4경계에서 exit73으로 종료했다. 전송 직전 중단은0회/재전송 금지, 발송 후 중단은1회/같은 UUID 복구였고, 미소비 예약만 재개할 수 있었다. 두 프로세스가 동일 슬롯을 경쟁해도 합성 전송은1회였다. 생성/본채점/보정, timeout·오모델·출력상한·승인 철회·결과 변조·중복 정산도 포함했다.

검증 명령: 각 Node 런타임으로 `--test .taskmaster/scripts/test-ai-quality-v147-dispatch.mjs`, 전용 lint는 `node_modules/eslint/bin/eslint.js --no-ignore .taskmaster/scripts/ai-quality-v147-dispatch.mjs .taskmaster/scripts/test-ai-quality-v147-dispatch.mjs`다. `QA_OUTPUT_DIR`에 새 절대 근거 경로를 지정하며 원래 검사/프로세스 종료/경쟁 자료를 보존한다. 지문과 명령은 `.taskmaster/docs/ai-quality-v147-dispatch-preparation.json` 및 `ROOT:outputs/ai-quality-v147-implementation-20261106/phase8/dispatch-checks.json`에 있다.

합성 영수증은 절차 시험이며 실제 인증 영수증이 아니다. 현재는 고정 합성 본문만 검사했다. T16/24에서 생성 결과로 만들어지는 본채점 템플릿·실제 본문·예산 경계·승인 출처와 인증된 조회 경로를 동결해야 한다. T19의 준비 원장/죽은 소유 lock 엄격 복구·fsync/EPERM 검사는 미완료이며, 실제 평가/영어 품질/학습 효과/운영 게시 완료를 주장하지 않는다.

현재 상위18/40·세부58/133 완료(취소1/3 포함), T19 진행 중이다. T17/18 완료는 로컬 도구 구현·절차 검사 범위다. 미병합이므로 산출물 삭제0·운영QA/게시/Git작업0이다.


## T19 · Windows 원장 저장·중단 복구 · phase9

`ai-quality-v147-budget-store.mjs`의 저장 절차를 보완하고 `ai-quality-v147-process.mjs`·`ai-quality-v147-recovery.mjs`·`test-ai-quality-v147-recovery.mjs`를 추가했다. `ai-quality-v147-dispatch.mjs`에는 보관 결과 대조용 읽기 함수를 추가했다. 전부 `.taskmaster/scripts/`의 로컬 평가 도구이며 제품/운영 DB 경로를 바꾸지 않는다. 현재 실제 추가 승인·사용 US$0/US$0, 실제 제공자 호출0이다. 회복 API도 synthetic Windows 모드만 허용한다.

원장은 변경 불가 스냅샷·이전 지문·정확한 전이 재실행으로 검사하고, 완전한 다음 스냅샷/commit 설명/임시 HEAD 한 묶음만 복구한다. 저장 성공으로 추정하지 않고 검증한 파일을 복구 시점에 다시 fsync한 뒤 HEAD를 교체한다. 과거 완료 슬롯·요청 UUID·usage·보관 결과 지문이 달라지면 거절한다. 파일이 읽힌다는 이유만으로 이전 fsync가 반환됐다고 주장하지 않는다. 불완전한 JSON·설명 누락·여러 준비 파일·새 소스·불명한 소유자는 원본과 최대 예약을 유지한 채 보류한다. 원장 초기화·새 UUID 재전송은 없다.

lock은 PID·실제 시작 시각·명령/실행 파일 지문·run/spec/디렉터리를 결합한다. 실제 종료가 확인된 소유 lock만 고유한 복구 근거 폴더에 그대로 이동하고 새 lock을 원자적으로 잡는다. 이전 HEAD·준비 자료도 복사·지문 대조하여 보존한다. Windows Global 이름의 커널 mutex를 소유한 보조 스레드가 정확한 경로/원문 SHA를 다시 검사하고 lock 이동 자체를 수행한다. 보조 프로세스 종료 후 Node가 잠금 없이 다른 실행의 lock을 이동하는 경계를 피한다. 한글 경로 명령은 UTF-8로 전달한다. 복구 중 새 실행이 죽어 남긴 lock도 원래 검사·이전 lock·commit 근거의 지문을 연결해야 재개할 수 있다.

설계 근거는 [Microsoft Mutex](https://learn.microsoft.com/en-us/dotnet/api/system.threading.mutex?view=netframework-4.8)와 [전역/세션별 커널 이름](https://learn.microsoft.com/en-us/windows/win32/termserv/kernel-object-namespaces)을 확인했다. 실제 검사는 현재 Windows 세션의 Node22.23.4/24.22.1에서 수행했다. 다른 RDP 세션과 물리적 전원 장애·저장 장치 장애·디렉터리 fsync 보장은 미검증이다. 실제 영수증 인증·유료 전송·모델 품질은 이 합성 검사로 증명하지 않는다.

최종 코드는 두 Node 런타임 각각 예산23/23·전송13/13·복구14/14, 실패/skip0·exit0이다. 전용 ESLint8파일은 오류/경고0·exit0이다. 각 런타임에서9개 쓰기 경계의 실제 자식 종료(exit74),3개 복구 경계의 실제 종료(exit75),보조 프로세스 종료,중복 복구 프로세스 경쟁,실제 Windows 파일 핸들의 rename EPERM을 확인했다. 이전 완료 행·원점수/usage·요청 UUID를 보존하고 추가 합성 전송 없이 복구했다. 복구/기존 근거의 원장 예산은 별도이며 옛 닫힌 원장을 실행하지 않았다.

부정 대조에서는 전이 재실행만 보면 허용되는 commit 누락·보관 결과와 다른 usage를 전체 보호가 거절했다. 같은 한글 경로·내용의 이동에서 명시 UTF8 설정을 제거한 사본은 FIELDS 실패, 원본은 성공했다. 실제 원본 코드는 이 대조에서 수정하지 않았다. 개발 초기 PowerShell 별칭/예외 구문 실패,최초12통과,복구자 중단 검사 RED→수정→GREEN,중간13통과,한글 이동 RPC 첫 실패와 수정 후 통과를 모두 phase9에 보존했다.

재현은 각 런타임과 새 QA_OUTPUT_DIR에서 다음 파일을 각각 실행한다.
```powershell
$env:QA_OUTPUT_DIR='<새 근거 절대경로>'
& '<node.exe>' --test .taskmaster/scripts/test-ai-quality-v147-budget.mjs
& '<node.exe>' --test .taskmaster/scripts/test-ai-quality-v147-dispatch.mjs
& '<node.exe>' --test .taskmaster/scripts/test-ai-quality-v147-recovery.mjs
```
각 명령의 QA_OUTPUT_DIR은 별도의 새 경로로 지정한다. 복구 사용 예시는 `const plan = inspectBudgetRecovery(context); await recoverBudgetStore({context, expectedInspectionHash: plan.inspectionHash});`다. 같은 동결 context를 사용하며 검사 후 파일/소유 지문이 바뀌면 실패하고 다시 검사한다. 보류 상태를 강제로 초기화하거나 파일을 지워 우회하지 않는다.

현재 상위19/40·세부61/133 완료(취소1/3 포함), T20 단계별 실패 분류 진행 중이다. `.taskmaster/docs/ai-quality-v147-recovery-preparation.json`·현재 예산/전송 준비 문서와 `ROOT:outputs/ai-quality-v147-implementation-20261106/phase9/`의 final2 검사·복구 감사 보존 결과를 따른다. 제품547입력이 같아 기존879/879·타입/문법/빌드 근거는 재사용하고 지문을 다시 대조한다. 실제 영어/학습/운영 검증 완료가 아니며 미병합 산출물 정리·게시·Git 작업은 수행하지 않았다.


## T20 · 단계별 실패 분류와 진단 비노출 · phase10

`.taskmaster/scripts/ai-quality-v147-failures.mjs`·`test-ai-quality-v147-failures.mjs`를 추가했다. 새 동결 실행의 슬롯/모델/역할/요청 지문과13개 관측 단계를 결합하여 전송·본문 읽기·생성 형식·앱 안전 거절·로컬 재포장·영수증 저장·채점·검토·불명을 구분한다. 원장의 reserved/consumed/terminal과 사용량 근거를 검증하지만 원장·비용·원점수는 바꾸지 않는다. consumed는 발송됐을 수 있다는 뜻이므로 실제 전송1회를 추정하지 않고 사용량 불명 최대 예약을 유지한다.

실제 현재 앱 어댑터를 Node에서 번들하고 제공자 응답만 합성으로 대체했다. 각 런타임의 합성 전송10회에서 fetch 거절과 실제 ReadableStream 읽기 거절, JSON/필드 오류,안전 거절,비JSON402/429,초과 크기를 대조했다. 현재 앱은 외형 오류와 후처리 TypeError 일부를 같은 envelope 오류로 감싼다. 실제 sentenceFeedbackSchema.parse에 TypeError를 주입하여 이 한계를 재현했고, 통신 실패로 바꾸지 않고 app_pipeline_unknown으로 보존했다. 정확히 관측한 로컬 재포장 TypeError는 별도 로컬 실패다. 과거 원인 불명 이력은 고치지 않았다.

비JSON402와429도 중단 결정(stop-run)을 내며,429는 허용된 애플리케이션 코드가 있을 때만 billing/account를 구분한다. 그 외429는 UNCLASSIFIED다. 서버가 재시도 시간을 주어도 이 도구가 재전송하거나 새 UUID를 만들지 않는다. 알려진 형식/앱 거절은 슬롯 실패를 보존하고 다른 슬롯을 수집할 수 있는 결정만 반환한다. 실제 실행기의 결정 적용은 T22 통합 작업이며 현재 유료 발송 경로는 없다.

진단에는 고정 코드·숫자 상태·검증된 메타데이터만 투영한다. message/stack/원문/body/답변/키/토큰/Zod 입력과 경로·알 수 없는 필드는 읽어 기록하지 않는다. getter/proxy의 예외도 원문을 노출하지 않는다. 단순 객체 펼치기는 합성 canary를 노출하고, 허용 필드 투영은 같은 canary를 남기지 않는 대조를 확인했다.

Node22.23.4/24.22.1 각각15/15·실패/skip0·exit0,전용 ESLint 오류/경고0·exit0이다. 명령은 새 QA_OUTPUT_DIR에서 `node --test .taskmaster/scripts/test-ai-quality-v147-failures.mjs`와 `node node_modules/eslint/bin/eslint.js --no-ignore .taskmaster/scripts/ai-quality-v147-failures.mjs .taskmaster/scripts/test-ai-quality-v147-failures.mjs`다. 최초15통과와 고정 단계/문자열 키 경계 보완 후 최종15통과를 모두 보존했다. 실행·소스·번들·관측 지문은 `.taskmaster/docs/ai-quality-v147-failure-preparation.json` 및 `ROOT:outputs/ai-quality-v147-implementation-20261106/phase10/failure-checks.json`에 있다.

현재 상위20/40·세부64/133 완료(취소1/3 포함), T21 집계 진행 중이다. 제품547입력·이전 예산/전송/복구 도구는 동일하여 기존 전체 검사 근거를 지문으로 대조한다. 실제 제공자 호출·추가 승인·사용0,실제 모델 품질·독립 영어/학습 검증·운영 확인은 미완료다. 미병합 산출물 정리·배포·Git 작업0이다.


T20 근거 버전 보완: 읽기 전용 진단은 synthetic/evaluation 형식의 새 프로토콜을 모두 검증하여 처리한다. evaluation 형식의 양수 승인은 메모리 내 구조 시험용 합성 fixture이며 실제 승인이 아니다. 새 raw 진단에는 runMode를 표시한다. 실제 실행·과금·원장 쓰기나 새 네트워크 요청은 없다. 이후 변경은 Node22/24 각15/15·전용 lint0으로 재검사했고 현재 근거는 `phase10/failure-checks-v2.json`이다. 이전 `failure-checks.json`은 새 결과를 임시로 덮었던 뒤 원래 SHA와 일치하는 바이트로 복원했다. v1 소스·시험 지문과 준비 문서도 별도 보관했으며 `evidence-version-correction.json`에 복원 대조를 남겼다. 현재 준비 문서만 v2를 가리키고 과거 참조·점수·원장은 유지한다.


T20 재현 경계 보완: 관리 ROOT의 제품은 reference-v5, 작업 SOURCE는 reference-v6이므로 진단 검사는 실행 위치에 의존하지 않고 manifest의 SOURCE를 번들한다. 번들된 실제 AI_PROMPT_VERSION을 현재 판단 계약과 대조한다. SOURCE의 Node22/24 각각15/15뿐 아니라 ROOT에서 Node24로 실행해도 같은 SOURCE/reference-v6으로15/15·실패/skip0·exit0을 확인했다. 제품 ROOT 코드는 유지한다. 현재 최종 근거는 `phase10/failure-checks-v3.json`이며 v1/v2 파일·소스·준비 문서는 각각의 기존 지문으로 보존했다. 전용 lint 오류/경고0, 실제 제공자 호출/승인/사용0이다.


## T21 · 고정 분모·원점수 분리·조건부 위험 집계 · phase11

`.taskmaster/scripts/ai-quality-v147-report.mjs`와 재사용 회귀 검사를 추가했다. 입력은 사전 설계/소스/단계/실행/모델/문항/반복 지문과 점수 메타데이터이며, 개인 문장·실제 응답 본문·검토자 식별자는 보고서에 포함하지 않는다. 예비 평가는 모델별60칸·정상20/교정25/맥락부족15와 단어/문법30씩을 유지한다. 누락·생성실패·앱거절·채점실패·미측정을 분모에서 지우거나 영어 오답으로 바꾸지 않는다. 영역/층/가족/반복별 수집 상태와 차원별 pass/fail/uncertain/unavailable/notGraded도 분리한다.

원점수·검토 점수·최종 조정 점수는 각각의 지문으로 보존한다. 표시된 유효 출력 전체의 검토/해결 여부를 계산하고, 상충·미해결 또는 원점수 부재를 자동 합격으로 채우지 않는다. 검토자 ID만으로 독립성/영어 자격을 인증하지 않는다. 전후 비교도 같은 모델/문항/반복의 언어 회귀와 출력 이용불가를 나눈다. 누락/불명의 가용성은 확인된 손실/개선이 아니라 미측정으로 남긴다. visibleAction은 전체 교정 제공/보류이며, 원문을 보존한 목표만의 판단불가를 전체 보류로 세지 않는다.

57/60 및 층별18/20·23/25·14/15는 예비 선별 지표만이다. 중대 오류와 쌍별 회귀, 가용성 손실, 미측정을 함께 표시하며 다른 모델의 평균으로 낮은 모델/층을 숨기지 않는다. 예비·확인·운영 입력은 지문으로 분리하고 운영은 별도6칸이다. release/operational 판정은 held다.

위험 계산은 단측 Clopper–Pearson 상한의 이항 누적확률 역산이다. 방법/독립 Bernoulli 가정은 [R binom.test](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/binom.test.html)와 [SciPy exact CI 문서](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats._result_classes.BinomTestResult.proportion_ci.html)를 확인했다. 실제 수치 참조는 설치된 SciPy1.16.3의 `binomtest(k,n,alternative='less').proportion_ci(confidence_level=c,method='exact').high`로245개를 생성했다. 현재 웹 문서 버전과 구분하고 설치 함수 소스/정규화·원시 파일 지문을 보존했다. 오차 최대 약4.86e-13으로 일치한다.

같은 오류 가족의 문장/반복/모델/중대 유형은 하나의 any-critical 사건으로 묶는다. 후보3모델×60문항도 독립180표본으로 늘리지 않는다. 모든 가족의 관측이 완전하고 iid 가족 추출 가정이 명시된 경우에만 조건부 수치를 낸다. 선택/층화 표본의 독립·대표성이 자동으로 성립하지 않으며, 근거 미검증이나 미측정이 있으면 상한은 null이다. 가정/승인의 해시는 해당 가정의 타당성이나 사용자 승인을 인증하지 않는다. 시험의 신뢰수준·위험 한도는 계산 fixture이며 실제 기준 승인이 아니다. T34 사전 설계·T35/36 확인·T37 독립 검토/학습자·T40 충분성 관문을 유지한다.

Node22.23.4/24.22.1 각각20/20, 실패/skip0·exit0, 전용 ESLint 오류/경고0·exit0이다. 중복/다른 소스·자가 채점·오래된 검토 거절, 부분 수집, 모든 층의 기준 미달, 정상 문장 과잉 보류, 앱 거절/가용성 불명, 중대 오류, 상충 원점수/조정, 상관 가족/반복 변동, 예비57합격≠출시를 대조했다. 재현은 매번 새 QA_OUTPUT_DIR에서 `node --test .taskmaster/scripts/test-ai-quality-v147-report.mjs`, 전용 린트는 `node node_modules/eslint/bin/eslint.js --no-ignore .taskmaster/scripts/ai-quality-v147-report.mjs .taskmaster/scripts/test-ai-quality-v147-report.mjs`다. 최초20통과와 그룹별 실패 집계/가용성 불명 보완 후 최종20통과를 별도로 보존했다.

최종 소스·참조·로그·합성 보고서 지문은 `.taskmaster/docs/ai-quality-v147-report-preparation.json` 및 `ROOT:outputs/ai-quality-v147-implementation-20261106/phase11/report-checks.json`을 따른다. 모든 입력 점수는 가공한 계산 fixture이며 실제 신규 AI 평가 결과가 아니다. 새 문항/제공자 호출/과금 승인·사용0이다.

현재 상위21/40·세부68/133 완료(취소1/3 포함)다. Task Master 재조회가 지목한 다음 작업 T34 위험 허용치·표본·반복·판정 사전 설계를 시작했다. 제품547입력은 그대로여서 기존879/879·타입/린트/문법/빌드 근거를 지문으로 대조하여 재사용한다. 실제 모델/학습/운영 품질·전체 목표는 미완료다. 미병합 산출물 삭제·배포·Git 작업은0이다.


## T34 · 위험·표본 설계 초안과 계산 검증 · phase12

`docs/AI_QUALITY_V147_RISK_DESIGN_DRAFT_20261106.md` 및 `.taskmaster/docs/ai-quality-v147-risk-design-draft.json`에 모집단/피해/층/가족/반복/paired 효과/비교·중단/검토/호출 상한과 미결 조건을 작성했다.6층·3모델의114개 단측 bound를 미리 정한 보수적 민감도 설계다. 이는 가능한 설계 예시이며 아직 위험 한도·N·반복·주장 범위를 선택하거나 승인하지 않았다. 개인 학습 기록으로 서비스 분포를 추정하지 않는다.

계산 도구 `ai-quality-v147-risk-design.mjs`와 회귀 검사는 Node22/24 각9/9·실패/skip0·exit0,전용 ESLint3파일 오류/경고0·exit0이다. 설치 SciPy1.16.3으로 독립 생성한 표본54·paired 구간56개와 대조했으며 최대 차이 약5.31e-13이다. N0오류 경계 반올림 차이의 최초8/9 실패를 보존하고,등호 근처에서는 가족1개를 더 계획하는 보수적 경계 처리를 추가했다. paired4tail을 쓰면서3개 이하의 tail만 배정하면 거절한다. q1 참조는 같은95% 개별 tail이80%4tail 배정에 해당함을 명시해 비교했다. 최초 소스/시험·최초 실패·중간9통과·최종final2 각9통과는 덮어쓰지 않았다.

`N=ceil(log(alpha/114)/log(1-riskLimit))`은0오류일 때의 조건부 정밀도만 설명한다.6층 각770개라는1% 예시는 총4620독립 가족과2반복·기준/후보·3모델·전수 채점/보정의110916회 상한을 뜻하지만,독립 가족 작성/검토 가능성·개선 효과 검정력·단가/비용을 보장하지 않는다. 실행 권고나 과금 승인이 아니다. 독립성 없는 문항을 늘리거나 결과 후 기준을 낮추지 않는다. [NIST의 고정 유한 비교 부등식](https://www.itl.nist.gov/div898/handbook/prc/section4/prc473.htm),[정확 이항 구간](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm)과 설치 참조의 가정/범위를 구분했다.

T34는 review이며1~3단계 초안도 review,독립 기준 도전/승인4단계는 pending이다. 위험 한도/주장 범위 승인,실제 가족 추출 타당성·수업/난도 배분,개선 범위/최소 효과와 정밀도,자격 있는 검토자,단가/토큰·검토 예산을 확정하기 전 done 처리하지 않는다. riskDesignApproved/sampleJustified=false,출시 held 유지다. 다음 가능한 독립 작업은 Task Master가 지목한 T16 동결·변경 탐지 프로토콜이며16/16.1을 시작했다.

상위21/40·세부68/133 완료 수는 그대로다(취소1/3 포함). 실제 신규 문항/제공자 호출·과금 승인/사용0,운영 QA/게시/Git/산출물 삭제0이다. 제품547입력이 같아 기존 phase5 전체879/879·타입/린트/문법/빌드와 phase6 실제 합성 Worker,phase9~11 도구 근거는 지문 대조로 재사용한다. 재현은 새 QA_OUTPUT_DIR에서 `node --test .taskmaster/scripts/test-ai-quality-v147-risk-design.mjs`이며 현재 근거는 `.taskmaster/docs/ai-quality-v147-risk-design-preparation.json`·`ROOT:outputs/ai-quality-v147-implementation-20261106/phase12/risk-design-checks.json`이다.


## T16 · 평가 조건 동결·실제 본문 변경 탐지 · phase13

`.taskmaster/scripts/ai-quality-v147-freeze.mjs`·동명 회귀 검사를 추가했다. 기준/후보 소스·빌드,런타임,문항,채점 기준,본문 작성기,모델 옵션,가격,예약 한도,수집 규칙,위험 기준의13개 지문과 비밀을 제외한 실제 실행 환경·슬롯·순서를 runId에 묶는다. 예산 spec은 sourceSeal을 제외한 outline을 limits 지문으로 만들고 freeze hash를 sourceSeal로 참조하므로 자기 참조를 피한다. 별도 승인은 최종 spec/run 지문에 묶으며 기존 원장을 바꾸지 않는다.

`captureFreezeFiles`는 지정한 닫힌 입력 트리와 개별 파일의 실제 경로·전체 목록·바이트를 읽고 지문을 낸다. 파일 추가/제거·공백/개행 변경도 탐지한다. traversal·Windows ADS/별칭·junction/symlink·hardlink는 거절한다. .env 계열/.sites-runtime/.wrangler/.git 내부를 root로 넘기는 경우도 파일 접근 전에 거절한다. work/outputs 아래의 이 도구 전용 합성 fixture는 허용된 root로 명시하지만 상대 입력 경로로 work/outputs를 재귀 탐색하지 않는다. 원장/비밀/개인 학습 내용은 스냅샷에 복사하거나 출력하지 않는다.

소스/본문/모델/순서/가격/환경이 달라지면 합성 키 콜백이나 전송 전에 실패한다. 고정 본문은 JSON 의미 지문과 정확한 UTF8 바이트를 모두 비교해 JSON 키 순서·공백·형식 변화도 잡는다. 새 동결 파일은 runId-freeze.json에 wx/쓰기/fsync로 생성하며 기존 파일은 덮어쓰지 않는다. [Node fs](https://nodejs.org/api/fs.html)와 [crypto](https://nodejs.org/api/crypto.html)의 API를 확인했고 현재 웹 문서26과 실제 검증 Node22.23.4/24.22.1을 구분했다. 파일 fsync 검사는 전원 장애·디렉터리 영속성 보증이 아니다.

미래 생성 결과가 들어가는 채점 본문을 실행 전에 이미 고정했다고 주장하지 않는다. 대신 대상 입력/참조 기준·명령·스키마/옵션을 담은 정확한 template과 한도를 먼저 고정한다. 한 생성 슬롯의 보관된 visible 응답 바이트·요청/영수증/소스 지문을 연결해 feedback 위치만 결정적으로 삽입하고,채점 전 정확한 본문 바이트를 별도로 고정/재검증한다. 부모 변경·다른 원문·자가 채점·잘못된 순서·template/본문 변화는 실패한다. 이 무결성 검사는 신뢰할 수 없는 영수증의 실제 출처를 인증하지 않는다.

현재 synthetic dispatcher는 알려진 고정 본문에 대해 기존 T17/T18의 예약·durable consumed·일회 전송과 연결했다. consumed 이후 키 콜백 전 변화는 키 읽기/전송0으로 보류하며,합성 키 콜백 중 생긴 변화도 전송 전에 다시 검사한다. consumed 최대 예약은 유지하고 재전송하지 않는다. evaluation 모드와 가짜 키 상수가 아닌 반환은 실제 전송을 활성화하지 못한다. 실제 키 경로/제공자 API를 읽거나 실행하지 않았다.

중요한 후속 경계: 기존 v1 예산 descriptor는 승인 전에 정확한 bodyCommitment를 요구한다. 미래 응답에 의존하는 judge를 실제로 예약/결합하는 절차는 T22에서 통합해야 한다. 현재 v1의 보호나 오래된 spec/승인을 완화·마이그레이션하지 않았다. 구성 지문은 호출자가 실제 파일/환경에서 매번 다시 관측해야 하며 캐시한 옛 지문을 되돌려서는 안 된다. 최종 실제 입력 집합의 완전성은 T24에서 실제 build/metafile 의존성과 비교한다. 해시 일치만으로 문항/영어·가격의 타당성이나 모델 서비스 내부 불변을 증명하지 않는다.

검증은 SOURCE Node22/24 각각16/16과 관리 ROOT Node24 재현16/16,실패/skip0·exit0,전용 ESLint 오류/경고0·exit0이다.13개 구성 요소 각각의 변조에서 키/전송0·기존 원장 바이트 보존을 확인했다. 임시 합성 파일의 실제 변경·파일 추가/이동·실제 junction/hardlink,본문 공백/키 순서·스키마/옵션,새가격/토큰 한도,부모/채점 template 변화와 중단 후 재전송 거절을 확인했다. 합성 fixture 이동은 해당 전용 절대 경로 안인지 확인한 오류 주입이며 원본 바이트는 보관했다. 브랜치 산출물 정리가 아니다.

실제 현재 앱 어댑터를 SOURCE에서 번들해 단어/문법×3모델의 본문6개를 합성 제공자에서 가로채 검사했다. ROOT에서 실행해도 SOURCE/reference-v6을 사용하도록 esbuild absWorkingDir도 고정했다. 기존 phase6 실제 전체 Worker의 합성 본문14개는 원래 해시를 대조해 새 gate에 재생했다. 새 Worker 실행이나 새 실제 응답 수집이 아니다. 최초13/14 실패는 가상 esbuild stdin을 파일로 읽은 검사 오류였으며 수정 후15/15와 이후16/16 각 버전을 보존했다. 현재 최종 근거는 phase13 final3 로그·소스 지문이다.

재현은 매번 새 QA_OUTPUT_DIR에서 `node --test .taskmaster/scripts/test-ai-quality-v147-freeze.mjs`다. 사용 예시는 다음과 같다.
```javascript
const inputs = captureFreezeFiles({root: SOURCE, trees: ['app','lib','drizzle'], files: ['package.json','package-lock.json']});
// 이 목록은 사용 예시다. 실제 빌드/모든 동결 입력의 완전한 목록은 T24에서 검토한다.
const sealed = sealFreeze(observation); // strict observation 안 sourceCandidate 등은 실제 inputs.hash에 연결
writeFreezeExclusive(absoluteRunIdFreezeFile, sealed);
verifyFreeze(sealed, observeFreshConditions());
verifyFrozenWire({seal: sealed,current: observeFreshConditions(),key,raw});
```
실행·원점수·예산·실패/복구 이력은 새 runId/새 승인으로 분리하며 이전 동결 파일은 유지한다. 상세 계약/검증 지문은 `.taskmaster/docs/ai-quality-v147-freeze-preparation.json` 및 `ROOT:outputs/ai-quality-v147-implementation-20261106/phase13/freeze-checks.json`을 따른다.

T16 로컬 도구는 완료했다. 상위22/40·세부71/133 완료(취소1/3 포함),다음 T22 무과금 실행기 통합 진행 중이다. T34 위험 설계는 review로 미완료다. 최종 실제 평가 동결·새 문항/AI 품질 검증은 수행하지 않았고 실제 호출/키 접근·추가 승인/사용 US$0,운영QA·게시·Git·브랜치 산출물 삭제0이다. 제품547입력이 그대로라 기존879/879·타입/린트/문법/빌드 근거는 지문 대조로 재사용한다.


## T22 · 별도 v2 예산·실제 채점 본문 결합 기반 · phase14 · 진행 중

`.taskmaster/scripts/ai-quality-v147-budget-v2.mjs`·`ai-quality-v147-wire-v2.mjs`와 회귀 검사를 추가했다. 기존 v1의 모든 bodyCommitment는 승인 전 정확한 본문을 뜻한다. 미래 응답을 넣는 judge에 이 뜻을 뒤늦게 바꾸지 않고 별도 `ai-quality-v147-pilot-v2` spec/승인/원장/UUID로 분리했다. 과거 또는 현재 v1 소스·원장·잔액·승인을 수정하거나 변환하지 않았다.

생성+채점의 최대 비용을 같은 batch에서 먼저 예약한다. 채점 template과 입력/출력/본문 크기 한도는 승인 지문에 들어간다. 생성 슬롯이 완료되고 해당 요청의 결과·보관 증거가 연결된 뒤에만,그 부모 UUID/출력/영수증 해시와 실제 채점 본문을 reserved 슬롯에 한 번 결합할 수 있다. 결합 전 consume·자가 채점·다른 문항/phase/반복 부모·별도 나중 예산 예약·재결합은 거절한다. 실제 정적 본문과 template/부모 응답은 T16과 연결해 바이트까지 재검증한다.

돈/상태 계산에는 기존 v1 순수 엔진을 비공개 계산 view로 재사용했다. 외부 v2의 protocol/spec/승인/원장/슬롯 UUID를 먼저 검증하고,계산 후 외부 v2 ID를 유지한다. 내부 view는 저장/전송용 spec이나 승인으로 반환하지 않는다. v1 spec/승인/원장을 v2로 제출하면 거절한다. 실패/불명/누락 usage는 최대 예약을 유지하고 사용량 초과·승인 철회는 다음 결합/전송을 막는다. 닫기는 미발송만 unused로 하며 사용된 비용은 보존한다. 닫힌 원장의 영수증 정산과 새 발송을 구분한다.

T20 진단을 재사용하되 반환하는 specHash/UUID는 검증된 외부 v2 ID다. 원문 오류 메시지/개인 문장/비밀·토큰은 진단에 포함하지 않는다. 전송 여부 불명·402/429는 stop-run/never-resend를 유지한다.

검증은 Node22.23.4/24.22.1 각각20/20·실패/skip0·exit0,전용 ESLint4파일 오류/경고0·exit0이다.756슬롯(생성360/채점360/보정36) 계획과 역할 상한·하나의 생성/채점 쌍 선예약을 검증했으며 실제756건을 수집한 결과는 아니다. 별도 ID·단일 결합·부모/본문/사용량 변조·승인0·전액 부족·중복·닫기/철회·미상 최대 예약·T16 바이트/참조 변경을 대조했다. 본문 연결 최초5개 중2통과·3실패는 정적 요청 시험에 채점 template 인자를 함께 넘긴 fixture 오류였으며 거절 보호를 유지한 채 시험 호출을 바로잡았다. 최초/최종 로그와 이전 fixture를 각각 보존했다.

재현은 매번 새 QA_OUTPUT_DIR에서 `node --test .taskmaster/scripts/test-ai-quality-v147-budget-v2.mjs .taskmaster/scripts/test-ai-quality-v147-wire-v2.mjs`다. 순수 사용 순서는 `prepareV2Wire(...)`가 반환한 bindOperation을 `transitionV2(...)`에 적용한 뒤 consume하는 것이다. 이 코드는 아직 디스크에 commit하거나 키/네트워크를 호출하지 않는다.

**T22는 미완료**다. 다음은 v1 기본 동작을 보존하는 고정 protocol registry로 v2 내구 journal을 연결하고,payload/영수증/결합/consume 저장 순서·재시작·강제 종료/경쟁/실제 EPERM·추가 발송0·CLI/Worker 전체 수집·집계·소유 자원 종료를 통합 검증하는 일이다. 실제 토큰 상한 근거·단가/영수증 출처 인증과 실제 평가 승인은 별도이며 현재 proof가 이를 증명하지 않는다. 기존 v1 store/recovery/dispatch는 이 단계에서 그대로다.

기록은 `.taskmaster/docs/ai-quality-v147-executor-preparation.json` 및 `ROOT:outputs/ai-quality-v147-implementation-20261106/phase14/executor-v2-core-checks.json`을 따른다. 상위22/40·세부71/133 완료 수는 그대로(취소1/3 포함),22/22.1 in-progress·T34 review다. 새 문항/실제 AI/키 접근·추가 승인/사용 US$0,운영 QA/게시/Git·산출물 삭제0이다. 제품547입력과 기존 v1 도구를 그대로 유지하여 기존879/879·타입/린트/문법/빌드와 phase6/9~13 근거는 지문 대조로 재사용한다.


## T22 · v2 변경 이력 저장·소유 세션·중단 감지 · phase15 · 진행 중

`.taskmaster/scripts/ai-quality-v147-journal-v2.mjs`·회귀 검사를 추가했다. phase14에서 예정한 v1 registry 확장 대신 별도 v2 저장 경로를 선택했다. 기존 v1 저장/전송/복구 코드를 그대로 보존하고 경로/프로세스 소유 확인 helper만 재사용한다. 실제 v1 원장/잔액·승인을 변환하지 않는다.

CHAIN.jsonl에는 첫 spec/승인 이후 상태 변경만 이전 기록/상태 지문과 함께 추가한다. 한 프로세스가 실제 PID/시작/명령/실행 파일·실행/경로/소스 지문에 묶인 LOCK을 독점한다. 세션의 상태 반환은 복사본이며 직접 고쳐도 내부 원장이 바뀌지 않는다. 매 상태 조회/추가에서 실제 로그 전체 바이트 지문·HEAD·소유권을 검사한다. 길이/mtime가 같다는 이유로 내용을 신뢰하지 않는다. 시작/명시 감사/종료 때는 전이 전체를 다시 계산하여 같은 상태인지 확인한다. 실제756수집의 성능·완료를 검증한 것은 아니다.

저장 순서는 PENDING 새 파일 쓰기/fsync→로그 append/fsync→임시 HEAD 쓰기/fsync→HEAD 원자 교체→정확한 readback이다. 기존 로그를 덮거나 자르지 않는다. 저장 중 오류는 세션을 보류하며,쓰기 후 HEAD가 변조된 경우도 성공을 반환하기 전에 거절한다. 정상 종료 시 소유 LOCK과 확정된 PENDING만 운영 절차로 제거하며,불완전 로그/임시 파일은 보존한다. 이는 브랜치 산출물 정리가 아니다.

`inspectV2Pending`은 이전/다음 HEAD·완전한 append 바이트·동일 spec/소유자·정당한 전이·임시 HEAD를 읽기 전용으로 대조한다. 아직 파일을 복구하거나 죽은 LOCK을 빼앗는 함수가 아니다. 기존 프로세스가 종료되어도 미완성 쓰기는 보류한다. 실제 준비된 파일을 안전하게 확정하고 영수증과 연결하는 명시적 복구는 다음 구현 범위다. 물리적 전원 장애·디렉터리 fsync 영속성이나 외부에서 전체 파일시스템을 완전히 되돌리는 공격 방어는 증명하지 않는다.

Node22.23.4/24.22.1 각각12/12·실패/skip0·exit0,전용 ESLint 오류/경고0·exit0이다. 각 런타임에서 실제 자식 프로세스를10개 쓰기 경계에서 exit76으로 종료하고 PID 부재를 확인했다. 승인0·잘못된 protocol·legacy HEAD·미결합 consume·현재 HEAD 되돌리기·기존 로그 바이트 변조/mtime 복원·연결된 로그·다른 파일·쓰는 중 context 변경을 거절했다. 두 실제 프로세스의 시작 경쟁에서 소유1/거절1·둘 다 exit0이었다. 생성/채점 선예약→결합→consume→결과 정산→judge→close의8개 전이를 디스크에 기록하고 원래 상태로 재계산했다. close 뒤 새 reserve/consume은 실패하며 이미 보낸 요청을 다시 보내지 않는 실행기는 아직 연결하지 않았다.

최초10/10 통과·lint1경고(미사용 import)는 원래 로그로 보존했다. import를 제거하고 커밋 후 readback·legacy HEAD의 잠금 전 거절 대조를 추가하여 최종12/12를 확인했다.20개 중단 실행의 원시 파일 지문은 `phase15/process-raw-preservation.json`으로 다시 대조했다. 미완성 파일·죽은 소유 LOCK은 시험 근거로 보존했고 실제 실행 자식 프로세스는 종료했다.

재현은 새 QA_OUTPUT_DIR에서 `node --test .taskmaster/scripts/test-ai-quality-v147-journal-v2.mjs`다. API 순서는 `createV2Journal(context,approval)`→`openV2Journal(context)`→`session.append(operation)`→`session.audit()/close()`다. 먼저 `prepareV2Wire`가 만든 bindOperation을 저장한 뒤 consume해야 한다. `abandon()`은 소유 세션만 해제하고 불완전 파일은 보관한다. 초기화/재시도/복구 성공을 뜻하지 않는다.

현재 근거는 `.taskmaster/docs/ai-quality-v147-journal-preparation.json`과 `ROOT:outputs/ai-quality-v147-implementation-20261106/phase15/journal-v2-checks.json`이다. phase14 순수 예산/본문20검사와 기존 v1/제품547입력은 그대로여서 이전 근거를 지문으로 대조한다. T22/22.1은 계속 in-progress,상위22/40·세부71/133 완료(취소1/3 포함)이며 T34 review다. 아직 결과 payload/영수증 저장·명시 복구·일회 전송·전체 CLI/Worker 수집/집계/소유 자원 정리까지 연결하지 않았다. 실제 신규 AI/키 접근·추가 승인/사용 US$0,운영 학습 QA/배포/Git·브랜치 산출물 삭제0이다.


## T22 · 응답 보관·명시 복구 · phase16 · 진행 중

capture-v2/recovery-v2 도구와 집중 회귀 검사를 추가했다. 이전 phase14/15 구성요소 근거·v1 저장/복구와 닫힌 원장은 그대로다. 정상 생성의 사용자 표시5필드와 채점 rubric 결과만 보관하며,request UUID·본문/소스·결과·사용량·payload 바이트 지문을 같은 consumed 슬롯에 결합한다. prepared metadata→payload→동일 receipt를 배타 생성하고 각각 fsync/readback한다. 이는 실제 제공자 영수증·청구 사용량의 출처 인증이 아니다.

복구는 자동 재발송과 분리했다. inspectV2Recovery(context)로 실제 PID/시작/명령/실행 파일 소유자 부재·원래 HEAD/로그·정당한 준비 전이·정산 응답을 먼저 대조한다. 받은 inspectionHash를 recoverV2Journal에 전달해야 하며 검토 이후 바이트가 바뀌면 거절한다. 실제 Windows named mutex를 소유한 helper가 정확한 옛 LOCK을 보관하고 새 프로세스 소유 LOCK 안에서 fsync·HEAD 교체·PENDING 보관을 수행한다. 중단된 복구자의 audit/LOCK 연결도 대조하며 옛 원시 바이트와 실패 이력을 유지한다. 정상 소유 LOCK 해제와 정확한 PENDING 보관은 실행 절차이며 브랜치 산출물 정리가 아니다.

Node22.23.4/24.22.1 각각12/12·실패/skip0·관측 exit0이다. 각 실제 쓰기 자식17개를 exit78·복구 자식3개를 exit79로 종료하고,두 복구자가 경쟁할 때 성공1/오래된 inspection 보류1을 확인했다. 실제 Windows HEAD deny-delete 핸들에서 EPERM이 발생했고 해제 후 같은 consumed UUID로 복구했다. 응답 검증을 제거한 별도 격리 사본은 변경된 payload를 수용하지만 원본은 거절했다. 원본 소스는 그대로이며 변조 사본은 시험 근거로만 보관한다. 합성 발송 표시 수가 복구로 늘지 않았다는 검사이며 아직 전체 가상 제공자 실행기 검사는 아니다.

최초10/10·lint미사용 import1경고,후속12/12 로그와 최초 소스는 보존했다. 최종 실행의 종료 상태 조회가 이어지지 않아 새 observed 경로로 다시 실행해 종료 코드까지 기록했다. 예전 경로는 덮지 않았다. 최종 전용 린트는 오류/경고0·exit0이다. capture-recovery-v2-checks.json 및 raw-preservation.json은 새 응답·중단·보관 디렉터리·대조 사본의 지문을 보존한다.

재현: 새 QA_OUTPUT_DIR에서 node --test .taskmaster/scripts/test-ai-quality-v147-recovery-v2.mjs. 운영 순서는 소유 session의 consumed 상태에서 captureResultV2→settleCaptureV2이며,중단 시 inspectV2Recovery→명시 recoverV2Journal→같은 capture 정산이다. 로그가 부분 기록됐거나 payload가 누락·손상되면 최대 비용을 유지하고 보류하며 초기화·잘라내기·재조회·재발송하지 않는다. 물리적 전원 장애/디렉터리 fsync·전체 파일시스템 되돌리기는 미검증이다.

T22/22.1은 계속 in-progress·상위22/40·세부71/133 완료,T34 review다. 전체 일회 전송·CLI/실제 built Worker756슬롯 수집·실패 분류/보고·소유 자원 종료 통합은 남았다. 실제 평가 입력 동결/토큰 상한·단가/영수증 출처·독립 영어 검토·유료 승인도 별도다. 현재 synthetic 모드만 지원하며 실제 AI/키 접근·신규 승인/사용 US$0,운영 QA/배포/Git·브랜치 산출물 정리0이다.


## T22 · CLI/Worker 통합 진행,전체756 가상 수집 보류 · phase17

executor-v2·명시 --synthetic 전용 CLI·고정 fixture·journal-report 연결과 두 집중 검사를 추가했다. 실제 제공자 모드는 거절하며 외부 키/승인/옛 원장을 탐색하지 않는다. 전체 쌍 선예약→동결 본문 결합→디스크 consume→한 번의 가상 전송→응답/영수증→정산→같은 부모 표시5필드로 채점→종료→고정 분모 집계를 연결했다. 실제 Node/platform/arch와 고정 본문을 발송 직전에 대조한다.

최종 Node22.23.4/24.22.1 각11/11·실패/skip0·exit0이다. 승인0·실제 runtime/조건/가격·본문 변경·모호 전송·잘못된 모델/필드·사용량 초과를 검사했다. 실제 별도 CLI의 작은 쌍은 최초2발송/닫힌 재시작0,경쟁은 완료1/거절1이다. 네 CLI 경계에서 실제 exit81 후 명시 원장/capture 복구의 추가 발송0·같은 UUID를 확인했다. 원본8검사와 후속10검사도 보존했다. 잘못된 payload/grade가 저장 실패로 분류되던 catch를 형식 오류로 바로잡고 집중11검사를 다시 실행했다. 유효 응답 경로는 전체 시도 때 소스와 바이트 동일함을 대조했다. 그때 로드한 원본6소스는 full756-original-source에 보존한다. 실제 Worker 성공 경로도 같아 재실행하지 않았다.

actual built Vinext/workerd는 기준판/수정판×3모델×단어/문법12흐름의24슬롯을 통과했다. v2 consumed UUID가 실제 API·D1 영수증으로 이어졌고 표시5필드가 같은 부모 채점에 결합됐다. 각 생성 본문은 phase6의 동결된 실제 Worker 본문과 바이트 일치했다. Worker의 가상 제공자 인터셉트12개·Node 고정 채점12개이며 반복 수집 추가0·첫 답 보존·소유 Worker2개 종료를 확인했다.756개 Worker 검사나 새 UI/실기기 검사가 아니다.

전체756개 가상 CLI 시도는709완료·1consumed 미해결에서 안전 보류되고 원장이 닫혔다. 종료 상태는 exit1이며 성공 검사로 바꾸지 않는다. 실패 슬롯은 candidate/gpt-6-astra/fixture-case-037/judge/1,고정 요청/UUID는 기록된 결합과 같고 해당 UUID는 가상 공급자 발송 로그에 없었다. 실패 원인은 unknown이다. 시간초과나 HTTP 거절로 추정 확정하지 않는다. 마지막 요청은 최대 비용을 유지하고 재발송하지 않았다. 고정360개 결과 보고서는 candidate Astra36/60·미측정24와 나머지 고정 분모를 유지했다. 이 숫자는 가상 응답의 집계 검사이며 실제 영어 품질이 아니다.36개 채점기 보정은 공개 증인의 기대값을 반환하는 고정 oracle이며 실제 모델 보정 능력도 미측정이다.

장시간 실행은 summary/report를 저장한 뒤 소유 종료 감사가 진행 중이었다. 실제 PID/시작/명령/실행 파일 지문이 기록한 소유자와 같음을 확인한 다음 소유 프로세스만 종료했다. 종료/원시 LOCK·원장·요청·응답·보고서를 모두 보존하며 branch 산출물 정리나 원장 초기화로 처리하지 않았다. 다음은 가상 공급자 내부 실패의 제한된 식별자를 기록하여 새 namespace에서 재현하고 전체 수집을 완료하는 일이다. 닫힌 실행의 미확정 UUID를 재전송하지 않는다.

제품547입력과 빌드814파일을 다시 대조했고 phase5의 Node22/24 각879/879·타입/린트(기존15경고)/문법/빌드7명령 exit0을 재사용한다. 새 .taskmaster 도구는 별도 검사했다. T22/22.1은 계속 in-progress,상위22/40·세부71/133 완료(취소1/3 포함),T34 review다. ai-quality-v147-integration-preparation.json 및 phase17/executor-integration-partial-checks.json을 따른다. 전체 목표·실제 영어 품질·출시는 미완료이며 실제 AI/키 접근·신규 승인/사용 US$0,운영 QA/배포/Git·미병합 산출물 정리0이다.

최종 화면 대조에서 current execution의 기본 문구가 예전 플랜의 유료 평가/배포 승인 표현을 재사용함을 확인했다. registry.context만으로는 실제 plan.context가 바뀌지 않았다. 기존 normalizer가 지원하는 manifest.execution.dashboardContext에 현재709+1보류·추가 승인 US$0을 명시하여 수정했다. 핵심 normalizer나 과거 플랜은 바꾸지 않았다. 실제4318 응답에709와 승인0이 표시됨을 별도 확인하고 두 엔진27검사를 새 출력 경로에서 재실행했다.


## Phase18 · T22 무과금 전체 수집과 T23 최종 제품 검증

- 새 loopback synthetic HTTP/CLI3는 매 요청 연결을 닫고 안전한 유한 오류 식별자만 기록한다. 실제 socket 장애 대조에서 재사용 연결12시도 중6실패,요청별 닫기12/12성공. 이는 통제 재현이며 phase17 최초 실패 원인을 확정한 근거는 아니다. 기존709완료+1소비 미해결 원장은 닫힌 상태/exit1/원인 미확정으로 보존하고 재전송·초기화하지 않았다.
- 새 독립 가상 실행 `006186e3-e704-4e3b-a47f-993aa505aec1`:756/756수집·고유UUID756·미해결0·HEAD2665·닫힘·실행프로세스exit0. 매 요청 실제 loopback socket756개,client-failure0,server stop1. 마지막 close 이벤트는 종료 뒤 억제되어 close 로그755개이며 이를756개라고 세지 않는다. 기존실행과 합산하지 않는다. 새 HTTP/CLI3 Node22/24 각11/11 exit0,실제 자식exit82 4지점/동시소유/닫힌 재실행 추가발송0 포함. 실모델 채점·영어 품질·실제 승인/청구 검증이 아니다.
- 최종 제품 백업 UI 회귀에서 WebKit 초점 실패를 재현했다. 메뉴 항목이 사라진 뒤 history 복원이 H1을 선택하는 흐름과 백업창의 직접 focus가 경쟁했다. 제품 `app/backup-dialog.tsx`,`app/backup-export-dialog.tsx` 두 파일만 기존 destination 우선순위 복원기로 연결했다. 복원/내보내기 데이터·API·SQL·학습 성적 규칙은 바꾸지 않았다.
- 원래3초 초점 조건을 유지한 실제 Chromium/WebKit 각12기능+6axe 검사:총24기능/12접근성 통과. 3MB+/650기록·revision 충돌·기기초안·서버실패·기존 방식 응답소실·새 enabled job commit 응답소실의 GET복구/한번반영·내보내기 닫기/다운로드를 포함한다. AI 비활성,실제 키/모델/운영 학습 접근0. 관찰 listener가 있던 진단 통과는 별도 변형으로 보존하고 최종 통과 근거로 대체하지 않았다.
- phase18e 최종547입력에서 Node22/24 각879/879,타입·린트(기존15경고/오류0)·문법자료·manner-index·전체빌드 7명령 exit0. 직접 최종 로그/코드/해시를 확인했다. 초기 격리 빌드의 출처 문서/CSS 누락과 공유 braces guard 실패는 phase18b–18d에 보존했다. 최종 전용 braces는 원본과 동일하고 guard를 우회하지 않았다. 통과 후 변하지 않은6검사 로그는 지문 대조로 재사용했다.
- 새 실제 built Worker/D1/API/브라우저24그룹 통과,가상 provider14개(기준선7/후보7),두 동일UUID 응답소실 복구 포함. 처음 로컬 D1 시작 실패는 provider0인 채 보존했다. 기존 인자의 전용 runtime base를 짧게 지정한 재실행에서 같은 검사가 통과했으며 native 오류의 정확한 원인은 미확정이다. 소유 Worker/리스너 종료를 확인했다. 이전70초안/교정 React 검사 입력은 변경이 없어 그 범위의 근거를 유지하며 전체 Worker 검사로 표현하지 않는다.

현재 후보 빌드는 `ROOT/work/ai-quality-v147-product-build-20261106-phase18-final/dist` 407파일이다. 제품547입력이 SOURCE와 일치한다. 이전 SOURCE/dist와 기준선/dist 814파일은 동결 근거이므로 덮어쓰지 않았다. SOURCE/dist를 최신 후보로 오인하면 안 된다. 후속 최종평가 동결/게시 준비는 이 후보와 입력 지문을 다시 연결해야 하며 현재 실제 평가 동결은 false다.

Task Master native에서 T22/22.1–3 및 T23/23.1–3을 done으로 갱신하고 기존4태그를 원래 객체로 보존했다. 상위24/40·세부77/133 완료(취소1/3),T34 review·승인0,다음 실행 가능 task 없음. T24는 T34 위험/표본·독립 검토 조건이 갖춰져야 진행한다. 새 실제 유료 AI 예산/사용 US$0·키읽기0·운영 학습 조회/쓰기0·배포/commit/push/PR0. 전체 목표/실제 영어 품질/학습 효과/출시는 완료되지 않았다.

| 보관·복구 범위 | 처리 | 근거/검증 |
| --- | --- | --- |
| 제품2파일·회귀 도구·합성 fixture | 유지 | Node22/24 각879,실제 두 엔진24+axe12,Worker24 통과 |
| phase17 닫힌709+1원장·phase18 새756원장·초기 실패/복구/승인 근거 | 보존 | raw hash 명세와 별도 run ID;옛 원장 재사용0 |
| 이전814빌드와 새407후보·전용 빌드 폴더 | 보존/정리 보류 | 미병합·후속 평가/복구 참조 존재;일괄 work/outputs 삭제0 |
| 소유 테스트 프로세스/리스너·런타임 lease | 실행 종료 | 명시적 소유 자원만 정리;브랜치 산출물 정리와 구분 |

롤백은 `phase18/product-before`의 두 컴포넌트 원본과 비교하여 필요한 파일만 복구 후 빌드/관련 UI를 재검사한다. 저장 형식/SQL 변경0·마이그레이션0·Site/DB/R2 변경0·새 진단 이벤트0. 초점 이동의 기기별 차이와 실제 iPhone/VoiceOver는 미검증이다. 운영 게시와 전체 산출물 정리는 실행하지 않았다.


### 사용자 후속 제약 · AI-only 검토

사용자는 사람 영어 검토자가 현재/향후 없으며 AI가 판단하도록 지시했다. [AI-only 평가 정책](AI_QUALITY_V147_AI_REVIEW_POLICY_20261106.md)을 현행 검토 방식으로 추가하고 T24/25/27/34–37/40과 AQ-L/Q의 사람 섭외 필수 조건을 변경했다. 기존 문장의 독립 영어 검토자 미확보는 당시 상태다. 현재 장애물은 사람 섭외가 아니라 AI 채점 타당성/출처·불일치/편향 통제·새 위험/요청/비용 설계다. 방법 선택은 허용됐지만 위험 허용치/유료 호출/출시 승인은0. 사람 영어 검수·실제 학습 효과는 미검증으로 남기며,AI 합의나 그 신뢰구간을 인간 정답 정확도로 해석하지 않는다. 새 정책은 문서/계획 반영 단계이며 실제 다중 AI 평가를 실행한 근거가 아니다.


## Phase19 · AI-only 교차 채점 로컬 구성요소

사용자 제약을 실제 코드로 연결했다. `.taskmaster/scripts/ai-quality-v147-ai-panel.mjs`는 생성 모델 외 두 모델이 각각 input-first/feedback-first 두 본문 순서로 평가하는 패널을 컴파일한다. 공개 요청에는 모델/버전/기존 원점수·숨은 이유·부모 영수증을 넣지 않으며,문장/설명/참조 인용은 신뢰할 지시문과 구분한다. 문구 자체의 정보 노출 가능성이 있어 부분 가림으로 한정한다. 이는 실제 AI의 주입 저항이나 순서/길이 편향 해소를 입증한 결과가 아니다.

5차원과4중대 플래그의 엄격한 JSON 스키마/파서를 사용한다. JSON 중복 키(이스케이프 철자 포함),다른 요청/모델/본문/근거 지문,중복/알 수 없는 슬롯을 거절한다. 하나의 중대 오류·누락·실패·불확실·미해결 참조는 보류한다. 3합격:1실패는 보류하고4원점수를 유지한다. 일치한 실패는 실패,일치한 합격은 `ai-consensus-pass`이며 영어 정답 보장·출시 통과가 아니다. 모델/버전/단어·문법/3유형 36셀과 고정 분모를 보존한다. 독립 가족 수나 인간 판정 정확도를 임의로 산출하지 않는다.

- Node22.23.4/24.22.1 집중23/23각 exit0. 첫 Node24는16/23·exit1이었다. 가시 응답이 없는 본평가를 발송하지 않는 규칙이 ‘응답 없음’을 알아보는 보정 증인까지 생략해72중66개가 된 결함이었다. 보정/본평가의 dispatch 적격성을 구분한 뒤 두 Node가 통과했다. 첫 코드/테스트/로그를 보존했다.
- 이전 phase18의 닫힌 가상 생성 원장/캡처를 읽어360출력의 부모 영수증 지문을 연결했다. 실제 loopback HTTP에서 새1512요청(교차1440+보정72)을 처리하고,본문 변조1/중복 요청1거절·불일치1보류·359가상 합의·원점수1440개 유지·서버/포트 종료를 확인했다. 모든 응답은 가상 oracle이며 모델 성능을 측정하지 않았다.
- 첫 검사는 원장 전체를 재생 검증했다. 최종 검사는 그 결과의1083개 파일을 전부 바이트 해시 대조한 뒤 같은 부모 캡처를 재사용했다. 부모/근거 지문과1512본문 SHA가 첫 실행과 동일하다. mtime 캐시나 제품 복구 경로를 추가하지 않았다. 새 모델 요청을 기존 원장에 기록하거나 옛 슬롯을 재발송하지 않았다.
- 새3파일 명시 린트 최종0오류/0경고 exit0. 첫 린트의 미사용 import1경고도 보존했다. 제품547입력과 이전814빌드/새407빌드가 그대로여서 phase18e Node22/24 각879·7명령과 실제 브라우저24/접근성12/Worker24 근거를 지문 대조로 재사용한다.

호출 규모:기존360생성에 2다른judge×2순서1440채점+12증인×3judge×2순서72보정=1872소계다. 문항작성60+참조검토120을 포함한 예비2052안도 계산했다(나열한 역할은 모델별684). 이는 승인 상한/확정 프로토콜이 아니다. 출처 검증/새 문항·가족 타당성·반복/위험 기준·정확한 토큰 상한과 지역/캐시/처리 단가·최대 금액·새 승인 원장을 결합해야 한다. 공식 Standard 단가는 별도 관찰 파일에 남겼지만 비용 총액은 미확정이다. 옛756한도와 닫힌 잔액을 확장해 쓰지 않는다.

새 패널은 아직 기존 durable 예산/동결/dispatch/캡처/복구에 연결되지 않았다. 현재 v2는 보존하며 새 역할/프로토콜로 연결·고장 주입 검증을 먼저 해야 한다. AI 편향/정답표 타당성/실제 보정·영어 품질·사람 검수·실제 학습 효과는 미검증이다. T34.4를 native review로 옮겼고 T34 전체는 review다. 사용자 AI-only 방식에 필요한 추가 통합을 추적하려고 T22/22.1을 in-progress,22.2/22.3을 pending으로 재개했다. 구 v2 완료는 phase18 이력으로 보존하고 현재 완료 수는23/40·74/133이다. 실제 AI/키읽기/추가과금 승인·사용0,운영 학습 접근/배포/Git0. 전체 목표/출시는 보류한다.

보관:새 도구3개·회귀 검사·가상 원점수/실패/부모 증거/2052설계안/단가 확인 근거를 유지한다. 미병합이므로 산출물 삭제·브랜치/worktree 제거0이다. 제품/API/SQL/DB/R2/학습 상태 변경0,마이그레이션/운영 진단 영향0. 이 도구를 후속 평가에서 제외하면 제품 롤백은 필요 없으며 평가 원점수·원장은 보존한다.

확인한 공식 자료(2026-11-06):[Responses Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs),[Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices),[API Standard pricing](https://developers.openai.com/api/docs/pricing). 구조화 출력의 형식 보장은 판정의 사실 정확성을 보장하지 않는다.


## Phase20 · 새 v3 단계별 예산·상태 커널

새 `ai-quality-v147-panel-v3`를 구현했다. 옛 v1/v2를 변환하거나 상한을 늘려 쓰지 않는다. 준비180(문항작성60+참조검토120)과 본평가1872(생성360+교차1440+보정72)는 각각 다른 stage/specHash/승인/요청ID로 분리한다. 문항/참조 준비 결과가 있어야 본평가의 문항·정답표·실제 본문과 비용을 동결할 수 있으므로,하나의2052원장으로 먼저 본평가까지 승인한 것으로 처리하지 않는다. 이는 설계 초안이며 새 실제 금액·위험/표본 승인0이다. 준비 잔액을 본평가로 이전하지 않는다.

새 예산 커널은 문항작성+2검토(3슬롯),생성+2judge×2순서(5슬롯)를 한 묶음으로 사전 예약한다. 모든 선언된 문항·모델·버전·반복·12보정 증인×3judge×2순서가 빠짐없이 들어가야 한다. 출처/가격/본문 조건이 바뀌면 specHash/요청ID도 바뀌며 옛 승인·다른단계 승인을 거절한다. 보정72수집 전 본생성을 소비하지 못하지만,보정의 실제 성적 기준 연결은 아직 구현하지 않았다.

컴파일한 spec과 사전 가격/descriptor 지문을 불변으로 두고,같은 커널에서 만든 현재 head의 상태만 전이시킨다. caller clone/stale-head/중복소비/정산 교체를 막고 재생은 새 커널에서 모든 연산을 다시 적용한다. 메모리 현재head 보호이며 디스크/다중프로세스 잠금을 구현했다고 주장하지 않는다. 고정본문 지문과 파생본문의 정확한 부모 요청/출력/영수증/recipe 연결을 확인한다. 실제 raw본문 파생·파일 캡처·공급자 영수증 인증은 별도다.

실패/미상/사용량 누락은 최대 예약을 유지한다. 선언한 토큰을 넘으면 즉시 보류하고 max(예약비용,관측 사용량 비용)를 기록한다. 승인 감소 후 금액을 다시 높여도 자동 재개하지 않는다. 종료는 미발송 예약만 해제하고,이미 consumed인 요청은 추가 전송 없이 캡처 정산만 허용한다. 실제 청구서·입력 토큰 상한·지역/캐시/처리 방식이 검증됐다는 뜻은 아니다.

검증:Node22.23.4/24.22.1 집중 각19/19 exit0,새3스크립트 명시 lint0오류/0경고 exit0. 각 Node에서 준비180(601연산)·본평가1872(5989연산)의 가상 상태 전이→감사→전량 재생→종료 해시가 일치했다. Python Fraction으로 별도 계산한120개 정수 microUSD 올림/큰 정수/분수 할증 참조와 일치했다. 가상 quote/approval/usage만 사용했으며 HTTP·실제 provider·키 읽기·신규 유료 원장0이다.

제품547입력은 phase18e와 동일하여 Node22/24 각879·7제품명령,실제 브라우저24/axe12/Worker24 근거를 지문 대조로 재사용한다. 이전814빌드/현재407후보와 과거 실패·원장·4태그·2482근거는 보존한다. 제품/API/SQL/Site/DB/R2/운영학습 변경0,배포/Git0,미병합 산출물 삭제0이다. 새3도구·숫자 fixture·검사/재생 근거는 이후 통합과 회귀에 필요하여 보관한다.

T22/22.1은 여전히 in-progress,T34는 review,완료23/40·74/133이다. 다음은 새 디스크 원장·실제 body 동결/파생·물리 캡처·중단복구와 새 실행기 연결이다. 그 후 실제 채점기 타당성·문항/가족·위험/표본·토큰 상한/최대 금액/새 승인 제안을 준비한다. 실제 영어 품질·학습효과·출시·운영 확인은 보류다.

과거 파생 Task Markdown도 현재 파일과 구분해 보관했다. phase19의40파일은 갱신 전 ROOT에서 고정 지문을 대조해 복사했고,이미 갱신된 phase18의40파일은 보존된 원본tasks.json과 설치된 native formatter로 재생성하여 당시 고정SHA40개와 전부 일치함을 확인했다. 후자를 원본 복사라고 표시하지 않으며,원본JSON/formatter/추출 코드 지문과 재생성 경위를 `phase20/historical-task-md-archive.json`에 남겼다. 과거 원시 평가/원장·현재 Task Master 파일을 이 작업으로 수정하지 않았다.


## Phase21 · v3 디스크 원장·읽기 전용 중단 검사

`journal-v3`를 새로 구현해 v3 커널에 연결했다. v3-실행UUID 폴더와 schema/protocol/stage/spec 지문을 사용하며 옛 v1/v2 원장·승인·잔액을 읽어 실행하지 않는다. 합성 모드만 지원하고 실제 평가 모드는 파일 생성/소유 획득 전에 거절한다. 보호 경로·심볼릭/하드 링크·외부 파일·바뀐 소유자도 거절한다.

각 커밋은1–64개의 검증된 예산 연산을 담는다. 해시 체인과 단계별 sequence/계산/변경행 지문을 남기고,PENDING 저장/fsync→CHAIN 추가/fsync→HEAD 임시파일 저장/fsync→원자교체→PENDING 정리→전체 바이트 읽기 재확인 순서다. 재열기와 감사는 모든 연산을 다시 실행하고 전체 잔액/상태를 대조한다. mtime 캐시는 쓰지 않는다. 세션 소유는 PID·생성 시각·명령/실행파일 지문·nonce/경로/spec으로 결합한다. 정상/오류 종료의 소유 LOCK은 자체 이력에 보관한 뒤 해제하며,죽었거나 바뀐 타 소유 LOCK을 자동 삭제하지 않는다.

Node22.23.4/24.22.1 각각15/15 exit0,새3스크립트 lint0오류/0경고 exit0다. 각 Node에서 실제 자식 프로세스를10개 저장 경계에서 exit83으로 종료했다. PENDING/로그/HEAD 교체 전후/정리 전후의 원시 파일이 남고 새 소유 획득이 거절됨을 확인했다. 2실제 프로세스의 소유 경합은1소유/1거절,Windows HEAD 공유 잠금으로 실제EPERM을 재현해 완성된 준비 기록이 보류되는 것도 확인했다. 이것은 프로세스 종료 검증이며 전원 손실 내구성·다른 OS 검증이 아니다.

같은 길이와 mtime을 유지한 로그 변조,임의 꼬리,부분 추가,손상된PENDING,다시 해시한 잘못된 상태 증거,중단된 생성,링크/타 파일,바뀐 소유자,재개 중복 소비/닫힌 원장 재개를 거절했다. 유효 배치의 일부를 적용한 뒤 검증이 실패하면 메모리 세션을 보류하고 디스크에 부분 커밋하지 않는다. 모든 손상/중단 전후 근거와 원래 바이트를 따로 보존한다. 첫 Node24의12/12 통과와 미사용 import1경고도 초기 버전으로 남겼고,추가3대조를 포함한 최종15검사와구분한다.

준비180슬롯(601상태 연산/10커밋)·본평가1872슬롯(5989상태 연산/94커밋)의 파일 저장→전체 재생→감사→종료 해시가 가상 커널 상태와 일치했다. 이 검사는 최대64연산 묶음으로 수행한 합성 원장 검증이며2052실제/HTTP 요청을 보낸 결과가 아니다. 외부 API/키/추가 과금 승인·사용은0,물리 응답 캡처/공급자 영수증 인증도 미구현이다.

중단 검사는 읽기 전용이다. 미추가/부분/완전 로그와 이전/새HEAD를 구분하지만,추정 복구·로그 자르기·죽은 소유자 해제·요청 재전송은 수행하지 않는다. 명시 복구와 그 복구 프로세스 자체의 중단/경합 보호,실제 본문 동결·물리 캡처·새 실행기 연결이 다음 단계다. 보정의수집 완료 보호와 실제 성적/편향 타당성 검증을 구분하며 실제 AI 품질/학습 효과·출시는 계속보류다. 준비/본평가의구체적 문항·토큰·가격/최대금액·Task24/25 단계 인수인계는 아직 승인 가능한 최종 설계가 아니다.

T22/22.1 in-progress·T34 review,완료23/40·74/133을 유지했다. 제품547입력이 같아 phase18e Node22/24 각879·7제품명령과phase18 브라우저24/axe12/Worker24 근거를 재사용했다. 과거814빌드·현재407후보·4태그·2482근거·이전 Task Markdown40개를 보존한다. 새 도구/검사·가상 원장/죽은LOCK/PENDING·실패와 소유 이력은 후속 복구/회귀에 필요해 유지한다. 미병합 산출물 삭제0,제품/API/SQL/Site/DB/R2/운영 학습 변경·배포/Git0이다. 정상 커밋의PENDING 정리와 자체LOCK 해제는 소유 런타임 절차이며 브랜치 산출물 정리가 아니다.


## Phase22 · v3 비정산 원장 명시 복구 검증

이전 goal turn은 phase21 디스크 기록 구현과 검증을 끝냈으므로 progress다. 전체 목표는 유지한다. T22/22.1은 진행 중, T34는 review이며 현재 완료 수는 상위23/40·세부74/133이다.

새 `recovery-v3`는 합성 Windows 원장의 non-settle 연산을 명시적으로 복구한다. 최신 검사 지문이 맞고 기존 소유자가 실제로 사라졌거나 자기 세션을 명시 해제한 경우만 허용한다. 살아 있는 소유자·알 수 없는 PID·재사용된 PID의 다른 생성 시각/명령/실행파일 지문은 보류한다. 기존 프로세스 조회·Windows 커널 mutex 도구를 재사용하며, mutex를 실제 보유한 helper만 옛 LOCK을 원자 보관할 수 있다.

복구 전에 원래 CHAIN·HEAD·PENDING·임시HEAD·소유자 바이트를 별도 감사 폴더에 fsync/읽기 확인으로 보존한다. 검증된 예정 연산을 이어 써야 할 때만 새 CHAIN/HEAD를 fsync 후 원자 교체한다. 기록이 없거나 일부만 붙은 consume도 비용 예약을 보수적으로 소비 상태로 유지하고 재발송하지 않는다. 원래 부분 기록은 덮어쓸 파일의 근거로 먼저 byte-exact 보관한다. 데이터 삭제나 원장 초기화로 성공 처리하지 않는다.

Node22/24에서 각각20/20을 통과했다. 작성 저장 단계10종(exit83)과 복구 단계11종(exit84)의 실제 자식 프로세스 종료를 각 runtime에서 검사했다. 단계별 중단 원본은 해시로 보존됐고 복구 후 consume 재실행은 차단됐다. 실제 두 복구자 경합은 소유1/거절1(exit0/75), 일반 writer의 소유 획득 틈 경합도 보호됐다. 실제 Windows HEAD 교체 EPERM 후 근거 보존/새 검사에 따른 재복구도 통과했다. helper 종료·신원/동일바이트 새 inode·검사 지문·복구 근거/경로·쓰기 경계 변조도 보류됐다.

최초 Node24는16/17였다. 닫힌 원장 발송을 올바르게 막았지만 새 검사에서 존재하지 않는 오류명을 기대했다. 실제 커널의 `P3_DISPATCH_HELD`로 기대값을 바로잡고 최초 소스3개·로그·원시 데이터를 보존했다. 추가 경로/소유/쓰기 경계 방어를 보강한 뒤 집중5/5 및 전체 Node22/24 각각20/20이 통과했다. 최종 새3스크립트 린트는 오류0·경고0·exit0이다.

단계10/11은 각 runtime의 주 중단 행렬 종류 수다. 준비·추가 audit 변조·경합/잠금 검사의 자식 중단은 별도 원시 근거에도 보존된다. 일부 append는 검사용 바이트 변환으로 만든 조건이며 OS의 실제 부분 쓰기를 관측했다고 주장하지 않는다. 프로세스 종료/fsync/rename 검증은 정전·다른 OS 내구성을 입증하지 않는다.

정산(settle) 중단은 물리 캡처 검증 연결 전 계속 보류한다. 실제 요청 본문·토큰/가격 동결·물리 응답 캡처·새 실행기·보정 판정문 통합이 남아 T22 완료가 아니다. 제품547입력은 phase18e와 같아 기존 각879/879·7제품 검사,브라우저 기능24/접근성12/Worker24 근거를 재사용한다. 실제 AI·HTTP·키·과금0이며 실제 영어 품질·사람 검수·학습 효과·위험/표본·비용 승인·최종 평가 동결·출시 완료는 주장하지 않는다.


## Phase23 · v3 본문·물리 원문/표시 결과 수집 연결

이전 goal turn은 phase22 명시 복구 구현·검증을 끝냈으므로 progress다. 전체40작업 목표를 유지하며 T22/22.1은 진행 중,T34는 review다. 이번에는 별도 wire-v3/capture-v3 구성요소를 더했고 이전 원장·소스·실패/완료 근거는 보존했다.

5역할의 정적 본문 및 파생 recipe를 stage/run/spec/sourceSeal·모델/옵션·순서/환경·부모의 물리 캡처에 결합했다. review는 두 비자기 모델×두 입력순서를 유지하며 untrusted EVALUATION_DATA의 feedback 위치에 검증된 부모 표시 결과만 삽입한다. referenceReview는 검증된 부모 draft만 삽입한다. 요청 바이트·중복 JSON key·strict 출력 schema와 현재 조건을 검사하며 임의 본문 대체를 거절한다. 참조작성 schema는 이번 가상 fixture 계약으로,최종 문항/참조 프로토콜 동결이나 영어 정답이 아니다.

요청 본문·공급자 원문 응답·학습자 표시 payload·prepared manifest·receipt를5파일로 분리 보관한다. raw와 표시 결과를 혼동하지 않으며 현재 앱 계약을 통과한 표시 변환도 실제 소스 adapter6경로에서 대조했다. digest/receipt는 바이트 결합 근거이고 OpenAI/투사 함수의 인증이나 영어 정확성 보증이 아니다. 실제 모델 응답/사람 검수/학습 효과는 측정하지 않았다.

최종 Node22/24는 각각13/13이다. 별도180/1872 가상 schedule을 검사했고 역할 전체는 준비3+본102=105슬롯을 runtime마다 실제 파일로 수집·정산·종료했다.2052전체 HTTP 실행을 했다는 뜻은 아니다. 현재 소스의3모델×단어/문법6요청은 합성 fetcher와 실제 앱 parser로 대조했다. 이6검사의72개 사전 보정 행은 명시적 kernel fixture이며 실제 AI 보정이나 별도 물리 보정 캡처가 아니다.

파일 저장10단계에서 자식 프로세스를 실제 종료(exit87)했다. runtime별 원문 응답이 있는6개는 현재 원장 소유를 다시 확보한 후 누락 표시 결과/영수증을 해시 일치와 fsync로 복원하고 재발송 없이 정산했다. 원문 없는4개는 소비 상태·최대 예약을 유지해 보류했다. 모든 기존 바이트는 그대로 보존됐다. unknown/잘못된 모델/거절/중복 JSON/누락usage·토큰 초과·변조·소유/링크·닫힌 원장도 검사했다. 이 결과는 정전 내구성이나 정산 원장 transaction 자체의 중단 복구를 입증하지 않는다.

최초10/12 실패는 실행 환경을 바꾸며 runtime 지문을 갱신하지 않은 검사 설정과,문법 fixture에서 judgmentEnabled=true를 빠뜨려 legacy 계약을 선택한 설정 문제였다. 해당 소스5개·로그·원시 근거를 보존하고 현재 profile로 바로잡았다. 동결된 불변 명세의 반복 compile 비용을 줄이되 현재 조건·본문/파일 전체 바이트 검사는 유지했다. 중간 각13/13과 린트1경고도 보존하고 seal 반환을 정리한 최종2차13/13·린트 오류0/경고0·exit0으로 확정했다.

정상 세션의 정산과 capture 직후 중단 복원까지만 연결했다. 정산을 원장에 쓰는 중 중단된 PENDING 정산은 여전히 보류된다. 해당 복구·새 실행기/HTTP 전체 실행·보정 판정문·실제 평가 corpus/본문/토큰·가격/위험/표본/예산 승인·최종 평가 동결이 남아 T22 완료가 아니다. 제품547입력은 phase18e와 동일하여 이전 각879/879·7제품 검사와 UI24/axe12/Worker24 근거를 재사용한다. 이번 실제 공급자 호출·키 읽기·평가 HTTP·추가 과금0,운영 QA/배포/Git0이다.


## Phase24 · 물리 근거를 결합한 정산 원장 중단 복구

이전 goal turn은 phase23 본문/수집 구현·검증을 끝냈으므로 progress다. 전체40작업 목표를 유지하며 T22/22.1은 진행 중,T34는 review다. 이번에는 기존 recovery-v3를 확장했다. 이전 코어는 phase24/management-before에 byte-exact 보존했고 phase22/23의 당시 검사·원시 근거·소스 지문은 이 보관본으로 대조한다. 새 코드의 현재 결과는 별도로 기록했다.

새 settlement-proof-v3는 실제 capture reader를 감싼 등록된 읽기전용 검증기다. 임의 객체의 committed:true를 신뢰하지 않는다. 정확한 run/spec/path/request/result,원문 요청·원문 응답·표시 결과·준비·영수증5파일을 검사 지문에 결합한다. PENDING 정산뿐 아니라 이미 완료된 행도 다시 검증하므로 정산 기록 후 PENDING 삭제까지 끝난 중단에서도 검증기를 생략할 수 없다.

소유/검사/커널 mutex·원본 보존 조건을 유지하며 기록 교체 전후에 물리 근거를 다시 읽는다. 새 복구 lease의 v5 nonce는 검사 지문과 salt에 결합해,복구 검사를 다시 해시한 변경도 해당 lease와 맞지 않으면 보류한다. 옛 v4 복구 lease 형식은 기존 검사로 읽는다. 이는 로컬 근거 결합이며 공급자 인증이나 영어 정답 보증은 아니다.

최종 Node22/24 각각 새 정산복구12/12,기존 비정산복구20/20,영향받은 수집복구1/1을 통과했다. 새 주 행렬은 정산 작성10단계(exit88)와 복구11단계(exit89)의 실제 자식 종료다. 별도 영향 검사1개는 capture 저장10단계를 다시 실행한다. phase23 전체13검사를 다시 실행했다고 주장하지 않으며,바뀌지 않은 수집/본문 코드와 당시 전체 근거를 보존한다. 보존한 옛 코어를 새 합성UUID에서 실제 실행해 만든 v4 lease 중단도 각Node에서1/1로 복구했다. 옛 유료/닫힌 원장을 재개하지 않았다. 집중6/6도 통과했고 새5스크립트 린트는 오류0/경고0·exit0이다.

정산 회계는 가상 단가에서 독립 산술로 대조했다. 알려진20+20토큰은 한 번만 정산되고,unknown/failed는 최대 예약 유지,overflow는 관측 비용을 낮추지 않으며 닫힌 원장은 발송을 재개하지 않는다. 근거 누락·가짜/다른 실행 검증기·현재 결과와 다른 재해시된 캡처·쓰기 경계 변조·검사 문서 재해시가 보류됐다. 실제 Windows HEAD 교체 EPERM 후 재검사·복구와 두 복구자 경합(소유1/거절1)도 통과했다. 원시 바이트·통제 변형/원본·과거 실패는 모두 보존했다.

실제 공급자/키/평가HTTP/추가과금0이다. 제품547입력은 phase18e와 동일해 기존 각879/879·7제품 검사와 UI24/axe12/Worker24 근거를 재사용한다. 전체5역할 새 실행기/HTTP·보정 판정문·최종 참조작성/corpus/본문·토큰/가격·위험/표본/승인·실제 영어 품질·출시는 남았다. 이번 프로세스/fsync/rename 검사는 정전이나 다른 OS 내구성을 입증하지 않는다.


## Phase25 · AI 전용 5역할 합성 실행·저장·보고 통합

이전 phase24는 정산 중단복구를 검증한 progress다. 전체40/133 목표를 유지하며 T22/22.1진행중,T34review다. 새 실행기는 참조작성/참조검토/학습피드백생성/검토/보정을 연결한다. 기존 capture-v3의 projector에 정확한 key/phase/caseId/role을 추가해 같은 원문이어도 기준/후보 후처리를 구분할 수 있다. 옛 C3는 phase25/management-before에 지문 그대로 보존했고 과거 phase23/24검사는 당시 소스와 연결한다.

Node22에서 참조준비180(60작성+120검토),본평가1872(360생성+1440검토+72보정)를 실제 소유127.0.0.1 HTTP와 엄격본문/물리부모→원장소비→5파일수집→정산→파생보고까지 완주했다. 두 단계의 승인/UUID/원장은 별개이며 잔액을 넘기지 않는다. 닫힌 참조 원장의60합성 초안/각2검토 실제UUID와 지문을 본 평가 corpus에 연결했다. 전체 캡처10260파일이다. 비용은 전부 가상 단가40마이크로단위/건,단계별7200/74880으로 대조했다. 실제US$가 아니다.

보정은 두 입력순서 각각 모든3모델의12/12수신·11/12정확일치·중대오류누락0을 요구한다. 미달시 생성0이다. 생성마다 보정 파일360개를 전체 지문으로 다시 읽으며 수정시간 캐시를 신뢰하지 않는다. 본문/모델/옵션/환경/참조/루브릭/계획·물리부모를 소비기록 직후 발송 전에 재검사한다. 해당 마지막 본문 guard만 제거한 통제 변형은 가상 발송1,실제 guard는0으로 차이를 확인했다. 변형은 검증 산출물에만 있으며 실행 옵션으로 우회하지 않는다.

각 생성은 본인모델을 제외한2모델×입력순서2로 검토한다. 3:1가상 불일치1건은 보류하고 나머지359건은 가상 합의다. 다수결/합격할때까지재시도를 하지 않는다. 파생보고의 논리적 panelID는 별도 namespace이며 실제 수집UUID/원점수/영수증/원문지문1512연결을 보존한다. 전체 실행을 다시 열었을 때 발송0·보고서동일을 확인했다. 합의는 영어정답이나 학습효과/출시승인이 아니다.

Node22 새11/11,Node24집중10/10통과했다. Node24에서 전체2052규모1검사를 반복하지 않았으며 skip1을 명시한다. 두 런타임 모두102슬롯 패널/3참조역할,보정미달,3:1불일치,정확한 phase투영·보정원문변조,본문guard제거대조,단일실행,whole-group예산/출처변조,통신끊김·402·깨진JSON·거절·usage초과·부분수집복구를 검사했다. 실제CLI프로세스 각6단계exit91 후 명시적 소유확인 복구,불확실한소비최대예약/미수신보류/재발송0을 검증했다. 변경된 C3영향은 각13/13 전체수집회귀와12/12 정산복구회귀로 재확인했다. 새7스크립트와실행검증기 린트오류0/경고0·exit0이다. 첫 집중8/8통과·전체1skip과첫린트경고4도 이력으로 유지한다.

제품547입력은 phase18e와 동일하여 당시 각879/879·7제품검사,UI24/axe12/Worker24근거를 재사용한다. 이번에 새5역할 builtWorker/D1통합을 했다고 주장하지 않는다. 공식 평가 지침(https://developers.openai.com/api/docs/guides/evaluation-best-practices)과 원 연구(https://arxiv.org/abs/2306.05685)를 이번 흐름에서 재확인했다. 지침의 사람 기준 보정 권고는 AI-only 사용자 방침에서 수행할 수 없으므로 사람 기준 일치도·전문가 검증을 미측정으로 남긴다. 순서·장황함·자기선호 관련 연구는 이 프로젝트 모델의 편향 크기를 측정한 근거가 아니다. 확인 기록은 phase25/review-source-recheck.json이다. 실제 공급자/키/추가과금0이고 옛 예산/실패원장은 보존했다. 새Worker연결/전체장애행렬·최종참조작성계약·실제 corpus/본문/토큰/가격·위험/표본/새단계별승인·실제AI품질/일반화/학습대리지표·운영/출시 검증이 남았다. 정전/다른OS/공급자인증은 미검증이다. 브랜치는 미병합이므로 산출물 정리를 수행하지 않았다.


## Phase26 · 새 AI 전용 실행기와 현재 builtWorker/D1 연결

이전 phase25는 전체2052 합성 실행·보정·보고를 검증한 progress다. 전체40/133 범위를 유지한다. 이번 실제 로컬 앱 연결 결과까지 합쳐 Task Master 네이티브 명령으로22.1을done,22.2를in-progress로 변경했다. 부모22진행중,22.3대기,T34review이며 상위23/40·세부75/133완료(취소1/3포함)다. 실제 영어 품질이나 출시 완료가 아니다.

기준과최신후보(dist407각,후보는phase18final)를 각각3모델×단어/문법으로 연결해 Node22/24각12조합을 확인했다. 참조준비6과본평가132(생성12+비자기2모델×2순서 검토48+보정72)는 별도UUID/승인/원장이다. 참조의실제캡처출처를본평가corpus에 연결한다. 모델성능 표본이 아닌2개합성전송/상태사례이며 실제60문장품질근거가 아니다.

실제workerd요청원문은phase6동결본문과byte-exact 대조했다. 기준/후보 소스를 독립적으로컴파일한동기투영을C3에 공급하고,원래7필드 공급자JSON과학습자5필드표시를분리해 실제앱응답/영수증GET/학습저장GET과대조했다. 기준553Git선정소스와후보547검증입력은각각동결하고두407빌드·공개합성자료·투영번들을생성전마다실제파일지문으로읽었다. 두빌드의호환일/플래그도일치한다. 예전SOURCE/dist를최신후보로사용하지 않았다.

생성API는요청영수증을먼저보관한다. 앱클라이언트와같이 현재revision으로피드백을학습상태에별도PUT하고GET해서실제저장경로를확인했다. 동일UUIDPOST/영수증GET은추가공급자0,다른가상계정은피드백조회차단이다. 첫영/한국어답·친숙도·독립회상상태·문법답/관찰/완료일/stage5/독립복습passed2·schedule·최근review를보존했다. 값은가상fixture로주입한보존검사이며실제성적이나학습효과측정이 아니다.

각런타임정상경로132완료,검토/보정HTTP120+참조6,생성Worker인터셉트12다. 알려진가상비용은132슬롯6960마이크로단위(생성각180,나머지각40)다. 별도2통제중단은 앱저장후Nodebridge응답상실과 C3캡처후정산중단이다. 전자는앱영수증이있어도 공급자원문캡처가없어consumed최대예약보류,후자는닫힌원장에원문에서1회정산됐다. 둘다앱영수증조회와학습저장내용이남고재발송0이다. 각총Worker가상인터셉트14·가상leafHTTP270이며 실제OpenAI호출은0이다. 실제Worker/Node프로세스를강제종료한검사와구분하며,그DB재개/전체역할고장행렬은22.2에남는다.

첫Node22검사는 후보파일목록을기준체크아웃에그대로적용해없는후보전용파일ENOENT로Worker시작전에실패했다. 기준/후보실제목록을따로동결하도록수정해 Node22재검사와Node24모두exit0이다. 최초소스3파일/실패로그와첫린트경고1도보존했다. 최종새3스크립트린트오류0/경고0·exit0이다. 기존v3코어와제품547입력은변하지않아 phase25전체2052·고장행렬과phase18e제품각879/879·7검사/UI24·axe12근거를지문대조해재사용한다.

Sites로컬전용절차를따르고실행경로가짧은ROOT/work아래각각새합성D1/R2를사용했다. 소유한workerd2개각을종료했고원본DB파일지문·출처와모든캡처를보존한다. 기존4318대시보드는유지한다. 운영Site/환경/바인딩/SQL/학습데이터/배포/Git변경0이며 미병합산출물정리0이다. 실제AI판정·사람기준일치·일반화·학습효과·실기기·토큰/가격/위험/표본/새승인·운영/출시는미검증이다.


관리 검사의 초기 두 실패도 보존했다. 현재 validation의 완료 수74→75누락과 과거 단계 검사에 남은 현재 child상태 고정 가정을 각각 실제 Task Master 상태로 보완했다. 과거 phase25동결기록은 변경하지 않았고 실제 제품/Worker 검사 실패와 구분한다. execution-first/second-verification.json, management-count-clarification.json을 따른다. 최종 관리30그룹과 대시보드/내비게이션27그룹은 exit0이며, 수정된 검증기 린트도 오류0/경고0이다.


## Phase27 · 실제 Node/workerd 강제 종료와 영속 D1 재개

이전 phase26은 새앱연결을 검증한progress다. 전체40/133범위를 유지하며 네이티브Task Master로22.2done/22.3in-progress를반영했다. 부모22진행중,T34review,상위23/40·세부76/133완료(취소1/3포함)다. 출시나실제영어품질완료가 아니다.

새persistent-worker-v3는별도합성UUID·짧은ROOT/work경로와stableD1/R2ID로실제407built앱을다시연다. create만기존7SQL을적용하고reopen은초기화/새DB대체없이기존DDL·build/migration·외부descriptor/schema/lease지문을대조한다. 살아있는/확인할수없는소유자는보류하고,정상해제또는확인된deadNode/runtime의바이트를보관후소유lease를바꾼다. 첫정상검사각4그룹은liveowner/잘못된proof차단,설정저장후동일DB재개,소유runtime/listener종료다.

각Node22/24에서실제자식Node를SIGKILL14회(Windows관측exit1),선택workerd를SIGKILL3회했다. 5역할14사례는실제앱6(저장직후/캡처직후/정산직후×Node/worker)와나머지4역할의소비직후/캡처직후8사례다. 부모가체크포인트파일을fsync하고IPC로받은PID/생성시각/명령·실행파일지문을대조한후종료했다. 재개자식은모두exit0이고추가발송0이다. 앞선자체exit코드통제종료·가짜예외주입과구분한다.

실제앱6사례는동일DBID로기준/후보를재개해영수증GET·동일UUIDPOST·학습상태전체일치·첫답/독립복습/스케줄보존을대조했다. 원문없는generation소비는최대예약76976가상마이크로단위(보정72×40포함)로보류,원문캡처또는정산이있으면3060으로한번만정산됐다. 다른역할도독립예상값74096/40,74136/80,77016/2960등을대조했다. 단계별원장/UUID는새합성실행이며옛유료원장·잔액은재개하지 않았다. 참조는phase26닫힌개발용합성fixture의출처를읽기전용으로재사용했으며새실제정답자료가 아니다.

첫행렬은두앱사례복구후counter파일을wx로같은이름에다시만들어EEXIST로멈췄다. 사례별불변progress파일로수정했고원소스/실패로그/DB/캡처를유지했다. 최종두런타임14사례와정상4그룹모두exit0,새4스크립트린트도오류0/경고0이다. 대기중인복구자중지를준비했으나실행이진행돼대상lease파일이이미해제된상태였고,확인시도에서null PID쿼리오류만발생했다. 실제추가Stop은0이다. 원기록과controlled-stop-clarification.json을함께보존했다.

설치Miniflare소스에서workerd자동재시작경로를확인했다. 개별자동restartPID/횟수와그계보는이번에계측하지않았다. 원본은이번수동reopen전에보관했으며모든자동복구이전바이트보관이나정전/다른OS내구성을주장하지않는다. restart/descendantPID추적,소유자/경합/경로경계와최종자원종료는22.3에남는다. 관련공식D1preparedstatement·MiniflareD1문서와설치소스지문은runtime-reference-check.json에기록했다.

제품547입력/양407빌드와v3기존코어는변하지않아phase18e각879/879·7검사/UI24·axe12,phase25전체2052,phase26각12앱조합근거를재사용한다. 이번합성AI응답/등급은영어품질·학습효과·공급자인증측정이 아니다. 실제AI/키/추가과금/운영/배포/Git0,미병합산출물정리0다. 원문·DB·승인/실패/복구·기존플랜을보존한다.


최종현재관리31그룹·대시보드/내비게이션27그룹과새스크립트/검증기린트는exit0이다. 기존4태그·2482과거고정근거·이전phase26/TaskMD40·새원문/DB/실패/보정기록을대조했다. 전체목표는미완료이며다음네이티브작업은22.3이다.


## Phase28 · 자동 재시작 계보·소유 자원 종료와 T22 로컬 통합 완료

이전 phase27은 실제 종료/DB재개를 추가한progress다. 이번에는 Miniflare가 자동으로 바꾼 workerd의 신원을 추적하도록 별도 runtime-lineage-v3를 persistent-worker-v3에 연결했다. 최초 RUNTIME/외부 lease 지문은 바꾸지 않고 owner nonce에 묶인 별도 불변 해시 연결 기록에 최초 신원, 재시작 시작, 새 신원, 종료를 보관한다. 재시작 중/확인 불가/미소유 child는 새 요청·소유권 이전을 보류한다. 현재 등록된 다른 프로필의 정확한 신원은 보존한다. 실제 설치 소스의 경고/완료 hook과 버전을 결합했으며 라이브러리 변경 때 재검증해야 한다.

각 Node22/24에서 자원11·정상 영속4·현재소스 5역할 강제종료14를 모두 exit0로 검증했다. 자원 검사의 실제 자동 restart3과 통합 행렬의 restart3을 합쳐 각6회다. 실제 강제 종료는 각Node15/workerd6이다. PID 숫자만으로 소유권을 추측하지 않고 생성시각·명령/실행파일 지문을 대조한다. 새PID를 만든 뒤 Node를 종료하고 같은 합성 DB를 명시 재개했다. 두 복구자 경합은1소유/1보류, 다른 실행기는 유지됐다.

archive junction·외부 nonce 경로·schema hardlink·이력 변조는 복구/종료 쓰기 전에 보류됐다. junction/hardlink는 검사에서 만든 연결만 해제하고 sentinel/원본을 보존했다. 이는 병합 후 산출물 정리가 아니다. 정상종료는 모든 소유 runtime/listener 부재를 확인하고 원래 소유자/초기runtime/계보기록·DB·원본 캡처를 남긴다. 소유 관계가 모호하면 임의로 다른 프로세스를 종료하지 않는다. 적극적인 같은 사용자 OS 공격자의 경로 교체나 모든 OS/정전 내구성을 증명하지 않는다.

기존 5역할 예산/캡처/원장/보고서의 전체 합성2052, 실제builtWorker/D1 조합12셀과 이번 현재소스 고장/자원 검증을 합쳐 T22.1–22.3의 로컬 합성 통합 완료조건을 충족했다. 원문 없는 소비의 최대 예약, 원문 있는 결과의1회 정산, 같은UUID 앱영수증/학습 상태 재조회·첫답/독립 성적/복습 스케줄 보존·재발송0은 유지됐다. 실제 영어 정확도나 학습 효과의 증거가 아니다.

네이티브 Task Master로22.3과부모22를done 처리했고 상위24/40·세부77/133완료(취소1/3포함)다. AQ-G2는 로컬 관문 통과, 실제 품질·유료 승인·출시/운영 관문은 보류다. 초기 위험 설계안에는 현행 AI-only 방침 안내를 추가하고 옛 사람 검토자 조건·호출 수는 당시 원문으로 보존했다. T34는 사람이 없는 AI-only 평가의 타당성·허용 위험·표본·주장 범위를 확정하는review로 남는다. 참조준비/본평가 자료·본문·가격과 새 별도 승인도 확정 전이다. 실제AI/키/추가과금/운영/배포/Git0, 제품547입력/기존빌드/실패/닫힌원장/이력 보존, 미병합 산출물 정리0다.


## Phase29 · AI 전용 실제 평가의 위험·표본·비용 제안 구체화

phase28은 T22의 로컬 통합을 완료한progress다. 이번에는 T34를 새로 진행해 [현행 실제 AI 평가 설계안](AI_QUALITY_V147_AI_EVALUATION_PROPOSAL_20261107.md)·기계 판독 JSON을 작성했다. 옛 phase12 초안/114개 수학 근거와 실제 변경된5역할/4검토·72보정을 구분한다. 사람 섭외는 필요조건이 아니다. AI 기준의 결과와 영어 정답률/실제 학습 효과를 분리한다.

예비60가족 r1은 참조준비180과본평가1872(생성360/검토1440/보정72),계2052다. 예비는출시/모집단위험의합격판정이 아니다. 문법15수업×2조건/6층각10가족·길이/복잡도배분을구체화하고각수업3조건전수검사라는주장을배제했다. 이름/단어치환·반복은가족N에더하지않는다. 확인의독립표본/효과/정밀도는최종동결전에검증해야한다.

조건부AI중대위험5/1/0.5%·전체95%/114단측bound·반복2의기존보수적예시는층당151/770/1543가족이며새역할·참조포함57150/291132/583326회다. Node22기존risk수학과현재v3작은r2스키마를실행하고,Python65자리Decimal/정수로5설계·15가격시나리오·45모델시나리오·3표본경계를별도로대조했다. 둘다exit0이다. 실제AI반복·품질이나검정력검증이 아니다.

OpenAI Docs 스킬로공식평가/지정3모델/가격/캐시/reasoning문서를검색후읽었다. 캐시저장은1.25배또는2.5배의대체입력요율이며일반입력에중복가산하지않고,숨겨진reasoning은출력합계에포함한다. 모든슬롯입력8192/출력4096·입력2.5배라는예시의예비계산은세전US$364.216320이다. 이는실제본문상한검증견적·청구예측·새금액승인이 아니다. 실제본문/파생검토의토큰상한·옵션·정확한새단계별금액은T24에서확정해야한다.

T34와4자식은review,위험/주장선택·표본독립성·최소개선효과/검정력·실제참조작성계약·최종본문/가격/새승인·실제채점보정/편향내성은미완료다. 전체40/133과후속확인/일반화/학습대리지표·운영/출시/1일/7일관문을유지한다. 상위24/40·세부77/133완료(취소1/3포함),실제AI/키/추가과금/운영/배포/Git0,제품547입력과기존빌드/원점수/실패/닫힌원장보존,미병합산출물정리0다.


## Phase30 · 참조 작성·검토 계약과 실제 토큰 확인의 준비 경계

phase29의 현행AI-only 제안은progress이며 위험/주장 선택 질의는 미응답으로 보존했다. 이번에는 T34의 독립 작업으로 [참조 작성·검토/토큰 사전확인 계약](AI_QUALITY_V147_REFERENCE_READINESS_20261107.md)과 기계 판독 초안을 작성했다. 실제 API 연결 코드·자격증명 유무 검사·키 읽기·유료 호출은 하지 않았다. 사람 검토자 섭외는 요구하지 않는다.

기존 작성 fixture의3필드 되풀이와 exporter의 기존 입력 동일성,제품 피드백5차원 referenceReview 재사용을 확인했다. 고정 배정·신뢰한 대상·실제 문장/문맥·원문판정·비완전 교정예시·허용 출처·가족/노출·불확실성·새 corpus export를 별도 계약으로 설계했다. 7차원 참조 검토/5중대 플래그와 익명 통제2항목은 미승인 후보이며 실제 보정 능력을 검증한 것이 아니다. 추가 자격 확인 요청이 생기면 호출수/금액을 다시 계산해야 한다.

설치된 Python jsonschema로 문서 스키마 구조/경계/부정 대조24개를 통과했다. 대상·출처·불확실 교정·지시문·UTF16·중복 바인딩 등 구조만으로 막지 못하는7종도 드러냈다. 기존 순수 validator의 ID패턴 지원 부족 W3_OUTPUT_PATTERN을 직접 확인했다. 표준 스키마 유효성과 실제 실행기/공급자 호환성·의미 정확성은 다르며 현재 실행기·실제 API 코드는 변경하지 않았다.

기존 순수 컴파일러의 공개12증인×3모델×2순서=72본문을 읽기 전용 분석했다. 다른 runId/salt에서도 본문 지문이 같고 기대점수 메타데이터는 요청에 없다. 전체5039–5574바이트이며 실제 토큰 수가 아니다. 원문은 새 실행 가능한 묶음으로 저장하지 않았다. 공식 OpenAI token-counting 안내/count reference를 검색 후 읽어 model/instructions/input/reasoning/text의 정확 투영과 전체 생성본문 지문·출력상한·옵션 바인딩,실제 파생 본문 사전 확인을 명세했다. 확인 문서로 count 과금을 확정하지 못했으므로 무료/실제 상한/결제 가능한 견적으로 표시하지 않는다. 실제 count API0·입력토큰/요금/본문/새금액 미확정이다.

T34/4자식은review,상위24/40·세부77/133완료(취소1/3)다. 실제 참조 sourcePack/문항/통제·역할 구현/보정·위험/표본/효과·본문/토큰/비용 승인·실제 예비/확인·일반화/학습 대리지표·운영/출시/1일/7일 관문이 남는다. AI 합의는 영어 정답·학습 효과의 입증이 아니다. 실제AI/키/추가과금/배포/Git0,기존 제품/빌드/원점수/실패/닫힌 원장 보존·미병합 산출물 정리0을 유지한다.

phase30 최종 검증: 관리/보존34그룹,기존 대시보드12·왼쪽 탐색15그룹(Chromium/WebKit),오프라인 문서 스키마24대조·기존 패턴 검증기 보류 대조·72정적본문 분석,관련 verifier lint 모두exit0다. lint 경고0이며 실제 제품547입력은phase18e와 같아 기존 각879개/타입·린트·빌드 근거를 재사용했고 이번에 재실행하지 않았다. 학습 Worker를 새로 열지 않았으며 소유 QA Node/workerd0·기존4318 유지다. 이전 phase29의162근거/69관리/40작업MD를 보존했고,phase30 문서 계약/분석/검증 근거는 progress-final.json으로 동결한다. 실제 토큰/가격/영어 품질 합격이나 전체 목표 완료를 뜻하지 않는다.


## Phase31 · 기존 키 재사용 선택과 새 참조 작성·검토 계약의 로컬 연결

키 선택 대기 뒤 사용자의 `기존 키 재사용`으로 재개했다. 이전 목표 턴은 입력 대기로 진전이 없었으며,이번에는 실제 소스/검증을 변경한progress다. 키 값 읽기·키 파일 쓰기·실제 제공자/count API 호출·새 과금/배포/Git0을 유지한다. 키 사용 방식 선택을 금액·위험 승인으로 합치지 않는다.

[새 참조 구현 기록](AI_QUALITY_V147_REFERENCE_IMPLEMENTATION_20261107.md)과 reference-v4-preparation.json을 따른다. 새 실제작성 문장/문맥/원문판정/비완전 교정예시·허용 출처/배정/가족·7차원/5플래그·2익명 항목/통제·닫힌 handoff를 기존 v3의 물리원문·원장·CLI/보고 경로에 연결했다. 전송 전 최종 본문과 실제 배정/부모를 대조하고,통제 실패 뒤 추가 전송을 보류한다. 이전3필드 fixture와 동결 증거는 보존한다.

최종 상태의 새 기능 Node22/24 각14/14,기존 wire/capture 각13/13,executor 각10통과/전체2052 재실행1skip,기존 builtWorker/D1 각12조합·통제 손실2종을 통과했다. 새60합성 문항180회 수집/120통제 점수·닫힌 handoff와360본관측/1440검토 템플릿/72보정 컴파일을 완료했다. 본평가 요청은 전송하지 않았다. 실제 CLI 중단2종과 무재전송,중단장치 제거의2대6전송 대조도 통과했다. 전송전 배정 대조 보완 전의 최초 통과 자료도 별도 경로에 보존하며 최종 근거는 qualified 이름을 따른다.

공식 Structured Outputs 지원 스키마를 OpenAI Docs로 검색/읽었다. 지원하는 길이 pattern과 고정ID enum·로컬 의미검사로 기존 일반ID패턴 미지원 문제를 우회 없이 처리했고,출처 확인시각/원문 지문/인용·원문 모호성/참조 자체 불확실의 차이를 보존한다. 실제 공급자 호환성·AI 능력·출처 사실성/독립가족·통제 자격·입력토큰/요금은 이 모의 검사로 입증하지 않는다. 입력70000은 모의값,출력4096유지다.

T34/4자식review·상위24/40·세부77/133완료(취소1/3)·T24 이후 의존성을 유지한다. 위험/주장 선택 질의는 phase29 미응답,실제source/control/표본·본문/토큰/정확한 단계금액/새승인과 실제 보정/예비/확인·일반화/학습 대리지표·운영/출시/1일/7일은 남는다. 사람 섭외는 조건이 아니다. 제품547입력/현재407후보·814이전빌드/옛점수/실패/닫힌원장과 플랜 이력 보존·미병합산출물정리0이다.

phase31 최종 관리/보존35그룹·대시보드12/탐색15그룹(두브라우저)·최종코드의9도구검사 명령은모두exit0다. 최종도구lint0경고이며최초미사용import1경고와보관수집기의부정검사용junction가정오류도수정전근거로보존했다. 겹쳐실행한최초wire검사는최종순차검사로대체했고원본도보존했다. 원문9406파일/현재별도D1상태를대조하고링크는따라가지않고메타데이터로보관했다. 제품547입력은phase18e와같아기존각879/타입·린트·빌드근거를재사용했고재실행하지않았다. 소유테스트Node/workerd0·기존4318유지·미병합산출물정리0이며실제AI/토큰/가격/영어품질·전체목표는미완료다. 새근거는phase31/progress-final.json으로동결한다.


## Phase32 · 입력 토큰 투영/영수증 바인딩 구성요소

phase31은 새참조계약 로컬연결의progress다. 이번에는 [입력 토큰 사전확인 구성요소](AI_QUALITY_V147_INPUT_COUNT_20261107.md)를 구현했다. Node22/24 각11검사·기존5역할108본문·소유루프백을통과했고lint0경고다. 투영과전체본문/출력상한/부모/소스/가격지문을연결하며빈부모/변경/상한/응답/승인승격을거절한다. 실제count요금은확인한공식문서·검색에서확정못했으며무료가정/실제API/키읽기/쓰기·추가과금0이다. 새독립구성요소이며실행기·원장연결/실제토큰·견적·실제AI품질완료아니다. 기존547제품/참조도구소스가같아과거검증을재사용했고기존전체도구회귀/제품검사는새로실행하지않았다. T34/4review·24/40·77/133·전범위와선행관문/옛점수·실패/닫힌원장/5플랜을보존했다. phase29위험/주장선택미응답·키재사용기승인·사람섭외필수아님을유지하며실제API/금액/배포/Git0·미병합산출물정리0이다.

phase32 최종: 새구성요소각Node11/11·관리/보존36·대시보드12/탐색15·관련lint0경고,모두exit0. 탐색QA와겹친최초관리검사도보존했고QA종료확인뒤관리검사를다시통과했다. 기존제품547/참조구현9파일은같아기존회귀근거재사용·소유테스트Node/workerd0·기존4318유지·실제API/count/키읽기/쓰기/신규과금/배포/Git/정리0이다. 실제입력토큰·요금·실행기연결·영어품질과전체목표는미완료다. 근거는phase32/progress-final.json으로동결한다.


## Phase33 · 입력토큰 확인과 실행기 중단 복구

[2026-11-07 phase33 토큰 사전확인 실행기 연결] 고정 count 정책/콜백·소비 전/전송 직전 실제 본문/부모/기록 확인과 별도 intent/response/receipt 저장을 연결했다. 시작기록만 남으면 무재전송 보류, 검증 가능한 응답은 receipt 완성으로 복구한다. 각Node 새14검사/5역할108쌍·CLI4중단/생성소비0대1 차단대조, 기존참조14/실행기10+1skip/Worker12흐름·2중단 통과·lint0경고. docs/AI_QUALITY_V147_INPUT_COUNT_EXECUTOR_20261107.md 및 input-count-executor-preparation.json을 따른다. 실제count/생성/키읽기·쓰기/새과금/배포/Git0. count 비용 원장/요금·실제토큰/새전체규모/제공자인증/전원손실/영어품질은 미검증이며 구성상한은 변경하지 않았다. T34/4자식review·24/40·77/133 유지, T24 의존성우회 없음. phase29 위험/주장선택 미응답·키재사용 기승인·사람섭외 필수아님. 실제source/control/가족/표본/견적/새승인과 후속평가·운영/출시/1일/7일은 남는다. phase32 동결/제품547·407후보/옛점수·실패/닫힌원장·5플랜 보존·미병합정리0.

새 입력토큰 실행기 검증 각Node14/14와 기존 참조14/14·실행기10통과/1skip·로컬Worker12흐름/2통제중단은 모두exit0다. 새count모드의 전체규모 검증과 실제count비용 원장/요금/입력토큰·영어품질은 완료하지 않았다. 제품547입력 불변으로 phase18e의 제품검사 근거를 재사용했다. 최초lint 명령은 cwd에 따른 도구경로 오류로 미실행됐고, 절대경로 수정 후 최종lint0경고/exit0를 확인했다.

phase33 브라우저 최종: 기존 대시보드12그룹(Chromium/WebKit·axe 실제실행)과 왼쪽탐색15그룹은exit0다. 최초대시보드검사는환경변수이름차이로axe미실행이었으므로보존했고,별도dashboard-axe-final로실행해확인했다. 최종관련도구lint는qualified2/exit0·경고0이며코드검증과QA를순차완료했다. 관리/보존최종결과는phase33/execution-verification.json,전체현재지문은progress-final.json을따른다. 실제AI품질·전체목표완료가아니다.


## Phase34 · 1차 출처와 공개 통제 후보,노출 근거 전달의 빈틈

[2026-11-07 phase34 1차 출처·공개 통제 후보] Cambridge 편집 본문18개를 직접 확인해 URL/시각/원문·본문/발췌 지문과25단어 이내 발췌를 보관했다. 최초4실패 보존·3별도재조회해결·명사landing 미채택. 실제15수업ID/목표설명에 부분 연결·전체규칙/단어영역/실제독립가족 미완료. 공개6통제후보는 전체7차원정답/실제AI자격 미확정·기존strict controlExpectedGrade 직접사용 불가·본평가문항/같은구조 재사용금지다. 각Node6오프라인 검사·작성45/익명검토18본문·변경/외부출처 거절·거짓출처귀속의 구조검사통과 대조를 확인했다. 현재 익명검토36항목에 실제노출목록이 없고withheld지문만 있어 가족/노출비교 근거부족임을 발견했다. 실제오판 측정이 아니며 노출차원을 pass로 채우지 않는다. docs/AI_QUALITY_V147_REFERENCE_SOURCES_20261107.md 및 reference-sources-preparation.json을 따른다. runtime/제품547입력불변·옛원장/점수/실패/5플랜보존. 키재사용기승인·실제API/count/키읽기·쓰기/새과금/배포/Git/미병합정리0. 위험/표본/금액·실제토큰/요금·역할자격/영어품질·후속평가/운영/출시/1일/7일 미완료,T34/4자식review·24/40·77/133유지.

새 checker는 각Node6검사/exit0·작성45/익명검토18본문을 확인했고 관련lint0경고/exit0다. 실제품질/정답/수업전체근거/통제자격을 증명하지 않는다. 기존실행기와제품547입력은불변으로 이전근거를재사용하며 이번전체실행/Worker/제품검사는재실행하지않았다. 최종관리·대시보드와보존결과는 phase34/execution-verification.json 및 progress-final.json을따른다.


## Phase35 · 실제 노출 목록의 작성/익명 검토 연결과 보류 경계

[2026-11-07 phase35 노출 자료 필수 경로] frozen exposurePolicy와 실제 공개문장 목록을 작성/익명 공통검토·물리원문/보고/handoff·토큰 사전확인에 연결했다. 공개18기록/14표면은 부분목록이며 가족관계/목표세분화/나머지노출 미감사다. partial 작성unresolved/검토unavailable 강제,기등록문장 정규화/동일가족ID·누락/변조/출처승격 거절·정답/점수/교정/모델정체/파일경로 목록제외. 과거목록0/기존문장수용 대 새목록2/같은문장보류 대조·새각Node14검사/CLI2중단 무재전송·참조14/토큰14/실행기10+전체1skip/Worker12흐름·2중단 각Node통과·최종lint0경고다. 최초13통과/1보조URL오류 및 import2경고 원문보존. docs/AI_QUALITY_V147_EXPOSURE_EVIDENCE_20261107.md와 reference-exposure-preparation.json을따른다. 새필수정책 경계는보완했으나 전체목록/독립가족/실제AI자격·영어품질/60전체규모/토큰·요금·금액은미검증. 기존frozen본문/원장/점수/실패/제품547·407빌드/5플랜보존,키재사용기승인·위험질의미응답·사람섭외필수아님·실제API/count/키읽기·쓰기/추가과금/배포/Git/정리0. T34/4자식review·24/40·77/133유지. 실제참조준비는required 정책과감사한노출범위를필수로하고옛진단경로를승격하지않는다. 전체40/133·후속확인/일반화/학습대리지표/운영·출시/1일/7일은남는다.

새필수정책의 local gap을보완했고 실제전체목록/독립성은 미완료다. 기존 대시보드의 현재플랜 예산문구에 남아있던 옛756설계표기를 참조180/별도예비1872의 미승인설계와 count별도비용 미확정으로 바로잡았다. 승인/잔액을 변경하지 않았으며 과거플랜/본문은 그대로다. 관리·UI·보존 최종근거는 phase35/execution-verification.json 및 progress-final.json을따른다.


## Phase36 · 공개 원문 목록의6자료원 확장과 누락 범위 감사

[2026-11-07 phase36 공개노출목록v2] 기존2자료원18기록/14표면에서6정적자료원207원문/173표면(+159)으로 확장했다. source별12/6/105/12/12/60과 원본필드/지문·중복34출처기록·old18보존 확인. visible2건의feedback.original과rejected-wire1건original만추출·정답/교정/점수/이유 목록제외·과거영역없음2건unknown명시,새배정word/grammar유지. 실제전체207항목56511바이트·작성/익명검토6본문68578–71375바이트무절단·4추가자료원old미포착/new차단 대조,큰목록count/capture/unknown최대비용보존/후속0 확인. 새각Node8·기존노출각14·lint0경고/exit0. 최초mode미지원·영역기본분류·테스트원장상태7통과/1실패의원본보존/근거확인수정. docs/AI_QUALITY_V147_PUBLIC_EXPOSURE_V2_20261107.md 및 public-exposure-inventory-preparation-v2.json을따른다. 테스트프로그램123/교재4/fixture8·기타도구/보관평가·문맥/목표세부/구조가족미감사로coveragepartial유지·complete아님. manifest현재목록v2연결,옛v1/원장/점수/실패보존·제품547/사이트/DB/lockfile불변·실제API/count/키읽기쓰기/추가과금/배포/Git/정리0. 키재사용기승인·위험질의미응답·사람섭외필수아님,T34/4review·24/40·77/133/전체40범위유지. 실제독립성/AI자격/영어품질·토큰요금/견적승인·확인/일반화/학습대리지표/운영/출시/1일/7일은남는다.

새8검사와기존14검사는각Node22/24·최종lint0경고/exit0다. 원장unknown을영어오류실패로바꿔계산하지않았고 원문/최대비용을보존했다. 앱547입력불변으로기존제품/Worker근거를재사용했고해당전체검사를다시실행하지않았다. 최종관리/대시보드와보존결과는 phase36/execution-verification.json 및 progress-final.json을따른다.


## Phase37 · 교재의 실제 생성 문장과 목록 크기 감사

[2026-11-07 phase37 교재 노출·크기 감사] 실제5모듈 번들/1~4판의 선택 문장 필드와 모든 틀 조합을 추출:1265출처기록/255표면(판별137/376/377/375),기존목록누락253/합집합426. 원본 필드 전수 대조·틀183/빈문맥300·최신reviewUnits와구/신판 보존·253개오프라인검색 확인. 새6검사각Node22/24·lint0경고/exit0. 전체1472항목397341바이트/동일표면추가합치기460항목125343바이트 모두 기존64KiB검증기로거절됨;한도증가/절단/실제토큰추정없음. 실행기현재v2목록207/173그대로,새오프라인목록은미연결·기존코드/제품547/의존성불변. docs/AI_QUALITY_V147_CURRICULUM_EXPOSURE_20261107.md와curriculum-exposure-preparation.json을따름. 다음전체지문/로컬검사와범위가명시된모델구조자료 연결·복구/익명검토/비용한도 검증 필요. 이중언어안내영어/선지조각·테스트123/fixture8/보관평가·구조가족 미감사,교재/프로젝트전체완료아님. 실제API/count/키읽기쓰기/추가과금/운영QA/Git/배포/정리0. T34/4review·24/40·77/133유지,위험질의미응답/기존키재사용기승인/사람섭외필수아님·실제AI자격/영어품질/토큰요금/금액승인/확인/일반화/학습/운영/출시/1일/7일은남음.

실행기의 차단 범위가426개로 확장된 것은 아니다. 전체/같은표면합치기 모두 기존 한도로 거절돼 새 바인딩/범위/복구 연결이 필요하다는 근거다. 최종 관리/대시보드와보존 결과는 phase37/execution-verification.json 및 progress-final.json을따른다.


## Phase38 · 전체 선택 자료의 로컬 검사와 과제별 부분 전달 연결

[2026-11-07 phase38 전체선택노출연결] 새필수GEX1에1472출처/426고유문장 전체로컬검사와과제/통제별target+coarse부분전달 연결. 전체로컬254998바이트보존·46목표/3모델작성·익명검토276본문12682~26552바이트/목록최대17042바이트·기존한도/원본무절단. 전달범위밖교재원문도1count/1model의completed캡처후held-known-global-exposure·후속0·닫힌읽기전용재조회 일치. fresh도partial보류·구조독립/영어품질합격아님. 각Node9새검사·참조14/count14/노출14/이전목록8/실행기10(전체1생략)/Worker12흐름+통제2각exit0·lint0경고. CLI2각exit91→2/noresend·count1각/model0또는1·소비0/1변조경계확인. 첫8/1실패는테스트CLI출력이름규칙오류로원본보존/인자보호유지후수정. docs/AI_QUALITY_V147_GLOBAL_EXPOSURE_20261107.md와global-exposure-preparation.json을따름. 새준비manifest기본GEX1·전체로컬corpus지문및case별투영hash고정·임의절단/누락/정책변경lease전거절. 기존EX1/v2기반207/173/옛본문·원장보존,legacy6본문바이트동일·제품547/사이트/DB/lockfile불변. 실제API/count/키읽기쓰기/추가과금/운영QA/Git/배포/정리0. T34/4review·24/40·77/133유지,전체프로젝트/가족/실제AI자격/영어품질/위험표본/실제토큰·요금·금액승인/확인·일반화·학습·운영·출시·1일/7일 미완료·키재사용기승인/사람섭외필수아님.

새필수정책의 로컬 중복 검사 범위는426표면이다. 모델은범위가명시된부분자료를받고partial보류를유지하므로영어품질/구조독립성합격은아니다. 제품전체/2052전체실행/14종프로세스강제종료는기존근거를재사용했다. 최종관리/대시보드/보존은 phase38/execution-verification.json 및 progress-final.json을따른다.


## Phase39 · 단어 출처와 공개 평가 기준의 의미 감사

[2026-11-07 phase39 단어출처/의미참조 감사] lexical1차8출처(선택본문HTTPS4/공식web발췌만4,미채택6조회보존)·ask/book/help3품사뜻연결/작성9본문+G12반대근거3본문구성. quiet부사항목MW와보통quietly학습지침공존을확인했지만speaking결합의모든문체자연스러움은미검증. 기존G12/N04의단정오류/allpass보정기준은문체·해당용례재검토전새준비도구의--qualification-ready에서readyfalse/exit2보류;원본G12/N04벡터·점수불변/N04현재일반안내설명보존. 전체12참조/6통제미검토벡터및부정소실/이전메시지통제의다차원오염검토필요·GEX1규칙상6공개통제는knownexposurefail이며문법점수와분리. sourceaudit는같은Codex의제안/독립AI자격아님. 새각Node6/6·출처/private/hash/flag·blocker우회차단·lint0경고/exit0. 기존8KiB/요청/출력설정·426전체로컬자료/제품547/실행기불변,새준비차단을기존합성실행기전체/유료경로로연결했다고주장하지않음. docs/AI_QUALITY_V147_LEXICAL_REFERENCE_AUDIT_20261107.md·lexical-reference-preparation.json따름. 최초builder는선택goldCaseId누락가정실패·부분출력과코드/실패보존후get필터/지문대조로복구. 실제API/count/키읽기쓰기/추가과금/운영QA/배포/Git/정리0·T34/4review·24/40·77/133유지·사람섭외필수아님·위험/표본/실제영어품질·자격/토큰요금·금액승인/확인·일반화·학습·운영·출시·1일/7일남음.

새준비guard의exit2는의도한미완료보류이며검사실패/영어오답측정이아니다. dictionaryquiet부사항목이특정speaking구문의정답을보증하지않아문체/용례검토전단정gold확정을보류했다. 현재제품/실행기와원래벡터는보존했다. 최종관리/대시보드/보존은 phase39/execution-verification.json 및 progress-final.json을따른다.


## Phase40 · 공개 참조 통제의 전체 차원과 요청 연결

[2026-11-07 phase40 공개참조통제v2] 5출처(HTTPS편집본문4/공식검색편집발췌만1)·6통제의7차원42/중대30셀을같은Codex출처기반제안으로명시. 부정소실은명시needs_work라벨/부정삭제교정실패,이전메시지없는응답은원래라벨/출처/모호성실패와교정unavailable등을분리해미검토차원자동pass제거. reference-v4에공개known-input전용순수requestbuilder추가;freshmaterializer알려진문장차단유지/legacy본문바이트동일. 6x3x2=36실제본문26928–37192바이트/비공개기대값제외/공통partial50·78항목. 새36요청은180/1872에기포함아님·추가승인0/재산정필요. 실제전송/키/실제자격연결없음. 새각Node7+회귀43/lint0경고exit0,36/36합성대조vs35/36유효형식오답보류. 최초known차단실패/보존본import누락6of7실패·코드/로그보존. docs/AI_QUALITY_V147_REFERENCE_CONTROLS_V2_20261107.md·reference-controls-preparation-v2.json따름. 구G12/N04·12참조/v1/점수/원장/426표면/제품547불변,phase39미검토를v2제안으로완료승격안함. T34/4review·24/40·77/133유지;위험/표본/비용/실제AI자격/영어품질/학습·운영·출시·기간점검남음. 실제AI/count/키읽기쓰기/추가과금/운영QA/배포/Git/미병합정리0.

최종관리/대시보드/보존은 phase40/execution-verification.json 및 progress-final.json을따른다. 추가36개는미승인요청후보이며실제영어/검토자자격측정이아니다.


## Phase41 · G12/N04 직접 심사와 본문별 count 준비

[2026-11-07 phase41 G12/N04 직접진단] 기존반대근거3요청은새예문작성용이며G12가본문전체에없다는최초가정은오류:exposure제외목록에는있었지만직접심사대상/N04실제설명은없었음. 최초6/7실패·코드보존/정정. 정확한G12/N04원문·제안교정·실제일반설명과4출처/Oxford발췌(직접403보존)를5질문/3모델x2순서6본문6326–6328바이트로구성. private기대점수/원행지문제외·공개hash불변·없는is-speaking인용거절. 합성동의도미확정/문체차이보류·gold적합/실제영어자격false유지. 공개통제36+직접6=42본문의기존count구성요소준비42/변경설명·지침의옛영수증거절;실제토큰/요금/금액승인아님·180/1872기포함아님. 공식count/가격재확인했지만count요금미확정/무료가정안함·quoteReadyfalse4사유. 새각Node7+회귀24/lint최종0경고exit0(최초미사용1경고보존). docs/AI_QUALITY_V147_DIRECT_CASE_REVIEW_20261107.md·case-review-preparation-v1.json따름. 기존코어/제품547/원G12/N04/점수/예산/426표면불변·T34/4review·24/40·77/133유지. 실제AI/count/키읽기쓰기/추가과금/운영QA/배포/Git/정리0·실제검토/위험/표본/금액/영어품질·학습/운영/출시/기간점검남음.

최종관리/대시보드/보존은 phase41/execution-verification.json 및 progress-final.json을따른다. 실제영어판정/요금측정/유료평가는아니다.


## Phase42 · 별도 공개진단6회 실행·비용·승인 준비

[2026-11-07 phase42 6회 실제진단 승인 준비] G12/N04 공개진단6회 전용 실행기/새run·독립회계. 공식모델최대입력922000·출력4096·Standard장문최고입력범주+지역10%의 보수적상한 US$132.724592/요청한도 세전US$133(예상청구액아님). countAPI불필요/이전42준비·180/1872·통제36승인아님. 실제승인필드/현재본문·코드·런타임/금액binding후 영구ONCE·전체예약·키읽기순서,원장소비후1회전송/응답저장재독해후정산,현재승인변경/캡처변조/키반사/HTTP오류·실제프로세스경합/종료시최대보존·자동재전송/재개없음. Node22/24각14+예산23/직접7회귀/최종lint0경고exit0. docs/AI_QUALITY_V147_DIAGNOSTIC_APPROVAL_20261107.md·diagnostic-envelope-preparation-v1.json따름. 현재추가과금승인US$0·실제AI/count/키읽기쓰기/운영QA/배포/Git/정리0. 기존키재사용기승인·새6회/금액사용자승인필요. T34/4review·24/40·77/133유지·영어품질/참조/통제/표본/학습/운영/출시미완료.

최종관리/대시보드/보존은 phase42/execution-verification.json 및 progress-final.json을 따른다. 실제 유료 평가/영어 합격은 아직 아니다.


## Phase43 · 테스트 프로그램 예문 노출 후보 감사

[2026-11-07 phase43 프로그램 예문 노출 감사] phase36의 미추출tests프로그램123개를 TS5.9.3 AST로만 파싱(실행/import/보간평가0). 정적12596·템플릿163 방문/필터후 문장형629회·433종/기존426밖399종·미전개틀15. 원문/교정안/테스트설명 미분류후보이며 실제입력399누락으로 단정하지 않음. 소스·구간/UTF16행열/출처보존·규칙/주석제외·키형태억제·원본사본변경/구문/경로차단·없는문장도fresh미확정. 모델투영/현재fresh정책변경0·전체노출/구조가족/영어자격아님. Node22/24각7·최종lint0경고exit0;pending공개6진단 본문/run/상한/Node24bundle동결불변. docs/AI_QUALITY_V147_PROGRAM_EXPOSURE_AUDIT_20261107.md·program-exposure-audit-preparation-v1.json참조. T34/4review·24/40·77/133유지. 기존원장/점수/제품547/global426보존·실제AI/count/키읽기쓰기/추가과금/운영QA/배포/Git/정리0. 원문역할검토/동적전개/다른생성기·보관자료·가족/위험·표본·실제검토/학습/운영/출시남음.

최종관리/대시보드/보존은 phase43/execution-verification.json 및 progress-final.json을 따른다. 실제 원문 전체 추출/모델투영/fresh 자격은 아니다.


## Phase44 · 테스트 예문의 유한 생성 범위 추출

[2026-11-07 phase44 유한 템플릿 출처 전개] phase43의 동적후보15개는 영어틀12/한국어UI1/SQL2로구분(영어15개로단정안함/옛후보보존). 테스트/import/반복/SQL실행없이 TS구문에서14POS형용사상수와words데이터·유한5반복목록의짝/행을보존해76기록/69정규화표면전개. 모두기존426밖·68개는정적433밖/1개겹침. 소스/반복배열/UTF16구간·parser원문/제안교정/보존입력역할보존·기대점수부여0. 임의표현/원본·사전·틀변경/실제library사본변경차단·없는문장도fresh미확정. 선택12표현식완전전개외 전체생성/정적629역할/구조가족/영어품질미확정·모델투영/현재fresh정책변경0. 각Node8+기존7회귀/최종lint0경고exit0. docs/AI_QUALITY_V147_PROGRAM_TEMPLATE_EXPANSIONS_20261107.md·program-template-expansion-preparation-v1.json참조. pending진단6본문/run/상한/Node24bundle불변·실제AI/count/키읽기쓰기/신규과금/운영QA/배포/Git/정리0. T34/4review·24/40·77/133유지·이전자료/점수/원장/제품547보존. 정적역할/다른생성기·교재조각·가족·위험/표본/실제검토·학습·운영·출시남음.

최종관리/대시보드/보존은 phase44/execution-verification.json 및 progress-final.json을 따른다. 선택12개 표현식 외 전체 생성·정적 역할·모델투영/fresh/영어 자격은 아니다.


## Phase45 · 개발 예문의 해시 차단과 수집/보고/인계 연결

[2026-11-07 phase45 개발예문69 해시 차단 연결] 76출처/69표면의해시·역할만있는 PEX1 로컬index와required계약을 기존GEX1에보충. lease/소비/전송전출처변경차단·부모응답먼저저장/정산후known보류·자식/현재V3인계차단·수신중출처변경도캡처보존·소비후변경최대유지/재전송0. 새프로필clientDispatches 실제시도집계. GEX없는통제가상old코어3회/인계1→current1회/자식0/인계보류(실제영어근거아님),현재GEX partial미확정유지·없는문장양성대조/partial인계기록. 새각Node11·기존47통과/조건부전체2052각1skip·builtWorker각12/통제중단2·최종lint0경고exit0. 최초프로토콜0/10·fixture구성요소0/10·보조조건8/10·예산필드9/10와코드보존/수정. docs/AI_QUALITY_V147_PROGRAM_EXCLUSION_INTEGRATION_20261107.md·program-exclusion-preparation-v1.json참조. 현재fresh프로필PEX1필수/과거객체legacy유지·모델본문에새69목록원문/점수전달0·기존global426/한도/학습API변경0. 핵심수집기/보고서2파일최소보완·기존bytes/pending6본문/run/상한/Node24bundle불변. T34/4review·24/40·77/133유지·실제AI/count/키읽기쓰기/신규과금/운영QA/배포/Git/정리0. 정적역할/다른소스·가족/위험·표본/실제검토·학습·운영·출시미완료.

최종관리/대시보드/보존은 phase45/execution-verification.json 및 progress-final.json을 따른다. 실제영어품질/전체프로젝트노출/가족독립성/유료승인은 아니다.


## 2026-11-08 phase61 · T34.3 설명에 포함된 추가 질문 전달 확인

[검증·이전 가정 정정](AI_QUALITY_V147_VISIBLE_QUESTION_20261108.md):각Node66builtWorker결과/264평가본문과두브라우저표시컴포넌트일치·질문제거비교본검출·린트exit0. 추가질문은explanation에이미포함되므로별도위젯누락으로단정하지않는다. 전체학습UI·실제AI품질/자격·위험표본/금액·후속단계는미완료. API/키/과금/운영/Git/정리0·T34/34.3review·24/40/77/133·US5/3.788335유지. 최신관리phase61/제품phase18e/실제진단phase52,새4회범위답변대기.


## 2026-11-08 phase62 · T34.3 실제 학습 화면 문맥 보완·재요청·재조회

[실제 화면 검증](AI_QUALITY_V147_QUESTION_UI_20261108.md):각Node두브라우저/3모델설정/단어문법12흐름·24합성응답의질문→문맥/reply→새UUID/지문재요청→클라이언트저장/재방문확인·편집/재방문자동요청0·명시한학습필드보존·린트exit0. 합성예시1개/실제영어품질·자격·위험표본·전체UI/운영·후속단계held. 최초2검사오류와원문/소스/합성D1보존·제품547/407불변·API/키/운영/Git/정리0. T34/4review·24/40/77/133·US5/3.788335·새4회범위답변대기. 최신관리phase62/제품phase18e/실제진단phase52.


## 2026-11-08 phase63 · 승인된 후속 실제 진단·추가 예산

[실제 결과](AI_QUALITY_V147_TWO_REVIEWER_ACTUAL_20261108.md):Sol/Terra4응답4실측계산·공개24/24/공유4/4·같은두모델과거6/24보존·영어자격/인과효과아님. 생성/계산여유/이전비용보수합4.471863of5·잔여0.528137. 사용자추가35승인별도미사용/총40·보수잔여35.528137. 실원본67파일읽기전용재검사·Decimal대조exit0·재전송0/원장종료. 글로벌16응답/12계산/키5·현재12보정/전체품질held·T34/34.3review/24of40/77of133·제품547/407/유료16소스불변·운영/Git/정리0. 후속새참조/역할자격·예비/확인설계는추가승인예산으로진행한다.


## 2026-11-08 phase64 · 실제 제품 보정 진단과 기준 결함 확인

[보고서](AI_QUALITY_V147_PRODUCT_CALIBRATION_ACTUAL_20261108.md):실제6응답6계산·후보50/72/출처61/72/분쟁6·보정/채점기자격보류. 옛기대값변경/재채점0·추가사용상한2.482733of35/전체6.954596of40·입력5159–5266/99원본/Decimal/각Node11회귀. 글로벌22응답18계산키6. 적용범위·목표판정·위험관계·출처와문맥 분리의 새정책수정후 별도동결재검증필요. T34/4review·24of40/77of133·제품547/407/유료16핀·전체품질held/운영Git배포정리0.


## 2026-11-08 phase65 · 새 판정 기준과 실제83/84·1이견 보존

[보고서](AI_QUALITY_V147_PRODUCT_RUBRIC_V2_ACTUAL_20261108.md):6문제정책2/3축·출처3·보정14+분쟁1 실제6응답6계산·83/84/출처축84/84·Astra Music문법1이견으로 전체일치미충족held. 새기준/문항/목표기대변경으로 옛50/72와 인과비교없음·옛원문/점수불변. 추가35 누계5.058448·전체40누계9.530311/잔여30.469689·99물리/Decimal/각Node14회귀·글로벌28/24/키7. 주평가정책1/기존참조차단유지·24of40/77of133·T34/4review·제품547/407/유료16핀보존·운영Git배포정리0.


## 2026-11-08 phase66 · 실제요청문맥·별도제품정책검사 연결

[보고서](AI_QUALITY_V147_ASSESSMENT_CONTEXT_20261108.md):선택평가프로필에원래목표/형식 바인딩·EnglishV2와bounded정책분리. 각Node신규14/기존12/최종영향3,132합성count/model·정책fail6행held·근거부족/문맥이견보류·보정3축오류면본평가0·입력변경요청전0·필수자격lease전0·24기존Worker본문재투영/새Worker아님. 실제API0·28/24/키7·9.530311of40/83of84이력·자격held유지. ROOT도SOURCE제품정책읽고비선택은지연로드·4평가런타임변경전지문보관·제품547/407/과거유료소스불변·24of40/77of133·운영Git배포정리0.


## 2026-11-08 phase67 · 본평가형식 개별실제66/72·문맥대조12/12

[호출전설계](AI_QUALITY_V147_ASSESSMENT_CALIBRATION_20261108.md)와 [실제결과/남은범위혼합](AI_QUALITY_V147_ASSESSMENT_CALIBRATION_ACTUAL_20261108.md)을 따른다. 실제84응답/84계산·기본66/72·전체3축84/84·문맥대조12/12. F04 단어/문법6이견·명시문맥만으로해결안됨·앱명령과영어기준동시전달확인/인과미검증·자격/출시held. 각Node신규11/최종캐시1·출력guard·기존문맥14/구형동일성1·린트0경고. 1277실제파일읽기전용/Decimal·36/36/12닫힌재정저장소·84knownusage·재전송0. 추가35누계20.914282/잔여14.085718·전체40누계25.386145/잔여14.613855(계산료여유/청구서미확인),글로벌112/108/키8. 제품547/407·기존5/원장/점수·5플랜·24/40/77/133·운영Git배포정리0 유지.


## 2026-11-08 phase68 · 영어지시분리 실제12/18→17/18·R01위험경계보류

[사전설계](AI_QUALITY_V147_ENGLISH_SCOPE_COMPARISON_20261108.md)와 [실제결과/한계/예산](AI_QUALITY_V147_ENGLISH_SCOPE_COMPARISON_ACTUAL_20261108.md)을 따른다. 실제18쌍36응답/36계산·혼합12/18·새17/18·F04 0/6→6/6·3축36/36·별도정책18쌍동일. R01 Terra feedback-first의reverseMeaning1이견으로 전체규칙미충족·영어정답인증/본평가연결/자동자격승격/재전송0. 각Node신규12/구형컴파일러1·lint0경고,549실제파일읽기전용·Decimal·기존3배정보존. 추가35누계27.642603/가용7.357397·총40누계32.114466/산술잔여7.885534(청구서/계산료단가미확인),누계148/144/키9. 상위24/40·세부77/133·T34/4review·제품547/407·과거원장/점수·5플랜·운영Git배포정리0 유지. 다음은유료재실행보다먼저반전vs발화창작의경계를출처/대조예시로검토하고새미공개가족을동결한다.


## 2026-11-08 phase69 · 내용과발화목적구분 후보3·격리개발진단

[후보규약/출처/구현/한계](AI_QUALITY_V147_CRITICAL_BOUNDARY_20261108.md)를따른다. Cambridge원저요약4·공개개발12·개별72요청/계산본문·새지문/형식/파서·5차원/4위험/3축유지,각Node10·lint0경고·동결출력거절. 내용만/목적만/둘다/미확정·정상·응답없음구분,두위험동시기록·1위험누락/근거축이견/위조판정기준held·가상72일치도자격승격0. R01은내용도바뀔수있어Terra오류단정안함·기존17/18/기대값/원문불변. 새유료API/계산/키/비용0·누계148/144/9·추가35누계27.642603/가용7.357397·총40누계32.114466유지·청구액/단가미확인/로그인필요. 미공개확인문항·실제효과·본평가연결/자격/출시미완료,상위24/40·세부77/133·T34/4review·제품547/407·5플랜·운영Git게시정리0보존.


## 70. 출력1024 실제 경계 진단 · 66/72·설명 이견 보존

2026-11-08 · T34.3/T34.4 · ai-quality-v147 · phase70. 전체 40개/133개 작업의 일부이며 T34는 review, 품질·출시는 held다.

공개 개발 12조건 × 3모델 × 입력/피드백 우선 2배치로 실제 72응답·72입력 계산을 수집했다. 원래 4096 출력 상한만 1024로 바꾸고 지시·입력·스키마·기대값은 보존했다. 실제 입력은 4745–4962토큰, 출력은 175–331토큰(합계 14835)이었다. 72응답 모두 완료·유효이며 재전송·재시도는 0이다. 별도 동결된 4096 프로필의 자격으로 전용하지 않는다.

| 관찰 | 결과 | 해석 범위 |
| --- | --- | --- |
| 사전 기대값 전체 일치 | 66/72 | 영어 정답률이나 독립 검증이 아니다. |
| 출처·학습 문맥·보류 필요 3축 | 72/72 | 이번 공개 개발 조건에 한정한다. |
| 요구한 중대 플래그 누락/추가 | 각 0 | 위험 양성 조건 48표·66개 플래그 기회이며 독립 사건 수가 아니다. |
| 피드백 있는 조건 | 60/66 | 피드백 없는 대조 6/6은 따로 센다. |
| Sol/Terra/Astra | 각각 22/24 | 같은 조건·같은 공급자 반복으로 독립 표본이 아니다. |
| 사전 제한 통과 규칙 | 미충족 | 본평가 연결·자동 자격·출시 승격은 하지 않았다. |

## 남은 이견과 기준 자체의 문제

6이견 모두 CB08의 설명 평가다. `Close the hatch.`를 문법 오류로 분류하고 `Please close the hatch.`로 고친 피드백을 사용했다. 세 모델·두 배치는 문법 판정과 불필요한 교정을 모두 fail로 판정했지만, “이 교정이 원문의 의미와 문장 형식을 그대로 보존”한다는 설명은 pass로 판정했다. 사전 기대값은 그 설명에도 fail이었다. 다른 4개 평가 항목·4개 중대 플래그·3축은 모두 같았다.

이 사례는 AI가 오류를 놓쳤다는 증거로 단정할 수 없다. 명령에 please를 넣어도 명령이라는 형식·목적과 대상 행동을 유지할 수 있기 때문에, 설명 문장 자체의 참/거짓과 피드백 전체의 부적절함을 섞은 기대값일 가능성이 있다(현재 분석자의 추론, 독립 영어 인증 아님). 6이견을 삭제하거나 72/72로 재채점하지 않는다. 당시 66/72, 원문, 기대값과 구버전 기준을 그대로 보존한다.

다음 수정에서는 설명의 사실성/과도한 확신과 문법·교정 판정의 정확성을 각각 검사해야 한다. 참인 보존 설명/거짓 보존 설명/문법 오류를 주장하는 설명을 새 대조 조건으로 설계하고, 결과를 보기 전에 새 기대값과 버전을 고정한다. 기존에 노출한 12조건으로 일반화나 인과 효과를 증명하지 않는다. 새로운 오류 가족의 확인 평가·AI 평가자 자격·학습 효과 대리 검사·운영 검증은 남아 있다.

## 예산과 보존

| 원장 | 보수적 사용·여유 포함(세전 US$) | 상태 |
| --- | --- | --- |
| 기존 5 | 4.471863 / 닫힌 잔액 0.528137 | 재개·이전하지 않는다. |
| 추가 35 | 33.077501 / 새 작업 가용 1.922499 | 예약 0, 기존 4배정 보존·새 5번째 배정 정산. |
| 합계 40 | 37.549364 / 산술 잔여 2.450636 | 닫힌 기존 잔액은 새 작업 가용액에 포함하지 않는다. |
| 이번 단계 | 5.434898 | 모델 성분 2.434898 + 입력 계산료 여유 3.000000. |

입력 실측과 실제 응답 사용량으로 Python Decimal을 별도 대조했다. 단가는 Sol 2/10, Terra 1/5, Astra 10/50(입력/출력 백만 토큰당 US$), 기본 캐시 쓰기 1.25와 안전 계수 1.1을 적용했다. 캐시 수명은 요청에 설정하지 않은 공식 기본값을 근거로 계산했으며 72응답의 수명 상세가 없어 실제 수명을 관측했다고 주장하지 않는다. 입력 계산 API 별도 단가·청구서는 미확인이다. 과거 여유액을 풀지 않았으며 이번 3달러도 유지한다. 이 표는 청구서 확정 금액이나 모든 공급자 과금의 보증이 아니다.

누계 220응답·216입력 계산·키 로더 10회다. 이번 키 읽기 1회는 기존 재사용 승인 범위다. 72개 입력을 먼저 계산했고, 2개 금융 저장소의 36+36개 사용량을 닫은 뒤 원장을 정산했다. 결과 분석 재조회는 API/키 접근 0이다.

| 경로 또는 정리 범위 | 분류 | 보관·삭제·보류 | 근거 또는 재생성 방법 | 검증 결과 |
| --- | --- | --- | --- | --- |
| ROOT/outputs/ai-quality-v147-budgeted-critical-v1-runtime-20261108 | 평가·검증·운영 근거 | 보관 | 실제 원문·요청·토큰·비용 저장소 1093파일 | 읽기 전용 재검사·사용량 72개·Decimal 일치 |
| ROOT/outputs/ai-quality-v147-supplemental-claim-v5.json | 재실행 차단 근거 | 보관 | 완료 실행의 영구 단일 실행 표식 | 런타임 ONCE 지문과 일치 |
| .taskmaster/scripts/*budgeted-critical* 및 *critical-budget-profile* | 회귀 테스트·재사용 도구 | 보관 | 무재전송·상한·원장 보호 재현 | Node22/24 각 12검사 exit 0 |
| ROOT/outputs/ai-quality-v147-implementation-20261106/phase70 | 평가·검증 근거 | 보관 | 호출 전 설계·실패/실행/분석·최종 검사 지문 | 최종 관리·브라우저·보존 결과는 이 폴더의 검사 파일을 따른다. |
| 브랜치·worktree·work/outputs 기타 | 정리 판단 보류 | 유지 | 아직 병합·전체 품질 확인 전 | 이번 삭제 0 |

제품 입력 547파일·기존 빌드 407파일과 이전 평가 근거를 보존한다. 제품 변경·DB 마이그레이션·운영 쓰기·배포·Git 게시가 없어 이번 진단의 운영 동작 영향은 없다. 복구 시 새 프로필을 선택하지 않고 기존 프로필을 유지하며 실제 요청은 재전송하지 않는다. 전체 단위·타입·제품 빌드는 입력 불변 지문을 대조하여 이전 phase18e 결과를 재사용했다. 이번 변경 대상인 진단 도구는 Node22/24 검사, lint, 관리 검증과 기존 대시보드 Chromium/WebKit 회귀로 검증한다.

[호출 전 설계](AI_QUALITY_V147_BUDGETED_CRITICAL_20261108.md), [기준 후보3](AI_QUALITY_V147_CRITICAL_BOUNDARY_20261108.md), [전체 구현](AI_QUALITY_V147_IMPLEMENTATION_20261106.md). 원시 근거: ROOT/outputs/ai-quality-v147-implementation-20261106/phase70/{readback,independent-finance,analysis,disagreements}.json. 영어 정답·학습 효과·새 미공개 가족 성능·운영 출시 안전성은 미검증이다.



## 71. 설명 사실성·교정 적절성 분리 후보4

설명 자체의 모든 중요한 주장과 함의를 평가하되다른평가항목오류를자동전이하지않는다. 참인설명에도잘못된교정/중대위험held,거짓설명단독held를유지한다. 공개4쌍+없음1·54본문·Node22/24각12계약검사·동결출력거절통과. 실제AI효과/새가족확인/본평가연결/자격은미완이며옛66/72·기대값·원문·30유료핀·기존원장불변이다.

[구현·출처·검사·보관·미검증](AI_QUALITY_V147_EXPLANATION_SCOPE_20261108.md). 실제추가API/계산/키/비용0·누계220/216/키10. 추가35보수33.077501·새가용1.922499/총40보수37.549364유지(계산단가·청구서미확인). 제품547/407·운영/Git/배포/정리0. 최신관리phase71·제품phase18e·T34/자식4 review·전체24/40·77/133·출시held.


## 72. 후보4 두모델 실제36/36 · 전체자격보류

[2026-11-08 phase72] 후보4 Sol/Terra 모든9조건·2배치 실제36응답/36입력계산 완료. 기대값36/36·3축36/36·요구의미반전8양성누락0·설명pass+나쁜교정12보류·거짓설명단독4보류. 실제32피드백/4없음분리·단어채점기진단이며학습피드백생성/문법15수업/다른3중대양성/Astra/전체54/새가족/영어정답자격아님. Node22/24 각12·소스37/실제549파일/금융1x36/이전5배정/Decimal대조. 추가35누계34.516219/새가용0.483781,이중계산료여유26.896016·모델상한7.620203(실제청구미확인). 누계256/252/키11·재전송0·옛66/72/기대값/원문보존. docs/AI_QUALITY_V147_EXPLANATION_PAIR_ACTUAL_20261108.md; ROOT:outputs/ai-quality-v147-implementation-20261106/phase72. T34 review·전체24/40·77/133·출시held유지.

[실제결과·예산분해·한계](AI_QUALITY_V147_EXPLANATION_PAIR_ACTUAL_20261108.md). 최신관리phase72·제품phase18e·운영Git배포정리0.


## 73. 설명기준4 본평가 합성경로 연결·실제자격 보류

[2026-11-08 phase73] 설명기준4를선택본평가합성경로(컴파일/원문캡처/보고서)에연결·1024상한/실제목표필드/문맥/5차원4위험3축/별도제품정책유지. 각Node신규13·통제fixture132계산/132캡처/보고서·기존7종회귀exit0. fixture점수는기계검사용이며새영어gold/자격아님;본실행기는새기준출처검증12문항레지스트리가없어잠금/계산/전송전차단. 참인설명+나쁜교정fail·거짓설명단독fail·반전critical·근거/문맥이견보류·구형/V2바이트동일. 사용자11/8화면3.27/244/1235655대조일치이나계산API무료/청구확정아님·원장해제0. 새실제AI/count/키0·누계256/252/키11·추가35보수34.516219/가용0.483781·기존5닫힘. 과거37유료소스/549파일/원점수/547제품/407빌드보존. docs/AI_QUALITY_V147_EXPLANATION_MAIN_20261108.md;ROOT:outputs/ai-quality-v147-implementation-20261106/phase73. T34/4review·24/40·77/133·전체품질/출시held. 실제본평가·위험/표본·새가족·학습·운영/기간점검미완.

[변경·검증·예산·한계](AI_QUALITY_V147_EXPLANATION_MAIN_20261108.md). 최신관리phase73·제품phase18e·운영/Git/배포/정리0.


## 74. Astra 실제18/18·공개54/54·캐시비용정산

[2026-11-08 phase74] Astra실제18응답/18입력계산·기대값18/18·3축18/18·중대누락0. 기존Sol/Terra36과같은동결54풀 합계54/54·공개개발한정/독립표본아님. 원문279파일/단일18금융슬롯/Decimal재검사·Node22/24각15 exit0·lint0. 사용자링크Chrome Spend categories 직접조회(실행전3.27/244/1235655): 모델입력/출력/캐시읽기/쓰기만표시·별도input_tokens항목없음이나무료/청구확정아님. 과거240캐시비용대조 모델여유3.139276조정·기존6배분보존·미사용0.483781회계예약·새조정원장단일발급/지출. 계산료여유28.096016전부유지. 이번보수1.862311/추가35유효33.239254·가용1.760746/총40보수37.711117,기존5닫힘. 누계274/270/키12·재전송/재채점/본평가자격/운영Git배포정리0. docs/AI_QUALITY_V147_EXPLANATION_ASTRA_ACTUAL_20261108.md;ROOT:outputs/ai-quality-v147-implementation-20261106/phase74. T34/4review·24/40·77/133,실제본평가/위험표본/출처12/미공개가족/학습/운영/기간점검미완.

[실제 결과·예산·한계](AI_QUALITY_V147_EXPLANATION_ASTRA_ACTUAL_20261108.md).


## 75. 본평가보정12 후보·정확72본문·비용CSV대조

[2026-11-08 phase75] 본평가보정후보12(정상/오류/모호각4,중대4종/미제공1)·출처10직접재검토·동일compiler개별72본문/입력계산본문/기준4/1024상한 준비. MC08은F04새설명변형만명확화:설명pass가설/교정fail·보류fail·inventedIntent유지,과거F04기대값/원점수불변. 각Node11/11·기대값누출0·합성72일치여도자격false·본실행기12문항자격차단유지. Chrome최신11/8US3.71/262/1328093·CostCSV15항목토큰/금액이262원문과정확일치,합US3.7071348(추가35모델US3.5086278)/미귀속0·별도계산항목없음. PythonDecimal/독립JSCSV/BigInt일치. 원장조정은제안만:과거계산료여유28.096016중27.096016조정/미반영비용1달러유지(설계가정)시가용28.856762,미적용. 현재추가35보수33.239254/가용1.760746·총40보수37.711117유지. 새72가상6000입력상한견적6.431184가현재가용초과라실행0. 신규실제AI/count/키0·누계274/270/키12·재전송/재채점/금융원장재개/운영Git배포정리0. docs/AI_QUALITY_V147_MAIN_WITNESS_CANDIDATE_20261108.md;ROOT:outputs/ai-quality-v147-implementation-20261106/phase75. T34/4review·24/40·77/133,위험표본/실제72보정/새가족/학습/운영/기간점검미완.

[출처·구현·비용과한계](AI_QUALITY_V147_MAIN_WITNESS_CANDIDATE_20261108.md).


## 76. 실제비용 대조와 중복사용 없는 예비비 조정


[2026-11-08 phase76] 사용자지정Spend categories 직접새로고침:11/8UTC Default project US3.71/262/1328093·모델입력/출력/캐시15항목·별도계산항목비표시. 동결CSV15개정확대조에근거해미사용계산료예비비27.096016을단한번조정,과거미청구비용여유1달러는설계가정으로유지·과거모델상한5.143238유지. 추가35현재보수사용6.143238/가용28.856762/예약0,전체40보수10.615101·기존5닫힌0.528137재사용금지. 과거금융2원장불변·영구발급/양쪽원장/프로세스경합/부분쓰기/중복/변조차단각Node12/12. 실제추가AI/count/키0·누계274/270/12. 고정72판정/72계산·예약상한6.45범위만후속가능,수집기/실제입력측정/실행미완. 본평가자격0/12·기대값AI가설·출시held·위험표본/미공개가족/학습/운영/기간미완. docs/AI_QUALITY_V147_REPORTED_COST_RECONCILIATION_20261108.md;ROOT:outputs/ai-quality-v147-implementation-20261106/phase76. T34/4review·24/40·77/133유지.
[원장·검증·한계](AI_QUALITY_V147_REPORTED_COST_RECONCILIATION_20261108.md).


## 77. 본평가 보정12 실제72 판정과실측비용 정산


[2026-11-08 phase77] 실제보정12문항/3모델2순서72응답·72입력계산·기존키1로수집완료. 기대값63/72·3축71/72·중대양성누락0표·source48/고정본문72/두36저장소/원문/영수증보존. 실제입력4746~5348/출력최대395. 예약6.45에서실측최대6.041762·모델캐시정산+계산료여유2.1유지로이번보수3.169134,추가35유효사용9.312372/가용25.687628/예약0,전체40보수13.784235. 과거미청구여유1달러설계가정유지·최종청구/무료미인증·원래5닫힘·옛금융2원장불변. 각Node12/12·최초Node24시료역할/의미반전규칙위반실패1보존·교정후전체재검사. 재전송/자동승격0·누계346/342/키13. 공개기대값은AI가설/반복은독립표본아님·출처자격0/12·실제본평가/위험표본/미공개가족/학습/운영/기간/출시held·상위24/40·세부77/133·T34/4review유지. docs/AI_QUALITY_V147_MAIN_WITNESS_ACTUAL_20261108.md;ROOT:outputs/ai-quality-v147-implementation-20261106/phase77.
[실제결과와한계](AI_QUALITY_V147_MAIN_WITNESS_ACTUAL_20261108.md).


## 78. 교정 보류 의미 수정·실제84 재평가


[2026-11-08 phase78] phase78: 제품의 교정보류 표시와 평가기준 의미를 맞춘 새 기준5. 공개12문항·3모델2순서 실제72표 71/72·3축72/72,거짓 문법승인 안전통제12/12·중대누락0. 합계84응답/84입력계산/키1. 공개AI가설 대조이며 영어정답률아님. 본평가·미공개일반화·학습·운영·출시 미완,24/40·77/133·T34review. 과거결과63/72·71/72와24/24는 과거근거로 보존. 실제목표필드·별도제품정책 유지. 기존 US$5 보수사용US$4.471863/닫힌잔여US$0.528137(재사용금지). 추가 US$35 보수사용US$13.416774/가용US$21.583226/예약US$0. 총 US$40 보수사용US$17.888637. 이번84 보수상한US$4.104402(입력계산료 여유US$2.850000 포함). 청구서 미확인·무료 단정 없음. 과거원장 불변. 실제 원인/새84원문/비용/검증: docs/AI_QUALITY_V147_LABEL_SEMANTICS_ACTUAL_20261108.md. 전체완료 아님.


## 169. 한국어/영어 예비 초안과 앱 요청 연결

[2026-11-12 phase169 · 한국어/영어 예비 초안] phase169: T24.2 단어30 한국어/영어 초안·기존 문법30 보존·5차원 기준 수정안. 앱 합성 요청360·후보180/180 보관/재조회·중복 전송0. 독립 검토/참조 자격/정식 새 문항0·새 AI호출0·평가/출시 보류. 단어 유형10/10/10·길이12/12/6을 유지했다. 새 단어30의 예시/허용값은 작성자 초안이며 정답이 아니다. 문법30은 기존 객체 그대로 보존한 진단 자료다. 정식 새60문항 자격, 독립 의미/가족 검토, 한국어 대응과 언어 참조 검토, 기준 보정, 실제 본문별 비용/범위 봉인이 남았다. 구 색인 지문 불일치를 보류로 기록했고 새 초안의 제한된 문면 대조만 수행했다. 기존 참조/점수/예산은 재채택하거나 초기화하지 않는다. docs/AI_QUALITY_V147_BILINGUAL_PILOT_DRAFT_20261112.md
[범위·실제 검사·남은 조건](AI_QUALITY_V147_BILINGUAL_PILOT_DRAFT_20261112.md).


## 170. 한국어/영어 실제 검토 실행 준비

[2026-11-12 phase170 · 한국어/영어 실제 검토 실행 준비] phase170: T24.3 한국어/영어30쌍 가린 언어 참조60판정·3응답/3계산 수집기31검사 통과. 최대 US$1.249323(전용0.884758+일반0.364565) 재배정 제안·실측입력 우선·승인/실제호출/예약0·참조/예비/출시 보류. 작성자 예시/층/과거 점수/제품 응답을 가리고 동결 앱 입력만 두 모델에 배정한다. 원문 문법과 한국어 뜻 교정은 분리한다. 기존 추가 US$35 유지·25,000 실측 입력/8,192 출력 상한·입력 계산3개 우선·10% 비용 여유·계산료 충당0.105 포함. 기존3회 승인은 소진됐으므로 새30문항 및 전용 잔액 재배정 승인 필요. 자동 재시도/새 범위 자동 집행/정식 참조 자동 승격 금지. docs/AI_QUALITY_V147_BILINGUAL_REFERENCE_SCOPE_20261112.md
[본문·비용·실패 복구·검증](AI_QUALITY_V147_BILINGUAL_REFERENCE_SCOPE_20261112.md).


## 171. 한국어/영어 실제 AI 검토 완료

[2026-11-12 phase171 · 한국어/영어 실제 AI 검토 완료] phase171: T24.2–4 승인한 한국어/영어30쌍 실제3응답/3계산·60판정 유효·두AI30/30 일치·작성자 차이5(정답 아님). 보수 US$0.330172·정식 참조0/60·예비0/360·출시 보류. 입력14,748·출력5,708토큰, 계산료 충당0.105 포함. 문법/목표/문맥 질문/교정문 두 모델 일치이며 영어 정답률 인증이 아니다. 정상 유지10·교정 제안10·문맥 질문10. 작성자 차이는 문맥 질문 종류4건과 같은 의도의 교정 표현1건이며 제품 결함으로 집계하지 않는다. 현재 후보의 실제 앱 생성·5차원 채점·보정·정식 참조/노출/가족 채택은 별도다. 일반 가용0.366241·전용 미사용0.659586·조건부 합계1.025827, 새 범위 자동 사용 금지. docs/AI_QUALITY_V147_BILINGUAL_REFERENCE_ACTUAL_20261112.md
[실제 입력·판정·정산](AI_QUALITY_V147_BILINGUAL_REFERENCE_ACTUAL_20261112.md).


## 172. 실제 앱 교정 진단 준비

[2026-11-12 phase172 · 실제 앱 교정 진단 준비] phase172: T24.4 동결 앱 단어2사례×3모델 실제6응답/6계산 준비·합성 저장6/화면12·수집기18검사 통과. 최대 US$1.019168(전용0.659586+일반0.359582) 제안·새 승인/호출/예약0·정식 예비/출시 보류. Music+한국어로 완성 교정, under→over의 원문 문법 정상/뜻 교정 두 사례다. 앱의 실제 본문6개가 고정 캡처와 동일하고 복구/중복/타인 접근/학습 성적 보호를 확인했다. 현재는 고정 참조 응답 검사이며 AI 품질 점수가 아니다. 6입력 선측정·입력5,000/출력4,096·계산료 충당0.210 포함·기존 추가 US$35 유지·전용 재배정 승인 필요. T26 정식 예비·T38 운영 검증은 보류로 유지한다. docs/AI_QUALITY_V147_WORD_APP_PREPARATION_20261112.md
[본문·비용·실행/복구](AI_QUALITY_V147_WORD_APP_PREPARATION_20261112.md).


## 173. 실제 앱 교정 진단 완료

[2026-11-12 phase173 · 실제 앱 교정 진단 완료] phase173: T24.4 실제 앱2사례×3모델 6응답/6계산 완료·교정/영수증/학습저장6/6·거절/미확인/재전송0·실제응답 화면12. Music→I like music, under→over·보수 US$0.302077·정식 예비/출시 보류. 한국어 의도를 반영한 완성 교정과 원문 문법 정상/뜻 교정을 세 모델 모두 관측했다. 실제 입력12,511·출력675토큰, 이번 요청2.873–5.799초(운영 성능 인증 아님). 사후 두 브라우저 실제 응답 재생12건은 추가 AI/계산0. 원문·한국어·독립 학습 성적·revision 보호 보존. 일반 가용0.156241·전용 미사용0.567509·조건부 합계0.723750이며 새 범위 자동 사용 금지. T26 정식 예비와 T38 운영 검증은 별도다. docs/AI_QUALITY_V147_WORD_APP_ACTUAL_20261112.md
[실제 문장·앱 결과·정산](AI_QUALITY_V147_WORD_APP_ACTUAL_20261112.md).


## 174. 한국어 의도 채점 기준 연결

phase174: T24.3 한국어 의도 제품 채점 기준 연결·회귀9/9. 합성360건의 채점1,440슬롯(자료 있음1,260·없음180)과 실제 앱6응답의 검토24본문 준비. 새 AI/계산/키0·보정/정식 예비/출시 보류. 과거 v8 정책/원점수는 보존하고 새 v9 기준을 별도 준비했다. 한국어로 복원한 내용은 영어 원문에 없다는 이유만으로 날조로 분류하지 않으며, 뜻 교정과 원문 문법은 분리한다. 명시 역할 없는 일반 문맥은 기존 영어 뜻 보존 기준을 적용한다. 개별1,440회 계산에 현재 공학 충당기준을 적용하면 계산료 충당액만50.40달러로 기존 한도 내 실행 불가다. 이는 실제 단가가 아니며 충당액 해제/새 호출을 승인하지 않는다. docs/AI_QUALITY_V147_BILINGUAL_PRODUCT_REVIEW_20261112.md


## 175. 검토 묶음과 현재 실제 비용 대조

phase175: T24.3 묶음 검토7/7·1,440슬롯 보존·자료1,260판정을168요청에 연결. T34.3 오늘 실제68응답 비용 US$1.35710005 정확 대조·계산료 별도 항목 없음·원장 조정0·새 AI/계산/키0·정식 평가 보류. 묶음 실제 동등성/실측 입력은 미확인이다. 유효168계산 충당5.88달러, 전량 최소180계산 충당6.30달러로 조건부 잔액0.723750달러 초과이며 실제 요금이 아니다. 11월8·9일 상세 비용은 기존 CSV와 동일하나 최종청구/무료 근거는 미확인이다. docs/AI_QUALITY_V147_GROUPED_PRODUCT_REVIEW_20261112.md


## 176. 계산료의 중복 없는 정산 후보

phase176: T34.3 계산료 충당 정산 후보10실행·129회 US$4.515·회귀7/7. 과거 재배정245회 제외·오늘68회/미청구1달러 유지·원장 조정0·새 AI/계산/키0·정식 평가 보류. 조정 시 일반 가용 US$4.671241·전용 포함 조건부 US$5.238750은 후보 값이며 현재 잔액은0.156241/0.723750 그대로다. 계산 API 무료/최종청구 미확인·기존 추가35/원래5 닫힌 잔액/기존 점수와 관문 보존. docs/AI_QUALITY_V147_CLOSED_DAY_PROVISION_AUDIT_20261112.md


## 177. 실제 앱 응답의 AI 교차 검토

phase177: T24.3 실제 앱6응답 교차 검토24/24 통과·중대0·AI12응답/12계산. Music 완성·문법 정상인 under→over 뜻 교정 지지. US$0.900248 자동 정산·기존35 승인 안·정식 평가/출시 보류. 두 공개 사례이며 일반 정확도/1%/묶음 동등성 인증이 아니다. 닫힌11월9일 충당 후보 중1.743239달러만 목적 배정·2.771761달러 계속 보류·옛245회 재사용0·새 예산0. docs/AI_QUALITY_V147_ACTUAL_APP_PRODUCT_REVIEW_20261112.md
