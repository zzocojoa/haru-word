import { editExpression, expressionDraft, type ExpressionContent } from './expression';

export type WordSenseDraft = ReturnType<typeof expressionDraft> & {
  example: string; translation: string; notes: string;
};
type DraftEntry = { initial: WordSenseDraft; value: WordSenseDraft };
export type WordEditorDraft = { selected: string; senses: Record<string, DraftEntry> };

export function wordSenseDraft(content?: ExpressionContent & Partial<WordSenseDraft>): WordSenseDraft {
  return { ...expressionDraft(content), example: content?.example ?? '',
    translation: content?.translation ?? '', notes: content?.notes ?? '' };
}

export function createWordEditorDraft(key: string, value: WordSenseDraft): WordEditorDraft {
  return { selected: key, senses: { [key]: { initial: value, value } } };
}

/** Empty key is the single new-sense draft. Switching never discards another draft. */
export function selectWordEditorDraft(draft: WordEditorDraft, key: string, initial: WordSenseDraft): WordEditorDraft {
  return { selected: key, senses: Object.hasOwn(draft.senses, key) ? draft.senses
    : { ...draft.senses, [key]: { initial, value: initial } } };
}

export function editWordEditorDraft(draft: WordEditorDraft, field: keyof WordSenseDraft, text: string): WordEditorDraft {
  const entry = draft.senses[draft.selected];
  const value = field === 'meaning' || field === 'expression' || field === 'expressionTranslation'
    ? editExpression(entry.value, field, text) : { ...entry.value, [field]: text };
  return { ...draft, senses: { ...draft.senses, [draft.selected]: { ...entry, value } } };
}

export function changedWordSenseKeys(draft: WordEditorDraft): string[] {
  return Object.keys(draft.senses).filter(key => {
    const { initial, value } = draft.senses[key];
    return (Object.keys(initial) as (keyof WordSenseDraft)[]).some(field => initial[field] !== value[field]);
  });
}

/** Validate hidden drafts too: saving one sense must never silently drop another. */
export function wordEditorDraftIssue(draft: WordEditorDraft, meanings: readonly string[]): 'empty' | 'duplicate' | 'limit' | null {
  const added = draft.senses[''];
  if (!added || (draft.selected !== '' && !changedWordSenseKeys(draft).includes(''))) return null;
  const meaning = added.value.meaning.trim();
  if (!meaning) return 'empty';
  if (meanings.some(saved => saved.trim() === meaning)) return 'duplicate';
  return meanings.length >= 100 ? 'limit' : null;
}

/** Save dirty senses together, selecting the visible sense last. Untouched blanks are ignored. */
export function wordSenseEdits(draft: WordEditorDraft): { key: string; value: WordSenseDraft }[] {
  const keys = changedWordSenseKeys(draft).filter(key => key !== draft.selected);
  return [...keys, draft.selected].map(key => ({ key, value: draft.senses[key].value }));
}
