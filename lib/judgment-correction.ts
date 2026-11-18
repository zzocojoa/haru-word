import { sameInflectedWord, auxiliaryWordForm, sameReviewedProgressive, presentThirdPerson } from './feedback-word-forms.ts';
import {PRODUCTIVE_MANNER_ADJECTIVES} from './feedback-manner-adjectives.ts';
import type { JudgmentRejectionReason } from './provider-feedback-contract.ts';
import curriculum from '../data/words.json' with { type: 'json' };

const simpleNumbers = new Map(['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'].map((word, n) => [word, String(n)]));
function quantities(sentence: string) {
  return (sentence.toLowerCase().match(/[-−]?\b(?:\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/g) ?? [])
    .map(value => simpleNumbers.get(value) ?? value.replace('−','-').replace(/^(-?)0+(?=\d)/, '$1')).join('|');
}
function negations(sentence: string) {
  return (sentence.toLowerCase().replaceAll('’', "'").match(/\b(?:not|no|never|none|nothing|nobody|neither|nor|cannot)\b|\b[a-z]+n't\b/g) ?? []).length;
}
function negationAnchors(sentence:string) {
  const words=sentence.toLowerCase().replaceAll('’',"'").replace(/\bcan't\b/g,'can not').replace(/\bcannot\b/g,'can not').replace(/\bwon't\b/g,'will not').replace(/\bshan't\b/g,'shall not').replace(/n't\b/g,' not').match(/[a-z]+|[.!?;,]/g)??[];
  return words.flatMap((word,index)=>{
    if(!['not','no','never','none','nothing','nobody','neither','nor'].includes(word))return [];
    const previous=words.slice(0,index),next=words.slice(index+1);
    const clause=(list:string[])=>{const i=list.findIndex(x=>['and','but','or','because','although','if','when','while','.',',',';','!','?'].includes(x));return i<0?list:list.slice(0,i);};
    const anchors=(list:string[])=>clause(list).filter(x=>!functionWords.has(x)&&!auxiliaryWordForm(x)&&!simpleNumbers.has(x));
    // Auxiliary agreement may change; the neighbouring content/its clause may not.
    return [{word,before:anchors(previous.reverse()),after:anchors(next)}];
  });
}
const timeAndFocus = (sentence: string) => (sentence.toLowerCase().match(/\b(?:yesterday|today|tomorrow|tonight|now|still|already|ago|later|almost|only|also|even)\b/g) ?? []).sort().join('|');
const people: Record<string, string> = { i:'first', me:'first', you:'second', he:'male', him:'male', she:'female', her:'female', we:'plural_first', us:'plural_first', they:'plural_third', them:'plural_third' };
const person = (value: string) => people[value.toLowerCase()] ?? value.toLowerCase();
const functionWords=new Set('a an the am is are was were be been being do does did have has had to of in on at for from with by about and or but that this these those there it its i me my mine you your yours he him his she her hers we us our ours they them their theirs not no never can could may might must shall should will would what why where when who whom whose which how'.split(' '));
// Reviewed manner pairs; this deliberately does not turn every -ly word into an adverb.
const mannerPairs=new Map('quiet quietly;slow slowly;quick quickly;careful carefully;skillful skillfully;skilful skilfully;safe safely;graceful gracefully;calm calmly;happy happily;easy easily;loud loudly;clear clearly;polite politely'.split(';').flatMap(pair=>{const [a,b]=pair.split(' ');return [[a,b],[b,a]];}));
const productiveMannerAdjectives=new Set<string>(PRODUCTIVE_MANNER_ADJECTIVES);
// Merriam-Webster lists these adjective/adverb pairs outside the curriculum index.
const additionalMannerAdjectives = new Set(['harmless', 'reckless', 'relentless', 'thoughtless']);
const linkingVerbBeforeAdjective = /\b(?:am|is|are|was|were|be|been|being|looks?|looked|feels?|felt|seems?|seemed|sounds?|sounded|smells?|smelled|tastes?|tasted) $/i;
function sameProductiveMannerForm(a:string,b:string){return productiveMannerAdjectives.has(a)&&b===a+'ly'||productiveMannerAdjectives.has(b)&&a===b+'ly';}
function sameContent(a:string,b:string){return mannerPairs.get(a)===b||sameProductiveMannerForm(a,b)||sameInflectedWord(a,b);}
const modals=(s:string)=>(s.toLowerCase().replaceAll('’',"'").replace(/\bcan't\b/g,'can not').replace(/\bcannot\b/g,'can not').replace(/\bwon't\b/g,'will not').replace(/\bshan't\b/g,'shall not').replace(/n't\b/g,' not').replace(/'ll\b/g,' will').match(/\b(?:can|could|may|might|must|shall|should|will|would)\b/g)??[]).join('|');
const beTime=(s:string)=>/\b(?:was|were)\b/i.test(s)?'past':/\b(?:am|is|are)\b/i.test(s)?'present':undefined;
const contentWords=(s:string)=>(s.toLowerCase().replaceAll('’',"'").replace(/\bcan't\b/g,'cannot').replace(/\bwon't\b/g,'will not').replace(/\bshan't\b/g,'shall not').replace(/n't\b/g,' not').replace(/'(?:m|re|s|ve|ll|d)\b/g,'').match(/[a-z]+/g)??[]).filter(w=>!functionWords.has(w)&&!auxiliaryWordForm(w)&&w!=='cannot'&&!simpleNumbers.has(w));
function quotedWording(sentence: string) {
  // Single-quote delimiters sit outside words. Apostrophes inside contractions do not close them.
  const quotes = /"([^"]*)"|“([^”]*)”|‘([\s\S]*?)’(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])'(?!\s)([\s\S]*?)'(?![\p{L}\p{N}])/gu;
  return Array.from(sentence.matchAll(quotes),
    ([, straightDouble, curlyDouble, curlySingle, straightSingle]) =>
      straightDouble ?? curlyDouble ?? curlySingle ?? straightSingle);
}
function transferRoles(sentence: string) {
  const match = sentence.match(/^(I|you|he|she|we|they|[A-Z][a-z]+)\s+(?:give|gives|gave|lend|lends|lent|tell|tells|told)\s+(me|you|him|her|us|them|[A-Z][a-z]+)\b/i);
  return match ? [person(match[1]), person(match[2])].join('|') : undefined;
}
function pairedContrastRepair(original:string,correction:string) {
  const match=original.trim().match(/^(although|though)\s+(.+),\s*but\s+(.+)$/i);
  if(!match)return false;
  const normalize=(s:string)=>s.trim().toLowerCase().replace(/\s+/g,' ');
  // Only literal removal of one redundant contrast link, with every other
  // word/order preserved. Do not generalize conjunctions into stop words.
  return [match[1]+' '+match[2]+', '+match[3],match[2]+', but '+match[3]].some(s=>normalize(s)===normalize(correction));
}

const countSpelling = `${[...simpleNumbers.keys()].join('|')}|0|[1-9]\\d*`;
const massNouns = 'luggage|baggage|furniture|equipment';
const countUnitRepair = new RegExp(
  `(?<![\\w.−-])(${countSpelling}) (${massNouns})\\b` +
  '(?=$|[,.!?;:]| (?:yesterday|today|tomorrow|tonight|here|there)\\b| (?:to|from|at|in|on|into|onto|near|by) (?:a|an|the)\\b| [a-z]+ed(?:[.!?]| (?:a|an|the)\\b))',
  'gi',
);
const countedSubject = new RegExp(
  `^(?<number>${countSpelling}) (?:(?<unit>items?|pieces?) of )?(?<noun>${massNouns}) (?<verb>[a-z]+) (?:(?<article>a|an|the) )?(?<object>[a-z]+)[.!?]?$`,
);
const curriculumVerbs = new Set(curriculum.filter(word => word.pos === 'v.').map(word => word.word));
const singleItem = (number: string) => ['1', 'one'].includes(number.toLowerCase());
const countUnits = (number: string) => singleItem(number) ? ['item', 'piece'] : ['items', 'pieces'];
const normalizeEditSpacing = (text: string) => text.trim().replace(/\s+/g, ' ');
const casing = (word: string, text: string) => word === word.toUpperCase() ? text.toUpperCase() : text;
const containsQuote = (text: string) => /['‘’](?!\p{L})|(?<!\p{L})['‘’]|["“”]/u.test(text);
const countedSubjectParts = (sentence: string) => countedSubject.exec(normalizeEditSpacing(sentence).toLowerCase())?.groups;

function presentVerbBase(form: string) {
  const bases = [form, form.slice(0, -1), form.slice(0, -2), form.replace(/ies$/, 'y')];
  if (form === 'has') bases.push('have');
  return bases.find(base => base !== 'be' && curriculumVerbs.has(base) && (form === base || form === presentThirdPerson(base)));
}

function regularPastVerbBase(form: string) {
  if (!form.endsWith('ed')) return;
  const stem = form.slice(0, -2);
  return [stem, form.slice(0, -1), stem.replace(/(.)\1$/, '$1'), form.replace(/ied$/, 'y')]
    .find(base => !auxiliaryWordForm(base) && curriculumVerbs.has(base) && sameInflectedWord(base, form));
}

function countedSubjectCorrection(original: string, correction: string): 'accepted' | JudgmentRejectionReason | undefined {
  const before = countedSubjectParts(original);
  if (!before || before.unit) return;
  const presentBase = presentVerbBase(before.verb);
  const pastBase = presentBase ? undefined : regularPastVerbBase(before.verb);
  if (!presentBase && !pastBase) return;
  // Without a determiner, "luggage carts roll" can contain a compound noun.
  if (presentBase !== before.verb && !before.article && presentVerbBase(before.object)) return;
  const after = countedSubjectParts(correction);
  if (!after || before.number !== after.number || before.noun !== after.noun) return;
  const expectedVerb = presentBase ? (singleItem(before.number) ? presentThirdPerson(presentBase) : presentBase) : before.verb;
  if (after.verb !== expectedVerb) {
    const changedTime = presentBase ? regularPastVerbBase(after.verb) === presentBase : presentVerbBase(after.verb) === pastBase;
    return changedTime ? 'time_or_focus' : 'content_change';
  }
  if (!countUnits(before.number).includes(after.unit)) return 'unresolved_count_unit';
  if (before.object !== after.object || (before.article && before.article !== after.article)) return 'content_change';
  return 'accepted';
}

function literalCountUnitNoun(before: string, after: string) {
  for (const match of before.matchAll(countUnitRepair)) {
    const [span, number, noun] = match;
    const start = match.index;
    const prefix = before.slice(0, start), suffix = before.slice(start + span.length);
    if (countUnits(number).some(unit => `${prefix}${number} ${casing(noun, unit + ' of')} ${noun}${suffix}` === after)) {
      return noun.toLowerCase();
    }
  }
}

export function verifiedCountUnitNoun(original: string, correction: string) {
  const before = normalizeEditSpacing(original), after = normalizeEditSpacing(correction);
  if (containsQuote(before) || before.match(/[.!?]$/)?.[0] !== after.match(/[.!?]$/)?.[0]) return;
  if (countedSubjectCorrection(before, after) === 'accepted') return countedSubjectParts(before)?.noun;
  return literalCountUnitNoun(before, after);
}

function isGrammarOnlyEdit(original: string, correction: string) {
  const before = normalizeEditSpacing(original), after = normalizeEditSpacing(correction);
  // Treat quoted wording as content; contractions still participate normally.
  if (containsQuote(before)) return false;
  const matches = (pattern: RegExp, replacement: (match: RegExpExecArray) => string[]) =>
    [...before.matchAll(pattern)].some(match => replacement(match).some(text =>
      before.slice(0, match.index) + text + before.slice(match.index + match[0].length) === after));

  // Only the matched grammar span can change. Preserve the rest of the sentence literally.
  if (matches(/\b(am|is|are|was|were) ([a-z]+)\b/gi, match => {
    const [, auxiliary, word] = match;
    const wordStart = match.index + auxiliary.length + 1;
    const proposed = after.slice(wordStart).match(/^[a-z]+/i)?.[0];
    return proposed && sameReviewedProgressive(word.toLowerCase(), proposed.toLowerCase(), curriculumVerbs)
      ? [auxiliary + ' ' + proposed] : [];
  })) return true;
  if (matches(/\b[a-z]+\b/gi, match => {
    const word = match[0];
    return additionalMannerAdjectives.has(word.toLowerCase()) && !linkingVerbBeforeAdjective.test(before.slice(0, match.index))
      ? [casing(word, word + 'ly')] : [];
  })) return true;
  if (literalCountUnitNoun(before, after)) return true;
  if (matches(/^((?:the|this|that|my|your|our|their) (?:fabric|cloth|velvet|carpet|blanket) (?:feels|felt)) (softly)(?=(?: to the touch)?[.!?]?$)/gi,
    ([, subject, word]) => [`${subject} ${casing(word, 'soft')}`])) return true;
  if (matches(/\b(very) (enjoys?|enjoyed)\b/gi, ([, degree, verb]) => [`${degree} ${casing(degree, 'much')} ${verb}`])) return true;
  return matches(/\b(the) most (quietest|shortest|longest|fastest|slowest|tallest|smallest|largest|biggest|safest|brightest|cheapest|easiest|hardest|strongest|weakest|best|worst)\b/gi,
    ([, article, adjective]) => [`${article} ${adjective}`]);
}

// Bounded direct personal-pronoun questions, not a full English role parser.
// The existing pronoun identity check alone conflates he/him and cannot notice
// that the unknown person changed from actor to recipient.
function simpleWhoRoles(sentence:string) {
  const text=sentence.trim().toLowerCase();
  const auxiliary='(?:do|does|did|have|has|had|can|could|may|might|must|shall|should|will|would|am|is|are|was|were)';
  const objectQuestion=text.match(new RegExp('^(?:who|whom)\\s+(?:'+auxiliary+'\\s+)?(i|you|he|she|we|they)\\s+[a-z]+[.!?]$'));
  if(objectQuestion)return 'object|'+person(objectQuestion[1]);
  const subjectQuestion=text.match(new RegExp('^(?:who|whom)\\s+(?:'+auxiliary+'\\s+)?[a-z]+\\s+(me|you|him|her|us|them)[.!?]$'));
  if(subjectQuestion)return 'subject|'+person(subjectQuestion[1]);
}

// Deliberately bounded contradictions, not a general semantic-equivalence checker.
export function correctionConflict(original: string, correction: string): JudgmentRejectionReason|undefined {
  if (!correction || correction === original.trim()) return;
  if (negations(original) !== negations(correction)) return 'negation';
  if (quantities(original) !== quantities(correction)) return 'quantity';
  if (timeAndFocus(original) !== timeAndFocus(correction)) return 'time_or_focus';
  if(modals(original)!==modals(correction))return 'time_or_focus';
  const aTime=beTime(original),bTime=beTime(correction);
  if(aTime&&bTime&&aTime!==bTime)return 'time_or_focus';
  if(aTime==='present'&&!bTime&&/\b(?:went|ate|wrote|sang|took|gave|saw|told|thought|knew|left|met|ran|sat|drank|flew|got|made|came|brought|spoke|swam|slept)\b/i.test(correction))return 'time_or_focus';
  const before = transferRoles(original), after = transferRoles(correction);
  if (before && after && before !== after) return 'participants';
  const pronouns=(s:string)=>(s.toLowerCase().match(/\b(?:i|me|you|he|him|she|her|we|us|they|them)\b/g)??[]).map(person).join('|');
  if(pronouns(original)!==pronouns(correction))return 'participants';
  const beforeWho=simpleWhoRoles(original),afterWho=simpleWhoRoles(correction);
  if(beforeWho&&afterWho&&beforeWho!==afterWho)return 'participants';
  if(original.trim().endsWith('?')!==correction.trim().endsWith('?'))return 'speech_act';
  const wh=(s:string)=>s.toLowerCase().match(/^(what|why|where|when|who|whom|whose|which|how)\b/)?.[1];
  if(wh(original)&&wh(original)!==wh(correction)){
    const sameWhoCase=['who','whom'].includes(wh(original)??'')&&['who','whom'].includes(wh(correction)??'')
      && (original.trim().replace(/^(?:who|whom)\b/i,'').toLowerCase()===correction.trim().replace(/^(?:who|whom)\b/i,'').toLowerCase()||!!beforeWho&&beforeWho===afterWho);
    if(!sameWhoCase)return 'speech_act';
  }
  const originalQuotes = quotedWording(original);
  if (originalQuotes.length) {
    const correctedQuotes = quotedWording(correction);
    if (originalQuotes.length !== correctedQuotes.length ||
      originalQuotes.some((quote, index) => quote !== correctedQuotes[index])) return 'content_change';
  }
  if(pairedContrastRepair(original,correction))return;
  const countRepair = countedSubjectCorrection(original, correction);
  if (countRepair) return countRepair === 'accepted' ? undefined : countRepair;
  // Conservative content preservation: grammatical function words/inflections may
  // change, a new story or different content word is not a minimal correction.
  const contentBefore=contentWords(original),contentAfter=contentWords(correction);
  if(contentBefore.length!==contentAfter.length||contentBefore.some((w,i)=>!sameContent(w,contentAfter[i]))){
    if (isGrammarOnlyEdit(original, correction)) return;
    return 'content_change';
  }
  const originalNegations=negationAnchors(original),correctedNegations=negationAnchors(correction);
  if(originalNegations.length!==correctedNegations.length||originalNegations.some((a,i)=>{
    const b=correctedNegations[i];return a.word!==b.word||a.before.length!==b.before.length||a.after.length!==b.after.length||a.before.some((w,j)=>!sameContent(w,b.before[j]))||a.after.some((w,j)=>!sameContent(w,b.after[j]));
  }))return 'negation';
}
