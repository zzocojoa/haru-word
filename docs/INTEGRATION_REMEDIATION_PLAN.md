# 통합 검사 후속 수정 계획

새 방문자가 로그인할 수 없는 문제를 먼저 고치고, 저장 실패한 값을 저장된 정보로 알려주는 문제와 검사·문서의 불일치를 정리한다. 2026-11-04 사용자의 “수정 착수 승인”에 따라 별도 `codex/integration-remediation-20261104` 작업 폴더에서 구현을 시작했다.

- Task Master: `integration-remediation`
- planId: `integration-remediation-2026-11-04`
- 등록 규모: 상위12개·세부41개. 사용자 “진행” 승인 후 기존 Site v144 게시까지 **12/12·41/41 완료**했다. 현재 상태와 [배포 근거](releases/2026-11-04-integration-remediation-v144-rollout.json)를 대시보드에 연결했다.
- 요구사항과 기술 근거: [공식 RPG 형식 PRD](../.taskmaster/docs/integration-remediation-prd.md)
- 발견 근거: [통합 검사 보고서](../outputs/project-inspection-20261104/REPORT.md)
- 작업 화면: 기존 [로컬 대시보드](http://127.0.0.1:4318/)

| 순서 | 할 일 | 완료를 판단하는 방법 |
| --- | --- | --- |
| 1~2 | 원본 증거·기록을 보존하고 검사 환경 고정 | 같은 소스/lockfile·정확한 버전·격리 DB/프로필을 재현 |
| 3~4 | 로그인 진입 복구 | 익명 진입/새로고침에서 로그인 가능, 만료·계정 변경 시 이전 입력 차단 |
| 5 | 저장된 학습 요약 바로잡기 | 저장 실패/충돌에는 이전 서버 값, 성공 뒤에는 새 값. 화면 입력 유지 |
| 6~8 | 검사 계약·문법/그림 준비·비동기 종료 정비 | 원본 검사 조건을 보존하며 실제 오류를 검출. 명확한 준비 오류와 잔여 프로세스0 |
| 9 | 최종 통합 회귀 | 두 엔진·동일 최종 소스에서 학습/복원/AI모의/계정 경계 확인 |
| 10~11 | 운영 문서·출시 검토자료 | 실제 운영과 미배포 수정 구분, 변경/위험/호환/복구 증거 준비 |
| 12 | 별도 승인 후 기존 사이트 반영 | 승인 전 보류. 승인 후에만 기존 Site 게시·보존·관측 확인 |

Task Master의 각 상위/세부 작업에 선행 작업, 구체적인 완료 조건과 검사 방법을 적었다. 계획 등록을 구현 완료로 세지 않는다. 새 플랜의 비용/진행률은 과거 두 플랜과 합산하지 않는다.

기존 학습 기록·뜻별 성적·첫 답·임시 입력·문법 진도·백업·revision을 보존한다. API/백업 형식 변경과 DB 마이그레이션은 예정하지 않았다. AI 요청/프롬프트/모델을 바꾸거나 새 유료 평가를 실행하지 않는다. 검사 준비 문제 때문에 제품의 안전한 거절이나 개인정보 보호를 완화하지 않는다.

추가 유료 호출은 승인하지 않았고 실행0이다. 실제 iPhone·음성 청취·일반 영어 품질 등 기존 미확인 항목은 자동으로 확인 완료가 되지 않는다. [구현·배포 기록](INTEGRATION_REMEDIATION_IMPLEMENTATION.md)을 함께 확인한다.

이번 계획은 [Task Master 공식 RPG 양식](https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/assets/example_prd_rpg.txt)과 [공식 작업 구조](https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/docs/task-structure.md)에 따라 작성했다. 자세한 적용 방식과 사용한 MCP 명령은 PRD와 등록 검증 기록에 남긴다.

계획 등록 당시의 이력: Task Master 재조회에서12/41·다음 작업1을 확인했다. 기존4318·파일 사본·두 엔진의 새/과거 플랜 전환, 원본 갱신/오류 복구와 이력 보존 검사15개, 기존 회귀17개·18개·v143화면4개가 모두 exit0이다. 이전 회귀는 같은 소스의 격리 사본에서 실행해 과거 검사 산출물을 덮어쓰지 않았다. [검증 기록](../outputs/integration-remediation-plan/verification.json), [MCP 재조회](../outputs/integration-remediation-plan/taskmaster-recheck.json)를 참조한다. 당시에는 계획·대시보드 관리 범위여서 제품 단위/타입/빌드를 다시 실행하지 않았다. 이후 승인된 구현과 새 검증은 위 구현 기록에서 별도로 확인한다.
