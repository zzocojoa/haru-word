import type { SentenceFeedback } from './sentence-feedback.ts';

export type CorrectionComparison = { before: string; after: string; proposal: string };
export type CorrectionUndo = { before: string; after: string };
export function correctionIdentity(feedback: SentenceFeedback) {
  return JSON.stringify([feedback.original, feedback.correctedSentence, feedback.createdAt, feedback.model, feedback.promptVersion, feedback.validationVersion,feedback.contextFingerprint]);
}
export function compareCorrection(sentence: string, feedback: SentenceFeedback): CorrectionComparison {
  return { before: sentence, after: feedback.correctedSentence, proposal: correctionIdentity(feedback) };
}
export function canConfirmCorrection(sentence: string, feedback: SentenceFeedback, comparison: CorrectionComparison) {
  return sentence === comparison.before && feedback.correctedSentence === comparison.after && correctionIdentity(feedback) === comparison.proposal;
}
export function canUndoCorrection(sentence: string, undo: CorrectionUndo) { return sentence === undo.after; }
