# 영어 카드 작업실 통합

2026-10-02 / 로컬 구현·검증, 운영 반영 전

기존 하루단어 로그인으로 본인만 `/cards`에서 카드 제작·PNG 저장·카카오 예약을 사용한다. 학습 화면에 영어 카드 버튼을 추가하며 이동 전 학습·문법 작성 보호를 따른다. 다른 ChatGPT 계정에는 카드 API와 작업실을 허용하지 않는다.

카드 화면은 같은 출처의 `public/card-studio`에 배치하여 제3자 쿠키 없이 동작한다. `app/api/card-studio/[...path]/route.ts`와 `lib/server/card-studio.ts`가 본인 ID·출처·메서드·경로·본문 한도를 검사하고 기존 EN_Card 서버와 통신한다. 기존 D1/KV/Cron과 이미지 URL을 그대로 사용한다. 학습 기록·AI 제공자·피드백 후보·Site ID·DB 바인딩·공개 정책을 바꾸지 않는다.

## 운영 설정

- `card_studio_enabled`: `true`로 설정하기 전에는 비활성.
- `card_studio_owner_id`: 이 Site에 로그인한 운영자 본인의 `userId`. 다른 Site의 ID나 이메일로 대체하지 않는다.
- `card_studio_bridge_secret`: 기존 카드 서버의 `STUDIO_BRIDGE_SECRET`과 일치하는 서버 전용 난수.
- `card_studio_origin`: 기존 EN_Card HTTPS 출처.
- 카드 서버에는 동일한 `STUDIO_OWNER_ID`와 반환 출처 `STUDIO_ORIGIN`도 필요하다. 이 값들은 브라우저나 Git에 넣지 않는다.

초기 본인 계정 매핑에는 해당 사용자가 로그인한 `/api/card-studio/account`를 사용한다. 이 경로는 로그인한 자신의 ID와 기능 사용 가능 여부만 반환하며 전체 사용자 목록·카드·학습 답안은 반환하지 않는다. 기능을 비활성 상태로 먼저 게시하고 운영자 매핑과 서버 키를 설정한 뒤 활성화한다. 카카오 연결은 기존 것을 유지하며 재연결 시 일회용 요청과 기존 카카오 운영자 검사 후 `/cards`로 돌아온다.

## 빌드·검증

브라우저가 JSON API의 직접 탐색을 차단하면 로그인한 `/cards`의 잠금 화면에서 **계정 연결 정보**를 펼쳐 본인의 사이트별 식별자를 확인한다. 이 정보도 현재 로그인한 본인에게만 표시한다.

UI 원본은 EN_Card 저장소에 있다. 그 체크아웃에서 `node scripts/export-haru.mjs --target <이 체크아웃의 절대 경로>`로 내보낸다. `public/card-studio/source.json`은 원본·산출물 SHA256을 기록한다. `.gitattributes`는 이 생성 폴더의 Git 줄바꿈 변환을 막아 Windows에서도 해시를 유지한다. 생성된 번들을 손으로 수정하지 않는다. 이 경로만 eslint에서 제외하며 원본은 EN_Card의 타입·서식·브라우저 검사로 검증한다.

```powershell
New-Item -ItemType Directory -Path work -Force
npm test
npm run typecheck
npm run lint
npm run build
```

전체 테스트 714개·타입 통과, lint 오류 0·기존 경고 13. 별도 EN_Card 검사에서 Chromium·WebKit 모두 하루단어 로그인→표현형/비교형 PNG→검토·예약→학습 복귀와 기록 불변을 확인했다. 로컬 전용 `.env`의 가짜 계정·키·localhost를 운영에 사용하지 않는다. 배포용 빌드에서는 이 파일을 제외한다. 실제 카카오 인증·운영 CPU·iPhone은 이번 통합에서 아직 검증하지 않았다.

## 게시·복구 확인표

- [ ] 기존 Site의 정상 source 동기화·빌드·게시 절차 사용, 접근 정책과 기존 환경 값 보존.
- [ ] 카드 서버 배포와 본인 ID/서버 키 일치 확인 후 기능 활성화.
- [ ] 본인 외 카드 API 거부, 기존 학습 저장·AI 기능과 카드 데이터 보존 확인.
- [ ] 실제 예약 발송은 별도 승인 범위에서 검증.
- [ ] 장애 시 `card_studio_enabled` 비활성화 후 기존 EN_Card 주소 사용. 데이터 이전·스키마 변경 없음.

이 변경은 운영 소스 b3b686f에서 분리한 `codex/card-studio-integration` 브랜치에 있다. 현재 진행 중인 정확성 개선 PR을 임의로 병합하지 않고 통합 변경만 검토한다.
