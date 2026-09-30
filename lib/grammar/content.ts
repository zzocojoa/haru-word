import type { LessonId, GrammarAnswer, GrammarProgress } from './model';

export type GrammarQuestion = { id?: string; clue?: string; wrong?: Record<string, string>; kind: 'choice' | 'order'; prompt: string; context: string; translation: string; options: string[]; answer: string; alternatives?: string[]; explanation: string; orderFormat?: {punctuation:string;properWords:string[]} };
export type GrammarLesson = {
  id: LessonId; pos: string; title: string; group: string; role: string; pattern: string; mistake: string;
  examples: [string, string, string][]; notice: string; noticeAnswer: string;
  questions: GrammarQuestion[]; review: GrammarQuestion[];
  stem: string; writing: string; check: string; reference: string;
};
const choice = (context: string, translation: string, prompt: string, options: string[], answer: string, explanation: string): GrammarQuestion => ({ kind: 'choice', context, translation, prompt, options, answer, explanation });
const order = (translation: string, options: string[], answer: string, explanation: string): GrammarQuestion => ({ kind: 'order', context: '', translation, prompt: '뜻에 맞게 조각을 차례로 선택하세요.', options, answer, explanation });
const classes = 'https://dictionary.cambridge.org/grammar/british-grammar/word-classes-and-phrase-classes';
export const GRAMMAR_LESSONS: GrammarLesson[] = [
  {
    id: 'noun', pos: 'n.', title: '명사', group: '문장 뼈대', role: '사람·장소·사물·생각에 이름을 붙이는 말이에요.', pattern: '주어 자리: Birds sing. / 목적어 자리: I like birds.', mistake: '같은 철자도 문장에서 역할이 달라요. I work의 work는 동사, My work의 work는 명사예요.',
    examples: [['My friend cooks.', '내 친구는 요리해요.', 'friend'], ['I like music.', '나는 음악을 좋아해요.', 'music']], notice: '누구 또는 무엇의 이름을 나타내는 말은 무엇인가요?', noticeAnswer: 'friend는 사람, music은 좋아하는 대상의 이름이에요.',
    questions: [
      choice('The teacher reads.', '선생님이 읽어요.', '사람의 이름을 나타내는 명사는?', ['reads', 'teacher', 'The'], 'teacher', 'teacher가 읽는 사람을 가리켜요. reads는 행동이에요.'),
      choice('I need a ___.', '나는 가방 하나가 필요해요.', '빈칸에 알맞은 말은?', ['carry', 'heavy', 'bag'], 'bag', 'a 다음에 필요한 사물의 이름 bag이 와요.'),
      order('나는 음악을 좋아해요.', ['music.', 'I', 'like'], 'I like music.', 'I가 주어, like가 동사, music이 좋아하는 대상인 명사예요.'),
    ], review: [
      choice('My work starts at nine.', '내 일은 아홉 시에 시작해요.', '이 문장의 work는?', ['명사', '동사', '형용사'], '명사', 'My work는 시작하는 대상인 일을 가리키는 명사구예요.'),
      choice('The ___ is open.', '그 가게는 열려 있어요.', '빈칸에 알맞은 말은?', ['quickly', 'shop', 'buy'], 'shop', '열려 있는 장소의 이름 shop이 필요해요.'),
      order('내 친구는 차를 좋아해요.', ['likes', 'tea.', 'My friend'], 'My friend likes tea.', 'friend와 tea는 각각 사람과 음료를 가리키는 명사예요.'),
    ], stem: 'I like music.', writing: 'music을 좋아하는 다른 것으로 바꿔 보세요.', check: '사람·사물·생각의 이름을 넣었나요?', reference: classes,
  },
  {
    id: 'verb', pos: 'v.', title: '동사', group: '문장 뼈대', role: '무엇을 하거나 어떤 상태인지 나타내요.', pattern: '주어 + 동사: I work. / 주어 + 동사 + 대상: She likes tea.', mistake: '동사는 행동만 나타내지 않아요. know·like처럼 생각이나 상태를 나타내기도 해요.',
    examples: [['I walk home.', '나는 집으로 걸어가요.', 'walk'], ['She knows the answer.', '그녀는 답을 알아요.', 'knows']], notice: '행동을 나타내는 말과 아는 상태를 나타내는 말을 찾아보세요.', noticeAnswer: 'walk는 행동, knows는 아는 상태를 나타내는 동사예요.',
    questions: [
      choice('They live here.', '그들은 여기에 살아요.', '동사는?', ['They', 'here', 'live'], 'live', 'live가 사는 상태를 나타내요.'),
      choice('She ___ every day.', '그녀는 매일 걸어요.', '현재의 습관에 알맞은 말은?', ['walks', 'walking', 'walk'], 'walks', '현재 습관을 말하며 주어가 she일 때 walks를 써요.'),
      order('나는 차를 마셔요.', ['tea.', 'drink', 'I'], 'I drink tea.', '주어 I 뒤에 행동을 나타내는 drink를 놓아요.'),
    ], review: [
      choice('I work at home.', '나는 집에서 일해요.', '이 문장의 work는?', ['명사', '동사', '전치사'], '동사', '주어 I가 하는 행동을 나타내요.'),
      choice('They ___ the answer.', '그들은 답을 알아요.', '빈칸에 알맞은 말은?', ['knowledge', 'known', 'know'], 'know', '주어 They 뒤에서 아는 상태를 나타내는 동사 know가 필요해요.'),
      order('그는 점심을 요리해요.', ['lunch.', 'He', 'cooks'], 'He cooks lunch.', 'He 뒤에 cooks를 놓고 요리하는 대상 lunch를 덧붙여요.'),
    ], stem: 'I drink tea.', writing: 'drink tea를 평소 하는 다른 행동으로 바꿔 보세요.', check: '주어가 하는 일이나 상태를 나타내는 동사가 있나요?', reference: classes,
  },
  {
    id: 'pronoun', pos: 'pron.', title: '대명사', group: '문장 뼈대', role: '문맥에서 알 수 있는 사람이나 대상을 명사 대신 가리켜요.', pattern: '주어: I·she·they / 목적어: me·her·them', mistake: '주어와 목적어 자리에 따라 형태가 달라요. She likes him.에서 her나 he로 바꾸지 않아요.',
    examples: [['Mina is here. She is ready.', '미나가 여기 있어요. 그녀는 준비됐어요.', 'She'], ['I know Mina. I like her.', '나는 미나를 알아요. 나는 그녀를 좋아해요.', 'her']], notice: 'She와 her는 누구를 가리키고 각각 어느 자리에 있나요?', noticeAnswer: '둘 다 미나를 가리켜요. She는 주어, her는 like의 목적어예요.',
    questions: [
      choice('Tom is kind. He helps me.', '톰은 친절해요. 그는 나를 도와줘요.', 'He가 가리키는 사람은?', ['나', 'Tom', '다른 사람'], 'Tom', '바로 앞에서 말한 Tom을 He로 받아요.'),
      choice('I see Anna. I wave to ___.', '나는 안나를 봐요. 나는 그녀에게 손을 흔들어요.', '빈칸에 알맞은 말은?', ['she', 'hers', 'her'], 'her', '전치사 to 뒤에는 목적격 her를 써요.'),
      order('그녀는 나를 알아요.', ['me.', 'She', 'knows'], 'She knows me.', 'She가 주어이고 me는 knows의 목적어예요.'),
    ], review: [
      choice('The bags are heavy. They are blue.', '그 가방들은 무거워요. 그것들은 파란색이에요.', 'They는 무엇을 가리키나요?', ['가방들', '색깔', '사람들'], '가방들', '복수 명사 The bags를 They로 받아요.'),
      choice('Ben and I are ready. ___ can go.', '벤과 나는 준비됐어요. 우리는 갈 수 있어요.', '빈칸에 알맞은 말은?', ['Us', 'Our', 'We'], 'We', '나를 포함한 여러 사람이 주어일 때 We예요.'),
      order('나는 그들을 도와요.', ['help', 'them.', 'I'], 'I help them.', 'help 뒤의 대상에는 목적격 them을 써요.'),
    ], stem: 'She helps me.', writing: 'She를 가족이나 친구를 가리키는 다른 대명사로 바꿔 보세요.', check: '대명사가 누구를 가리키는지 알고, 주어·목적어 형태를 골랐나요?', reference: classes,
  },
  {
    id: 'adjective', pos: 'adj.', title: '형용사', group: '설명을 더하는 말', role: '사람이나 사물의 성질·상태를 설명해요.', pattern: '명사 앞: a quiet room / be 뒤: The room is quiet.', mistake: '행동 방식을 설명하는 부사와 구분해요. She is careful. / She drives carefully.',
    examples: [['She is careful.', '그녀는 조심성이 있어요.', 'careful'], ['She drives carefully.', '그녀는 조심스럽게 운전해요.', 'carefully']], notice: '사람의 성질을 설명하는 말은 어느 쪽인가요?', noticeAnswer: 'careful은 사람의 성질을 설명하는 형용사, carefully는 운전 방식을 설명하는 부사예요.',
    questions: [
      choice('The room is quiet.', '그 방은 조용해요.', '방의 상태를 설명하는 말은?', ['room', 'quiet', 'is'], 'quiet', 'quiet이 room의 상태를 설명해요.'),
      choice('My brother is ___.', '내 남동생은 조심성이 있어요.', '빈칸에 알맞은 말은?', ['care', 'carefully', 'careful'], 'careful', 'be 뒤에서 사람의 성질을 설명하는 형용사 careful이에요.'),
      order('이것은 작은 가방이에요.', ['a small bag.', 'This', 'is'], 'This is a small bag.', 'small은 명사 bag 바로 앞에서 가방의 크기를 설명해요.'),
    ], review: [
      choice('The soup tastes good.', '그 수프는 맛이 좋아요.', 'good은 무엇을 설명하나요?', ['맛보는 속도', '수프의 맛', '요리한 시간'], '수프의 맛', '연결 동사 tastes 뒤의 good은 수프의 상태를 설명하는 형용사예요.'),
      choice('It is a ___ day.', '화창한 날이에요.', '빈칸에 알맞은 말은?', ['sunny', 'sun', 'sunshine'], 'sunny', '명사 day 앞에서 날씨를 설명하는 형용사 sunny를 써요.'),
      order('내 친구는 피곤해요.', ['tired.', 'My friend', 'is'], 'My friend is tired.', 'tired는 be 뒤에서 친구의 상태를 나타내요.'),
    ], stem: 'My brother is kind.', writing: '사람이나 성질 한 부분을 바꿔 아는 사람을 설명해 보세요.', check: '형용사가 어떤 사람이나 사물을 설명하는지 말할 수 있나요?', reference: classes,
  },
  {
    id: 'adverb', pos: 'adv.', title: '부사', group: '설명을 더하는 말', role: '행동의 방식·빈도나 형용사 등의 정도를 더 자세히 설명해요.', pattern: '행동 방식: walk slowly / 빈도: often cook / 정도: very cold', mistake: '모든 -ly가 부사는 아니에요. friendly는 보통 형용사이고, fast는 부사로도 써요.',
    examples: [['He speaks slowly.', '그는 천천히 말해요.', 'slowly'], ['It is very cold.', '매우 추워요.', 'very']], notice: 'slowly는 말하는 방식을, very는 무엇의 정도를 설명하나요?', noticeAnswer: 'very는 형용사 cold의 정도를 높여요. 부사는 동사만 꾸미는 말이 아니에요.',
    questions: [
      choice('She walks slowly.', '그녀는 천천히 걸어요.', '걷는 방식을 설명하는 말은?', ['She', 'slowly', 'walks'], 'slowly', 'slowly가 walks라는 행동을 어떻게 하는지 설명해요.'),
      choice('He drives ___.', '그는 조심스럽게 운전해요.', '빈칸에 알맞은 말은?', ['careful', 'care', 'carefully'], 'carefully', '운전하는 방식을 설명할 때 부사 carefully를 써요.'),
      { ...order('나는 자주 집에서 요리해요.', ['at home.', 'often', 'I', 'cook'], 'I often cook at home.', 'often은 보통 cook 앞에 놓아요. I cook often at home.처럼 동사 뒤에 놓아도 뜻이 맞아요.'), alternatives: ['I cook often at home.', 'often I cook at home.'] },
    ], review: [
      choice('She runs fast.', '그녀는 빨리 달려요.', '이 문장의 fast는?', ['명사', '부사', '관사'], '부사', '-ly가 없어도 달리는 방식을 설명하므로 부사예요.'),
      choice('The tea is ___ hot.', '그 차는 매우 뜨거워요.', '정도를 나타내는 말은?', ['very', 'friend', 'heat'], 'very', 'very는 형용사 hot의 정도를 나타내요.'),
      order('그는 천천히 말해요.', ['slowly.', 'speaks', 'He'], 'He speaks slowly.', '부사 slowly가 말하는 방식을 설명해요.'),
    ], stem: 'I often cook at home.', writing: 'often을 빈도를 나타내는 다른 말로 바꿔 보세요.', check: '부사가 어떤 행동이나 성질을 더 자세히 설명하나요?', reference: classes,
  },
  {
    id: 'determiner', pos: 'det.', title: '한정사', group: '명사를 특정하는 말', role: '명사 앞에서 어느 것인지, 누구의 것인지, 얼마나 있는지 범위를 정해요.', pattern: 'this book / my bag / some water', mistake: '관사도 한정사의 한 종류예요. 보통 my와 the를 겹쳐 my the bag이라고 쓰지 않아요.',
    examples: [['This book is new.', '이 책은 새것이에요.', 'This'], ['My book is old.', '내 책은 오래됐어요.', 'My']], notice: 'This와 My가 book에 어떤 정보를 더하나요?', noticeAnswer: 'This는 어느 책인지, My는 누구의 책인지 알려줘요.',
    questions: [
      choice('My bag is blue.', '내 가방은 파란색이에요.', '가방이 누구 것인지 알려주는 말은?', ['blue', 'My', 'bag'], 'My', 'My가 명사 bag 앞에서 소유자를 알려줘요.'),
      choice('___ books are mine.', '이 책들은 내 것이에요.', '가까이 있는 여러 책을 가리키려면?', ['This', 'That', 'These'], 'These', '복수 books에는 복수형 These를 써요.'),
      order('이 가방은 내 것이에요.', ['is mine.', 'This', 'bag'], 'This bag is mine.', '한정사 This를 명사 bag 앞에 놓아요.'),
    ], review: [
      choice('I need some water.', '나는 물이 좀 필요해요.', '양의 범위를 정하는 말은?', ['need', 'water', 'some'], 'some', 'some은 명사 water의 양을 막연하게 나타내는 한정사예요.'),
      choice('I like ___ new bag.', '나는 내 새 가방이 좋아요.', '알맞은 표현은?', ['my the', 'my', 'the my'], 'my', 'my 자체가 누구의 것인지 정하므로 the를 겹치지 않아요.'),
      order('저 책들은 오래됐어요.', ['books', 'Those', 'are old.'], 'Those books are old.', 'Those는 멀리 있는 복수 명사 books를 가리켜요.'),
    ], stem: 'My bag is blue.', writing: 'My를 This 또는 That으로 바꾸고 뜻 차이를 생각해 보세요.', check: '명사 앞에서 어느 것·누구 것·얼마나인지를 정했나요?', reference: 'https://dictionary.cambridge.org/grammar/british-grammar/determiners-the-my-some-this',
  },
  {
    id: 'indefinite-article', pos: 'indefinite article', title: '부정관사', group: '명사를 특정하는 말', role: '셀 수 있는 단수 명사를 하나 소개할 때 a 또는 an을 써요.', pattern: 'a book / an apple / an hour / a university', mistake: 'a·an은 다음 단어의 첫 글자가 아니라 첫소리로 골라요. water처럼 보통 셀 수 없는 명사에는 바로 붙이지 않아요.',
    examples: [['I have a bag.', '나는 가방 하나가 있어요.', 'a'], ['I ate an apple.', '나는 사과 하나를 먹었어요.', 'an']], notice: 'bag과 apple 앞의 관사가 다른 까닭은 무엇일까요?', noticeAnswer: 'bag은 자음 소리로, apple은 모음 소리로 시작해요.',
    questions: [
      choice('I saw a dog.', '나는 개 한 마리를 봤어요.', 'a는 무엇을 나타내나요?', ['여러 마리', '특정하지 않은 한 마리', '이미 언급한 그 개'], '특정하지 않은 한 마리', '처음 소개하는 셀 수 있는 단수 dog 앞에 a를 써요.'),
      choice('She ate ___ orange.', '그녀는 오렌지 하나를 먹었어요.', '빈칸에 알맞은 말은?', ['an', 'a', '두 관사 모두 생략'], 'an', 'orange는 모음 소리로 시작하는 셀 수 있는 단수 명사예요.'),
      order('나는 책 한 권이 있어요.', ['a book.', 'have', 'I'], 'I have a book.', '처음 소개하는 한 권의 book 앞에 a를 써요.'),
    ], review: [
      choice('We waited for an hour.', '우리는 한 시간 기다렸어요.', 'an을 쓰는 이유는?', ['h로 쓰기 때문에', 'hour가 복수라서', 'hour의 첫소리가 모음이라서'], 'hour의 첫소리가 모음이라서', 'hour의 h는 소리 나지 않으므로 an을 써요.'),
      choice('It is ___ university.', '그곳은 대학이에요.', '빈칸에 알맞은 말은?', ['an', 'a', '관사 없음'], 'a', 'university는 /j/ 자음 소리로 시작하므로 a예요.'),
      order('그녀는 우산 하나가 있어요.', ['has', 'She', 'an umbrella.'], 'She has an umbrella.', 'umbrella는 모음 소리로 시작해 an을 써요.'),
    ], stem: 'I have a bag.', writing: 'bag을 가지고 있는 다른 물건으로 바꾸고 a·an을 고르세요.', check: '셀 수 있는 단수 명사인가요? 다음 단어의 첫소리에 맞게 a·an을 골랐나요?', reference: 'https://learnenglish.britishcouncil.org/grammar/a1-a2-grammar/articles-a-an-the',
  },
  {
    id: 'definite-article', pos: 'definite article', title: '정관사', group: '명사를 특정하는 말', role: '말하는 사람과 듣는 사람이 어떤 대상인지 알 수 있을 때 the를 써요.', pattern: 'I saw a dog. The dog was small. / Close the door.', mistake: '모든 명사 앞에 the를 붙이지 않아요. 일반적으로 고양이를 좋아한다면 I like cats.라고 해요.',
    examples: [['I bought a book. The book is short.', '나는 책 한 권을 샀어요. 그 책은 짧아요.', 'The'], ['Please close the door.', '그 문을 닫아 주세요.', 'the']], notice: '어떤 책, 어떤 문인지 상대가 알 수 있나요?', noticeAnswer: '방금 말한 책이거나 상황에서 함께 보고 있는 문처럼 대상을 특정할 수 있어요.',
    questions: [
      choice('I saw a cat. The cat was black.', '나는 고양이 한 마리를 봤어요. 그 고양이는 검었어요.', 'The cat은 어느 고양이인가요?', ['고양이 전체', '아직 모르는 다른 고양이', '방금 말한 고양이'], '방금 말한 고양이', '앞 문장의 a cat을 다시 말하므로 the로 특정해요.'),
      choice('I bought a pen. ___ pen is blue.', '나는 펜 하나를 샀어요. 그 펜은 파란색이에요.', '빈칸에 알맞은 말은?', ['A', 'The', 'An'], 'The', '이미 소개한 같은 펜을 가리키므로 The예요.'),
      order('그 문을 닫아 주세요.', ['the door.', 'Please', 'close'], 'Please close the door.', '상대가 어떤 문인지 아는 상황에서 the door라고 해요.'),
    ], review: [
      choice('I like cats.', '나는 고양이를 좋아해요.', '고양이 일반을 말할 때 the가 꼭 필요한가요?', ['아니요', '네'], '아니요', '복수 명사로 대상을 일반적으로 말할 때 관사 없이 쓸 수 있어요.'),
      choice('We have one kitchen. ___ kitchen is small.', '우리 집에는 부엌이 하나 있어요. 그 부엌은 작아요.', '빈칸에 알맞은 말은?', ['An', 'The', 'A'], 'The', '방금 언급해 특정할 수 있는 부엌이므로 The예요.'),
      order('그 책은 내 것이에요.', ['is mine.', 'The', 'book'], 'The book is mine.', '어떤 책인지 아는 상대에게 the book이라고 해요.'),
    ], stem: 'I have a bag. The bag is blue.', writing: '물건과 그 특징을 바꿔 두 문장을 써 보세요.', check: 'the가 가리키는 대상을 상대도 알아볼 수 있나요?', reference: 'https://learnenglish.britishcouncil.org/grammar/a1-a2-grammar/articles-a-an-the',
  },
  {
    id: 'number', pos: 'number', title: '수사', group: '명사를 특정하는 말', role: 'one·two는 개수, first·second는 순서를 나타내요.', pattern: 'two books / the second floor / my first day', mistake: '2개(two)와 두 번째(second)는 달라요. two 뒤의 셀 수 있는 명사는 보통 복수예요.',
    examples: [['I have two bags.', '나는 가방 두 개가 있어요.', 'two'], ['This is my second bag.', '이것은 내 두 번째 가방이에요.', 'second']], notice: '개수와 순서를 나타내는 말을 구분해 보세요.', noticeAnswer: 'two는 몇 개인지, second는 몇 번째인지 알려줘요.',
    questions: [
      choice('This is my first visit.', '이것은 내 첫 방문이에요.', 'first는 무엇을 나타내나요?', ['색깔', '개수', '순서'], '순서', '여러 방문 가운데 첫 번째라는 순서예요.'),
      choice('I have ___ brothers.', '나는 형제가 두 명 있어요.', '빈칸에 알맞은 말은?', ['second', 'two', 'twice'], 'two', '몇 명인지 개수를 말하므로 two예요.'),
      order('나는 책 세 권이 있어요.', ['three books.', 'I', 'have'], 'I have three books.', 'three 뒤의 셀 수 있는 명사 book을 복수 books로 써요.'),
    ], review: [
      choice('She has four tickets.', '그녀는 표 네 장이 있어요.', 'four는 무엇을 나타내나요?', ['개수', '순서', '소유'], '개수', '표가 몇 장인지 알려주는 수사예요.'),
      choice('Monday is my ___ day here.', '월요일은 내가 이곳에 온 첫날이에요.', '빈칸에 알맞은 말은?', ['one', 'once', 'first'], 'first', '하루의 순서를 말하므로 first예요.'),
      order('이것은 내 두 번째 방문이에요.', ['my second visit.', 'is', 'This'], 'This is my second visit.', 'second는 visit의 순서를 나타내요.'),
    ], stem: 'I have two bags.', writing: '개수와 물건을 바꿔 보세요.', check: '개수와 순서 중 필요한 표현을 골랐나요?', reference: classes,
  },
  {
    id: 'preposition', pos: 'prep.', title: '전치사', group: '관계와 연결', role: '뒤의 명사·대명사 등과 함께 장소·시간·방향 같은 관계를 나타내요.', pattern: 'in the bag / at seven / to school / with me', mistake: 'to school의 to는 전치사, to study의 to는 부정사 표지예요. 뒤에 오는 말의 역할을 확인해요.',
    examples: [['The key is in the bag.', '열쇠는 가방 안에 있어요.', 'in'], ['We meet at seven.', '우리는 일곱 시에 만나요.', 'at']], notice: 'in과 at은 각각 어떤 관계를 알려주나요?', noticeAnswer: 'in the bag은 장소, at seven은 시간을 알려줘요.',
    questions: [
      choice('The cat is under the table.', '고양이는 탁자 아래에 있어요.', '위치 관계를 나타내는 전치사는?', ['cat', 'under', 'table'], 'under', 'under가 탁자 아래라는 관계를 나타내요.'),
      choice('I get up ___ seven.', '나는 일곱 시에 일어나요.', '시간 앞에 알맞은 말은?', ['on', 'in', 'at'], 'at', '특정 시각 seven 앞에는 at을 써요.'),
      order('열쇠는 가방 안에 있어요.', ['in the bag.', 'The key', 'is'], 'The key is in the bag.', 'in + 명사구 the bag으로 장소를 나타내요.'),
    ], review: [
      choice('I walk to school.', '나는 학교로 걸어가요.', '이 문장의 to는?', ['부정사 표지', '전치사', '접속사'], '전치사', '명사 school 앞에서 방향을 나타내는 전치사예요.'),
      choice('Come with ___.', '나와 함께 와요.', '빈칸에 알맞은 말은?', ['I', 'my', 'me'], 'me', '전치사 with 뒤에는 목적격 me를 써요.'),
      order('책은 탁자 위에 있어요.', ['on the table.', 'is', 'The book'], 'The book is on the table.', 'on the table은 책이 놓인 위치를 나타내요.'),
    ], stem: 'The key is in the bag.', writing: '물건이나 장소를 바꿔 보세요.', check: '전치사와 뒤의 말이 장소·시간·방향 등의 관계를 나타내나요?', reference: classes,
  },
  {
    id: 'conjunction', pos: 'conj.', title: '접속사', group: '관계와 연결', role: '단어나 문장을 연결하고 추가·대조·이유 같은 관계를 나타내요.', pattern: 'tea and coffee / tired but happy / because I am sick', mistake: 'because로 이유를 말할 때 뒤에 주어와 동사가 있는 절을 붙여요. because of + 명사와 구분해요.',
    examples: [['I like tea and coffee.', '나는 차와 커피를 좋아해요.', 'and'], ['I am tired but happy.', '나는 피곤하지만 행복해요.', 'but']], notice: '그냥 더하는 말과 대조하는 말은 무엇인가요?', noticeAnswer: 'and는 내용을 더하고, but은 예상과 다른 내용을 이어줘요.',
    questions: [
      choice('I am tired but happy.', '나는 피곤하지만 행복해요.', '대조하는 두 내용을 연결하는 말은?', ['tired', 'happy', 'but'], 'but', 'but이 피곤함과 행복함을 대조하며 이어요.'),
      choice('I stay home ___ I am sick.', '나는 아파서 집에 있어요.', '이유를 연결하는 말은?', ['because', 'but', 'or'], 'because', 'because 뒤에 집에 있는 이유인 I am sick을 붙여요.'),
      order('나는 차와 커피를 좋아해요.', ['and coffee.', 'I like', 'tea'], 'I like tea and coffee.', 'and는 같은 역할의 명사 tea와 coffee를 연결해요.'),
    ], review: [
      choice('Would you like tea or coffee?', '차와 커피 중 무엇을 드시겠어요?', 'or은 무엇을 나타내나요?', ['이유', '선택', '대조'], '선택', 'or은 두 선택지를 이어줘요.'),
      choice('It is cold, ___ I am wearing a coat.', '추워서 나는 코트를 입고 있어요.', '결과를 자연스럽게 이어주는 말은?', ['or', 'so', 'because'], 'so', '앞의 추운 상황에 따른 결과를 so로 이어요.'),
      order('나는 바쁘지만 행복해요.', ['but happy.', 'busy', 'I am'], 'I am busy but happy.', 'but으로 서로 대비되는 상태를 연결해요.'),
    ], stem: 'I am tired but happy.', writing: '두 상태 중 하나를 바꾸고 연결 관계를 확인하세요.', check: '연결한 두 내용의 관계에 맞는 접속사를 골랐나요?', reference: classes,
  },
  {
    id: 'auxiliary', pos: 'auxiliary v.', title: '기본 조동사', group: '동사를 돕는 표현', role: 'be·do·have가 다른 동사와 함께 진행·완료·의문·부정 등을 만들어요.', pattern: 'be + -ing: I am reading. / do + 동사원형: Do you work? / have + 과거분사: I have finished.', mistake: '같은 be·do·have도 본동사일 수 있어요. I am happy.의 am은 상태를 연결하고, I am reading.의 am은 진행형을 도와요. I do homework.의 do는 행동, Do you work?의 Do는 질문을 도와요. I have a bag.의 have는 소유, I have finished.의 have는 완료를 도와요.',
    examples: [['I have a bag.', '나는 가방이 있어요.', 'have'], ['I have finished my work.', '나는 일을 끝냈어요.', 'have']], notice: '다른 동사를 도와 완료를 만드는 have는 어느 쪽인가요?', noticeAnswer: '두 번째 have가 finished와 함께 완료를 만들어요. 첫 번째 have는 소유를 나타내는 본동사예요.',
    questions: [
      choice('She is reading a book.', '그녀는 책을 읽고 있어요.', '진행형을 돕는 조동사는?', ['reading', 'is', 'book'], 'is', 'be의 형태 is가 reading과 함께 지금 진행 중임을 나타내요.'),
      choice('___ you like tea?', '차를 좋아하나요?', '일반 동사의 질문을 돕는 말은?', ['Are', 'Have', 'Do'], 'Do', '일반 동사 like의 현재 질문을 Do로 만들어요.'),
      order('나는 지금 읽고 있어요.', ['reading now.', 'am', 'I'], 'I am reading now.', '조동사 am 뒤에 reading을 놓아 진행형을 만들어요.'),
    ], review: [
      choice('I do my homework.', '나는 숙제를 해요.', '이 문장의 do는?', ['본동사', '기본 조동사', '전치사'], '본동사', '다른 동사를 돕는 대신 숙제를 한다는 행동을 직접 나타내요.'),
      choice('She ___ not work here.', '그녀는 여기서 일하지 않아요.', '현재 부정문에 알맞은 말은?', ['is', 'does', 'has'], 'does', 'does not 뒤에는 본동사 원형 work를 써요.'),
      order('나는 점심을 먹었어요.', ['eaten lunch.', 'I', 'have'], 'I have eaten lunch.', '조동사 have와 과거분사 eaten이 완료를 나타내요.'),
    ], stem: 'I am reading now.', writing: 'reading을 지금 하고 있는 다른 행동의 -ing형으로 바꿔 보세요.', check: 'be·do·have가 다른 동사를 돕고 있나요? 뒤의 동사 형태를 확인했나요?', reference: classes,
  },
  {
    id: 'modal', pos: 'modal v.', title: '법조동사', group: '동사를 돕는 표현', role: 'can·must·should 등은 능력·필요·조언 같은 뜻을 동사에 더해요.', pattern: 'can + 동사원형 / should + 동사원형: She can swim. You should rest.', mistake: '목록의 have to·used to 등은 관련 표현이지만 형태가 달라요. She has to work. / Did you use to live here?처럼 따로 익혀요.',
    examples: [['I can swim.', '나는 수영할 수 있어요.', 'can'], ['You should rest.', '쉬는 것이 좋겠어요.', 'should']], notice: '능력과 조언을 나타내는 말은 각각 무엇인가요?', noticeAnswer: 'can은 능력을, should는 조언을 나타내요. 둘 다 뒤에 동사원형이 와요.',
    questions: [
      choice('You should rest.', '쉬는 것이 좋겠어요.', 'should는 어떤 뜻을 더하나요?', ['과거', '개수', '조언'], '조언', '쉬는 것이 좋다는 조언이에요. 반드시 해야 한다는 must와 강도가 달라요.'),
      choice('She can ___.', '그녀는 수영할 수 있어요.', '빈칸에 알맞은 형태는?', ['swimming', 'swims', 'swim'], 'swim', 'can 뒤에는 주어가 she여도 동사원형 swim을 써요.'),
      order('나는 오늘 일해야 해요.', ['work today.', 'I', 'must'], 'I must work today.', 'must 뒤의 work는 동사원형이에요.'),
    ], review: [
      choice('You may leave now.', '이제 가도 돼요.', '이 상황에서 may는 무엇을 나타내나요?', ['습관', '허락', '순서'], '허락', '상대에게 이제 떠나도 된다는 허락을 나타내요.'),
      choice('She ___ to work today.', '그녀는 오늘 일해야 해요.', 'have to의 현재 형태는?', ['has', 'have', 'having'], 'has', 'have to는 can과 형태가 달라 주어 she에 맞춰 has to로 바뀌어요.'),
      order('너는 쉬는 것이 좋겠어.', ['rest.', 'should', 'You'], 'You should rest.', 'should 뒤에는 동사원형 rest가 와요.'),
    ], stem: 'I can swim.', writing: 'swim을 내가 할 수 있는 다른 행동으로 바꿔 보세요.', check: '능력·필요·조언 중 뜻을 골랐나요? can·must·should 뒤에 동사원형을 썼나요?', reference: 'https://dictionary.cambridge.org/grammar/british-grammar/modality-meanings-and-uses',
  },
  {
    id: 'infinitive', pos: 'infinitive marker', title: '부정사 표지', group: '동사를 돕는 표현', role: 'to + 동사원형으로 원하는 행동이나 목적 등을 나타내요.', pattern: 'want to learn / need to go / walk to relax', mistake: 'to 뒤에 명사가 오면 전치사일 수 있어요. to school과 to study를 구분하고, 모든 동사 뒤에 to를 붙이지 않아요.',
    examples: [['I want to learn.', '나는 배우고 싶어요.', 'to'], ['I go to school.', '나는 학교에 가요.', 'to']], notice: '뒤에 행동을 나타내는 동사원형이 오는 to는 어느 쪽인가요?', noticeAnswer: 'to learn은 부정사예요. to school은 명사 앞에서 방향을 나타내는 전치사 표현이에요.',
    questions: [
      choice('I want to read.', '나는 읽고 싶어요.', 'to는 무엇 앞에 있나요?', ['명사', '동사원형', '형용사'], '동사원형', '동사원형 read 앞에서 부정사를 만드는 표지예요.'),
      choice('She wants to ___.', '그녀는 배우고 싶어요.', '빈칸에 알맞은 형태는?', ['learns', 'learning', 'learn'], 'learn', 'to 뒤에는 동사원형 learn을 써요.'),
      order('나는 영어를 배우고 싶어요.', ['to learn English.', 'want', 'I'], 'I want to learn English.', 'want 뒤에 원하는 행동을 to learn으로 나타내요.'),
    ], review: [
      choice('I walk to relax.', '나는 쉬려고 걸어요.', 'to relax는 무엇을 설명하나요?', ['걷는 목적', '가는 장소', '물건 이름'], '걷는 목적', '여기의 to + 동사원형은 왜 걷는지 목적을 나타내요.'),
      choice('I need ___ home.', '나는 집에 가야 해요.', '빈칸에 알맞은 표현은?', ['to going', 'to go', 'to goes'], 'to go', 'need 뒤에 to + 동사원형 go를 써요.'),
      order('우리는 읽고 싶어요.', ['to read.', 'We', 'want'], 'We want to read.', '원하는 행동을 to read라는 부정사로 연결해요.'),
    ], stem: 'I want to learn English.', writing: 'learn English를 하고 싶은 다른 행동으로 바꿔 보세요.', check: 'to 바로 뒤에 동사원형이 있나요? 명사 앞 전치사 to와 구분했나요?', reference: classes,
  },
  {
    id: 'exclamation', pos: 'exclam.', title: '감탄사', group: '반응과 인사', role: '놀람·실수·인사 같은 반응을 짧게 나타내요.', pattern: 'Wow! / Oops! / Hello!', mistake: '느낌표가 있는 모든 문장이 감탄사는 아니에요. 조용한 상황이나 격식 있는 글에서는 표현 강도도 생각해요.',
    examples: [['Wow! That is beautiful.', '와! 정말 아름답네요.', 'Wow'], ['Oops! I dropped my pen.', '이런! 펜을 떨어뜨렸어요.', 'Oops']], notice: '좋은 놀람과 작은 실수에 대한 반응을 구분해 보세요.', noticeAnswer: 'Wow는 놀람·감탄, Oops는 작은 실수를 알아차린 반응에 어울려요.',
    questions: [
      choice('Wow! This is great.', '와! 정말 멋지네요.', '감탄을 나타내는 말은?', ['This', 'great', 'Wow'], 'Wow', 'Wow가 다른 문장과 독립적으로 감탄을 나타내요.'),
      choice('___! I spilled my water.', '이런! 물을 쏟았어요.', '작은 실수에 자연스러운 반응은?', ['Hello', 'Oops', 'Goodbye'], 'Oops', 'Oops는 실수를 알아차렸을 때 쓰는 반응이에요.'),
      order('안녕! 만나서 반가워요.', ['Nice', 'Hello!', 'to meet you.'], 'Hello! Nice to meet you.', 'Hello로 인사한 뒤 반가움을 표현해요.'),
    ], review: [
      choice('Ouch! My foot hurts.', '아야! 발이 아파요.', 'Ouch는 어떤 반응인가요?', ['인사', '아픔', '감사'], '아픔', 'Ouch는 갑자기 아플 때 나오는 반응이에요.'),
      choice('___! It is nice to see you.', '안녕! 만나서 반가워요.', '인사에 알맞은 말은?', ['Oops', 'Ouch', 'Hello'], 'Hello', '사람을 만났을 때 인사하는 표현이에요.'),
      order('와! 정말 아름답네요.', ['is beautiful.', 'Wow!', 'That'], 'Wow! That is beautiful.', 'Wow를 독립적으로 쓰고 감탄하는 대상을 이어서 설명해요.'),
    ], stem: 'Wow! This is beautiful.', writing: '놀랐던 장면을 떠올리며 beautiful을 다른 말로 바꿔 보세요.', check: '느낀 감정이나 상황에 어울리는 반응을 골랐나요?', reference: classes,
  },
];
export const LESSON_MAP = new Map(GRAMMAR_LESSONS.map(l => [l.id, l]));
export const POS_LESSON = new Map(GRAMMAR_LESSONS.map(l => [l.pos, l]));
export function answerCorrect(question: GrammarQuestion, answer: string) {
  // Movable v2 tokens retain their printed case and punctuation. Assess the
  // authored word order, not where a fixed full stop happens to be attached.
  // Legacy answers keep their original grading contract.
  const normalize = (value: string) => {
    const text = value.trim().replace(/\s+/g, ' ');
    return question.kind === 'order' && /:(2|3):/.test(question.id??'')
      ? text.toLowerCase().replace(/[.,!?]/g, '') : text;
  };
  return [question.answer, ...(question.alternatives ?? [])].some(candidate => normalize(candidate) === normalize(answer));
}
export function assembledOrder(question:GrammarQuestion,selection:number[]) {
  const tokens=selection.filter(index=>index>=0&&index<question.options.length).map(index=>question.options[index]);
  if(!question.orderFormat)return tokens.join(' ');
  const {properWords,punctuation}=question.orderFormat;
  return tokens.map((token,index)=>{
    const authored=properWords.find(word=>word.toLowerCase()===token.toLowerCase());
    const text=authored??token;
    return index===0||/[.!?]$/.test(tokens[index-1])?text.charAt(0).toUpperCase()+text.slice(1):text;
  }).join(' ')+(tokens.length===question.options.length?punctuation:'');
}
export function exampleFocusStart(sentence: string, focus: string) {
  const escaped = focus.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return sentence.search(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u'));
}
export function needsGrammarReview(lesson: GrammarLesson, progress?: GrammarProgress, resolvedQuestions?: GrammarQuestion[]) {
  if (!progress) return false;
  if (progress.review && !progress.review.completedAt) return true;
  const answers = progress.review?.completedAt ? progress.review.answers : progress.answers;
  const questions = resolvedQuestions ?? (progress.review?.completedAt ? lesson.review : lesson.questions);
  const hints = (progress.review?.completedAt ? progress.review.hints : progress.hints) ?? [];
  return questions.some((q, i) => {
    const key = `q${i + 1}` as keyof typeof answers, a = answers[key];
    return hints.includes(key) || !!a && (!answerCorrect(q, a.first) || !answerCorrect(q, a.latest) || a.helped);
  }) || progress.check === 'needs_work' || progress.check === 'uncertain';
}
export function firstAnswerLabel(question: GrammarQuestion, answer?: GrammarAnswer) {
  if (!answer) return '미응답';
  return `${answerCorrect(question, answer.first) ? '첫 답 정답' : '처음엔 오답'}${answer.helped ? ' · 도움 사용' : ''}`;
}
