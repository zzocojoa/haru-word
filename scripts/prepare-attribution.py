"""Build redistributable learning data and attribution from the exact shipped content."""
import json,shutil
from pathlib import Path
from expression_translations import load_expression_translations, validate_expression_translations

words=json.loads(Path('data/words.json').read_text('utf-8'))
content=json.loads(Path('data/content.json').read_text('utf-8'))
validate_expression_translations(content, load_expression_translations(), require_applied=True)
records=[{**w,**content[w['id']]} for w in words]
root=Path('public/sources');root.mkdir(parents=True,exist_ok=True)
(root/'learning-data.json').write_text(json.dumps({'glossLicense':'CC BY-SA 4.0','exampleLicenses':{'Tatoeba 참고 예문':'CC BY 2.0','학습용 작성 예문':'CC BY-SA 4.0'},'records':records},ensure_ascii=False),encoding='utf-8')
shutil.copyfile('data/source-audit.json',root/'source-audit.json')
credits='''하루단어 데이터 출처 및 변경 내역 · 2026-09-22

1. 공식 단어·품사·CEFR 수준
사용자가 제공한 American Oxford 3000 by CEFR level, Oxford University Press.
원문 13쪽, 표제어 3,000개, 원문 행 3,308개, 품사·수준별 학습 항목 3,809개.
원문 PDF의 저작권은 Oxford University Press에 있습니다.
이 사이트는 사용자의 비공개 학습 도구이며 Oxford의 공식 제품이 아닙니다.
원문 PDF: /sources/oxford-source.pdf
추출 감사 자료: /sources/source-audit.json

2. 한국어 뜻
LexiSnap Open English-Korean Dictionary, jhseo1211 및 기여자.
https://github.com/jhseo1211/open-english-korean-dict
CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/
한국어 뜻만 기초 자료로 사용했습니다. 사전의 CEFR·빈도·발음 기호는 사용하지 않습니다.
품사·뜻이 어긋난 항목은 수정하고, 직접 작성한 학습 뜻을 추가했습니다.
변경된 한국어 풀이와 직접 작성한 예문은 CC BY-SA 4.0으로 제공합니다.
이는 Oxford 원문의 별도 권리를 변경하지 않습니다.
기초 사전의 전체 기여·라이선스: /sources/dictionary-credits.md
학습 데이터와 문장별 기여 정보: /sources/learning-data.json

3. 참고 예문
Tatoeba 프로젝트와 문장별 기여자. ManyThings.org Korean–English sentence pairs
https://www.manythings.org/anki/ (자료 날짜: 2026-02-13)
https://tatoeba.org/
CC BY 2.0: https://creativecommons.org/licenses/by/2.0/
영어·한국어 문장 및 문장별 저작자 정보를 제공하며, 표현은 문장에서 발췌하거나 학습용으로 따로 작성했습니다.
학습 카드에 원문 문장 ID와 영어·한국어 기여자 정보를 표시합니다.
학습용 작성 예문은 새로 작성한 문장으로 Oxford 사전 또는 Tatoeba 문장이 아닙니다.
모든 내용이 전문가의 검수를 받은 것은 아닙니다. 연결된 사전으로 용례를 확인하고 나만의 뜻을 기록할 수 있습니다.
2026-09-22: A1 품사별 1,077개 항목의 뜻·표현·영어 예문·한국어 해석을 AI가 항목별로 대조했습니다.
품사·뜻 불일치, 번역 문제, 끊긴 표현을 수정했습니다. 전문가 인증이나 모든 오류의 부재를 보장하지 않습니다.
2026-09-22: A2 품사별 990개 항목도 같은 방식으로 대조하고, 552개 항목의 뜻·표현·예문·해석을 보완했습니다.
2026-09-22: B1 품사별 903개 항목도 대조하고, 509개 항목의 뜻·표현·예문·해석을 보완했습니다.
2026-09-22: B2 품사별 839개 항목도 대조하고, 418개 항목의 뜻·표현·예문·해석을 보완했습니다.
전체 3,809개 항목을 AI가 대조했으며 전문가 인증은 아닙니다. 이미 저장된 회차의 학습 자료는 당시 내용으로 유지됩니다.
2026-09-23: 기본 3,809개 항목의 함께 익힐 표현에 한국어 해석(expressionTranslation)을 별도로 작성했습니다.
표현 해석은 AI가 작성한 학습용 자료(CC BY-SA 4.0)이며 Oxford 또는 Tatoeba의 공식 번역이 아닙니다.
예문 전체의 번역과 구분하며, 학습 중 외부 API를 호출하지 않습니다. 전문가 검수는 받지 않았습니다.
이전 기록은 영어 표현과 학습 뜻이 일치하고 표현 해석 필드가 없는 경우에만 표시할 때 보완합니다.

2026-09-30: 가족 관계 19항목(13개 예문)의 나이 정보와 close 동사 예문을 교열했습니다.
한국어에 특정된 나이를 영어에도 younger/older로 명시하고, Tatoeba 후보 2개는 직접 작성한 예문으로 교체했습니다.
변경된 자료는 override·수준별 검토 원장에 기록하며 사용자 편집과 과거 회차 자료는 유지합니다.

4. 발음
2026-10-19: 사전 v3의 3,809항목·3,837개 조건별 발음을 뜻·품사 일치 시 표시합니다.
화면용 IPA는 넓은 미국식 표기로 정규화했으며 원문 IPA·조건·URL·검토 방법·라이선스를 별도로 보존합니다.
Wiktionary contributors의 파생 부분은 CC BY-SA 4.0이며 개별 사전·기존 교재의 권리를 변경하지 않습니다.
발음 데이터·출처·라이선스: /sources/american-ipa.json
동형이의어 16개(품사별 35항목)는 Cambridge Dictionary의 미국식 발음과 대조했습니다.
검토한 품사·뜻이 일치할 때 IPA·용법 안내와 공식 사전 듣기 링크를 제공합니다.
data/pronunciation-guide.json의 항목별 URL·검토일을 참고하세요. 음원을 복사하거나 재배포하지 않습니다.
개인 단어·다른 뜻은 사전 확인을 안내합니다. read의 원형·과거형과 미국식 transfer의 복수 강세를 구분합니다.
그 밖의 단어에는 브라우저 SpeechSynthesis의 en-US 음성(기기 음성 듣기)과 Oxford 사전 링크를 제공합니다.
기기에 따라 음성 제공 여부·품질이 다르며 실제 iPhone 청취는 별도 검증 대상입니다.

5. 학습 결과
회상·문장 평가는 학습자의 자기 평가이며 자동 문법 판정이나 정식 CEFR 시험이 아닙니다.
AI 문장 점검 버튼을 누르면 Google Gemini API를 먼저 사용합니다.
Google 응답 실패 시 같은 작성 문장과 목표 정보(단어·뜻 또는 문법 수업 목표)를 Groq API로 보내 자동 전환합니다.
결과에 실제 사용한 제공사를 표시합니다. 두 서비스의 계정은 Free 상태를 유지해야 하며, 앱이 결제나 요금제 변경을 진행하지 않습니다.
AI 의견은 참고 자료이며 결과는 학습자가 확인합니다. 무료 한도·연결 오류 시 자기 점검으로 계속할 수 있습니다.
'''
(root/'content-attribution.txt').write_text(credits,encoding='utf-8')
shutil.copyfile('work/dictionary-credits.md',root/'dictionary-credits.md')
print(json.dumps({'entries':len(records),'sourceFiles':len(list(root.iterdir()))}))
