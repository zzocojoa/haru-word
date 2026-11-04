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
  // Retain literal spellings (found/founded); do not transitively merge lay's
  // different roots, which would incorrectly make laid and lain interchangeable.
  for (const x of bases(a)) for (const y of bases(b)) {
    if (x === y || forms(x).has(y) || forms(y).has(x)) return true;
  }
  return false;
}
// Exact auxiliary forms only. The regular-spelling heuristic would also match
// unrelated content words such as bed (be+d), which must never be filtered out.
const auxiliaryForms = new Set('be am is are was were been being do does did done doing have has had having'.split(' '));
export const auxiliaryWordForm = (word: string) => auxiliaryForms.has(word);
