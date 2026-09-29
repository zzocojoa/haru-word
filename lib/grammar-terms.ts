/** Display-only terminology. Oxford POS codes and saved answers remain unchanged. */
export const POS_ENGLISH: Record<string, string> = {
  'n.': 'noun', 'v.': 'verb', 'adj.': 'adjective', 'adv.': 'adverb',
  'prep.': 'preposition', 'pron.': 'pronoun', 'det.': 'determiner',
  'conj.': 'conjunction', 'exclam.': 'exclamation', 'modal v.': 'modal verb',
  'auxiliary v.': 'auxiliary verb', number: 'number',
  'indefinite article': 'indefinite article', 'definite article': 'definite article',
  'infinitive marker': 'infinitive marker',
};

export const SENTENCE_ROLES = [
  { code: 'S', en: 'Subject', ko: '주어', meaning: '누구·무엇에 관한 문장인지 나타내요.' },
  { code: 'V', en: 'Verb', ko: '동사', meaning: '주어의 행동이나 상태를 나타내요.' },
  { code: 'O', en: 'Object', ko: '목적어', meaning: '동사가 가리키는 대상을 나타내요.' },
  { code: 'C', en: 'Complement', ko: '보어', meaning: '주어나 목적어가 무엇인지, 어떤 상태인지 설명해요.' },
] as const;
