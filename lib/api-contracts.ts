import type { State } from './learning';
import type { SentenceFeedback } from './sentence-feedback';
import type { FeedbackIssue } from './feedback-issue';
import type {ReceiptRequest,FeedbackReceipt} from './feedback-receipt';
import type {FeedbackContextRequest} from './feedback-context';

// Wire contracts shared by the client and server. Imports here must remain type-only.
export type ApiError = { error: string; conflict?: boolean; receipt?: FeedbackReceipt } & Partial<FeedbackIssue>;
export type StateSnapshot = { revision: number; state: State };
export type StateRevision = { revision: number };
export type SaveStateRequest = StateRevision & {
  grammar?: State['grammar'];
  settings?: State['settings'];
  progress: State['progress'];
  sessions: State['sessions'];
};
export type FeedbackRequest = { sessionId: string; entryId: string; sentence: string; expectedModelId: string } & ReceiptRequest & FeedbackContextRequest;
export type FeedbackResponse = { feedback: SentenceFeedback;receipt?:FeedbackReceipt };
