# 영어 카드 연결 종료 — 2026-10-18

기존 Site의 v138 소스에서 카드 연결을 분리한 v139(`effc203cb09f9a6ed47b81f9bec19e00d21fba4c`)가 2026-10-18 22:48:09 KST 게시됐다. 이번 변경은 PR #46 병합 main(`9ba7c10`)에 해당 소스를 통합한다. 기존 홈 버튼 제거와 v137/v138 배포 이력을 보존한다. 학습 DB와 이미지 저장소, 학습 기록·revision·백업 형식, Google/Groq 공용 키는 그대로다. 이번 통합에서 EN_Card 자원 삭제·운영 배포·설정 변경을 실행하지 않는다.

## 후속 기록과 현재 기준

PR #47은 2026-10-18 23:41:39 KST 병합됐고, 같은 날 main과 v139 비교에서는 실행·빌드 입력이 같아 추가 배포가 불필요했다. 이는 당시 두 커밋의 판단이며 현재 운영은 **v140**이다. [병합·CI·비교 범위](../OPERATIONS.md#pr47-post-merge-history), [현재 복구 절차](../OPERATIONS.md#v140-rollout)를 따른다. **startup·기존 401 원인은 미확정**이다.

[원래 v139 종료 결과](releases/2026-10-18-en-card-retirement.json)는 자원 삭제 보고와 빈 폴더 잠금 잔여를 당시 기록으로 보존한다. 이번 문서 반영은 외부 자원 삭제 여부·잠금 해제를 다시 확인한 작업이 아니며, 아래 통합 검증 한계를 완료로 바꾸지 않는다. [증거 출처와 해석](HISTORICAL_RELEASE_EVIDENCE_2026-10-19.md)을 참조한다.

## 동작

- 학습 홈의 영어 카드 메뉴를 제거한다.
- 이전 `/cards` 북마크는 학습 홈 `/`로 이동한다.
- 기존 카드 프록시·계정·자동화·문장 시험 API는 `410 CARD_FEATURE_RETIRED`와 `Cache-Control: no-store`를 반환한다. 외부 서버·AI·학습 DB를 호출하지 않는다.
- `public/card-studio` 배포 파일과 카드 프록시·AI 릴레이 구현을 제거한다.
- v139 배포 작업에서 `card_studio_*` 환경 설정을 제거했고 현재 revision72/9개다. 이번 통합은 해당 설정의 타입 선언만 정리하며 운영 환경을 변경하지 않는다. Site ID·D1/R2 바인딩·공개 정책은 보존한다.
- 과거 DB 마이그레이션과 nonce 테이블 선언은 학습 DB의 이력 호환을 위해 유지한다. 이 작업은 하루단어 DB에 마이그레이션이나 삭제 쿼리를 실행하지 않는다.

## 검증과 주의점

최종 소스에서 `npm test`, `npm run typecheck`, `npm run check:grammar-review`, `npm run lint`, `npm run build`를 실행한다. `node tests/card-retirement-qa.cjs`는 Chromium/WebKit에서 로그인/익명 이전 주소의 홈 복귀·7개 API 메서드의 410·정적 파일 부재·학습 상태 불변을 확인한다. `node tests/state-roundtrip-qa.cjs`는 별도 로컬 가상 계정에서 편집·저장·내보내기·복원·revision 보호를, `node tests/image-practice-resume-qa.cjs`는 이미지 뒤집기·위치 저장/재개·충돌과 학습 기록 보존을 검사한다. `QA_BROWSER=webkit`으로 반복하며 `QA_BASE_URL`은 루프백 built Worker, Playwright/axe와 이미지 자산 경로는 `tests/README.md` 절차를 따른다. 운영 학습 기록을 QA로 수정하지 않는다.

v139 작업 기록에서는 첫 제거 빌드의 공통 JS 파일 간 React 초기화 순환으로 초기 화면이 멈췄고, 클라이언트 빌드의 `strictExecutionOrder`로 초기화 순서를 보존했다고 설명한다. 이번에는 그 수정까지 가져와 최종 built Worker의 초기 실행을 검사한다. 학습 자료의 동적 로딩 경계와 서버 빌드는 유지한다. 이는 과거 WebKit startup 시간 초과와 원인이 같다는 증거가 아니다. **startup·기존 401 응답 원인은 계속 미확정**이며 의도된 카드 API 410과 구분한다.

EN_Card 삭제 후 이전 카카오 메시지의 이미지·원본 링크는 사용할 수 없다. 과거 카드 버전으로 사이트를 복원하거나 카드 환경 설정을 재등록하지 않는다. 학습 기능 복구가 필요하면 이 카드 종료 처리를 포함한 소스로 게시한다. 클라우드·GitHub·로컬 삭제의 실제 완료 여부는 별도 종료 결과 기록으로 확인한다.
