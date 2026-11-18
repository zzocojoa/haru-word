# T8.2·T37.2 avoid 교정의 이유 표시

저장된 실제 모델 응답은 `She avoid drive at night.`를 `She avoids driving at night.`로 교정했다. 기존 화면은 두 문장을 비교하라고 안내했다. 새 화면은 현재형에서 `she`에 맞춰 `avoids`를 쓰고, 피하는 행동을 나타낼 때 `avoid` 다음에 `driving`처럼 동사의 `-ing`형을 쓴다고 설명한다. [실제 개발 진단](AI_QUALITY_V147_COMPLETE_CORRECTION_LIVE_RESULT_20261109.md) · [Cambridge 동사 패턴](https://www.cambridgeenglish.org/images/525578-patterns-after-verbs.pdf) · [British Council 현재형](https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2/present-simple?page=1)

주어·시점·나머지 표현이 유지된 단순 문장과 확인한 여덟 동사 철자에 적용한다. 예를 들어 `They avoid to open the door.`는 `They avoid opening the door.`에서 `opening`을 쓰는 이유만 설명한다. 행위·대상·주어가 바뀌거나 철자가 틀리거나 인용문인 경우에는 이 규칙을 표시하지 않는다. 교정 수용 기준은 기존대로 적용한다.

보존된 실제 응답 세 개를 Chromium과 WebKit에서 재생했다. 여섯 화면 중 `avoid` 두 화면에서 새 설명을 저장하고 다시 열어 확인했다. 기존 `luggage` 설명 두 화면과 교정 제안이 없는 대조 화면 두 개도 확인했다. 이전 예비 후보의 합성 응답 180건의 판정·교정·설명은 같았다. 새 AI 요청은 0회다.

단위 검사 900개, 타입 검사, 린트와 빌드가 통과했다. 첫 타입 검사에서 명명 캡처 그룹이 프로젝트의 컴파일 대상과 맞지 않아 실패했다. 기존 대상과 호환되는 캡처 문법으로 고쳐 전체를 다시 확인했다. 린트의 기존 경고 15개는 남아 있다.

설명 적용성의 독립 평가와 실제 학습 효과는 미측정이다. 새 빌드를 정식 예비평가 후보에 연결하는 T24.1은 남아 있다. [실제 응답 재생 기록](../outputs/ai-quality-v147-implementation-20261106/phase151/actual-response-replay.json)
