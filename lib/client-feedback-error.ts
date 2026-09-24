import { InvalidResponseError, RequestTimeoutError } from './client-request';
import { FeedbackIssueError, type FeedbackIssue } from './feedback-issue';
export function clientFeedbackIssue(error: unknown): FeedbackIssue {
  if (error instanceof FeedbackIssueError) return error.issue;
  if (error instanceof RequestTimeoutError) return { code: 'client_timeout' };
  if (error instanceof SyntaxError || error instanceof InvalidResponseError) return { code: 'invalid_response' };
  if (error instanceof TypeError) return { code: 'client_network' };
  return { code: 'unknown' };
}
