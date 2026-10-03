import type { SentenceFeedback } from './sentence-feedback.ts';
import { feedbackSafetyIssue } from './feedback-safety.ts';

const ACTION_LABELS = {
  ready: 'AI 참고 의견 요청',
  checking: '문장을 확인하고 있어요',
  reviewed: '저장한 AI 참고 의견이 있어요',
  retryAnalysis: 'AI 참고 의견 다시 요청',
} as const;

type Input = { sentence: string; feedback?: SentenceFeedback; busy: boolean; pending: boolean };

/** Daily-study presentation only. Grammar lessons intentionally allow rechecking. */
export function sentenceFeedbackPresentation({ sentence, feedback, busy, pending }: Input) {
  const trimmed = sentence.trim();
  const unchanged = feedback?.original === trimmed;
  const unsafeAnalysis = !!feedback && !!feedbackSafetyIssue(feedback);
  let action: keyof typeof ACTION_LABELS = 'ready';
  if (pending) action = 'checking';
  else if (unchanged) {
    if (unsafeAnalysis) action = 'retryAnalysis';
    else action = 'reviewed';
  }
  return {
    action,
    label: ACTION_LABELS[action],
    disabled: busy || pending || !trimmed || (unchanged && !unsafeAnalysis),
    unchanged,
    canApply: !unsafeAnalysis && !!feedback?.correctedSentence && feedback.correctedSentence !== trimmed,
  };
}
