import type { Progress, Session, State } from './learning/model.ts';

// Identity and cross-record rules shared by reads, deltas and full backups.
// Catalog membership stays at server/import boundaries, outside the client bundle.
export function validProgressIdentity(id: string, p: { personal?: { id: string } }) {
  return id.startsWith('personal_') === !!p.personal && (!p.personal || p.personal.id === id);
}
export function validSessionIdentity(id: string, session: Pick<Session, 'id'>) {
  return session.id === id;
}
export function sessionEntryIds(session: Pick<Session, 'ids' | 'records' | 'warmupIds'>): string[] {
  return [...session.ids.map(id => session.records[id]?.entryId || id), ...session.warmupIds];
}
export function stateIdentityIssues(state: { progress: Record<string, Progress>; sessions: Record<string, Session> }): string[] {
  const issues: string[] = [];
  for (const [key, session] of Object.entries(state.sessions))
    if (!validSessionIdentity(key, session)) issues.push('회차 식별자 불일치');
  for (const [key, progress] of Object.entries(state.progress))
    if (!validProgressIdentity(key, progress)) issues.push('개인 단어 식별자 불일치');
  return issues;
}
export function stateReferenceIssues(state: Pick<State, 'settings' | 'progress' | 'sessions'>,
  knownEntry: (id: string) => boolean = id => !id.startsWith('personal_')): string[] {
  const issues = stateIdentityIssues(state);
  const active = state.settings.activeSessionId;
  if (active && !Object.hasOwn(state.sessions, active)) issues.push('이어갈 학습 회차가 파일에 없어요.');
  const validEntry = (id: string) => knownEntry(id) || (Object.hasOwn(state.progress, id)
    && !!state.progress[id].personal && validProgressIdentity(id, state.progress[id]));
  for (const session of Object.values(state.sessions))
    if (sessionEntryIds(session).some(id => !validEntry(id))) issues.push('회차의 목표 단어나 개인 단어 정보가 빠졌어요.');
  return issues;
}
