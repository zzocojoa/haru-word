import type { SentenceFeedback } from './sentence-feedback.ts';
import { feedbackSafetyIssue } from './feedback-safety.ts';

const ACTION_LABELS = {
  ready: 'AI 참고 의견 요청',
  checking: '문장을 확인하고 있어요',
  retryAnalysis: 'AI 참고 의견 다시 요청',
} as const;

type Input = { sentence: string; feedback?: SentenceFeedback; busy: boolean; pending: boolean };

/** Rechecking always requires the learner's explicit button press, including the same sentence. */
export function sentenceFeedbackPresentation({ sentence, feedback, busy, pending }: Input) {
  const trimmed = sentence.trim();
  const unchanged = feedback?.original === trimmed;
  const unsafeAnalysis = !!feedback && !!feedbackSafetyIssue(feedback);
  let action: keyof typeof ACTION_LABELS = 'ready';
  if (pending) action = 'checking';
  else if (unchanged) {
    action = 'retryAnalysis';
  }
  return {
    action,
    label: ACTION_LABELS[action],
    disabled: busy || pending || !trimmed,
    unchanged,
    canApply: !unsafeAnalysis && !!feedback?.correctedSentence && feedback.correctedSentence !== trimmed,
  };
}
