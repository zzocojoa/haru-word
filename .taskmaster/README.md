# 하루단어 작업 현황

현재 플랜은 `integration-remediation` **상위12개·세부41개**다. 사용자 “수정 착수 승인”으로 작업1~11의 별도 폴더 로컬 구현·검증을 완료했다. 구현11/11과 전체 계획11/12(세부38/41)를 구분한다. 최신 상태/검증은 원본과 대시보드를 따르며 게시12·유료 호출·운영 학습 QA 쓰기는 별도 승인 전 보류다. 이전 `judgment-remediation` **18개·49개 완료/v143 게시**와 `master` **15개·35개 완료/당시 품질 보류**는 별도로 보존한다. 플랜별 진행률·검증·평가 비용을 합산하지 않는다.

- 작업 원본: [tasks/tasks.json](tasks/tasks.json)
- 현재 계획: [통합 검사 후속 수정](../docs/INTEGRATION_REMEDIATION_PLAN.md), [공식 RPG 형식 PRD](docs/integration-remediation-prd.md)
- 현재 플랜 manifest: [integration-remediation](docs/integration-remediation-manifest.json)
- 이전 검증·평가·배포: [v143 요약](../docs/releases/2026-11-04-openai-judgment-v143.json)
- 화면 원본: `dashboard/`, 데이터 변환·읽기 전용 서버: `scripts/`

저장소 루트에서 Node.js 22.13 이상으로 실행한다.

```sh
# 모든 등록 플랜을 포함한 단일 HTML 생성
node .taskmaster/scripts/build-openai-dashboard.mjs

# 루프백 읽기 전용 서버, 기본 포트 4318·5초 갱신
node .taskmaster/scripts/serve-openai-dashboard.mjs
```

생성 파일은 `outputs/openai-migration-dashboard/index.html`이다. 직접 열어 세 플랜을 전환할 수 있고, 서버 모드에서는 Task Master 원본의 최신 상태를 읽는다. 서버가 출력한 `http://127.0.0.1:<포트>`를 사용한다. 변경 API와 외부 네트워크 요청은 없다.

두 브라우저·잘못된 태그/JSON·검색·키보드·모바일/확대·오류 복구·단일 HTML 검사는 다음과 같이 실행한다. Playwright와 브라우저가 설치된 외부 QA 런타임을 `QA_PLAYWRIGHT_PATH`로 지정할 수 있고, `AXE_CORE_PATH`를 지정하면 접근성 자동 검사도 포함한다.

```sh
node .taskmaster/scripts/test-multi-plan-dashboard.mjs

# 구현 진행/완료 상태·실제4318·기존 두 플랜·원본/비용 보존 검사
node .taskmaster/scripts/verify-integration-remediation.mjs
# 작업1~11 및 선행gate 완료를 추가로 요구할 때는 --final

# 계획 등록 당시0% 전용 검사는 당시 fixture/근거에서만 실행
# test-integration-remediation-plan.mjs (현재 상태를 초기화하지 않음)
```

현재 플랜 조회는 Task Master MCP의 `get_tasks`/`next_task`에 `tag: "integration-remediation"`과 이 기본 폴더의 절대 `projectRoot`를 명시한다. 새 플랜 작성은 `add_task`/`add_subtask`의 수동 필드를 사용했으며 `parse-prd`의 별도 모델 호출은 실행하지 않았다.

계획과 실행 이력 문서의 `outputs/` 링크는 이 PC에 보존된 원시 근거를 가리킨다. 실제 백업·환경 파일·개인 학습 기록·원시 실행 로그는 Git에 올리지 않는다. GitHub 검토용 집계 결과와 근거 SHA-256은 v143 요약에 남겼다. 과거 유료 평가 실행기·동결 후보·원장은 로컬에 그대로 보존하며, 새 플랜은 평가 재개나 새 유료 호출을 승인하지 않는다.
