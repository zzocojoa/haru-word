import type { ReactNode } from 'react';
import { GRAMMAR_TEXT, MEANING_USAGE_TEXT, type SentenceFeedback } from '@/lib/sentence-feedback';
import { FeedbackAttribution } from './feedback-attribution';
import { SentenceStructureView } from './sentence-structure';
import { feedbackSafetyIssue } from '@/lib/feedback-safety';
import { FeedbackSafetyNotice } from './feedback-safety-notice';

// Read-only output: history must not depend on request hooks or write commands.
export function FeedbackDetail({ feedback, suggestionAction }: {
  feedback: SentenceFeedback;
  suggestionAction?: ReactNode;
}) {
  const safetyIssue = feedbackSafetyIssue(feedback);
  if (safetyIssue) return <FeedbackSafetyNotice reason={safetyIssue} />;
  return <div className="ai-feedback-result">
    <div className="feedback-assessments"><span>{MEANING_USAGE_TEXT[feedback.meaningUsage]}</span><span>{GRAMMAR_TEXT[feedback.grammar]}</span></div>
    <p className="small-note">검토한 원문</p><p lang="en">{feedback.original}</p>
    {feedback.correctedSentence && <><p className="small-note">AI 교정 제안</p><p className="corrected-sentence" lang="en">{feedback.correctedSentence}</p></>}
    {suggestionAction}
    <p>{feedback.explanation}</p>
    <FeedbackAttribution feedback={feedback} />
    {(feedback.correctedSentence || feedback.structure) && <SentenceStructureView structure={feedback.structure} />}
  </div>;
}
