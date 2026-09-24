export const FEEDBACK_MODEL = 'gemini-3.1-flash-lite';
export const GROQ_FEEDBACK_MODEL = 'openai/gpt-oss-120b';
export function feedbackProvider(feedback: { model: typeof FEEDBACK_MODEL | typeof GROQ_FEEDBACK_MODEL }) {
  return feedback.model === GROQ_FEEDBACK_MODEL ? 'Groq' : 'Google Gemini';
}
