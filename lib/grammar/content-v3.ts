import {PRACTICE_LESSONS, lessonForVersion as v2Lesson, type LessonPractice, type ReadingLine} from './content-v2';
import type {GrammarLesson, GrammarQuestion} from './content';
import type {LessonId} from './model';

export const NOW_REFERENCE = 'https://dictionary.cambridge.org/us/grammar/british-grammar/now';
export const LEGACY_NOW_NOTE = 'I am now reading.도 문법적으로 가능한 어순이에요. 이전판의 채점 기록은 당시 문항 기준을 유지해요. 새 수업에서는 세 어순을 모두 인정해요.';
// Authored casing rules: preserve I/contractions and the language name English.
// Other tokens are lower case until they begin a sentence; internal punctuation
// (Hello!) remains on its token, while the final punctuation is attached last.
const properWords = ['I', "I'm", "I've", "I'd", "I'll", 'English'];
function familyText(en:string,ko:string) {
  let result=en;
  if (/(여동생|언니)/.test(ko)) result=result.replace(/(?<!younger |older )\bsister\b/g,ko.includes('언니')?'older sister':'younger sister');
  if (/(남동생|오빠)/.test(ko)) result=result.replace(/(?<!younger |older )\bbrother\b/g,ko.includes('오빠')?'older brother':'younger brother');
  return result;
}
function reading(line:ReadingLine):ReadingLine {
  return {...line,en:familyText(line.en,line.ko),glosses:line.glosses.map(g=>
    ['brother','sister'].includes(g.lemma)?{...g,meaning:g.lemma==='brother'?'남자 형제':'여자 형제',role:g.role+' 나이는 younger/older 또는 문맥에서 확인해요.'}:{...g})};
}
function question(source:GrammarQuestion):GrammarQuestion {
  const id=source.id!.replace(':2:',':3:');
  const result={...source,id,context:familyText(source.context,source.translation),options:[...source.options],wrong:source.wrong?{...source.wrong}:undefined};
  if(source.kind!=='order')return result;
  const answer=familyText(source.answer,source.translation);
  const punctuation=answer.match(/[.!?]+$/)?.[0]??'';
  const tokens=answer.slice(0,punctuation? -punctuation.length:undefined).split(' ').map(token=>properWords.find(word=>word.toLowerCase()===token.toLowerCase())??token.toLowerCase());
  const alternatives=(source.alternatives??[]).map(text=>familyText(text,source.translation));
  if(id==='auxiliary:3:base:q3')alternatives.push('I am now reading.');
  return {...result,answer,alternatives,options:[...tokens.slice(2),...tokens.slice(0,2)],orderFormat:{punctuation,properWords},
    explanation:source.explanation+(id==='auxiliary:3:base:q3'?' now는 문장 끝·앞 또는 첫 조동사 뒤에 놓을 수 있어요.':'')};
}
export const PRACTICE_LESSONS_V3=Object.fromEntries(Object.entries(PRACTICE_LESSONS).map(([id,practice])=>[id,{
  ...practice,reading:practice.reading.map(reading),observation:question(practice.observation),
  frame:{...practice.frame,parts:[...practice.frame.parts],slots:practice.frame.slots.map(slot=>({...slot,options:[...slot.options]}))},
  questions:practice.questions.map(question),reviews:{a:practice.reviews.a.map(question),b:practice.reviews.b.map(question)},
}])) as Record<LessonId,LessonPractice>;

export function practiceForVersion(id:LessonId,version?:number) {
  return version===3?PRACTICE_LESSONS_V3[id]:PRACTICE_LESSONS[id];
}
export function lessonForVersion(lesson:GrammarLesson,version?:number):GrammarLesson {
  const base=v2Lesson(lesson,version===3?2:version);
  return version===3?{...base,examples:base.examples.map(([en,ko,focus])=>[familyText(en,ko),ko,focus])}:base;
}
export function legacyNowNote(id:LessonId,version?:number,reviewing=false,index=0) {
  return id==='auxiliary'&&(version??1)<3&&!reviewing&&index===2?LEGACY_NOW_NOTE:undefined;
}
