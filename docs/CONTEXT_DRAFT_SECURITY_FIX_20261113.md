# 구버전 문맥 초안과 React 보안 수정

작업 브랜치는 `codex/fix-context-drafts-security`이며, PR60 병합 커밋 `d0cc1264571112f1e748fe0c7f7ed2bf376341b4`에서 시작했다. 이번 변경은 로컬 수정이며 운영 게시·운영 기록 변경·유료 AI 호출은 없다. Task Master `ai-quality-v147`의 T39.2(새 문제 분류·합성 재현·원인 환류)에 연결한다.

## 원인과 변경

- 구버전 단어 문맥과 새 한국어 의도가 같은 `ai-context-v4` 초안 키를 사용했다. 합성 상황 메모가 새 한국어 의도로 자동 복원되는 것을 수정 전 검사에서 재현했다.
- 단어 한국어 의도는 `ai-word-intent-v1`로 분리한다. `ai-context-v4`와 그 이전 `ai-context`의 단어 메모는 원문을 보존하고, **문장의 형식 · 선택 → 이전 버전의 문맥 확인 → 한국어 의도로 확인해 가져오기**로 명시적으로 가져온다. 이후 필요한 내용을 수정하고 AI 요청 버튼을 눌러야 전송된다.
- 현재 입력이 있거나 문장 형식을 선택한 상태에서는 가져오기로 덮어쓰지 않는다. 이전 문장 형식도 자동 적용하지 않는다. 새 의도 초안의 재조회와 명시적 빈 입력은 기존 계정·탭·epoch 보호를 사용한다. 문법의 `ai-context-v4` 상황 메모는 기존 역할대로 복원한다.
- Dependabot #45(`package.json`)와 #46(`package-lock.json`)은 같은 **GHSA-xqc2-xf4c-x3h3 / CVE-2026-126187**을 가리킨다. React Server Components의 원격 코드 실행 취약점이다. `react-server-dom-webpack`을 `19.2.9`로 올리고, 필요한 peer인 `react`·`react-dom`도 같은 패치 버전에 맞췄다. lockfile의 다른 패키지는 바꾸지 않았다. [React 공식 보안 권고](https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3), [19.2.9 릴리스](https://github.com/react/react/releases/tag/v19.2.9).

## 검증

원시 근거는 관리 원본 `outputs/ai-quality-v147-implementation-20261106/phase227/`에 보관한다.

| 검사 | 결과 |
| --- | --- |
| 수정 전 합성 재현 | 이전 상황 메모의 자동 복원으로 실패, AI 요청 0회 |
| `npm audit --json` | 수정 전 critical 1개, 수정 후 모든 심각도 0개, 종료 코드 0 |
| lockfile 그래프 대조 | React 관련 세 패키지 모두 19.2.9 |
| `npm test` / Node 22.22.2 | 924/924, 종료 코드 0 |
| 동일 단위 검사 / Node 24.22.1 | 924/924, 종료 코드 0 |
| `node tests/local-draft-qa.cjs` | Chromium·WebKit 각 22/22, 종료 코드 0 |
| `npm run check:grammar-review` | 통과, 종료 코드 0 |
| `npm run typecheck` | 통과, 종료 코드 0 |
| `npm run lint` | 오류 0, 기존 경고 15, 종료 코드 0 |
| `npm run build` | 통과, 종료 코드 0. 기존 sourcemap·청크 크기·동적 import 경고 유지 |
| 대시보드 재생성·데이터 회귀·실제 4318 조회 | 2/2, 종료 코드 0, HTTP 200에서 phase227 확인. 5개 플랜·40/133 작업·103개 세부 완료와 예산 유지 |

브라우저 검사는 합성 계정·답안과 루프백 가상 서버만 사용한다. 실제 AI 응답·운영 Worker·실제 iPhone 검사가 아니다. 1% 위험 상한·학습효과·T39의 기간 점검은 이번 수정으로 완료되지 않는다.

### 2026-11-18 PR 준비 시 재확인

구현·의존성·회귀 검사 소스는 11월13일 검증 후 변경되지 않았다. `main`도 같은 PR60 병합 커밋이다. 위 검증은 당시 결과로 보존하며, 새 PR의 CI 결과와 구분한다.

현재 `npm audit --json`은 종료 코드 1이며 **critical 0·high 19·moderate 1개 패키지**를 보고한다. 고유 권고는 `picomatch`의 GHSA-fc5q-39xc-vjpf(high)와 Next.js의 GHSA-mfr8-8qww-v76h·GHSA-vc7v-qv4w-wrv8(moderate)이다. high 19개는 같은 picomatch 문제의 상위 의존성 경고를 포함한다. 이 패키지들의 잠금 버전은 이번 변경에서 바뀌지 않았으며, React critical 수정과 별개로 미해결이다. 이번 PR에서 모두 해결됐다고 표현하거나 운영에 무해하다고 판단하지 않는다. 현재 감사 원본은 `outputs/ai-quality-v147-implementation-20261106/phase228/audit.json`에 보관한다.

## 운영 영향과 복구

위험도는 중간이다. 의존성 패치와 단어 초안의 의미 구분을 바꾸며, API·DB·백업 형식·revision·학습 성적·사이트 식별자에는 변경이 없다. SQL 마이그레이션이나 새 관측 항목은 없다. 기존 v148에서 쓴 한국어 초안도 구버전 메모와 같은 키에 있으므로, 처음에는 직접 확인해 가져와야 한다.

운영 반영 전까지 GitHub 경고와 게시된 사이트의 의존성은 그대로다. GitHub 기본 브랜치 반영 후 경고 재검사를 확인하고, 운영 게시가 승인되면 기존 Site의 호환성·복구 절차를 따른다. 장애 시 React 보안 패치 세 패키지를 유지하면서 UI/초안 변경만 수정한다. `19.2.8`로 되돌리거나 기기 저장소를 삭제해 복구하지 않는다. 구버전으로 되돌린 화면은 새 의도 키를 읽지 못하므로 해당 초안은 보존하고 수정된 화면에서 다시 연다.

| 경로 또는 정리 범위 | 분류 | 보관·삭제·보류 | 근거 또는 재생성 방법 | 검증 결과 |
| --- | --- | --- | --- | --- |
| `app/use-feedback-context.ts`, `app/feedback-context-input.tsx`, package 파일 | 제품 코드·의존성 | 보관 | 초안 구분과 보안 패치 | 위 검사 참조 |
| `tests/local-draft-qa.cjs`, `tests/local-draft-harness.tsx` | 회귀 검사 | 보관 | 구버전 가져오기·복원·계정 분리 재검사 | 위 검사 참조 |
| phase227, 기존 평가/예산·동결 근거 | 검증 근거 | 보관 | 수정 전 재현과 수정 후 확인, 기존 근거 보존 | 삭제 없음 |
| `dist`, QA 임시 프로필·번들 | 재생성 가능 산출물 | 정리 보류 | 현재 브랜치 미병합, 후속 검증에 사용 가능 | 브랜치 병합 후 사용·참조 확인 필요 |
