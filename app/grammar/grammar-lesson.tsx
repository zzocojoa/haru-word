'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Lightbulb } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { exampleFocusStart, type GrammarLesson as Lesson } from '@/lib/grammar/content';
import { QUESTION_KEYS, combinedCheck, recordAnswer, recordObservationHelp, revealGrammarAnswer, updateGrammarSentence, type GrammarProgress } from '@/lib/grammar/model';
import { PRACTICE_LESSONS, lessonForVersion } from '@/lib/grammar/content-v2';
import { completeLesson, finishGrammarReview, questionsFor, startGrammarReview } from '@/lib/grammar/practice';
import { useGrammarDraft, type GrammarPersistence } from './use-grammar-draft';
import { useGrammarFeedback } from './use-grammar-feedback';
import { grammarStep } from './grammar-presentation';
import { GrammarQuestion } from './grammar-question';
import { GrammarWriting } from './grammar-writing';
import { GrammarSummary } from './grammar-summary';
import { GrammarReading } from './grammar-reading';
import { Speak } from '../ui';

type Props = { lesson: Lesson; enhanced?: boolean; persistence: GrammarPersistence; activityDate: () => string; onBack: () => void; onWords: () => void };

export function GrammarLesson({ lesson: originalLesson, enhanced = true, persistence, activityDate, onBack, onWords }: Props) {
  const lessonId = originalLesson.id;
  const { draft: progress, latest, change, flush, dirty, saving, error } = useGrammarDraft(lessonId, persistence, enhanced);
  const lesson = lessonForVersion(originalLesson, progress.contentVersion), practice = PRACTICE_LESSONS[lessonId];
  const { pending: aiPending, error: aiError, check: checkSentence, invalidate: invalidateAi } = useGrammarFeedback({
    lessonId: lesson.id, canSave: persistence.canSave, latest, change, flush,
  });
  const [notice, setNotice] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const step = grammarStep(progress);
  const { reviewing, index, answers, hints, selection } = step;
  const questions = questionsFor(lessonId, progress, reviewing);
  const question = questions[index], key = QUESTION_KEYS[index];
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [progress.stage, progress.review?.index, reviewing]);

  // Tabs stay mounted while hidden. Register one exit guard for internal,
  // outer-tab and settings navigation, not just unmount cleanup.
  const registerLeave = persistence.registerLeave;
  const prepareLeave = useCallback(async () => { invalidateAi(); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); return flush(); }, [invalidateAi, flush]);
  useEffect(() => registerLeave(prepareLeave), [registerLeave, prepareLeave]);
  async function leave(action: () => void) { if (await prepareLeave()) action(); }

  function move(stage: number) { change(value => ({ ...value, stage, order: undefined, choice: undefined })); }
  function setOrder(order: number[]) {
    change(value => reviewing ? { ...value, review: { ...value.review!, order } } : { ...value, order });
  }
  function answer(text: string) {
    const target = reviewing ? progress.review! : progress;
    const helped = hints.includes(key) || !!target.clues?.includes(key);
    change(value => reviewing
      ? { ...value, review: { ...value.review!, answers: { ...value.review!.answers, [key]: recordAnswer(value.review!.answers[key], text, helped) } } }
      : { ...value, answers: { ...value.answers, [key]: recordAnswer(value.answers[key], text, helped) } });
  }
  function reveal() { change(value => revealGrammarAnswer(value, key, reviewing)); }
  function clue() { change(value => {
    const target = reviewing ? value.review! : value, existing = target.answers[key];
    const patch = { clues: [...new Set([...(target.clues ?? []), key])], answers: existing ? { ...target.answers, [key]: { ...existing, helped: true } } : target.answers };
    return reviewing ? { ...value, review: { ...value.review!, ...patch } } : { ...value, ...patch };
  }); }
  function observationHelp(level: NonNullable<GrammarProgress['observationHelp']>) { change(value => recordObservationHelp(value, level)); }
  function nextQuestion() {
    if (reviewing) change(value => index === 2 ? finishGrammarReview(lessonId, value, activityDate()) : ({ ...value, review: { ...value.review!, index: index + 1, order: undefined, choice: undefined } }));
    else move(progress.stage + 1);
  }
  function changeSentence(sentence: string) {
    invalidateAi();
    change(value => updateGrammarSentence(value, sentence));
  }
  function moveFromWriting(stage: number) { invalidateAi(); move(stage); }
  async function complete() {
    change(value => completeLesson(value, activityDate()));
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
    {reviewing && progress.review?.contentVersion === 2 && <p className="small-note">{progress.review.mode === 'scheduled' ? '다른 날 다시 확인' : '추가 연습 · 복습 일정 유지'} · 세트 {progress.review.setId?.toUpperCase()}{progress.review.reused ? ' · 다시 만나는 문제' : ''}</p>}
    {!reviewing && progress.stage === 0 && (progress.contentVersion === 2 ? <GrammarReading practice={practice} progress={progress} disabled={!persistence.canSave}
      onHelp={observationHelp} onChoice={observationChoice => change(value => ({ ...value, observationChoice }))}
      onAnswer={text => change(value => ({ ...value, observation: recordAnswer(value.observation, text, !!value.observationHelp) }))}
      onNext={() => move(1)} /> : <div className="grammar-stage">
      <p className="grammar-question">{lesson.notice}</p>
      <Examples lesson={lesson} />
      <button className="secondary-button grammar-reveal" aria-expanded={notice} onClick={() => setNotice(value => !value)}>
        <Lightbulb size={18} aria-hidden="true" />{notice ? '설명 접기' : '생각한 뒤 설명 확인'}
      </button>
      {notice && <p className="grammar-message">{lesson.noticeAnswer}</p>}
      <button className="primary-button" disabled={!persistence.canSave} onClick={() => move(1)}>역할 알아보기<ArrowRight size={18} /></button>
    </div>)}
    {!reviewing && progress.stage === 1 && <div className="grammar-stage">
      <p className="grammar-role">{lesson.role}</p>
      <dl className="grammar-rules"><dt>놓이는 자리</dt><dd>{lesson.pattern}</dd>{progress.contentVersion === 2 && <><dt>흔한 실수</dt><dd>{practice.commonMistake}</dd></>}</dl>
      <details className="grammar-guide"><summary>{progress.contentVersion === 2 ? '더 비교해 보기' : '흔한 실수와 비교'}</summary><p>{lesson.mistake}</p>{progress.contentVersion === 2 && practice.extra && <p>{practice.extra}</p>}</details>
      <details className="grammar-guide"><summary>품사와 문장 속 역할</summary><p>품사는 단어의 종류, 주어·목적어는 문장 속 자리예요. I like music.에서 music은 명사이며 목적어예요.</p><p>15개는 Oxford 목록의 학습 표기예요. 관사는 한정사의 한 종류이고, 조동사는 동사와 연결해 익혀요.</p></details>
      <div className="grammar-actions">
        <button className="text-button" onClick={() => move(0)}>예문 다시 보기</button>
        <button className="primary-button" disabled={!persistence.canSave} onClick={() => move(2)}>3문제 연습<ArrowRight size={18} /></button>
      </div>
    </div>}
    {question && (reviewing || progress.stage >= 2 && progress.stage <= 4) && <GrammarQuestion
      key={`${question.id ?? reviewing}-${key}`} question={question} answer={answers[key]} hinted={hints.includes(key)} selection={selection}
      clued={(reviewing ? progress.review : progress)?.clues?.includes(key)} onClue={clue}
      choice={(reviewing ? progress.review : progress)?.choice} onChoice={choice => change(value => reviewing ? { ...value, review: { ...value.review!, choice } } : { ...value, choice })}
      onOrder={setOrder} onAnswer={answer} onHint={reveal} onNext={nextQuestion} disabled={!persistence.canSave}
    />}
    {!reviewing && progress.stage === 5 && <GrammarWriting
      lesson={lesson} progress={progress} canSave={persistence.canSave} aiPending={aiPending} aiError={aiError}
      onAi={() => void checkSentence()} onSentence={changeSentence}
      onCheck={check => change(value => ({ ...value, check }))}
      onChecks={(key, result) => change(value => { const checks = { ...value.checks, [key]: result }; return { ...value, checks, check: combinedCheck(checks) }; })}
      onFrame={frame => change(value => ({ ...value, frame }))}
      onExplain={() => moveFromWriting(1)} onComplete={() => void complete()}
    />}
    {!reviewing && progress.stage === 6 && <GrammarSummary
      lesson={lesson} progress={progress} dirty={dirty} error={error} canSave={persistence.canSave} date={activityDate()}
      onReview={() => change(value => enhanced ? startGrammarReview(lessonId, value, activityDate()) : { ...value, review: { index: 0, answers: {} } })}
      onWriting={() => moveFromWriting(5)} onWords={() => void leave(onWords)}
    />}
    <p className="small-note grammar-source">학습용 작성 예문 · <a href={lesson.reference} target="_blank" rel="noreferrer">설명 참고 자료</a></p>
  </section>;
}

function Examples({ lesson }: { lesson: Lesson }) {
  return <div className="grammar-examples">{lesson.examples.map(([en, ko, focus]) => {
    const start = exampleFocusStart(en, focus);
    return <div className="grammar-example" key={en}><p lang="en">{start < 0 ? en : <>{en.slice(0, start)}<mark>{focus}</mark>{en.slice(start + focus.length)}</>}</p><p>{ko}</p><Speak text={en} /></div>;
  })}<small>밑줄: 살펴볼 표현 · 학습용 작성 예문</small></div>;
}
