# 확인된 문법 오류와 교정 보류의 분리

2026-11-09. [v8 출처 검토에서 보류된 두 문항](AI_QUALITY_V147_MAIN_SOURCE_ACTUAL_V8_20261109.md)을 기존 대명사 수정판에서 재현했다. `might brought`와 `Those car`처럼 원문 형태의 오류를 확인할 수 있으면 화면은 ‘형태 오류 확인’을 표시한다. 교정은 ‘문맥 확인 필요’로 따로 표시하고 시점 또는 수량을 묻는다. 문법 규칙은 정해진 형태와 질문이 함께 확인된 경우에만 설명한다. [British Council 조동사](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/talking-about-past), [지시 표현](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/demonstratives)

수정한 제품 파일은 `app/feedback-detail.tsx`, `lib/verified-feedback-explanation.ts`이며 회귀 사례를 `tests/ai-quality-explanation.test.mjs`에 추가했다. 보관한 대명사 수정판의 547개 입력 파일에서 위 세 파일만 바뀌었다. DB와 API의 기존 `grammar: uncertain`, 빈 교정문 형식으로 저장한다. 이전 `judgment-v6` 기록은 읽을 때 동일한 형태 조건을 적용해 표시하고 원문·저장 설명은 그대로 읽는다. 문법 검사에서 다루지 않은 형태는 일반 보류 표시를 유지한다.

## 로컬 검증

- 이전 빌드와 수정 빌드에 동일한 가상 응답 5쌍을 넣고 문법 API 영수증, 저장·재조회 10건을 대조했다. 원문, 교정문, 저장 판정과 첫 학습 답은 동일했다. 시점·수량 두 사례의 설명만 바뀌었다. 대명사 교정 설명과 정상 형태 대조 두 건을 다시 확인했다. 중복 요청은 추가 모델 호출을 만들지 않았고 다른 가상 계정은 영수증에 접근할 수 없었다.
- Chromium·WebKit 화면 12건에서 이전 빌드, 새 피드백, 이전 저장 기록의 표시를 각각 대조했다. 수정판은 원문 오류와 문맥 질문을 함께 표시했다. 해당 보류 사례의 교정문·적용 버튼은 표시되지 않았다. 로컬 Worker 두 개를 종료했다.
- Node 24 전체 단위 검사 883/883, 관련 검사 29/29, `typecheck`·`lint`·`build` 종료 코드 0. 린트는 이번에 수정하지 않은 파일에서 경고 15개를 보고했다. 배포용 파일은 빌드했고 운영·실기기·새 AI 모델 응답은 별도 검증 범위다.
- 적용 가능한 변경 파일은 `outputs/ai-quality-v147-implementation-20261106/phase100/withheld-grammar.patch`다. 이전 대명사 수정판에 대해 `git apply --check`가 통과했다. 실제 유료 모델 호출·키 읽기·운영 데이터 수정은 0건이다.

채점 시에도 학습자에게 보인 오류와 보류 표시를 분리해 전달해야 한다. 이전 v8 결과와 원점수는 당시 증거로 남기고, 새 제품 표시의 채점 일치와 정식 보정·예비 평가·출시는 후속 단계에 남긴다.
