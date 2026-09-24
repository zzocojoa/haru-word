import type { State } from './learning';
import type { SentenceFeedback } from './sentence-feedback';
import type { FeedbackIssue } from './feedback-issue';

// Wire contracts shared by the client and server. Imports here must remain type-only.
export type ApiError = { error: string; conflict?: boolean } & Partial<FeedbackIssue>;
export type StateSnapshot = { revision: number; state: State };
export type StateRevision = { revision: number };
export type SaveStateRequest = StateRevision & {
  grammar?: State['grammar'];
  settings?: State['settings'];
  progress: State['progress'];
  sessions: State['sessions'];
};
export type FeedbackRequest = { sessionId: string; entryId: string; sentence: string };
export type FeedbackResponse = { feedback: SentenceFeedback };
