import { sameInflectedWord, auxiliaryWordForm } from './feedback-word-forms.ts';
import type { JudgmentRejectionReason } from './provider-feedback-contract.ts';

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
function sameContent(a:string,b:string){return mannerPairs.get(a)===b||sameInflectedWord(a,b);}
const modals=(s:string)=>(s.toLowerCase().replaceAll('’',"'").replace(/\bcan't\b/g,'can not').replace(/\bcannot\b/g,'can not').replace(/\bwon't\b/g,'will not').replace(/\bshan't\b/g,'shall not').replace(/n't\b/g,' not').replace(/'ll\b/g,' will').match(/\b(?:can|could|may|might|must|shall|should|will|would)\b/g)??[]).join('|');
const beTime=(s:string)=>/\b(?:was|were)\b/i.test(s)?'past':/\b(?:am|is|are)\b/i.test(s)?'present':undefined;
const contentWords=(s:string)=>(s.toLowerCase().replaceAll('’',"'").replace(/\bcan't\b/g,'cannot').replace(/\bwon't\b/g,'will not').replace(/\bshan't\b/g,'shall not').replace(/n't\b/g,' not').replace(/'(?:m|re|s|ve|ll|d)\b/g,'').match(/[a-z]+/g)??[]).filter(w=>!functionWords.has(w)&&!auxiliaryWordForm(w)&&w!=='cannot'&&!simpleNumbers.has(w));
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
  if(original.trim().endsWith('?')!==correction.trim().endsWith('?'))return 'speech_act';
  const wh=(s:string)=>s.toLowerCase().match(/^(what|why|where|when|who|whom|whose|which|how)\b/)?.[1];
  if(wh(original)&&wh(original)!==wh(correction))return 'speech_act';
  if(pairedContrastRepair(original,correction))return;
  // Conservative content preservation: grammatical function words/inflections may
  // change, a new story or different content word is not a minimal correction.
  const contentBefore=contentWords(original),contentAfter=contentWords(correction);
  if(contentBefore.length!==contentAfter.length||contentBefore.some((w,i)=>!sameContent(w,contentAfter[i])))return 'content_change';
  const originalNegations=negationAnchors(original),correctedNegations=negationAnchors(correction);
  if(originalNegations.length!==correctedNegations.length||originalNegations.some((a,i)=>{
    const b=correctedNegations[i];return a.word!==b.word||a.before.length!==b.before.length||a.after.length!==b.after.length||a.before.some((w,j)=>!sameContent(w,b.before[j]))||a.after.some((w,j)=>!sameContent(w,b.after[j]));
  }))return 'negation';
}
