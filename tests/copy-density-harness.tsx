import { renderToStaticMarkup } from 'react-dom/server';
import { SentenceFeedbackPanel } from '../app/sentence-feedback';
import { GrammarWriting } from '../app/grammar/grammar-writing';
import { FamiliarityCard } from '../app/familiarity-card';
import { LESSON_MAP } from '../lib/grammar/content';
import type { Word } from '../lib/learning';

const noop = () => {};
export function render(surface: string) {
  if (surface === 'word-ai') return renderToStaticMarkup(<SentenceFeedbackPanel sessionId="copy-test" entryId="copy-word" sentence="I work here." busy={false} onPending={noop} onFeedback={async () => true} onUse={noop} />);
  if (surface === 'grammar-ai') return renderToStaticMarkup(<GrammarWriting lesson={LESSON_MAP.get('noun')!} progress={{ stage: 5, sentence: '', answers: {}, updatedAt: '2026-09-25T00:00:00Z' }} canSave aiPending={false} aiError={null} onAi={noop} onSentence={noop} onCheck={noop} onExplain={noop} onComplete={noop} />);
  return renderToStaticMarkup(<FamiliarityCard word={{ id: 'sample', word: 'book', pos: 'n.', level: 'A1', page: 1 } as Word} busy={false} onReveal={noop} onConfirm={noop} />);
}
