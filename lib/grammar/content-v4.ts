import { GRAMMAR_LESSONS, type GrammarLesson } from './content';
import { frameSentence, type LessonPractice } from './content-v2';
import { PRACTICE_LESSONS_V3, lessonForVersion as oldLesson, practiceForVersion as oldPractice, legacyNowNote } from './content-v3';
import type { LessonId } from './model';
import type { SentenceStructure } from '../sentence-structure';

// New authored edition only. Never modify v1/v2/v3 objects or old results.
export const PRACTICE_LESSONS_V4 = structuredClone(PRACTICE_LESSONS_V3);
for (const practice of Object.values(PRACTICE_LESSONS_V4)) {
  for (const q of [practice.observation, ...practice.questions, ...practice.reviews.a, ...practice.reviews.b]) {
    q.id = q.id!.replace(':3:', ':4:');
    if (q.alternatives) q.alternatives = q.alternatives.map(text => text[0].toUpperCase() + text.slice(1));
  }
}
const verb = PRACTICE_LESSONS_V4.verb;
verb.reading[1].glosses[0].role = '주어 My younger sister가 3인칭 단수라 현재형 walks에 -s가 붙어요.';
verb.questions[1].clue = '현재형에서 주어가 3인칭 단수인지 확인해요.';
verb.reviews.a[2].clue = '현재형에서 주어 He에 맞는 동사 형태를 확인해요.';
PRACTICE_LESSONS_V4.pronoun.reading[1].en = 'I see her at the station and help her carry the bags.';
PRACTICE_LESSONS_V4.pronoun.reading[1].ko = '나는 역에서 미나를 보고 가방을 나르는 것을 도와줘요.';
PRACTICE_LESSONS_V4.adverb.reviews.b[2].alternatives = ['He always is kind.'];
PRACTICE_LESSONS_V4.adverb.reviews.b[2].explanation = '보통 always는 be 동사 is 뒤에 놓아요. is를 강조할 때 He always is kind.도 가능해요.';
const determiner = PRACTICE_LESSONS_V4.determiner.observation;
determiner.options[2] = '소유자만 알려 주는 말';
determiner.wrong = { ...determiner.wrong, '소유자만 알려 주는 말': 'those는 소유자만 알려 주는 말이 아니라 거리와 복수 대상을 가리켜요.' };
delete determiner.wrong['누구의 책인지 모름'];
PRACTICE_LESSONS_V4.conjunction.reading[1].ko = '나는 아침 식사용 빵과 우유가 필요해서 버스를 타요.';
PRACTICE_LESSONS_V4.infinitive.commonMistake = 'want to read의 to 부정사 뒤에는 reading이 아니라 동사원형 read를 써요. 전치사 to와 구분해요.';
PRACTICE_LESSONS_V4.number.questions[1].translation = '나는 남자 형제가 두 명 있어요.';
// Each offered combination must be grammatical. The old independent a/an
// and noun slots also generated a umbrella/an bag; keep those old records.
PRACTICE_LESSONS_V4['indefinite-article'].frame = {
  parts: ['I have ', '.'], slots: [{ label: '관사와 물건', options: ['a bag', 'an umbrella', 'an orange'] }],
};

export const LESSONS_V4 = Object.fromEntries(GRAMMAR_LESSONS.map(lesson => [lesson.id, structuredClone(oldLesson(lesson, 3))])) as Record<LessonId, GrammarLesson>;
LESSONS_V4.verb.examples[1] = ['Her present was a book.', '그녀의 선물은 책이었어요.', 'was'];
LESSONS_V4.verb.notice = 'walk와 was는 어떤 행동이나 상태를 나타내나요?';
LESSONS_V4.verb.noticeAnswer = 'walk는 걷는 행동, was는 과거의 주어와 설명을 연결하는 동사예요. know처럼 아는 상태를 나타내는 동사도 있어요.';
LESSONS_V4.preposition.examples[1] = ['They arrived at the station.', '그들은 역에 도착했어요.', 'at'];
LESSONS_V4.preposition.notice = 'in the bag과 at the station은 어떤 관계를 나타내나요?';
LESSONS_V4.preposition.noticeAnswer = '두 전치사구가 장소를 나타내요. arrive는 지점에 at, 도시·나라에 in을 써요. the station은 at의 뒤에 오는 명사구이며 arrived의 직접목적어가 아니에요.';
LESSONS_V4.auxiliary.examples[1] = ['I am now reading.', '나는 지금 읽고 있어요.', 'am'];
LESSONS_V4.auxiliary.notice = 'have와 am은 각각 어떤 역할을 하나요?';
LESSONS_V4.auxiliary.noticeAnswer = 'have는 소유를 나타내는 본동사예요. am은 reading과 함께 진행형을 만들어요. now가 사이에 있어도 am과 reading이 동사구를 이루어요.';

export function practiceForVersion(id: LessonId, version?: number): LessonPractice {
  return version === 4 ? PRACTICE_LESSONS_V4[id] : oldPractice(id, version);
}
export function lessonForVersion(lesson: GrammarLesson, version?: number): GrammarLesson {
  return version === 4 ? LESSONS_V4[lesson.id] : oldLesson(lesson, version);
}
export { legacyNowNote };
export function legacyContentNote(id: LessonId, version?: number, reviewing = false, index = 0, setId?: string) {
  if (id === 'adverb' && reviewing && setId === 'b' && (version ?? 1) < 4 && index === 2)
    return 'He always is kind.도 is를 강조하면 가능한 어순이에요. 이전 채점 기록은 당시 문항 기준을 유지하며 새 교재에서는 함께 인정해요.';
  return legacyNowNote(id, version, reviewing, index);
}

// Static, sentence-specific analysis. These parts are authored individually;
// no sentence parsing, spelling lookup, AI response or learner input is used.
type Part = SentenceStructure['parts'][number];
const p = (text: string, role: Part['role'], explanation: string): Part => ({ text, role, explanation });
const authored: Record<LessonId, [Part[], Part[]]> = {
  noun: [
    [p('My friend', 'S', '내 친구라는 명사구가 요리하는 주어예요.'), p('cooks.', 'V', '요리하는 행동이에요. 목적어 없이 쓰였어요.')],
    [p('I', 'S', '좋아하는 사람이에요.'), p('like', 'V', '좋아하는 상태를 나타내요.'), p('music.', 'O', '좋아하는 대상인 음악이에요.')],
  ],
  verb: [
    [p('I', 'S', '걷는 사람이에요.'), p('walk', 'V', '걷는 행동이에요.'), p('home.', 'M', '집으로라는 방향의 부사예요. 직접목적어가 아니에요.')],
    [p('Her present', 'S', '그녀의 선물이라는 명사구예요.'), p('was', 'V', '과거의 상태를 연결하는 be의 과거형이에요.'), p('a book.', 'C', '선물이 무엇이었는지 설명하는 주격 보어예요.')],
  ],
  pronoun: [
    [p('Mina', 'S', '첫 문장에서 미나를 소개해요.'), p('is', 'V', '미나의 위치를 연결해요.'), p('here.', 'C', '여기에 있다는 위치를 설명해요.'), p('She', 'S', '둘째 문장에서 앞의 미나를 받아요.'), p('is', 'V', '주어와 상태를 연결해요.'), p('ready.', 'C', '준비된 상태를 설명해요.')],
    [p('I', 'S', '미나를 아는 사람이에요.'), p('know', 'V', '아는 상태예요.'), p('Mina.', 'O', '아는 대상이에요.'), p('I', 'S', '둘째 문장에서도 같은 주어예요.'), p('like', 'V', '좋아하는 상태예요.'), p('her.', 'O', '앞의 미나를 받는 목적격 대명사예요.')],
  ],
  adjective: [
    [p('She', 'S', '성질을 설명하는 사람이에요.'), p('is', 'V', '주어와 성질을 연결해요.'), p('careful.', 'C', '사람의 조심성 있는 성질을 설명하는 형용사 보어예요.')],
    [p('She', 'S', '운전하는 사람이에요.'), p('drives', 'V', '운전하는 행동이에요.'), p('carefully.', 'M', '운전하는 방식을 설명하는 부사예요. 사람의 성질과 구분해요.')],
  ],
  adverb: [
    [p('He', 'S', '말하는 사람이에요.'), p('speaks', 'V', '말하는 행동이에요.'), p('slowly.', 'M', '말하는 방식을 꾸미는 부사예요.')],
    [p('It', 'S', '날씨를 말할 때 쓰는 형식 주어예요.'), p('is', 'V', '상태를 연결해요.'), p('very cold.', 'C', '추운 상태의 형용사구예요. very는 그 안에서 cold의 정도를 높여요.')],
  ],
  determiner: [
    [p('This book', 'S', 'This가 어느 책인지 정하는 명사구예요.'), p('is', 'V', '주어와 상태를 연결해요.'), p('new.', 'C', '책이 새것이라는 상태예요.')],
    [p('My book', 'S', 'My가 책의 소유자를 정하는 명사구예요.'), p('is', 'V', '주어와 상태를 연결해요.'), p('old.', 'C', '책이 오래됐다는 상태예요.')],
  ],
  'indefinite-article': [
    [p('I', 'S', '가방을 가진 사람이에요.'), p('have', 'V', '소유를 나타내요.'), p('a bag.', 'O', '가방 하나라는 명사구예요. bag의 첫소리가 자음이므로 a를 써요.')],
    [p('I', 'S', '사과를 먹은 사람이에요.'), p('ate', 'V', 'eat의 과거형이에요.'), p('an apple.', 'O', '먹은 사과 하나예요. apple의 첫소리가 모음이므로 an을 써요.')],
  ],
  'definite-article': [
    [p('I', 'S', '책을 산 사람이에요.'), p('bought', 'V', 'buy의 과거형이에요.'), p('a book.', 'O', '책 한 권을 소개해요.'), p('The book', 'S', '앞에서 산 같은 책을 the로 받아요.'), p('is', 'V', '책의 특징을 연결해요.'), p('short.', 'C', '책이 짧다는 특징을 설명해요.')],
    [p('Please', 'M', '공손한 요청을 나타내요.'), p('close', 'V', '문을 닫으라는 명령형의 본동사예요.'), p('the door.', 'O', '상황에서 함께 알 수 있는 그 문을 가리켜요.')],
  ],
  number: [
    [p('I', 'S', '가방을 가진 사람이에요.'), p('have', 'V', '소유를 나타내요.'), p('two bags.', 'O', 'two가 개수를 정하는 복수 명사구예요.')],
    [p('This', 'S', '가리키는 대상이에요.'), p('is', 'V', '주어와 설명을 연결해요.'), p('my second bag.', 'C', 'second가 순서를 정하는 명사구 보어예요.')],
  ],
  preposition: [
    [p('The key', 'S', '위치를 설명하는 열쇠예요.'), p('is', 'V', '위치 설명을 연결하는 be예요.'), p('in the bag.', 'C', '열쇠의 위치를 설명하는 전치사구 보어예요. the bag은 in의 뒤에 오는 명사구예요.')],
    [p('They', 'S', '도착한 사람들이에요.'), p('arrived', 'V', '도착했다는 과거의 동작이에요. 직접목적어를 취하지 않아요.'), p('at the station.', 'M', '도착 지점을 나타내는 전치사구예요. the station은 at의 보충어이며 arrived의 직접목적어가 아니에요.')],
  ],
  conjunction: [
    [p('I', 'S', '좋아하는 사람이에요.'), p('like', 'V', '좋아하는 상태예요.'), p('tea and coffee.', 'O', 'and가 같은 역할의 두 명사를 연결한 목적어예요.')],
    [p('I', 'S', '두 상태를 가진 사람이에요.'), p('am', 'V', '주어와 상태를 연결해요.'), p('tired but happy.', 'C', 'but이 대조되는 두 형용사를 연결한 보어예요.')],
  ],
  auxiliary: [
    [p('I', 'S', '가방을 가진 사람이에요.'), p('have', 'V', '다른 동사를 돕지 않는 소유의 본동사예요.'), p('a bag.', 'O', '가진 대상이에요.')],
    [p('I', 'S', '읽는 사람이에요.'), p('am', 'V', '진행형을 만드는 조동사예요.'), p('now', 'M', '지금이라는 시간 부사예요.'), p('reading.', 'V', 'am과 함께 진행형 동사구를 이루는 본동사예요. 보어가 아니에요.')],
  ],
  modal: [
    [p('I', 'S', '수영할 능력을 가진 사람이에요.'), p('can swim.', 'V', '법조동사 can과 동사원형 swim이 능력을 나타내요.')],
    [p('You', 'S', '조언을 받는 사람이에요.'), p('should rest.', 'V', 'should와 동사원형 rest가 쉬라는 조언을 나타내요.')],
  ],
  infinitive: [
    [p('I', 'S', '원하는 사람이에요.'), p('want', 'V', '원하는 상태를 나타내요.'), p('to learn.', 'C', '원하는 행동을 나타내는 to 부정사절로 want의 보충어예요. 명사 목적어와 구분해요.')],
    [p('I', 'S', '학교에 가는 사람이에요.'), p('go', 'V', '가는 행동이에요.'), p('to school.', 'M', '학교로라는 방향의 전치사구예요. 이 to는 부정사 표지가 아니에요.')],
  ],
  exclamation: [
    [p('Wow!', 'X', '문장 뼈대와 독립된 놀람·감탄이에요.'), p('That', 'S', '감탄하는 대상을 받아요.'), p('is', 'V', '상태를 연결해요.'), p('beautiful.', 'C', '아름답다는 성질을 설명해요.')],
    [p('Oops!', 'X', '작은 실수를 알아차린 반응이에요.'), p('I', 'S', '펜을 떨어뜨린 사람이에요.'), p('dropped', 'V', '떨어뜨린 과거 행동이에요.'), p('my pen.', 'O', '떨어뜨린 대상이에요.')],
  ],
};
export const REVIEWED_EXAMPLES = Object.fromEntries(Object.entries(LESSONS_V4).map(([id, lesson]) => [id,
  lesson.examples.map(([sentence, translation, focus], index) => ({ id: `${id}:4:example:${index + 1}`, sentence, focus,
    structure: { status: 'available' as const, translation, parts: authored[id as LessonId][index],
      note: id === 'preposition' ? 'M은 이 교재의 장소·방향 설명용 표기예요. 전치사구를 항상 선택적인 수식어로 단정하지 않아요.'
        : id === 'infinitive' ? 'C는 여기서 넓은 보충어 표기예요. to 부정사절을 목적어로 설명하는 교재도 있어요.'
        : id === 'definite-article' && index === 1 ? '명령문은 주어 you가 이해되지만 실제 문장에 없는 단어를 구조도에 넣지 않아요.'
        : '명사구·형용사구 안의 수식 표현은 함께 묶어요. 이 예문에만 적용되는 학습용 분석이에요.' } })),
])) as Record<LessonId, { id: string; sentence: string; focus: string; structure: SentenceStructure }[]>;

export function grammarReviewUnits() {
  const units: { id: string; content: unknown }[] = [];
  for (const lesson of Object.values(LESSONS_V4)) {
    const { examples, questions, review, ...description } = lesson;
    void examples; void questions; void review;
    units.push({ id: `${lesson.id}:4:lesson`, content: description });
    const practice = PRACTICE_LESSONS_V4[lesson.id];
    units.push({ id: `${lesson.id}:4:practice`, content: { checks: practice.checks, commonMistake: practice.commonMistake, extra: practice.extra ?? null } });
    for (const q of [practice.observation, ...practice.questions, ...practice.reviews.a, ...practice.reviews.b]) units.push({ id: q.id!, content: q });
    practice.reading.forEach((line, i) => {
      units.push({ id: `${lesson.id}:4:reading:${i + 1}`, content: line });
      line.glosses.forEach((gloss, j) => units.push({ id: `${lesson.id}:4:gloss:${i + 1}:${j + 1}`, content: { sentence: line.en, gloss } }));
    });
    for (const example of REVIEWED_EXAMPLES[lesson.id]) units.push({ id: example.id, content: example });
    let combinations: string[][] = [[]];
    for (const slot of practice.frame.slots) combinations = combinations.flatMap(values => slot.options.map(value => [...values, value]));
    combinations.forEach((values, i) => units.push({ id: `${lesson.id}:4:frame:${i + 1}`, content: { frame: practice.frame, values, sentence: frameSentence(practice.frame, values) } }));
  }
  return units;
}
