# 평가 실험과 공통 진단 계약의 분리

기준은 GitHub `main@c0a8556`과 보존한 운영 소스 `codex/ai-card-automation@c65b66d`다. 이전에 보류한 95개 평가 관련 경로와 안전 검증 2개를 [경로별 결정](releases/2026-10-04-runtime-decisions.json)에 분류했다. 후보 코드 전체의 품질 검토·정확도 승인·운영 활성화를 뜻하지 않는다.

## 이번에 유지하는 공통 코드

`lib/feedback-validation-detail.ts`의 진단 필드·판정 사유와 `lib/provider-feedback-contract.ts`의 `evidence_contract` 코드만 옮긴다. 이 계약은 평가 결과의 제한된 진단 메타데이터를 읽는다. **학습 DB·백업·브라우저 진단 다운로드 스키마와는 별개**다. 학습 API의 오류 응답은 계속 `feedbackErrorBody`의 코드·제한된 HTTP 정보만 내보낸다.

- 고정 필드 이름·사유·숫자만 허용한다. 문장, 제공자 본문, 오류 메시지, 임의 키는 받지 않는다.
- `evidence_judgment`와 `evidence_structure`의 단계·진단 코드 조합을 검증하고, 부분 인덱스는 0~19 정수만 허용한다.
- 구조화된 Zod 경로만 고정 필드로 정규화한다. 점/괄호를 포함한 임의 키나 잘못된 배열 인덱스는 `other`로 처리하며, 최대 8개 사유만 남긴다.
- 제공자 입력 타입의 `string[]` 확대, 후보 프롬프트·생성기·추론 설정, 평가 프로필·Secret·활성화 flag는 추가하지 않는다.

`tests/fixtures/feedback-diagnostic-compat.json`은 보존 자료 6개 파일의 진단 객체 77개를 25개 형식으로 줄인 회귀 자료다. 원본 커밋·파일 SHA256·등장 횟수를 포함하며 개인 문장/제공자 원문은 없다. 등장 횟수는 저장된 객체 수이지 새 API 호출 수가 아니다. 과거 점수와 호출 원장은 다시 쓰지 않는다.

## 보존할 실험의 경계

| 이전 95개 경로의 분류 | 수 | 결정 |
| --- | ---: | --- |
| 공통 진단 계약 | 2 | 이번 변경에 제한적으로 반영 |
| 비활성 후보 연결·전송 타입 | 7 | 원래 소스에 보존, main의 학습 호출 경로 유지 |
| Secret·만료로 보호된 평가 API 확장 | 1 | 원래 소스에 보존, 새 프로필을 main에 추가하지 않음 |
| 후보·평가 라이브러리 | 16 | 원래 소스에 보존 |
| 평가 실행·수집 도구 | 9 | 원래 소스에 보존, 실행하지 않음 |
| 평가 자료·계획 | 19 | 원래 소스에 원본 해시와 함께 보존 |
| 실험 회귀 검사 | 27 | 원래 소스에 보존 |
| 실험 문서 | 14 | 원래 소스에 보존 |

나머지 93개를 삭제하거나 묶어서 main에 병합하지 않는다. 특히 `feedback_coherent_enabled`는 운영 소스의 단어·문법 경로에서 후보를 선택하고, 그 후보는 여러 evidence 모듈을 연쇄 참조한다. 일부 후보 파일만 복사하거나 flag 하나만 이식하는 방식은 사용하지 않는다. main의 Google 우선/Groq 대체·기존 활성화 경로는 그대로다.

운영 소스의 `ENGLISH_ACCURACY_COHERENT_STOP.md`에는 추가 평가 종료·임시 평가 Secret 삭제·후보 비활성 기록이 있다. 이는 과거 기록이며 현재 설정의 실시간 증거로 사용하지 않는다. 학습 기능과 후보를 분리한 다음 출시에서도 새로운 평가 승인이나 과거 미호출 슬롯의 재사용을 추론하지 않는다.

## 안전 검증의 독립 실행

`AI_FEEDBACK_SAFETY.md`와 `tests/feedback-safety-qa.cjs`를 반영하고 QA 목록에 등록한다. 보호 구현은 이미 main에 있다. 브라우저 검사는 대용량 평가 파일 대신 기존 `tests/fixtures/feedback-safety-replay.json`의 최소 재현 응답을 쓴다. 과거 응답을 보류해도 원문·첫 답·기록을 보존하고, 명시적 재점검이 422로 실패한 뒤 자동 재호출하지 않는지 확인한다.

로컬 검증 예시(Playwright와 axe가 준비된 환경):

```powershell
npm test
npm run typecheck
npm run lint
npm run build
$env:QA_BASE_URL='http://127.0.0.1:8789'
$env:QA_PLAYWRIGHT_PATH='C:/Users/user/Documents/GitHub/EN_Card/node_modules/playwright'
$env:QA_BROWSER='chromium' # webkit도 별도 실행
node tests/feedback-safety-qa.cjs
```

브라우저 실행 전에 [로컬 D1 준비](../README.md#local-d1-migrations)에 따라 별도 테스트 저장소에 마이그레이션을 적용하고 같은 저장소를 사용하는 빌드 Worker를 루프백에서 실행한다. 실제 키를 사용하지 않는다. QA는 무작위 가상 계정과 동결 응답을 사용하고 외부 브라우저 요청을 차단한다.

## 다음 배포의 확인 조건

- [ ] 최신 Site 소스·환경의 비밀값을 노출하지 않는 조회로 기존 설정이 바뀌지 않았는지 확인한다.
- [ ] 평가 Secret/만료 상태와 coherent 후보 비활성을 확인한다. 활성 상태가 발견되면 main 재게시를 멈추고 해당 사용 경로를 별도 검토한다.
- [ ] 기존에 닫힌 실험 프로필을 새 main에 포함하지 않는 배포 범위, 사용자 데이터 호환성과 현재 Site/Worker의 복구 버전을 확정한다.
- [ ] 승인된 게시 후 카드·학습·저장 경로를 별도로 검증하고 배포 ID를 출시 기록에 남긴다.

이번 분리만으로 운영 소스 전체와 main이 같다고 표시하지 않는다. 호스팅 ID·D1·마이그레이션·예약·Secret·AI 호출·카카오 발송 변경은 없으며 운영 재게시도 하지 않는다. 문제가 생기면 이 PR의 공통 파서/검증 변경만 되돌리고, 학습 데이터나 과거 실험 자료를 수정하지 않는다.
