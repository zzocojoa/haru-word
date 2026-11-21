import {HaruParagraph} from './haru-content';
import type { ReactNode } from 'react';
import type { SentenceFeedback } from '@/lib/sentence-feedback';
import { FeedbackAttribution } from './feedback-attribution';
import { feedbackSafetyIssue } from '@/lib/feedback-safety';
import { TARGET_NEEDS_WORK_EXPLANATION, verifiedWithheldGrammarIssue } from '@/lib/verified-feedback-explanation';
import { FeedbackSafetyNotice } from './feedback-safety-notice';
import { RecordText } from './record-text';
import { clarificationQuestion } from '@/lib/judgment-policy';

// Read-only output: history must not depend on request hooks or write commands.
const TARGET_OPINION_TEXT = { appropriate: '수정 제안 없음', needs_work: '보완 필요', uncertain: '문맥 확인 필요' };
const GRAMMAR_OPINION_TEXT = { natural: '수정 제안 없음', needs_work: '보완 필요', uncertain: '판단 어려움' };
const LEGACY_TARGET_NEEDS_WORK_LINE = '목표: AI는 목표 뜻·용법을 별도로 확인할 필요가 있다고 보았어요.';
const GENERIC_CORRECTION_LINE = '교정: 실제 바뀐 표현을 비교해 주세요. 이 변경에 대한 세부 문법 규칙은 확인된 범위를 넘어 단정하지 않아요.';
const GRAMMAR_COMPARISON_PROMPT = ' 아래의 원문과 교정문을 비교해 주세요.';

export function FeedbackDetail({ feedback, suggestionAction, grammarTarget = false, compact = false }: {
  feedback: SentenceFeedback;
  suggestionAction?: ReactNode;
  grammarTarget?: boolean;
  compact?: boolean;
}) {
  const safetyIssue = feedbackSafetyIssue(feedback);
  if (safetyIssue) return <FeedbackSafetyNotice reason={safetyIssue} />;
  const contextPrefix = '추가 문맥: ';
  const explanationLines = feedback.explanation.split(/\r?\n/);
  const legacyTargetLine = feedback.validationVersion === 'judgment-v6' && feedback.meaningUsage === 'needs_work'
    ? explanationLines.indexOf(LEGACY_TARGET_NEEDS_WORK_LINE) : -1;
  if (legacyTargetLine >= 0) explanationLines[legacyTargetLine] = `목표: ${TARGET_NEEDS_WORK_EXPLANATION}`;
  const visibleExplanation = legacyTargetLine >= 0 ? explanationLines.join('\n') : feedback.explanation;
  const compactExplanation = compact ? explanationLines
    .filter(line => line.trim() !== GENERIC_CORRECTION_LINE)
    .map(line => line.startsWith('문법: ') ? line.replace(GRAMMAR_COMPARISON_PROMPT, '') : line)
    .join('\n').trim() : '';
  const question = explanationLines.find(line => line.startsWith(contextPrefix))?.slice(contextPrefix.length) ?? '';
  const knownIssue = ['judgment-v6', 'judgment-v7', 'judgment-v8', 'judgment-v9', 'judgment-v10'].includes(feedback.validationVersion ?? '')
    ? verifiedWithheldGrammarIssue(feedback, feedback.original, question) : undefined;
  const correction = feedback.correctedSentence.trim();
  const incomplete = ['judgment-v7','judgment-v8'].includes(feedback.validationVersion??'') && feedback.grammar === 'needs_work' && !correction &&
    [clarificationQuestion('message'), clarificationQuestion('relationship')].includes(question);
  const withheldRepair = ['judgment-v9','judgment-v10'].includes(feedback.validationVersion??'') && feedback.grammar === 'needs_work' && !correction && !!question;
  const ratings = <div className="feedback-assessments"><span>{grammarTarget ? '수업 목표' : '뜻·용법'} · {TARGET_OPINION_TEXT[feedback.meaningUsage]}</span><span>문법 · {incomplete ? '문장 미완성' : knownIssue ? '형태 오류 확인' : GRAMMAR_OPINION_TEXT[feedback.grammar]}</span>{(knownIssue || withheldRepair) && <span>교정 · 문맥 확인 필요</span>}{incomplete && <span>교정 · 완성할 내용 필요</span>}</div>;
  const issueDetail = knownIssue && !explanationLines.some(line => line.startsWith(`문법: ${knownIssue}`)) && <HaruParagraph className="small-note">{knownIssue}</HaruParagraph>;
  if (compact) return <section className="ai-feedback-result">
    <HaruParagraph className="small-note">정답 판정은 아니에요</HaruParagraph>
    {ratings}
    {correction && correction !== feedback.original.trim() && <>
      <HaruParagraph className="small-note">교정 제안</HaruParagraph>
      <HaruParagraph lang="en" className="corrected-sentence feedback-record">{feedback.correctedSentence}</HaruParagraph>
    </>}
    {suggestionAction}
    <details className="notes-details">
      <summary>결과 상세</summary>
      {issueDetail}
      <HaruParagraph className="small-note">AI에 보낸 문장</HaruParagraph>
      <HaruParagraph lang="en" className="feedback-record">{feedback.original}</HaruParagraph>
      {feedback.contextNote && <>
        <HaruParagraph className="small-note">{['reference-v9','reference-v10','reference-v11','reference-v12','reference-v13'].includes(feedback.promptVersion??'') ? 'AI에 보낸 한국어 문장' : '이 의견에 전달한 문맥'}</HaruParagraph>
        <HaruParagraph className="feedback-record">{feedback.contextNote}</HaruParagraph>
      </>}
      {compactExplanation && <HaruParagraph className="feedback-record">{compactExplanation}</HaruParagraph>}
      <FeedbackAttribution feedback={feedback} showCaution={false} />
    </details>
  </section>;
  return <div className="ai-feedback-result">
    <HaruParagraph className="small-note"><strong>AI 참고 의견 · 정답 판정은 아니에요</strong></HaruParagraph>
    {ratings}
    {issueDetail}
    {grammarTarget&&['judgment-v4','judgment-v5','judgment-v6','judgment-v7','judgment-v8','judgment-v9','judgment-v10'].includes(feedback.validationVersion??'')&&<HaruParagraph className="small-note">수업 목표는 해당 표현을 알맞게 사용했는지에 대한 의견이에요.</HaruParagraph>}
    <HaruParagraph className="small-note">AI에 보낸 문장</HaruParagraph><div className="feedback-record"><RecordText text={feedback.original} label="AI에 보낸 문장" lang="en" /></div>
    {correction && correction !== feedback.original.trim() && <><HaruParagraph className="small-note">AI 교정 제안</HaruParagraph><div className="corrected-sentence feedback-record"><RecordText text={feedback.correctedSentence} label="AI 교정 제안" lang="en" /></div></>}
    {suggestionAction}
    {['judgment-v3','judgment-v4','judgment-v5','judgment-v6','judgment-v7','judgment-v8','judgment-v9','judgment-v10'].includes(feedback.validationVersion??'')&&<HaruParagraph className="small-note">교정 참고 설명은 검토한 규칙 범위에서 제공해요.</HaruParagraph>}
    <div className="feedback-record"><RecordText text={visibleExplanation} label={['judgment-v3','judgment-v4','judgment-v5','judgment-v6','judgment-v7','judgment-v8','judgment-v9','judgment-v10'].includes(feedback.validationVersion??'')?'판정·교정 참고':'AI 설명'} /></div>
    <FeedbackAttribution feedback={feedback} showCaution={false} />
  </div>;
}
