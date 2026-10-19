'use client';
import { FEEDBACK_ISSUES, type FeedbackIssue, type FeedbackFailure } from '@/lib/feedback-issue';
import { FEEDBACK_GUIDANCE } from '@/lib/feedback-issue-display';

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
  const guidance = FEEDBACK_GUIDANCE[issue.code];
  const uncertain = /(?:timeout|network)$/.test(issue.code);
  const provider = issue.code.startsWith('groq_') ? 'Groq' : issue.code.startsWith('provider_') || issue.code === 'not_configured' ? 'Google' : '';
  return <div className="ai-feedback-failure">
    {guidance ? <p>{guidance}</p> : <><strong>{title}</strong><p>{reason}</p><p>{action}</p></>}
    {uncertain && <p className="small-note">자동으로 재요청하지 않아요. 이전 요청이 사용량에 포함될 수 있어요.</p>}
    {issue.retryAfterSeconds && <p className="small-note">{provider} 재시도 대기 안내: {issue.retryAfterSeconds}초 후 다시 요청할 수 있어요. 자동으로 재요청하지 않아요.</p>}
    <details><summary>{provider ? provider + ' ' : ''}오류 상세</summary><code>{issue.code}{issue.providerStatus ? ` · ${provider || '사이트'} HTTP ${issue.providerStatus}` : ''}</code>{guidance && <><p>{title} · {reason}</p><p>{action}</p></>}</details>
  </div>;
}
