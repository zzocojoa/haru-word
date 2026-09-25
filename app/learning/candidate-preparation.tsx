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
        이월 → 헷갈림 → 처음 순서 · 아는 단어는 후속 점검
      </p>
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
        여기까지 저장 · 홈으로
      </button>
    </section>
  );
}
