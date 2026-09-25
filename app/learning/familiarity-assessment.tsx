"use client";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { FAMILIARITY_TEXT, assessmentAdvice } from "@/lib/learning";
import { ArrowRight, Check } from "lucide-react";
import { FamiliarityCard } from "../familiarity-card";
import type { LearningViewProps } from "./types";
type FamiliarityAssessmentProps = Pick<
  LearningViewProps,
  | "state"
  | "busy"
  | "setAssessing"
  | "start"
  | "beginAssessment"
  | "save"
  | "setMessage"
  | "assessmentWord"
  | "revealMeaning"
  | "markFamiliarity"
> & { assessment: NonNullable<LearningViewProps["assessment"]> };
export function FamiliarityAssessment({
  state,
  assessment,
  busy,
  setAssessing,
  start,
  beginAssessment,
  save,
  setMessage,
  assessmentWord,
  revealMeaning,
  markFamiliarity,
}: FamiliarityAssessmentProps) {
  return (
    <section className="learning-panel">
      <div className="panel-top">
        <span className="eyebrow">01 · 나의 출발점</span>
        <span className="level-badge">{state.settings.level}</span>
      </div>
      {assessment.completed ? (
        <>
          <div className="success-icon">
            <Check />
          </div>
          <h2>나의 출발점을 찾았어요.</h2>
          <p className="muted">
            {assessmentAdvice(assessment, state.settings.level).text}
          </p>
          <div className="assessment-results">
            {(["known", "uncertain", "new"] as const).map((f) => (
              <div key={f}>
                <b>
                  {
                    Object.values(assessment.marks).filter((x) => x === f)
                      .length
                  }
                </b>
                <span>{FAMILIARITY_TEXT[f]}</span>
              </div>
            ))}
          </div>
          <p className="small-note">
            정식 CEFR 시험·말하기 판정이 아니에요. 같은 표시가 14개 이상이면 수준 조정을 제안해요.
          </p>
          <div className="button-row">
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => {
                setAssessing(false);
                void start("daily");
              }}
            >
              이 수준에서 학습하기 <ArrowRight size={17} />
            </button>
            {assessmentAdvice(assessment, state.settings.level).suggested !==
              state.settings.level && (
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() =>
                  beginAssessment(
                    assessmentAdvice(assessment, state.settings.level)
                      .suggested,
                  )
                }
              >
                다른 수준 확인
              </button>
            )}
          </div>
          {assessmentAdvice(assessment, state.settings.level).goal && (
            <div className="button-row batch-actions">
              {[1, 2].map((n) => (
                <button
                  className="secondary-button"
                  disabled={busy}
                  aria-pressed={state.settings.dailyGoal === n}
                  key={n}
                  onClick={() =>
                    save({
                      ...state,
                      settings: {
                        ...state.settings,
                        dailyGoal: n,
                      },
                    })
                  }
                >
                  하루 {n}개로 설정
                </button>
              ))}
            </div>
          )}
          <button
            className="text-button skip"
            onClick={() => {
              setAssessing(false);
              setMessage(
                "준비를 저장했어요. 다음 방문부터 일일 루틴을 시작하세요.",
              );
            }}
          >
            오늘은 준비만 마치기
          </button>
        </>
      ) : (
        <>
          <h2>뜻을 떠올리고, 확인해 보세요.</h2>
          <p className="muted">
            표시를 고른 뒤 뜻을 비교해요.
          </p>
          {assessmentWord && (
            <FamiliarityCard
              key={assessmentWord.id}
              word={assessmentWord}
              check={state.progress[assessmentWord.id]?.familiarityCheck}
              busy={busy}
              onReveal={(initial, answer) =>
                revealMeaning(assessmentWord.id, initial, answer)
              }
              onConfirm={markFamiliarity}
            />
          )}
          <div className="progress-caption">
            <span>정식 수준 시험이 아니에요</span>
            <span>
              {assessment.index} / {assessment.ids.length}
            </span>
          </div>
          <ProgressBar
            aria-label="친숙도 확인 진행률"
            value={(assessment.index / assessment.ids.length) * 100}
          />
          <button
            className="text-button skip"
            onClick={() => setAssessing(false)}
          >
            여기까지 저장 · 나중에 계속
          </button>
        </>
      )}
    </section>
  );
}
