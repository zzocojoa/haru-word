# Oxford 이미지 제작 완료 보고서

2026-10-14 KST · 브랜치 codex/oxford-word-images · 범위: 이미지와 연결 목록 준비.

현재 교재의 **3,809개 학습 항목 모두 제작자 품질 검수를 통과**했다. 수정본 포함 **4,079개 PNG**를 보존했고 보류·실패·대기는0개다. 원본/320px에서 뜻·품사·표식·스타일·식별성을 확인한 제작자 검수이며, 독립학습자 평가나 영어 정확도 인증은 아니다.

## 파일과 기록

- [연결 목록](../data/word-image-manifest.json): ID·기본 뜻·품사·교재 지문·최신 PNG·SHA256·실제 크기·시도와 검수.
- 이미지: 주 작업 폴더 C:/Users/user/Documents/ChatGPT/하루단어/outputs/oxford-images/14552b36a1653f2aed9e14b09c833c0031b1204de5e0bdfc6902543a05d4ba6e/. Git 제외이며 이 컴퓨터에 저장되어 있다. 저장소만 복제하면 PNG는 포함되지 않는다.
- 생성 도구 원본: C:/Users/user/.codex/generated_images/01a0f089-0fd7-79e0-9811-440f5c8a9721/. 이전 후보를 덮어쓰지 않았다.
- 원장: 이 worktree의 work/oxford-images-progress.json. 상세 전체 파일 감사: work/oxford-batch-408-full-file-audit.json. 요구사항 감사: work/oxford-batch-408-requirements-audit.json. 명령 반환·예외·과거 오류는 work에 보존한다.
- [전체 계획](OXFORD_WORD_IMAGES_PLAN.md), [묶음별 진행](OXFORD_WORD_IMAGES_PROGRESS.md), [남은4개 결정](OXFORD_WORD_IMAGES_REMAINING_DECISIONS.md), [마지막 수정 회차](OXFORD_WORD_IMAGES_RECOVERY_ROUND9.md).

## 최종 검사

| 검사 | 결과 |
|---|---|
| 현재 교재 ID·뜻·품사·교재 지문 | 3,809개 누락/중복 없음 |
| 최신 파일·프롬프트·회차 계약 | 3,809개 통과, exit0 |
| 전체 시도 PNG·해시·크기·전체 픽셀 디코딩 | 4,079개 통과, exit0 |
| 내장 도구 원본과 저장본 바이트 일치 | 4,079개, 미연결0 |
| 시범20개와 about/bank/light/record 뜻 구분 | 기존 승인 보존·별도10개 파일/해시 확인 |
| 최종 관리 CLI 회귀 | 회차108+글자예외60+복구51+재개19=238개, 모두 exit0 |
| 동일 소스 앱 검사 | 407차 앱565개·타입·빌드 exit0, 린트 오류0/기존경고13 |

마지막 데이터 변경 후238검사를 다시 실행했다. 앱 소스·교재·검증 코드 해시가407차와 같아565앱/타입/린트/빌드를 중복 실행하지 않았다. [현재 코드58a47ec의 GitHub CI](https://github.com/zzocojoa/haru-word/actions/runs/38546705673)는 Node22/24 모두 계정 결제 또는 지출 한도 안내로 단계0에서 실패했다. 두 조건 중 실제 원인/무료분 소진 여부는 확인되지 않았고 CI 통과로 표시하지 않는다. 요금/한도 변경이나 자동 재실행은 하지 않았다. 실제 iPhone과 독립학습자 검증도 실행하지 않았다.

## 사용자 결정과 출처 보존

capital 형용사·letter 명사·print 명사는 실제 사용자 답변에 따라 **뜻을 이루는 영문 글자 형태만 예외**다. textFree=false와 허용 글자/추가 표식 부재를 별도로 검수했다. 다른3,806개는 글자 금지다. 과거 조건 보류3객체는 history, 별도 remaining 승인에는 원래4개 entryBefore를 보존한다. breast는 완전히 옷을 입은 성인 상담 장면으로 통과했고 원래 도구 거절2회는 남긴다. 새 성공으로 이전 거절 원인을 추정하지 않는다.

최초53회·품질14개·남은4개 승인을 교체하지 않고 회차별 ID/지문/시작 합계를 보존했다. 총 시작 슬롯4,087, 확인된 내장 호출4,086, 기존 전달 미확인1이다. 이전 grade 첫 저장 명령 반환 공백은 회수하지 못했고 ENOSPC/EPERM의 당시 근본원인은 미확정이다. 파일 존재·해시·원본 연결 확인과 역사적 명령 반환 공백을 구분한다. 이 한계들을 성공 기록으로 덮어쓰지 않았다.

## 재개와 후속 화면 반영

1. 이 worktree에서 `node scripts/oxford-images.cjs status`로 현재 호출 없음·승인3,809·승인 회차 사용 합계를 확인한다. 승인된 항목은 다시 생성하지 않는다. 원장/journal 불일치가 있으면 새 이미지 호출 전에 기록과 기존 PNG를 먼저 대조한다.
2. 전체 파일/회차 메타데이터를 재검사할 때는 `node work/oxford-batch-408-metadata-only.cjs`를 사용한다. 상세 감사 JSON과 파일 SHA를 대조한다. 320px 렌더는 `node scripts/verify-oxford-images.cjs ENTRY_ID`로 로컬에서 확인할 수 있다. ENTRY_ID를 실제 항목 ID로 바꾼다. 이 명령은 이미지/AI 호출을 하지 않는다.
3. 후속 호스팅 작업에서는 승인된 최신3809개만 업로드 목록으로 만든다. ID·sourceFingerprint·SHA를 유지하고 사용자 수정 뜻과 개인 단어에는 기본 이미지를 임의 적용하지 않는다. 원본/실패/승인 내역은 삭제하지 않는다.
4. 첨부 화면의 이미지 표시·단어/뜻 공개 순서·실패 시 대체 화면과 기록 호환성은 별도 UI 변경으로 검토한다. 이번에는 앱/UI/호스팅/DB/API/백업/학습 기록/운영 배포를 바꾸지 않았다.
