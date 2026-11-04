export const FEEDBACK_MODEL = 'gemini-3.1-flash-lite';
export const GROQ_FEEDBACK_MODEL = 'openai/gpt-oss-120b';
export function feedbackProvider(feedback: { model: string; provider?: string }) {
  if (feedback.provider === 'openai') return 'OpenAI';
  if (feedback.provider === 'google') return 'Google Gemini';
  if (feedback.provider === 'groq') return 'Groq';
  if (feedback.model === GROQ_FEEDBACK_MODEL) return 'Groq';
  if (feedback.model === FEEDBACK_MODEL) return 'Google Gemini';
  return '알 수 없는 제공사';
}
