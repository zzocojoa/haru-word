# 공개 참조 검토 통제 v2 · 2026-11-07

공개 통제6문항의 **7차원42개·중대 표지30개를 모두 명시**하고,기존 참조 요청/검증 코드에 공개 통제 전용 요청 생성을 연결했다. 새 문항 작성 경로의 알려진 문장 차단은 유지한다. 새 코드 검사7개와 관련 회귀43개를 Node22/24에서 각각 통과했다. 실제 AI/영어 품질·검토자 자격 검증이나 제품 정책 변경은 아니다. T34/4자식 review·상위24/40·세부77/133 완료를 유지한다.

## 실제로 바꾼 것

기존 공개 통제 컴파일러는 meaningUsage=appropriate/contextNeeded=none을 공통으로 넣고 일부 실패 차원만 제시했다. 새 v2는 문항마다 원래 라벨과7개 차원의 기대값·근거를 독립적으로 적는다. 동사 통제의 범위도 일반 동사 식별과 수 일치로 명시해,기존 제품 수업의 짧은 역할 설명만으로 임의의 세부 규칙을 인증하지 않는다. 이 범위는 공개 진단용 Codex 제안이며 제품의 모든 문체/방언 판정 정책을 바꾸지 않는다.

부정 소실 문항은 원문의 수 일치가 수정 대상임을 명시한 needs_work 라벨을 사용한다. 잘못 심은 교정은 여전히 not을 지워 의미 보존 실패가 된다. 앞 메시지가 없는 They did. 문항은 문장 자체가 어떤 상황에서도 틀렸다는 판정이 아니다. 특정 수리 사건을 단정한 기준의 원래 라벨·출처 주장·불확실성 처리 실패를 함께 기록한다. 교정이 제시되지 않아 동등성을 확인할 수 없는 차원은 unavailable로 남기며 통과로 채우지 않는다.

## 전체 판정표

P=제안된 pass,F=제안된 fail,U=unavailable. 이 표는 다른 AI가 독립 검증한 최종 정답표가 아니라 현재 Codex의 출처 기반 제안이다.

| 공개 통제 | 배정 일치 | 입력/목표 | 원래 라벨 | 교정 의미 | 출처 주장 | 모호성 | 노출 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| public-positive-agreement | P | P | P | P | P | P | F |
| public-false-natural-label | P | P | F | U | F | P | F |
| public-target-mismatch | F | F | U | P | P | P | F |
| public-negation-loss | P | P | P | F | P | P | F |
| public-false-source-attribution | P | P | P | P | F | P | F |
| public-missing-reply-message | P | P | F | U | F | F | F |

6개 모두 이미 알려진 공개 입력이므로,현행 fresh-reference 기준에서 노출은 fail/knownExposureLeak=true다. 이는 영어 문법이6개 모두 틀렸다는 뜻이 아니다. 다른 중대 표지는 잘못된 목표·명시적 허위 출처·부정 의미 반전·근거 없는 사건 확신에 해당하는 경우만 켠다. 단순 uncertain/unavailable만으로 중대 오류를 만들지 않는다. 각 셀의 근거와 출처 ID는 reference-controls-v2.json에 있다.

## 출처

[Cambridge 수 일치](https://dictionary.cambridge.org/grammar/british-grammar/agreement-subject-verb)·[동사 유형](https://dictionary.cambridge.org/us/grammar/british-grammar/verbs-types)·[부정](https://dictionary.cambridge.org/grammar/british-grammar/negation_2)·[생략](https://dictionary.cambridge.org/grammar/british-grammar/ellipsis)의 편집 본문을 HTTPS로 확인하고 선택 본문 전체 지문과25단어 이내 발췌를 저장했다. [British Council 현재형](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/present-simple)의 do/does 부정 설명은 공식 검색 결과의 편집 부분을 확인한 발췌만 해시했다. 이 행의 status/rawPageSha256은 null이며 전체 페이지 수신으로 표시하지 않는다. 독자 댓글은 근거로 사용하지 않았다. 원문 전체를 보관하지 않았다.

공식 web open의 Cambridge403 6회·후속 British Council find 시간초과와 네이티브 British Council 시간초과를 보존했다. 공식 페이지 선택 본문 수신4건과 발췌만 확인1건의 증거 수준을 구분한다. 출처는 일반 규칙을 뒷받침하며 모든 문체·모든 문장·AI 판정의 참됨을 인증하지 않는다.

## 코드와 요청 경계

처음에는 기존 fresh-reference materializer를 그대로 사용해 공개 원문이 EX1_KNOWN_EXPOSURE로 거절됐다. 기존 차단을 완화하지 않고 reference-v4에 순수 함수 referencePublicControlRequestV4를 추가했다. public-development 증거와 일치하는 알려진 입력만 받아 purpose=public-control-diagnostic으로 요청한다. 노출 자료 생략·알려지지 않은 입력은 거절한다. 기존 새 문항 materializer는 같은 알려진 문장을 계속 거절한다. 새 요청은 기존 새 문항의 동결 요청 본문과 같지 않아 그 경로의 참조 자격을 통과시키는 우회가 아니다.

6통제×3모델×2순서=36개 본문을 실제 기존 request/schema/anonymous projection 코드로 구성했다. 요청은26928–37192바이트,source pack8KiB·본문131072바이트·출력4096·store/stream=false를 유지한다. 양쪽 항목이 같은 부분 노출 목록50/78개를 받는다. 실제 입력 토큰 수나 가격은 아직 측정하지 않았다. 비공개 기대 판정/근거 표/원래 문항 ID·역할은 요청에서 제외하며,출처 provenance 지문은 공개5필드만 사용한다. 이미 공개된 문장 내용으로 문항을 알아볼 수 있으므로 opaque ID/순서 교환이 완전한 가림이나 편향 제거를 증명하지 않는다.

현재 모듈은 요청 구성과 합성 응답 대조만 구현한다. 실제 제공자 전송·키 검색·API 원장·실제 역할 자격 판정을 새로 구현하거나 실행하지 않았다. 제안표와36개 합성 응답이 일치해도 actualRoleQualificationMeasured/actualReferenceControlsQualified/actualEnglishQualityMeasured는 false다. 실제 독립 비자기 AI 역할 점검·반대 근거 검토와 비용 승인이 필요하며 사람 검토자 섭외는 요구하지 않는다.

36회는 **새로 제안한 공개 검토 점검 요청 수**다. 기존 참조 준비180회/별도 예비1872회에 이미 포함되었다고 세지 않으며 승인 횟수는0이다. 실제 통합 순서·중복 여부·토큰·금액을 다시 산정해 승인 묶음을 만들어야 한다. 옛 평가 원장/잔액을 가져오거나 재개하지 않았다.

## 검증과 보존

새7검사는 전체42/30셀·출처 캡처·실제36본문·양쪽 순서·비공개 필드 제외·36/36 합성 일치 대조를 확인한다. 형식상 유효한 원래 라벨1개를 틀리게 바꾸면35/36으로 보류되고 중대 표지 누락도 보류된다. 누락/중복 분모·본문 변경·다른 항목 ID·노출 무시·준비 자료 변경을 거절한다. 공개/새 문항 경로 차이와,당시 모듈의 import/계약URL만 현재 경로로 연결한 보존본 대조에서 기존 author/review 본문 바이트 동일을 확인했다.

최초 알려진 문장 차단 실패와6/7 결과의 보존본 import 누락 실패를 원래 로그/코드로 남겼다. 후자는 관리 보존 목록이 전체 모듈 의존성 복사본이 아니라 발생한 검사 보조 오류다. 동결 사본에 파일을 덧붙이지 않고 import/계약URL만 현행의 불변 의존성으로 연결해 원래 함수 본문을 비교했다. 이후 두 Node에서7/7·exit0다. 참조14·노출14·전체 선택 로컬 목록9·단어/기준 감사6 회귀도 각각 통과했고,변경4파일 lint 오류/경고0·exit0다.

제품547입력은 바꾸지 않아 제품879/타입/린트/빌드와 기존 Worker/D1 근거를 재사용했다. 이번에 제품 전체·2052전체·Worker/강제 프로세스 전체 행렬을 다시 실행하지 않았다. 새 공개 요청은 기존 CLI/실제 제공자 전송 경로에 연결되지 않았다. 기존 G12/N04·12참조와 v1/옛 실제 점수/예산·426원문 목록은 그대로 보존한다. phase39의 미검토 상태를 새 v2 제안표 작성만으로 완료로 바꾸지 않는다.

현재 위험은 같은 작성자의 기대표를 그 작성자의 도구로 점검했다는 한계다. 실제 검토자 자격·G12/N04 문체/용례·표본/위험·전수 어휘/수업 근거·가족 독립성·토큰/가격·확인/일반화/학습 효과/운영·출시·1일/7일 검증은 남아 있다. 이번 변경은 로컬 도구이며 Site/DB/API/마이그레이션/관측 이벤트는 바꾸지 않았다. 복구할 경우 phase39에 묶인 기존 참조 모듈과 manifest 연결을 대상으로 검토하고,옛 점수·원장·데이터를 되돌리지 않는다. 실제AI/count/키값 읽기쓰기·신규 과금 승인/사용·운영 학습 QA·배포·Git·미병합 산출물 삭제0이다. 마지막 관리/대시보드/보존 결과는 phase40/execution-verification.json 및 progress-final.json을 따른다.
