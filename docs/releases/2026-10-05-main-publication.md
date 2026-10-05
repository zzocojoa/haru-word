# main 기반 하루단어 v115 게시

2026-10-05 KST에 기존 사이트의 v115 배포가 `succeeded`로 완료됐다. 주소는 https://wordgrain-oxford-study.hoihou-o.chatgpt.site 이다.

| 기준 | 확인값 |
| --- | --- |
| GitHub 제품 기준 | `main@8155a1cc5907c743eda5c21a93c97418bfe03d76` (PR26 병합) |
| Sites 소스 | `72b0565ba58ca9d00843c31cd31ab5f33ef45c49` |
| 파일 일치 | 위 두 커밋의 전체 Git tree `5b05bc3b2e0a6ee9937f2ebd09ca6f766a33c1da`가 동일 |
| 저장 버전 | `appgprj_6ab0a3cbaaa08191a05b0bcdf62df225~appgver_dd572c028b648191977c6f609c80079b` |
| 배포 | `appgdep_6ac2eab7f58481919747c93cace78343`, 환경 revision 59 |
| 공개 범위 | 기존 public/access revision 4 유지 |

이 출시 기록을 추가하는 후속 문서 커밋은 게시 제품 기준과 구분한다. 원래 `codex/ai-card-automation@c65b66d`와 제외한 실험 93개는 보존했다. 전체 실험 브랜치를 main에 병합하거나 후보를 활성화한 작업이 아니다.

## 검증과 보존 범위

- 게시 직전·후 환경59/공개4, 후보 flag와 평가 설정의 부재를 확인했다. Site ID와 D1 바인딩 DB를 유지했고 테이블 이름 8개도 동일했다. 운영 행을 수정하거나 전체 데이터를 검사하지 않았다.
- 로컬 정식 빌드·패키징이 통과했다. 배포 파일에는 Worker 진입점과 기존 마이그레이션 0000~0004가 포함되며 새 마이그레이션은 없다. 카드 Worker 세 개·예약·Secret 변경과 실제 AI·카카오 호출은 없다.
- [게시 전 검증](../DEPLOYMENT_PREFLIGHT_2026-10-05.md)의 모의 16개·회귀65개와 [제품 기준 CI](https://github.com/zzocojoa/haru-word/actions/runs/37244691660)의 Node22/24 각565개 결과를 재사용했다. 이번 게시에서 이 테스트들을 새로 실행한 것으로 표시하지 않는다.
- 실제 비로그인 HTTP 검사 5개: 홈200, 카드307→로그인, 학습/카드API401, 평가API404 `evaluation_disabled`가 통과했다.
- 공개 카드 산출물 중 명세·JS·CSS·폰트1개의 SHA256이 main 파일과 같았다. HTML은 `/card-studio/`로 정규화된 응답에서 제목·카드 자산 참조·root 요소를 확인했다. 응답에 인라인 스크립트1개가 추가되어 전체 바이트는 다르며 추가 스크립트의 동작이나 모든 폰트는 검증하지 않았다.
- 연결된 브라우저가 없어 **인증된 학습·카드 화면과 실제 기기 검증은 미실시**다. 앱에 요청한 카드 탭 열기는 queued였다. 비로그인 검사나 정적 파일 일치를 화면 사용성 검사로 표현하지 않는다.

## 비용·실행 환경·복구

사용자가 이번 대화에서 **현재 Workers Free임을 확인했다**고 답했다. 비용 조건은 사용자 확인에 근거하며, 구독 API403 한계를 직접 조회 성공으로 바꾸지 않는다. 신규 유료 상품·리소스·구독 변경은 없다.

별도 게시 폴더에서 Windows npm shim의 경로 오류는 기존 npm10.9.7의 절대 경로로 설치해 해결했다. 패키징은 로컬 Node22의 비정상 종료(`-1073741819`)를 확인한 뒤 이미 설치된 Node24.19.0과 Git Bash로 통과했다. GNU tar의 `C:` 원격 경로 해석은 게시 프로세스에만 `TAR_OPTIONS=--force-local`을 지정했다. 앱 소스·잠금 파일·전역 런타임·플러그인은 수정하지 않았다. 첫 압축 실패 때 이미 동기화된 소스를 재사용했으며 중복 게시하지 않았다.

복구 대상은 기존 archive-backed **v114**이며 정확한 ID와 해시는 [사전 검증 JSON](2026-10-05-deployment-preflight.json)의 `rollback`을 따른다. 필요하면 같은 public 범위로 해당 버전을 다시 게시한다. D1·사용자 설정·Secret·Worker를 되돌리지 않으며 실제 롤백은 실행하지 않았다.

로컬 근거는 Git 제외 `work/main-publication-native-20261005.json`, `work/main-publication-public-probes-20261005.json`, `work/main-publication-assets-20261005.json`과 배포용 폴더 `work/site-main-publication-20261005/`에 보존했다. 다음 일반 로그인에서 학습 기록·카드 자동화 설정 조회를 확인하면 인증된 화면의 남은 검증을 보완할 수 있다. 저장·복원 QA는 계속 격리된 로컬 데이터에서 수행한다.
