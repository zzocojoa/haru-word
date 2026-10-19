# 과거 출시 증거와 PR #47 후속 기록 보존

2026-10-19 · 기준 main `1a3ad9b57b41b6093b583de4061653d135eac4fa`. 최신 운영은 **v140**이며 **startup·기존 401 응답 원인은 미확정**이다. 현재 배포·복구 기준은 [v140 운영 절차](../OPERATIONS.md#v140-rollout)를 따른다. 이 작업은 과거 문서를 선별해 Git에 보존하며 앱·설정·DB·배포를 바꾸지 않는다.

## 보존 범위와 읽는 법

기본 폴더의 미커밋 JSON 10개와 `codex/card-automation-topic-alignment@429d966`의 JSON 1개를 원본 바이트 그대로 보존했다. [출처·SHA256 목록](releases/2026-10-19-historical-evidence-index.json)은 11개 기록과 PR #47 후속 객체의 출처를 구분한다. 오래된 README·제품 상태 파일·앱 코드를 통째로 가져오지 않았다.

아래 JSON의 `current`, `nextStep`, `rollback`, 승인 대기·재개 지시 등은 **작성 당시 이력**이다. 현재 수행할 작업이나 새 승인으로 해석하지 않는다. 과거 카드 기능·예약을 재개하거나 환경·자원을 복원하지 않는다. 실패·부분 성공·미검증을 새 성공으로 바꾸지 않았다.

| 기록 | 보존할 의미 |
| --- | --- |
| [주제 적합성 로컬 후보](releases/2026-10-08-automation-topic-alignment.json) | 운영 반영 전 후보·검증 범위 |
| [문장 실제 시험](releases/2026-10-08-topic-sentence-validation.json) | 최종 0/20·실패 및 정리 |
| [문장 개선 후보](releases/2026-10-08-topic-sentence-improvement.json) | 로컬 개선·실제 효과 미검증 |
| [문장 재검증](releases/2026-10-08-topic-sentence-revalidation.json) | 자동 12/20·남은 결함 |
| [문장 후속 보완](releases/2026-10-08-topic-sentence-followup.json) | 로컬 검증·미배포 |
| [v126 주제 카드 출시](releases/2026-10-08-topic-card-rollout.json) | 게시·시험 실패·정규 중지 |
| [trial45 종료](releases/2026-10-08-topic-card-trial.json) | 4장 제작·발송 0·상세 원인 미확정 |
| [Groq 오류 분류 후보](releases/2026-10-08-groq-provider-error-fix.json) | 로컬 검증·당시 미배포 |
| [v127 게시·정규 재개](releases/2026-10-09-groq-provider-error-rollout.json) | 당시 게시와 재개, 다음 실패 기록과 구분 |
| [daily47 미수신 조사](releases/2026-10-09-automation-daily-no-receipt.json) | 발송 0·version48 중지·상세 원인 미확정 |
| [v139 카드 종료](releases/2026-10-18-en-card-retirement.json) | 당시 자원 삭제 보고·빈 폴더 잠금 잔여 |

## PR #47 병합 이후 판단

보존한 [후속 기록](releases/2026-10-18-en-card-retirement-integration.json)의 `postMergeAssessment`는 2026-10-18 23:47:26 KST의 `main@85d95ae`와 v139 소스 `effc203` 비교다. 실행·빌드 입력이 같고 차이가 문서 13개와 QA 1개여서 당시 추가 배포가 불필요했다. main CI Node22/24 각636개·13단계 성공은 그 커밋의 이력이다. [운영 문서의 범위와 한계](../OPERATIONS.md#pr47-post-merge-history)를 함께 읽는다. 이후 v140 게시를 취소하거나 현재 main 전체가 v139와 같다는 의미가 아니다.

## 증거 한계와 확인 절차

- 이 저장소에 추가한 11개 JSON과 출처·SHA 목록은 clone 후에도 읽을 수 있다. 원래 `work/`·`backups/` 절대/상대 경로, 삭제된 EN_Card 저장소·외부 자원 링크는 당시 출처 표시이며 첨부된 원시 증거가 아니다.
- v139 종료 JSON의 자원 삭제 완료·빈 폴더 잠금 잔여는 당시 보고다. 이번에 외부 자원 삭제나 잠금 해제를 다시 확인하거나 실행하지 않았다. 기존 통합 문서의 외부 자원 미검증 한계도 유지한다.
- 실제 AI·발송·수신·CPU·실기기·운영 데이터·과거 제공자 오류 원인을 재검증하지 않았다. 과거 startup·401과 Groq 요청 실패를 같은 원인으로 연결하지 않는다.

문서 검증은 다음 순서로 수행한다. 원본을 변경하지 않은 채 JSON 구문과 11개 원본/보존본 SHA를 대조하고, PR #47 후속 객체·당시 두 Git 트리 차이를 확인한다. 추가한 상대 링크와 민감 값 포함 여부를 검토한 뒤, v140 출시 JSON·현재 production/latestVerification 값 및 실행 파일이 기준 main과 동일한지 검사한다. 마지막으로 기존 181개 미커밋 항목과 기존 브랜치 참조를 대조한다. 앱 동작 회귀는 문서 검사와 구분하며 이번 PR의 CI 결과는 PR 본문에서 확인한다.
