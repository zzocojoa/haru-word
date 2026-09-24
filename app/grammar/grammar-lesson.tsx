'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { answerCorrect, exampleFocusStart, firstAnswerLabel, type GrammarLesson as Lesson, type GrammarQuestion } from '@/lib/grammar/content';
import { QUESTION_KEYS, recordAnswer, revealGrammarAnswer, updateGrammarSentence, type GrammarAnswer, type QuestionKey } from '@/lib/grammar/model';
import { sentenceFeedbackSchema, GRAMMAR_TEXT } from '@/lib/sentence-feedback';
import { requestJson, REQUEST_TIMEOUT_MS } from '@/lib/client-request';
import { useGrammarDraft, type GrammarPersistence } from './use-grammar-draft';

const steps = ['살펴보기', '이해하기', '연습 1', '연습 2', '연습 3', '써 보기', '정리하기'];
const CHECK_TEXT = { appropriate: '뜻과 형태를 확인했어요', needs_work: '아직 보완할 부분이 있어요', uncertain: '판단이 어려워요' };
export function GrammarLesson({ lesson, persistence, onBack, onWords }: { lesson: Lesson; persistence: GrammarPersistence; onBack: () => void; onWords: () => void }) {
  const { draft: p, latest, change, flush, dirty, saving, error } = useGrammarDraft(lesson.id, persistence);
  const [notice, setNotice] = useState(false), [aiPending, setAiPending] = useState(false), [aiError, setAiError] = useState('');
  const request = useRef<AbortController | null>(null), generation = useRef(0), aiLock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const reviewing = !!p.review && !p.review.completedAt;
  const index = reviewing ? p.review!.index : p.stage - 2;
  const questions = reviewing ? lesson.review : lesson.questions;
  const q = questions[index], key = QUESTION_KEYS[index];
  const answers = reviewing ? p.review!.answers : p.answers;
  const hints = (reviewing ? p.review!.hints : p.hints) ?? [];
  const selection = (reviewing ? p.review!.order : p.order) ?? [];
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [p.stage, p.review?.index, reviewing]);
  useEffect(() => () => { generation.current++; request.current?.abort(); }, []);
  const invalidateAi = useCallback(() => { generation.current++; request.current?.abort(); aiLock.current = false; setAiPending(false); setAiError(''); }, []);
  const registerLeave = persistence.registerLeave;
  const prepareLeave = useCallback(async () => { invalidateAi(); return flush(); }, [invalidateAi, flush]);
  // Tabs remain mounted while hidden. All exits, including parent navigation
  // and settings, must invalidate AI before waiting for pending draft saves.
  useEffect(() => registerLeave(prepareLeave), [registerLeave, prepareLeave]);
  function move(stage: number) { change(v => ({ ...v, stage, order: undefined })); }
  function setOrder(order: number[]) { change(v => reviewing ? { ...v, review: { ...v.review!, order } } : { ...v, order }); }
  function answer(value: string) {
    change(v => reviewing
      ? { ...v, review: { ...v.review!, answers: { ...v.review!.answers, [key]: recordAnswer(v.review!.answers[key], value, hints.includes(key)) } } }
      : { ...v, answers: { ...v.answers, [key]: recordAnswer(v.answers[key], value, hints.includes(key)) } });
  }
  function reveal() { change(v => revealGrammarAnswer(v, key, reviewing)); }
  function nextQuestion() {
    if (reviewing) change(v => ({ ...v, review: { ...v.review!, index: index + 1, order: undefined, ...(index === 2 ? { completedAt: new Date().toISOString() } : {}) } }));
    else move(p.stage + 1);
  }
  async function leave(action: () => void) { if (await prepareLeave()) action(); }
  async function ai() {
    if (aiLock.current || !persistence.canSave || !latest.current.sentence.trim()) return;
    aiLock.current = true; setAiPending(true); setAiError('');
    const id = ++generation.current, sentence = latest.current.sentence, controller = new AbortController(); request.current = controller;
    try {
      if (!await flush()) throw new Error('현재 문장을 먼저 저장해 주세요.');
      if (id !== generation.current || latest.current.sentence !== sentence) return;
      const result = await requestJson<{ feedback?: unknown; error?: string }>('/api/grammar-feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId: lesson.id, sentence }), signal: controller.signal,
      }, REQUEST_TIMEOUT_MS.feedback);
      if (id !== generation.current || latest.current.sentence !== sentence) return;
      if (!result.response.ok) throw new Error(result.data.error || 'AI 점검을 마치지 못했어요.');
      const feedback = sentenceFeedbackSchema.parse(result.data.feedback);
      if (feedback.original !== sentence) throw new Error('현재 문장의 점검 결과인지 확인하지 못했어요.');
      change(v => ({ ...v, feedback }));
    } catch (e) { if (id === generation.current && !controller.signal.aborted) setAiError(e instanceof Error ? e.message : 'AI 점검을 마치지 못했어요.'); }
    finally { if (id === generation.current) { aiLock.current = false; setAiPending(false); } }
  }
  return <section className="grammar-lesson" aria-label={`${lesson.title} 수업`}>
    <div className="grammar-toolbar"><button className="text-button" onClick={() => void leave(onBack)}><ArrowLeft size={18} />수업 목록</button><span role="status" className="small-note">{error ? '저장 확인 필요' : saving ? '저장 중' : dirty ? '입력 보관 중' : '저장됨'}</span></div>
    <div className="grammar-lesson-heading"><span className="level-badge">{lesson.pos}</span><h2 ref={heading} tabIndex={-1}>{lesson.title} · {reviewing ? `다시 확인 ${index + 1}/3` : steps[p.stage]}</h2></div>
    <Progress aria-label="수업 진행" value={reviewing ? index / 3 * 100 : p.stage / 6 * 100} />
    {error && <div role="alert" className="grammar-message"><p>{error}</p><button className="secondary-button" disabled={saving || !persistence.canSave} onClick={() => void flush()}>다시 저장</button></div>}
    {!persistence.canSave && <p role="status" className="small-note">저장 상태를 확인한 뒤 계속할 수 있어요. 작성 중인 내용은 화면에 남아 있어요.</p>}
    {!reviewing && p.stage === 0 && <div className="grammar-stage">
      <p className="grammar-question">{lesson.notice}</p>
      <Examples lesson={lesson} />
      <button className="secondary-button" aria-expanded={notice} onClick={() => setNotice(v => !v)}>{notice ? '설명 접기' : '생각한 뒤 설명 확인'}</button>
      {notice && <p className="grammar-message">{lesson.noticeAnswer}</p>}
      <button className="primary-button" disabled={!persistence.canSave} onClick={() => move(1)}>역할 알아보기<ArrowRight size={18} /></button>
    </div>}
    {!reviewing && p.stage === 1 && <div className="grammar-stage"><p className="grammar-role">{lesson.role}</p><dl className="grammar-rules"><dt>이렇게 써요</dt><dd>{lesson.pattern}</dd><dt>헷갈리기 쉬워요</dt><dd>{lesson.mistake}</dd></dl><div className="grammar-actions"><button className="text-button" onClick={() => move(0)}>예문 다시 보기</button><button className="primary-button" disabled={!persistence.canSave} onClick={() => move(2)}>3문제 연습<ArrowRight size={18} /></button></div></div>}
    {q && (reviewing || p.stage >= 2 && p.stage <= 4) && <Question key={`${reviewing}-${key}`} question={q} answer={answers[key]} hinted={hints.includes(key)} selection={selection} onOrder={setOrder} onAnswer={answer} onHint={reveal} onNext={nextQuestion} disabled={!persistence.canSave} />}
    {!reviewing && p.stage === 5 && <div className="grammar-stage">
      <p className="grammar-question">{lesson.writing}</p><div className="grammar-example"><p lang="en">{lesson.stem}</p><small>학습용 작성 예문 · 틀을 참고해 한 부분을 바꿔 보세요.</small></div>
      <label className="grammar-writing">내 문장<textarea lang="en" maxLength={2000} rows={4} value={p.sentence} onChange={e => { invalidateAi(); change(v => updateGrammarSentence(v, e.target.value)); }} placeholder="내 생활에 맞는 문장을 써 보세요." /></label>
      <p className="small-note">{p.sentence.length}/2,000자</p>
      <button className="secondary-button" disabled={aiPending || !p.sentence.trim() || !persistence.canSave} onClick={() => void ai()}>{aiPending ? '문장을 점검하고 있어요' : 'AI로 문장 점검'}</button>
      <p className="small-note">선택 사항 · 문장을 Google에 보내 점검해요. 자기 점검만으로 마칠 수 있어요.</p>
      {aiError && <p role="alert" className="grammar-message">{aiError} 입력은 유지돼요. 자기 점검으로 계속할 수 있어요.</p>}
      {p.feedback && <div className="grammar-feedback"><h3>AI 의견</h3><p>{p.feedback.meaningUsage === 'appropriate' ? '목표 문법에 맞아요' : p.feedback.meaningUsage === 'needs_work' ? '목표 문법을 확인해요' : '목표 문법 판단이 어려워요'} · {GRAMMAR_TEXT[p.feedback.grammar]}</p><p>{p.feedback.explanation}</p>{p.feedback.correctedSentence && <><p lang="en">{p.feedback.correctedSentence}</p>{p.feedback.correctedSentence !== p.sentence && <button className="secondary-button" onClick={() => { const text = p.feedback!.correctedSentence; invalidateAi(); change(v => updateGrammarSentence(v, text)); }}>수정안 사용하기</button>}</>}</div>}
      <fieldset className="grammar-check"><legend>내가 점검하기</legend><p>{lesson.check}</p>{Object.entries(CHECK_TEXT).map(([value, text]) => <label key={value}><input type="radio" name={`grammar-check-${lesson.id}`} checked={p.check === value} onChange={() => change(v => ({ ...v, check: value as typeof v.check }))} />{text}</label>)}</fieldset>
      <div className="grammar-actions"><button className="text-button" onClick={() => { invalidateAi(); move(1); }}>설명 다시 보기</button><button className="primary-button" disabled={!p.sentence.trim() || !p.check || !persistence.canSave || aiPending} onClick={async () => { change(v => ({ ...v, stage: 6, completedAt: new Date().toISOString() })); await flush(); }}>수업 마치기<Check size={18} /></button></div>
    </div>}
    {!reviewing && p.stage === 6 && <div className="grammar-stage">
      <p className="grammar-role" role="status">{dirty ? error ? '완료 기록을 저장해 주세요.' : '완료 기록을 저장하고 있어요.' : '수업을 마쳤어요.'}</p><p className="small-note">처음 답과 도움 사용을 따로 보관해요. 수업 완료가 숙달을 뜻하지는 않아요.</p>
      <ResultList questions={lesson.questions} answers={p.answers} title="처음 연습" />
      {p.review?.completedAt && <ResultList questions={lesson.review} answers={p.review.answers} title="최근 다시 확인" />}
      <div className="grammar-example"><p lang="en">{p.sentence}</p><small>자기 점검 · {p.check && CHECK_TEXT[p.check]}</small></div>
      <div className="grammar-actions"><button className="secondary-button" disabled={!persistence.canSave} onClick={() => change(v => ({ ...v, review: { index: 0, answers: {} } }))}><RotateCcw size={17} />다른 3문제로 확인</button><button className="text-button" onClick={() => { invalidateAi(); move(5); }}>내 문장 보완</button></div>
      <button className="primary-button" onClick={() => void leave(onWords)}>같은 품사의 단어 보기<ArrowRight size={18} /></button>
    </div>}
    <p className="small-note grammar-source">학습용 작성 예문 · <a href={lesson.reference} target="_blank" rel="noreferrer">설명 참고 자료</a></p>
  </section>;
}
function Examples({ lesson }: { lesson: Lesson }) {
  return <div className="grammar-examples">{lesson.examples.map(([en, ko, focus]) => {
    const start = exampleFocusStart(en, focus);
    return <div className="grammar-example" key={en}><p lang="en">{start < 0 ? en : <>{en.slice(0, start)}<mark>{focus}</mark>{en.slice(start + focus.length)}</>}</p><p>{ko}</p></div>;
  })}<small>밑줄: 살펴볼 표현 · 학습용 작성 예문</small></div>;
}
function Question({ question: q, answer, hinted, selection, onOrder, onAnswer, onHint, onNext, disabled }: { question: GrammarQuestion; answer?: GrammarAnswer; hinted: boolean; selection: number[]; onOrder: (v: number[]) => void; onAnswer: (v: string) => void; onHint: () => void; onNext: () => void; disabled: boolean }) {
  const selected = selection.filter(i => i < q.options.length), text = selected.map(i => q.options[i]).join(' ');
  return <div className="grammar-stage">
    {q.context && <div className="grammar-example"><p lang="en">{q.context}</p><p>{q.translation}</p></div>}
    <h3 className="grammar-question">{q.prompt}</h3>
    {q.kind === 'order' ? <><p>{q.translation}</p><div className="grammar-order-answer" aria-live="polite" lang="en">{text || '아래 조각을 선택해 문장을 만드세요.'}</div><div className="grammar-options">{q.options.map((option, i) => <button className="secondary-button" key={option} disabled={disabled || selected.includes(i)} onClick={() => onOrder([...selected, i])} lang="en">{option}</button>)}</div><div className="grammar-actions"><button className="text-button" disabled={disabled || !selected.length} onClick={() => onOrder(selected.slice(0, -1))}>마지막 조각 취소</button><button className="text-button" disabled={disabled || !selected.length} onClick={() => onOrder([])}>처음부터 놓기</button><button className="secondary-button" disabled={disabled || selected.length !== q.options.length} onClick={() => onAnswer(text)}>정답 확인</button></div></> : <div className="grammar-choices">{q.options.map(option => <button key={option} disabled={disabled} className={`secondary-button ${answer?.latest === option ? 'is-selected' : ''}`} onClick={() => onAnswer(option)}>{option}</button>)}</div>}
    <button className="text-button" disabled={disabled || hinted} onClick={onHint}>답을 보고 도움받기</button>
    {(answer || hinted) && <div className="grammar-feedback" role="status"><b>{answer ? answerCorrect(q, answer.latest) ? '이번 답은 맞아요.' : '다시 확인해 보세요.' : '답을 확인했어요.'}</b>{hinted && <p>답: <span>{q.answer}</span></p>}{answer && <p>처음 답: {answer.first} · {firstAnswerLabel(q, answer)}{answer.attempts > 1 ? ` · ${answer.attempts}번 시도` : ''}</p>}<p>{q.explanation}</p></div>}
    <button className="primary-button" disabled={disabled || !answer} onClick={onNext}>다음<ArrowRight size={18} /></button>
  </div>;
}
function ResultList({ questions, answers, title }: { questions: GrammarQuestion[]; answers: Partial<Record<QuestionKey, GrammarAnswer>>; title: string }) {
  return <div className="grammar-results"><h3>{title}</h3><ul>{questions.map((q, i) => { const a = answers[QUESTION_KEYS[i]]; return <li key={i}><span>{i + 1}. {firstAnswerLabel(q, a)}</span><p>{a && answerCorrect(q, a.latest) ? '최근 답을 확인했어요.' : q.explanation}</p></li>; })}</ul></div>;
}
