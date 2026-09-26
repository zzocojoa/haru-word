# 홈 화면 실행의 초기 표시

2026-09-26 · 변경 전 배포 v67 (`9a0bb56ad6dfeb3444dc65fee6286b697a96b58c`)

## 문제와 변경

첨부한 iPhone 영상의 첫 실행에서 약 0.8초의 흰 화면 다음에 기존 로딩 안내가 나타났다. 실제 운영 기기의 네트워크를 측정한 것은 아니므로 iOS의 실행 전환과 웹 로딩 지연의 비율은 확정하지 않는다.

기존 전역 CSS 첫 줄의 Google Fonts `@import`는 폰트 스타일 응답을 기다리는 동안 최초 화면 표시를 막았다. 로컬 WebKit에서 해당 응답을 보류하면 로딩 안내도 표시되지 않는 것을 재현했다. 반면 JavaScript만 보류하면 서버가 렌더링한 헤더와 로딩 안내는 보였다.

- `app/web-fonts.tsx`: 서버 HTML에는 외부 폰트 스타일을 넣지 않는다. 화면을 구성한 뒤 효과에서 링크를 한 번 연결하고, 컴포넌트 해제 시 소유한 링크를 제거한다. 기존 DM Sans/Noto Sans KR, 굵기와 `display=swap`을 유지한다. 지연·실패 시 시스템 대체 글꼴로 계속 이용한다. 추가 재시도·전체 화면 덮개·강제 대기 시간은 없다.
- `app/layout.tsx`: 기존 로딩 UI와 아이콘을 유지하며 manifest, 테마 색상, iOS 실행 정보를 연결한다. Vinext가 생성하는 일반 `mobile-web-app-capable`과 별도로 이전 iOS용 Apple 메타 태그를 명시한다.
- `lib/startup-images.ts`, `public/startup/`: 13개 화면 규격의 세로/가로 PNG 26개. 사용자 영상의 1320×2868 규격을 포함한다. 흰 배경과 기존 책 아이콘만 사용하며 개인 학습 데이터·진도·가짜 버튼은 담지 않는다.
- `public/manifest.webmanifest`: 기존 루트 URL에서 실행하고 현재 이름·브랜드 아이콘·배경색을 사용한다. 서비스 워커, 오프라인 데이터 캐시, 새 로그인 경로는 추가하지 않는다.

이미지는 `node --experimental-strip-types scripts/generate-startup-images.mjs`로 재생성한다. 현재 빌드 도구에 이미 설치된 Sharp를 이용하며 새 의존성은 추가하지 않았다. 파일은 버전 관리되므로 일반 빌드에서 재생성할 필요가 없다. 화면 규격을 추가하면 이미지 재생성과 자산 검사를 함께 실행한다.

## 검증

- 전체 단위 테스트 348개 통과. 모든 시작 이미지의 PNG 크기·참조, 영상 규격과 manifest 아이콘을 포함한다.
- 타입 검사·빌드 통과. 린트 오류 0개, 기존 경고 14개.
- `tests/startup-render-qa.cjs`: WebKit과 Chromium에서 폰트 CSS 대기·실패, JS 대기, 기록 대기, JS 미실행을 검사한다. 응답을 풀기 **전** 실제 헤더·로딩 UI·조작 가능 여부를 확인한다. 준비 완료만 기다리는 성능 검사와 구분한다.
- 위 브라우저 두 종류에서 320×568, 390×844, 440×956, 956×440의 시작 이미지가 정확히 하나씩 매칭되는지, PNG가 실제 제공되는지, HTML 메타데이터가 올바른지 확인했다. OS의 실제 시작 이미지 선택을 시험한 것은 아니다.
- 기존 `ui-refresh-qa.cjs`: 네 탭, 320–1440px 10개 폭, 글자 200%, 접근성 8개 화면, 입력·기록 보존 통과.
- 기존 `sheet-motion-qa.cjs`: WebKit에서 핸들 탭·닫기·스와이프·취소·움직임 줄이기 및 저장 상태 보존 통과.
- 기존 초기 성능 검사: 로컬 Worker, 390px Chromium, CPU 4배 지연, 캐시 없는 3회 준비 시간 1470/1436/1428ms, LCP 460/416/420ms, 브라우저 오류 없음. 네트워크 지연이 없는 로컬 값이며 이전 배포보다 빨라졌다는 비교 증거 또는 실제 iPhone 성능으로 사용하지 않는다. 기존 큰 JS 청크 경고는 남는다.

상세 증거는 무시되는 `outputs/startup-render/`, `outputs/iphone-launch/`, `outputs/startup-performance/`, `outputs/ui-refresh/`, `outputs/sheet-motion-webkit/`에 보관한다.

## 운영과 남은 확인

위험도는 낮음~중간이다. 폰트를 나중에 적용하면서 짧은 글꼴 전환이 보일 수 있다. 폰트 서버가 응답하지 않아도 시스템 글꼴로 동작하며 기존 기록 조회 실패·재시도 UI는 유지한다. HTML 자체의 전송 지연과 iOS가 관리하는 실행 전환 시간을 완전히 없앤다고 보장하지 않는다.

학습 기록·API·DB·인증·백업 계약은 변경하지 않는다. 마이그레이션이 없으며 개인정보나 키를 로그에 추가하지 않는다. 기존 오류 진단을 유지한다. 문제가 발생하면 배포 v67로 되돌릴 수 있다. iOS가 보관한 아이콘·시작 화면은 서버 롤백이나 새 배포와 동시에 갱신되지 않을 수 있다.

실제 iPhone에서는 배포 후 Safari에서 한 번 새로고침하고 홈 화면 아이콘으로 다시 열어 확인한다. 최초 실행·반복 실행·가로 방향을 확인하며, 오래된 아이콘/시작 화면이 계속 남는 경우 홈 화면 바로가기를 다시 추가해 비교한다. 기기의 캐시 삭제나 학습 기록 삭제를 요구하지 않는다. 물리 기기의 이 검사는 브라우저 자동 검증과 별개이다.

## 참고

- [Google: 렌더링을 막는 리소스와 CSS @import](https://web.dev/learn/performance/optimize-resource-loading)
- [Apple: 홈 화면 웹 앱의 아이콘과 시작 이미지](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html) — 보관 문서이며 최신 iOS의 캐시·전환 동작을 보장하는 자료로 해석하지 않는다.
