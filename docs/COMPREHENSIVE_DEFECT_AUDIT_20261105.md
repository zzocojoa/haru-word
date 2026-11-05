# 하루단어 광역 결함 검사 · 2026-11-05

근거가 있는 결함 **22건(P1 2, P2 17, P3 3)**을 분류했다. 제품 결함12건과 도구·운영·문서10건이다. 의존성 고유 권고23개는 별도 정비7작업으로 묶어 **총29개 후속 작업**을 제안한다. 전부 미수정이다. P0는 입증하지 못했으며 치명적 결함이 없다는 보증은 아니다.

먼저 처리할 P1은 **UI-5: 이전 계정의 지연된 문서가 새 계정의 저장 전 기기 초안을 삭제함**, **AI-6: 문법 내 문장 수정·교정 되돌리기가 독립 복습 성적과 최근 점검 기록을 지움**이다. 둘 다 실제 built Chromium·합성 D1에서 반복 확인했다.

검사 전에 main@5609a8e6fa7d148ff4cf6582ae20fe0ed2669171에서 codex/comprehensive-defect-audit-20261105 브랜치를 만들었다. 실제 checkout은 work/comprehensive-defect-audit-20261105다. 원래943파일과 기존 관리 원본·과거 평가·Task Master 이력을 보호하고, 실행 코드는 변경하지 않았다. 최종 보존 결과는 [동결 검증](../../../outputs/comprehensive-defect-audit-20261105/preservation-final.json)을 따른다.

## 문서와 근거

- [우선순위 작업표 CSV](AUDIT_PRIORITY_BACKLOG_20261105.csv) · [JSON](AUDIT_PRIORITY_BACKLOG_20261105.json)
- [기능별32영역·943파일 검사대장](COMPREHENSIVE_DEFECT_AUDIT_20261105.coverage.json)
- [결함·상세 근거·실행 명령 JSON](COMPREHENSIVE_DEFECT_AUDIT_20261105.findings.json)
- [실행/실패 원본](../../../outputs/comprehensive-defect-audit-20261105/functional) · [최종 게이트](../../../outputs/comprehensive-defect-audit-20261105/final-gates.json)

이는 조사 결과의 우선순위 분류다. 새 Task Master 플랜·태그·대시보드를 생성하거나 기존 완료율·예산을 바꾸지 않았다.

## 검사 범위와 판정 기준

원본943파일을 빠짐없이 목록화·분류하고 API17경로/메서드를 AST로 대조했다. 제품·DB·마이그레이션·AI·자료·이미지·의존성·QA·문서·운영·대시보드 등32영역을 검토했다. 파일별 검사 깊이는 검사대장의 reviews.level을 따른다. 모든943파일을 수동으로 한 줄씩 의미 검수했다는 뜻은 아니다. 문서의 역사/메타데이터 검토, 자료 구조 검사, AST 검사와 전문 흐름 검토를 구분했다.

실행은 격리된 로컬 Worker/D1과 합성 계정에서 했다. 모의 OpenAI 응답은 현재 계약을 사용하며 실제 유료 호출은0이다. 운영에서는 익명 GET3개와 제한된 상태·버전·로그만 읽었고 학습 행 조회/쓰기·설정/Secret 변경·배포는0이다. 실제 iPhone·VoiceOver는 사용자가 정한 후속 작업이다.

P1은 유의미한 학습/복구 데이터 손실, P2는 특정 조건에서 저장·입력 보존·중복 방지·판정/운영 계약 위반, P3는 제한적 검사 신뢰성/낮은 도달성 정비로 분류했다. 실제 재현, 순수 함수/모의 응답 재현, 정적 추론은 각 항목에 표시했다. 같은 원인 변형과 DATA-1↔DEP-ZOD 영향을 중복 제품 결함으로 더하지 않았다.

공통 실행 정보: Windows·Node22.22.2/24.22.1·React/TypeScript·Vinext/Cloudflare Workers/D1·문서화된 native Playwright/axe 검사다. 보고서 전용이며 수정 권한은 사용하지 않았다. Probe budget은 총 제한 없이 명령별 유한 timeout이며, root50명령 Guarded command time 합계는3879561ms(각 receipt의 child 시작~완료 합계)다. Total session elapsed는 **unmeasured**다. 담당자별 명령 시간과 실제 앱 지연 시간은 이 합계에 합치지 않는다.

## Charters · 조사 전 원문 보존

아래30개는 조사 전에 기록한 기대 계약과 격리 조건이다. 최종32영역 대장은 OPERATIONS를 대시보드와 문서로 추가 세분화한 분류를 포함하며, 사후에 원래 계획을 바꾸지 않았다.

### AUTH · 인증·로그인·계정 격리
- 기대 계약/종료 조건: 잘못된 계정/누락된 인증으로 다른 사람의 기록에 접근하지 않음
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### API · 전체 API 경로·메서드·입력 경계
- 기대 계약/종료 조건: 각 경로의 성공/인증/오입력/오류 계약과 불필요한 쓰기 없음
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### STATE · 상태 envelope·schema·수치·용량
- 기대 계약/종료 조건: 허용 범위와 하위 호환·형식 거절·왕복 보존
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### REVISION · revision·동시 저장·순서
- 기대 계약/종료 조건: 두 저장 순서와 재시도에서 최신 입력·충돌 보호
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### DRAFT · 학습 초안·재접속·다중 탭
- 기대 계약/종료 조건: 오프라인/저장 실패/계정 전환/닫기 후 입력 보존
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### DB · DB 무결성·트랜잭션·쿼리
- 기대 계약/종료 조건: 부분 실패·잘못된 소유자·중복/누적 상태가 금지된 변경을 만들지 않음
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### RESTORE · 직접 백업 복원·원자성
- 기대 계약/종료 조건: 신구 백업/누적 한도/실패에서 기존 데이터를 보존
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### RESTORE-JOBS · 분할 복원·수명·회복
- 기대 계약/종료 조건: 업로드/검증/commit/취소/만료/중복/동시성의 최종 상태
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### EXPORT · JSON·CSV 백업·내보내기
- 기대 계약/종료 조건: 문자/줄바꿈/숫자·기록 보존과 CSV 수식 경계
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### AI · OpenAI 전송·응답·오류·판정
- 기대 계약/종료 조건: 명시 요청·단일 제공자·시간/크기 한도·오류 보존·신구 판정
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### AI-RECEIPT · AI 영수증·중복·비용 안전
- 기대 계약/종료 조건: 재시도/유실/진행 중 응답에서 중복 유료 요청이 없음
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### GRAMMAR · 문법 수업·과제·성적
- 기대 계약/종료 조건: 수업 목표·진도·의견·신구 contentVersion을 분리
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### WORDS · 단어 탐색·뜻·편집·개인 단어
- 기대 계약/종료 조건: 목표/뜻/품사 선택·검색·수정·개인 항목의 올바른 보존
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### LEARNING · 단어 목표·친숙도·회상·학습 흐름
- 기대 계약/종료 조건: 성적 혼합 없음·완료/이어 보기·지연 저장과 최신 입력 보존
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### IMAGES · 이미지 연습·위치·자산 연결
- 기대 계약/종료 조건: 항목/뜻 일치·위치 충돌·복구·답안 은닉
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### SPEECH · IPA·음성·취소·자원 정리
- 기대 계약/종료 조건: 표제어/품사/뜻 일치·중단/계정 전환·중복 재생 경계
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### NAV · 페이지·내비게이션·모달·뒤로가기
- 기대 계약/종료 조건: 잘못된 이동/팝업/포커스·백그라운드 응답으로 입력을 잃지 않음
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### A11Y · 접근성·반응형·키보드
- 기대 계약/종료 조건: 320/390/865/1440 및 200%·초점·명칭·오류 안내
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### STARTUP · 첫 실행·lazy loading·폰트·캐시
- 기대 계약/종료 조건: 지연/실패 중에도 초기 화면과 조작의 계약 보존
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### PERF · 성능·번들·메모리·네트워크
- 기대 계약/종료 조건: 문서화된 초기 로딩/반복 진입/CPU·느린망 조건의 성능
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### CONTENT · 단어·문법·IPA·이미지 정적 자료 전체
- 기대 계약/종료 조건: 모든 행/항목/연결/지문/출처 일치와 생성 재현성
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### DEPENDENCIES · 의존성·보안 권고·도달 가능성
- 기대 계약/종료 조건: 직접/전이·운영/개발·실제 경로와 권고 조건 대조
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### WORKER · Cloudflare 런타임·빌드·바인딩·환경
- 기대 계약/종료 조건: Node와 Worker 차이·DB/R2·secret 미설정·공개 경계
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### QA-TOOLS · CI·QA runner·프로세스·정리
- 기대 계약/종료 조건: 실제 실패 exit 보존·격리·소유 프로세스 종료·증거 진실성
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### LEGACY · 종료된 카드·예전 제공자·자동화
- 기대 계약/종료 조건: 종료 경로 거절·신규 Google/Groq 호출과 자동 대체 없음
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### OPERATIONS · 운영·복구·출처·링크·문서
- 기대 계약/종료 조건: 현재 운영과 복구 대상·출처/공개 파일·유효한 경로
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### CLOCK · 한국 학습일·서버 시계·경계
- 기대 계약/종료 조건: 날짜 전환/오프라인/시간대·잘못된 timestamp에 대한 일관성
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### UNTRUSTED · 외부 입력·HTML·CSV·리디렉션
- 기대 계약/종료 조건: 명령/구조/URL/키·프로토타입 등 신뢰 경계 보존
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### RECOVERY · 오류·취소·느린망·재시도
- 기대 계약/종료 조건: 네트워크 장애·잘못된 응답·순서 역전에서 무손실 회복
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

### PRIVACY · 관측·로그·응답 정보·개인정보
- 기대 계약/종료 조건: 비밀/개인 답안·타인 식별자 누출 없이 필요한 오류 정보만 표시
- 진입점: inventory.json에서 해당 모듈의 모든 파일·기존 검사·공개 경로를 대조한다.
- 위험/방법: 성공과 지속 상태 → 오입력·오류·중복·동시성·부분 실패를 적용 가능한 경계마다 정적/합성 재현/기존 CLI 검사로 확인한다.
- 격리: 이 새 checkout의 합성 fixture와 로컬 루프백만 사용한다. 명령과 입력·전후 상태·반복 확인을 별도 증거로 남긴다.

## 검증 결과

| 검사 | 결과 | 종료 코드/근거 |
|---|---|---|
| Node22 단위 | 800/800 통과 | 0 · [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/001/receipt.json) |
| 타입 검사 | npm run typecheck 통과 | 0 · [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/002/receipt.json) |
| 린트 | 오류0·기존 경고15 | 0 · [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/003/receipt.json) |
| 문법 자료 | npm run check:grammar-review 통과 | 0 · [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/004/receipt.json) |
| Worker 빌드 | npm run build 통과 | 0 · [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/005/receipt.json) |
| Chromium 기능 | 원본87/87 통과 | 0 · [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/006/receipt.json) |
| WebKit 기능 최초 | 원본85/87; 백업 시간초과·구조 의견 준비 단언 실패 | 1 · [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/017/receipt.json) |
| WebKit 백업 원본 반복 | 018/023 둘 다 통과; 최초 시간초과 원인 미확정 | 0 · [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/018/receipt.json) [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/023/receipt.json) |
| WebKit 구조 의견 원본 | 019도 실패; 진단021/022만 통과(TEST-2) | 1 · [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/019/receipt.json) [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/021/receipt.json) [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/022/receipt.json) |
| Node24 단위 최초 | 799/800; TEST-3의 cleanup JSON 파싱 실패 | 1 · [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/046/receipt.json) |
| Node24 중단 단독 | 원본6/6 통과 | 0 · [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/048/receipt.json) |
| Node24 단위 반복 | 원본800/800 통과; 최초 실패 보존 | 0 · [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/049/receipt.json) |
| 성능 native5 | 5/5 완료; 같은 소스 두 Worker 대조, 지연 수치의 무조건적 합격 판정 아님 | 0 · [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/047/receipt.json) |
| 느린망 긴기록 | 1825세션·4배CPU·150ms지연/500KBps·저장/보존 통과 | 0 · [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/050/receipt.json) |
| 실제 DB 이미지 격리 | Chromium/WebKit 모두 학습 상태·성적 보존 | 0 · [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/036/receipt.json) [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/037/receipt.json) |
| 비활성 기능 조건 | 두 엔진6사례 모두 통과; flags smoke·image production·word-image disabled | 0 · [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/038/receipt.json) [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/039/receipt.json) [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/040/receipt.json) [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/041/receipt.json) [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/042/receipt.json) [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/043/receipt.json) |
| 대시보드 기존 회귀 | 17+18검사 통과; 새 재현 결함3개와 분리 | 0 · [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/044/receipt.json) [근거](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/045/receipt.json) |
| 운영 익명 읽기 | 홈200·서버시계200·상태401; 학습 행 조회/쓰기0 | 0 · [근거](../../../outputs/comprehensive-defect-audit-20261105/production-anonymous-health.json) [근거](../../../outputs/comprehensive-defect-audit-20261105/production-status.json) |
| 실기기/VoiceOver·실제 API 품질 | 이번 실행0; 사용자 지정 후속/기존 닫힌 예산 보존 | 해당 없음 · [근거](../../../outputs/comprehensive-defect-audit-20261105/baseline.json) |

원본 WebKit 전체 검사는85/87로 실패했다. 대용량 백업 사례는 원본 그대로 단독018/023에서 통과했지만 최초 시간 초과 원인은 미확정이다. 구조 의견 사례는 원본019도 실패했고 관찰용 대기만 추가한021/022에서 통과했다(TEST-2). 진단 통과를 원본 검사 통과로 바꾸지 않았다. Node24 최초 전체 결과와 후속 결과도 별도 보존한다.

성능의 이미지 비교는 같은 소스의 독립 루프백 Worker 두 개를 사용한 대조다. 수정 전/후 개선율을 입증한 비교가 아니다. 기존 정상 용량 성능 사례와 DATA-1의 비정상 메모리 고갈 검사는 구분한다.

### 기능/브라우저 판정 구분

기능 증거 materialize의 최종 판정은 **fail**다. 이는 미수정 결함과 실패 gate가 남았다는 뜻이며 조사 보고서 작성 완료와 구분한다. [정규화 증거](../../../outputs/comprehensive-defect-audit-20261105/functional/evidence.json)에50개 명령의 성공·결함·실패·준비 보완 이력이 모두 있다. 담당자의 추가19개 capture도 각 evidence.json에 보존했다.

브라우저는 현재 built 앱과 자체 대시보드의 기능·반응형·키보드/axe 계약을 native 도구로 검사했다. URL/화면 전환 방문 횟수는 별도 계측하지 않았다. 실제 iPhone은0회다. 기능 결과를 임의의100점 건강 점수로 환산하지 않으며 콘솔·링크·시각·UX·성능·접근성 통합 점수는 미산정이다. 최초 WebKit 실패/준비 실패의 캡처와 원본 화면 자료를 지우지 않았다.

## 우선순위 작업 분류

| 순서 | ID | 우선순위 | 작업 | 선행 |
|---:|---|---|---|---|
| 1 | UI-5 | P1 | 이전 계정의 지연된 문서가 새 계정의 저장 전 기기 초안을 삭제함 | — |
| 2 | AI-6 | P1 | 문법 내 문장 수정·교정 되돌리기가 독립 복습 성적과 최근 점검 기록을 지움 | — |
| 3 | UI-3 | P2 | 최신 기록 GET 대기 중 받은 문법 입력이 snapshot 교체로 사라짐 | — |
| 4 | UI-1 | P2 | 다른 초안을 복구하면 이미 기록한 답 공개·도움 사용을 취소하고 독립 성공으로 바꿀 수 있음 | — |
| 5 | UI-2 | P2 | 문장 완료 후 성공한 초안이 정리되지 않아 정상 학습21건으로 기기 복구 한도20개가 가득 참 | — |
| 6 | UI-4 | P2 | 완료 수업에 미완료 문장 초안을 복구하면 완료일과 자기 점검이 모순되어 자동 저장이 거절됨 | AI-6 |
| 7 | AI-1 | P2 | 앞뒤 공백이 있는 문법 v5 의견을 받은 뒤 진도 저장이 거절됨 | — |
| 8 | AI-2 | P2 | 이전 요청 조회의 일시적 오류가 pending UUID를 버려 다음 클릭에서 새 요청을 만듦 | — |
| 9 | DATA-1 | P2 | 본문 한도 안의 비정상 저장 컬렉션이 제한된 로컬 workerd를 메모리 고갈로 종료시킴 | — |
| 10 | DOCS-1 | P2 | README가 현재 복구 지침으로 안내하는 문서가 효력 없는 옛 AI 차단 스위치를 지시함 | — |
| 11 | OPS-1 | P2 | 공식 공개자료 재생성이 최근 수정한 OpenAI 전송정책 안내를 Google/Groq 자동전환 안내로 되돌림 | — |
| 12 | DEP-UNDICI | P2 | undici 의존성 정비 (8 advisory) | — |
| 13 | DEP-VITE | P2 | vite 의존성 정비 (5 advisory) | — |
| 14 | DEP-ZOD | P2 | zod 의존성 정비 (1 advisory) | — |
| 15 | AI-3 | P2 | 작은 동사 허용 목록에 없는 정상 명령문을 앱이 강제 보류함 | — |
| 16 | AI-4 | P2 | 평서문을 의문문으로 바꾸는 교정이 발화행위 보호를 통과함 | — |
| 17 | AI-5 | P2 | 수량·부정을 집계만 비교해 대상·절 연결이나 음수 부호 변경을 놓침 | — |
| 18 | DASH-1 | P2 | 실시간 새로고침이 registry의 새 플랜·라벨·이력 예산 변경을 반영하지 못함 | — |
| 19 | DASH-2 | P2 | JSON 사본을 가져온 뒤 먼저 시작한 원본 조회 응답이 사본을 덮고 live 모드로 되돌림 | — |
| 20 | DASH-3 | P2 | 태그가 없는 구형 tasks 배열을 다른 이름의 플랜에도 재사용해 작업 출처를 섞을 수 있음 | — |
| 21 | TEST-1 | P2 | 늦은 AI 응답 검사가 현재 계약에서 항상 거절되는 fixture를 사용해 무시 보호의 회귀를 가릴 수 있음 | — |
| 22 | OPS-2 | P2 | Linux 자원 검사 시간초과 정리가 별도 세션의 Worker를 종료하지 못하는 경로 | — |
| 23 | DEP-SATORI | P3 | satori 의존성 정비 (1 advisory) | — |
| 24 | DEP-NEXT | P3 | next 의존성 정비 (3 advisory) | — |
| 25 | DEP-FASTURI | P3 | fast-uri 의존성 정비 (4 advisory) | — |
| 26 | DEP-MINIMATCH | P3 | minimatch 의존성 정비 (1 advisory) | — |
| 27 | OPS-3 | P3 | 동일 stale lock을 동시에 회수하면 새 소유자의 잠금을 삭제해 두 QA suite가 함께 실행될 수 있음 | — |
| 28 | TEST-2 | P3 | 구조 의견 QA가 비동기 준비·저장 완료 전에 검사해 WebKit에서 거짓 실패함 | — |
| 29 | TEST-3 | P3 | 중단 검사가 마커 파일 존재를 준비 완료로 취급하고 cleanup JSON 예외로 결과를 가림 | — |

**순서 제약:** UI-4는 AI-6에서 복습 기록·작성 자기점검을 분리하는 올바른 상태 전이를 만든 뒤 수정한다. 현행 updateGrammarSentence를 그대로 재사용하지 않는다. UI-2/UI-5는 초안 정리/계정 소유권 계약을 함께 회귀 검사한다. DATA-1과 DEP-ZOD는 함께 조정하되 운영 영향의 미검증 범위를 유지한다.

## 결함별 재현·수정 기준

### UI-5 · P1 · 이전 계정의 지연된 문서가 새 계정의 저장 전 기기 초안을 삭제함

- 위치: [lib/local-learning-drafts.ts:90](../lib/local-learning-drafts.ts)
- 조건: 같은 origin의 두 탭. A 인증으로 받은 SSR 문서를 지연시킨 사이 현재 인증이 B로 바뀌고 B가 실제 문법 입력을 기기에 보관한다. 이후 A 문서를 전달하여 hydration한다.
- 기대: 새로 mount하는 과거 owner는 현재 인증/소유권이 확인되기 전에 다른 owner의 기기 row를 제거하거나 owner marker를 되돌리지 않아야 한다.
- 실제: fresh 계정으로 두 차례(012/013) 동일 재현. B의 정상 기기 초안 row1/ownerB가 A mount 뒤 row0/ownerA로 바뀐다. 늦은 A의 state GET은401로 정상 차단되지만 기기 row는 이미 삭제되었다.
- 영향/근거 수준: 새 계정이 서버에 저장하지 못한 실제 입력의 기기 복구 사본을 잃는다. 다른 탭의 입력도 사라질 수 있는 데이터 보존 결함이다. 서버의 계정 격리를 우회해 타 계정 데이터를 읽은 증거는 아니다. 실제 built Chromium·합성 D1, fresh 계정 2회 재현(012/013)
- 최소 수정/회귀: 현재 인증 전환의 소유권을 검증한 세대/세션과 최초 연결을 연결한다. 늦은 문서의 mount만으로 다른 계정 row를 삭제할 수 없게 하고, 명시적으로 검증된 계정 전환·로그아웃의 이전 입력 정리 계약도 유지한다. marker를 단순히 항상 거절하는 변경은 정상 전환을 막을 수 있으므로 별도 검증한다. A 지연 문서→B 인증/실제 미저장 입력→A hydration 순서에서 B row와 입력을 보존하고 A 요청401을 유지한다. 반대 전환·정상 로그인·명시 로그아웃·stale retry·페이지 복원·두 계정 owner marker도 함께 확인한다.
- 제안 검사 가치: Value: protects=새로 mount하는 과거 owner는 현재 인증/소유권이 확인되기 전에 다른 owner의 기기 row를 제거하거나 owner marker를 되돌리지 ...; fails_when=fresh 계정으로 두 차례(012/013) 동일 재현. B의 정상 기기 초안 row1/ownerB가 A mount 뒤 row0/ownerA로 바뀐다. 늦은 A의 state GET은...; why_new=기존 통과 사례가 이 입력·완료 순서 조합을 놓쳤다.; seam=none
- 한계: 운영 SSO/쿠키 전환은 로컬 QA 인증 헤더로 모사했다. 서버 계정 격리 우회/타 계정 읽기 증거는 아니다. 010/011은 준비 단계 실패로 제외하며 012/013만 제품 재현 근거로 쓴다. 운영 SSO 화면/쿠키 전환 자체는 검사하지 않았다. 승인된 로컬 QA 인증 헤더로 서버의 인증 변경을 모사했다. 실제 브라우저가 증명한 것은 기기 row 삭제와 늦은 요청401이며 운영 발생 빈도나 모든 화면 메모리 상태의 최종 유실은 측정하지 않았다. 실기기·실제 제공자 호출은0이다.
- 근거: [functional/.qa-evidence/012/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/012/receipt.json), [functional/.qa-evidence/012/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/012/stdout), [functional/.qa-evidence/013/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/013/receipt.json), [functional/.qa-evidence/013/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/013/stdout), [browser/late-owner/chromium/result.json](../../../outputs/comprehensive-defect-audit-20261105/browser/late-owner/chromium/result.json), [browser/late-owner/chromium/stale-owner-blocked.png](../../../outputs/comprehensive-defect-audit-20261105/browser/late-owner/chromium/stale-owner-blocked.png), [browser/late-owner.cjs](../../../outputs/comprehensive-defect-audit-20261105/browser/late-owner.cjs), [agents/test-review/late-owner-review.json](../../../outputs/comprehensive-defect-audit-20261105/agents/test-review/late-owner-review.json)

### AI-6 · P1 · 문법 내 문장 수정·교정 되돌리기가 독립 복습 성적과 최근 점검 기록을 지움

- 위치: [lib/grammar/model.ts:109](../lib/grammar/model.ts), [lib/grammar/practice.ts:26](../lib/grammar/practice.ts), [app/grammar/grammar-lesson.tsx:74](../app/grammar/grammar-lesson.tsx), [db/learning-state.ts:56](../db/learning-state.ts)
- 조건: 완료한 수업의 예약 복습을 두 번 독립 성공한 뒤 내 문장 보완에서 수정하거나 AI 교정을 적용한다.
- 기대: 문장 자기점검을 갱신하더라도 별도로 측정한 객관식 재점검 결과·독립 성공/사용 세트 이력은 보존한다(GRAMMAR_PRACTICE_V2.md:18, FEEDBACK_RECHECK_AND_RECOVERY.md:9).
- 실제: v2/v3/v4 순수 함수·스키마 재현에 더해 built Chromium과 합성 D1에서도 문장 수정→원문 되돌리기→자기 점검·재완료 뒤 독립 복습 review/schedule이 삭제됐다. root007/014에서 같은 결과를 반복 확인했다.
- 영향/근거 수준: 정상 문장 보완 조작이 기존 학습 성과 기록을 삭제하고 복습 일정을 초기화한다. 일반 자동 저장은 grammar document를 교체하므로 저장 후 UI 되돌리기로 복구할 수 없다. 실제 운영 사용자 행은 조회하지 않았다. 실제 built Chromium·합성 D1 2회(007/014) + v2/v3/v4 순수 함수·스키마 2회
- 최소 수정/회귀: 새 문장의 자기점검 상태와 기존 독립 복습 이력을 분리하여 업데이트한다. completedAt 재검토 정책은 유지/명시하되 review/schedule 삭제를 문장 변경의 부수효과로 만들지 않는다. v2/v3/v4의2회 독립 성공→쓰기 열기→수동수정/AI적용/되돌리기→저장/재로드/재완료에서 최근 review·passed·used 보존. 새 자기점검은 요구. UI-4의 복구 시 completedAt/check 불일치와는 별도 경로.
- 제안 검사 가치: Value: protects=문장 자기점검을 갱신하더라도 별도로 측정한 객관식 재점검 결과·독립 성공/사용 세트 이력은 보존한다(GRAMMAR_PRACTICE...; fails_when=v2/v3/v4 순수 함수·스키마 재현에 더해 built Chromium과 합성 D1에서도 문장 수정→원문 되돌리기→자기 점검·재완료 뒤 ...; why_new=기존 통과 사례가 이 입력·완료 순서 조합을 놓쳤다.; seam=none
- 한계: v2/v3도 순수 함수·스키마로 검사했으며 실제 UI/D1 반복은 v4다. 운영 학습 행이나 실제 iPhone은 검사하지 않았다. 문장 자기 점검을 무효화하는 정상 요구와 독립 객관식 복습 성적의 삭제를 구분했다. review/schedule을 그대로 두고 completedAt만 지우는 변경도 현행 스키마를 위반할 수 있다.
- 근거: [agents/ai/evidence/.qa-evidence/008/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/008/stdout), [agents/ai/evidence/.qa-evidence/008/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/008/receipt.json), [agents/ai/evidence/.qa-evidence/009/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/009/stdout), [agents/ai/evidence/.qa-evidence/009/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/009/receipt.json), [functional/.qa-evidence/007/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/007/receipt.json), [functional/.qa-evidence/007/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/007/stdout), [functional/.qa-evidence/007/stderr](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/007/stderr), [functional/.qa-evidence/014/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/014/receipt.json)

### UI-3 · P2 · 최신 기록 GET 대기 중 받은 문법 입력이 snapshot 교체로 사라짐

- 위치: [app/use-learning-store.ts:52](../app/use-learning-store.ts), [app/grammar/grammar-writing.tsx:56](../app/grammar/grammar-writing.tsx), [app/grammar/use-grammar-draft.ts:43](../app/grammar/use-grammar-draft.ts), [app/use-learning-store.ts:41](../app/use-learning-store.ts), [app/learning-app.tsx:225](../app/learning-app.tsx), [app/learning-app.tsx:416](../app/learning-app.tsx)
- 조건: 브라우저 기기 보관을 거부한 합성 계정에서 문법 쓰기를 열고 revision 충돌을 만든다.; 최신 기록 불러오기를 승인하고 GET 응답을 보류한다. 닫힌 확인창 뒤의 문장 textarea에 새 입력을 쓴다.; GET을 성공시키면 current의 새 입력이 이전 서버 문장으로 교체되고 epoch가 증가한다.
- 기대: 재조회 확인을 누른 뒤에도 화면이 허용해 받은 새 입력은 보존하거나, 교체 중 입력을 명확히 잠가야 한다. 저장소 거부 시에도 화면 입력 보호가 필요하다.
- 실제: localStorage 거부→유효한 PUT409 응답 주입→사용자 최신 기록 불러오기 확인 뒤 실제 GET200을 지연했다. 그동안 새 입력을 수락했지만 GET 적용/epoch remount 뒤 재진입한 입력창·실제 D1·원래 native storage 모두 새 입력이 없었다(032/033).
- 영향/근거 수준: 재조회 전 변경을 교체한다는 승인 이후 새로 작성한 문장이 무음으로 유실된다. 브라우저 저장소 차단·용량 초과 조건에서 영구 유실이며, 일반 저장소에서도 서버 기준이 다른 숨은 변형으로만 남을 수 있다. 실제 built Chromium·합성 D1·기기 backing storage 반복 2회
- 최소 수정/회귀: snapshot 교체 중에 한정한 입력 잠금을 전달하거나, load 시작 뒤 발생한 grammar draft version을 감지해 안전하게 재조정한다. 일반 저장 중/실패 후 계속 편집하는 기존 동작은 유지한다. localStorage unavailable과 quota 초과 각각에서 지연된 최신 기록 GET 동안 입력을 시도한다. 입력이 잠기거나 응답 뒤에도 새 입력이 명시적으로 보존되는지, reload/restore epoch 이후까지 검증한다.
- 제안 검사 가치: Value: protects=재조회 확인을 누른 뒤에도 화면이 허용해 받은 새 입력은 보존하거나, 교체 중 입력을 명확히 잠가야 한다. 저장소 거...; fails_when=localStorage 거부→유효한 PUT409 응답 주입→사용자 최신 기록 불러오기 확인 뒤 실제 GET200을 지연했다. 그동안 새 입력을...; why_new=기존 통과 사례가 이 입력·완료 순서 조합을 놓쳤다.; seam=none
- 한계: 기기 저장 거부와 사용자가 명시적으로 확인한 최신 기록 재조회가 함께 필요한 조건이다. 확인 전 기존 입력의 폐기가 아니라 확인 뒤 새로 수락한 입력의 손실을 검사했다. 충돌409는 커밋 없이 현행 형식의 합성 응답을 주입했다. built 입력창·D1 seed/GET200·최종 D1/기기 관찰은 실제 로컬 경계다. 030/031은 재현 준비·화면 재진입 관찰이 끝나지 않은 시도이며 최종 증거는032/033이다. 운영 빈도·실기기는 미검증이다.
- 근거: [agents/ui/repro-hooks-result.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ui/repro-hooks-result.json), [functional/.qa-evidence/032/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/032/receipt.json), [functional/.qa-evidence/032/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/032/stdout), [functional/.qa-evidence/032/stderr](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/032/stderr), [functional/.qa-evidence/033/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/033/receipt.json), [functional/.qa-evidence/033/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/033/stdout), [functional/.qa-evidence/033/stderr](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/033/stderr)

### UI-1 · P2 · 다른 초안을 복구하면 이미 기록한 답 공개·도움 사용을 취소하고 독립 성공으로 바꿀 수 있음

- 위치: [app/study/use-study-draft.ts:33](../app/study/use-study-draft.ts), [app/use-persistent-input.ts:72](../app/use-persistent-input.ts), [app/study/recall-stage.tsx:63](../app/study/recall-stage.tsx), [app/study/use-study-session-controller.ts:111](../app/study/use-study-session-controller.ts), [app/study/use-study-session-controller.ts:131](../app/study/use-study-session-controller.ts), [docs/FEEDBACK_RECHECK_AND_RECOVERY.md:27](../docs/FEEDBACK_RECHECK_AND_RECOVERY.md)
- 조건: 합성 같은 회차/entry/en question을 두 탭에서 연다. A에 공개 전 입력 변형을 남긴다.; B에서 빈 답으로 정답을 공개해 hinted/revealed=true를 저장한다. 최신 snapshot을 연 탭에서 A의 다른 입력을 비교 후 복구한다.; 복구된 화면에서 정답을 적고 다시 공개한다. 도움 없는 성공 버튼이 활성화된다.
- 기대: 답을 이미 공개한 같은 question에서는 첫 답과 도움 사용을 보존해야 한다. 복구는 채점이나 회상 성과를 바꾸지 않아야 한다(복구 정책 및 RecallStage readOnly/hint gate).
- 실제: 실제 앱에서 답·도움을 공개한 뒤 이전 변형 초안을 선택하면 hinted/revealed가 false로 내려가 독립 성공 버튼이 활성화된다. 다음 저장의 실제 D1에서 en=independent, hintEn=false를 확인했다(025/026).
- 영향/근거 수준: 생각이 안 나서 답을 본 시도가 도움 없는 성공으로 기록되고 복습 필요 상태·첫 답 자료가 부정확해진다. warmup/en/ko 및 복구 되돌리기에도 같은 전체 값 교체 경계가 적용된다. 실제 built Chromium·합성 D1 반복 2회 + 제품 hook 경계 재현
- 최소 수정/회귀: 같은 question의 현재/서버 disclosure와 help를 단조롭게 보존하고, 이미 공개된 첫 답은 복구/되돌리기로 덮지 않는다. 편집 가능한 필드와 평가 증거 필드를 분리해 복구한다. 두 탭의 공개 전/후 변형 비교 복구와 복구 되돌리기를 수행한다. revealed/hint가 낮아지지 않고 원래 답이 보존되며 독립 성공이 잠긴 상태를 검증한다. 실제 React/브라우저와 저장 API까지 연결한다.
- 제안 검사 가치: Value: protects=답을 이미 공개한 같은 question에서는 첫 답과 도움 사용을 보존해야 한다. 복구는 채점이나 회상 성과를 바꾸지 않아야...; fails_when=실제 앱에서 답·도움을 공개한 뒤 이전 변형 초안을 선택하면 hinted/revealed가 false로 내려가 독립 성공 버튼이 활성화된...; why_new=기존 통과 사례가 이 입력·완료 순서 조합을 놓쳤다.; seam=none
- 한계: 운영 발생 빈도는 측정하지 않았다. 024는 저장 진행 중 다음 조작을 한 재현 준비 실패이며 근거에서 제외했다.
- 근거: [agents/ui/repro-hooks-result.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ui/repro-hooks-result.json), [functional/.qa-evidence/025/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/025/receipt.json), [functional/.qa-evidence/025/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/025/stdout), [functional/.qa-evidence/025/stderr](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/025/stderr), [functional/.qa-evidence/026/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/026/receipt.json), [functional/.qa-evidence/026/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/026/stdout), [functional/.qa-evidence/026/stderr](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/026/stderr)

### UI-2 · P2 · 문장 완료 후 성공한 초안이 정리되지 않아 정상 학습21건으로 기기 복구 한도20개가 가득 참

- 위치: [app/use-persistent-input.ts:59](../app/use-persistent-input.ts), [app/use-persistent-input.ts:26](../app/use-persistent-input.ts), [app/use-persistent-input.ts:57](../app/use-persistent-input.ts), [app/study/use-study-draft.ts:33](../app/study/use-study-draft.ts), [lib/local-learning-drafts.ts:151](../lib/local-learning-drafts.ts)
- 조건: 합성 계정에서 sentence 단계 입력을 한 뒤 문장을 완성하고 저장 성공을 기다린다.; 다음 회차/다음 question에서 같은 흐름을21회 반복한다.; local draft store에는 완료 question의20개 row가 남고 21번째 기기 보관은 capacity로 거절된다.
- 기대: 실제 승인된 snapshot과 일치하는 해당 초안은 저장 성공 뒤 정리하고, 실패한 입력/다른 탭의 변형은 남겨야 한다.
- 실제: 정상 practice 문장 세션21항목을 실제 앱에서 차례로 완료·저장했다. 합성 D1에21개 완료 문장이 있어도 기기에는 이전 완료 초안20개가 남고 새 복구 row 저장이 capacity로 차단됐다(028/029).
- 영향/근거 수준: 기본3단어씩7일이면 정상 저장 이력만으로 새 문장·회상·AI 요청 UUID의 기기 보관이 막힐 수 있다. 완료 question은 UI에서 다시 편집할 수 없어 개별 복구 정리도 어렵고, 설정의 전체 삭제는 실제 미저장 입력/요청 정보까지 함께 지운다. 실제 built Chromium·합성 D1에서 정상 저장21건/잔여 초안20개/한도 거절 2회
- 최소 수정/회귀: 저장 시 전송한 question/instance/draft 지문을 승인 응답까지 유지해 성공한 정확한 row를 정리한다. 다음 질문으로 이동한 뒤에도 처리하되 실패·더 최신 입력·다른 탭의 다른 변형은 삭제하지 않는다. 성공→question 전환은 row 제거, 실패→전환은 row 유지, 늦은 성공→더 최신 변형 유지,20개 초과 정상 완료 후 새 draft/AI UUID 저장 가능을 실제 hook/브라우저로 확인한다.
- 제안 검사 가치: Value: protects=실제 승인된 snapshot과 일치하는 해당 초안은 저장 성공 뒤 정리하고, 실패한 입력/다른 탭의 변형은 남겨야 한다.; fails_when=정상 practice 문장 세션21항목을 실제 앱에서 차례로 완료·저장했다. 합성 D1에21개 완료 문장이 있어도 기기에는 이전 ...; why_new=기존 통과 사례가 이 입력·완료 순서 조합을 놓쳤다.; seam=none
- 한계: 일일 목표20 제한을 넘긴 daily 세션이 아니라 스키마가 허용하는 practice 세션21개를 사용했다. 027은 안내문 두 개를 고유 선택하지 못한 재현 준비 오류이며 제품 근거에서 제외했다. 운영 장기 발생 빈도는 미측정이다.
- 근거: [agents/ui/repro-hooks-result.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ui/repro-hooks-result.json), [functional/.qa-evidence/028/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/028/receipt.json), [functional/.qa-evidence/028/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/028/stdout), [functional/.qa-evidence/028/stderr](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/028/stderr), [functional/.qa-evidence/029/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/029/receipt.json), [functional/.qa-evidence/029/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/029/stdout), [functional/.qa-evidence/029/stderr](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/029/stderr)

### UI-4 · P2 · 완료 수업에 미완료 문장 초안을 복구하면 완료일과 자기 점검이 모순되어 자동 저장이 거절됨

- 위치: [app/grammar/use-grammar-draft.ts:83](../app/grammar/use-grammar-draft.ts), [app/grammar/grammar-summary.tsx:41](../app/grammar/grammar-summary.tsx), [lib/grammar/model.ts:106](../lib/grammar/model.ts), [lib/grammar/model.ts:47](../lib/grammar/model.ts)
- 조건: 합성 완료 문법 수업에서 내 문장 보완을 눌러 stage5에 진입한다.; 같은 lesson/contentVersion/쓰기 question의 다른 탭에 남은 미완료 문장 변형(check 없음)을 비교 후 복구한다.; 복구 snapshot을 제품 grammarProgressSchema로 확인하면 문장과 자기 점검 오류가 발생한다.
- 기대: 유효한 쓰기 초안을 선택하면 저장 가능한 grammar progress가 되어야 한다. 문장 변경은 정상 updateGrammarSentence의 완료/자기점검 재확인 계약과 일치해야 한다.
- 실제: 완료 수업에서 내 문장 보완을 연 뒤 미완료 문장 초안을 선택하면 completedAt은 유지되고 check/checks는 사라진다. 실제 built 앱의 자동 저장이400으로 거절됐다(008/015).
- 영향/근거 수준: 복구 직후 자동 저장400 및 나가기 flush 실패가 발생한다. 수업 재확인 정보가 모순되고, 사용자가 자기 점검을 다시 채우거나 문장을 재편집하기 전에는 정상 저장/이동을 할 수 없다. 실제 built Chromium·합성 D1에서 autosave400 반복 2회 + 스키마 대조
- 최소 수정/회귀: AI-6의 독립 객관식 review/schedule 보존 규칙을 먼저 수정한 공통 문장 변경 경계를 사용하고 복구 가능한 frame/check 필드를 적용한다. 현행 updateGrammarSentence를 그대로 호출하면 AI-6 삭제 결함을 도입하므로 무조건 재사용하지 않는다. 최초 답·독립 복습 성적은 보존하면서 쓰기 자기 점검과 완료 상태를 schema에 맞게 처리한다. 완료 수업→쓰기 보완에서 다른 탭의 sentence-only draft를 복구하고 autosave/leave 성공과 schema validity를 확인한다. AI-6의 두 차례 독립 성공·최근 재점검·예약 세트가 복구/보완/재완료 뒤 보존되는지 함께 검증한다. 같은 문장·자기점검 포함 변형 및 신규 수업 복구도 비교한다.
- 제안 검사 가치: Value: protects=유효한 쓰기 초안을 선택하면 저장 가능한 grammar progress가 되어야 한다. 문장 변경은 정상 updateGrammarSentence의 완료/자기...; fails_when=완료 수업에서 내 문장 보완을 연 뒤 미완료 문장 초안을 선택하면 completedAt은 유지되고 check/checks는 사라진다. 실제 bui...; why_new=기존 통과 사례가 이 입력·완료 순서 조합을 놓쳤다.; seam=none
- 한계: 현행 updateGrammarSentence를 그대로 재사용하면 AI-6의 독립 복습 이력 삭제를 도입한다. AI-6의 올바른 공통 전이 수정이 선행해야 한다. 실제 유료 모델·운영 DB·실기기는 사용하지 않았다.
- 근거: [agents/ui/repro-hooks-result.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ui/repro-hooks-result.json), [functional/.qa-evidence/008/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/008/receipt.json), [functional/.qa-evidence/008/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/008/stdout), [functional/.qa-evidence/008/stderr](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/008/stderr), [functional/.qa-evidence/015/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/015/receipt.json), [functional/.qa-evidence/015/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/015/stdout), [functional/.qa-evidence/015/stderr](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/015/stderr)

### AI-1 · P2 · 앞뒤 공백이 있는 문법 v5 의견을 받은 뒤 진도 저장이 거절됨

- 위치: [lib/grammar/model.ts:50](../lib/grammar/model.ts), [lib/grammar/feedback-input.ts:8](../lib/grammar/feedback-input.ts), [app/grammar/use-grammar-feedback.ts:63](../app/grammar/use-grammar-feedback.ts)
- 조건: 문법 쓰기에 앞뒤 공백이 있는 문장을 저장하고 v5 AI 참고 의견을 요청한다.
- 기대: 요청 수락과 저장의 원문 동일성 규칙을 일치시켜 원문 공백을 보존하면서 해당 정상 의견을 저장한다.
- 실제: 앞뒤 공백이 있는 원문은 입력창에 그대로 남고 정상 형식의 주입 의견 original은 trim된다. UI는 의견을 수락하지만 실제 진도 자동 저장은 원문 불일치로400이 됐다(009/016).
- 영향/근거 수준: 의견을 받은 뒤 자동 저장·다시 저장이 실패하고 학습 진행/이동이 막힐 수 있다. 실제 운영 발생 횟수는 확인하지 않았다. 실제 built Chromium·합성 D1·현행 모의 OpenAI 응답 반복 2회
- 최소 수정/회귀: 공용 원문 일치 정책을 진도 검증에도 적용하거나 저장 전에 허용된 표현 차이를 일관되게 처리한다. 임의 내부 공백/다른 문장 허용은 금지한다. SPACE/TAB+LF/NBSP 원문→실제 생성 파서→복구→grammarState/saveSchema 및 저장 성공까지 확인. 내부 공백/다른 문장은 계속 거절. structured-v1 raw 원문은 보존.
- 제안 검사 가치: Value: protects=요청 수락과 저장의 원문 동일성 규칙을 일치시켜 원문 공백을 보존하면서 해당 정상 의견을 저장한다.; fails_when=앞뒤 공백이 있는 원문은 입력창에 그대로 남고 정상 형식의 주입 의견 original은 trim된다. UI는 의견을 수락하지만 실제...; why_new=기존 통과 사례가 이 입력·완료 순서 조합을 놓쳤다.; seam=none
- 한계: OpenAI 응답은 현재 계약에 맞춘 모의 응답이다. 실제 유료 모델 품질·운영 저장은 검사하지 않았다.
- 근거: [agents/ai/evidence/.qa-evidence/001/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/001/stdout), [agents/ai/evidence/.qa-evidence/001/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/001/receipt.json), [agents/ai/evidence/.qa-evidence/002/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/002/stdout), [agents/ai/evidence/.qa-evidence/002/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/002/receipt.json), [agents/ai/evidence/.qa-evidence/003/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/003/stdout), [agents/ai/evidence/.qa-evidence/003/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/003/receipt.json), [agents/ai/evidence/.qa-evidence/004/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/004/stdout), [agents/ai/evidence/.qa-evidence/004/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/004/receipt.json)

### AI-2 · P2 · 이전 요청 조회의 일시적 오류가 pending UUID를 버려 다음 클릭에서 새 요청을 만듦

- 위치: [lib/feedback-recovery-response.ts:21](../lib/feedback-recovery-response.ts), [lib/recoverable-feedback.ts:41](../lib/recoverable-feedback.ts), [app/api/feedback-requests/[id]/route.ts:18](../app/api/feedback-requests/[id]/route.ts)
- 조건: AI POST 응답이 유실된 뒤 이전 결과 GET 중 DB 일시 장애 등으로 receipt 없는 503을 받는다.
- 기대: GET 자체 실패와 영수증이 확인한 failed/expired/unknown을 구분한다. 일시적 조회 실패에는 pending UUID를 유지해 다음 클릭도 조회한다.
- 실제: 첫 POST send1 → 조회503/receipt없음 → 로컬 pending을 failed로 변경 → 다음 명시 클릭은 기존 UUID 조회 대신 다른 UUID로 send2. 실제 GET route의 주입 DB 오류도 동일503/receipt없음을 생성한다.
- 영향/근거 수준: 기존 원요청이 서버에서 진행/완료 중이어도 새 UUID가 생성되어 중복 제공자 요청·비용의 가능성이 생긴다. 증거는 합성 send2회이며 실제 과금이나 운영 중복 호출을 입증한 것은 아니다. 실제 복구 경계 오프라인 재현 2회 + 실제 GET route의 합성 DB 오류503 연결
- 최소 수정/회귀: 유효한 동일 UUID 영수증의 명시적 종결 상태만 acknowledge한다. 인증/서비스/게이트웨이 오류와 receipt 없는 응답은 pending 유지. 새 비용 안내를 해당 상태와 일치시킨다. 응답 유실→실제 GET503/receipt없음→다음 명시 클릭은 같은 UUID GET이며 새 POST가 없어야 한다. 502/429는 파서 경계에서 pending UUID 보존을 확인한다. 401은 인증 UI의 재요청 차단을 별도 확인하고 같은 추가 전송 도달성으로 해석하지 않는다. 명시 failed/unknown/expired/invalidated 영수증 계약은 유지한다.
- 제안 검사 가치: Value: protects=GET 자체 실패와 영수증이 확인한 failed/expired/unknown을 구분한다. 일시적 조회 실패에는 pending UUID를 유지해 다음 클릭도 ...; fails_when=첫 POST send1 → 조회503/receipt없음 → 로컬 pending을 failed로 변경 → 다음 명시 클릭은 기존 UUID 조회 대신 다른 UUID로 send2....; why_new=기존 통과 사례가 이 입력·완료 순서 조합을 놓쳤다.; seam=none
- 한계: 실제로 연결한 오류는 DB 일시 장애의 receipt 없는503이다. 401에서는 인증 UI가 다음 요청을 막을 수 있으므로 같은 사용자 도달성/추가 전송을 주장하지 않는다. 502/429 등은 복구 파서의 같은 분류 경로에 대한 후속 회귀 제안이다. 실제 과금·운영 중복 호출은 입증하지 않았다.
- 근거: [agents/ai/evidence/.qa-evidence/001/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/001/stdout), [agents/ai/evidence/.qa-evidence/001/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/001/receipt.json), [agents/ai/evidence/.qa-evidence/002/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/002/stdout), [agents/ai/evidence/.qa-evidence/002/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/002/receipt.json), [agents/ai/evidence/.qa-evidence/003/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/003/stdout), [agents/ai/evidence/.qa-evidence/003/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/003/receipt.json), [agents/ai/evidence/.qa-evidence/004/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/004/stdout), [agents/ai/evidence/.qa-evidence/004/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/004/receipt.json)

### DATA-1 · P2 · 본문 한도 안의 비정상 저장 컬렉션이 제한된 로컬 workerd를 메모리 고갈로 종료시킴

- 위치: [app/api/state/route.ts:66](../app/api/state/route.ts), [app/api/state/route.ts:73](../app/api/state/route.ts), [lib/state-data-keys.ts:12](../lib/state-data-keys.ts), [lib/state-shape.ts:40](../lib/state-shape.ts), [lib/backup-structure.ts:9](../lib/backup-structure.ts), [lib/backup.ts:42](../lib/backup.ts), [lib/restore-validation.ts:25](../lib/restore-validation.ts)
- 조건: 기존 합성 resource-probe.cjs의 huge 모드: 인증 경계는 합성 소유자로 고정하고 DB 경계는 접근 시 예외 처리한 실제 PUT /api/state 번들. 첫 카탈로그 항목의 studyDates에 숫자 800000개를 담은 요청은 1600077바이트로 1800000바이트 상한 이하다.
- 기대: 컬렉션 개수/구조를 과도한 열거·스키마 항목별 파싱·오류 할당 이전에 제한하여 정상적인400을 반환한다.
- 실제: 기존 프로젝트 heap-limit.cjs를 적용한 독립 Miniflare/workerd(old space96MB, semi space4MB)에서 JavaScript heap out of memory fatal 및 TypeError: fetch failed. 원장 capture004의 producer는 complete, 자식 exit2, timeout 아님. 같은 Worker 경계에서 숫자10개(97B)와240000개(480077B)의 저장은400, 직접 복원240000개(480144B)도 구조 한도 오류400이었다.
- 영향/근거 수준: 로컬 합성 조건에서는 인증된 비정상 요청 하나가 해당 전용 workerd 프로세스를 종료시켰다. 운영128MB isolate의 실패 여부·다른 계정에 대한 영향·반복 가능성은 검증하지 않았다. 데이터 쓰기는 해당 경로에서 검증 뒤에만 수행되며 이 재현에는 운영DB나 실제DB 바인딩이 없다. 제한된 전용 로컬 Miniflare/workerd 실패 1회 + 작은 요청 대조; 추가 부하 재현 중단
- 최소 수정/회귀: 저장 경계에도 최대 컬렉션 수를 전체 항목 열거/스키마 파싱 전에 확인하는 제한을 적용하고, 스키마별 더 작은 한도도 선행 검사한다. 크기 제한을 단순히 늘리지 않는다. 구현·테스트 파일 변경은 이번 보고 범위 밖이다. 후속 격리 검증에서 잘못된 대형 컬렉션이 400으로 끝나고 Worker가 살아 있으며 DB/revision이 변하지 않는지 검증한다. 유효 경계·예약 뜻 키·복원 호환성도 보존한다.
- 제안 검사 가치: Value: protects=컬렉션 개수/구조를 과도한 열거·스키마 항목별 파싱·오류 할당 이전에 제한하여 정상적인400을 반환한다.; fails_when=기존 프로젝트 heap-limit.cjs를 적용한 독립 Miniflare/workerd(old space96MB, semi space4MB)에서 JavaScript heap out of memory fatal 및 TypeErro...; why_new=기존 통과 사례가 이 입력·완료 순서 조합을 놓쳤다.; seam=none
- 한계: old-space96MB/semi-space4MB 전용 로컬 Worker의 fatal1회다. 운영128MB isolate의 재현성·전역 장애·다른 계정 영향은 미검증이다. Object.entries 열거와 Zod 항목별 파싱/오류 할당 중 정확한 fatal 단계는 계측하지 않았다. DEP-ZOD를 확정 직접 원인으로 귀속하지 않는다. 보안 우려가 제기돼 첫 로컬 실패 뒤 추가 비정상 대형 입력·메모리 고갈 검사를 중단했다. 실제 도구의 자동 거절 원문은 확인되지 않아 도구가 차단했다고 단정하지 않는다. 기존 정상 백업 성능 회귀와 구분한다.
- 근거: [agents/data/.qa-evidence/001/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/data/.qa-evidence/001/receipt.json), [agents/data/.qa-evidence/001/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/data/.qa-evidence/001/stdout), [agents/data/.qa-evidence/002/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/data/.qa-evidence/002/receipt.json), [agents/data/.qa-evidence/002/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/data/.qa-evidence/002/stdout), [agents/data/.qa-evidence/003/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/data/.qa-evidence/003/receipt.json), [agents/data/.qa-evidence/003/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/data/.qa-evidence/003/stdout), [agents/data/.qa-evidence/004/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/data/.qa-evidence/004/receipt.json), [agents/data/.qa-evidence/004/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/data/.qa-evidence/004/stdout)

### DOCS-1 · P2 · README가 현재 복구 지침으로 안내하는 문서가 효력 없는 옛 AI 차단 스위치를 지시함

- 위치: [AI_SENTENCE_STRUCTURE.md:54](../AI_SENTENCE_STRUCTURE.md)
- 조건: README.md:109의 ‘저장·구형 호환·복구 지침’ 링크를 따라 AI_SENTENCE_STRUCTURE.md를 읽고, 장애 시 문서:54의 google_ai_enabled=false만 적용한다. 이번 감사에서는 환경 변경·재게시·실제 호출을 수행하지 않았다.
- 기대: README에서 직접 연결하는 복구 지침은 현행 스위치 ai_feedback_enabled=false를 안내하거나 과거 구조 기능 이력임을 명시하고 현행 복구 문서로 연결해야 한다. 새 OpenAI 기록과 호환되는 reader/백업 보호도 유지해야 한다.
- 실제: 문서:54는 google_ai_enabled=false를 AI 요청 중단 방법으로 지시한다. 문서 첫머리나 복구 절에는 과거 기록 경고 또는 현행 OpenAI 복구 문서로의 재지정이 없다. 현재 sentence route:21은 env.ai_feedback_enabled만 검사하고 grammar route:38도 grammar_enabled 및 ai_feedback_enabled를 검사한다. 현행 docs/OPENAI_FEEDBACK.md:50은 ai_feedback_enabled=false를 명시한다.
- 영향/근거 수준: 이 문서를 운영 장애 대응 절차로 따르면 옛 플래그를 꺼도 현재 OpenAI 요청 허용 상태가 유지될 수 있다. 호출 중단과 비용·장애 확산 대응이 지연된다. 실제 운영자가 이 절차를 실행했거나 추가 비용이 발생했다는 증거는 없다. README 링크·복구 원문·현재 두 AI route 조건의 직접 정적 대조
- 최소 수정/회귀: 문서 첫머리에 보존 이력 범위를 밝히고 현행 docs/OPENAI_FEEDBACK.md 및 FEEDBACK_RECHECK_AND_RECOVERY.md로 연결한다. 복구 절의 차단 스위치는 ai_feedback_enabled=false로 명확히 갱신하고, README는 현재 복구와 과거 구조 저장 계약을 구분하여 연결한다. README의 현행 실행/복구 링크를 따라 현재 AI 스위치 및 호환 reader 유지 지시가 실제 route/운영 문서와 일치하는지 확인한다.
- 제안 검사 가치: Value: protects=README에서 직접 연결하는 복구 지침은 현행 스위치 ai_feedback_enabled=false를 안내하거나 과거 구조 기능 이력임을 명시하...; fails_when=문서:54는 google_ai_enabled=false를 AI 요청 중단 방법으로 지시한다. 문서 첫머리나 복구 절에는 과거 기록 경고 또는 현행 O...; why_new=기존 통과 사례가 이 입력·완료 순서 조합을 놓쳤다.; seam=none
- 한계: 현재 안내와 현재 route 조건의 직접 모순이다. 실제 운영 토글·배포·추가 비용 발생은 관찰하지 않았다. 과거 릴리스의 시점 차이 자체는 결함으로 세지 않았다.
- 근거: [agents/docs/static-evidence.json](../../../outputs/comprehensive-defect-audit-20261105/agents/docs/static-evidence.json)

### OPS-1 · P2 · 공식 공개자료 재생성이 최근 수정한 OpenAI 전송정책 안내를 Google/Groq 자동전환 안내로 되돌림

- 위치: [scripts/prepare-attribution.py:72](../scripts/prepare-attribution.py)
- 조건: OPERATIONS.md:341의 공식 생성 순서에서 기존 scripts/prepare-attribution.py를 실행하는 정상 유지보수 경로. 이번 감사에서는 실행하지 않았다.
- 기대: 출력과 생성기 양쪽의 현재 전송정책이 일치해 문서화된 재생성이 수정사항을 보존해야 한다.
- 실제: 현재 public/sources/content-attribution.txt:60~63은 OpenAI Responses 전용/명시 요청/Google·Groq 자동전환 없음이다. 생성기 credits:72~75는 Google 우선, 실패 시 Groq 자동전환, 두 서비스 Free 계정을 안내하고:77에서 같은 공개파일에 무조건 write_text한다. 상위 운영문서:341/:565가 이 생성기를 계속 안내한다.
- 영향/근거 수준: 다음 교재/표현 재생성 시 사용자가 실제 전송 대상과 실패 시 동작을 잘못 안내받는다. 현재 배포파일 자체가 이미 잘못됐다고 주장하지 않는다. 생성 템플릿·현재 공개 산출물·공식 실행 안내의 직접 정적 대조
- 최소 수정/회귀: 생성기 문구를 현재 공개 산출물/정책과 동기화하고 동일 안내를 한 관리 원본에서 만들도록 한다. 관련 변경은 이번 보고에서 구현하지 않았다. 합성 임시 경로에서 생성한 공개 안내가 OpenAI Responses/명시 요청/자동전환없음을 유지하는 회귀 검사.
- 제안 검사 가치: Value: protects=출력과 생성기 양쪽의 현재 전송정책이 일치해 문서화된 재생성이 수정사항을 보존해야 한다.; fails_when=현재 public/sources/content-attribution.txt:60~63은 OpenAI Responses 전용/명시 요청/Google·Groq 자동전환 없음이다. 생성기 credits:72~75...; why_new=기존 통과 사례가 이 입력·완료 순서 조합을 놓쳤다.; seam=none
- 한계: 현재 배포 공개 파일 자체는 올바르다. 공식 재생성 경로의 회귀 가능성을 원문으로 확인했으며 생성기를 이번에 실행하지 않았다.
- 근거: [agents/operations/static-evidence.json](../../../outputs/comprehensive-defect-audit-20261105/agents/operations/static-evidence.json)

### AI-3 · P2 · 작은 동사 허용 목록에 없는 정상 명령문을 앱이 강제 보류함

- 위치: [lib/judgment-input.ts:3](../lib/judgment-input.ts), [lib/judgment-input.ts:11](../lib/judgment-input.ts), [lib/judgment-feedback-contract.ts:59](../lib/judgment-feedback-contract.ts)
- 조건: 기본 일반 문장 형식에서 Cook./Dance./Jump./Sing./Swim. 등의 한 단어 명령문을 요청한다.
- 기대: 실제 명령문은 유효하다는 결정표 계약을 지킨다. 제한된 목록에 없다는 사실만으로 미완성 문장이라고 확정하지 않는다.
- 실제: 주입 wire는 natural·원문 유지지만 앱이 single_fragment로 판단하여 목표/문법을 모두 uncertain·교정비움으로 바꾼다. 같은 Cook!나 명시command 형식은 통과한다.
- 영향/근거 수준: 정상 입력의 응답이 앱 후처리에서 잘못 보류되고 필요 없는 문맥 요구·재요청을 유발한다. 실제 모델이 보류했다고 해석해서는 안 된다. 실제 입력·판정 파서에 고정 wire 주입, 오프라인 2회
- 최소 수정/회귀: 불완전함이 확인된 제한 패턴만 독립 보류하고 나머지는 모델 판단/명시 문맥에 맡긴다. 단순 목록 확장만으로 모든 명령문을 지원했다고 주장하지 않는다. 동일한 natural wire로 Cook./Cook!/Go./Stop.와 command 형식을 비교하고 명사 단편의 필요한 보류도 유지한다.
- 제안 검사 가치: Value: protects=실제 명령문은 유효하다는 결정표 계약을 지킨다. 제한된 목록에 없다는 사실만으로 미완성 문장이라고 확정하지 않...; fails_when=주입 wire는 natural·원문 유지지만 앱이 single_fragment로 판단하여 목표/문법을 모두 uncertain·교정비움으로 바꾼다. 같은 Co...; why_new=기존 통과 사례가 이 입력·완료 순서 조합을 놓쳤다.; seam=none
- 한계: 잘못된 보류는 고정된 natural wire를 앱이 바꾼 결과다. 실제 모델 품질·오류 빈도나 모든 명령문 지식의 완전성을 평가한 결과가 아니다.
- 근거: [agents/ai/evidence/.qa-evidence/003/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/003/stdout), [agents/ai/evidence/.qa-evidence/003/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/003/receipt.json), [agents/ai/evidence/.qa-evidence/004/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/004/stdout), [agents/ai/evidence/.qa-evidence/004/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/004/receipt.json)

### AI-4 · P2 · 평서문을 의문문으로 바꾸는 교정이 발화행위 보호를 통과함

- 위치: [lib/judgment-correction.ts:49](../lib/judgment-correction.ts), [lib/judgment-feedback-contract.ts:72](../lib/judgment-feedback-contract.ts)
- 조건: needs_work 주입 응답이 "She like tea."를 "Does she like tea?"로 바꾼다.
- 기대: 문법 교정이 질문/진술의 의도를 바꾸지 않도록 두 방향의 명백한 변화를 보호한다.
- 실제: correctionConflict는 undefined이고 parseJudgmentFeedback가 제안을 반환한다. "She is happy."→"Is she happy?"도 통과한다. 반대 방향 ? 삭제는 speech_act로 거절한다.
- 영향/근거 수준: 이 조건의 잘못된 제공자 응답이 교정 제안으로 노출될 수 있다. 실제 모델 오류 빈도나 사용자 적용은 측정하지 않았다. 실제 교정 guard·판정 파서에 고정 wire 주입, 오프라인 2회
- 최소 수정/회귀: 질문 여부·명령/진술의 명백한 변화를 대칭적으로 비교하고 의도 불명인 변환은 보류한다. 의문문 원문의 필요한 어순 수정은 허용한다. 평서→의문·의문→평서 모두 거절; 잘못된 의문 어순→동일 의문 의미의 수정 통과.
- 제안 검사 가치: Value: protects=문법 교정이 질문/진술의 의도를 바꾸지 않도록 두 방향의 명백한 변화를 보호한다.; fails_when=correctionConflict는 undefined이고 parseJudgmentFeedback가 제안을 반환한다. "She is happy."→"Is she happy?"도 통과한다. 반대 방향 ? 삭...; why_new=기존 통과 사례가 이 입력·완료 순서 조합을 놓쳤다.; seam=none
- 한계: 의도 변경을 가진 합성 응답이 guard를 통과함을 보였다. 실제 제공자의 해당 오류 발생 빈도·사용자 적용은 미측정이다.
- 근거: [agents/ai/evidence/.qa-evidence/003/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/003/stdout), [agents/ai/evidence/.qa-evidence/003/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/003/receipt.json), [agents/ai/evidence/.qa-evidence/004/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/004/stdout), [agents/ai/evidence/.qa-evidence/004/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/004/receipt.json)

### AI-5 · P2 · 수량·부정을 집계만 비교해 대상·절 연결이나 음수 부호 변경을 놓침

- 위치: [lib/judgment-correction.ts:5](../lib/judgment-correction.ts), [lib/judgment-correction.ts:10](../lib/judgment-correction.ts), [lib/judgment-correction.ts:39](../lib/judgment-correction.ts)
- 조건: 잘못된 제공자 교정이 같은 숫자/부정 개수를 유지하면서 의미 연결을 바꾼다.
- 기대: 보호한다고 명시한 수량/부정이 원래 대상·절에 연결되어 있는지 확인하고 부호를 보존한다. 동등성 근거가 부족한 교정은 보류한다.
- 실제: "She have 2 red bags and 3 blue bags."→"She has 3 red bags and 2 blue bags." 통과(영어 two/three도 동일). "She do not like tea but likes coffee."→"She likes tea but does not like coffee." 통과. -5→5도 통과한다.
- 영향/근거 수준: 수량 배정·긍정/부정 대상·음수 값이 달라진 잘못된 응답을 교정으로 반환할 수 있다. 일반 의미동등성 전체 보장을 요구하는 finding이 아니라 명백한 집계 손실 사례다. 실제 교정 guard·판정 파서 고정 wire 및 의미 연결 대조, 오프라인 반복
- 최소 수정/회귀: 기존 내용어 순서를 보존하는 현재 정책에 맞추어 수량의 순서/부호 및 부정의 인접 절·내용어 앵커를 함께 비교한다. 안전한 한정 변환만 예외로 허용한다. 수량 재배치·부호삭제·절간 부정이동 거절; 같은 절에서 does 수일치 교정은 허용. 기존 숫자 크기 변경·부정삭제 거절은 유지.
- 제안 검사 가치: Value: protects=보호한다고 명시한 수량/부정이 원래 대상·절에 연결되어 있는지 확인하고 부호를 보존한다. 동등성 근거가 부족한 ...; fails_when="She have 2 red bags and 3 blue bags."→"She has 3 red bags and 2 blue bags." 통과(영어 two/three도 동일). "She do not like tea but likes coffee."→...; why_new=기존 통과 사례가 이 입력·완료 순서 조합을 놓쳤다.; seam=none
- 한계: 합성 응답의 명백한 수량/부정 연결 손실을 확인했다. 일반 의미 동등성 전체 보장이나 실제 모델 오류 빈도에 대한 주장이 아니다.
- 근거: [agents/ai/evidence/.qa-evidence/003/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/003/stdout), [agents/ai/evidence/.qa-evidence/003/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/003/receipt.json), [agents/ai/evidence/.qa-evidence/004/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/004/stdout), [agents/ai/evidence/.qa-evidence/004/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/004/receipt.json), [agents/ai/evidence/.qa-evidence/006/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/006/stdout), [agents/ai/evidence/.qa-evidence/006/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/006/receipt.json), [agents/ai/evidence/.qa-evidence/007/stdout](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/007/stdout), [agents/ai/evidence/.qa-evidence/007/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/.qa-evidence/007/receipt.json)

### DASH-1 · P2 · 실시간 새로고침이 registry의 새 플랜·라벨·이력 예산 변경을 반영하지 못함

- 위치: [.taskmaster/dashboard/dashboard.js:244](../.taskmaster/dashboard/dashboard.js)
- 조건: 열린 대시보드를 유지한 채 dashboard-plans.json에 유효한 새 플랜을 등록하거나 기존 entry.label/context/budget을 갱신하고 자동poll/지금 새로고침을 사용한다. 이번에는 실제 원본 변경이나 새 플랜을 생성하지 않았다.
- 기대: 현재 선택은 유지하더라도 registry의 플랜 목록/라벨/현재·이력 문맥·예산은 최신 응답을 반영해야 한다.
- 실제: catalog는:14의 const로 최초 HTML 자료에서만 고정된다. refresh는:244에서 planSnapshots만 교체하고 envelope.catalog는 적용하지 않는다. 선택버튼과 switchPlan 허용 목록은:43~62의 옛 catalog를 계속 쓴다. 또한 openai-dashboard-data.mjs:78의 source.hash는 rawTasks/rawManifest만 포함해 registry-only 변경에는 hash가 그대로이고:246의 renderPlans 등도 생략된다. 실제 브라우저에서도 유효한 새4번째 플랜 응답과 변경된 원본 hash를 받아도 선택지는3개였다. registry-only hash 미반영은 정적 확인 범위다.
- 영향/근거 수준: 새 플랜이 API의 planSnapshots에 있어도 기존 화면에서 선택할 수 없고, 기존 이력 예산/문맥 수정도 최근 확인 시각만 바뀐 채 옛 문구가 남을 수 있다. 브라우저 전체 다시 열기는 우회이며 앱의 지금 새로고침 자체는 이를 해결하지 못한다. 실제 대시보드 JS/normalizer + 정상 모의 응답·지연 응답, built Chromium 반복 2회
- 최소 수정/회귀: catalog를 갱신 가능한 상태로 두고 매 응답에서 검증·적용하며 registry 또는 정규화된 표시 데이터도 변경 지문에 포함한다. registry 변경 때 플랜 버튼/문맥/예산을 다시 그린다. 기존 다중플랜 fixture에 유효한 새 플랜 추가 및 registry-only label/budget 변경을 적용한 뒤 새로고침/자동갱신에서 표시·선택·기존이력 보존 확인.
- 제안 검사 가치: Value: protects=현재 선택은 유지하더라도 registry의 플랜 목록/라벨/현재·이력 문맥·예산은 최신 응답을 반영해야 한다.; fails_when=catalog는:14의 const로 최초 HTML 자료에서만 고정된다. refresh는:244에서 planSnapshots만 교체하고 envelope.catalog는 적용하지 않...; why_new=기존 통과 사례가 이 입력·완료 순서 조합을 놓쳤다.; seam=none
- 한계: 자체 루프백 서버와 메모리 응답을 사용했다. 기존4318·실제 Task Master/registry 원본은 수정하지 않았다. 현재 원본이 이미 혼합됐다는 주장이 아니다.
- 근거: [agents/dashboard/static-evidence.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dashboard/static-evidence.json), [functional/.qa-evidence/034/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/034/receipt.json), [functional/.qa-evidence/034/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/034/stdout), [functional/.qa-evidence/034/stderr](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/034/stderr), [functional/.qa-evidence/035/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/035/receipt.json), [functional/.qa-evidence/035/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/035/stdout), [functional/.qa-evidence/035/stderr](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/035/stderr)

### DASH-2 · P2 · JSON 사본을 가져온 뒤 먼저 시작한 원본 조회 응답이 사본을 덮고 live 모드로 되돌림

- 위치: [.taskmaster/dashboard/dashboard.js:245](../.taskmaster/dashboard/dashboard.js)
- 조건: 자동/수동 refresh의 fetch가 진행 중인 동안 유효한 같은 플랜 JSON을 가져오고, 가져오기가 완료된 뒤 앞선 fetch 응답이 도착한다. 정적 완료순서 추적만 수행했다.
- 기대: 사본 선택 뒤에는 이전 세대의 자동조회 응답을 버리고, 명시적인 live 재개만 최신 원본을 적용한다.
- 실제: :235의 imported 차단은 refresh 시작 때만 적용된다. :253~264의 import는 진행 중 요청을 취소하거나 세대를 바꾸지 않고 snapshot/imported 모드를 적용한다. 먼저 시작한 refresh는 응답 뒤:241~245에서 현재 같은 plan ID를 검증하고 무조건 snapshot=data; state.mode='live'를 실행한다. import 버튼도 fetching 중 잠기지 않는다. 실제 브라우저에서 가져온 사본과 imported 표시를 먼저 확인했지만, 이전 GET이 늦게 완료되면 live 표시와 원격 제목으로 되돌아갔다.
- 영향/근거 수준: 사용자가 검토하려고 고른 정상 사본이 지연 응답에 의해 원본으로 대체되며 자동 갱신까지 재개된다. 원본 Task Master 파일이 수정되는 문제는 아니지만 검토 대상·진행률 판단이 바뀐다. 실제 대시보드 JS/normalizer + 정상 모의 응답·지연 응답, built Chromium 반복 2회
- 최소 수정/회귀: import/모드 전환에 요청 세대를 갱신하거나 진행 중 자동읽기를 취소하고, 완료 시 시작 세대와 현재 모드를 비교해 오래된 응답을 적용하지 않는다. 정상 응답을 지연시킨 상태에서 유효한 JSON 사본을 가져온 뒤 지연 응답을 완료해도 imported 모드와 사본 지문이 유지되는지 확인.
- 제안 검사 가치: Value: protects=사본 선택 뒤에는 이전 세대의 자동조회 응답을 버리고, 명시적인 live 재개만 최신 원본을 적용한다.; fails_when=:235의 imported 차단은 refresh 시작 때만 적용된다. :253~264의 import는 진행 중 요청을 취소하거나 세대를 바꾸지 않고 snapshot...; why_new=기존 통과 사례가 이 입력·완료 순서 조합을 놓쳤다.; seam=none
- 한계: 자체 루프백 서버와 메모리 응답을 사용했다. 기존4318·실제 Task Master/registry 원본은 수정하지 않았다. 현재 원본이 이미 혼합됐다는 주장이 아니다.
- 근거: [agents/dashboard/static-evidence.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dashboard/static-evidence.json), [functional/.qa-evidence/034/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/034/receipt.json), [functional/.qa-evidence/034/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/034/stdout), [functional/.qa-evidence/034/stderr](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/034/stderr), [functional/.qa-evidence/035/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/035/receipt.json), [functional/.qa-evidence/035/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/035/stdout), [functional/.qa-evidence/035/stderr](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/035/stderr)

### DASH-3 · P2 · 태그가 없는 구형 tasks 배열을 다른 이름의 플랜에도 재사용해 작업 출처를 섞을 수 있음

- 위치: [.taskmaster/scripts/openai-dashboard-data.mjs:30](../.taskmaster/scripts/openai-dashboard-data.mjs)
- 조건: manifest는 judgment-remediation 또는 integration-remediation인데 읽은 Tasks JSON이 해당 태그 없이 구형 master의 bare {tasks:[...]} 형식인 경우. 구형 형식 자체는 유효하나 이 플랜에 귀속되지 않는다. 실제 원본은 바꾸지 않았다.
- 기대: master의 구형 형식 호환은 유지하되 명명된 태그가 없는 다른 플랜에는 fallback하지 않고 missing_tasks로 원본 연결 오류를 반환한다.
- 실제: :29~30은 어떤 tag든 누락되면 tasksFile.tasks로 대체한다. :34는 플랜 task ID와 겹치는 항목을 선택하고 :35는 선택이0일 때만 거절한다. 세 실제 플랜은 모두1부터 시작하므로 master의 기존 작업들이 다른 플랜 제목/게이트 아래 나타날 수 있다. UI의 누락/개수 경고는 이미 다른 플랜 데이터를 채택한 뒤의 경고다. 반대로 dashboard.js:258의 파일 import는 bare 형식을 master 또는 일치 planId에만 허용한다. 실제 normalizer에 유효한 bare master 원본을 주면 integration-remediation 아래 master 제목이 채택됨을 확인했다.
- 영향/근거 수준: 작업 ID가 겹치는 과거 플랜의 done 상태와 제목이 현재 플랜 자료로 오인될 수 있어 완료·출시 판단을 왜곡한다. 현재 세 태그 원본이 이미 섞여 있다는 주장은 아니다. 실제 normalizer에 유효한 legacy 입력을 전달한 Node 오프라인 재현 2회(034/035); 브라우저 렌더링 재현은 아님
- 최소 수정/회귀: tag==='master' 또는 명시적으로 일치하는 planId일 때만 bare tasks 배열을 허용하고 다른 경우에는 해당 tag 컬렉션을 요구한다. 기존 정상3태그와 master bare 형식은 허용하고, 이름 있는 플랜에 master bare 파일이 적용되지 않는지 의미 있는 출처 격리 회귀를 추가한다.
- 제안 검사 가치: Value: protects=master의 구형 형식 호환은 유지하되 명명된 태그가 없는 다른 플랜에는 fallback하지 않고 missing_tasks로 원본 연결 오류를 ...; fails_when=:29~30은 어떤 tag든 누락되면 tasksFile.tasks로 대체한다. :34는 플랜 task ID와 겹치는 항목을 선택하고 :35는 선택이0일 때만 ...; why_new=기존 통과 사례가 이 입력·완료 순서 조합을 놓쳤다.; seam=none
- 한계: 구형 정상 bare master 입력을 Node의 실제 normalizer에 직접 전달했다. 브라우저에서 잘못된 플랜을 렌더링하는 경로까지 실행한 증거는 아니다. 실제 Task Master 원본·registry·기존4318은 수정하지 않았다. 현재3태그 원본이 이미 혼합됐다는 주장이 아니다.
- 근거: [agents/dashboard/static-evidence.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dashboard/static-evidence.json), [functional/.qa-evidence/034/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/034/receipt.json), [functional/.qa-evidence/034/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/034/stdout), [functional/.qa-evidence/034/stderr](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/034/stderr), [functional/.qa-evidence/035/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/035/receipt.json), [functional/.qa-evidence/035/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/035/stdout), [functional/.qa-evidence/035/stderr](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/035/stderr)

### TEST-1 · P2 · 늦은 AI 응답 검사가 현재 계약에서 항상 거절되는 fixture를 사용해 무시 보호의 회귀를 가릴 수 있음

- 위치: [tests/refactor-boundaries-qa.cjs:109](../tests/refactor-boundaries-qa.cjs), [tests/refactor-boundaries-qa.cjs:115](../tests/refactor-boundaries-qa.cjs), [tests/refactor-boundaries-qa.cjs:125](../tests/refactor-boundaries-qa.cjs), [tests/navigation-qa.cjs:144](../tests/navigation-qa.cjs), [tests/navigation-qa.cjs:145](../tests/navigation-qa.cjs), [tests/request-timeout-qa.cjs:24](../tests/request-timeout-qa.cjs), [lib/feedback-recovery-response.ts:18](../lib/feedback-recovery-response.ts), [lib/feedback-recovery-response.ts:24](../lib/feedback-recovery-response.ts)
- 조건: 정적 단계1: 위 세 route.fulfill JSON에서 receipt가 없는지 확인한다.; 정적 단계2: readFeedbackRecoveryResponse의 HTTP200 경로는 receipt parse 실패 시 line18에서 invalid_response를 반환하며 feedback 검사/attachment에 도달하지 않는다.; 정적 단계3: 세 테스트는 feedback가 없는지만 assert하고 그 뒤 late-response ignore 성공 문자열을 쓴다. 따라서 그 음성 결과는 stale 무시가 아닌 포맷 거절로도 똑같이 만들어진다.
- 기대: 늦은 정상 응답을 무시한다고 보고하려면 같은 활성 요청에 즉시 도착했을 때 수락 가능한 응답을 지연시킨 뒤 무시 여부를 확인해야 한다.
- 실제: refactor-boundaries와 navigation의 지연 응답에는 receipt와 현행 OpenAI provenance가 없다. request-timeout의 지연 응답에도 receipt가 없다. readFeedbackRecoveryResponse는 HTTP200에서 completed receipt 없으면 stale 대상 검증/저장 이전에 invalid_response로 종료한다. 대상이 바뀌지 않은 정상 요청이어도 수락 불가능하므로 feedback===undefined라는 음성 assert는 그대로 통과한다.
- 영향/근거 수준: 검사 보고서는 tab/tool/Back 또는 시간 초과 뒤 late AI discarded/ignored를 성공으로 기록하지만, 유효한 늦은 응답의 오염을 막는 generation/취소/현재성 경로가 퇴행했는지 이 입력으로는 판별하지 못한다. 모든 다른 AI/저장 검사가 무효하다는 의미는 아니다. 현행 응답 계약·fixture/assertion 경로의 독립 정적 검토. 원래 사례는 전체 native suite에서 실행했고 전용 변이·정상 응답 fixture 재현은 미실시
- 최소 수정/회귀: route의 실제 requestId/requestStartedAt로 feedbackReceipt(route), 실제 모델/context로 currentOpenaiFeedback(route,...)를 구성한다. 지연 전 동일 활성 요청이 수락되는 positive control을 둔 뒤 tab/tool/Back/timeout 상태에서 feedback 미부착과 의도된 취소/무효화 결과를 확인한다. abort된 route.fulfill 실패와 실제 정상 응답 전달 여부도 구분해 기록한다. 정상 fixture의 즉시 응답은 저장됨을 확인하고, 동일 정상 fixture의 지연 응답은 무시됨을 확인한다. 관련 현재성/무효화 보호를 제거한 변이를 별도 격리 재생에서 실패시켜야 한다.
- 제안 검사 가치: Value: protects=늦은 정상 응답을 무시한다고 보고하려면 같은 활성 요청에 즉시 도착했을 때 수락 가능한 응답을 지연시킨 뒤 무시 ...; fails_when=refactor-boundaries와 navigation의 지연 응답에는 receipt와 현행 OpenAI provenance가 없다. request-timeout의 지연 응답에도 receipt가 없...; why_new=기존 fixture가 현행 응답 검증에서 먼저 거절된다.; seam=none
- 한계: 잘못된 fixture로는 stale-response 방어 퇴행을 판별하지 못한다는 결론이다. 실제 제품의 stale attachment 결함이나 다른 assertion 전체 무효를 주장하지 않는다. 음성 assert의 근거가 무효하다는 정적 확인이다. 제품에 stale attachment 결함이 실제 존재한다고 새로 단정하지 않는다. timeout의 잠금 해제/입력 보존/성적 보존과 navigation의 저장 실패 이탈 차단 등 다른 assertion은 이 결함과 별도로 유효할 수 있다. 현재 generation/abort/owner 여러 보호가 중첩된다. 특정 한 줄 삭제만으로 실제 제품 오염이 발생한다고 주장하지 않는다.
- 근거: [agents/test-review/findings.json](../../../outputs/comprehensive-defect-audit-20261105/agents/test-review/findings.json), [agents/test-review/test-assertion-index.json](../../../outputs/comprehensive-defect-audit-20261105/agents/test-review/test-assertion-index.json), [agents/test-review/verification.json](../../../outputs/comprehensive-defect-audit-20261105/agents/test-review/verification.json)

### OPS-2 · P2 · Linux 자원 검사 시간초과 정리가 별도 세션의 Worker를 종료하지 못하는 경로

- 위치: [tests/qa/isolated-worker.cjs:15](../tests/qa/isolated-worker.cjs)
- 조건: Linux/macOS에서 browser performance suite의 backup-resource-qa.cjs가 isolatedWorker를 생성한 뒤 검사 timeout 또는 suite 중단에 걸리는 경우. 정적 순서 추적만 했으며 새 프로세스나 timeout 재현은 실행하지 않았다.
- 기대: 자원 검사도 중단 메시지/신호에서 자신이 만든 Worker 종료 완료를 기다리거나, suite 소유 종료대상에 별도 Worker그룹까지 등록해야 한다.
- 실제: isolated-worker.cjs:15는 비Windows에서 detached:true로 Wrangler/Worker를 별도 프로세스 그룹으로 만든다. backup-resource-qa.cjs는 launchBrowser를 호출하지 않고 qa-stop/SIGTERM 처리기를 등록하지 않으며:33의 finally에만 worker.stop이 있다. runCase는 IPC연결이 있으면 qa-stop을 보내고(:16), 유예 뒤 검사 프로세스 그룹만 SIGKILL한다(:24). 분리된 Worker그룹은 그 대상에 포함되지 않으며 SIGKILL로 checker의 finally도 실행되지 않는다.
- 영향/근거 수준: 정적 제어흐름상 Linux/macOS 로컬 Worker그룹이 남을 수 있고 다음 성능 검사를 오염시키거나 루프백 포트/메모리를 점유한다. 운영 배포 Worker나 Windows에서 동일 현상이 검증됐다는 뜻은 아니다. 프로세스 그룹·IPC·finally 종료 경로 정적 추적; orphan 실측 미실시
- 최소 수정/회귀: 공통 owned-worker 수명 관리를 자원 검사에도 연결하고 종료 완료/강제 종료까지 기다리게 한다. 부모 강제 종료 시에는 생존 그룹도 남지 않게 소유 범위를 정한다. 기존 qa-interruption 스타일의 합성 Worker로 resource-checker 시작 중/실행 중 timeout·SIGINT/SIGTERM 후 Worker와 하위프로세스/포트0을 확인한다.
- 제안 검사 가치: Value: protects=자원 검사도 중단 메시지/신호에서 자신이 만든 Worker 종료 완료를 기다리거나, suite 소유 종료대상에 별도 Worker그룹까...; fails_when=isolated-worker.cjs:15는 비Windows에서 detached:true로 Wrangler/Worker를 별도 프로세스 그룹으로 만든다. backup-resource-qa.cjs는 launchBr...; why_new=기존 통과 사례가 이 입력·완료 순서 조합을 놓쳤다.; seam=none
- 한계: Linux/macOS 프로세스 그룹 의미에 따른 정적 결론이다. 실제 orphan·Windows 동일 현상·운영 Worker 장애를 확인한 결과는 아니다. 운영 영향 없음: 로컬 QA 도구 경로만 해당 프로세스 그룹 결과는 플랫폼 의미와 코드에 따른 추론이며 실제 orphan 계측은 미실시
- 근거: [agents/operations/static-evidence.json](../../../outputs/comprehensive-defect-audit-20261105/agents/operations/static-evidence.json)

### OPS-3 · P3 · 동일 stale lock을 동시에 회수하면 새 소유자의 잠금을 삭제해 두 QA suite가 함께 실행될 수 있음

- 위치: [tests/qa/lock.cjs:8](../tests/qa/lock.cjs)
- 조건: 죽은 PID가 든 동일 lock이 남은 상태에서 두 suite가 동시에 시작. 실행 재현은 하지 않았다.
- 기대: stale 회수와 새 lease 획득을 단일 소유권 프로토콜로 직렬화하거나 현재 소유권이 바뀐 경우 삭제하지 않아야 한다.
- 실제: A/B가 모두:4에서 옛 PID를 읽고:6~7에서 ESRCH를 확인한 뒤 A가:8 unlink와:10 wx 생성을 완료한다. B는 이미 확인한 옛 PID를 근거로:8의 무조건 unlink를 실행해 A의 새 파일을 삭제하고:10 wx에 성공한다. release의:12 소유자 검사는 이미 시작된 두 suite를 차단하지 못한다.
- 영향/근거 수준: 비정상 종료 뒤 동시 재시작이라는 제한된 조건에서 성능/기능 검사 병렬 실행이 가능해 측정과 격리 주장을 훼손한다. 일반 단일 실행과 운영 학습 경로의 장애는 아니다. 동일 stale lease의 두 acquire 완료 순서 정적 추적; 동시 실행 미실시
- 최소 수정/회귀: 플랫폼의 OS lock 또는 별도 원자적 stale-recovery 소유권을 사용하고 acquire 경합에서도 새 소유자의 파일을 삭제하지 못하게 한다. 읽기 재확인만 추가하는 경우에도 최종 unlink 사이 경합을 고려한다. 두 가상 contender가 동일 stale lease를 관찰한 뒤 첫 contender의 새 lock을 두 번째가 지울 수 없는지 검사한다. 기존 tests/qa-process.test.mjs:10~16은 live-owner/release 교체만 검사하며 이 acquire 완료순서를 다루지 않는다.
- 제안 검사 가치: Value: protects=stale 회수와 새 lease 획득을 단일 소유권 프로토콜로 직렬화하거나 현재 소유권이 바뀐 경우 삭제하지 않아야 한다.; fails_when=A/B가 모두:4에서 옛 PID를 읽고:6~7에서 ESRCH를 확인한 뒤 A가:8 unlink와:10 wx 생성을 완료한다. B는 이미 확인한 옛 PID를 근...; why_new=기존 통과 사례가 이 입력·완료 순서 조합을 놓쳤다.; seam=none
- 한계: 죽은 PID lock을 두 실행이 동시에 회수하는 제한된 완료 순서다. 실행 재현이나 정상 단일 실행의 실패 증거는 없다.
- 근거: [agents/operations/static-evidence.json](../../../outputs/comprehensive-defect-audit-20261105/agents/operations/static-evidence.json)

### TEST-2 · P3 · 구조 의견 QA가 비동기 준비·저장 완료 전에 검사해 WebKit에서 거짓 실패함

- 위치: [tests/sentence-structure-qa.cjs:28](../tests/sentence-structure-qa.cjs), [tests/sentence-structure-qa.cjs:62](../tests/sentence-structure-qa.cjs)
- 조건: 변경하지 않은 sentence-structure-qa.cjs를 built Worker와 WebKit에서 실행한다.
- 기대: 버튼의 context fingerprint 준비와 새 문법 의견의 실제 저장 완료를 기다린 뒤 해당 결과를 검증한다.
- 실제: 전체 검사017과 단독019는 즉시 isEnabled 검사에서 실패했다. 관찰용020에서는 그 단계를 지나도 새 의견의 debounce 저장 전에 기존 전역 저장됨 표시를 읽어 다음 D1 단언이 실패했다. 제품 코드를 바꾸지 않고 두 관찰 대기만 추가한021/022는 전체 사례를 통과했으며 새 의견의 D1 저장이 약559/678ms 뒤 확인됐다.
- 영향/근거 수준: 정상 준비·저장 중인 제품을 실패로 분류하고 이후 구조 보존·복구 검증을 건너뛰게 한다. 제품 저장 결함으로 확정한 항목이 아니다. 원본 WebKit 실패2회와 in-memory 관찰 대기 진단 통과2회; 원본 검사/제품은 수정하지 않음
- 최소 수정/회귀: 버튼 활성화를 재시도 가능한 단언으로 기다리고, 새 의견의 저장중→저장됨 전환이나 해당 PUT/서버 데이터 완료를 기다린다. assertion을 제거하거나 고정 sleep으로 덮지 않는다. Chromium/WebKit에서 fingerprint 및 debounce 지연 조건을 주어 새 의견의 실제 저장·유산 구조 보존까지 검사하고, 실제 실패 시에는 계속 실패하는지 확인한다.
- 제안 검사 가치: Value: protects=버튼의 context fingerprint 준비와 새 문법 의견의 실제 저장 완료를 기다린 뒤 해당 결과를 검증한다.; fails_when=전체 검사017과 단독019는 즉시 isEnabled 검사에서 실패했다. 관찰용020에서는 그 단계를 지나도 새 의견의 debounce 저장 전...; why_new=기존 사례를 보완해 비동기 완료를 관찰해야 한다.; seam=none
- 한계: 진단 통과는 원본 검사 통과가 아니다. 원본 WebKit gate는 실패 상태로 남긴다. 관찰 대기만 추가한 진단이며 수정 구현·커밋은 하지 않았다.
- 근거: [functional/.qa-evidence/017/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/017/receipt.json), [functional/.qa-evidence/019/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/019/receipt.json), [functional/.qa-evidence/020/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/020/receipt.json), [functional/.qa-evidence/021/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/021/stdout), [functional/.qa-evidence/022/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/022/stdout), [browser/native-diagnostic.cjs](../../../outputs/comprehensive-defect-audit-20261105/browser/native-diagnostic.cjs)

### TEST-3 · P3 · 중단 검사가 마커 파일 존재를 준비 완료로 취급하고 cleanup JSON 예외로 결과를 가림

- 위치: [tests/qa-interruption.test.mjs:25](../tests/qa-interruption.test.mjs), [tests/qa-interruption.test.mjs:42](../tests/qa-interruption.test.mjs), [tests/qa-interruption.test.mjs:56](../tests/qa-interruption.test.mjs), [tests/qa-interruption.test.mjs:65](../tests/qa-interruption.test.mjs)
- 조건: qa-interruption.test.mjs의 합성 Worker가 owned.json을 게시하는 동안 부모/runner가 준비 여부와 정리 정보를 읽는다.
- 기대: 완전한 마커가 게시된 뒤 ready를 알리고, 준비 실패 때도 cleanup 자체의 파싱 예외가 선행 실패를 가리거나 소유 프로세스 정리 경로를 건너뛰지 않는다.
- 실제: Node24 전체046은799/800·exit1이며 SIGINT/profile-start의 finally65 JSON.parse에서 Unexpected end of JSON input으로 끝났다. 소스는 최종 경로 writeFileSync25→existsSync42→ready30→무보호 parse56/65이고 완전한 JSON 게시 장벽이 없다. 독립 정적 검토도 이 경계 결함을 확인했다. 원본 단독048은6/6·exit0이었다.
- 영향/근거 수준: 중단·정리 회귀 검사가 불안정해지고, cleanup의 파싱 예외가 있다면 최초 오류를 덮으며 fallback 정리까지 건너뛴다. 실제 runner SIGINT 결함이나 Worker 유출을 입증한 항목은 아니다. 원본 Node24 전체 실패1회 + readiness/cleanup 정적 추적 + 독립 검토; 원본 단독 통과도 보존
- 최소 수정/회귀: 동일 디렉터리의 임시 파일→rename 또는 완전한 marker/IPC로 준비를 알린다. cleanup은 이미 확인한 소유 정보를 사용하고, fallback 파싱 실패와 최초 오류를 별도로 보존하며 소유자 검증/정리 보장을 유지한다. 마커 게시를 지연한 조건에서도 완전한 JSON 전에는 ready가 나가지 않고, 준비 예외 시 최초 오류·소유 PID/포트/lock 정리 확인이 모두 남는지 검사한다. 원본 전체 Node22/24 게이트도 재검증한다.
- 제안 검사 가치: Value: protects=완전한 마커가 게시된 뒤 ready를 알리고, 준비 실패 때도 cleanup 자체의 파싱 예외가 선행 실패를 가리거나 소유 프로세...; fails_when=Node24 전체046은799/800·exit1이며 SIGINT/profile-start의 finally65 JSON.parse에서 Unexpected end of JSON input으로 끝났다. 소스는 최종 경...; why_new=기존 중단 사례가 보조 마커 파싱에서 실패했다.; seam=none
- 한계: 046 당시 marker 바이트와 선행 예외가 없어 그 실행의 최초 원인을 partial-write 경합으로 단정하지 않는다. 공유 준비 조건의 결함과 실제 finally 파싱 예외를 구분한다. 실제 PID/포트/lock 유출이나 제품·운영 장애는 관찰하지 않았다. 단독 통과는 기존 실패를 취소하지 않는다.
- 근거: [functional/.qa-evidence/046/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/046/receipt.json), [functional/.qa-evidence/046/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/046/stdout), [functional/.qa-evidence/048/receipt.json](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/048/receipt.json), [functional/.qa-evidence/048/stdout](../../../outputs/comprehensive-defect-audit-20261105/functional/.qa-evidence/048/stdout), [agents/test-review/unit-marker-review.json](../../../outputs/comprehensive-defect-audit-20261105/agents/test-review/unit-marker-review.json)

## 의존성 정비: 23권고를 7작업으로 분리

npm의 영향 패키지19개, GitHub 열린 알림21개/고유14개는 서로 다른 집계다. npm·GitHub 권고 ID를 합쳐 중복 제거한 고유23개를 사용했다. 알림의 critical/high를 현재 운영에서 실행 가능한 RCE/서비스 거부로 단정하지 않았다. 앱은 Vinext/workerd이며 Next 서버 기능의 직접 사용 여부와 실제 번들 포함을 구분했다.

### DEP-UNDICI · P2 · 8권고

Miniflare Node 개발/로컬 프록시 및 Wrangler Node 개발·배포 도구. Wrangler CLI의 require_undici()를 통한 HTTPS fetch 호출이 정적으로 존재한다. 앱 OpenAI는 workerd의 전역 fetch를 기본 주입하며 해당 Node 패키지를 import하지 않는다. 기존 dist/server의 JavaScript 118개에서 undici 패키지 import/require 서명 0. workerd 네이티브 HTTP/WebSocket 구현은 이 npm 패키지 버전과 별개다. 별도 로컬 Node22.22.2 내장 Undici6.24.1은8개 중5개 버전 범위에 해당한다. Node24.22.1 내장7.30.1은 이8개 범위 밖이다. npm override로 Node 내장이나 Wrangler 사전 번들은 바뀌지 않는다. Miniflare가 해석하는 undici를 호환되는 패치 버전으로 갱신하고, 별도로 수정된 undici를 내장한 Wrangler 배포본을 확인한다. npm override만으로 Wrangler 번들이 수정됐다고 종결하지 않는다. Node 내장 fetch/WebSocket은 Node 배포본 관리 범위로 별도 확인한다.

한계: 악성 피어·프로토콜 응답·TLS·SSE·압축·SRI·WebSocket 검증을 실행하지 않았다. 툴체인이 도달 가능한 임의 공격자 피어 또는 실제 악용은 입증하지 않았다. 악용·네트워크/브라우저·대량 입력·새 설치·새 빌드0. 정비 우선순위는 앱 도달성을 반영하며 advisorySeverity와 다를 수 있다. 로컬 Node 패치 버전과 CI의 major 선언을 구분한다. 운영 workerd fetch를 Node의 Undici와 동일시하지 않는다. 이번 Node24 단위 결과는 별도 gates에 기록한다.

근거: [agents/dependencies/observations.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dependencies/observations.json), [agents/dependencies/excerpts.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dependencies/excerpts.json), [agents/dependencies/triage.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dependencies/triage.json), [agents/dependencies/runtime-addendum.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dependencies/runtime-addendum.json)

### DEP-VITE · P2 · 5권고

npm dev/build는 scripts/run-framework.mjs에서 Vinext/Vite CLI를 사용한다. 배포 Worker는 Vite 개발 서버가 아니다. portable 설정의 host는 기본값이며 managed-linux 분기는 0.0.0.0/terminal.local을 설정한다. 현재 실행 프로필·활성 서버/편집기 상태는 새로 실행·조회하지 않았다. 기존 Worker JavaScript 118개에서 launch-editor-middleware/__open-in-editor/escapeCmdArgs 서명 0. 8.0 계열의 권고 패치 Vite 8.1.6 이상으로 호환성 검토 후 갱신. 프로젝트의 Vinext/Cloudflare 통합 확인이 필요하며 이 감사에서 설치·빌드는 실행하지 않았다.

한계: 편집기 경로, 환경변수, ADS, 파일 우회, 교차 출처 URL 또는 fs.allow 우회 입력을 실행하지 않았다. loopback 설정만으로 모든 브라우저 기원 공격이 차단된다고 주장하지 않는다. 악용·네트워크/브라우저·대량 입력·새 설치·새 빌드0. 정비 우선순위는 앱 도달성을 반영하며 advisorySeverity와 다를 수 있다.

근거: [agents/dependencies/excerpts.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dependencies/excerpts.json), [agents/dependencies/observations.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dependencies/observations.json), [agents/dependencies/triage.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dependencies/triage.json)

### DEP-ZOD · P2 · 1권고

저장·복원·AI 등의 스키마 검증에 직접 사용하며 Worker에도 ZodArray 코드가 존재한다. v3 ZodArray는 maxLength 위반을 기록한 뒤에도 입력 전체를 복사/map해 항목별 파싱한다. 이 패키지는 실제 Worker 검증 경로에 포함된다. PUT /api/state는 byte 한도/JSON parse/assertStateDataKeys 뒤 saveSchema.safeParse를 수행한다. DATA-1의 컬렉션 사전 제한을 우선 검토하며 별도로 Zod major 업그레이드 호환성을 검토한다. 라이브러리 업그레이드만으로 현재 저장 경계의 자원 한도가 해결된다고 보장하지 않는다.

한계: 공식 권고 설명의 $ZodArray/handleArrayResult(v4 계열)과 설치 v3의 코드를 동일 구현이라고 하지 않는다. DATA-1의 fatal이 Object.entries 단계인지 Zod 항목별 파싱/issue 생성 단계인지는 미계측. 운영 128MB isolate 실패, 타 계정 영향, 반복성은 입증하지 않았다. 대량 입력은 재실행하지 않았다. 악용·네트워크/브라우저·대량 입력·새 설치·새 빌드0. 정비 우선순위는 앱 도달성을 반영하며 advisorySeverity와 다를 수 있다.

근거: [agents/data/findings.json](../../../outputs/comprehensive-defect-audit-20261105/agents/data/findings.json), [agents/dependencies/triage.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dependencies/triage.json)

### DEP-SATORI · P3 · 1권고

Vinext OG shim은 ImageResponse 생성자에서 @vercel/og를 지연 import한다. 현재 앱의 ImageResponse/next/og 사용은 0이다. 주 Worker만이 아니라 기존 Worker JavaScript 118개 전체에서 satori 호출/모듈 서명 및 ImageResponse 생성자 서명 0. 호환성을 확인하며 patched satori를 포함하는 상위 패키지로 갱신. 현재 사이트 XSS로 확정하지 않는다.

한계: OG가 향후 활성화되거나 별도 렌더러에서 외부 입력을 SVG로 렌더링하면 조건이 달라진다. 생성 SVG 공격을 실행하지 않았다. 악용·네트워크/브라우저·대량 입력·새 설치·새 빌드0. 정비 우선순위는 앱 도달성을 반영하며 advisorySeverity와 다를 수 있다.

근거: [agents/dependencies/observations.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dependencies/observations.json), [agents/dependencies/triage.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dependencies/triage.json)

### DEP-NEXT · P3 · 3권고

실행 main은 vinext/server/fetch-handler이며 앱의 next/headers/navigation 등은 Vinext shim으로 연결된다. 실행 명령은 next start가 아니다. app/lib/db 267개 파일에서 use cache/use server/cacheComponents/ImageResponse/next/server·next/dist import 서명 0. 기존 Worker JavaScript 118개에서 Next server runtime 경로 서명 0. Vinext 자체 image optimizer는 SVG 거절 또는 보안 헤더를 붙인 통과 응답 경로이며 Next의 sharp SVG 변환 경로와 구분된다. 설치 Next의 권고 패치를 호환성 검토 대상으로 유지하되 현재 운영 RCE가 확인됐다고 표기하지 않는다. sharp 해석 버전은 실제 사용자인 Next에서 확인해야 한다.

한계: Next 버전만으로 Vinext 자체의 모든 RSC/캐시/이미지 코드가 안전하다고 증명하지 않는다. 실제 RCE/Server Action/이미지 입력은 시험하지 않았다. 악용·네트워크/브라우저·대량 입력·새 설치·새 빌드0. 정비 우선순위는 앱 도달성을 반영하며 advisorySeverity와 다를 수 있다.

근거: [agents/dependencies/observations.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dependencies/observations.json), [agents/dependencies/triage.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dependencies/triage.json)

### DEP-FASTURI · P3 · 4권고

Ajv runtime URI resolver가 fast-uri를 require한다. 앱/DB/lib 267개 파일에서 직접 fast-uri import 0. 앱의 호스트·scheme 허용 목록, 리다이렉트, 링크 렌더링, outbound fetch 라우팅에 fast-uri를 쓰는 경로를 발견하지 못했다. 기존 Worker JavaScript 118개에서 fast-uri 패키지 import/require 서명 0. package-lock의 dev 플래그만으로 운영 포함 여부를 판정하지 않았다. 전이 Ajv/fast-uri를 호환 가능한 패치 버전으로 갱신. 현재 앱 SSRF/XSS/인가 우회가 입증됐다는 설명은 피한다.

한계: Ajv 내부 URI 처리 전체에 대해 라이브러리의 모든 입력을 증명한 것은 아니다. 공격 URI를 파싱·실행하거나 브라우저/네트워크 요청에 사용하지 않았다. 악용·네트워크/브라우저·대량 입력·새 설치·새 빌드0. 정비 우선순위는 앱 도달성을 반영하며 advisorySeverity와 다를 수 있다.

근거: [agents/dependencies/observations.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dependencies/observations.json), [agents/dependencies/triage.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dependencies/triage.json)

### DEP-MINIMATCH · P3 · 1권고

typescript-estree의 allowDefaultProject glob 검사에서 minimatch(filePath, pattern, {dot:true})를 호출한다. 설치 10.2.5 코드는 optimizationLevel 기본 1이며 문제 전처리 분기는 >=2일 때다. 확인한 호출은 해당 옵션을 올리지 않는다. 프로젝트 ESLint 설정에도 optimizationLevel 설정을 발견하지 못했다. 앱/DB/lib의 minimatch import와 기존 Worker의 minimatch import/문제 전처리 서명은 0. 상위 typescript-eslint/ESLint의 호환 가능한 수정 릴리스를 검토한다. 현재 공개 Worker DoS로 분류하지 않는다.

한계: npm/GitHub reviewed 범위는 >=7 <11.0.1이지만 maintainer advisory의 affected 필드는 10.2.6만 명시한다. 설치 10.2.5에도 관련 증폭 코드가 있으나 이 불일치만으로 오탐 또는 실제 공격 가능성을 확정하지 않는다. glob 입력/부하 시험 0. 악용·네트워크/브라우저·대량 입력·새 설치·새 빌드0. 정비 우선순위는 앱 도달성을 반영하며 advisorySeverity와 다를 수 있다.

근거: [agents/dependencies/observations.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dependencies/observations.json), [agents/dependencies/excerpts.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dependencies/excerpts.json), [agents/dependencies/triage.json](../../../outputs/comprehensive-defect-audit-20261105/agents/dependencies/triage.json)

| 권고 ID | 패키지 | 정비 | 상류 심각도 | 직접 확인한 공식 원문 |
|---|---|---|---|---|
| GHSA-333x-w4r6-6crp | fast-uri 3.1.8 | DEP-FASTURI | low | [원문](https://github.com/fastify/fast-uri/security/advisories/GHSA-333x-w4r6-6crp) |
| GHSA-w74x-v6f9-j3xg | fast-uri 3.1.8 | DEP-FASTURI | medium | [원문](https://github.com/fastify/fast-uri/security/advisories/GHSA-w74x-v6f9-j3xg) |
| GHSA-wjr9-j795-jxcr | fast-uri 3.1.8 | DEP-FASTURI | medium | [원문](https://github.com/fastify/fast-uri/security/advisories/GHSA-wjr9-j795-jxcr) |
| GHSA-xhq7-xmqj-769h | fast-uri 3.1.8 | DEP-FASTURI | low | [원문](https://github.com/fastify/fast-uri/security/advisories/GHSA-xhq7-xmqj-769h) |
| GHSA-g3hv-75wg-m249 | minimatch 10.2.5 | DEP-MINIMATCH | medium | [원문](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249) |
| GHSA-2464-fhr4-w9xw | next 16.3.8 | DEP-NEXT | critical | [원문](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) |
| GHSA-673q-mjm6-r5xr | next 16.3.8 | DEP-NEXT | critical | [원문](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr) |
| GHSA-p3m5-59mp-jv5r | next 16.3.8 | DEP-NEXT | high | [원문](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r) |
| GHSA-wx4j-mvgx-mqwp | satori 0.16.0 | DEP-SATORI | medium | [원문](https://github.com/vercel/satori/security/advisories/GHSA-wx4j-mvgx-mqwp) |
| GHSA-2m5v-pch6-74hx | undici 7.29.1 | DEP-UNDICI | high | [원문](https://github.com/nodejs/undici/security/advisories/GHSA-2m5v-pch6-74hx) |
| GHSA-4qv8-2p9j-2685 | undici 7.29.1 | DEP-UNDICI | medium | [원문](https://github.com/nodejs/undici/security/advisories/GHSA-4qv8-2p9j-2685) |
| GHSA-4w7w-5xrc-9h26 | undici 7.29.1 | DEP-UNDICI | high | [원문](https://github.com/nodejs/undici/security/advisories/GHSA-4w7w-5xrc-9h26) |
| GHSA-55wc-3pg8-jfw6 | undici 7.29.1 | DEP-UNDICI | medium | [원문](https://github.com/nodejs/undici/security/advisories/GHSA-55wc-3pg8-jfw6) |
| GHSA-9fm3-97px-rjf6 | undici 7.29.1 | DEP-UNDICI | medium | [원문](https://github.com/nodejs/undici/security/advisories/GHSA-9fm3-97px-rjf6) |
| GHSA-f72v-6w45-q472 | undici 7.29.1 | DEP-UNDICI | medium | [원문](https://github.com/nodejs/undici/security/advisories/GHSA-f72v-6w45-q472) |
| GHSA-qrxm-fqhp-jwvm | undici 7.29.1 | DEP-UNDICI | high | [원문](https://github.com/nodejs/undici/security/advisories/GHSA-qrxm-fqhp-jwvm) |
| GHSA-xjj6-f33q-929c | undici 7.29.1 | DEP-UNDICI | high | [원문](https://github.com/nodejs/undici/security/advisories/GHSA-xjj6-f33q-929c) |
| GHSA-587h-7wmj-h5pm | vite 8.0.16 | DEP-VITE | high | [원문](https://github.com/vitejs/launch-editor/security/advisories/GHSA-587h-7wmj-h5pm) |
| GHSA-698v-4r3x-3vcv | vite 8.0.16 | DEP-VITE | medium | [원문](https://github.com/vitejs/launch-editor/security/advisories/GHSA-698v-4r3x-3vcv) |
| GHSA-9jrq-w75r-8gcw | vite 8.0.16 | DEP-VITE | low | [원문](https://github.com/vitejs/vite/security/advisories/GHSA-9jrq-w75r-8gcw) |
| GHSA-r825-w8mm-5pxw | vite 8.0.16 | DEP-VITE | medium | [원문](https://github.com/vitejs/launch-editor/security/advisories/GHSA-r825-w8mm-5pxw) |
| GHSA-rq7h-c2jc-7f22 | vite 8.0.16 | DEP-VITE | medium | [원문](https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22) |
| GHSA-mrhx-c7xc-m3w5 | zod 3.25.76 | DEP-ZOD | high | [원문](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) |

Node 내장 fetch의 정비는 npm override와 별개다. [Node22.23.4 릴리스](https://nodejs.org/en/blog/release/v22.23.4)와 [Node24.22.1 릴리스](https://nodejs.org/en/blog/release/v24.22.1)의 Undici 패치 포함을 대조했다. 호스트/CI/패키지를 이번에 업데이트하지 않았으며, 모든 Node 보안 문제의 완전한 검증은 아니다.

## 기능별 검사대장 요약

| 영역 | 조사 내용 | 연결된 결함/정비 |
|---|---|---|
| AUTH | 인증·로그인·계정 격리 | UI-5 |
| API | 전체 API 경로·메서드·입력 경계 | DATA-1, AI-1, AI-2 |
| STATE | 상태 envelope·schema·수치·용량 | DATA-1, UI-4, AI-1 |
| REVISION | revision·동시 저장·순서 | UI-3 |
| DRAFT | 학습 초안·재접속·다중 탭 | UI-1, UI-2, UI-3, UI-4, UI-5 |
| DB | DB 무결성·트랜잭션·쿼리 | AI-6, UI-1, UI-3, UI-4, AI-1 |
| RESTORE | 직접 백업 복원·원자성 | DATA-1 |
| RESTORE-JOBS | 분할 복원·수명·회복 | 추가 확정 결함 없음 |
| EXPORT | JSON·CSV 백업·내보내기 | 추가 확정 결함 없음 |
| AI | OpenAI 전송·응답·오류·판정 | AI-1, AI-2, AI-3, AI-4, AI-5 |
| AI-RECEIPT | AI 영수증·중복·비용 안전 | AI-2 |
| GRAMMAR | 문법 수업·과제·성적 | AI-6, AI-1, UI-3, UI-4 |
| WORDS | 단어 탐색·뜻·편집·개인 단어 | UI-1 |
| LEARNING | 단어 목표·친숙도·회상·학습 흐름 | AI-6, UI-1, UI-2 |
| IMAGES | 이미지 연습·위치·자산 연결 | 추가 확정 결함 없음 |
| SPEECH | IPA·음성·취소·자원 정리 | 추가 확정 결함 없음 |
| NAV | 페이지·내비게이션·모달·뒤로가기 | UI-3, TEST-1 |
| A11Y | 접근성·반응형·키보드 | 추가 확정 결함 없음 |
| STARTUP | 첫 실행·lazy loading·폰트·캐시 | 추가 확정 결함 없음 |
| PERF | 성능·번들·메모리·네트워크 | DATA-1 |
| CONTENT | 단어·문법·IPA·이미지 정적 자료 전체 | AI-3, AI-4, AI-5 |
| DEPENDENCIES | 의존성·보안 권고·도달 가능성 | DEP-UNDICI, DEP-VITE, DEP-ZOD, DEP-SATORI, DEP-NEXT, DEP-FASTURI, DEP-MINIMATCH |
| WORKER | Cloudflare 런타임·빌드·바인딩·환경 | DATA-1 |
| QA-TOOLS | CI·QA runner·프로세스·정리 | TEST-1, TEST-2, TEST-3, OPS-2, OPS-3 |
| LEGACY | 종료된 카드·예전 제공자·자동화 | 추가 확정 결함 없음 |
| OPERATIONS | 운영·복구·출처·링크·문서 | OPS-1, DOCS-1 |
| CLOCK | 한국 학습일·서버 시계·경계 | 추가 확정 결함 없음 |
| UNTRUSTED | 외부 입력·HTML·CSV·리디렉션 | DATA-1 |
| RECOVERY | 오류·취소·느린망·재시도 | AI-2, UI-1, UI-2, UI-3, UI-4 |
| PRIVACY | 관측·로그·응답 정보·개인정보 | UI-5, OPS-1 |
| DASHBOARD | Task Master 대시보드·플랜 출처·가져오기 | DASH-1, DASH-2, DASH-3 |
| DOCS | 문서·운영 복구 지침·생성 자료 | DOCS-1, OPS-1 |

추가 확정 결함 없음은 해당 영역이 완전히 안전하다는 판정이 아니다. 전체 구조 검사로 확인한 학습 자료 조건95,662건, 이미지3,809개 SHA/바이트 대조와 사람의 영어·IPA·이미지 의미/시각 검수를 구분한다. 실제 OS 음성, SSO, 운영 지연/동시 사용자, 실기기, 유료 모델 품질 전체를 대체하지 않는다.

## 실패·제외·보존

010/011,024,027,030/031은 재현 준비·선택자·관찰 완료 전 문제라 최종 제품 증거에서 제외하고 원본 로그를 보존했다. DATA-1은 제한된 전용 로컬 Worker의 fatal1회만 확인했다. 보안 우려 뒤 추가 비정상 대형 입력/메모리 고갈 검사를 중단했으며 운영128MB 영향과 정확한 할당 단계를 주장하지 않는다.

동결된 evidence.json의 limits에 있는 자동 보안 검토 중단 문구는 [중단 경위 정정](../../../outputs/comprehensive-defect-audit-20261105/evidence-clarification.json)을 함께 따른다. 실제 도구 거절 원문은 확인되지 않았으며, 확인되는 것은 첫 실패 뒤 추가 검사 중단 지시다. 이 정정은 원본 관찰·종료 코드·결함 수·도구 판정을 바꾸지 않는다.

이 조사에서 수정·마이그레이션·배포·커밋·푸시·PR은 실행하지 않았다. 따라서 운영 롤백은 발생하지 않았다. 후속 수정 시 현재 API/백업 하위 호환, revision 원자성, 계정 격리, 독립 성적 보존을 유지해야 하며 각 행의 회귀 기준을 통과한 뒤 기존 Site 게시 절차를 따른다. 기존 평가 원장·원점수·예산/게이트는 재개하거나 초기화하지 않았다.

원본943파일·기본 제품637파일·과거 평가32파일·기존3태그·닫힌 평가7파일을 대조했다. 이번 전용 Worker3개의 manager/worker PID와 포트가 종료됐고 QA lock이 없음을 확인했다. 기존 대시보드4318은 계속 열려 있다. private fixture/화면/진단 원본은 Git 제외 outputs/work에 보존했다. 별도 학습 저장소나 전역 메모리에는 쓰지 않았다.

## 탐색 체크포인트

다음 링크는 다음 명령 전에 도구가 발행한 관찰/가설 원문이다. 준비 실패/이전 스크립트 상태도 이력으로 보존하며 현재 통과 근거와 혼동하지 않는다.

- [checkpoint 002](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-002.json)
- [checkpoint 003](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-003.json)
- [checkpoint 004](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-004.json)
- [checkpoint 005](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-005.json)
- [checkpoint 006](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-006.json)
- [checkpoint 007](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-007.json)
- [checkpoint 008](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-008.json)
- [checkpoint 009](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-009.json)
- [checkpoint 010](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-010.json)
- [checkpoint 011](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-011.json)
- [checkpoint 012](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-012.json)
- [checkpoint 013](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-013.json)
- [checkpoint 014](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-014.json)
- [checkpoint 015](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-015.json)
- [checkpoint 016](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-016.json)
- [checkpoint 017](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-017.json)
- [checkpoint 018](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-018.json)
- [checkpoint 019](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-019.json)
- [checkpoint 020](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-020.json)
- [checkpoint 021](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-021.json)
- [checkpoint 022](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-022.json)
- [checkpoint 023](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-023.json)
- [checkpoint 024](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-024.json)
- [checkpoint 025](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-025.json)
- [checkpoint 026](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-026.json)
- [checkpoint 027](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-027.json)
- [checkpoint 028](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-028.json)
- [checkpoint 029](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-029.json)
- [checkpoint 030](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-030.json)
- [checkpoint 031](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-031.json)
- [checkpoint 032](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-032.json)
- [checkpoint 033](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-033.json)
- [checkpoint 034](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-034.json)
- [checkpoint 035](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-035.json)
- [checkpoint 036](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-036.json)
- [checkpoint 037](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-037.json)
- [checkpoint 038](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-038.json)
- [checkpoint 039](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-039.json)
- [checkpoint 040](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-040.json)
- [checkpoint 041](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-041.json)
- [checkpoint 042](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-042.json)
- [checkpoint 043](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-043.json)
- [checkpoint 044](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-044.json)
- [checkpoint 045](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-045.json)
- [checkpoint 046](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-046.json)
- [checkpoint 047](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-047.json)
- [checkpoint 048](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-048.json)
- [checkpoint 049](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-049.json)
- [checkpoint 050](../../../outputs/comprehensive-defect-audit-20261105/functional/exploration-050.json)

### agents/ai/evidence

- [checkpoint 002](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/exploration-002.json)
- [checkpoint 003](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/exploration-003.json)
- [checkpoint 004](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/exploration-004.json)
- [checkpoint 005](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/exploration-005.json)
- [checkpoint 006](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/exploration-006.json)
- [checkpoint 007](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/exploration-007.json)
- [checkpoint 008](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/exploration-008.json)
- [checkpoint 009](../../../outputs/comprehensive-defect-audit-20261105/agents/ai/evidence/exploration-009.json)

### agents/content

- [checkpoint 002](../../../outputs/comprehensive-defect-audit-20261105/agents/content/exploration-002.json)
- [checkpoint 003](../../../outputs/comprehensive-defect-audit-20261105/agents/content/exploration-003.json)
- [checkpoint 004](../../../outputs/comprehensive-defect-audit-20261105/agents/content/exploration-004.json)

### agents/data

- [checkpoint 002](../../../outputs/comprehensive-defect-audit-20261105/agents/data/exploration-002.json)
- [checkpoint 003](../../../outputs/comprehensive-defect-audit-20261105/agents/data/exploration-003.json)
- [checkpoint 004](../../../outputs/comprehensive-defect-audit-20261105/agents/data/exploration-004.json)

### agents/dependencies

- [checkpoint 002](../../../outputs/comprehensive-defect-audit-20261105/agents/dependencies/exploration-002.json)

