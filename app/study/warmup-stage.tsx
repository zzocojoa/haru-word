"use client";
import { PartOfSpeechLabel } from '../grammar-terms';
import { canGradeIndependently } from "@/lib/study-availability";
import { Eye } from "lucide-react";
import type { StudySessionController } from "./use-study-session-controller";
type WarmupStageProps = Pick<
  StudySessionController,
  | "answer"
  | "revealed"
  | "setAnswer"
  | "busy"
  | "hint"
  | "warmup"
  | "revealWarmup"
> & {
  word: NonNullable<StudySessionController["word"]>;
  content: NonNullable<StudySessionController["content"]>;
};
export function WarmupStage({
  word,
  answer,
  revealed,
  setAnswer,
  content,
  busy,
  hint,
  warmup,
  revealWarmup,
}: WarmupStageProps) {
  return (
    <>
      <p className="muted">
        답을 보기 전에 이 단어의 뜻을 써 보세요.
      </p>
      <div className="word-stage">
        <h3 lang="en">{word.word}</h3>
        <span><PartOfSpeechLabel pos={word.pos} /></span>
      </div>
      <label>
        떠오르는 한국어 뜻
        <input
          value={answer}
          maxLength={2000}
          readOnly={revealed}
          onChange={(e) => setAnswer(e.target.value)}
          autoComplete="off"
        />
      </label>
      {revealed ? (
        <div className="answer-box">
          <b>{content.meaning}</b>
          <div className="button-row study-actions">
            <button
              className="secondary-button"
              disabled={!canGradeIndependently(busy, hint, answer)}
              onClick={() => warmup("independent")}
            >
              스스로 떠올렸어요
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => warmup("help")}
            >
              다시 볼게요
            </button>
          </div>
        </div>
      ) : (
        <button
          className="primary-button"
          disabled={busy}
          onClick={revealWarmup}
        >
          뜻 확인 <Eye size={17} />
        </button>
      )}
    </>
  );
}
