# 검사 범위·검증 기록

[종합 개선안](../UX_TEXT_AUDIT_2026-10-19.md) · 2026-10-19 KST

## 기준 소스

- 게시 v139, 소스 `effc203cb09f9a6ed47b81f9bec19e00d21fba4c`. Sites `get_site`, `get_site_version`, 비밀 값을 출력하지 않는 플래그 조회로 확인. 환경 revision 72.
- 검사 위치: `work/en-card-removal-20261018/`. 기본 체크아웃은 문서 저장 위치이며 실제 코드 기준과 다름.
- `app/page.tsx`, `app/layout.tsx`, 백업 Worker에서 로컬 의존 경로를 추적하고, 상태/복원 API에서 사용자에게 전달되는 오류 후보를 추가했다. 파일 import만으로 실행을 단정하지 않고 확인한 미호출 분기는 아래 제외 표에 남겼다.
- 렌더러의 동적 필드와 JSON 자료를 별도로 포함했다. 원문 문자열이 아니라 구현 식별자·CSS·로그·AI 프롬프트·비밀·개인 자료인 값은 UI 목록에 넣지 않았다.
- `outputs/ux-copy-audit/`에는 문서 생성·대조용 일회성 스크립트만 두며 Git 추가 대상이 아니다.

## 파일별 정적 문구 목록

| 소스 파일 | UI 부록 행 수 | 처리 |
| --- | --- | --- |
| app/ai-use-notice.tsx | 4 | 문구별 결정·원문 위치 수록 |
| app/api/state/restore/jobs/route.ts | 2 | 문구별 결정·원문 위치 수록 |
| app/api/state/restore/route.ts | 8 | 문구별 결정·원문 위치 수록 |
| app/api/state/route.ts | 11 | 문구별 결정·원문 위치 수록 |
| app/backup-dialog.tsx | 64 | 문구별 결정·원문 위치 수록 |
| app/backup-export-dialog.tsx | 12 | 문구별 결정·원문 위치 수록 |
| app/backup-worker-client.ts | 2 | 문구별 결정·원문 위치 수록 |
| app/backup-worker.ts | 2 | 문구별 결정·원문 위치 수록 |
| app/completed-lesson-dialog.tsx | 4 | 문구별 결정·원문 위치 수록 |
| app/completed-lesson.tsx | 17 | 문구별 결정·원문 위치 수록 |
| app/deferred-view.tsx | 4 | 문구별 결정·원문 위치 수록 |
| app/expression-fields.tsx | 3 | 문구별 결정·원문 위치 수록 |
| app/expression-line.tsx | 2 | 문구별 결정·원문 위치 수록 |
| app/familiarity-card.tsx | 21 | 문구별 결정·원문 위치 수록 |
| app/feedback-attribution.tsx | 3 | 문구별 결정·원문 위치 수록 |
| app/feedback-detail.tsx | 9 | 문구별 결정·원문 위치 수록 |
| app/feedback-issue-notice.tsx | 6 | 문구별 결정·원문 위치 수록 |
| app/feedback-safety-notice.tsx | 3 | 문구별 결정·원문 위치 수록 |
| app/grammar-terms.tsx | 45 | 문구별 결정·원문 위치 수록 |
| app/grammar/grammar-catalog.tsx | 16 | 문구별 결정·원문 위치 수록 |
| app/grammar/grammar-lesson.tsx | 27 | 문구별 결정·원문 위치 수록 |
| app/grammar/grammar-presentation.ts | 18 | 문구별 결정·원문 위치 수록 |
| app/grammar/grammar-question.tsx | 14 | 문구별 결정·원문 위치 수록 |
| app/grammar/grammar-reading.tsx | 6 | 문구별 결정·원문 위치 수록 |
| app/grammar/grammar-summary.tsx | 17 | 문구별 결정·원문 위치 수록 |
| app/grammar/grammar-writing.tsx | 16 | 문구별 결정·원문 위치 수록 |
| app/grammar/reviewed-examples.tsx | 2 | 문구별 결정·원문 위치 수록 |
| app/grammar/use-grammar-draft.ts | 1 | 문구별 결정·원문 위치 수록 |
| app/layout.tsx | 3 | 문구별 결정·원문 위치 수록 |
| app/learning-app.tsx | 29 | 문구별 결정·원문 위치 수록 |
| app/learning/availability-notice.tsx | 1 | 문구별 결정·원문 위치 수록 |
| app/learning/candidate-preparation.tsx | 5 | 문구별 결정·원문 위치 수록 |
| app/learning/clock-status.tsx | 3 | 문구별 결정·원문 위치 수록 |
| app/learning/diagnostic-download.tsx | 1 | 문구별 결정·원문 위치 수록 |
| app/learning/familiarity-assessment.tsx | 14 | 문구별 결정·원문 위치 수록 |
| app/learning/image-practice-launcher.tsx | 5 | 문구별 결정·원문 위치 수록 |
| app/learning/image-practice.tsx | 53 | 문구별 결정·원문 위치 수록 |
| app/learning/learning-aside.tsx | 15 | 문구별 결정·원문 위치 수록 |
| app/learning/learning-message.tsx | 1 | 문구별 결정·원문 위치 수록 |
| app/learning/save-error.tsx | 6 | 문구별 결정·원문 위치 수록 |
| app/learning/save-status.tsx | 5 | 문구별 결정·원문 위치 수록 |
| app/learning/settings-dialog.tsx | 28 | 문구별 결정·원문 위치 수록 |
| app/learning/source-dialog.tsx | 16 | 문구별 결정·원문 위치 수록 |
| app/learning/today-overview.tsx | 80 | 문구별 결정·원문 위치 수록 |
| app/learning/use-learning-controller.ts | 4 | 문구별 결정·원문 위치 수록 |
| app/learning/use-session-commands.ts | 4 | 문구별 결정·원문 위치 수록 |
| app/library/personal-word.tsx | 9 | 문구별 결정·원문 위치 수록 |
| app/library/word-editor.tsx | 41 | 문구별 결정·원문 위치 수록 |
| app/pending-reviews.tsx | 13 | 문구별 결정·원문 위치 수록 |
| app/review/learning-log.tsx | 49 | 문구별 결정·원문 위치 수록 |
| app/review/record-actions.tsx | 6 | 문구별 결정·원문 위치 수록 |
| app/review/review-desk.tsx | 40 | 문구별 결정·원문 위치 수록 |
| app/sentence-feedback.tsx | 4 | 문구별 결정·원문 위치 수록 |
| app/sentence-structure.tsx | 3 | 문구별 결정·원문 위치 수록 |
| app/session-records.tsx | 26 | 문구별 결정·원문 위치 수록 |
| app/sheet-dialog.tsx | 4 | 문구별 결정·원문 위치 수록 |
| app/startup-screen.tsx | 3 | 문구별 결정·원문 위치 수록 |
| app/study-date-dialog.tsx | 17 | 문구별 결정·원문 위치 수록 |
| app/study-session.tsx | 37 | 문구별 결정·원문 위치 수록 |
| app/study/learn-stage.tsx | 15 | 문구별 결정·원문 위치 수록 |
| app/study/recall-stage.tsx | 15 | 문구별 결정·원문 위치 수록 |
| app/study/sentence-stage.tsx | 17 | 문구별 결정·원문 위치 수록 |
| app/study/session-checkpoint.tsx | 6 | 문구별 결정·원문 위치 수록 |
| app/study/session-summary.tsx | 22 | 문구별 결정·원문 위치 수록 |
| app/study/warmup-stage.tsx | 5 | 문구별 결정·원문 위치 수록 |
| app/ui.tsx | 19 | 문구별 결정·원문 위치 수록 |
| app/use-backup-preview.ts | 1 | 문구별 결정·원문 위치 수록 |
| app/use-backup-restore.ts | 19 | 문구별 결정·원문 위치 수록 |
| app/use-learning-store.ts | 10 | 문구별 결정·원문 위치 수록 |
| app/word-image-preview.tsx | 1 | 문구별 결정·원문 위치 수록 |
| app/word-library.tsx | 52 | 문구별 결정·원문 위치 수록 |
| app/word-pronunciation.tsx | 3 | 문구별 결정·원문 위치 수록 |
| components/ui/dialog.tsx | 1 | 문구별 결정·원문 위치 수록 |
| lib/backup-analysis.ts | 2 | 문구별 결정·원문 위치 수록 |
| lib/backup-structure.ts | 1 | 문구별 결정·원문 위치 수록 |
| lib/backup.ts | 7 | 문구별 결정·원문 위치 수록 |
| lib/catalog.ts | 2 | 문구별 결정·원문 위치 수록 |
| lib/client-request.ts | 1 | 문구별 결정·원문 위치 수록 |
| lib/content.ts | 3 | 문구별 결정·원문 위치 수록 |
| lib/device-speech.ts | 5 | 문구별 결정·원문 위치 수록 |
| lib/feedback-compatibility.ts | 1 | 문구별 결정·원문 위치 수록 |
| lib/feedback-safety.ts | 4 | 문구별 결정·원문 위치 수록 |
| lib/grammar-terms.ts | 8 | 문구별 결정·원문 위치 수록 |
| lib/grammar/compatibility.ts | 1 | 문구별 결정·원문 위치 수록 |
| lib/grammar/content-v3.ts | 1 | 문구별 결정·원문 위치 수록 |
| lib/grammar/content-v4.ts | 1 | 문구별 결정·원문 위치 수록 |
| lib/grammar/content.ts | 2 | 문구별 결정·원문 위치 수록 |
| lib/grammar/model.ts | 18 | 문구별 결정·원문 위치 수록 |
| lib/grammar/practice.ts | 3 | 문구별 결정·원문 위치 수록 |
| lib/learning-api.ts | 1 | 문구별 결정·원문 위치 수록 |
| lib/learning-journal.ts | 4 | 문구별 결정·원문 위치 수록 |
| lib/learning-notices.ts | 4 | 문구별 결정·원문 위치 수록 |
| lib/learning/daily-allocation.ts | 3 | 문구별 결정·원문 위치 수록 |
| lib/learning/familiarity.ts | 7 | 문구별 결정·원문 위치 수록 |
| lib/learning/model.ts | 27 | 문구별 결정·원문 위치 수록 |
| lib/learning/outcomes.ts | 7 | 문구별 결정·원문 위치 수록 |
| lib/learning/sessions.ts | 1 | 문구별 결정·원문 위치 수록 |
| lib/pronunciation.ts | 1 | 문구별 결정·원문 위치 수록 |
| lib/restore-client.ts | 2 | 문구별 결정·원문 위치 수록 |
| lib/restore-validation.ts | 6 | 문구별 결정·원문 위치 수록 |
| lib/sentence-feedback-presentation.ts | 4 | 문구별 결정·원문 위치 수록 |
| lib/sentence-structure.ts | 6 | 문구별 결정·원문 위치 수록 |
| lib/server/http.ts | 2 | 문구별 결정·원문 위치 수록 |
| lib/server/request-body.ts | 2 | 문구별 결정·원문 위치 수록 |
| lib/server/restore-http.ts | 3 | 문구별 결정·원문 위치 수록 |
| lib/state-data-keys.ts | 1 | 문구별 결정·원문 위치 수록 |
| lib/state-integrity.ts | 4 | 문구별 결정·원문 위치 수록 |
| lib/state-shape.ts | 19 | 문구별 결정·원문 위치 수록 |
| lib/study-clock.ts | 1 | 문구별 결정·원문 위치 수록 |
| lib/study-date-correction.ts | 2 | 문구별 결정·원문 위치 수록 |
| lib/study-draft.ts | 2 | 문구별 결정·원문 위치 수록 |
| lib/today-status.ts | 13 | 문구별 결정·원문 위치 수록 |
| lib/validation.ts | 1 | 문구별 결정·원문 위치 수록 |
| public/manifest.webmanifest | 2 | 문구별 결정·원문 위치 수록 |
| lib/feedback-issue.ts | 47 | 47코드 × 제목·원인·행동 3문구 = 141문구를 코드 단위로 묶음 |

## 원문 탐지 후 UI 집계에서 제외한 항목

| 파일·줄 | 원문 | 제외 이유 |
| --- | --- | --- |
| app/sentence-structure.tsx:4 | 이전 교정에는 문장 구조 설명이 없어요. | 현재 호출자는 ReviewedExamples의 origin=curriculum과 검토 완료 구조만 전달. AI 구조 표시 경로는 현행 미사용. |
| app/sentence-structure.tsx:5 | 문장 구조를 설명하기 어려워요. | 현재 호출자는 ReviewedExamples의 origin=curriculum과 검토 완료 구조만 전달. AI 구조 표시 경로는 현행 미사용. |
| app/sentence-structure.tsx:7 | 교정문 구조 | 현재 호출자는 ReviewedExamples의 origin=curriculum과 검토 완료 구조만 전달. AI 구조 표시 경로는 현행 미사용. |
| app/sentence-structure.tsx:8 | 교정문을 순서대로 나눈 역할 | 현재 호출자는 ReviewedExamples의 origin=curriculum과 검토 완료 구조만 전달. AI 구조 표시 경로는 현행 미사용. |
| app/word-library.tsx:62 | 문장 뼈대 | 그룹 초기 선택 키이며 실제 그룹명 데이터는 콘텐츠 부록에서 포함. |
| lib/sentence-feedback.ts:16 | 문장 구조와 교정문이 일치하지 않아요. | 현재 결과 뷰는 FeedbackDetail의 OPINION_TEXT 사용. 구형 판정 라벨은 미호출, 스키마 메시지는 검증용. |
| lib/sentence-feedback.ts:21 | 문장 구조와 교정문이 일치하지 않아요. | 현재 결과 뷰는 FeedbackDetail의 OPINION_TEXT 사용. 구형 판정 라벨은 미호출, 스키마 메시지는 검증용. |
| lib/sentence-feedback.ts:29 | 오늘의 뜻에 맞아요 | 현재 결과 뷰는 FeedbackDetail의 OPINION_TEXT 사용. 구형 판정 라벨은 미호출, 스키마 메시지는 검증용. |
| lib/sentence-feedback.ts:29 | 뜻·용법을 확인해요 | 현재 결과 뷰는 FeedbackDetail의 OPINION_TEXT 사용. 구형 판정 라벨은 미호출, 스키마 메시지는 검증용. |
| lib/sentence-feedback.ts:29 | 뜻·용법 판단이 어려워요 | 현재 결과 뷰는 FeedbackDetail의 OPINION_TEXT 사용. 구형 판정 라벨은 미호출, 스키마 메시지는 검증용. |
| lib/sentence-feedback.ts:30 | 자연스러운 문장이에요 | 현재 결과 뷰는 FeedbackDetail의 OPINION_TEXT 사용. 구형 판정 라벨은 미호출, 스키마 메시지는 검증용. |
| lib/sentence-feedback.ts:30 | 문장을 다듬어 보세요 | 현재 결과 뷰는 FeedbackDetail의 OPINION_TEXT 사용. 구형 판정 라벨은 미호출, 스키마 메시지는 검증용. |
| lib/sentence-feedback.ts:30 | 문법 판단이 어려워요 | 현재 결과 뷰는 FeedbackDetail의 OPINION_TEXT 사용. 구형 판정 라벨은 미호출, 스키마 메시지는 검증용. |
| components/ui/dialog.tsx:114 | Close | DialogFooter showCloseButton 기본 false. 현재 호출처는 이 옵션을 켜지 않음. |

구두점·공백·구분자 조각 54건은 독립 카피로 세지 않았다. 인접 본문·단위와 함께 유지한다. 파일별 중복 문자열의 모든 출현 줄은 UI 부록 근거 열에 남겼다.

| 기타 검사 범위 | 판정·이유 |
| --- | --- |
| lib/learning/exports.ts | CSV 열·튜터 프롬프트·내보내기 결과는 화면 문구와 구분. 다운로드 버튼·설명은 포함. 파일 호환성을 위해 내보내기 열 이름을 일괄 변경하지 않는다. |
| app/api/image-practice/position/route.ts | 응답 message 대신 클라이언트 status별 문구를 표시한다. 현재 UI는 ImagePractice PositionStatus의 6종 상태와 충돌 선택을 포함한다. |
| app/cards/page.tsx, lib/server/retired-cards.ts | 카드 기능 종료. /cards는 홈 이동, 410 API는 현행 학습 UI 화면이 아님. |
| components/ui 중 미사용 기본 위젯 | breadcrumb/carousel/pagination/sheet/sidebar/spinner의 영어 기본 라벨은 현재 진입에서 사용되지 않아 현행 문구로 세지 않음. 활성 Dialog X의 Close는 포함. |
| 영어 정확도 평가 API·서버 AI 프롬프트 | 운영자 평가·모델 입력용으로 학습자 화면 문구가 아님. 개인 원문·키·제공자 실패 본문을 새로 표시하지 않는다. |
| JSON 캐시·생성 자료 | catalog-basics의 뜻과 content.json 원본, expression-translations의 표현 해석을 ID별 대조. 생성 해시·이미지 파일명·URL을 학습 카피로 세지 않음. |
| 문법 교재의 보조 b/clues 키·대체 정답·orderFormat | 합성 전 재료나 채점 입력이다. 실제 선택된 reading/observation/questions/reviews/frame/checks/commonMistake/extra와 버전별 lesson·검토 예문만 표시 목록에 포함. |
| 개인 입력·실제 AI 출력 | 사용자의 실제 값을 읽지 않고 동적 표시 필드·보존 정책만 검사. 임의 대표 문장을 현재 사용자 원문으로 인용하지 않음. |
| 외부 로그인·사전·원문 PDF 내부 | 제공사 소유 화면·원문 자체는 수정 대상 UI에서 제외. 앱 내부 링크 이름·자료 구분·라이선스 표시는 포함. |

## 데이터 대조

| 대상 | 건수 | 확인 범위 |
| --- | --- | --- |
| 기본 단어/콘텐츠 | 3809 | ID 일치·표시 필드·목록 행 전수 수록 |
| 발음 안내 | 35 | 뜻·IPA·용도·주석 |
| 이미지 목록 | 3809 | 단어·뜻은 어휘 부록. 검토 장면 20개와 fallback은 UI 부록. 이미지 자체 시각·언어 QA는 미수행 |
| 문법 | 15수업 × 4버전 | 705개 표시 블록, 540개 버전별 문항 객체(버전 중복 포함), 근거 링크 23개 |

CSS 생성 문자열은 +, −, ✓ 및 빈 구분자, 스와이프 DOM 텍스트는 ‹이다. 학습 문구가 아니며 기존 아이콘·접힘 상태를 보존한다. 가시 레이블을 이 기호만으로 대체하지 않는다.

## 검증 실행 결과

| 실행한 검사 | 결과 |
| --- | --- |
| `node outputs/ux-copy-audit/extract.cjs` | 종료 코드 0. 앱·라이브러리·공통 위젯의 정적 문자열 후보 추출. |
| `node outputs/ux-copy-audit/scope.cjs` | 종료 코드 0. 198개 로컬 의존 파일과 상태/복원 오류 경로를 분류. |
| `node outputs/ux-copy-audit/prepare.cjs` | 종료 코드 0. 문법 15개 수업의 v1~v4 표시 객체를 합성. 실제 AI·네트워크 호출 없음. |
| `node outputs/ux-copy-audit/build.cjs` | 종료 코드 0. 원문과 매칭되지 않는 편집 규칙 0개, 기본 어휘 누락 0개. |
| `node outputs/ux-copy-audit/validate.cjs` | 종료 코드 0, PASS. 편집 규칙 188개·주요 표 212행·정적 UI 1,235행·AI 오류 47코드·어휘 ID 3,809개·문법 4버전의 문항 객체 540개 대조. |
| 원문·문서 무결성 | 추출한 범위의 미분류 후보 0개, 뜻·표현 해석 캐시 불일치 0개, 로컬 링크 누락 0개. 모든 Markdown 표 열 수·필수 셀·줄 위치와 게시 소스 clean 상태 확인. |

행 수는 UI 문자열 중복을 파일 안에서 합친 뒤의 수이며, 문항 객체 540개에는 같은 문제의 버전별 중복이 포함된다. ‘미분류 0개’는 정적 추출 범위에 대한 결과이며 브라우저의 모든 상태를 실행했다는 뜻은 아니다. 검증 상세·파일 해시는 로컬 `outputs/ux-copy-audit/validation.json`에 보관한다.

문서만 추가해 앱의 단위 테스트·typecheck·lint·build·브라우저 검사는 실행하지 않았다. 이 작업으로 실행 코드가 바뀌지 않았으므로 앱 통과를 주장하지 않는다. 문서 원문·행 수·출처 경로·데이터 대응·Markdown 표 구조를 별도 검증했다. 런타임 화면 재현·실제 iPhone·VoiceOver·인간 영어 전문가 교열·새 AI 응답 평가는 미검증이다.
