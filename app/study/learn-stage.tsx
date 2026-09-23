"use client";
import { POS } from "@/lib/learning";
import { ArrowRight, BookOpen, PencilLine } from "lucide-react";
import { DictionaryLinks, Speak } from "../ui";
import { ExpressionLine } from "../expression-line";
import { ExpressionFields } from "../expression-fields";
import type { StudySessionController } from "./use-study-session-controller";
type LearnStageProps = Pick<
  StudySessionController,
  | "meaning"
  | "setMeaning"
  | "example"
  | "translation"
  | "expression"
  | "expressionTranslation"
  | "setExpression"
  | "setExpressionTranslation"
  | "setExample"
  | "setTranslation"
  | "busy"
  | "learn"
  | "materialConflict"
  | "useLibraryMaterial"
> & {
  word: NonNullable<StudySessionController["word"]>;
  content: NonNullable<StudySessionController["content"]>;
};
export function LearnStage({
  word,
  content,
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
  busy,
  learn,
  materialConflict,
  useLibraryMaterial,
}: LearnStageProps) {
  return (
    <>
      <div className="word-stage compact">
        <span className="word-index">
          {word.personal
            ? "MY VOCABULARY"
            : `OXFORD ${word.level} · ${POS[word.pos]}`}
        </span>
        <h3 lang="en">
          {word.word}
          <Speak text={word.word} />
        </h3>
        {content.ipa && <span className="phonetic">{content.ipa}</span>}
      </div>
      <div className="meaning-section">
        <label htmlFor="study-meaning">
          오늘 공부할 뜻 <span className="muted">하나만 골라요</span>
        </label>
        <input
          id="study-meaning"
          value={meaning}
          maxLength={2000}
          onChange={(e) => setMeaning(e.target.value)}
          placeholder="영한사전에서 확인한 한국어 뜻"
        />
        <p className="small-note">
          참고 풀이에서 오늘의 품사에 맞는 뜻 하나를 확인해 주세요.
        </p>
      </div>
      <div className="example-box">
        <div className="example-label">
          <BookOpen size={15} />
          <span>{content.source}</span>
        </div>
        <p lang="en">
          {example || "사전에서 예문을 확인하고 아래에 기록해 주세요."}
        </p>
        <p className="translation">{translation}</p>
        {content.attribution && (
          <a
            className="source-credit"
            href={content.url}
            target="_blank"
            rel="noreferrer"
          >
            {content.attribution}
          </a>
        )}
      </div>
      <details className="notes-details">
        <summary>
          <PencilLine size={15} /> 표현·예문 수정하기
        </summary>
        <ExpressionFields expression={expression} expressionTranslation={expressionTranslation}
          onExpressionChange={setExpression} onTranslationChange={setExpressionTranslation}
          help="표현이나 학습 뜻을 바꾸면 기존 표현 해석은 지워져요. 새 표현에 맞게 입력해 주세요." />
        <label>
          영어 예문
          <textarea
            value={example}
            maxLength={2000}
            onChange={(e) => setExample(e.target.value)}
          />
        </label>
        <label>
          예문의 한국어 해석
          <textarea
            value={translation}
            maxLength={2000}
            onChange={(e) => setTranslation(e.target.value)}
          />
        </label>
      </details>
      <ExpressionLine expression={expression} translation={expressionTranslation} />
      <DictionaryLinks word={word.word} />
      {!word.personal && (
        <a
          className="source-credit"
          href={`/sources/oxford-source.pdf#page=${word.page}`}
          target="_blank"
          rel="noreferrer"
        >
          공식 목록 {word.page}쪽 · {word.level} · {POS[word.pos]}
        </a>
      )}
      {materialConflict && <div className="notice" role="alert">
        <p>단어장에서 같은 자료가 바뀌었어요. 최신 내용을 불러온 뒤 다시 수정해 주세요.</p>
        <button className="secondary-button" disabled={busy} onClick={useLibraryMaterial}>단어장 최신 내용 적용</button>
      </div>}
      <div className="study-actions"><button
        className="primary-button full"
        disabled={busy || !meaning.trim()}
        onClick={learn}
      >
        뜻을 확인했어요 <ArrowRight size={17} />
      </button></div>
      <p className="small-note">
        음성은 기기의 미국식 영어 음성입니다. 사전 발음과 함께 확인하세요.
      </p>
    </>
  );
}
