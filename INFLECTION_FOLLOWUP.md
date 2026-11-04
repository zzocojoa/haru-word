# 불규칙 활용 검증기 후속안 · 유료 평가 이후 / 미게시

동결 소스 `5d3ea87`의 새 합성 평가에서 세 모델이 모두 정확하게 `They didn't lent us any tools.`를 `They didn't lend us any tools.`로 교정했지만, 앱의 불규칙 활용표에 lend/lent가 없어 `content_change`로 거절했다. 모델 문법 오류와 앱 검증기 거절을 구분한다.

검증기의 철자 활용표를 보완한다. 중복 철자 lay는 lie와 lay를 각각 직접 참조하며 laid/lain을 같은 어근으로 합치지 않는다. found/founded처럼 별도 동사로 쓰이는 원래 철자도 보존한다. be/do/have의 명시적 활용만 기능어로 처리한다. 부정·수량·시점·조동사·참여자·역할·다른 내용어 보존 검사는 유지한다. 프롬프트·모델 요청·새 평가 기준은 바꾸지 않는다.

- 형태 근거: [British Council irregular verbs](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs), [Cambridge English verb table](https://www.cambridgeenglish.org/fr/Images/722994-irregular-verbs-document.pdf).
- 실행 예: `npm test`, `npm run typecheck`, `npx eslint app lib db` 및 기존 Sites 공식 빌드.
- 회귀 예: lent/lend는 허용하고 lend/borrow, laid/lain, was/are, can/must, 참여자 교환은 거절한다.

이는 한정된 철자 검사다. 단어의 품사·의미와 전체 문장의 의미 동등성을 증명하지 않는다. 같은 철자가 여러 뜻을 가지는 경우의 문맥 판단은 여전히 모델과 품질 평가에 의존한다. 기존 정규 활용 휴리스틱의 일반적인 한계도 남는다.

기존 유료 원장·원점수·품질 보류 결과를 수정하지 않는다. 이미 수집한 합성 응답 재생은 알려진 자료의 결정적 회귀 검사이며, 새 후보의 새 유료 품질 평가나 미측정 11묶음의 대체가 아니다. 새 유료 요청과 배포를 실행하지 않는다.
