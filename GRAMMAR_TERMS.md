# 품사와 문장 역할 안내

오늘의 학습에서 한국어 품사만 보이던 표기를 `동사 (v.)`처럼 원본 Oxford 코드와 함께 표시한다. 새로운 표기를 외워야 학습을 진행하는 구조는 아니며, 선택형 도움말에서 영어 이름을 확인한다.

## 표시 범위

- 오늘 목표 목록, 학습 카드, 문장 쓰기, 완료한 단어 다시 보기: 품사 코드와 접힌 `품사·S/V/O 뜻 보기`.
- 영어·한국어 회상, 이전 단어 점검: 기존 품사에 코드만 추가. 예문이 있는 도움말은 노출하지 않는다.
- 품사 수업의 이해하기: 동일 도움말을 재사용한다.
- S Subject / V Verb / O Object / C Complement를 한국어 역할과 예문으로 연결한다. `music`이 명사(n.)이면서 목적어(O)라는 차이, S+V 문장, 보어도 설명한다.
- M Modifier와 A Adverbial, 15개 학습 표기 전체는 추가 펼침 영역에 둔다. M을 모든 교재의 공통 표준이라고 설명하지 않는다.

문장 구조는 [British Council의 clause structure and verb patterns](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/clause-structure-verb-patterns)를 참고했다. 화면의 예문은 학습용 작성 예문이다. 원본 품사 코드, 수업 문제와 콘텐츠 버전, 저장된 답변은 바꾸지 않는다.

## 검증

- 전체 단위 테스트 370개, 타입 검사 통과. 린트 오류 0개(기존 경고 13개).
- `grammar-terms-qa.cjs`: Chromium·WebKit에서 일일 학습 6개 상태, 완료 다시 보기, 15개 표기, 키보드 펼침, 회상 정답 숨김, 성적·목표 보존.
- 320/390/430/768/1440px 및 글자 200%, axe 접근성 검사. 오늘 목록의 큰 단어 제목 스타일이 도움말 강조 글자에 유입되지 않도록 별도 확인.
- `study-layout-qa.cjs`: 학습 화면 8개 상태·80개 크기 조합.
- `repeat-learning-qa.cjs`, `grammar-ui-qa.cjs`: 완료 후 다시 보기·재학습, 품사 수업 UI 회귀 검사.
- 실제 iPhone Safari와 VoiceOver 조작은 이번 변경에서 검사하지 않았다. WebKit 자동 검사는 실제 기기 검사를 대체하지 않는다.

## 운영

위험도는 낮다. 표시 컴포넌트와 정적 도움말만 변경하며 DB·백업·API 계약·인증·AI 호출·진단 로그에 변화가 없다. 마이그레이션은 없다. 화면 표시 문제가 발생하면 직전 배포 v75로 되돌린다. 저장 데이터 복원은 필요하지 않다. 오래 열린 탭에 이전 코드가 남을 경우 새로고침으로 최신 화면을 읽는다.
