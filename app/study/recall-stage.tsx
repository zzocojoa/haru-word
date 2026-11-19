"use client";
import {HaruParagraph,HaruHeading} from '../haru-content';
import {HaruButton,HaruTextInput} from '../haru-controls';

import { PartOfSpeechLabel } from '../grammar-terms';
import { canGradeIndependently } from "@/lib/study-availability";
import { HaruIcon } from "@/components/icons/haru-icon";
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
      {!revealed && <HaruParagraph className="muted">
        {s.stage === "en"
          ? "한국어 뜻을 먼저 써 보세요."
          : "영어 단어를 먼저 써 보세요."}
      </HaruParagraph>}
      <div
        className={
          "word-stage recall " + (s.stage === "ko" ? "korean-cue" : "")
        }
      >
        <span className="word-index"><PartOfSpeechLabel pos={word.pos} /></span>
        <HaruHeading level={3} lang={s.stage === "en" ? "en" : "ko"}>
          {s.stage === "en"
            ? word.word
            : s.records[id!]?.meaning || content.meaning}
        </HaruHeading>
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
        <HaruTextInput label={s.stage === "en" ? "한국어 뜻 입력" : "영어 단어 입력"} isLabelHidden containerClassName="haru-study-field recall-field" id="recall-answer"
          controlClassName="answer-input"
          readOnly={revealed}
          value={answer}
          maxLength={2000}
          onChange={(e) => setAnswer(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          hasSpellCheck={false} />
        {!revealed && (
          <div className="button-row study-actions">
            <HaruButton label={["내 답 확인 "].join('')} variant="primary" icon={<HaruIcon name="arrow-right" size={17} />} type="submit" disabled={busy} className="haru-migrated primary-button">
              내 답 확인
            </HaruButton>
            <HaruButton label={["생각이 안 나요"].join('')} variant="ghost"
              type="button"
              className="haru-migrated text-button"
              disabled={busy}
              onClick={() => revealAnswer(true)}
            >
              생각이 안 나요
            </HaruButton>
          </div>
        )}
      </form>
      {revealed && (
        <div className="answer-box" aria-live="polite">
          <HaruParagraph className="eyebrow">내 답과 비교해 보세요</HaruParagraph>
          <HaruHeading level={3}>
            {s.stage === "en"
              ? s.records[id!]?.meaning || content.meaning
              : word.word}
          </HaruHeading>
          <HaruParagraph className="small-note">
            뜻과 품사가 맞으면 다른 표현도 괜찮아요. 도움받은 단어는 잠시 뒤 다시 떠올려요.
          </HaruParagraph>
          <div className="button-row study-actions">
            <HaruButton label={["도움 없이 맞혔어요"].join('')} variant="primary"
              className="haru-migrated primary-button"
              disabled={!canGradeIndependently(busy, hint, answer)}
              onClick={() => recall("independent")}
            >
              도움 없이 맞혔어요
            </HaruButton>
            <HaruButton label={["도움이 필요했어요"].join('')} variant="secondary"
              className="haru-migrated secondary-button"
              disabled={busy}
              onClick={() => recall("help")}
            >
              도움이 필요했어요
            </HaruButton>
          </div>
          {hint && (
            <HaruParagraph className="small-note">
              답을 먼저 봐서 ‘도움 필요’로 기록해요.
            </HaruParagraph>
          )}
        </div>
      )}
      <HaruButton label={["이번에는 건너뛰기"].join('')} variant="ghost"
        className="haru-migrated text-button skip"
        disabled={busy}
        onClick={() => recall("unmeasured")}
      >
        이번에는 건너뛰기
      </HaruButton>
    </>
  );
}
