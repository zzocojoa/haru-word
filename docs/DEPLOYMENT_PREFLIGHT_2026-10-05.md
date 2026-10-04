# main 기반 Sites 게시 전 검증

2026-10-05 KST / 대상 제품 커밋 `a0eda3d66e3479e5f3ad3acd30a23404ad2ef5c6` (PR25 병합).

**기술적 사전 검증은 통과했으며 새 배포는 하지 않았다.** 현재 운영은 Site v114·소스 `c65b66d`다. 게시 대상은 기존 Site 하나이며 카드 Worker·DB 마이그레이션·환경·공개 범위·예약은 변경할 필요가 없다. 현재 Cloudflare 계정의 Free 자격은 구독 조회 권한 부족(403)으로 재확인하지 못했다. [기계 판독 근거](releases/2026-10-05-deployment-preflight.json)는 각 조회 시각과 한계를 포함한다.

## 확인한 운영 상태

| 항목 | 결과 |
| --- | --- |
| Site | v114, 배포 succeeded, 기존 주소·Site ID 유지 |
| 환경·공개 범위 | environment revision 59, public/access revision 4 |
| 활성 기능 | 카드 작업실·Google AI·문법 v1~v4·대용량 복원 설정 true |
| 평가 폐쇄 | `english_accuracy_token`, `english_accuracy_expires`, `english_accuracy_profile` 등록 없음; 실제 평가 API는 `404 evaluation_disabled` |
| 후보 선택 | `feedback_coherent_enabled`, `feedback_chunked_enabled`, `feedback_original_sentence_enabled` 등록 없음; 소스는 정확히 문자열 `true`일 때만 해당 분기로 진입 |
| 기존 Secret | 카드 bridge/owner와 Google/Groq Secret 이름만 확인; 값은 도구에서 가려지며 읽거나 복사하지 않음 |
| 카드 Worker | 주·발송·자동 제작 Worker의 버전 및 100% 배분이 기존 출시 기록과 일치 |

카드 Worker 최초 조회는 만료된 저장 토큰으로 401이었고, Wrangler의 기존 인증 갱신 경로로 재조회해 성공했다. 추가 로그인·Secret 교체·배포는 없었다. 갱신 뒤 구독 API는 403이며, 대안으로 요청한 브라우저 연결도 사용할 수 없었다. 현재 청구 상태 확인은 완료로 표시하지 않는다.

## 호환성 검증

- 운영 소스와 후보를 각각 불변 Git 커밋에서 읽어 번들링했다. 실제 공개 설정을 적용하고 합성 키·응답으로 단어/문법 각각 Google 성공, 503·429·네트워크 오류 후 Groq 대체, 불확실 답변, 정책 거절, 양쪽 실패, 사전 취소를 비교했다. **16개 시나리오의 요청 본문·대상·결과·오류·호출 횟수가 일치**했다. 시간에 따라 달라지는 응답 생성 시각만 비교에서 제외했다.
- 두 소스의 평가 API는 현재 설정에서 404로 중단됐다. 로컬 비교 중 실제 네트워크 fetch는 차단했다. 새로운 모델 정확도나 제공자 성공률을 측정한 검사가 아니다.
- 저장·백업·복원·Groq 대체 관련 기존 회귀 **65/65**가 통과했다. 이미 병합한 제품 커밋은 [Node22/24 CI](https://github.com/zzocojoa/haru-word/actions/runs/37242896060)에서 각각 565개, 타입·린트·빌드를 통과했다.
- 운영 D1의 8개 테이블·컬럼 이름과 `db/schema.ts`가 일치했다. `db/`, `drizzle/`, 저장·복원 API, 관련 데이터 검증·서버 코드, 호스팅·의존성·잠금 파일·카드 산출물·화면 코드가 운영 소스와 동일함을 Git으로 확인했다.
- 운영 조회는 테이블당 최대 1행을 요청해 컬럼 메타데이터만 사용했다. 행 값은 출력·보존하지 않았다. 이는 전체 데이터 백업·체크섬·모든 저장 행의 검증이 아니며 SQL 타입·인덱스도 원격 대조하지 않았다.
- 실제 비로그인 요청에서 홈200, 카드 페이지307→로그인, 학습/카드 API401, 닫힌 평가 API404를 확인했다. 인증된 사용자 화면·실제 iPhone·새 AI 제작·카카오 수신·원격 CPU는 이번에 시험하지 않았다.

초기 HTTP 검사에서 카드 페이지를 직접200으로 가정해 로그인 리디렉션에 걸렸다. 인증 소스를 확인해 307→같은 사이트 로그인 경로를 정상 결과로 검사했으며 제품 코드는 바꾸지 않았다.

## 배포 범위와 복구

실험93개는 원래 커밋에 보존하고 신규 게시물에서 제외한다. 현재 비활성 후보 분기를 생략하므로 소스 전체의 파일 동일성을 요구하지 않는다. 공개된 학습·카드 동작과 데이터 계약의 호환성을 위 검사로 확인했다. 다른 설정에서의 후보 재활성화는 이번 범위에 포함하지 않는다.

복구 대상은 아카이브가 저장된 기존 **Site v114**다. 다음 게시에서도 기존 public 범위를 유지하고, 문제가 생기면 이 저장 버전을 다시 게시한다. v114의 원본·버전 ID·아카이브 해시와 세 Worker 버전은 근거 JSON에 있다. D1·사용자 설정·Secret·Worker를 예전 값으로 되돌리지 않는다. 실제 롤백은 실행하지 않았다.

게시 직전 체크리스트:

- [ ] 최신 Site 버전과 환경59/공개4가 이 기록 이후 바뀌지 않았는지 재조회한다. 달라졌으면 변경 이유와 호환성을 먼저 확인한다.
- [ ] 평가 설정·후보 flag가 계속 없거나 비활성인지 확인한다. 실험을 다시 켜거나 과거 승인 잔여량을 재사용하지 않는다.
- [ ] 정확한 후보 제품 커밋과 기존 Site ID를 source helper에 연결하고, 기존 archive-backed v114를 복구 대상으로 보존한다.
- [ ] 현재 비용 조건의 미확인 범위를 해소하고 승인된 기존 Sites 절차로 게시한다. 새 자원·결제·Worker 변경은 포함하지 않는다.
- [ ] 게시 후 인증된 학습·카드 조회를 확인하고, 저장·복원 회귀는 격리한 로컬 데이터로 검사한다. 배포 ID와 실제 확인 범위를 출시 기록에 남긴다.

## 로컬 재검증

```powershell
node --experimental-strip-types --test tests/groq-fallback.test.mjs tests/backup.test.mjs tests/state-roundtrip.test.mjs tests/state-api.test.mjs tests/restore-jobs.test.mjs tests/restore-client.test.mjs
```

이번 비교 helper와 로그는 Git 제외 `work/runtime-deployment-differential-20261005.*`, `work/runtime-preflight-regression-20261005.log`, `work/runtime-preflight-public-probes-20261005.*`다. 별도 실제 제공자 호출이나 운영 데이터 수정 없이 실행했다.
