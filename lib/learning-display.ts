import { sessionRecordComplete, sessionRecordMeasured, missingReviewTargets, reviewRemaining, type Session, type State } from './learning.ts';

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
