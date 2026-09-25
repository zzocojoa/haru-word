import { sessionRecordComplete, sessionRecordMeasured, missingReviewTargets, reviewRemaining, type Session, type State } from './learning.ts';
import { today } from './learning/dates.ts';

/** Stable within a period, including finished sessions; never renumbers by UI filter. */
export function reviewSessionLabels(sessions: State['sessions']) {
  const groups = new Map<string, Session[]>();
  for (const session of Object.values(sessions)) {
    const key = `${session.kind}:${session.period}`;
    const group = groups.get(key) ?? [];
    group.push(session);
    groups.set(key, group);
  }
  const labels = new Map<string, { number: number; latest: boolean; started: string }>();
  for (const group of groups.values()) {
    group.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    group.forEach((session, index) => {
      const created = new Date(session.createdAt);
      labels.set(session.id, { number: index + 1, latest: index === group.length - 1,
        started: Number.isFinite(created.getTime()) ? today(created) : session.date });
    });
  }
  return labels;
}

/** Counts include newly learned period targets without modifying the saved queue. */
export function pendingReviewCounts(state: State, session: Session) {
  const added = missingReviewTargets(state, session).length;
  return { total: session.ids.length + added, unmeasured: reviewRemaining(session) + added, added };
}

/** Presentation counts, not a new assessment or carryover policy. */
export function sessionCounts(session: Session) {
  let recorded = 0, successful = 0, needsHelp = 0;
  for (const id of session.ids) {
    const r = session.records[id];
    if (!r) continue;
    if (sessionRecordMeasured(session, r)) recorded++;
    if (sessionRecordComplete(session, r)) successful++;
    if (r.en === 'help' || r.ko === 'help' || r.sentenceStatus === 'improve') needsHelp++;
  }
  return { total: session.ids.length, recorded, successful, needsHelp, unmeasured: session.ids.length - recorded };
}
