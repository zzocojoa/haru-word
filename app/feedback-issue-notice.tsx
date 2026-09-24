'use client';
import { FEEDBACK_ISSUES, type FeedbackIssue } from '@/lib/feedback-issue';

export function FeedbackIssueNotice({ issue }: { issue: FeedbackIssue | null }) {
  if (!issue) return null;
  const [title, reason, action] = FEEDBACK_ISSUES[issue.code];
  return <div role="alert" className="notice ai-feedback-issue" data-feedback-code={issue.code}>
    <strong>{title}</strong>
    <p>{reason}</p>
    <p>{action}</p>
    {issue.retryAfterSeconds && <p className="small-note">Google 재시도 대기 안내: {issue.retryAfterSeconds}초 · 자동 재시도는 하지 않아요.</p>}
    <p className="small-note">입력은 유지돼요. 자기 점검으로 계속할 수 있어요.</p>
    <details><summary>확인 코드</summary><code>{issue.code}{issue.providerStatus ? ' · Google HTTP ' + issue.providerStatus : ''}</code></details>
  </div>;
}
