export type ExpressionContent = {
  meaning: string;
  expression: string;
  expressionTranslation?: string;
};

export type ExpressionDraft = Required<ExpressionContent>;

export function expressionDraft(content?: ExpressionContent): ExpressionDraft {
  return {
    meaning: content?.meaning ?? '',
    expression: content?.expression ?? '',
    expressionTranslation: content?.expressionTranslation ?? '',
  };
}

// A gloss belongs to both the English phrase and its learning sense.
export function editExpression<T extends ExpressionDraft>(
  draft: T, field: keyof ExpressionDraft, value: string,
): T {
  if (draft[field] === value) return draft;
  const changedContext = field !== 'expressionTranslation'
    && draft[field].trim() !== value.trim();
  return {
    ...draft,
    [field]: value,
    ...(changedContext ? { expressionTranslation: '' } : {}),
  };
}

// Candidate order defines priority. Explicit values, including '', always win.
export function withExpressionTranslation<T extends ExpressionContent>(
  content: T, ...candidates: (Partial<ExpressionContent> | undefined)[]
): T {
  if (content.expressionTranslation !== undefined || !content.expression.trim()) return content;
  const match = candidates.find(candidate => candidate?.expressionTranslation !== undefined
    && candidate.expression?.trim() === content.expression.trim()
    && candidate.meaning?.trim() === content.meaning.trim());
  return match ? { ...content, expressionTranslation: match.expressionTranslation } : content;
}
