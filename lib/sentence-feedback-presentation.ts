import type { SentenceFeedback } from './sentence-feedback.ts';

const ACTION_LABELS = {
  ready: 'AI로 문장 점검',
  checking: '문장을 확인하고 있어요',
  reviewed: '이 문장의 교정 결과가 있어요',
  retryStructure: '문장 구조 다시 점검',
  upgradeStructure: '문장 구조 포함해 다시 점검',
} as const;

type Input = { sentence: string; feedback?: SentenceFeedback; busy: boolean; pending: boolean };

/** Daily-study presentation only. Grammar lessons intentionally allow rechecking. */
export function sentenceFeedbackPresentation({ sentence, feedback, busy, pending }: Input) {
  const trimmed = sentence.trim();
  const unchanged = feedback?.original === trimmed;
  const hasStructure = feedback?.structure?.status === 'available';
  let action: keyof typeof ACTION_LABELS = 'ready';
  if (pending) action = 'checking';
  else if (unchanged) {
    if (hasStructure) action = 'reviewed';
    else if (feedback?.structure?.status === 'unavailable') action = 'retryStructure';
    else action = 'upgradeStructure';
  }
  return {
    action,
    label: ACTION_LABELS[action],
    disabled: busy || pending || !trimmed || (unchanged && hasStructure),
    unchanged,
    canApply: !!feedback?.correctedSentence && feedback.correctedSentence !== trimmed,
  };
}
