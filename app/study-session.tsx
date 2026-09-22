"use client";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { KIND_TEXT, reviewBatchEnd } from "@/lib/learning";
import { LearnStage } from "./study/learn-stage";
import { RecallStage } from "./study/recall-stage";
import { SentenceStage } from "./study/sentence-stage";
import { SessionCheckpoint } from "./study/session-checkpoint";
import { SessionSummary } from "./study/session-summary";
import type { StudySessionProps } from "./study/types";
import { useStudySessionController } from "./study/use-study-session-controller";
import { WarmupStage } from "./study/warmup-stage";
import { Clock } from "./ui";

const STAGES = {
  warmup: "기억 깨우기",
  learn: "단어 익히기",
  en: "영어 → 뜻",
  ko: "뜻 → 영어",
  sentence: "내 문장 만들기",
  checkpoint: "묶음 완료",
  done: "이번 회차 기록",
};
export function StudySession(props: StudySessionProps) {
  const {
    s,
    showSummary,
    saved,
    date,
    total,
    completed,
    seconds,
    words,
    onClose,
    onReview,
    busy,
    onRepeat,
    resume,
    state,
    pauseAndExit,
    word,
    content,
    boutStart,
    paused,
    toggleClock,
    focus,
    id,
    answer,
    revealed,
    setAnswer,
    hint,
    warmup,
    revealWarmup,
    meaning,
    setMeaning,
    example,
    translation,
    expression,
    expressionTranslation,
    setExpression,
    setExpressionTranslation,
    setExample,
    setTranslation,
    learn,
    revealAnswer,
    recall,
    aiPending,
    sentence,
    setSentence,
    spoken,
    setSpoken,
    notes,
    setNotes,
    storeBusy,
    setAiPending,
    storeFeedback,
    sentenceDone,
  } = useStudySessionController(props);
  if (s.finished || showSummary)
    return (
      <SessionSummary
        saved={saved}
        s={s}
        date={date}
        total={total}
        completed={completed}
        seconds={seconds}
        words={words}
        onClose={onClose}
        onReview={onReview}
        busy={busy}
        onRepeat={onRepeat}
        resume={resume}
        state={state}
      />
    );
  if (s.stage === "checkpoint")
    return (
      <SessionCheckpoint
        s={s}
        busy={busy}
        pauseAndExit={pauseAndExit}
        resume={resume}
      />
    );

  if (!word || !content)
    return (
      <section className="learning-panel">
        <h2>학습 항목을 찾지 못했어요.</h2>
        <button className="secondary-button" onClick={onClose}>
          홈으로
        </button>
      </section>
    );
  const recallStage = s.stage === "en" || s.stage === "ko";
  return (
    <section className="learning-panel session-panel">
      <div className="panel-top">
        <div className="stage-label">
          <span className="level-badge">
            {word.personal ? "개인 추가" : word.level}
          </span>
          <span>
            {s.practiceMode === "repeat" ? "다시 학습" : KIND_TEXT[s.kind]}
          </span>
        </div>
        <Clock
          seconds={seconds - boutStart}
          paused={paused}
          onToggle={toggleClock}
          disabled={busy}
        />
      </div>
      {s.date !== date && (
        <p className="small-note">
          {s.date}에 시작한 회차를 이어가고 있어요. 오늘 입력한 결과는 {date}{" "}
          연습으로 기록돼요.
        </p>
      )}
      <div className="session-step-row">
        <h2 ref={focus} tabIndex={-1}>
          {s.retryMode ? "다시 떠올리기" : STAGES[s.stage]}
        </h2>
        <span className="muted">
          {s.retryMode
            ? s.retry.length + "개 남음"
            : `${s.index + 1} / ${s.stage === "warmup" ? s.warmupIds.length : total}`}
        </span>
      </div>
      <ProgressBar
        aria-label="현재 학습 단계 진행률"
        className="session-progress"
        value={
          s.retryMode
            ? 90
            : (s.index / (s.stage === "warmup" ? s.warmupIds.length : total)) *
              100
        }
      />
      {s.kind === "daily" && (
        <ol className="phase-strip" aria-label="15분 학습 순서">
          {[
            ["warmup", "기억 3분"],
            ["learn", "익히기 6분"],
            ["en", "회상 3분"],
            ["sentence", "문장 3분"],
          ].map(([stage, label]) => (
            <li
              key={stage}
              aria-current={
                s.stage === stage || (stage === "en" && s.stage === "ko")
                  ? "step"
                  : undefined
              }
            >
              {label}
            </li>
          ))}
        </ol>
      )}
      {s.practiceMode === "repeat" && (
        <p className="small-note">
          {s.period}의 단어를 다시 학습해요. 원래 완료 기록은 그대로 보관합니다.
        </p>
      )}
      {s.kind === "monthly" && (
        <p className="small-note">
          전체 {total}개 · 이번 묶음 {reviewBatchEnd(s) - (s.batchStart || 0)}개
          · 문장은 선택 연습이에요.
        </p>
      )}
      {s.reviewEnd !== undefined && (
        <p className="small-note">
          새로 추가된 {s.ids.length - s.reviewEnd}개는 진행 중인 점검을 마친 뒤
          이어서 확인해요. 기존 답과 순서는 그대로예요.
        </p>
      )}
      {s.records[id!]?.historicalMeaningUnknown && (
        <p className="notice">
          당시 뜻이 남아 있지 않은 이전 기록이에요. 현재 단어장의 뜻을
          참고하므로 사전과 함께 확인해 주세요.
        </p>
      )}
      {seconds - boutStart >= 900 && (
        <p className="notice">
          이번 활동이 15분을 넘었어요. 오늘 종료로 저장한 뒤 다음에 이어가도
          좋아요.
        </p>
      )}

      {paused && (
        <div className="pause-overlay">
          <PauseMessage />
          <button
            className="primary-button"
            disabled={busy}
            onClick={toggleClock}
          >
            계속 학습하기
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={pauseAndExit}
          >
            저장하고 나가기
          </button>
        </div>
      )}
      {!paused && (
        <>
          {s.stage === "warmup" && (
            <WarmupStage
              word={word}
              answer={answer}
              revealed={revealed}
              setAnswer={setAnswer}
              content={content}
              busy={busy}
              hint={hint}
              warmup={warmup}
              revealWarmup={revealWarmup}
            />
          )}

          {s.stage === "learn" && (
            <LearnStage
              word={word}
              content={content}
              meaning={meaning}
              setMeaning={setMeaning}
              example={example}
              translation={translation}
              expression={expression}
              expressionTranslation={expressionTranslation}
              setExpressionTranslation={setExpressionTranslation}
              setExpression={setExpression}
              setExample={setExample}
              setTranslation={setTranslation}
              busy={busy}
              learn={learn}
            />
          )}
          {recallStage && (
            <RecallStage
              s={s}
              word={word}
              id={id}
              content={content}
              revealAnswer={revealAnswer}
              revealed={revealed}
              answer={answer}
              setAnswer={setAnswer}
              busy={busy}
              hint={hint}
              recall={recall}
            />
          )}
          {s.stage === "sentence" && (
            <SentenceStage
              word={word}
              s={s}
              id={id}
              content={content}
              aiPending={aiPending}
              sentence={sentence}
              setSentence={setSentence}
              spoken={spoken}
              setSpoken={setSpoken}
              notes={notes}
              setNotes={setNotes}
              storeBusy={storeBusy}
              setAiPending={setAiPending}
              storeFeedback={storeFeedback}
              busy={busy}
              sentenceDone={sentenceDone}
            />
          )}
          <div className="session-bottom">
            <span>
              {s.practiceMode === "repeat"
                ? "이전 성적은 유지하며, 이번에 어려웠던 항목은 다음 학습에 반영해요."
                : s.kind === "monthly"
                  ? "15개 안팎씩 나누어 이어갈 수 있어요."
                  : "미완료 항목은 다음 학습에 먼저 배정해요."}
            </span>
            <button
              className="text-button"
              disabled={busy}
              onClick={pauseAndExit}
            >
              오늘 종료 · 저장
            </button>
          </div>
        </>
      )}
    </section>
  );
}
function PauseMessage() {
  return (
    <div>
      <p className="eyebrow">TAKE A BREATH</p>
      <h2>잠시 쉬어 가요.</h2>
      <p className="muted">타이머가 멈췄어요. 준비되면 이어서 해요.</p>
    </div>
  );
}
