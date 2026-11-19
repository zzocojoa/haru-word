"use client";
import {HaruParagraph,HaruHeading} from '../haru-content';
import {HaruButton,HaruTextInput} from '../haru-controls';

import { PartOfSpeechLabel } from '../grammar-terms';
import { canGradeIndependently } from "@/lib/study-availability";
import { HaruIcon } from "@/components/icons/haru-icon";
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
      <HaruParagraph className="muted">
        답을 보기 전에 이 단어의 뜻을 써 보세요.
      </HaruParagraph>
      <div className="word-stage">
        <HaruHeading level={3} lang="en">{word.word}</HaruHeading>
        <span><PartOfSpeechLabel pos={word.pos} /></span>
      </div>
      <HaruTextInput label={"떠오르는 한국어 뜻"} containerClassName="haru-study-field labelled-study-field" value={answer}
          maxLength={2000}
          readOnly={revealed}
          onChange={(e) => setAnswer(e.target.value)}
          autoComplete="off" />
      {revealed ? (
        <div className="answer-box">
          <b>{content.meaning}</b>
          <div className="button-row study-actions">
            <HaruButton label={["스스로 떠올렸어요"].join('')} variant="secondary"
              className="haru-migrated secondary-button"
              disabled={!canGradeIndependently(busy, hint, answer)}
              onClick={() => warmup("independent")}
            >
              스스로 떠올렸어요
            </HaruButton>
            <HaruButton label={["다시 볼게요"].join('')} variant="secondary"
              className="haru-migrated secondary-button"
              disabled={busy}
              onClick={() => warmup("help")}
            >
              다시 볼게요
            </HaruButton>
          </div>
        </div>
      ) : (
        <HaruButton label={["뜻 확인 "].join('')} variant="primary" endContent={<HaruIcon name="eye" size={17} />}
          className="haru-migrated primary-button"
          disabled={busy}
          onClick={revealWarmup}
        >
          뜻 확인
        </HaruButton>
      )}
    </>
  );
}
