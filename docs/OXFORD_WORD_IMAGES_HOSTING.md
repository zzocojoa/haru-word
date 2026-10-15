# Oxford 이미지 호스팅·원격 검증

## 현재 상태 — 게시 승인 대기

R2 제공 경로·보호된 업로드·검증기 구현, 전체611개 테스트·타입·린트·빌드와 로컬 R2 검증을 마쳤다. 기존 Site의 **v130**에 소스 `d628cb5f7af45381ae71a76dea3313d816997f21`과 검증한 배포 아카이브를 저장했다. **운영 게시의 자동 승인 검토가 거절되어 배포는 시작하지 않았다. R2 업로드0/3,809개, 원격 검증0/3,809개다.**

거절 사유는 사용자가 이미지 업로드·원격 검증은 승인했지만, 이를 위해 필요한 기존 운영 Site의 v130 게시까지 명시하지 않았다는 것이다. 우회 게시나 다른 호스팅으로의 전환은 수행하지 않는다. 추가한 임시 Secret 두 개는 제거했고, 환경 revision67에서 기존13개 항목의 값/비공개 속성이 이전과 같음을 확인했다. 공개 정책 revision4·DB·학습 화면·원본·기존20개를 유지한다.

[저장 버전·검증·차단·재개 기록](releases/2026-10-15-oxford-image-hosting.json)을 먼저 읽는다. 게시 승인 뒤에는 현재 상태를 다시 확인하고 새 임시 키를 설정해 같은 저장 버전을 게시한다. 첫 원격 이미지 검사 통과 전 전체 전송을 시작하지 않는다. 전송 후 키 제거와 같은 R2 버전 재게시·읽기 검증까지 마쳐야 완료다.

## 범위

2026-10-15 사용자가 전체 3,809개 업로드와 원격 파일·헤더 검증을 승인했다. 기존 Site `appgprj_6ab0a3cbaaa08191a05b0bcdf62df225`의 공개 범위와 D1 `DB`를 유지하고 R2 `BUCKET`만 연결한다. 기준 운영은 v129, 환경 revision65, 공개 정책 revision4다. 이번 화면은 기존 시범20개를 유지하고 전체 학습 UI 활성화·AI·학습 기록 수정은 수행하지 않는다.

## 저장·제공 계약

- [웹 가공 결과](OXFORD_WORD_IMAGES_WEB_PREPARATION.md)의 승인 목록과 같은 3,809개 해시/용량만 `data/word-image-hosting-index.json`에 둔다. `npm run images:host:index`로 생성한다. 전체 교재·제작 이력은 서버의 작은 허용 목록에 넣지 않는다.
- R2 object key는 `oxford-images/v1/<SHA256>.webp`, 사이트 URL은 `/word-images/v1/<SHA256>.webp`다. 동일 철자의 서로 다른 뜻은 각각의 항목 ID/이미지 해시를 유지한다.
- 공개 GET/HEAD는 허용한 키만 읽고 `image/webp`, `public, max-age=31536000, immutable`, SHA 기반 ETag와 `nosniff`를 반환한다. 오류는 `no-store`다. R2는 Worker API를 통해서만 노출하며 계정 자격 증명을 브라우저에 전달하지 않는다. [Cloudflare 공식 API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)의 조건부 저장·체크섬·HTTP metadata를 사용한다.
- PUT은 임시 Secret `word_image_upload_key`와 `word_image_upload_expires`가 설정된 기간에만 허용한다. 만료는 현재부터 최대6시간 이내이며, 정확한 Origin·Bearer 인증 후 본문을 읽는다. 실제 바이트 수·WebP 시그니처·SHA를 검사한 뒤 `If-None-Match: *`로 저장하여 기존 파일을 덮어쓰지 않는다. R2에도 SHA256 검증과 MIME/캐시 metadata를 전달한다.
- 임시 권한을 제거하고 같은 R2 바인딩을 유지한 채 재게시하면 PUT은404가 된다. GET/HEAD와 저장한 이미지는 유지한다. 임시 키는 실행 세션 메모리·비공개 stdin·Sites Secret에서만 사용하며 Git·파일·명령 인자·진단에 기록하지 않는다.

## 실행과 검증

`npm run images:host:upload -- --canary`로 한 장을 먼저 저장·검증한다. 같은 Origin에서 공개 GET과 HEAD의 MIME·캐시·ETag·크기를 확인하고, 수신한 전체 바이트의 SHA를 로컬 승인값과 비교한다. 운영에서 이 검사가 통과한 후 전체 업로드를 실행한다. 업로드 CLI는 한 줄 JSON의 `token`을 **숨긴 stdin**으로 받으며 화면이나 셸 인자로 전달하지 않는다.

```powershell
npm run images:host:upload
npm run images:host:verify
```

검증 전용 명령은 키를 받거나 PUT을 호출하지 않는다. 업로드는 동시에4개만 처리하며 이미 있는 파일은 원격 검증 후 재사용한다. 실패한 쓰기를 자동 재시도하지 않는다. 재실행하면 원격 GET으로 실제 저장 여부를 먼저 확인한다. 잘못된 파일/헤더는 덮어쓰지 않고 중단한다.

GET이 스트리밍 전송이면 `Content-Length`가 없을 수 있다. 있으면 승인 크기와 같아야 하고, 없어도 실제 수신 바이트 수와 SHA를 모두 검사한다. HEAD는 정확한 `Content-Length`와 빈 본문이 필수다. GET/HEAD 모두 MIME·1년 immutable 캐시·ETag·nosniff가 맞아야 통과한다.

| 산출물 | 위치 |
|---|---|
| 원격 연결 목록 — 전체 검증 성공 후에만 작성 | `data/word-image-hosted-manifest.json` |
| 항목별 실제 GET/HEAD 증거 | `outputs/oxford-hosting/<교재 SHA>/runs/<UUID>/<이미지 SHA>.json` |
| 회차별 완료/실패·요청 수·전체 증거 | 같은 회차의 `report.json` |
| 기존 로컬 WebP/업로드 목록 | [가공 문서](OXFORD_WORD_IMAGES_WEB_PREPARATION.md)의 정확한 위치 |

`outputs/`는 Git 제외다. 저장소를 clone했다고 이미지나 원격 검증 원문이 포함되는 것은 아니다. 파일을 성공적으로 올린 뒤에 실제 회차·배포 버전·총용량·원격 목록/보고서 해시와 권한 제거 결과를 별도 출시 기록에 보존한다.

## 검증·복구·관측

도구 검사는 미승인 경로·만료·잘못된 키/Origin·과대/손상 입력·조건부 저장·GET/HEAD/304와 안전한 오류를 검사한다. 업로더 검사는 공개 읽기에 키 미전달, 실패한 PUT 자동 재시도 없음, 원격 바이트/헤더 오류, 재실행의 기존 파일 재사용을 검사한다. 로컬 built Worker와 격리한 R2에서도 실제 저장·재저장 보호·GET/HEAD/304를 검사한다.

로컬 Miniflare에서 인증을 거절한 PUT 직후 같은 시험의 유효 PUT에503 `worker restarted mid-request`가 재현됐다. 거절 요청을 마지막에 보내는 시험에서는 정상201/200·공개 GET/HEAD·304·403을 확인했다. 이 로컬 실행 한계와 초기 검사 실패 기록은 보존하고, 운영의 단일 이미지 검증을 별도 필수 단계로 둔다. 자동 재시도로 성공을 표시하지 않는다.

위험도는 중간이다. 영구 파일 저장·공개 이미지 경로와 임시 관리 PUT을 추가하지만 DB·학습 API·백업/revision·이미지 연습 화면은 변경하지 않는다. DB 마이그레이션과 기존 이미지 삭제는 없다. 실패 시 신규 업로드를 중단하고 임시 Secret을 제거·재게시한다. R2 바인딩·기존 파일·GET 지원은 보존한다. 이전 `r2:null` 소스를 단순 재게시하는 방식으로 복구하지 않는다.

관측은 이미지 해시·바이트·응답 상태·MIME/캐시와 안전한 실패 코드뿐이다. 개인 문장·학습 답·키·Authorization 헤더를 기록하지 않는다. 실제 iPhone·전체 UI 연결·Node24 CI·재난 복구용 외부 백업은 이번 검증 범위가 아니다.
