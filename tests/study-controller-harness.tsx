// Test-only React harness. No API, account, or provider requests are made here.
import React, { useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useStudySessionController } from '../app/study/use-study-session-controller';
import { EMPTY, type Session, type State, type Word } from '../lib/learning';

const word: Word = { id: 'harness-word', word: 'example', headword: 'example', pos: 'n.', level: 'A1', page: 1 };
const material = { meaning: '예', expression: 'an example', expressionTranslation: '하나의 예', example: '', translation: '', source: 'test' };
const record = { meaning: '예', en: 'unmeasured', ko: 'unmeasured', sentenceStatus: 'unmeasured', sentence: '', notes: '', material } as const;
const first: Session = {
  id: 'harness-session', kind: 'daily', date: '2026-09-22', period: '2026-09-22',
  ids: ['harness-word', 'harness-next'], warmupIds: [], stage: 'en', index: 0,
  records: { 'harness-word': { ...record }, 'harness-next': { ...record } },
  retry: [], retryMode: false, elapsed: 0, paused: true, finished: false, createdAt: '2026-09-22T00:00:00.000Z',
};
const seed: State = { ...structuredClone(EMPTY), sessions: { [first.id]: first } };
const currentState = { current: seed };
type Trace = { id?: string; stage: string; answer: string; hint: boolean; revealed: boolean; text: string | null };
const trace: Trace[] = [];
type Controls = {
  patch: (patch: Partial<Session>) => void;
  refresh: () => void;
  controller: ReturnType<typeof useStudySessionController>;
  trace: Trace[];
};
declare global { interface Window { studyHarness: Controls } }

function Harness() {
  const [state, setState] = useState(seed);
  useLayoutEffect(() => { currentState.current = state; }, [state]);
  const c = useStudySessionController({
    date: first.date, activityDate: () => first.date, state, currentState, session: state.sessions[first.id],
    words: [word, { ...word, id: 'harness-next', word: 'next' }],
    save: async next => { currentState.current = next; setState(next); return true; },
    busy: false, saved: true, visible: true, onClose() {}, onReview() {}, onRepeat() {},
  });
  useLayoutEffect(() => {
    window.studyHarness = {
      controller: c, trace,
      patch: patch => setState(previous => ({ ...previous, sessions: { ...previous.sessions, [first.id]: { ...previous.sessions[first.id], ...patch } } })),
      refresh: () => setState(previous => structuredClone(previous)),
    };
    trace.push({ id: c.id, stage: c.s.stage, answer: c.answer, hint: c.hint, revealed: c.revealed, text: document.getElementById('visible-question')?.textContent ?? null });
  });
  return <HarnessView controller={c} />;
}
function HarnessView({ controller: { focus, id, s, revealed, answer, setAnswer, revealAnswer } }: { controller: Controls['controller'] }) {
  return <main>
    <h1 ref={focus} tabIndex={-1} id="visible-question">{id} {s.stage} {revealed ? '공개됨' : '숨김'}</h1>
    <input aria-label="답" value={answer} onChange={e => setAnswer(e.target.value)} />
    <button onClick={() => revealAnswer()}>공개</button>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
