import { z } from 'zod';

// Evaluation/local diagnostics only. Never include values, messages, unknown
// property names, provider bodies or learner text in this contract.
const fields = ['root', 'meaningUsage', 'grammar', 'correctedSentence', 'explanation', 'structure',
  'structure.status', 'structure.translation', 'structure.parts', 'structure.parts[].wordCount',
  'structure.parts[].role', 'structure.parts[].explanation', 'structure.note',
  'context', 'target', 'target.reason', 'target.originalSpan', 'target.observedUse', 'changes',
  'changes[].before', 'changes[].after', 'changes[].rule', 'structure.parts[].text',
  'structure.parts[].function', 'structure.parts[].meaning', 'structure.parts[].governor', 'other',
  'analysis', 'analysis.grammar', 'analysis.correctedSentence', 'analysis.target', 'analysis.target.reason', 'analysis.target.originalSpan', 'analysis.target.observedUse',
  'analysis.changes', 'analysis.changes[].before', 'analysis.changes[].after', 'analysis.changes[].rule', 'analysis.structure',
  'analysis.structure.status', 'analysis.structure.translation', 'analysis.structure.parts', 'analysis.structure.parts[].unitCount',
  'analysis.structure.parts[].function', 'analysis.structure.parts[].meaning', 'analysis.structure.parts[].governor',
  'analysis.structure.parts[].units', 'analysis.structure.parts[].units[]', 'analysis.structure.note'] as const;
const reasons = ['missing', 'type', 'enum', 'integer', 'too_small', 'too_large', 'unexpected_keys', 'schema'] as const;
const schemaDetail = z.object({ kind: z.literal('schema'),
  issues: z.array(z.object({ field: z.enum(fields), reason: z.enum(reasons) }).strict()).min(1).max(8),
  truncated: z.boolean(),
}).strict();
const tokenFields = { kind: z.literal('tokens'),
  tokenCount: z.number().int().min(0).max(2000),
  consumedTokens: z.number().int().min(0).max(2000),
};
const overflowDetail = z.object({ ...tokenFields, reason: z.literal('part_exceeds_tokens'),
  requestedTokens: z.number().int().min(1).max(2000), partIndex: z.number().int().min(0).max(19),
}).strict().refine(v => v.consumedTokens <= v.tokenCount && v.consumedTokens + v.requestedTokens > v.tokenCount);
const leftoverDetail = z.object({ ...tokenFields, reason: z.literal('leftover_tokens'),
}).strict().refine(v => v.consumedTokens < v.tokenCount);
export const EVIDENCE_JUDGMENT_REASONS = ['context_grammar', 'context_withholding', 'context_note', 'target_judgment',
  'target_span', 'target_absent', 'target_evidence_missing', 'target_ambiguous_use', 'natural_rewrite',
  'edit_missing', 'correction_missing', 'edit_anchor_absent', 'edit_anchor_order', 'edit_anchor_ambiguous',
  'edit_unchanged', 'edit_reconstruction', 'edit_no_effect', 'unexpected_edits'] as const;
export const EVIDENCE_STRUCTURE_PART_REASONS = ['span_order', 'governor_missing', 'governor_whitespace',
  'governor_mismatch', 'governor_object_boundary', 'governor_prefix_boundary', 'governor_inside_object', 'unexpected_governor'] as const;
export const EVIDENCE_STRUCTURE_REASONS = ['available_note', 'available_sentence', 'available_translation',
  'available_parts', 'unavailable_parts', 'unavailable_translation', 'unavailable_note', 'span_leftover', 'structure_contract'] as const;
export type EvidenceJudgmentReason = (typeof EVIDENCE_JUDGMENT_REASONS)[number];
export type EvidenceStructurePartReason = (typeof EVIDENCE_STRUCTURE_PART_REASONS)[number];
export type EvidenceStructureReason = (typeof EVIDENCE_STRUCTURE_REASONS)[number];
const evidenceJudgmentDetail = z.object({ kind: z.literal('evidence_judgment'), reason: z.enum(EVIDENCE_JUDGMENT_REASONS) }).strict();
const evidenceStructurePartDetail = z.object({ kind: z.literal('evidence_structure'), reason: z.enum(EVIDENCE_STRUCTURE_PART_REASONS),
  partIndex: z.number().int().min(0).max(19),
}).strict();
const evidenceStructureDetail = z.object({ kind: z.literal('evidence_structure'), reason: z.enum(EVIDENCE_STRUCTURE_REASONS) }).strict();
export const feedbackValidationDetailSchema = z.union([schemaDetail, overflowDetail, leftoverDetail, evidenceJudgmentDetail, evidenceStructurePartDetail, evidenceStructureDetail]);
export type FeedbackValidationDetail = z.infer<typeof feedbackValidationDetailSchema>;
export function parseFeedbackValidationDetail(value: unknown, context?: { stage?: unknown; diagnostic?: unknown }): FeedbackValidationDetail | undefined {
  const result = feedbackValidationDetailSchema.safeParse(value);
  if (!result.success) return undefined;
  if (context) {
    const expected = result.data.kind === 'schema' ? ['fields', 'wire_fields']
      : result.data.kind === 'tokens' ? ['structure', 'chunk_count']
        : [result.data.kind === 'evidence_judgment' ? 'judgment' : 'structure', 'evidence_contract'];
    if (context.stage !== expected[0] || context.diagnostic !== expected[1]) return undefined;
  }
  return result.data;
}

const arrayIndex = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function summarizeValidationIssues(issues: readonly z.ZodIssue[]): FeedbackValidationDetail {
  const items = issues.slice(0, 8).map(issue => {
    // Only the known parts/changes/units array indices are normalized. An attacker-controlled
    // key containing dots/brackets must never be mistaken for a trusted path.
    const originalPath = [...issue.path], counted = originalPath[0] === 'analysis';
    const path = counted ? originalPath.slice(1) : originalPath;
    const local = path.length === 4 && path[0] === 'structure' && path[1] === 'parts'
      && arrayIndex(path[2]) && ['wordCount', 'unitCount', 'role', 'explanation', 'text', 'function', 'meaning', 'governor', 'units'].includes(String(path[3]))
      ? `structure.parts[].${path[3]}` : path.length === 3 && path[0] === 'changes' && arrayIndex(path[1]) && ['before', 'after', 'rule'].includes(String(path[2]))
        ? `changes[].${path[2]}` : path.length === 5 && path[0] === 'structure' && path[1] === 'parts' && arrayIndex(path[2]) && path[3] === 'units' && arrayIndex(path[4])
          ? 'structure.parts[].units[]' : path.every(p => typeof p === 'string' && !/[.\[\]]/.test(p)) ? path.join('.') : '';
    const normalized = counted ? local ? `analysis.${local}` : path.length ? '' : 'analysis' : local;
    const field = !originalPath.length ? 'root' : fields.find(f => f === normalized) ?? 'other';
    const reason = issue.code === 'invalid_type' ? issue.received === 'undefined' ? 'missing' : issue.expected === 'integer' ? 'integer' : 'type'
      : issue.code === 'invalid_enum_value' || issue.code === 'invalid_union_discriminator' ? 'enum'
      : issue.code === 'unrecognized_keys' ? 'unexpected_keys'
      : issue.code === 'too_small' ? 'too_small'
      : issue.code === 'too_big' ? 'too_large' : 'schema';
    return { field, reason };
  });
  return schemaDetail.parse({ kind: 'schema', issues: items, truncated: issues.length > 8 });
}
