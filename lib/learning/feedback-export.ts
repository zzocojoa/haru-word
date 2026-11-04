import type {SentenceFeedback} from '../sentence-feedback.ts';
import {feedbackSafetyIssue} from './feedback-safety.ts';

// A presentation projection only. Raw records and JSON backups remain intact.
export function feedbackExportView(sentence:string,feedback?:SentenceFeedback) {
  if(!feedback)return {status:'의견 없음',correction:'',explanation:''};
  if(feedbackSafetyIssue(feedback))return {status:'보류·설명 모순',correction:'',explanation:''};
  if(feedback.meaningUsage==='uncertain'||feedback.grammar==='uncertain')return {status:'보류·판단 불충분',correction:'',explanation:''};
  if(feedback.original!==sentence.trim())return {status:'수정 전 입력의 의견',correction:'',explanation:''};
  return {status:'AI 참고 의견·정답 미확정',correction:feedback.correctedSentence,explanation:feedback.explanation};
}
