# Astryx T1–T6 구현·검증

2026-11-18 · tag `astryx-adoption` · planId `astryx-adoption-2026-11-18`

**1단계 T1–T6 완료: 상위6/6·세부20/20, AX-G0/G1 통과. 전체 플랜은6/18·20/62(32%)이며 T7 이후·최종 품질·실기기·게시 완료가 아니다.**

제품 작업은 `work/astryx-adoption-20261118`, 브랜치 `codex/astryx-foundation`이다. 착수 때 확인한 main `33f5de530c39fe816bebfdb754f751d3e093565f`를 기준으로 했다. 최초 전수 검토 기준405cc557 이후 PR59 등98파일 변경을 반영한 checkout이다. 관리 원본은 기본 폴더와 기존 [4318 대시보드](http://127.0.0.1:4318/)를 유지한다. 커밋·푸시·PR·배포는 수행하지 않았다.

| 작업 | 결과 |
| --- | --- |
| T1 | 최신 착수 기준선·500개 제품 지문과 디자인/운영 계약 고정. 구버전 기본 제품이나 복구 사본에 설치하지 않음 |
| T2 | 명시적 의도 입력 검사, reference-v13/judgment-v10 현재 mock와 과거 mock 분리, 이미지 활성/비활성 전용 QA 프로필·사전 실패 조건 보완. 원본 피드백80항목×2엔진·이미지4회 통과 |
| T3 | Core/CLI/neutral0.7.16, StyleX0.19.0 고정. React19.2.9·npm/lockfile 유지. 기존 lucide1.31.0 유지/neutral 하위1.72.0 분리. MIT 확인. 기존 Codex 지침 보존과 로컬 CLI 준비 |
| T4 | 기존 CSS import 순서/규칙·@theme inline/:root를 보존하며 명시적 layer로 격리. Core와 테마 CSS는 개발 경로에서만 로드. 실제 compiled CSS를 뒤늦게 추가한 기존4탭×2폭×2엔진에서 계산 스타일·16개 이미지 픽셀 완전 일치. 지연 편집·문법·복원·학습4종도 양 엔진 계산 스타일 일치 |
| T5 | 화이트·차콜·라임, 기존 글꼴 스택, light 고정, 본문/입력16·보조14, 조작44/48, 한국어·줄바꿈·focus·상태색 정적 테마. 새 다크 설정 없음 |
| T6 | 실제 Button/TextInput/TextArea/Card/Selector/Banner의 SSR/hydration·value/event/ref·비활성/처리중 click/Enter/Space 무동작·오류/재시도 상시 노출·요청0 검증. 일반 프로필404, 앱 메뉴 미노출 |

제품 사용·재검사 절차: [Foundation 규칙](../work/astryx-adoption-20261118/docs/ASTRYX_FOUNDATION.md). 결과 원본: [구조화 근거](../.taskmaster/docs/astryx-adoption-implementation.json), [최종 제품 지문](../outputs/astryx-adoption-implementation-20261118/final-source.json).

## 실제 검사

| 명령/범위 | 결과·종료코드 |
| --- | --- |
| npm test / Node22.22.2 | 926/926, exit0 |
| 같은 단위 검사 / Node24.22.3 | 926/926, exit0 |
| npm run typecheck / 두 Node 버전 | 각각 exit0 |
| npm run build / 두 Node 버전, 실제 Astryx 포함 | 각각 exit0 |
| npm run check:grammar-review | 자료/해시 일치, exit0 |
| npm run lint | 오류0·기존15경고, exit0. 생성 선언/doc만 정확히 제외, 작성 테마·검사는 계속 검사 |
| npm ls / npm ci --dry-run --ignore-scripts --no-audit --no-fund | 의존성/lockfile 해소 각각 exit0 |
| npm run astryx -- doctor --built dist/client | pass11/warn1/fail0, exit0. Windows npm shim 판별 경고와 source-purity 미검사 안내 보존 |
| Chromium·WebKit, 14시나리오 | 최종 고유28/28 통과. 최초26회 중25통과/1실패와 수정 재실행 근거 별도 보존 |
| 기존4탭, 390/1440px, 실제 Astryx CSS 지연 추가 | 16view 계산 스타일·16캡처 픽셀 일치 |
| Foundation 320/390/430/768/1440px·200%·reduced motion·OS dark | 명시 light·글자/조작·긴 한국어 정상, 양 엔진 axe 위반0 |
| Foundation padding=0 부정 검사 | 실제 실패 조건 검출 후 복구 통과 |
| npm audit --omit=dev | 도입 전후 moderate1/high0/critical0, 각각 exit1. 신규 운영 의존성 권고0이며 기존 Next.js16.4.1 권고는 미해결 |

관련 시나리오는 디자인·학습 레이아웃·문장 피드백·설정·시트 닫기/본문 스와이프/모션·탭 이동·로컬 초안·백업 워크플로·문법v4·이미지 matrix/production·Foundation이다. 문법15수업135문항과 초안/진도, 백업 revision 충돌·불확실 commit·문장/성적/설정/미완료 초안의 복원도 확인했다. 실제 브라우저는 소유한 루프백 Worker와 합성 계정만 사용했다.

## 보완·제한

- 원본 QA의 빈 의도/옛 현재 응답 표시 때문에 뒤쪽 검사가 막히던 문제를 테스트 데이터에서 고쳤다. 제품의 의도 요구나 과거 응답 보호를 완화하지 않았다.
- WebKit 시트 닫기 검사는 제품의 두 프레임 초점 복원을 즉시 검사해 실패했다. 동일한 목적지 초점 조건을 최대5초 기다리도록 보완했고 두 엔진에서 통과했다.
- Astryx sm 보조 글자가 실제13px여서 최종 검사에 실패한 뒤, supporting 의미 토큰을14px로 명시했다. 실패 원본을 남겼다.
- 기존 입력 테두리 회색은 흰색 대비2.94:1이다. Foundation에만 #8c9385(3.17:1)를 적용했고, 기존 화면은 바꾸지 않았다. 주 행동의 focus/hover/press 텍스트 대비는 최소10.28:1이었다.
- CLI0.7.16 표본 PNG는 이 환경에서 설정 후에도 neutral 파란색이 남았다. CLI Node CSS 로더는 미리보기 import 오류만 우회하며 색/크기 판단 근거로 쓰지 않는다. 실제 built Worker 캡처·계산 스타일이 판단 근거다.
- 일반 홈 CSS gzip은39271→39396바이트(+125)이며 Foundation 전용 CSS는 홈에서 받지 않는다. 성능 전체 출시 판정은 T17에 남긴다.
- 실제 iPhone·한국어 실기기 IME·VoiceOver, Linux 원격 CI, 운영 동작/게시 검사는 이번에 실행하지 않았다. WebKit·로컬 Windows Node22/24 결과와 구분한다.

## 호환·복구·보존

기준 제품500지문 중 바뀐 기존 제품 입력은 globals.css/layout.tsx/package.json/lockfile4개다. 학습·저장·복원 엔진/API·SQL·Site 식별자/DB 바인딩·개인 기록 형식은 유지했다. 새 DB migration이나 저장 설정 필드는 없다. 실제 AI 호출·유료 사용·운영 QA쓰기0이다. 기존5태그와5manifest의 지문, 이전 AI플랜30/40·103/133 및 예산/T39/품질 보류를 보존한다.

위험은 새 테마/CSS의 후속 화면 확대에 있다. T7부터는 같은 Foundation 계약과 화면별 회귀를 유지한다. 복구는 도입한 route/테마/의존성 및 layer import 변경을 함께 되돌리는 소스 변경으로 수행하며 학습 데이터·원장·백업은 건드리지 않는다. 기존 관측/개인 로그는 추가하지 않았다. 경로는 일반 프로필404이며 운영 게시를 하지 않았다.

| 경로 또는 정리 범위 | 분류 | 보관·삭제·보류 | 근거 또는 재생성 방법 | 검증 결과 |
| --- | --- | --- | --- | --- |
| work/astryx-adoption-20261118의 코드·테마·lockfile | 제품/필수 생성 코드 | 보관 | 미병합·후속 검토/복구 필요, npm run theme:build 및 build | 두 Node 빌드·타입 통과 |
| 같은 checkout의 QA/회귀·CLI 로더 | 회귀/재사용 도구 | 보관 | 합성 프로필·fixture·실제 Foundation 재검증 | 28고유 브라우저 검사·926단위 통과 |
| outputs/astryx-adoption-implementation-20261118와 기존 audit/plan 근거 | 평가·검증 근거 | 보관 | 초기 실패·복구·최종 지문/스크린샷/로그의 출처 보존 | 지문/이전5플랜 보존 확인 |
| 테마 preview·편집 이력, dist·합성 QA DB | 생성/검증 자료 | 정리 보류 | 미병합·검토/복구 필요. 생성 preview만 Git 제외, 폴더 일괄 삭제 없음 | 제품 소스/근거 보존, 삭제0 |

Task Master/대시보드는 T1–T6 done·세부20done, G0/G1 passed와 다음 T7 pending을 표시한다. 전체 구현·최종 품질·실기기·게시 관문은 완료시키지 않는다. 대시보드 최종 검증 결과는 별도 `astryx-adoption-dashboard-validation.json`으로 보존하며 최초 계획 등록 검증은 덮어쓰지 않는다.

최종 관리 검증: 계획/실제4318/새로고침·원본 보존6그룹, 기존 sidebar15그룹, 과거 플랜 전환18그룹으로 합계39그룹·세 명령 모두 exit0. Task Master MCP는 done상위1–6·세부20개와 next=T7 pending을 반환했다. 실제 API도6/18·20/62 및 G0/G1 passed·나머지 품질/실기기/게시 미완료를 확인했다.
