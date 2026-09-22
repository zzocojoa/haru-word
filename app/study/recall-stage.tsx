"use client";
import { POS } from "@/lib/learning";
import { ArrowRight } from "lucide-react";
import type { StudySessionController } from "./use-study-session-controller";
type RecallStageProps = Pick<
  StudySessionController,
  | "s"
  | "id"
  | "revealAnswer"
  | "revealed"
  | "answer"
  | "setAnswer"
  | "busy"
  | "hint"
  | "recall"
> & {
  word: NonNullable<StudySessionController["word"]>;
  content: NonNullable<StudySessionController["content"]>;
};
export function RecallStage({
  s,
  word,
  id,
  content,
  revealAnswer,
  revealed,
  answer,
  setAnswer,
  busy,
  hint,
  recall,
}: RecallStageProps) {
  return (
    <>
      <p className="muted">
        {s.stage === "en"
          ? "영어를 보고 한국어 뜻을 적어 보세요."
          : "한국어 뜻을 보고 영어를 써 보세요."}{" "}
        답을 보기 전에 먼저 떠올려요.
      </p>
      <div
        className={
          "word-stage recall " + (s.stage === "ko" ? "korean-cue" : "")
        }
      >
        <span className="word-index">{POS[word.pos]}</span>
        <h3 lang={s.stage === "en" ? "en" : "ko"}>
          {s.stage === "en"
            ? word.word
            : s.records[id!]?.meaning || content.meaning}
        </h3>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void revealAnswer();
        }}
      >
        <label className="sr-only" htmlFor="recall-answer">
          {s.stage === "en" ? "한국어 뜻 입력" : "영어 단어 입력"}
        </label>
        <input
          id="recall-answer"
          className="answer-input"
          readOnly={revealed}
          value={answer}
          maxLength={2000}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={
            s.stage === "en"
              ? "떠오르는 뜻을 적어 주세요"
              : "영어 단어를 적어 주세요"
          }
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        {!revealed && (
          <div className="button-row">
            <button type="submit" disabled={busy} className="primary-button">
              내 답 확인 <ArrowRight size={17} />
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => revealAnswer(true)}
            >
              생각이 안 나요
            </button>
          </div>
        )}
      </form>
      {revealed && (
        <div className="answer-box" aria-live="polite">
          <p className="eyebrow">정답과 비교해 보세요</p>
          <h3>
            {s.stage === "en"
              ? s.records[id!]?.meaning || content.meaning
              : word.word}
          </h3>
          <p className="small-note">
            의미와 품사가 맞는 다른 표현도 인정해요. 직접 비교하여 기록합니다.
            도움이 필요하면 다른 단어 두 개 뒤 다시 시도해요.
          </p>
          <div className="button-row">
            <button
              className="primary-button"
              disabled={busy || hint || !answer.trim()}
              onClick={() => recall("independent")}
            >
              도움 없이 맞혔어요
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => recall("help")}
            >
              도움이 필요했어요
            </button>
          </div>
          {hint && (
            <p className="small-note">
              답을 먼저 확인했으므로 이번 결과는 ‘도움 필요’로 기록해요.
            </p>
          )}
        </div>
      )}
      <button
        className="text-button skip"
        disabled={busy}
        onClick={() => recall("unmeasured")}
      >
        미측정으로 남기고 다음에
      </button>
    </>
  );
}
