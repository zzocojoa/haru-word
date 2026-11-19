'use client';
import {HaruParagraph} from './haru-content';
import {HaruButton} from './haru-controls';

import { useEffect, useRef, useState } from 'react';
import type { SentenceFeedback } from '@/lib/sentence-feedback';
import { feedbackSafetyIssue } from '@/lib/feedback-safety';
import { compareCorrection, canConfirmCorrection, canUndoCorrection, type CorrectionComparison, type CorrectionUndo } from '@/lib/feedback-correction';
import { RecordText } from './record-text';

export function FeedbackCorrection({ feedback, sentence, busy = false, contextCurrent, onApply }: {
  feedback: SentenceFeedback; sentence: string; busy?: boolean; contextCurrent:boolean; onApply: (sentence: string) => void;
}) {
  const [comparison, setComparison] = useState<CorrectionComparison | null>(null);
  const [undo, setUndo] = useState<CorrectionUndo | null>(null);
  const applyButton = useRef<HTMLButtonElement>(null), undoButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<'apply' | 'undo' | null>(null);
  const safe = !feedbackSafetyIssue(feedback), available = safe && contextCurrent && !!feedback.correctedSentence && feedback.correctedSentence !== sentence.trim();
  useEffect(() => {
    const target = restoreFocus.current === 'undo' ? undoButton.current : restoreFocus.current === 'apply' ? applyButton.current : null;
    if (target) { target.focus(); restoreFocus.current = null; }
  }, [undo, comparison, available]);
  const validComparison = contextCurrent && !!comparison && canConfirmCorrection(sentence, feedback, comparison);
  function apply(before: string, after: string) {
    if (busy || !contextCurrent) return;
    restoreFocus.current = 'undo'; onApply(after); setUndo({ before, after }); setComparison(null);
  }
  function choose() {
    if (busy || !available) return;
    setComparison(compareCorrection(sentence, feedback));
  }
  if (!safe || (!available && !undo && !comparison)) return null;
  return <div className="feedback-correction-action">
    {available && <HaruButton label={["AI 제안으로 문장 바꾸기"].join('')} variant="ghost" ref={applyButton} type="button" className="haru-migrated text-button" disabled={busy} onClick={choose}>AI 제안으로 문장 바꾸기</HaruButton>}
    {comparison && <div className="notice" role="group" aria-label="교정 적용 확인">
      <HaruParagraph>내 문장과 AI 제안을 비교한 뒤 바꿔 주세요.</HaruParagraph>
      <HaruParagraph className="small-note">비교를 열었을 때의 내 문장</HaruParagraph><RecordText text={comparison.before} label="바꾸기 전 내 문장" lang="en" />
      <HaruParagraph className="small-note">적용할 AI 제안</HaruParagraph><RecordText text={comparison.after} label="적용할 AI 제안" lang="en" />
      {!validComparison && <HaruParagraph role="status">문장이나 제안이 바뀌었어요. 다시 비교해 주세요.</HaruParagraph>}
      <div className="grammar-actions">
        <HaruButton label={["비교한 제안으로 바꾸기"].join('')} variant="secondary" type="button" className="haru-migrated secondary-button" disabled={busy || !validComparison} onClick={() => {
          if (contextCurrent && comparison && canConfirmCorrection(sentence, feedback, comparison)) apply(comparison.before, comparison.after);
        }}>비교한 제안으로 바꾸기</HaruButton>
        {!validComparison && <HaruButton label={["다시 비교"].join('')} variant="ghost" type="button" className="haru-migrated text-button" disabled={busy} onClick={() => setComparison(compareCorrection(sentence, feedback))}>다시 비교</HaruButton>}
        <HaruButton label={["취소"].join('')} variant="ghost" type="button" className="haru-migrated text-button" onClick={() => { restoreFocus.current = 'apply'; setComparison(null); }}>취소</HaruButton>
      </div>
    </div>}
    {undo && <div>
      <HaruButton label={["교정 적용 되돌리기"].join('')} variant="ghost" ref={undoButton} type="button" className="haru-migrated text-button" disabled={busy || !canUndoCorrection(sentence, undo)} onClick={() => {
        if (busy || !canUndoCorrection(sentence, undo)) return;
        restoreFocus.current = 'apply'; onApply(undo.before); setUndo(null);
      }}>교정 적용 되돌리기</HaruButton>
      {!canUndoCorrection(sentence, undo) && <HaruParagraph className="small-note">이후에 편집한 문장을 유지해요. 바꾸기 전 문장은 아래에서 확인할 수 있어요.</HaruParagraph>}
      <details><summary>바꾸기 전 문장 확인</summary><RecordText text={undo.before} label="교정 적용 전 문장" lang="en" /></details>
    </div>}
  </div>;
}
