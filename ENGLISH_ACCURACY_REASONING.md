# 무료 계정의 추론 수준 비교

사용자의 2026-10-02 진행 승인으로 기존 무료 계정·동일 모델에서 추론 설정만 비교한다. 무료/유료 요금제가 언어 오류의 원인이라는 가설을 입증하는 실험은 아니다.

- `reasoning-pilot-v1`: 고정5문장 × Google/Groq × current/high = 최대20회. 실패·시작 슬롯도 포함, 재시도·fallback·CI 실제 호출 없음. 기존806회와 과거 결과를 보존하며 누적 최대826회다.
- 기존 결함 예문 grammar-45/word-32/grammar-55, 정상 대조 grammar-46/grammar-48. 입력/모델/프롬프트/JSON 계약/출력4096토큰/운영 제한 시간(Google12초·Groq15초)은 동일하다. Google current는 기존처럼 thinkingConfig 생략, high는 HIGH. Groq low/high. 예문별 AB/BA 순서를 고정한다.
- 학습 요청 함수의 기본값을 바꾸지 않고 평가 fetch 어댑터에서만 설정한다. 성공 여부, 의미·문법·교정 의미 보존·성분 분석, 응답 시간, 제공자가 반환한 숫자 토큰 사용량을 구분한다. 높은 추론의 시간 초과·토큰 부족은 언어 오답과 별도로 표시한다.
- 공식 API 근거: [Google ThinkingConfig/ThinkingLevel](https://ai.google.dev/api/generate-content#ThinkingConfig), [Groq GPT-OSS reasoning](https://console.groq.com/docs/reasoning). 더 많은 추론이 이 앱의 영어 정확도를 개선하는지는 실제 결과를 확인해야 한다.

## 실행·종료

1. 전체 검사·검토·정확 HEAD Node22/24 CI 후 기존 Site에 평가 코드가 닫힌 상태로 게시한다. Site ID/DB/일반 환경/공개 범위를 보존한다.
2. Git 제외 `work/english-accuracy/reasoning-pilot-v1/authorization.json`에 고정20 승인, 소스/plan hash와 무료 계정 확인을 기록한다. 실행은 `node scripts/evaluate-reasoning-pilot.mjs`의 숨긴 stdin으로 토큰/사이트 인증을 전달한다. 키 값은 로컬로 가져오지 않는다.
3. 임시256bit 평가 토큰·profile·24시간 이내 만료만 설정한다. 실제 invalid-case400 확인 후 하나의 수집기만 실행한다. 전체 평가의 공용 wx 잠금과 최초 원장 wx, HTTP 전 원자적 started 저장을 사용한다. 중단한 원장은 재실행하지 않는다. HTTP400/권한/한도 오류는 해당 제공자를 중단한다. 프로토콜/네트워크 불명확 오류는 전체 중단한다.
4. 성공/실패 모두 expiry를 과거로 설정→같은 버전 게시→동일 토큰 실제404, 임시 세 키 삭제→같은 버전 게시→동일 토큰 실제404 순서로 닫는다. 수집 원장과 closure 시각/hash를 연결하고 일반 환경/정책/소스를 다시 확인한다.
5. 제공자·모델·추론 수준·시각을 가린 응답을 기준 문장과 수동 대조한 뒤 mapping을 풀어 보고한다. 작은5문장 결과로 전체54/60 게시 기준이나 기존17결함 해결을 선언하지 않는다. 운영 추론 설정은 유지한다.

## 위험·복구

임시 평가 경로의 추가 비용/한도 소비가 위험이다. 사용자 확인 무료 계정만 사용하며 키·요금제·결제 변경을 하지 않는다. 호출량의 상한은 수집기 원장으로 보장하고 토큰은 비공개 메모리만 사용한다. 늦거나 불완전한 응답도 상한을 소비한다. 임시 키를 제거하면 경로는404다. DB 마이그레이션·학습 기록·백업·첫 답·revision 변경은 없다. 관측에는 개인 문장/키/AI 원문을 추가하지 않는다. 평가 원문은 Git 제외 로컬 자료다. 실제 iPhone 청취/화면 QA와 전체 정확도 검증은 이번 범위가 아니다.

실제 결과는 수집·폐쇄·가림 판정 후 아래에 추가한다.
