"use client";
import { confirmFamiliarity } from "@/lib/learning";
import { ArrowRight } from "lucide-react";
import { FamiliarityCard } from "../familiarity-card";
import type { LearningViewProps } from "./types";
type CandidatePreparationProps = Pick<
  LearningViewProps,
  | "candidate"
  | "state"
  | "busy"
  | "revealMeaning"
  | "save"
  | "suggestions"
  | "words"
  | "start"
  | "setPreparing"
>;
export function CandidatePreparation({
  candidate,
  state,
  busy,
  revealMeaning,
  save,
  suggestions,
  words,
  start,
  setPreparing,
}: CandidatePreparationProps) {
  return (
    <section className="learning-panel">
      <h2>
        {candidate
          ? "이 단어, 얼마나 익숙한가요?"
          : "오늘 단어 준비 완료"}
      </h2>
      <p className="muted">
        복습할 단어와 익숙하지 않은 단어부터 준비해요.
      </p>
      <details className="notes-details"><summary>단어 준비 순서</summary><p>이월한 단어, 뜻이 헷갈리는 단어, 처음 보는 단어 순서로 준비해요. 아는 단어도 나중에 다시 확인해요.</p></details>
      {candidate ? (
        <FamiliarityCard
          key={candidate.id}
          word={candidate}
          check={state.progress[candidate.id]?.familiarityCheck}
          busy={busy}
          onReveal={(initial, answer) =>
            revealMeaning(candidate.id, initial, answer)
          }
          onConfirm={(f) =>
            save({
              ...state,
              progress: {
                ...state.progress,
                [candidate.id]: confirmFamiliarity(
                  state.progress[candidate.id],
                  f,
                ),
              },
            })
          }
        />
      ) : (
        <>
          <p className="prepared-words">
            {suggestions
              .map((id) => words.find((w) => w.id === id)?.word)
              .join(" · ")}
          </p>
          <button
            className="primary-button full"
            disabled={busy || !suggestions.length}
            onClick={() => start("daily")}
          >
            이 단어들로 시작 <ArrowRight size={17} />
          </button>
        </>
      )}
      <button className="text-button skip" onClick={() => setPreparing(false)}>
        학습 홈으로
      </button>
    </section>
  );
}
