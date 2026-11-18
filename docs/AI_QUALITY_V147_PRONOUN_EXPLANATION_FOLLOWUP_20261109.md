# 대명사 두 곳을 고친 문장의 설명 복원

기존 실제 모델 응답 90건을 배포 기준판과 로컬 수정판의 제품 코드에 동일하게 넣었다. 두 버전 모두 90건을 수용했고 교정문과 판단 표시가 같았다. 세 모델의 한 사례에서만 설명이 달랐다. `Him gave the notebook to she.`는 세 모델 모두 `He gave the notebook to her.`로 고쳤다. 배포 기준판은 주격·목적격 안내를 표시했지만 로컬 수정판은 여러 부분이 바뀌었다는 이유로 일반 안내를 표시했다.

후속 수정은 주어와 `to` 뒤의 받는 사람 대명사가 각각 같은 사람을 가리키는 올바른 형태로 바뀌고, 문장의 나머지 토큰이 일치하는 전달 문장에 한해 적용한다. 이때 앱이 표시하는 안내는 **“주어 자리에는 주격을 쓰고, 전치사 to 뒤에는 목적격을 써요.”**다. 역할 교환, 내용어·시제·문장부호 변경, 다른 구문에는 일반 안내를 유지한다. 문법 근거는 [British Council의 인칭 대명사 설명](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/personal-pronouns)에서 확인했다.

후속 수정판에 같은 90건을 재생해 해당 세 응답의 설명이 복원됐고, 나머지 87건의 표시 내용과 90건 전체의 교정문·판정이 유지됐음을 대조했다. 이 재생은 보관한 구조화 응답과 사용량으로 로컬 응답 봉투를 구성해 사용했다. 새 API 호출·키 읽기·비용은 0이다. 기존 실제 응답을 보존했으며 새로운 모델 생성 품질과 운영 환경은 별도 검증 범위다.

실제 변경은 `work/ai-quality-v147-explanation-followup-20261109`의 `lib/verified-feedback-explanation.ts`와 `tests/ai-quality-explanation.test.mjs`에 있다. 기존 유료 평가가 제품 파일 지문을 참조하므로 별도 로컬 checkout에서 수정했다. 두 파일 차이는 `outputs/ai-quality-v147-implementation-20261106/phase93/pronoun-explanation-final.patch`에 있고, 기존 작업 사본에서 `git apply --check`를 통과했다.

초기 타입 검사에서 배열 원소가 없을 가능성을 처리하지 않은 오류를 찾아 수정했다. 최종 타입 검사, 관련 테스트 23/23, ESLint, Worker 빌드가 종료 코드 0이다. ESLint에는 기존 경고 15건이 있다. 새 설명이 실제 빌드에 포함된 것도 확인했다. T8.3과 T33.3에 근거를 연결했다. T34의 보정 증인 자격, 실제 모델 비교, 예비·확인 평가, 운영 적용은 별도 관문에 남는다.
