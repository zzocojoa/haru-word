# 하루단어 작업 현황

현재 수정 플랜 `judgment-remediation`은 **상위18개·세부49개 완료**이며 기존 Site v143에 반영됐다. 이전 `master`의 15개·35개와 당시 판단 품질 보류 결과는 별도로 보존한다. 작업 완료율과 모델 품질 검증을 합산하지 않는다.

- 작업 원본: [tasks/tasks.json](tasks/tasks.json)
- 현재 계획: [판단 개선 계획](../docs/OPENAI_JUDGMENT_REMEDIATION_PLAN.md)
- 현재 검증·평가·배포: [v143 요약](../docs/releases/2026-11-04-openai-judgment-v143.json)
- 화면 원본: `dashboard/`, 데이터 변환·읽기 전용 서버: `scripts/`

저장소 루트에서 Node.js 22.13 이상으로 실행한다.

```sh
# 두 플랜을 포함한 단일 HTML 생성
node .taskmaster/scripts/build-openai-dashboard.mjs

# 루프백 읽기 전용 서버, 기본 포트 4318·5초 갱신
node .taskmaster/scripts/serve-openai-dashboard.mjs
```

생성 파일은 `outputs/openai-migration-dashboard/index.html`이다. 직접 열어 두 플랜을 전환할 수 있고, 서버 모드에서는 Task Master 원본의 최신 상태를 읽는다. 서버가 출력한 `http://127.0.0.1:<포트>`를 사용한다. 변경 API와 외부 네트워크 요청은 없다.

두 브라우저·잘못된 태그/JSON·검색·키보드·모바일/확대·오류 복구·단일 HTML 검사는 다음과 같이 실행한다. Playwright와 브라우저가 설치된 외부 QA 런타임을 `QA_PLAYWRIGHT_PATH`로 지정할 수 있고, `AXE_CORE_PATH`를 지정하면 접근성 자동 검사도 포함한다.

```sh
node .taskmaster/scripts/test-multi-plan-dashboard.mjs
```

계획과 실행 이력 문서의 `outputs/` 링크는 이 PC에 보존된 원시 근거를 가리킨다. 실제 백업·환경 파일·개인 학습 기록·원시 실행 로그는 Git에 올리지 않는다. GitHub 검토용 집계 결과와 근거 SHA-256은 v143 요약에 남겼다. 과거 유료 평가 실행기·동결 후보·원장은 로컬에 그대로 보존하며, 이 PR은 평가 재개나 새 유료 호출을 승인하지 않는다.
