<!-- comprehensive-implementation-current -->
# 광역 감사 수정 기존 Site 게시 완료 · 2026-11-05

사용자 개선 착수 승인으로 `comprehensive-remediation` 상위33/33 완료, 세부81/81 완료다. 품질·출시 준비·게시를 따로 판정한다. 기존 Site 게시·Sites 소스 저장/push가 승인됐으며 실제 AI 평가·GitHub commit/push/PR은 별도 승인이다. [구현 기록](../docs/COMPREHENSIVE_REMEDIATION_IMPLEMENTATION_20261105.md)·[출시 준비](../docs/COMPREHENSIVE_REMEDIATION_RELEASE_READINESS_20261105.md)와 기존4318의 Task Master 실제 상태를 확인한다. 아래 계획의 모두 대기/미승인 표현은 등록 당시 기록이다.
<!-- /comprehensive-implementation-current -->

<!-- comprehensive-remediation-plan-current -->
# 2026-11-05 · 광역 결함 감사 후속 수정 계획

현재 기본 선택은 `comprehensive-remediation` / `comprehensive-remediation-2026-11-05`다. **상위33·세부81 모두 대기, 감사29항목 매핑 완료, 제품 구현 미착수**다. 아래 이전 플랜 기록의 현재/새 플랜 표현은 그 당시 이력으로 보존한다.

- [한국어 계획서](../docs/COMPREHENSIVE_REMEDIATION_PLAN_20261105.md), [RPG PRD](docs/comprehensive-remediation-prd.md)
- [manifest](docs/comprehensive-remediation-manifest.json), [29항목 매핑](docs/comprehensive-remediation-mapping.json), [수동 복잡도](docs/comprehensive-remediation-complexity.json), [계획 검증](docs/comprehensive-remediation-validation.json)
- 원본 SOURCE: `work/comprehensive-defect-audit-20261105`; 기존4318은 ROOT의 자료를 읽는다. 신규 tag/계획 자료만 두 곳에 동기화하며 기존3태그와 예산·게시·실패 이력은 보존한다.
- `node .taskmaster/scripts/verify-comprehensive-remediation-plan.mjs`로 계획/매핑/보존을, `node .taskmaster/scripts/test-comprehensive-remediation-dashboard.mjs`로 네 플랜과 새로고침을 검증한다. 브라우저 경로는 기존 `QA_PLAYWRIGHT_PATH` 설정을 사용한다.
- `node .taskmaster/scripts/build-openai-dashboard.mjs`; 기존 http://127.0.0.1:4318/ 에서 전체 페이지 새로고침 후 새 플랜을 선택한다. 열린 페이지 catalog 갱신 결함 DASH-1~3은 이번에 수정하지 않았다.
- 구현·실제 AI 평가·게시·commit/push/PR은 이번 범위 밖이다. 옛 닫힌 원장과 잔액을 재개하지 않는다.
<!-- /comprehensive-remediation-plan-current -->

# 하루단어 작업 현황

현재 플랜은 `integration-remediation` **상위12/12·세부41/41 완료**다. 사용자 “진행” 승인으로 게시12까지 완료했고 기존 Site는 **v144·소스d41d4e7·환경77**이다. 로컬 구현11/11·품질 게이트·운영 게시 결과를 각각 기록하며 유료 호출·운영 학습 QA 쓰기는0이다. 이전 `judgment-remediation` **18개·49개 완료/v143 게시**와 `master` **15개·35개 완료/당시 품질 보류**는 별도로 보존한다. 플랜별 진행률·검증·평가 비용을 합산하지 않는다.

- 작업 원본: [tasks/tasks.json](tasks/tasks.json)
- 현재 계획: [통합 검사 후속 수정](../docs/INTEGRATION_REMEDIATION_PLAN.md), [공식 RPG 형식 PRD](docs/integration-remediation-prd.md)
- 현재 플랜 manifest: [integration-remediation](docs/integration-remediation-manifest.json)
- 현재 게시 근거: [v144 배포 기록](../docs/releases/2026-11-04-integration-remediation-v144-rollout.json)
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

# 현재 승인·게시 완료 상태·실제4318·과거 두 플랜·원본/비용 보존 검사
node .taskmaster/scripts/verify-integration-remediation.mjs --published
# 게시 전 동결 fixture에서 작업1~11 완료·게시 보류를 검사할 때만 --final

# 계획 등록 당시0% 전용 검사는 당시 fixture/근거에서만 실행
# test-integration-remediation-plan.mjs (현재 상태를 초기화하지 않음)
```

현재 플랜 조회는 Task Master MCP의 `get_tasks`/`next_task`에 `tag: "integration-remediation"`과 이 기본 폴더의 절대 `projectRoot`를 명시한다. 새 플랜 작성은 `add_task`/`add_subtask`의 수동 필드를 사용했으며 `parse-prd`의 별도 모델 호출은 실행하지 않았다.

계획과 실행 이력 문서의 `outputs/` 링크는 이 PC에 보존된 원시 근거를 가리킨다. 실제 백업·환경 파일·개인 학습 기록·원시 실행 로그는 Git에 올리지 않는다. GitHub 검토용 집계 결과와 근거 SHA-256은 v143 요약에 남겼다. 과거 유료 평가 실행기·동결 후보·원장은 로컬에 그대로 보존하며, 새 플랜은 평가 재개나 새 유료 호출을 승인하지 않는다.
