# 광역 감사 수정 GitHub 검토 후보 · 2026-11-05

사용자 `커밋 푸시 PR 진행`에 따라 기존 SOURCE `work/comprehensive-defect-audit-20261105`, 브랜치 `codex/comprehensive-defect-audit-20261105`에서 GitHub `main@5609a8e6fa7d148ff4cf6582ae20fe0ed2669171`을 기준으로 커밋·푸시·PR을 진행한다. 새 브랜치나 Site는 만들지 않는다. 이전 계획·출시 문서의 GitHub 미승인/미실행 표시는 당시 기록이며 이번 명시 승인으로 대체된다. 이전 평가 원장과 유료 호출 승인은 재개하지 않는다.

원래 감사22결함·7의존성 정비의29항목, Task Master `comprehensive-remediation`의33상위/81세부 및 기존 세 플랜 이력을 포함한다. [수정 계획](COMPREHENSIVE_REMEDIATION_PLAN_20261105.md), [구현·전체 검증](COMPREHENSIVE_REMEDIATION_RELEASE_READINESS_20261105.md), [운영 v146 게시 영수증](COMPREHENSIVE_REMEDIATION_V146_ROLLOUT_20261105.md)은 각각 당시 상태로 보존한다.

## v146 이후 추가 보완

운영은 Sites 소스 `cd475d7a9b8bb8a4840ce54f18a3d6701b4b3dc4`의 **v146**이다. 이번 PR 후보와 운영이 동일하다고 주장하지 않는다. 추가 제품 변경은 다음3파일이며 추가 게시를 실행하지 않았다.

| 파일 | 문제와 변경 결과 |
| --- | --- |
| `lib/grammar/model.ts` | 완료 수업 문장을 수정한 뒤 설명·예문을 재방문하면 저장 스키마가 과거 완료일 때문에 자기 점검을 요구했다. 현재 문장의 완료(stage6)에 새 점검을 요구하고, 이전 단계 이동에서는 과거 완료·첫 답·review·schedule을 보존한다. |
| `lib/grammar/compatibility.ts` | 수정 중 완료 수업의 stage0–5 모두 reader5로 보호하여 구형 읽기·덮어쓰기·복원에서426을 유지한다. 콘텐츠 버전1–4와 reader capability5를 구분한다. |
| `db/ai-compatibility.ts` | 저장된 단어/문법 judgment-v6가 계약1–3의 DB 보호 쿼리에서 빠져 있었다. 최신 revision을 가진 구형 저장·전체/분할 복원도426으로 거절한다. revision 충돌 보호는 별도로 유지하며 계약4는 허용한다. |

관련 단위 검사2파일과 built 브라우저 검사1파일을 보강했다. 게시 후 대시보드 검사의 출력 위치도 게시 전 증거를 덮어쓰지 않도록 분리했다. 기존 게시 전251개 근거·감사5파일/원시2089개·ROOT 제품637파일·이전 세 플랜·평가/예산이 보존됐음을 별도 대조했다.

## 검증

- 수정 전 집중 회귀80개 중11개 실패(exit1). 최종 수정 후80/80(exit0). 최초 새 검사의 양성 대조는 기존 PUT 병합 및 백업의 누락 문법 보존 규칙에 맞게 보정했다.
- 격리 Node22.23.4/24.22.1 `npm test`: 각각848/848, 실패/skip/TODO0, exit0.
- `npm run typecheck`, `lint`, `check:grammar-review`, `build`: 모두 exit0. lint 오류0·기존 경고15개.
- 최종 built Worker의 합성 D1 계정에서 Chromium/WebKit 각각 문장 수정 → 설명 → 예문 → 목록 → 새로고침 통과, PUT 각3회 모두200, 완료일·review·schedule 유지, 소유 Worker 종료 확인. 최초 Playwright 경로 누락은 실행 환경 실패로 보존하고 설치된 경로를 지정해 재실행했다.
- `/review`의 핵심 체크리스트와 독립 에이전트 재검토에서 기존 P2 두 건 수정 확인, 추가 확정 결함0. 별도 Claude Code는 설치되지 않아 외부 모델 검토는 미실시다.
- 당시 v146 전체 기능 Chromium/WebKit 각87/87·성능5개·느린망1825회차·대시보드 검사는 기존 근거로만 보존한다. 이번 추가 수정 후보에서 전체 브라우저 모음을 재실행한 것으로 표현하지 않는다.

명령·해시 근거는 [검증 JSON](releases/2026-11-05-comprehensive-remediation-github.json), 로컬 원본은 ROOT `outputs/comprehensive-remediation-github-20261105/`다. GitHub Actions 결과는 실제 PR 검사에서 별도로 확인한다.

## 호환성·운영 영향과 복구

API/백업 envelope·revision·원자성·콘텐츠1–4·reader5·AI 계약4를 유지한다. 새 SQL0, 기존 마이그레이션7개·Site/DB/R2·환경·공개 정책은 변경하지 않는다. 민감 입력이나 진단 이벤트를 추가하지 않았고 실제 AI 호출·운영 학습 행 조회/QA 쓰기는0이다. 공개 GitHub 저장소에 로컬 환경·비밀 값·개인 학습 데이터를 커밋하지 않는다.

실제 iPhone/VoiceOver·운영 인증 학습·유료 AI 품질·DATA-1 추가 OOM/운영128MB·Node22 native 실패의 정확한 원인은 미검증이다. 구형 클라이언트의426은 의도된 데이터 보호 동작이다. 새 문법 상태를 저장한 뒤 복구할 때는 reader5와 수정 중 완료 상태를 이해하는 소스를 유지해야 하며, 예전 버전을 그대로 재게시하거나 학습 기록을 삭제하지 않는다. 이번 GitHub 작업의 취소는 PR을 닫거나 커밋을 revert하는 절차이며 운영 v146은 추가 게시 전까지 유지된다.
