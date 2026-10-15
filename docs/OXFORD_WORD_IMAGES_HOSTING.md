# Oxford 이미지 호스팅·원격 검증

## 현재 상태 — 3,809개 완료·업로드 권한 폐기

사용자가 v130 운영 게시·전체 업로드/검증·임시 권한 제거를 명시적으로 승인했다. 기존 Site의 **v130**·소스 `d628cb5f7af45381ae71a76dea3313d816997f21`을 게시하고 **3,809개, 총128,592,754바이트(128.6MB)**를 원격 검증했다. 임시 권한 폐기 후 같은 v130을 다시 게시한 상태에서 **3,809개 전체를 다시 GET/HEAD 검사**했다. 최종 재검증의 PUT은0회이며 원격 바이트·SHA·MIME·캐시·ETag·HEAD 크기가 모두 일치했다.

최종 환경은 **revision71·원래13개 항목**, 공개 정책은 **revision4**다. 이전 업로드 키의 PUT은404 `upload_disabled`, 이미지 GET은200·조건부 GET은304임을 확인했다. **학습 화면은 기존 시범20개를 유지**하며 이20개 원격 파일의 SHA와 홈의 시범 활성화도 다시 확인했다. 전체 학습 UI 연결·AI 실행·운영 학습 기록 수정은 없다.

[최종 배포·권한 폐기·회차별 검증 보고서](releases/2026-10-15-oxford-image-hosting-rollout.json)와 `data/word-image-hosted-manifest.json`이 현재 인수인계 기준이다. [이전 게시 차단 기록](releases/2026-10-15-oxford-image-hosting.json)은 당시0개·승인 대기 상태의 이력으로 보존한다. 작업 브랜치는 `codex/oxford-web-catalog`다. 로컬 도구의 전송/기록 보완과 관리 문서는 별도 커밋이며, 운영 코드는 위 v130 소스를 유지한다.

| 확인 대상 | 최종 결과 |
|---|---|
| 원격 이미지 / 고유 URL / 항목 ID | 각각3,809개 |
| MIME / 캐시 | `image/webp` / `public, max-age=31536000, immutable` |
| 권한 폐기 후 전체 검사 | GET3,809·HEAD3,809·PUT0, 실패0 |
| 임시 업로드 권한 | 이전 키 PUT404, 환경 항목2개 삭제 |
| 기존 화면 / 기록 | 시범20개 유지, QA 학습 API/기록 쓰기0 |
| 최종 연결 목록 SHA256 | `40fa4706fb89903504e991ba31407169a764b06e3e16a0fca22dc9308ca3205f` |

중간 중단4회(전송 연결3·로컬 기록 쓰기1)를 실패로 보존했다. 응답을 잃은 PUT은 원격 저장 여부/해시를 확인한 뒤 수동으로 재개했고 자동 PUT 재시도는0회다. 마지막 업로드와 권한 폐기 후 전체 검사는 Node24.19.0에서 중단/읽기 재시도 없이 통과했다. 최종 코드의 전체 테스트612개와 관련 린트가 종료0이며, 운영 v130의 타입·빌드·로컬 R2 검사는 준비 단계에서 통과한 동일 소스 결과다. 실제 iPhone·Node24 CI는 검사하지 않았다.

## 범위

2026-10-15 사용자가 전체 3,809개 업로드와 원격 파일·헤더 검증을 승인했다. 기존 Site `appgprj_6ab0a3cbaaa08191a05b0bcdf62df225`의 공개 범위와 D1 `DB`를 유지하고 R2 `BUCKET`만 연결한다. 기준 운영은 v129, 환경 revision65, 공개 정책 revision4다. 이번 화면은 기존 시범20개를 유지하고 전체 학습 UI 활성화·AI·학습 기록 수정은 수행하지 않는다.

## 저장·제공 계약

- [웹 가공 결과](OXFORD_WORD_IMAGES_WEB_PREPARATION.md)의 승인 목록과 같은 3,809개 해시/용량만 `data/word-image-hosting-index.json`에 둔다. `npm run images:host:index`로 생성한다. 전체 교재·제작 이력은 서버의 작은 허용 목록에 넣지 않는다.
- R2 object key는 `oxford-images/v1/<SHA256>.webp`, 사이트 URL은 `/word-images/v1/<SHA256>.webp`다. 동일 철자의 서로 다른 뜻은 각각의 항목 ID/이미지 해시를 유지한다.
- 공개 GET/HEAD는 허용한 키만 읽고 `image/webp`, `public, max-age=31536000, immutable`, SHA 기반 ETag와 `nosniff`를 반환한다. 오류는 `no-store`다. R2는 Worker API를 통해서만 노출하며 계정 자격 증명을 브라우저에 전달하지 않는다. [Cloudflare 공식 API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)의 조건부 저장·체크섬·HTTP metadata를 사용한다.
- PUT은 임시 Secret `word_image_upload_key`와 `word_image_upload_expires`가 설정된 기간에만 허용한다. 만료는 현재부터 최대6시간 이내이며, 정확한 Origin·Bearer 인증 후 본문을 읽는다. 실제 바이트 수·WebP 시그니처·SHA를 검사한 뒤 `If-None-Match: *`로 저장하여 기존 파일을 덮어쓰지 않는다. R2에도 SHA256 검증과 MIME/캐시 metadata를 전달한다.
- 권한 폐기는 아래의 실제 확인 절차를 따른다. GET/HEAD와 저장한 이미지는 유지한다. 임시 키는 실행 세션 메모리·비공개 stdin·Sites Secret에서만 사용하며 Git·파일·명령 인자·진단에 기록하지 않는다.

## 업로드 권한 폐기 — 순서와 확인

이번에 환경 목록에서 두 Secret을 삭제하고 revision69로 재게시한 뒤에도 이전 키가 인증 단계를 통과해413 `invalid_image_size`가 반환됐다. **환경 목록 삭제와 배포 성공만으로 실제 권한 폐기를 완료 처리하지 않는다.** 어느 플랫폼 계층에서 값이 유지됐는지는 확정하지 않았다.

1. 두 임시 값만 명시적으로 무효화한다. 업로드 키는 허용한64자리16진수 형태가 아닌 폐기 값으로 교체하고 만료일을 과거로 설정한다. 기존13개 환경 항목은 건드리지 않는다.
2. 같은 R2 지원 버전을 게시하고 **기존 키·승인된 이미지 경로·빈 본문 PUT**이404 `upload_disabled`인지 확인한다. 이 시험은 이미지 쓰기까지 도달하지 않는다. 이번 revision70에서 확인했다.
3. 두 임시 항목을 삭제하고 다시 같은 버전을 게시한다. 목록에 원래13개만 있는지 대조하고, 기존 키의 PUT404를 다시 확인한다. 이번 revision71에서 확인했다.
4. GET/HEAD·조건부 GET과 전체 파일의 SHA/MIME/캐시를 확인한다. R2 바인딩과 이미지 키를 삭제하지 않는다. 사용했던 키는 세션 메모리에서도 폐기한다.

## 실행과 검증

`npm run images:host:upload -- --canary`로 한 장을 먼저 저장·검증한다. 같은 Origin에서 공개 GET과 HEAD의 MIME·캐시·ETag·크기를 확인하고, 수신한 전체 바이트의 SHA를 로컬 승인값과 비교한다. 운영에서 이 검사가 통과한 후 전체 업로드를 실행한다. 업로드 CLI는 한 줄 JSON의 `token`을 **숨긴 stdin**으로 받으며 화면이나 셸 인자로 전달하지 않는다.

```powershell
npm run images:host:upload
npm run images:host:verify
```

검증 전용 명령은 키를 받거나 PUT을 호출하지 않는다. 업로드는 동시에4개만 처리하며 이미 있는 파일은 원격 검증 후 재사용한다. 실패한 쓰기를 자동 재시도하지 않는다. 재실행하면 원격 GET으로 실제 저장 여부를 먼저 확인한다. 연결 재사용을 끄고 GET/HEAD의 `ECONNRESET`·`UND_ERR_SOCKET`만 최대1회 재조회한다. PUT·HTTP 오류는 자동 재시도하지 않고, 모든 실제 요청/재시도 횟수를 보고서에 남긴다. 잘못된 파일/헤더는 덮어쓰지 않고 중단한다.

기록은 회차당 한 개의 `receipts.jsonl`에 항목별 JSON을 순차 기록하고25개마다·완료 시 fsync한다. 최종 `report.json`에도 항목별 결과를 보존한다. 이전 방식의 개별 JSON 기록은 중단 회차의 원문으로 남겼다. 해당 회차에서 로컬 쓰기 `ENOSPC`와 빈 기록3개를 확인했지만 약19.8GB 여유 공간과1MB 시험 쓰기 성공도 확인했으므로 단순 디스크 부족으로 단정하지 않는다. 원본·기존 검증 기록을 삭제하지 않고 기록 방식과 로컬 Node 런타임을 보완했다.

GET이 스트리밍 전송이면 `Content-Length`가 없을 수 있다. 있으면 승인 크기와 같아야 하고, 없어도 실제 수신 바이트 수와 SHA를 모두 검사한다. HEAD는 정확한 `Content-Length`와 빈 본문이 필수다. GET/HEAD 모두 MIME·1년 immutable 캐시·ETag·nosniff가 맞아야 통과한다.

| 산출물 | 위치 |
|---|---|
| 원격 연결 목록 — 전체 검증 성공 후에만 작성 | `data/word-image-hosted-manifest.json` |
| 항목별 실제 GET/HEAD 증거 | `outputs/oxford-hosting/<교재 SHA>/runs/<UUID>/receipts.jsonl` |
| 회차별 완료/실패·요청 수·전체 증거 | 같은 회차의 `report.json` |
| 기존 로컬 WebP/업로드 목록 | [가공 문서](OXFORD_WORD_IMAGES_WEB_PREPARATION.md)의 정확한 위치 |

`outputs/`는 Git 제외다. 저장소를 clone했다고 이미지나 원격 검증 원문이 포함되는 것은 아니다. 실제 회차·배포 버전·총용량·원격 목록/보고서/순차 기록 해시와 권한 제거 결과는 위 최종 보고서에 보존한다. 이 PC의 루트는 `C:/Users/user/.codex/worktrees/word-image-pilot/하루단어`이며, 최종 검증 회차는 `outputs/oxford-hosting/14552b36a1653f2aed9e14b09c833c0031b1204de5e0bdfc6902543a05d4ba6e/runs/f9bce8ab-1bda-4038-966c-a9eea45bc6a5/`다.

## 검증·복구·관측

도구 검사는 미승인 경로·만료·잘못된 키/Origin·과대/손상 입력·조건부 저장·GET/HEAD/304와 안전한 오류를 검사한다. 업로더 검사는 공개 읽기에 키 미전달, 실패한 PUT 자동 재시도 없음, 원격 바이트/헤더 오류, 재실행의 기존 파일 재사용을 검사한다. 로컬 built Worker와 격리한 R2에서도 실제 저장·재저장 보호·GET/HEAD/304를 검사한다.

로컬 Miniflare에서 인증을 거절한 PUT 직후 같은 시험의 유효 PUT에503 `worker restarted mid-request`가 재현됐다. 거절 요청을 마지막에 보내는 시험에서는 정상201/200·공개 GET/HEAD·304·403을 확인했다. 이 로컬 실행 한계와 초기 검사 실패 기록은 보존하고, 운영의 단일 이미지 검증을 별도 필수 단계로 둔다. 자동 재시도로 성공을 표시하지 않는다.

위험도는 중간이다. 영구 파일 저장·공개 이미지 경로와 임시 관리 PUT을 추가하지만 DB·학습 API·백업/revision·이미지 연습 화면은 변경하지 않는다. DB 마이그레이션과 기존 이미지 삭제는 없다. 실패 시 신규 업로드를 중단하고 위 절차로 키를 먼저 무효화·만료·재게시하여 실제 차단을 확인한 뒤 임시 항목을 삭제한다. R2 바인딩·기존 파일·GET 지원은 보존한다. 이전 `r2:null` 소스를 단순 재게시하는 방식으로 복구하지 않는다.

관측은 이미지 해시·바이트·응답 상태·MIME/캐시와 안전한 실패 코드뿐이다. 개인 문장·학습 답·키·Authorization 헤더를 기록하지 않는다. 실제 iPhone·전체 UI 연결·Node24 CI·재난 복구용 외부 백업은 이번 검증 범위가 아니다.
