# 발음 UI 개선 · 하루단어 v116

2026-10-05 KST에 [하루단어 PR28](https://github.com/zzocojoa/haru-word/pull/28)을 `main`에 병합하고 [기존 사이트](https://wordgrain-oxford-study.hoihou-o.chatgpt.site)에 v116을 게시했다. 배포 상태는 `succeeded`다.

듣기 버튼·사전 링크·짧은 재생 상태를 한 줄에 배치하고, 긴 볼륨·브라우저·음질 안내는 닫힌 **음성 도움말**로 옮겼다. 재생 오류는 도움말을 열지 않아도 보인다. 모바일의 좁은 화면에서는 줄바꿈한다. 단어의 검토한 발음과 사전 우선 정책은 유지한다.

| 기준 | 확인값 |
| --- | --- |
| GitHub 제품 기준 | `main@7b3bf263e6ff0fd047e6331570d28c652e36dab8` (PR28 병합) |
| 검토·로컬 QA 대상 | `36ff3d6d5c66b65de395e40a3471ae329acd93a3` |
| Sites 소스 | `e369ed8d5b1dfb4a0895820cef2d30486649f9e5` |
| 파일 일치 | 제품 기준과 Sites 소스의 전체 tree `09dfb5ba0aaaf96344b3917c4b0e1e1b1bf95b64` 동일 |
| 저장 버전 | `appgprj_6ab0a3cbaaa08191a05b0bcdf62df225~appgver_eacabd44ba588191aac346c258365930` |
| 배포 | `appgdep_6ac31d1904d88191a447e522ad861e8c` |
| 환경·접근 | 환경 revision 59, 기존 public/access revision 4 유지 |

후속 출시 기록 문서 커밋은 위 게시 제품 기준에 포함하지 않는다. [중앙 출시 기록](product-status.json)의 `pronunciationUiPublication`이 이번 출시이며 `mainPublication`은 v115 당시 기록이다. 카드 Worker 버전은 기존 확인 시각의 기록을 유지했고 이번에 재조회·배포하지 않았다.

## 검증 범위

- [병합 main CI](https://github.com/zzocojoa/haru-word/actions/runs/37260262950)에서 Node22/24 각각565/565, 실패·skip0, 타입·문법 원장·린트·Worker 빌드 성공. 기존 린트 경고13개는 유지한다.
- 검토한 head의 로컬 Chromium/WebKit 각11개 묶음 결과를 재사용했다. 320/390/1440px·100/200% 글자·44px 터치 영역·키보드·axe0, 준비/재생/오류/재시도/미지원 상태, 사전 정책과 학습 기록·revision 불변을 확인했다. 실제 운영 사용자 계정으로 반복하지 않았다.
- 준비 상태 QA의 실제4초 타이머 경합을 가상 시계로 격리했다. 같은 CPU20배 감속 조건에서 검사13656ms 후 준비 상태·시작 이벤트 처리 유지, 전체 QA 통과. 별도3999/4000ms 경계 검사와 음성 단위19/19도 통과했다. 앱 음성 엔진의4초 제한은 바꾸지 않았다.
- 게시 폴더의 정식 잠금 설치·빌드·패키징 성공. Windows npm shim 경로는 이 작업의 임시 실행 경로에서만 절대 npm CLI로 우회했고 기존 Node24와 프로세스별 `TAR_OPTIONS=--force-local`을 사용했다. 전역 런타임·플러그인·잠금 파일 변경은 없다.
- 실제 비로그인 HTTP4개: 홈200·카드307 로그인·학습/카드 API401. 새 UI JavaScript와 CSS 두 파일의 SHA256이 배포용 빌드와 일치했다. 이는 게시 파일 확인이며 인증된 화면 사용성·실제 발음 재생 확인이 아니다.
- 초기 UI 검토2건과 후속 QA 경합1건을 보완한 뒤 남은 지적0. 같은 모델의 독립 문맥 검토이며 보조 Codex CLI의 기존 모델 응답 비호환은 완료·교차 모델 검토로 포함하지 않는다.

## 호환성·복구·미검증

낮은 위험의 표시 개선이다. 학습 기록·DB/API·백업·revision·음성 엔진·AI 요청 정책은 변경하지 않았고 새 마이그레이션과 관측 항목은 없다. Site ID·D1 바인딩을 유지한다. 실제 AI/카카오 호출·운영 학습 QA 쓰기·환경/접근 설정 변경은 없다. 신규 유료 구성도 없다.

문제 발생 시 직전 호환 버전 **v115**를 같은 public 범위로 다시 게시하거나 UI 변경을 revert해 새 버전을 게시한다. v115의 정확한 버전 ID·archive 해시는 `product-status.json`의 `pronunciationUiPublication.rollback`을 따른다. DB·예약·Secret·카드 Worker를 되돌릴 필요는 없으며 실제 롤백은 실행하지 않았다.

실제 iPhone·ChatGPT 앱의 소리와 VoiceOver, 운영에 로그인한 학습 화면 검증은 미실시다. 브라우저 탭 열기 요청은 queued였으며 실제 열림으로 표시하지 않는다. 다음 일반 사용 때 확인할 수 있지만 기기 음성이 보장됐다고 표현하지 않는다.

안전한 로컬 근거는 Git 제외 `work/pronunciation-publication-{native,post,http}.json`, `work/pronunciation-merged-main-ci.log`, `work/pronunciation-clock-fix-report.md`, `outputs/pronunciation-ui/`와 게시용 폴더 `work/site-pronunciation-publication-20261005/`에 보존한다.
