// Reviewed spelling families, not a general semantic-equivalence or POS test.
// British Council irregular-verbs reference; lend/lay checked against Cambridge.
export const REVIEWED_IRREGULAR_FORMS = [
  'be am is are was were been being','begin began begun','break broke broken','bring brought','buy bought','build built',
  'choose chose chosen','come came','cost','cut','do does did done doing','draw drew drawn','drive drove driven','eat ate eaten',
  'feel felt','find found','get got gotten','give gave given','go went gone','have has had having','hear heard','hold held',
  'keep kept','know knew known','leave left','lead led','let','lie lay lain','lose lost','make made','mean meant','meet met',
  'pay paid','put','run ran','say said','see saw seen','sell sold','send sent','set','sit sat','speak spoke spoken',
  'spend spent','stand stood','take took taken','teach taught','tell told','think thought','understand understood',
  'wear wore worn','win won','write wrote written',
  'sing sang sung','drink drank drunk','fly flew flown','become became','catch caught','swim swam swum','sleep slept',
  'read','lend lent','lay laid',
] as const;

// Exact noun singular/plural pairs. Keep these separate from verb roots so a
// noun alias cannot transitively admit an unrelated verb spelling.
export const REVIEWED_IRREGULAR_NOUN_FORMS = [
  'child children', 'person people', 'man men', 'woman women',
  'foot feet', 'tooth teeth', 'mouse mice', 'goose geese', 'ox oxen',
] as const;
const nounForms = new Map<string, string>(REVIEWED_IRREGULAR_NOUN_FORMS.flatMap(pair => {
  const [singular, plural] = pair.split(' ');
  return [[singular, plural] as const, [plural, singular] as const];
}));

const roots = new Map<string, Set<string>>();
for (const group of REVIEWED_IRREGULAR_FORMS) {
  const words = group.split(' ');
  for (const word of words) {
    const values = roots.get(word) ?? new Set<string>();
    values.add(words[0]); roots.set(word, values);
  }
}
function forms(word: string) {
  return new Set([word,word+'s',word+'es',word+'ed',word+'d',word+'ing',word.replace(/y$/,'ies'),word.replace(/y$/,'ied'),word.replace(/e$/,'')+'ing',word+word.at(-1)+'ed',word+word.at(-1)+'ing']);
}
const bases = (word: string) => new Set([word,...(roots.get(word) ?? [])]);
export function sameInflectedWord(a: string, b: string): boolean {
  if (nounForms.get(a) === b) return true;
  // Retain literal spellings (found/founded); do not transitively merge lay's
  // different roots, which would incorrectly make laid and lain interchangeable.
  for (const x of bases(a)) for (const y of bases(b)) {
    if (x === y || forms(x).has(y) || forms(y).has(x)) return true;
  }
  return false;
}

export function presentThirdPerson(base: string) {
  if (base === 'have') return 'has';
  if (/[^aeiou]y$/.test(base)) return base.slice(0, -1) + 'ies';
  return base + (/(?:s|sh|ch|x|z|o)$/.test(base) ? 'es' : 's');
}

function progressiveForm(base: string) {
  if (base.endsWith('ie')) return base.slice(0, -2) + 'ying';
  if (base.endsWith('ic')) return base + 'king';
  if (base.endsWith('e') && !/(?:ee|ye|oe)$/.test(base)) return base.slice(0, -1) + 'ing';
  if (/^[^aeiou]+[aeiou][bcdfgjklmnpqrstz]$/.test(base)) return base + base.at(-1) + 'ing';
  return base + 'ing';
}

export function sameReviewedProgressive(before: string, after: string, verbs: ReadonlySet<string>) {
  if (!after.endsWith('ing')) return false;
  const stem = after.slice(0, -3);
  const roots = [stem, stem + 'e', stem.replace(/(.)\1$/, '$1'), stem.replace(/y$/, 'ie'), stem.replace(/ick$/, 'ic')];
  return roots.some(base => verbs.has(base) && presentThirdPerson(base) === before && progressiveForm(base) === after);
}

// Exact auxiliary forms only. The regular-spelling heuristic would also match
// unrelated content words such as bed (be+d), which must never be filtered out.
const auxiliaryForms = new Set('be am is are was were been being do does did done doing have has had having'.split(' '));
export const auxiliaryWordForm = (word: string) => auxiliaryForms.has(word);
