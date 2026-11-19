# Astryx Foundation

T1–T6의 정적 테마에 T7의 실제 AppShell/TabList를 연결했다. 학습·저장·복원 API와 상태 모델은 유지한다. 일반 조작과 학습 화면 자체의 후속 이관은 T8 이후다.

## 버전과 빌드

Core/CLI/neutral은 0.7.16, StyleX peer는 0.19.0이다. npm과 lockfile을 유지한다. 앱의 기존 lucide-react는 1.31.0, neutral이 요구하는 사본은 하위 의존성으로 분리한다. React는 19.2.9다.

- `npm run astryx -- <명령>`: 로컬 CLI. Node 22 미리보기의 CSS import 오류를 우회하는 CLI 전용 로더를 사용한다. 제품 Vite/Worker에는 적용하지 않는다.
- `npm run theme:build`: `themes/haru/haru.theme.ts`를 정적 테마로 컴파일한다.
- `npm run build`: 테마 컴파일과 기존 자료 검증 후 Worker를 빌드한다.
- `npm run astryx -- doctor --built dist/client`: 실제 빌드의 Astryx 포함 여부를 확인한다. Windows npm shim 경고와 source-purity 미검사 안내는 제품 검증을 대신하지 않는다.

## 테마 수정

1. `npm run astryx -- experimental theme editor set haru ...`로 설정을 바꾼다. 소스는 `themes/haru/haru.settings.json`과 생성된 settings.ts다.
2. 필요한 세부 계약은 직접 소유한 `themes/haru/haru.theme.ts`에서 neutral/settings를 확장한다. 팔레트는 테마에 두고 `:root`로 덮지 않는다.
3. 컴파일 후 `src/themes/haru/haru.js`와 CSS를 사용한다. 생성 JS/CSS/선언을 직접 수정하지 않는다. editor가 만드는 테마 폴더와 앱 사본을 동시에 손으로 수정하지 않는다.
4. `editor show haru --png`의 그림을 보고, 최종 판단은 실제 Worker의 Foundation 화면과 브라우저 검사로 한다. CLI 0.7.16 표본 PNG는 이 환경에서 설정 후에도 neutral의 파란색이 남았다. 이를 테마 통과 근거로 사용하지 않으며 실제 built CSS/Worker의 한국어 Foundation 캡처를 사용한다.

light 모드를 명시한다. DM Sans/Noto Sans KR은 기존 WebFonts와 시스템 대체 글꼴 정책을 따른다. 본문/입력16px·보조14px, 작은 조작44px·주 행동48px, 긴 행동의 줄바꿈을 유지한다. 라임 전경은 차콜이다. Foundation 입력 테두리는 기존 회색의 2.94:1 대비를 보완한 #8c9385(흰색 대비3.17:1)이며 기존 화면의 테두리는 바꾸지 않았다.

## CSS 공존 규칙

`globals.css`의 최상단 layer 순서는 reset → theme → base → components → utilities → haru-legacy → astryx-base → astryx-theme → haru-shell이다. 기존 unlayered 화면 CSS의 utilities보다 높은 우선순위는 haru-legacy로 보존하고, Astryx 조작은 그 뒤의 전용 레이어로 격리한다. study-design/grammar/startup import 순서는 유지한다. 기존 @theme inline/:root와 개별 규칙은 유지하며 Tailwind bridge는 추가하지 않는다.

T7부터 Core reset/base와 built theme CSS를 실제 홈에서도 가져온다. app/haru-shell.css는 기존640px 하단4탭·헤더 여백·아이콘·키보드 숨김을 공개 Astryx 클래스에 연결한다. Foundation 경로의 일반 프로필404는 유지한다. 이후에도 legacy와 실제 compiled CSS를 함께 로드한 뒤 이전 계산 스타일과 대조한다. 전역 button/input 리셋을 새 컴포넌트에 무조건 재사용하지 않는다.

## 로컬 검증

로컬 synthetic Worker의 `grammarWorker(4, {astryxFoundationEnabled: true})`만 경로를 연다. 기본값은 false이며 일반 프로필의 404를 함께 검증한다. 운영 vars·Site ID·DB 바인딩은 바꾸지 않는다.

```powershell
$env:QA_PLAYWRIGHT_PATH = '설치된 Playwright 모듈의 절대 경로'
$env:AXE_CORE_PATH = '설치된 axe.min.js의 절대 경로'
# 기존 QA runner는 Foundation 전용 synthetic Worker를 소유·정리한다.
npm run test:browser
```

집중 검사는 같은 소유 Worker의 QA_BASE_URL/QA_WORKER_CONFIG를 지정하고 `node tests/astryx-foundation-qa.cjs`를 Chromium/WebKit에서 실행한다. 운영 주소는 QA runtime에서 거부한다. 실제 AI 호출은 금지한다.

검사는 실제 Button/TextInput/TextArea/Card/Selector/Banner, value/event/ref, disabled/loading의 click·Enter·Space 무동작, 오류/재시도 상시 노출, 명시 light/한국어, 320–1440/200%/reduced motion/axe, JS 없는 SSR, 일반 프로필404와 상태 쓰기0을 확인한다. CSS padding=0을 주입하는 부정 검사가 실패 조건을 검출한 뒤 복구되는지도 확인한다. WebKit은 실제 iPhone/IME/VoiceOver 검사와 구분한다.

## 복구와 보관

T7 복구는 T1–T6 준비 상태를 유지하면서 HaruFrame/4탭 연결·홈 CSS import·탐색 fallback selector와 T7 테마/어댑터 변경을 함께 되돌린다. 패키지/전체 제품을 HEAD로 일괄 되돌리지 않는다. 학습 데이터/백업/API migration은 없다. 삭제나 원장 초기화로 복구하지 않는다. 미병합 소스와 회귀 검사·합성 QA DB·검증 근거는 검토/복구를 위해 보존한다. themes/haru의 HTML/PNG/편집 이력은 생성 검증 자료이며 제품 의존성으로 추가하지 않는다.

## T7 탭 연결 규칙

AppShell은 height="auto", mobileNav={false}로 window 스크롤을 유지한다. main/건너뛰기 링크는 AppShell 하나가 소유하고 초기 StartupScreen은 그 전 단계로만 렌더링한다. page/layout은 서버 경계를 유지한다.

HaruTabList의 value는 NavigationProvider의 승인된 tab 값이다. onFocus와 onChange는 같은 useTabNavigation → 문법 flush → useTabPosition 경로만 호출한다. 중복 focus/click을 합치며 거절되면 연결된 현재 선택 탭에만 초점을 돌린다. 패널은 고정 id/aria-labelledby/aria-controls로 연결하고 hidden 상태로 마운트를 유지한다. 학습 답·필터·진도를 새 탭 상태에 복사하지 않는다.

집중 회귀는 tests/astryx-navigation-qa.cjs이며 실제 AppShell/탭·320–1440/200%·640/641 경계·키보드·건너뛰기44px·스크롤/펼침·저장 대기/실패/재시도·브라우저 Back/Forward를 합성 계정에서 검사한다. 기존 design/ui-plan-contract/navigation/local-draft/backup-workflow/startup 검사를 함께 사용한다. clipped 상태의 건너뛰기 링크는 터치 크기 검사에서 제외하되 포커스 시44px 이상을 별도 확인한다.

## T8 공통 조작 계약

공통 구현은 `app/haru-controls.tsx`다. 실제 표현 입력·한국어 의도/문맥 선택, 네 진행률, 저장/시계 오류와 재시도·백업/진단 다운로드, 상태 문구와 학습 안내 닫기에 사용한다. 화면별 행동과 저장/AI 훅은 기존 구현을 유지한다.

| 어댑터 | 호출 예·보존 조건 |
| --- | --- |
| HaruButton / HaruIconButton | `label="다시 시도" disabled={saving} onClick={()=>store.retry()}`. busy는 isLoading, disabled는 isDisabled로 연결한다. 비활성/대기 중 실제 핸들러를 차단하고 완료 전 연속 실행을 합친다. async 작업은 Promise를 반환한다. |
| HaruTextInput / HaruTextArea | `label="한국어 의도" required maxLength={500} onChange={event=>setNote(event.target.value)}`. 기존 event와 ref·name/form·required·lang·readOnly를 보존한다. TextArea의 native 제한은 htmlMaxLength로 연결한다. Core의 maxLength는 soft counter이므로 대체하지 않는다. |
| HaruSelector | 비어 있지 않은 단일 문자열 value/onChange와 label/options만 연결한다. readOnly/disabled와 hidden name 값을 검증했다. native select의 required/form/ref와 다중 선택 계약을 일괄 대체하지 않는다. 해당 화면 단계에서 별도 검증한다. |
| HaruNotice | 저장 오류는 role=alert, 정보는 필요 시 role=status. collapsible=false/isDismissable=false를 고정해 긴 메시지와 복구 행동을 상시 노출한다. ref는 기존 오류 스크롤 대상에 연결한다. |
| HaruProgress / HaruStatus | 계산식·성적을 변경하지 않는다. undefined 진행은 기존처럼0, 수업/학습4px·일반8px. 기록 완료를 독립 회상 성공으로 바꾸지 않는다. 상태 문구는 줄바꿈 가능한 Text와 기존 아이콘이며 수량 Badge로 바꾸지 않는다. |

`clickAction/changeAction`을 저장·AI 호출에 연결하지 않는다. 폼의 onSubmit도 기존 도메인 busy/중복 보호를 유지한다. 버튼 어댑터만으로 외부 `form.requestSubmit()`이나 API 직접 호출까지 차단한다고 해석하지 않는다. disabled 입력은 Core의 aria-disabled+readOnly이므로 포커스가 남고 FormData에서 제외된다. 기존 fieldset disabled도 유지한다. 필수 표시는 시각적으로 제공하되 aria-label로 기존 한국어 접근 이름을 보존한다.

`haru-controls` 레이어는 haru-shell 다음이다. CSS는 공개 Astryx target과 어댑터가 소유하는 클래스 안에서만 기존 색·글꼴·여백/44px·진행 높이를 연결한다. Selector의 실제 combobox 버튼에44px 이상을 보장하며 외곽만 크게 만들지 않는다. 서버 page와 opt-in Foundation 페이지에 정적 CSS를 가져오고 전역 native reset이나 generated 테마를 직접 바꾸지 않는다.

집중 검사는 `tests/astryx-controls-qa.cjs`다. opt-in Foundation의 합성 폼에서 click/Enter/Space/연타/implicit submit·required/UTF-16 emoji 제한·ref·FormData·readOnly·selector·긴 오류/복구·0/100 진행·320–1440/200%/axe/SSR을 검사한다. 원래 editor-save/clock-continuity/local-draft/learning-message/backup-workflow 등 실제 앱 회귀를 함께 실행한다. 새 검사는 QA manifest와 runner의 opt-in 프로필에 등록한다. 과거 AI 검사도 현재 필수인 한국어 의도를 합성 입력으로 직접 제공하며 요청수·원본/저장 보존 단언은 유지한다.

T8 복구는 T7 프레임·테마를 유지한 채 haru-controls와 이번 공통 소비자/import·관련 QA 변경을 한 묶음으로 되돌린다. 새 API/저장 형식/SQL/의존성·Site 설정 변경은 없다. 실제 iPhone/IME/VoiceOver와 최종 성능·운영 게시는 후속 관문이다.

## T9–T10 화면·단어장 연결

오늘/친숙도/출처와 단어장/편집은 `haru-content`의 Card·Heading·Text 및 기존 `haru-controls`를 실제 화면에서 사용한다. 단어 목록은 Core Table의 children 방식으로 Header/Body/Row/Cell을 구성하고, 기존 10/30개 분할과 모바일 카드형 CSS를 유지한다. 뜻 선택의 `sense:index`/`draft` 값은 화면 전용이며 기존 의미 키를 저장하는 함수를 그대로 호출한다.

기존 화면 클래스가 바뀌면 `npm run content:skin`으로 `haru-content-compat.css`를 재생성한다. 생성기는 직접 소유한 study/grammar CSS에서 실제 이관 요소의 규칙만 순서대로 복사한다. `npm run build`는 최신 여부를 검사하며 생성 CSS는 손으로 수정하지 않는다. 레이어는 haru-controls → haru-content → haru-content-compat 순서다. native 선택자를 새 내부 DOM에 그대로 적용하지 않으며, 예를 들어 목록 수의 span 규칙은 직계 자식으로 제한한다.

유지한 Radix 모달과 중첩 선택창의 배경은 `legacy-modal-inert`가 공개 data-slot을 기준으로 잠그고 원래 inert 값을 복구한다. 현재 모달의 배경/Back·native top-layer는 허용한다. 기존 시트의 dirty/blocked/permit·저장/복원 보호는 이 코드에서 대체하지 않는다.

집중 검사는 `astryx-today-qa.cjs`/`astryx-library-qa.cjs`와 기존 ui-density/ui-continuity/ui-plan-contract/editor-save/refactor-boundaries다. 새 검색의 실제 Core 입력·ref 초점, 뜻 초안, 읽기 무쓰기, 저장 실패·중복·revision 보호를 검사한다. 복구 시 해당 소비자·어댑터·생성기/스킨·관련 검사 변경을 함께 되돌리고 T1–T8와 데이터는 유지한다. 실제 iPhone·VoiceOver·최종 품질·게시는 별도 관문이다.

## T11–T12 입력·문법 연결

학습의 기존 입력 id/ref·readOnly·native UTF-16 maxLength와 문맥 분리를 유지한다. 외부 label을 보존하는 필드는 isLabelHidden과 동일한 한국어 label을 사용한다. 문법 textarea는 rows4와 기존 문자수 aria-describedby를 유지한다. RadioGroup은 CLI 검색 별칭이며 import는 공개 RadioList/RadioListItem이다. 자기 점검 값은 기존 onChecks/onCheck로만 전달한다.

후행 아이콘은 endContent, 앞 아이콘은 icon에 연결한다. 원래 children의 순서를 확인한다. 문법의47px 행동 버튼/74px 자기 점검 행은 실제 기존 cascade를 기준으로 보존하며 전체44px 터치 조건을 함께 확인한다. 내부 TabList는 기존 비동기 flush가 성공한 값만 선택하고 고정 id/패널 연결과 hidden mount·초점을 유지한다.

검사 예: npm run content:skin 후 npm run build, grammar-ui/grammar-v2/v3/v4/호환/astryx-grammar와 study-layout/haru-session-icons를 두 엔진에서 실행한다. 반복되는 order 조각은 getByRole('button',{disabled:false})로 선택한다. 모의 시계 검사는 명시 의도/문맥 지문과 창 닫기가 준비된 뒤 원래 요청 제한을 측정한다. QA Worker의 절대 serverRoot는 합성 바인딩/AI 비활성 정책을 유지하는 비교 빌드에만 사용한다.

## T13 기록 접기와 선택창

HaruAccordion/HaruDisclosure는 공개 CollapsibleGroup과 useCollapsible({isCollapsible:true,value})를 사용한다. 기존 제목/버튼 구조와 단일 펼침·방향키/Home/End, 닫힌 본문의 unmount를 유지한다. 접기 상태를 학습 기록에 저장하지 않는다. 표는 Core Table 수동 children을 사용하고 CSV/튜터 출력은 기존 함수를 호출한다.

Core Selector는 트리거에 초점을 둔 비모달 combobox다. 옵션의 DOM focus 전제 대신 aria-activedescendant/aria-controls·키보드 선택을 검사한다. SheetDialogContent는 window capture에서 열린 Core combobox를 기억해 같은 Escape가 Radix 부모까지 닫지 않게 한다. dirty/blocked/permit·Back/스와이프·복원 보호를 대체하지 않는다. 회귀 예는 ui-continuity, journal-navigation, review-calendar, sheet-dismiss/body-swipe/motion, editor-save와settings-dialog다.

## T14 설정과 이미지

설정 선택은 label/aria-label·trigger ref를 유지한다. onBeforeChange는 기존 저장 전에 현재 초점만 기억하며 사용자가 옮긴 초점이나 닫은 창을 나중에 되돌리지 않는다. pending 모델 잠금과 기존 native checkbox/details·Radix overlay 계약을 유지한다.

이미지 Core Button은 앞면 장면/행동 이름과 뒷면 sense/action id를 분리한다. 이미지 안 IPA는 Core Text의 span이며 대화형 자식을 넣지 않는다. 이미지 이동은 소유한 haru-practice-action/face wrapper로 기존 가로/세로 아이콘·여백을 보존한다. Core 내부 DOM 클래스를 추측해 선택하지 않는다. 선택창 화살표/선택 표시는 공개 selector-indicator-icon/check target으로 기존16px을 유지한다.

검사 예: settings-dialog/haru-system-icons와 image-practice-resume/전체 image-practice 시나리오를 두 엔진에서 실행한다. QA_WORD_IMAGE_ASSET_ROOT는 현재 manifest와 SHA-256 대조한 승인 WebP3,809개 폴더를 읽기 전용으로 지정한다. 위치 저장·복원과 학습 revision은 별개다. 320px/200%에서 번호 버튼과 전체 초점 테두리를 반드시 확인한다. 실제 청취·iPhone/IME/VoiceOver는 모의 음성/WebKit 결과와 분리한다.

## T15 native 시트와 중첩

기존9종과 이미지 연습은 공개 Core Dialog와 소유한 Stack 프레임을 사용한다. SheetDialog의 dirty/blocked/자식 등록/permit/close는 그대로 유지한다. Raw Radix Root/Title/Close 문맥과 확인 창은 호환 경계로 남기며, 확인 portal은 활성 native dialog 안에 두고 실제 이전 초점으로 복귀한다. 임시 native 선택 플래그와 기존 시트 Content 분기는 제거했다.

마우스·터치의 바깥 누름과 native cancel을 구분한다. 내부 padding 누름은 닫지 않고, 복원의 바깥 누름 금지를 유지한다. 기록 메뉴의 닫힘이 끝난 뒤 새 창을 열어 이전 메뉴가 ESC를 소비하지 않게 한다. 미저장 스와이프는 확인 창의 실제 퇴장 뒤 연속 이동한다. Core의 document scroll lock이 이미 막은 터치는 시트가 추가로 막은 터치와 구분해 검사한다.

검사 예: astryx-sheets(10종×6경로와 취소/다운로드/초점), sheet-dismiss/body-swipe/motion, navigation, editor-save, settings-dialog, image-practice-resume/matrix, haru-system-icons. 로컬20개 브라우저 조합·132개 확인 경로·80화면, 단위927·Node22 타입/빌드·린트 오류0(기존15경고)를 확인했다. 로딩된 이미지와 준비 완료된 백업으로 양쪽 기준을 맞췄다. 글자·색·선은 일치하며 닫기 버튼 폭1px와 WebKit native 중앙 정렬 최대0.24px 차이는 기록한다. 전체 스크린샷 픽셀 동일성을 주장하지 않는다. 실제 iPhone·IME·VoiceOver와 T16/17·게시 검증은 별도다.

아이콘 QA는 글꼴 요청을 고정하고 ASTRYX_QA_OUTPUT에 단계별 결과를 남긴다. esbuild를 직접 쓴 이어하기 검사는 종료 시 서비스도 정리한다. 이전 실패·가변 기본 캡처와 단계별 원시 로그는 삭제하지 않는다.

## T16 백업·복원·학습일

안내문은 Core Text의 기존 HaruParagraph, 동작은 HaruButton을 사용한다. native file/date, 의미 있는 비교 표, 기존 checkbox/details와 Radix 확인·Close 문맥을 유지한다. 직렬화·revision·상한·업로드/검증/commit·불확실 결과 재조회와 날짜 계산 훅은 바꾸지 않는다. 아이콘은 소유한 children 묶음으로 기존16px·10px 간격을 보존한다.

학습일 하단 Close는 data-slot="dialog-footer-close"로 X와 구분한다. 기존 공통 X 규칙이 폼 버튼에도44px과 offset을 적용해 문구가 두 줄이던 문제를 고쳤다. 같은 guard를 호출하고, 100/200%에서 한 줄 문구와44px 이상 조작 영역을 확인한다. 창/제목/본문/하단 영역/X의24조건 계산 스타일·좌표는 T15와 일치한다.

검사 예: astryx-sheets(date/export/restore), backup-workflow/safety/large-backup/backup, study-date, editor-save 두 엔진14조합. 18.98MB 업로드 재개·응답 유실 뒤 commit1회/revision1증가·안전 백업 복구·19.9MB 실제 기록과 접근/출처 제한을 확인했다. 단위927·Node22 타입/빌드·린트 오류0(기존15경고), 변경 fixture 추가 lint0이다.

학습일 검사는 잘못된 기기 날짜만 검증하는 첫 두 사례에 setFixedTime을 사용한다. 자정 이동 사례는 install/fastForward를 유지한다. 전체 타이머·performance·Event.timeStamp까지 모의 처리한 이전 실패와 응답/전환 진단을 남겼고, 날짜/새10단어/원래 답·성적/충돌 주장은 제거하지 않았다. [Playwright Clock](https://playwright.dev/docs/clock) 참조. 최종 성능/Node24와 실제 iPhone/IME/VoiceOver·게시 관문은 T17/18에서 별도로 판정한다.

## T17 전수 검사에서 확인한 호환 규칙

native 시트의 onCloseAutoFocus는 React가 모달을 실제 제거한 뒤 실행한다. 퇴장 애니메이션 직후에도 native 모달이 남아 있으면 WebKit은 배경 버튼의 focus()를 거부한다. 재시도나 제한 시간 증가로 가리지 않고 제거 후 layout effect를 사용한다. astryx-sheets의 grammar-help 여섯 닫기 경로는 실제 도움말 버튼으로 복귀하는지 확인한다. 소유한 haru-sheet-frame은 Core의 padding 계층 안에 있으므로 검사에서 native root의 직계 자식이라고 가정하지 않는다.

이미지 시트는 본문 최소 grid 행에서 공개 spacing-1을 제외해 Core 내부 여백을 보정하고, 마지막 조작부 행의 minmax(0,max-content)/자체 스크롤을 유지한다. 조작부 전체를 max-content로 고정하면320px/200% 번호 폼이 모달 밖으로 나갈 수 있다. min-height:max-content만 추가한 실험도 두 엔진의 결과가 달랐다. 검사는 모든 실제 overflow ancestor의 client padding box·본문 스크롤 전/후·번호 오류 폼의 확대/스크롤과 제목 고정을 확인하고 기존0.5px 경계를 유지한다.

Core TextInput은 status.type='error'로 native input의 aria-invalid를 정한다. 카드 번호 오류에는 이 공개 API와 기존 aria-describedby/외부 alert를 사용한다. aria-invalid prop만 전달하면 Core가 이를 덮어쓴다. haru-practice-number의 숫자 입력은 기존 형태를 유지하도록 추가 장식을 숨기며, 오류 문구나 native 오류 속성은 숨기지 않는다. haru-content-icons는 실제 input의 aria-invalid와 오류 문구 id 연결, 잘못된 번호에서 위치 무변경을 확인한다.

Playwright1.62.1의 DOM 기반 body ariaSnapshot과 native 모달의 실제 접근성 트리를 구분한다. 앞면 무정답·실제 배경 초점 차단을 검사하고 Chromium은 Accessibility.getFullAXTree에 이름 있는 모달/조작부가 존재하면서 배경 정답이 없는지 확인한다. WebKit의 DOM/초점 검사와 실제 iPhone VoiceOver 판정은 별개다. 기존 Radix 모달의 스냅샷 검사는 유지한다.

test:browser는 기본 문법 검사에 v4 프로필을 지정하고 단어 학습 이미지의 disabled/enabled를 각각 맞는 합성 Worker에서 검사한다. 검사 예: node tests/qa/run.cjs functional --list, node --test tests/qa-runner.test.mjs. 성능 비교는 동일 소스/상태·CPU/네트워크·외부 글꼴 차단 조건에서 실시하고 디스크 raw/gzip과 실제 요청 경로를 기록한다. 당시 T8 복원 빌드와 비교하며 실제 iPhone·운영 전송량·필드 지표로 표현하지 않는다. 현재 최종 회귀·성능·실기기·게시 결과는 관리 원본의 docs/ASTRYX_T9_T18_IMPLEMENTATION_20261118.md와 Task Master T17/18을 따른다.
