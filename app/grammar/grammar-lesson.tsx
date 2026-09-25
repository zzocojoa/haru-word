'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Lightbulb } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { exampleFocusStart, type GrammarLesson as Lesson } from '@/lib/grammar/content';
import { QUESTION_KEYS, recordAnswer, revealGrammarAnswer, updateGrammarSentence } from '@/lib/grammar/model';
import { useGrammarDraft, type GrammarPersistence } from './use-grammar-draft';
import { useGrammarFeedback } from './use-grammar-feedback';
import { grammarStep } from './grammar-presentation';
import { GrammarQuestion } from './grammar-question';
import { GrammarWriting } from './grammar-writing';
import { GrammarSummary } from './grammar-summary';

type Props = { lesson: Lesson; persistence: GrammarPersistence; onBack: () => void; onWords: () => void };

export function GrammarLesson({ lesson, persistence, onBack, onWords }: Props) {
  const { draft: progress, latest, change, flush, dirty, saving, error } = useGrammarDraft(lesson.id, persistence);
  const { pending: aiPending, error: aiError, check: checkSentence, invalidate: invalidateAi } = useGrammarFeedback({
    lessonId: lesson.id, canSave: persistence.canSave, latest, change, flush,
  });
  const [notice, setNotice] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const step = grammarStep(progress);
  const { reviewing, index, answers, hints, selection } = step;
  const questions = reviewing ? lesson.review : lesson.questions;
  const question = questions[index], key = QUESTION_KEYS[index];
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [progress.stage, progress.review?.index, reviewing]);

  // Tabs stay mounted while hidden. Register one exit guard for internal,
  // outer-tab and settings navigation, not just unmount cleanup.
  const registerLeave = persistence.registerLeave;
  const prepareLeave = useCallback(async () => { invalidateAi(); return flush(); }, [invalidateAi, flush]);
  useEffect(() => registerLeave(prepareLeave), [registerLeave, prepareLeave]);
  async function leave(action: () => void) { if (await prepareLeave()) action(); }

  function move(stage: number) { change(value => ({ ...value, stage, order: undefined })); }
  function setOrder(order: number[]) {
    change(value => reviewing ? { ...value, review: { ...value.review!, order } } : { ...value, order });
  }
  function answer(text: string) {
    change(value => reviewing
      ? { ...value, review: { ...value.review!, answers: { ...value.review!.answers, [key]: recordAnswer(value.review!.answers[key], text, hints.includes(key)) } } }
      : { ...value, answers: { ...value.answers, [key]: recordAnswer(value.answers[key], text, hints.includes(key)) } });
  }
  function reveal() { change(value => revealGrammarAnswer(value, key, reviewing)); }
  function nextQuestion() {
    if (reviewing) change(value => ({ ...value, review: { ...value.review!, index: index + 1, order: undefined, ...(index === 2 ? { completedAt: new Date().toISOString() } : {}) } }));
    else move(progress.stage + 1);
  }
  function changeSentence(sentence: string) {
    invalidateAi();
    change(value => updateGrammarSentence(value, sentence));
  }
  function moveFromWriting(stage: number) { invalidateAi(); move(stage); }
  async function complete() {
    change(value => ({ ...value, stage: 6, completedAt: new Date().toISOString() }));
    await flush();
  }

  return <section className="grammar-lesson" aria-label={`${lesson.title} 수업`}>
    <div className="grammar-toolbar">
      <button className="text-button" onClick={() => void leave(onBack)}><ArrowLeft size={18} />수업 목록</button>
      <span role="status" className="small-note">{error ? '저장 확인 필요' : saving ? '저장 중' : dirty ? '입력 보관 중' : '저장됨'}</span>
    </div>
    <div className="grammar-lesson-heading">
      <span className="level-badge">{lesson.pos}</span>
      <h2 ref={heading} tabIndex={-1} aria-label={`${lesson.title} · ${step.label}`}>{lesson.title}</h2>
      <span className="grammar-stage-label"><span className="grammar-phase-count">{step.phase + 1}/{step.steps.length} · </span>{step.label}</span>
    </div>
    <ol className="grammar-stepper" aria-label={reviewing ? '다시 확인 단계' : '수업 단계'}>{step.steps.map((label, index) =>
      <li key={label} aria-current={index === step.phase ? 'step' : undefined} data-done={index < step.phase}>
        <span aria-hidden="true">{index < step.phase ? <Check size={14} /> : index + 1}</span>{label}
      </li>
    )}</ol>
    <Progress className="grammar-progress" aria-label="수업 진행" value={step.percent} />
    {error && <div role="alert" className="grammar-message"><p>{error}</p><button className="secondary-button" disabled={saving || !persistence.canSave} onClick={() => void flush()}>다시 저장</button></div>}
    {!persistence.canSave && <p role="status" className="small-note">저장 상태를 확인한 뒤 계속할 수 있어요. 작성 중인 내용은 화면에 남아 있어요.</p>}
    {!reviewing && progress.stage === 0 && <div className="grammar-stage">
      <p className="grammar-question">{lesson.notice}</p>
      <Examples lesson={lesson} />
      <button className="secondary-button grammar-reveal" aria-expanded={notice} onClick={() => setNotice(value => !value)}>
        <Lightbulb size={18} aria-hidden="true" />{notice ? '설명 접기' : '생각한 뒤 설명 확인'}
      </button>
      {notice && <p className="grammar-message">{lesson.noticeAnswer}</p>}
      <button className="primary-button" disabled={!persistence.canSave} onClick={() => move(1)}>역할 알아보기<ArrowRight size={18} /></button>
    </div>}
    {!reviewing && progress.stage === 1 && <div className="grammar-stage">
      <p className="grammar-role">{lesson.role}</p>
      <dl className="grammar-rules"><dt>이렇게 써요</dt><dd>{lesson.pattern}</dd><dt>헷갈리기 쉬워요</dt><dd>{lesson.mistake}</dd></dl>
      <div className="grammar-actions">
        <button className="text-button" onClick={() => move(0)}>예문 다시 보기</button>
        <button className="primary-button" disabled={!persistence.canSave} onClick={() => move(2)}>3문제 연습<ArrowRight size={18} /></button>
      </div>
    </div>}
    {question && (reviewing || progress.stage >= 2 && progress.stage <= 4) && <GrammarQuestion
      key={`${reviewing}-${key}`} question={question} answer={answers[key]} hinted={hints.includes(key)} selection={selection}
      onOrder={setOrder} onAnswer={answer} onHint={reveal} onNext={nextQuestion} disabled={!persistence.canSave}
    />}
    {!reviewing && progress.stage === 5 && <GrammarWriting
      lesson={lesson} progress={progress} canSave={persistence.canSave} aiPending={aiPending} aiError={aiError}
      onAi={() => void checkSentence()} onSentence={changeSentence}
      onCheck={check => change(value => ({ ...value, check }))}
      onExplain={() => moveFromWriting(1)} onComplete={() => void complete()}
    />}
    {!reviewing && progress.stage === 6 && <GrammarSummary
      lesson={lesson} progress={progress} dirty={dirty} error={error} canSave={persistence.canSave}
      onReview={() => change(value => ({ ...value, review: { index: 0, answers: {} } }))}
      onWriting={() => moveFromWriting(5)} onWords={() => void leave(onWords)}
    />}
    <p className="small-note grammar-source">학습용 작성 예문 · <a href={lesson.reference} target="_blank" rel="noreferrer">설명 참고 자료</a></p>
  </section>;
}

function Examples({ lesson }: { lesson: Lesson }) {
  return <div className="grammar-examples">{lesson.examples.map(([en, ko, focus]) => {
    const start = exampleFocusStart(en, focus);
    return <div className="grammar-example" key={en}><p lang="en">{start < 0 ? en : <>{en.slice(0, start)}<mark>{focus}</mark>{en.slice(start + focus.length)}</>}</p><p>{ko}</p></div>;
  })}<small>밑줄: 살펴볼 표현 · 학습용 작성 예문</small></div>;
}
