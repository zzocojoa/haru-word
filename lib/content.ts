import type { Content, Progress } from './learning';
import { withExpressionTranslation } from './expression.ts';

export { withExpressionTranslation } from './expression.ts';

export function resolveCardContent(base: Content, progress?: Progress): Content {
  if (!progress) return base;
  const differentSense = !!progress.meaning && progress.meaning.trim() !== base.meaning.trim();
  // Catalog corrections must not attach a new sense's examples to an older saved meaning.
  const fallback = differentSense ? { expression: '', example: '', translation: '' } : base;
  const editedExample = (progress.example !== undefined && progress.example !== base.example)
    || (progress.translation !== undefined && progress.translation !== base.translation);
  const missingExample = differentSense && !progress.example && !progress.translation && !progress.personal;
  const content: Content = {
    ...base,
    meaning: progress.meaning ?? base.meaning,
    expression: progress.expression ?? fallback.expression,
    // Only the matching step below may supply a missing catalog gloss.
    expressionTranslation: progress.expressionTranslation,
    example: progress.example ?? fallback.example,
    translation: progress.translation ?? fallback.translation,
  };
  if (editedExample || missingExample) {
    content.source = missingExample ? '이 뜻의 예문은 사전에서 확인해 주세요.'
      : progress.personal ? '개인 추가 예문' : '내가 수정한 예문';
    content.attribution = undefined;
    content.url = undefined;
  }
  return withExpressionTranslation(content, base);
}
