# T23.1–3 예비 후보의 문법 교정과 학습 기록 보존

이전 예비 후보의 보관 빌드를 풀어 둔 사본으로 가상 계정과 격리 D1을 실행했다. 명사 수업에서 `Two luggage block the aisle.`을 제출하고, 합성 제공자의 `Two pieces of luggage block the aisle.` 응답을 실제 앱 API로 받았다. [후보 고정 기록](AI_QUALITY_V147_EXPLANATION_PILOT_REBIND_20261109.md)

| 확인 항목 | Chromium·WebKit 결과 |
| --- | --- |
| 수량 설명, 요청 영수증, 저장 후 다시 열기 | 2/2 통과. 문법 API와 영수증에서 같은 피드백을 확인 |
| 교정 적용·되돌리기·수업 다시 완료 | 새 수량 교정 및 기존 교정 대조 흐름 4/4 통과 |
| 첫 답안과 힌트 사용, 복습 성적·일정, 처음 완료일 | 네 흐름에서 기존 값 유지. 독립 복습 통과 횟수 2 보존 |
| 이전 클라이언트 보호 | 네 흐름에서 이전 문법 클라이언트 요청에 426 확인 |

Node 24.22.1 단위 검사 899개와 `check:grammar-review`가 종료 코드 0으로 완료됐다. 후보의 제품 입력·런타임 파일·예산 원장 지문은 검사 전후 같았다. 린트에는 기존 경고 15개가 남아 있다. 별도 격리 실행 없이 새 브라우저 모드를 직접 실행하면 시작 전에 차단된다.

실제 모델 호출과 운영 쓰기는 0회다. 두 문법 요청은 로컬 합성 제공자가 응답했다. 정식 예비평가와 실제 학습 효과는 미측정이다.

루트에서 `node outputs/ai-quality-v147-implementation-20261106/phase149/verify-grammar-correction.mjs`로 재현한다. 해당 결과 파일이 이미 존재하면 새 증거 디렉터리를 사용해 기존 기록을 보존한다. [브라우저 검증 기록](../outputs/ai-quality-v147-implementation-20261106/phase149/grammar-protection.json)
