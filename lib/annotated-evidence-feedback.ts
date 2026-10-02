import { EVIDENCE_RULES } from './evidence-feedback.ts';
import { tokenEvidenceFeedbackContract, parseTokenEvidenceFeedback, tokenEvidenceWordInstruction, tokenEvidenceGrammarInstruction } from './token-evidence-feedback.ts';
import { FeedbackValidationError, type ProviderFeedbackContract } from './provider-feedback-contract.ts';

// Synthetic evaluation candidate. No learner API selects this contract.
// Historical token/count/evidence defaults and request hashes stay intact.
export const ANNOTATED_PREPOSITION_RULE = '전치사의 선택은 함께 쓰는 동사·형용사·명사와 문맥에 따라 달라져요. 전치사의 목적어와 동사의 직접목적어를 구분해요.';
const ruleTexts = { preposition: ANNOTATED_PREPOSITION_RULE } as const;
type ValidatedPart = { units: string[]; function: string; governor?: string };

export function parseAnnotatedEvidenceFeedback(text: unknown, original: string, model: Parameters<typeof parseTokenEvidenceFeedback>[2]) {
  // Complete old shape/literal/edit/target/governor validation runs first.
  // Neither a rejected value nor missing units are translated or repaired.
  const feedback = parseTokenEvidenceFeedback(text, original, model, ruleTexts);
  const structure = feedback.structure;
  if (structure?.status !== 'available') return feedback;
  // The successful parser above establishes this selected available branch.
  const value = JSON.parse(text as string) as { analysis: { structure: { parts: ValidatedPart[] } } };
  const parts = value.analysis.structure.parts;
  const subjectWithoutVerb = parts.some(p => p.function === 'subject') && !parts.some(p => p.function === 'verb');
  const objectAlsoGovernor = parts.some((part, index) => part.function === 'direct-object'
    && parts[index + 1]?.function === 'preposition-object'
    && structure.parts[index].text === parts[index + 1].governor);
  if (subjectWithoutVerb || objectAlsoGovernor) {
    // Conservative flat-analysis contradictions, not an English grammar checker.
    // Withhold by rejection, never manufacture a correct model judgment.
    throw new FeedbackValidationError('structure', 'evidence_contract', { kind: 'evidence_structure', reason: 'structure_contract' });
  }
  return feedback;
}

const fieldDescriptions: Record<string, string> = {
  observedUse: '원문에서 관측한 뜻이나 기능을 한국어로 설명합니다. 영어 단어만 반복하거나 일반 문법 규칙을 쓰지 않습니다.',
  meaning: '이 부분 자체의 어휘 뜻을 한국어로 씁니다. 주어·동사 같은 역할 이름이나 다른 부분의 뜻을 대신 넣지 않습니다.',
  translation: '문장 전체의 자연스러운 한국어 해석입니다. 인물·시제·부정·수량·질문/명령의 뜻을 보존합니다.',
  units: 'natural 분석은 제공된 originalUnits를, needs_work 분석은 correctedSentence를 기존 공백·아포스트로피 접미사 규칙으로 나눈 단위를 연속으로 묶습니다. 각 단위의 대소문자와 붙은 문장부호를 그대로 유지합니다.',
};
function describeSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(describeSchema);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (key !== 'properties' || !child || typeof child !== 'object' || Array.isArray(child)) return [key, describeSchema(child)];
    return [key, Object.fromEntries(Object.entries(child).map(([field, schema]) => [field,
      fieldDescriptions[field] && schema && typeof schema === 'object' && !Array.isArray(schema)
        ? { ...describeSchema(schema) as Record<string, unknown>, description: fieldDescriptions[field] }
        : describeSchema(schema),
    ]))];
  }));
}

export const annotatedEvidenceFeedbackContract: ProviderFeedbackContract = {
  schema: describeSchema(tokenEvidenceFeedbackContract.schema) as Record<string, unknown>,
  parse: parseAnnotatedEvidenceFeedback,
  instruction: tokenEvidenceFeedbackContract.instruction.replace(EVIDENCE_RULES.preposition.text, ANNOTATED_PREPOSITION_RULE) + `
Before declaring natural, identify a complete clause or a clear imperative in the ORIGINAL. A lone noun or alternatives list supplies neither a subject relation nor a complete sentence merely because the target word is present. Do not assign subject to an isolated noun and invent its clause. Insufficient input uses only analysis grammar uncertain. A clear imperative has a verb and need not have an explicit subject.
observedUse, meaning and translation MUST contain actual Korean prose. English may identify a word inside a Korean explanation; English repetition alone is invalid. A part's meaning belongs to that exact part: do not include a desire/action contributed by a different verb.
Analyze one flat layer consistently. A whole infinitival clause can be a verb complement. Do not label a partial infinitive and its internal noun as two adjacent direct objects of the same outer verb. Alternatively show its verb and noun functions without pretending both are outer objects. A preposition that governs the next noun is not itself the verb's direct object. If the flat format cannot express the chosen analysis accurately, return structure unavailable/complex.`,
};
export const annotatedEvidenceWordInstruction = tokenEvidenceWordInstruction;
export const annotatedEvidenceGrammarInstruction = tokenEvidenceGrammarInstruction + `
Distinguish an identifiable intended grammatical function from a malformed marker. A clearly intended infinitival complement can match the infinitive lesson even when its required to is omitted; grammar still needs_work. For example, a desire expressed as "We hope visit the museum" needs a to correction and can show the intended infinitive function. This does not make every verb complement an infinitive: a grammatical -ing complement for another function is not matched merely because rewriting could turn it into an infinitive. Evaluate the original intent and keep grammatical target mismatches unchanged.`;
