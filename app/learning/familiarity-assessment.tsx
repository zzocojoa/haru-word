"use client";
import {HaruPanel,HaruHeading,HaruParagraph} from '../haru-content';
import {HaruButton} from '../haru-controls';

import { HaruProgress as ProgressBar } from "../haru-controls";
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
  const check = assessmentWord ? state.progress[assessmentWord.id]?.familiarityCheck : undefined;
  return (
    <HaruPanel className="learning-panel">
      <div className="panel-top">
        <span className="level-badge">{state.settings.level}</span>
      </div>
      {assessment.completed ? (
        <>
          <div className="success-icon">
            <Check />
          </div>
          <HaruHeading level={2}>친숙도를 확인했어요</HaruHeading>
          <HaruParagraph className="muted">
            {assessmentAdvice(assessment, state.settings.level).text}
          </HaruParagraph>
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
          <HaruParagraph className="small-note">
            정식 수준 시험은 아니에요. 결과를 참고해 학습 수준을 골라 주세요.
          </HaruParagraph>
          <details className="notes-details"><summary>수준 추천 기준</summary><HaruParagraph>같은 표시가 14개 이상이면 수준 조정을 제안해요. 정식 CEFR 시험이나 말하기 판정은 아니에요.</HaruParagraph></details>
          <div className="button-row">
            <HaruButton label={["이 수준에서 학습하기 "].join('')} variant={'primary'}
              className="haru-migrated primary-button"
              disabled={busy}
              onClick={() => {
                setAssessing(false);
                void start("daily");
              }}
             endContent={<ArrowRight size={17} />}>
              이 수준에서 학습하기
            </HaruButton>
            {assessmentAdvice(assessment, state.settings.level).suggested !==
              state.settings.level && (
              <HaruButton label={["다른 수준 확인"].join('')} variant={'secondary'}
                className="haru-migrated secondary-button"
                disabled={busy}
                onClick={() =>
                  beginAssessment(
                    assessmentAdvice(assessment, state.settings.level)
                      .suggested,
                  )
                }
              >
                다른 수준 확인
              </HaruButton>
            )}
          </div>
          {assessmentAdvice(assessment, state.settings.level).goal && (
            <div className="button-row batch-actions">
              {[1, 2].map((n) => (
                <HaruButton label={["하루 ",(n),"개로 설정"].join('')} variant={'secondary'}
                  className="haru-migrated secondary-button"
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
                </HaruButton>
              ))}
            </div>
          )}
          <HaruButton label={["저장하고 나가기"].join('')} variant={'ghost'}
            className="haru-migrated text-button skip"
            disabled={busy}
            onClick={async () => {
              if (await save(state)) {
                setAssessing(false);
                setMessage("친숙도 확인을 마쳤어요. 원할 때 오늘 학습을 시작하세요.");
              }
            }}
          >
            저장하고 나가기
          </HaruButton>
        </>
      ) : (
        <>
          <HaruHeading level={2}>친숙도 확인</HaruHeading>
          {assessmentWord && (!check || check.final) && (
            <HaruParagraph className="muted">표시를 고르면 뜻을 볼 수 있어요.</HaruParagraph>
          )}
          {assessmentWord && (
            <FamiliarityCard
              key={assessmentWord.id}
              word={assessmentWord}
              check={check}
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
          <HaruButton label={["나중에 이어 하기"].join('')} variant={'ghost'}
            className="haru-migrated text-button skip"
            onClick={() => setAssessing(false)}
          >
            나중에 이어 하기
          </HaruButton>
        </>
      )}
    </HaruPanel>
  );
}
