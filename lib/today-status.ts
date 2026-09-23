import {
  dailyMeaning, entryIdFor, hasReviewWork, missingReviewTargets, pendingReviews,
  senseProgress, sessionRecordMeasured, targetIdentity,
  type RecordItem, type Session, type State,
} from './learning.ts';

type Notice = { label: string; warning: boolean };
export type TodayWordStatus = {
  learning: '오늘 진행 중' | '오늘 학습 완료' | '오늘 회차 종료' | null;
  notices: Notice[];
};

// Presentation only: a pending check is not evidence of a failed recall.
// Keep today's record and each sense's current review needs on separate axes.
export function todayWordStatuses(
  state: State, ids: string[], date: string, currentSession?: Session,
): Record<string, TodayWordStatus> {
  const today = new Map<string, { session: Session; record: RecordItem }>();
  const earlierUnmeasured = new Set<string>();
  for (const session of Object.values(state.sessions)
    .filter(s => s.kind === 'daily')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    for (const id of session.ids) {
      const record = session.records[id];
      if (!record) continue;
      const entryId = entryIdFor(session, id);
      if (session.date === date) today.set(entryId, { session, record });
      if (session.date < date && !sessionRecordMeasured(session, record))
        earlierUnmeasured.add(targetIdentity(entryId, record.meaning));
    }
  }
  // Match the unfinished session shown by the dashboard, including older backups
  // that contain more than one daily session on the same date.
  if (currentSession?.kind === 'daily' && currentSession.date === date)
    for (const id of currentSession.ids) {
      const record = currentSession.records[id];
      if (record) today.set(entryIdFor(currentSession, id), { session: currentSession, record });
    }

  const waiting = new Map<string, Set<'weekly' | 'monthly'>>();
  const addWaiting = (entryId: string, meaning: string, kind: 'weekly' | 'monthly') => {
    const key = targetIdentity(entryId, meaning);
    if (!waiting.has(key)) waiting.set(key, new Set());
    waiting.get(key)!.add(kind);
  };
  for (const session of pendingReviews(state)) {
    const kind = session.kind === 'monthly' ? 'monthly' : 'weekly';
    for (const id of session.ids) {
      const record = session.records[id];
      if (record && !sessionRecordMeasured(session, record))
        addWaiting(entryIdFor(session, id), record.meaning, kind);
    }
    for (const target of missingReviewTargets(state, session))
      addWaiting(target.entryId, target.meaning, kind);
  }

  return Object.fromEntries(ids.map(id => {
    const context = today.get(id);
    const p = state.progress[id];
    const meaning = context?.record.meaning ?? dailyMeaning(p, p?.meaning ?? '');
    const sense = senseProgress(p, meaning);
    const key = targetIdentity(id, meaning);
    const notices: Notice[] = [];
    if (sense.en === 'help' || sense.ko === 'help')
      notices.push({ label: '재학습 필요', warning: true });
    if (sense.sentenceStatus === 'improve')
      notices.push({ label: '문장 보완 필요', warning: true });
    if (waiting.get(key)?.has('monthly'))
      notices.push({ label: '월말 점검 대기', warning: false });
    if (waiting.get(key)?.has('weekly'))
      notices.push({ label: '주간 점검 대기', warning: false });

    const learning = !context ? null
      : sessionRecordMeasured(context.session, context.record) ? '오늘 학습 완료'
      : context.session.finished ? '오늘 회차 종료' : '오늘 진행 중';
    if (context?.session.finished && !sessionRecordMeasured(context.session, context.record))
      notices.push({ label: '미완료 연습 남음', warning: false });
    if (!context && !notices.length && hasReviewWork(p)) {
      const measured = sense.en && sense.en !== 'unmeasured'
        && sense.ko && sense.ko !== 'unmeasured'
        && sense.sentenceStatus && sense.sentenceStatus !== 'unmeasured';
      notices.push({ label: !measured && earlierUnmeasured.has(key)
        ? '이전 학습 미완료' : '복습 예정', warning: false });
    }
    if (!context && !notices.length)
      notices.push({ label: p?.familiarity === 'uncertain' ? '헷갈리는 단어'
        : p?.familiarity === 'new' ? '처음 보는 단어' : '학습 후보', warning: false });
    return [id, { learning, notices }];
  }));
}
