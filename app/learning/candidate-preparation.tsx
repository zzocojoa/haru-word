"use client";
import { confirmFamiliarity } from "@/lib/learning";
import { ArrowRight } from "lucide-react";
import { FamiliarityCard } from "../familiarity-card";
import type { LearningController } from "./use-learning-controller";
type CandidatePreparationProps = Pick<
  LearningController,
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
      <p className="eyebrow">TODAY’S WORDS</p>
      <h2>
        {candidate
          ? "오늘 후보의 친숙도를 확인해요."
          : "오늘의 목표를 정했어요."}
      </h2>
      <p className="muted">
        이월 → 헷갈림 → 처음 순서예요. 아는 단어는 새 목표에서 제외하고 후속
        점검에 남겨요.
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
