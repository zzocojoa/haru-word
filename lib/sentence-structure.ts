import { z } from 'zod';

export const STRUCTURE_ROLE_CODES = ['S', 'V', 'O', 'C', 'M', 'X'] as const;
export const STRUCTURE_ROLES = {
  S: { ko: '주어', en: 'Subject' }, V: { ko: '동사', en: 'Verb' },
  O: { ko: '목적어', en: 'Object' }, C: { ko: '보어', en: 'Complement' },
  M: { ko: '수식어', en: 'Modifier' }, X: { ko: '연결·기타', en: 'Other' },
} as const satisfies Record<(typeof STRUCTURE_ROLE_CODES)[number], { ko: string; en: string }>;
export const sentenceStructureSchema = z.object({
  status: z.enum(['available', 'unavailable']),
  translation: z.string().max(2000),
  parts: z.array(z.object({
    text: z.string().trim().min(1).max(2000),
    role: z.enum(STRUCTURE_ROLE_CODES),
    explanation: z.string().trim().min(1).max(140),
  }).strict()).max(20),
  note: z.string().max(300),
}).strict();
export type SentenceStructure = z.infer<typeof sentenceStructureSchema>;

// Match every character in order, allowing layout whitespace only BETWEEN
// chunks. Never accept omitted, reordered, duplicated or invented words.
export function validSentenceStructure(structure: SentenceStructure, sentence: string) {
  if (structure.status === 'unavailable') return !structure.parts.length && !structure.translation && !!structure.note.trim();
  if (!sentence.trim() || !structure.translation.trim() || !structure.parts.length) return false;
  let rest = sentence.trim();
  for (const part of structure.parts) {
    rest = rest.trimStart();
    if (!rest.startsWith(part.text)) return false;
    rest = rest.slice(part.text.length);
  }
  return !rest.trim();
}

export const structureInstruction = `
Also explain the correctedSentence (not the original) as structure for a beginner.
Use status available, a natural Korean translation, and 1-20 contiguous parts covering the ENTIRE correctedSentence in exact order with unchanged spelling, capitalization and punctuation. Whitespace between parts may be omitted.
Each part has text, role (S subject, V verb, O object, C complement, M modifier/adverbial, X connector/other), and one short Korean explanation (at most 140 characters) of its meaning AND role here. These are sentence roles, not dictionary parts of speech.
Group auxiliaries with their main verb when contiguous (will take = V); for questions or intervening adverbs, split them in actual surface order. Do not force all sentences into SVO. Allow SV, SVC, multiple objects, clauses and imperatives with an understood subject; never insert absent words.
Keep noun phrases together, including their internal modifiers. Explain preposition phrases in context; do not call every post-verbal phrase an object or every necessary complement an optional modifier. M is a learner aid, not a universal grammar notation. Use X only for connectors or other explainable material, not to disguise uncertainty.
The optional note is a short Korean explanation of the overall pattern or a necessary caveat (max 300 characters; empty is allowed).
When correctedSentence is empty, analysis is ambiguous, or more than 20 parts are needed, use status unavailable, translation empty, parts [], and a short Korean reason in note. Never invent an analysis.`;

// All keys are required for Groq strict mode; persistence remains optional for
// old feedback. Provider results undergo the stricter local checks above too.
export const structureJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['available', 'unavailable'] },
    translation: { type: 'string' },
    parts: { type: 'array', items: { type: 'object', additionalProperties: false,
      properties: { text: { type: 'string' }, role: { type: 'string', enum: STRUCTURE_ROLE_CODES }, explanation: { type: 'string' } },
      required: ['text', 'role', 'explanation'] } },
    note: { type: 'string' },
  }, required: ['status', 'translation', 'parts', 'note'],
};
