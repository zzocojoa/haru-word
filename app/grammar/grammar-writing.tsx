'use client';
import { Check, Sparkles } from 'lucide-react';
import type { GrammarLesson } from '@/lib/grammar/content';
import type { GrammarProgress } from '@/lib/grammar/model';
import { GRAMMAR_TEXT, type SentenceFeedback } from '@/lib/sentence-feedback';
import { CHECK_TEXT, SELF_CHECKS, grammarFeedbackTone } from './grammar-presentation';

type Props = {
  lesson: GrammarLesson;
  progress: GrammarProgress;
  canSave: boolean;
  aiPending: boolean;
  aiError: string;
  onAi: () => void;
  onSentence: (sentence: string) => void;
  onCheck: (check: NonNullable<GrammarProgress['check']>) => void;
  onExplain: () => void;
  onComplete: () => void;
};

export function GrammarWriting({ lesson, progress, canSave, aiPending, aiError, onAi, onSentence, onCheck, onExplain, onComplete }: Props) {
  const { sentence, check, feedback } = progress;
  return <div className="grammar-stage">
    <p className="grammar-question">{lesson.writing}</p>
    <div className="grammar-example"><small>문장 틀</small><p lang="en">{lesson.stem}</p></div>
    <div className="grammar-writing-area">
      <label className="grammar-writing">내 문장<textarea lang="en" aria-describedby="grammar-sentence-count" maxLength={2000} rows={4}
        value={sentence} onChange={event => onSentence(event.target.value)} placeholder="내 생활에 맞는 문장을 써 보세요." /></label>
      <p id="grammar-sentence-count" className="small-note grammar-character-count">{sentence.length}/2,000자</p>
    </div>
    <div className="grammar-ai-action">
      <button className="secondary-button" disabled={aiPending || !sentence.trim() || !canSave} onClick={onAi}>
        <Sparkles size={18} aria-hidden="true" />{aiPending ? '문장을 점검하고 있어요' : 'AI로 문장 점검'}
      </button>
      <p className="small-note">선택 사항 · 문장을 Google에 보내요.<br />자기 점검만으로도 마칠 수 있어요.</p>
    </div>
    {aiError && <p role="alert" className="grammar-message">{aiError} 입력은 유지돼요. 자기 점검으로 계속할 수 있어요.</p>}
    {feedback && <Feedback feedback={feedback} sentence={sentence} onSentence={onSentence} />}
    <fieldset className="grammar-check">
      <legend>내가 점검하기</legend><p>{lesson.check}</p>
      {SELF_CHECKS.map(value => <label key={value}>
        <input type="radio" name={`grammar-check-${lesson.id}`} checked={check === value} onChange={() => onCheck(value)} />{CHECK_TEXT[value]}
      </label>)}
    </fieldset>
    <div className="grammar-actions">
      <button className="text-button" onClick={onExplain}>설명 다시 보기</button>
      <button className="primary-button" disabled={!sentence.trim() || !check || !canSave || aiPending} onClick={onComplete}>수업 마치기<Check size={18} /></button>
    </div>
  </div>;
}

function Feedback({ feedback, sentence, onSentence }: { feedback: SentenceFeedback; sentence: string; onSentence: Props['onSentence'] }) {
  const { meaningUsage, grammar, explanation, correctedSentence } = feedback;
  const meaningLabel = meaningUsage === 'appropriate' ? '목표 문법에 맞아요' : meaningUsage === 'needs_work' ? '목표 문법을 확인해요' : '목표 문법 판단이 어려워요';
  return <div className="grammar-feedback" data-tone={grammarFeedbackTone(feedback)}>
    <h3>AI 의견</h3><p>{meaningLabel} · {GRAMMAR_TEXT[grammar]}</p><p>{explanation}</p>
    {correctedSentence && <>
      <p lang="en">{correctedSentence}</p>
      {correctedSentence !== sentence && <button className="secondary-button" onClick={() => onSentence(correctedSentence)}>수정안 사용하기</button>}
    </>}
  </div>;
}
