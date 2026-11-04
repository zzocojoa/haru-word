import type {GrammarLesson} from './content';
import type {FeedbackContextKind} from '../feedback-context';
import {GRAMMAR_TARGET_CRITERIA} from './target-criteria';
export function legacyGrammarFeedbackInput(lesson:GrammarLesson,sentence:string){
  return {sentence,target:lesson.title,role:lesson.role,pattern:lesson.pattern,task:lesson.writing,check:lesson.check};
}
export function grammarFeedbackInput(lesson:GrammarLesson,sentence:string,contextNote='',contextKind:FeedbackContextKind='sentence'){
  return {...legacyGrammarFeedbackInput(lesson,sentence.trim()),stem:lesson.stem,targetCriterion:GRAMMAR_TARGET_CRITERIA[lesson.id],...(contextNote.trim()?{contextNote:contextNote.trim()}: {}),...(contextKind!=='sentence'?{contextKind}:{})};
}
