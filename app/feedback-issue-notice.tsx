'use client';
import { FEEDBACK_ISSUES, type FeedbackIssue, type FeedbackFailure } from '@/lib/feedback-issue';

export function FeedbackIssueNotice({ issue }: { issue: FeedbackIssue | null }) {
  if (!issue) return null;
  return <div role="alert" className="notice ai-feedback-issue" data-feedback-code={issue.code}>
    {issue.previous && <><strong>Google·Groq 점검을 마치지 못했어요</strong><Failure issue={issue.previous} /></>}
    <Failure issue={issue} />
    <p className="small-note">입력은 유지돼요. 자기 점검으로 계속할 수 있어요.</p>
  </div>;
}

function Failure({ issue }: { issue: FeedbackFailure }) {
  const [title, reason, action] = FEEDBACK_ISSUES[issue.code];
  const provider = issue.code.startsWith('groq_') ? 'Groq' : issue.code.startsWith('provider_') || issue.code === 'not_configured' ? 'Google' : '';
  return <div className="ai-feedback-failure">
    <strong>{title}</strong>
    <p>{reason}</p>
    <p>{action}</p>
    {issue.retryAfterSeconds && <p className="small-note">{provider} 재시도 대기 안내: {issue.retryAfterSeconds}초 · 같은 제공사에 자동 재요청하지 않아요.</p>}
    <details><summary>{provider ? provider + ' ' : ''}확인 코드</summary><code>{issue.code}{issue.providerStatus ? ` · ${provider || '사이트'} HTTP ${issue.providerStatus}` : ''}</code></details>
  </div>;
}
