import { GRAMMAR_LESSONS, type GrammarLesson, type GrammarQuestion } from './content';
import type { LessonId } from './model';
import { WRONG_CHOICE_REASONS } from './wrong-choice-reasons';

export type Gloss = { text: string; lemma: string; meaning: string; pos: string; role: string; occurrence?: number };
export type ReadingLine = { en: string; ko: string; glosses: Gloss[] };
export type FrameSlot = { label: string; options: string[] };
export type LessonPractice = {
  reading: ReadingLine[];
  observation: GrammarQuestion;
  frame: { parts: string[]; slots: FrameSlot[]; bindings?: number[] };
  checks: [string, string];
  commonMistake: string;
  extra?: string;
  questions: GrammarQuestion[];
  reviews: { a: GrammarQuestion[]; b: GrammarQuestion[] };
};
const gloss = (text: string, lemma: string, meaning: string, pos: string, role: string): Gloss => ({ text, lemma, meaning, pos, role });
const line = (en: string, ko: string, ...glosses: Gloss[]): ReadingLine => ({ en, ko, glosses });
const q = (context: string, translation: string, prompt: string, options: string[], answer: string, explanation: string, clue: string): GrammarQuestion => ({ kind: 'choice', context, translation, prompt, options, answer, explanation, clue });
const arrange = (answer: string, translation: string, explanation: string, clue: string): GrammarQuestion => {
  const tokens = answer.split(' ');
  return { kind: 'order', context: '', translation, prompt: '뜻에 맞게 문장을 완성하세요.', options: [...tokens.slice(2), ...tokens.slice(0, 2)], answer, explanation, clue };
};
type Authored = Pick<LessonPractice, 'reading' | 'observation' | 'frame' | 'checks' | 'extra'> & { b: GrammarQuestion[]; clues: [string, string, string] };
// These glosses describe this occurrence in this sentence. They are not an
// automatic POS tagger or a lookup by spelling. All text is authored, not API-generated.
const authored: Record<LessonId, Authored> = {
  noun: {
    reading: [
      line('My friend works at a small shop near our home.', '내 친구는 우리 집 근처의 작은 가게에서 일해요.', gloss('friend', 'friend', '친구', '명사', '일하는 사람을 가리켜요.'), gloss('shop', 'shop', '가게', '명사', '일하는 장소의 이름이에요.')),
      line('Her work starts at nine, and she likes the people there.', '그 친구의 일은 아홉 시에 시작하고, 그 친구는 그곳 사람들을 좋아해요.', gloss('work', 'work', '일', '명사', '시작하는 대상인 일이에요.')),
    ], observation: q('', '', '두 번째 문장의 work는 무엇을 가리키나요?', ['일이라는 대상', '일하는 행동', '일하는 속도'], '일이라는 대상', 'Her work는 아홉 시에 시작하는 일을 가리켜요.', 'Her 뒤에 놓인 말이 무엇의 이름인지 생각해 보세요.'),
    frame: { parts: ['I like ', '.'], slots: [{ label: '좋아하는 것', options: ['music', 'coffee', 'books'] }] }, checks: ['명사가 누구 또는 무엇을 가리키나요?', '명사가 주어 또는 목적어 자리에 있나요?'],
    clues: ['누가 읽는지 찾아보세요.', '필요한 물건의 이름을 골라요.', '좋아하는 대상을 동사 뒤에 놓아요.'],
    b: [q('We work on Mondays.', '우리는 월요일에 일해요.', '여기의 work는?', ['명사', '동사', '부사'], '동사', '주어 We가 하는 행동을 나타내는 동사예요.', '무엇의 이름인지, 하는 일인지 보세요.'), q('The ___ tastes good.', '그 수프는 맛이 좋아요.', '음식의 이름은?', ['cook', 'hot', 'soup'], 'soup', 'soup는 맛을 설명하는 대상인 음식의 이름이에요.', '맛을 가진 대상이 필요해요.'), arrange('My sister likes books.', '내 여동생은 책을 좋아해요.', 'sister는 사람, books는 좋아하는 대상의 이름이에요.', '누가 무엇을 좋아하는지 순서대로 놓아요.')],
  },
  verb: {
    reading: [line('I walk to the park every morning before breakfast.', '나는 매일 아침 식사 전에 공원까지 걸어가요.', gloss('walk', 'walk', '걷다', '동사', '내가 하는 행동이에요.')), line('My sister walks with me, and she knows the way home.', '내 여동생도 나와 함께 걷고, 집에 가는 길을 알아요.', gloss('walks', 'walk', '걷다', '동사', '주어가 한 사람이라 현재형에 -s가 붙어요.'), gloss('knows', 'know', '알다', '동사', '알고 있는 상태를 나타내요.'))],
    observation: q('', '', 'knows는 어떤 뜻인가요?', ['빠르게 움직인다', '길을 알고 있다', '길의 이름이다'], '길을 알고 있다', '동사는 knows처럼 아는 상태도 나타내요.', '몸으로 하는 행동만 동사는 아니에요.'),
    frame: { parts: ['I ', ' every day.'], slots: [{ label: '매일 하는 일', options: ['walk', 'cook', 'read'] }] }, checks: ['주어가 하는 일이나 상태를 나타냈나요?', '주어에 맞는 동사 형태를 썼나요?'], clues: ['어떤 상태로 지내는지 보세요.', '주어가 한 사람인지 확인해요.', '주어 뒤에 하는 일을 놓아요.'],
    b: [q('I like this song.', '나는 이 노래를 좋아해요.', 'like는 무엇을 나타내나요?', ['좋아하는 상태', '노래의 이름', '노래하는 속도'], '좋아하는 상태', 'like는 좋아하는 상태를 나타내는 동사예요.', '눈에 보이는 움직임이 없어도 동사일 수 있어요.'), q('He ___ at home.', '그는 집에서 요리해요.', '습관을 말하려면?', ['cooking', 'cook', 'cooks'], 'cooks', '현재 습관을 말하는 He 뒤에는 cooks를 써요.', '현재형에서 he와 어울리는 형태를 보세요.'), arrange('They read every night.', '그들은 매일 밤 읽어요.', 'They 뒤의 read가 하는 일을 나타내요.', '주어, 동사, 시간을 차례로 놓아요.')],
  },
  pronoun: {
    reading: [line('Mina has two bags, and they are both very heavy.', '미나는 가방이 두 개 있고, 둘 다 매우 무거워요.', gloss('they', 'they', '그것들은', '대명사', '앞에서 말한 두 가방을 받아요.')), line('I see her at the station and help her with the bags.', '나는 역에서 미나를 보고 가방을 드는 것을 도와줘요.', gloss('her', 'she', '그녀를', '대명사', '동사 see의 대상인 미나예요.'))],
    observation: q('', '', '첫 문장의 they는 무엇을 가리키나요?', ['미나와 나', '가방 두 개', '역 사람들'], '가방 두 개', 'they는 앞에서 말한 복수 명사 two bags를 받아요.', '앞 문장에 나온 여러 대상을 찾아요.'),
    frame: { parts: ['', ' helps me.'], slots: [{ label: '도와주는 사람', options: ['She', 'He'] }] }, checks: ['대명사가 가리키는 대상을 알고 있나요?', '주어·목적어 자리에 맞는 형태인가요?'], clues: ['앞에서 소개한 사람을 찾아요.', '전치사 뒤에 오는 형태를 골라요.', '행동하는 사람과 행동의 대상을 구분해요.'],
    b: [q('I have a dog. It is small.', '나는 개 한 마리가 있어요. 그 개는 작아요.', 'It이 가리키는 것은?', ['나', '개', '크기'], '개', 'It은 앞에서 말한 a dog를 받아요.', '두 문장이 같은 대상을 이야기해요.'), q('I know Tom. I call ___.', '나는 톰을 알아요. 나는 그에게 전화해요.', '빈칸에 맞는 말은?', ['he', 'his', 'him'], 'him', 'call의 목적어 자리에는 him을 써요.', '전화를 받는 대상의 형태예요.'), arrange('They help us.', '그들은 우리를 도와요.', 'They가 주어, us가 목적어예요.', '누가 누구를 돕는지 생각해요.')],
  },
  adjective: {
    reading: [line('My brother is careful when he drives to work each morning.', '내 남동생은 매일 아침 운전해서 출근할 때 조심성이 있어요.', gloss('careful', 'careful', '조심성 있는', '형용사', '남동생의 성질을 설명해요.')), line('He drives carefully because the road near his office is busy.', '그는 사무실 근처 도로가 붐벼서 조심스럽게 운전해요.', gloss('carefully', 'carefully', '조심스럽게', '부사', '운전하는 방식을 설명해요.'), gloss('busy', 'busy', '붐비는', '형용사', '도로의 상태를 설명해요.'))],
    observation: q('', '', '사람의 성질을 설명하는 말은?', ['carefully', 'careful', 'drives'], 'careful', 'careful은 사람의 성질, carefully는 행동 방식을 설명해요.', '사람이 어떤지와 행동을 어떻게 하는지 구분해요.'),
    frame: { parts: ['My ', ' is ', '.'], slots: [{ label: '사람', options: ['friend', 'brother', 'sister'] }, { label: '성질·상태', options: ['kind', 'careful', 'tired'] }] }, checks: ['형용사가 어떤 사람·사물을 설명하나요?', '명사 앞이나 연결 동사 뒤에 놓았나요?'], clues: ['방이 어떤지 알려주는 말을 골라요.', '행동 방식이 아니라 사람의 성질이에요.', '크기를 나타내는 말은 명사 앞에 놓아요.'],
    b: [q('She wears a red coat.', '그녀는 빨간 코트를 입어요.', 'red는 무엇을 설명하나요?', ['입는 속도', '코트의 색', '그녀의 나이'], '코트의 색', 'red는 명사 coat의 색을 설명하는 형용사예요.', '바로 뒤의 명사를 보세요.'), q('The bread smells ___.', '그 빵은 냄새가 좋아요.', '빵의 상태를 설명하려면?', ['well', 'good', 'nicely'], 'good', '연결 동사 smells 뒤에서 빵의 상태를 설명하는 good을 써요.', '빵이 냄새를 맡는 행동을 하는 것은 아니에요.'), arrange('It is a quiet room.', '그곳은 조용한 방이에요.', 'quiet은 명사 room 앞에서 방을 설명해요.', '조용하다는 말을 방 앞에 놓아요.')],
  },
  adverb: {
    reading: [line('My friend is very friendly and often calls me after work.', '내 친구는 매우 다정하고 퇴근 후 나에게 자주 전화해요.', gloss('very', 'very', '매우', '부사', 'friendly의 정도를 나타내요.'), gloss('friendly', 'friendly', '다정한', '형용사', '친구의 성질을 설명해요.')), line('She speaks slowly, so I can understand her on the phone.', '그 친구는 천천히 말해서 나는 전화로 하는 말을 이해할 수 있어요.', gloss('slowly', 'slowly', '천천히', '부사', '말하는 방식을 나타내요.'))],
    observation: q('', '', 'very는 무엇을 더 자세히 설명하나요?', ['퇴근 시간', '다정한 정도', '전화기 이름'], '다정한 정도', 'very는 형용사 friendly의 정도를 나타내요.', 'very 바로 뒤의 말을 보세요.'),
    frame: { parts: ['I ', ' cook at home.'], slots: [{ label: '빈도', options: ['often', 'sometimes', 'usually'] }] }, checks: ['부사가 무엇을 더 자세히 설명하나요?', '뜻에 맞는 위치에 부사를 놓았나요?'], clues: ['어떻게 걷는지 알려주는 말을 찾아요.', '운전하는 방식을 나타내는 형태를 골라요.', '빈도는 보통 일반 동사 앞에 놓아요.'],
    b: [q('He is a friendly teacher.', '그는 다정한 선생님이에요.', 'friendly는?', ['부사', '형용사', '동사'], '형용사', '-ly로 끝나지만 명사 teacher를 설명하는 형용사예요.', '끝모양보다 무엇을 설명하는지 보세요.'), q('She runs very ___.', '그녀는 매우 빨리 달려요.', '빈칸에 맞는 말은?', ['fast', 'friendly', 'speed'], 'fast', 'fast는 달리는 방식을 나타내는 부사로도 써요.', '달리는 방식을 나타내야 해요.'), arrange('He is always kind.', '그는 항상 친절해요.', '빈도 부사 always는 여기서 be 동사 is 뒤에 놓아요.', 'be 동사와 일반 동사의 위치 차이를 보세요.')],
  },
  determiner: {
    reading: [line('This book is mine, but those books belong to my sister.', '이 책은 내 것이지만 저 책들은 내 여동생 것이에요.', gloss('This', 'this', '이', '한정사', '가까이 있는 한 권을 가리켜요.'), gloss('those', 'those', '저', '한정사', '멀리 있는 여러 권을 가리켜요.')), line('We keep our books on the same shelf in the living room.', '우리는 거실의 같은 선반에 우리 책들을 보관해요.', gloss('our', 'our', '우리의', '한정사', 'books의 소유자를 알려줘요.'))],
    observation: q('', '', 'those books는 어떤 책들인가요?', ['가까운 한 권', '멀리 있는 여러 권', '누구의 책인지 모름'], '멀리 있는 여러 권', 'those는 멀리 있는 복수 대상을 가리켜요.', 'this와 those는 거리와 수가 달라요.'),
    frame: { parts: ['', ' bag is blue.'], slots: [{ label: '어느 가방', options: ['My', 'This', 'That'] }] }, checks: ['어느 것·누구 것·얼마나인지 표현했나요?', '명사의 수와 한정사가 어울리나요?'], clues: ['소유자를 알려주는 말을 찾아요.', '명사가 단수인지 복수인지 확인해요.', '어느 가방인지 알려주는 말을 명사 앞에 놓아요.'],
    b: [q('These shoes are new.', '이 신발들은 새것이에요.', 'These가 알려주는 것은?', ['가까운 여러 개', '먼 한 개', '신발의 색'], '가까운 여러 개', 'These는 가까이 있는 복수 명사를 가리켜요.', '거리와 수를 함께 확인해요.'), q('I need ___ rice.', '나는 쌀이 좀 필요해요.', '양을 나타내는 말은?', ['a', 'these', 'some'], 'some', '셀 수 없는 명사 rice의 양을 some으로 나타낼 수 있어요.', '쌀은 여기서 셀 수 없는 명사예요.'), arrange('Those bags are mine.', '저 가방들은 내 것이에요.', 'Those가 복수 명사 bags 앞에 와요.', '멀리 있는 여러 가방이에요.')],
  },
  'indefinite-article': {
    reading: [line('I have an hour before my train leaves this morning.', '오늘 아침 기차가 떠나기까지 한 시간이 있어요.', gloss('an', 'an', '하나의', '부정관사', 'hour의 첫소리가 모음이어서 an을 써요.')), line('I buy a sandwich and an apple at a small store.', '나는 작은 가게에서 샌드위치 하나와 사과 하나를 사요.', gloss('a sandwich', 'sandwich', '샌드위치 하나', '부정관사 + 명사', '자음 소리로 시작하는 단수 명사예요.'), gloss('an apple', 'apple', '사과 하나', '부정관사 + 명사', '모음 소리로 시작하는 단수 명사예요.'))],
    observation: q('', '', 'hour 앞에 an을 쓰는 기준은?', ['첫 글자 h', '첫소리가 모음', '기차 시간'], '첫소리가 모음', 'hour는 h 소리가 나지 않아 an을 써요.', '글자가 아니라 소리를 생각해요.'),
    frame: { parts: ['I have ', ' ', '.'], slots: [{ label: '관사', options: ['a', 'an'] }, { label: '물건', options: ['bag', 'umbrella', 'orange'] }] }, checks: ['셀 수 있는 단수 명사인가요?', '바로 다음 단어의 첫소리에 a·an이 맞나요?'], clues: ['한 대상을 처음 소개하는지 보세요.', '다음 단어의 첫소리를 들어 보세요.', '셀 수 있는 단수 명사 앞의 관사를 확인해요.'],
    b: [q('She is an honest person.', '그녀는 정직한 사람이에요.', 'an을 쓰는 이유는?', ['person이 복수라서', 'honest가 모음 소리로 시작해서', 'h는 항상 모음이라서'], 'honest가 모음 소리로 시작해서', '관사 바로 뒤의 honest는 h 소리가 나지 않아요.', '관사 뒤에 오는 첫 단어의 소리예요.'), q('He has ___ blue umbrella.', '그는 파란 우산 하나가 있어요.', '빈칸에 맞는 말은?', ['an', 'a', '관사 없음'], 'a', '바로 다음 단어 blue가 자음 소리로 시작하므로 a예요.', 'umbrella보다 먼저 나오는 단어를 보세요.'), arrange('I need an egg.', '나는 달걀 하나가 필요해요.', '단수 egg는 모음 소리로 시작하므로 an을 써요.', '달걀 하나를 소개하는 문장이에요.')],
  },
  'definite-article': {
    reading: [line('I bought a pen and a notebook at the store yesterday.', '나는 어제 가게에서 펜 하나와 공책 하나를 샀어요.', gloss('a pen', 'pen', '펜 하나', '부정관사 + 명사', '펜을 처음 소개해요.')), line('The pen is blue, and I use it to write in the notebook.', '그 펜은 파란색이고, 나는 그 펜으로 그 공책에 글을 써요.', gloss('The pen', 'pen', '그 펜', '정관사 + 명사', '앞에서 소개한 펜을 다시 가리켜요.'), gloss('it', 'it', '그것', '대명사', '같은 펜을 받아요.'))],
    observation: q('', '', '두 번째 문장의 The pen은?', ['새로 나온 다른 펜', '어제 산 그 펜', '모든 펜'], '어제 산 그 펜', '앞에서 소개해 듣는 사람도 알 수 있는 같은 펜이에요.', '첫 문장에서 어떤 물건을 소개했나요?'),
    frame: { parts: ['I have a ', '. The ', ' is blue.'], slots: [{ label: '소개한 뒤 다시 가리킬 물건', options: ['bag', 'pen'] }], bindings: [0, 0] }, checks: ['the가 가리키는 대상을 상대도 알 수 있나요?', '일반적인 대상에 불필요하게 the를 붙이지 않았나요?'], clues: ['앞 문장에 같은 대상이 나왔는지 보세요.', '이미 소개한 대상을 다시 말해요.', '상대가 어떤 문인지 아는 상황이에요.'],
    b: [q('Please open the window beside you.', '당신 옆의 창문을 열어 주세요.', 'the를 쓸 수 있는 이유는?', ['항상 창문은 하나라서', '어느 창문인지 알 수 있어서', 'window가 복수라서'], '어느 창문인지 알 수 있어서', 'beside you가 어떤 창문인지 특정해 줘요.', '듣는 사람이 대상을 찾을 수 있나요?'), q('I like ___.', '나는 개를 좋아해요.', '개 일반을 말하는 표현은?', ['the dog', 'a dogs', 'dogs'], 'dogs', '개 일반을 말할 때 복수 dogs를 관사 없이 써요.', '특정한 한 마리를 가리키지 않아요.'), arrange('The bag is heavy.', '그 가방은 무거워요.', '서로 어떤 가방인지 알 때 the bag이라고 해요.', '이미 아는 가방의 상태를 말해요.')],
  },
  number: {
    reading: [line('I have two tickets for the concert on Friday night.', '나는 금요일 밤 공연 표가 두 장 있어요.', gloss('two', 'two', '둘', '수사', '표의 개수를 나타내요.')), line('It is my first concert this year, and my friend is coming with me.', '올해 내 첫 공연이고, 내 친구가 함께 갈 거예요.', gloss('first', 'first', '첫 번째', '수사', '공연의 순서를 나타내요.'))],
    observation: q('', '', 'first는 어떤 정보인가요?', ['표 두 장', '공연의 순서', '공연 시간'], '공연의 순서', 'first는 몇 번째인지, two는 몇 개인지 알려줘요.', '몇 개인지와 몇 번째인지 구분해요.'),
    frame: { parts: ['I have ', ' ', '.'], slots: [{ label: '개수', options: ['two', 'three', 'four'] }, { label: '물건', options: ['books', 'bags', 'tickets'] }] }, checks: ['개수와 순서 중 필요한 뜻을 골랐나요?', '개수에 맞게 명사의 단수·복수를 썼나요?'], clues: ['몇 번째인지 말하는지 보세요.', '사람이 몇 명인지 나타내요.', '여러 개일 때 명사의 끝도 확인해요.'],
    b: [q('We live on the third floor.', '우리는 3층에 살아요.', 'third는?', ['개수', '순서', '빈도'], '순서', 'third는 층의 순서를 나타내요.', '세 개의 층에 산다는 뜻은 아니에요.'), q('I need two ___.', '나는 컵 두 개가 필요해요.', '명사의 형태는?', ['cup', 'cups', 'second'], 'cups', 'two 뒤에는 셀 수 있는 명사 cup의 복수형을 써요.', '두 개라는 수에 맞춰요.'), arrange('This is my first day.', '오늘은 내 첫날이에요.', 'first는 day의 순서를 나타내요.', '첫 번째라는 말을 day 앞에 놓아요.')],
  },
  preposition: {
    reading: [line('We meet at seven near the park before we go to school.', '우리는 학교에 가기 전에 공원 근처에서 일곱 시에 만나요.', gloss('at seven', 'at', '일곱 시에', '전치사구', '만나는 시각을 알려줘요.'), gloss('to school', 'to', '학교로', '전치사구', '가는 방향·목적지를 나타내요.')), line('My bag is under the bench, and your book is in it.', '내 가방은 벤치 아래에 있고, 네 책은 그 안에 있어요.', gloss('under', 'under', '아래에', '전치사', '가방과 벤치의 위치 관계예요.'))],
    observation: q('', '', '학교에 가는 방향을 나타내는 부분은?', ['at seven', 'to school', 'under the bench'], 'to school', 'to school의 to는 명사 school 앞에서 방향을 나타내요.', '시간·장소·방향 중 방향을 찾아요.'),
    frame: { parts: ['The ', ' is ', ' the bag.'], slots: [{ label: '물건', options: ['key', 'book'] }, { label: '위치', options: ['in', 'under', 'near'] }] }, checks: ['장소·시간·방향 중 뜻이 분명한가요?', '전치사 뒤에 알맞은 명사·대명사를 썼나요?'], clues: ['탁자와의 위치 관계를 찾아요.', '정확한 시각을 말할 때의 표현이에요.', '장소 표현은 전치사와 명사를 함께 놓아요.'],
    b: [q('I want to study at home.', '나는 집에서 공부하고 싶어요.', '이 문장의 to는?', ['전치사', '부정사 표지', '접속사'], '부정사 표지', '동사원형 study 앞의 to는 부정사 표지예요.', 'to 뒤의 말이 명사인지 동사인지 보세요.'), q('We meet ___ Monday.', '우리는 월요일에 만나요.', '요일 앞의 전치사는?', ['in', 'at', 'on'], 'on', '요일 Monday 앞에는 on을 써요.', '시각과 요일은 다른 전치사를 써요.'), arrange('The cup is on the desk.', '컵은 책상 위에 있어요.', 'on the desk가 컵의 위치를 나타내요.', '무엇이 어디에 있는지 순서대로 놓아요.')],
  },
  conjunction: {
    reading: [line('I want to walk to the store, but it is raining.', '나는 가게까지 걸어가고 싶지만 비가 와요.', gloss('but', 'but', '하지만', '접속사', '걷고 싶은 마음과 다른 상황을 연결해요.')), line('I take the bus because I need bread and milk for breakfast.', '나는 아침 식사에 필요한 빵과 우유를 사야 해서 버스를 타요.', gloss('because', 'because', '왜냐하면', '접속사', '버스를 타는 이유를 연결해요.'), gloss('and', 'and', '그리고', '접속사', '같은 역할의 두 명사를 연결해요.'))],
    observation: q('', '', '버스를 타는 이유를 연결하는 말은?', ['but', 'because', 'and'], 'because', 'because 뒤에서 빵과 우유가 필요하다는 이유를 말해요.', '왜 그런 행동을 하는지 알려주는 부분이에요.'),
    frame: { parts: ['I am ', ' but ', '.'], slots: [{ label: '첫 상태', options: ['tired', 'busy'] }, { label: '대조되는 상태', options: ['happy', 'excited'] }] }, checks: ['두 내용의 관계에 맞는 접속사인가요?', 'because 뒤에 주어와 동사가 있나요? 해당 없으면 연결한 말의 역할을 확인해요.'], clues: ['두 상태가 대조되는지 보세요.', '집에 있는 이유를 이어줘요.', '같은 역할의 두 대상을 이어줘요.'],
    b: [q('It is late, so we go home.', '늦어서 우리는 집에 가요.', 'so 뒤의 내용은?', ['이유', '결과', '선택'], '결과', '늦었다는 상황에 따른 결과를 so로 이어요.', '앞의 상황 때문에 무엇을 하는지 보세요.'), q('I am tired ___ I worked all day.', '나는 하루 종일 일해서 피곤해요.', '이유를 연결하려면?', ['because', 'or', 'but'], 'because', 'because 뒤의 절이 피곤한 이유를 말해요.', '뒤에 주어와 동사가 있는 이유가 나와요.'), arrange('Would you like tea or coffee?', '차와 커피 중 무엇을 드시겠어요?', 'or은 두 선택지를 연결해요.', '추가가 아니라 선택하는 상황이에요.')],
  },
  auxiliary: {
    reading: [line('I am reading a book at home while my sister cooks.', '나는 여동생이 요리하는 동안 집에서 책을 읽고 있어요.', gloss('am', 'be', '진행형을 만드는 말', '기본 조동사', 'reading과 함께 지금 하는 일을 나타내요.')), line('She asks, "Do you want some tea?" I do not want any today.', '여동생이 차를 마시겠냐고 물어요. 나는 오늘은 마시고 싶지 않아요.', gloss('Do', 'do', '질문을 만드는 말', '기본 조동사', 'want의 의문문을 도와요.'), gloss('do not', 'do', '~하지 않다', '기본 조동사 + 부정', 'want를 부정해요.'))],
    observation: q('', '', '첫 문장의 am은 무엇을 돕나요?', ['책의 소유', '지금 읽고 있는 행동', '과거의 요리'], '지금 읽고 있는 행동', 'am이 reading과 함께 진행형을 만들어요.', 'am 뒤에 오는 동사 형태를 보세요.'),
    frame: { parts: ['I am ', ' now.'], slots: [{ label: '지금 하는 일', options: ['reading', 'cooking', 'walking'] }] }, checks: ['be·do가 다른 동사를 돕고 있나요?', 'be 뒤의 -ing, do 뒤의 원형을 확인했나요?'],
    extra: 'have도 다른 동사를 도와요. I have eaten lunch.는 have + 과거분사로 완료를 나타내요. I have a bag.의 have는 소유를 나타내는 본동사예요. be·do·have의 쓰임은 뒤의 말과 함께 확인해요.',
    clues: ['다른 동사 앞에서 진행형을 돕는 말을 찾아요.', '일반 동사의 질문을 만드는 말을 골라요.', '지금 하는 일은 be와 -ing형을 함께 써요.'],
    b: [q('She does her homework.', '그녀는 숙제를 해요.', '여기의 does는?', ['본동사', '기본 조동사', '명사'], '본동사', 'does가 숙제를 한다는 행동을 직접 나타내요.', '다른 동사를 돕는지 확인해요.'), q('___ she work here?', '그녀는 여기에서 일하나요?', '질문을 만드는 말은?', ['Is', 'Does', 'Has'], 'Does', '일반 동사의 현재 의문문에서 she에는 Does를 써요.', '의문문에서 주어와 본동사를 확인해요.'), arrange('They are cooking dinner.', '그들은 저녁을 요리하고 있어요.', 'are와 cooking이 함께 진행형을 만들어요.', '주어에 맞는 be 뒤에 -ing형을 놓아요.')],
  },
  modal: {
    reading: [line('I can swim, but I cannot drive to the pool today.', '나는 수영할 수 있지만 오늘 수영장까지 운전해서 갈 수 없어요.', gloss('can', 'can', '~할 수 있다', '법조동사', '수영할 능력을 나타내요.')), line('My friend says I should rest because I must work early tomorrow.', '내 친구는 내가 내일 일찍 일해야 하니 쉬는 것이 좋겠다고 말해요.', gloss('should', 'should', '~하는 것이 좋다', '법조동사', '쉬라고 조언해요.'), gloss('must', 'must', '~해야 한다', '법조동사', '일해야 할 필요·의무를 나타내요.'))],
    observation: q('', '', '쉬는 것이 좋다는 조언은 어느 말인가요?', ['can', 'should', 'must'], 'should', 'should는 조언, must는 더 강한 필요·의무를 나타내요.', '가능한 일인지, 조언인지, 해야 하는 일인지 구분해요.'),
    frame: { parts: ['I can ', '.'], slots: [{ label: '할 수 있는 일', options: ['swim', 'cook', 'drive'] }] }, checks: ['능력·조언·의무 중 의도한 뜻인가요?', 'can·should·must 뒤에 동사원형을 썼나요?'],
    extra: 'have to는 She has to work.처럼 주어에 따라 바뀌어요. used to는 과거의 습관에 써요: I used to walk to school. 질문에서는 Did you use to walk?처럼 형태가 달라져요.',
    clues: ['쉬어야만 한다는 말인지 조언인지 보세요.', '법조동사 뒤에는 주어가 바뀌어도 원형을 써요.', '해야 한다는 뜻 뒤에 행동을 놓아요.'],
    b: [q('You must wear a seat belt.', '안전벨트를 매야 해요.', 'must의 뜻은?', ['능력', '의무', '과거 습관'], '의무', '안전벨트를 매야 한다는 의무를 나타내요.', '할 수 있다는 말보다 강한 필요를 나타내요.'), q('He should ___ now.', '그는 지금 쉬는 것이 좋겠어요.', '알맞은 형태는?', ['rests', 'rest', 'resting'], 'rest', 'should 뒤에는 동사원형 rest를 써요.', '주어 he 때문에 -s를 붙이지 않아요.'), arrange('She can speak English.', '그녀는 영어를 할 수 있어요.', 'can 뒤의 speak는 원형이에요.', '능력을 나타내는 말 뒤에 행동을 놓아요.')],
  },
  infinitive: {
    reading: [line('I go to the library because I want to learn English.', '나는 영어를 배우고 싶어서 도서관에 가요.', gloss('to the library', 'to', '도서관으로', '전치사구', '명사 앞에서 목적지를 나타내요.'), gloss('to learn', 'learn', '배우는 것', 'to 부정사', 'want 뒤에 원하는 행동을 나타내요.')), line('I read short stories there to practice before I meet my friend.', '나는 친구를 만나기 전에 연습하려고 그곳에서 짧은 이야기를 읽어요.', gloss('to practice', 'practice', '연습하려고', 'to 부정사', '읽는 목적을 나타내요.'))],
    observation: q('', '', '읽는 목적을 알려주는 표현은?', ['to the library', 'to practice', 'my friend'], 'to practice', 'to + 동사원형이 왜 읽는지 목적을 나타내요.', '어디로 가는지와 왜 하는지 구분해요.'),
    frame: { parts: ['I want to ', '.'], slots: [{ label: '하고 싶은 일', options: ['learn English', 'read a book', 'go home'] }] }, checks: ['원하는 행동이나 목적을 나타냈나요?', 'to 뒤에 동사원형을 썼나요?'], clues: ['to 뒤에 있는 말의 역할을 보세요.', '주어와 관계없이 to 뒤의 동사 형태를 확인해요.', '원하는 행동 앞에 to를 놓아요.'],
    b: [q('I go to the office at nine.', '나는 아홉 시에 사무실에 가요.', 'to the office의 to는?', ['부정사 표지', '전치사', '법조동사'], '전치사', '명사구 the office 앞에서 목적지를 나타내는 전치사예요.', 'to 뒤가 장소의 이름인지 행동인지 보세요.'), q('We walk ___ healthy.', '우리는 건강을 유지하려고 걸어요.', '목적을 나타내려면?', ['to stay', 'to staying', 'to stays'], 'to stay', '목적을 나타내는 to 뒤에는 동사원형 stay를 써요.', '왜 걷는지 알려주는 표현이에요.'), arrange('She wants to read a book.', '그녀는 책을 읽고 싶어요.', 'wants 뒤에 to와 동사원형 read를 놓아요.', '원하는 행동 앞의 to를 빠뜨리지 않아요.')],
  },
  exclamation: {
    reading: [line('"Hello!" I say when my friend comes to my home after work.', '친구가 퇴근 후 우리 집에 오면 나는 안녕 하고 인사해요.', gloss('Hello', 'hello', '안녕', '감탄사', '사람을 만났을 때 인사해요.')), line('"Wow! Your cake looks great!" she says, then adds, "Oops! I dropped my bag."', '친구는 케이크가 멋지다며 감탄한 뒤, 이런, 가방을 떨어뜨렸다고 말해요.', gloss('Wow', 'wow', '와', '감탄사', '좋은 놀람·감탄이에요.'), gloss('Oops', 'oops', '이런', '감탄사', '작은 실수에 대한 반응이에요.'))],
    observation: q('', '', '가방을 떨어뜨린 실수에 대한 반응은?', ['Hello', 'Oops', 'Wow'], 'Oops', 'Oops는 작은 실수를 알아차렸을 때 쓰는 반응이에요.', '인사와 놀람, 실수를 구분해요.'),
    frame: { parts: ['Wow! This is ', '.'], slots: [{ label: '감탄하는 점', options: ['beautiful', 'great', 'amazing'] }] }, checks: ['상황·감정에 맞는 반응인가요?', '상대와 상황에 어울리는 표현 강도인가요?'], clues: ['독립적으로 나오는 감탄을 찾아요.', '작은 실수에 어울리는 반응이에요.', '먼저 인사하고 반가운 마음을 이어 말해요.'],
    b: [q('Ouch! That hurts.', '아야! 아파요.', '화자의 상태는?', ['반가움', '갑작스러운 아픔', '작은 실수'], '갑작스러운 아픔', 'Ouch는 아픔에 대한 짧은 반응이에요.', '통증이 있을 때의 반응이에요.'), q('___! Your picture is amazing.', '와! 네 그림은 멋지다.', '감탄에 어울리는 말은?', ['Ouch', 'Wow', 'Oops'], 'Wow', 'Wow는 멋진 그림에 대한 놀람·감탄에 어울려요.', '실수나 통증이 아니라 좋은 놀람이에요.'), arrange('Hello! How are you?', '안녕! 어떻게 지내?', 'Hello로 인사하고 안부를 물어요.', '인사 뒤에 안부 질문을 놓아요.')],
  },
};

const alternativeOrders: Record<string, string[]> = {
  'verb:2:b:q3': ['Every night they read.'],
  'adverb:2:base:q3': ['At home I often cook.', 'I cook at home often.'],
  'adverb:2:a:q3': ['He slowly speaks.', 'Slowly he speaks.'],
  'definite-article:2:base:q3': ['Close the door please.'],
  'conjunction:2:base:q3': ['I like coffee and tea.'],
  'conjunction:2:b:q3': ['Would you like coffee or tea?'],
  'auxiliary:2:base:q3': ['Now I am reading.'],
  'modal:2:base:q3': ['Today I must work.'],
};

function prepare(question: GrammarQuestion, id: string, clue: string): GrammarQuestion {
  const result = question.kind === 'order'
    ? { ...question, ...arrange(question.answer, question.translation, question.explanation, clue), alternatives: [...(question.alternatives ?? []), ...(alternativeOrders[id] ?? [])] }
    : { ...question, clue };
  return { ...result, id, wrong: result.kind === 'choice' ? WRONG_CHOICE_REASONS[id] : undefined };
}
const reviewClues: Record<LessonId, [string, string, string]> = {
  noun: ['소유 표현 My 뒤에서 무엇을 가리키나요?', '열려 있는 장소의 이름이 필요해요.', '사람, 좋아하는 행동, 대상을 놓아요.'],
  verb: ['주어가 하는 행동을 찾아요.', '아는 상태를 나타내는 동사가 필요해요.', '주어가 한 사람일 때 현재형을 확인해요.'],
  pronoun: ['앞 문장의 여러 대상을 찾아요.', '나를 포함한 사람들이 주어예요.', '행동을 받는 대상의 형태를 골라요.'],
  adjective: ['수프가 어떤지 설명하는 말이에요.', '날씨를 설명하는 형용사가 필요해요.', '연결 동사 뒤에 상태를 놓아요.'],
  adverb: ['무엇을 어떻게 하는지 보세요.', '형용사의 정도를 나타내야 해요.', '말하는 행동 뒤에 방식을 놓아요.'],
  determiner: ['물의 양을 나타내는 말을 찾아요.', '소유를 나타내는 한정사는 관사와 겹치지 않아요.', '멀리 있는 여러 책이에요.'],
  'indefinite-article': ['첫 글자보다 첫소리를 확인해요.', '이 단어의 첫소리를 들어 보세요.', '우산 하나를 처음 소개해요.'],
  'definite-article': ['특정 고양이인지 고양이 일반인지 보세요.', '방금 소개한 같은 부엌이에요.', '서로 아는 책을 가리켜요.'],
  number: ['몇 개인지, 몇 번째인지 구분해요.', '이곳에서 보내는 날의 순서예요.', '몇 번째 방문인지 나타내요.'],
  preposition: ['to 뒤에 장소의 이름이 와요.', '전치사 뒤에는 목적격 대명사를 써요.', '책과 탁자의 위치 관계를 나타내요.'],
  conjunction: ['두 가지 중 하나를 고르는 상황이에요.', '추운 상황에 따른 행동을 이어줘요.', '대조되는 두 상태를 연결해요.'],
  auxiliary: ['다른 동사를 돕는지 직접 행동인지 보세요.', '일반 동사의 현재 부정문을 만드는 형태예요.', '과거분사와 함께 완료를 만들어요.'],
  modal: ['상대가 떠나도 되는 상황이에요.', '이 표현은 주어에 맞춰 형태가 바뀌어요.', '조언 뒤에 동사원형을 놓아요.'],
  infinitive: ['어디로 가는지보다 왜 걷는지 말해요.', 'to 뒤의 동사 형태를 확인해요.', '원하는 행동 앞에 to를 놓아요.'],
  exclamation: ['갑자기 아플 때의 반응이에요.', '사람을 만나는 인사 상황이에요.', '감탄 뒤에 그 대상을 설명해요.'],
};
const commonMistakes: Record<LessonId, string> = {
  noun: '같은 work도 문장에서 이름인지 행동인지 확인해요.',
  verb: '현재 습관을 말할 때 he·she 뒤에서는 walks처럼 -s를 확인해요.',
  pronoun: 'She helps me.의 She와 I help her.의 her는 자리가 달라요.',
  adjective: '사람의 성질은 careful, 행동 방식은 carefully로 표현해요.',
  adverb: 'friendly는 형용사예요. -ly라는 끝모양만으로 판단하지 않아요.',
  determiner: 'this book은 한 권, these books는 여러 권이에요.',
  'indefinite-article': '첫 글자가 아니라 바로 다음 단어의 첫소리로 a·an을 골라요.',
  'definite-article': '개 일반은 dogs, 서로 아는 그 개는 the dog라고 해요.',
  number: 'two는 두 개, second는 두 번째예요.',
  preposition: 'to school의 to와 to study의 to는 역할이 달라요.',
  conjunction: 'because로 이유를 이을 때 뒤에 주어와 동사가 필요해요.',
  auxiliary: '진행형에서는 I reading.처럼 be를 빼지 않아요.',
  modal: 'She can swims.가 아니라 She can swim.이에요.',
  infinitive: 'to 뒤에는 reading이 아니라 동사원형 read를 써요.',
  exclamation: '느낌표가 있다고 모두 감탄사는 아니에요.',
};
export const PRACTICE_LESSONS = Object.fromEntries(GRAMMAR_LESSONS.map((lesson): [LessonId, LessonPractice] => {
  const data = authored[lesson.id];
  return [lesson.id, {
    ...data, commonMistake: commonMistakes[lesson.id], observation: { ...data.observation, id: `${lesson.id}:2:notice`, wrong: WRONG_CHOICE_REASONS[`${lesson.id}:2:notice`] },
    questions: lesson.questions.map((question, i) => prepare(question, `${lesson.id}:2:base:q${i + 1}`, data.clues[i])),
    reviews: {
      a: lesson.review.map((question, i) => prepare(question, `${lesson.id}:2:a:q${i + 1}`, reviewClues[lesson.id][i])),
      b: data.b.map((question, i) => prepare(question, `${lesson.id}:2:b:q${i + 1}`, question.clue!)),
    },
  }];
})) as Record<LessonId, LessonPractice>;

export function lessonForVersion(lesson: GrammarLesson, version?: number): GrammarLesson {
  if (version !== 2 || lesson.id !== 'auxiliary') return lesson;
  return { ...lesson, pattern: 'be + -ing: I am reading. / do + 동사원형: Do you work?', mistake: 'I am happy.의 am은 상태를 연결해요. I am reading.의 am은 reading을 도와요. I do homework.의 do는 행동, Do you work?의 Do는 질문을 도와요.' };
}

export function frameSentence(frame: LessonPractice['frame'], values: string[]) {
  return frame.parts.map((part, i) => {
    const slot = i < frame.parts.length - 1 ? (frame.bindings?.[i] ?? i) : -1;
    return part + (frame.slots[slot] ? (values[slot] ?? frame.slots[slot].options[0]) : '');
  }).join('');
}

export function glossRanges(line: ReadingLine) {
  return line.glosses.map(g => {
    const escaped = g.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = [...line.en.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gu'))];
    const start = matches[g.occurrence ?? 0]?.index ?? -1;
    return { ...g, start, end: start + g.text.length };
  }).sort((a, b) => a.start - b.start);
}
