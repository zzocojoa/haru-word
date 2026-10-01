import { z } from 'zod';

// Evaluation/local diagnostics only. Never include values, messages, unknown
// property names, provider bodies or learner text in this contract.
const fields = ['root', 'meaningUsage', 'grammar', 'correctedSentence', 'explanation', 'structure',
  'structure.status', 'structure.translation', 'structure.parts', 'structure.parts[].wordCount',
  'structure.parts[].role', 'structure.parts[].explanation', 'structure.note',
  'context', 'target', 'target.reason', 'target.originalSpan', 'target.observedUse', 'changes',
  'changes[].before', 'changes[].after', 'changes[].rule', 'structure.parts[].text',
  'structure.parts[].function', 'structure.parts[].meaning', 'structure.parts[].governor', 'other'] as const;
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
export const feedbackValidationDetailSchema = z.union([schemaDetail, overflowDetail, leftoverDetail]);
export type FeedbackValidationDetail = z.infer<typeof feedbackValidationDetailSchema>;
export function parseFeedbackValidationDetail(value: unknown, context?: { stage?: unknown; diagnostic?: unknown }): FeedbackValidationDetail | undefined {
  const result = feedbackValidationDetailSchema.safeParse(value);
  if (!result.success) return undefined;
  if (context && (result.data.kind === 'schema'
    ? context.stage !== 'fields' || context.diagnostic !== 'wire_fields'
    : context.stage !== 'structure' || context.diagnostic !== 'chunk_count')) return undefined;
  return result.data;
}

export function summarizeValidationIssues(issues: readonly z.ZodIssue[]): FeedbackValidationDetail {
  const items = issues.slice(0, 8).map(issue => {
    // Only the one known array index is normalized. An attacker-controlled
    // key containing dots/brackets must never be mistaken for a trusted path.
    const path = [...issue.path];
    const normalized = path.length === 4 && path[0] === 'structure' && path[1] === 'parts'
      && typeof path[2] === 'number' && ['wordCount', 'role', 'explanation', 'text', 'function', 'meaning', 'governor'].includes(String(path[3]))
      ? `structure.parts[].${path[3]}` : path.length === 3 && path[0] === 'changes' && typeof path[1] === 'number' && ['before', 'after', 'rule'].includes(String(path[2]))
        ? `changes[].${path[2]}` : path.every(p => typeof p === 'string' && !/[.\[\]]/.test(p)) ? path.join('.') : '';
    const field = !path.length ? 'root' : fields.find(f => f === normalized) ?? 'other';
    const reason = issue.code === 'invalid_type' ? issue.received === 'undefined' ? 'missing' : issue.expected === 'integer' ? 'integer' : 'type'
      : issue.code === 'invalid_enum_value' ? 'enum'
      : issue.code === 'unrecognized_keys' ? 'unexpected_keys'
      : issue.code === 'too_small' ? 'too_small'
      : issue.code === 'too_big' ? 'too_large' : 'schema';
    return { field, reason };
  });
  return schemaDetail.parse({ kind: 'schema', issues: items, truncated: issues.length > 8 });
}
