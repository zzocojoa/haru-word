import { z } from 'zod';
import {AI_PROMPT_VERSION,AI_VALIDATION_VERSION} from './ai-models.ts';

export const FEEDBACK_CONTEXT_MAX = 500;
export const FEEDBACK_CONTEXT_KINDS=['sentence','reply','title','command'] as const;
export type FeedbackContextKind=typeof FEEDBACK_CONTEXT_KINDS[number];
export const FEEDBACK_CONTEXT_KIND_TEXT={sentence:'일반 문장',reply:'대화의 짧은 답변',title:'제목·표현',command:'명령·요청'};
export const feedbackContextFields = {
  contextNote: z.string().trim().max(FEEDBACK_CONTEXT_MAX).optional(),
  expectedContextFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  contextKind:z.enum(FEEDBACK_CONTEXT_KINDS).optional(),
};
export type FeedbackContextRequest = { contextNote?: string; expectedContextFingerprint?: string;contextKind?:FeedbackContextKind };
export type FeedbackInput = { sentence: string; [key: string]: string };
// Legacy grammar results retain raw input; v5 uses the trimmed request sentence.
// Accept only those two representations without rewriting the learner's draft.
export function feedbackOriginalMatches(original: string, sentence: string) {
  return original === sentence || original === sentence.trim();
}
export function wordFeedbackInput(word: { word: string; pos: string }, meaning: string, sentence: string, contextNote = '', expression = word.word,contextKind:FeedbackContextKind='sentence'): FeedbackInput {
  return { word: word.word, pos: word.pos, meaning, expression, sentence: sentence.trim(), ...(contextNote.trim() ? { contextNote: contextNote.trim() } : {}),...(contextKind!=='sentence'?{contextKind}:{}) };
}
// This identifies the reviewed target/input, never authentication or ownership.
// The receipt claim separately binds owner, revision and the actual generation profile.
export async function feedbackContextFingerprint(domain: 'word'|'grammar', targetKey: string, input: FeedbackInput, modelId: string) {
  const canonical = JSON.stringify(['feedback-context-v1', AI_PROMPT_VERSION,AI_VALIDATION_VERSION,domain, targetKey, modelId, Object.keys(input).sort().map(k => [k, input[k]])]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export function feedbackMatchesContext(feedback: { original: string; model: string; promptVersion?:string;validationVersion?: string; contextFingerprint?: string }, sentence: string, modelId: string, fingerprint?: string) {
  return !!fingerprint && feedback.original === sentence.trim() && feedback.model === modelId
    && feedback.validationVersion === AI_VALIDATION_VERSION && feedback.promptVersion===AI_PROMPT_VERSION && feedback.contextFingerprint === fingerprint;
}
