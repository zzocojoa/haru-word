"use client";
import { GrammarTermsHelp, PartOfSpeechLabel } from '../grammar-terms';
import { Check } from "lucide-react";
import { SentenceFeedbackPanel } from "../sentence-feedback";
import { DictionaryLinks } from "../ui";
import { WordIpa, WordPronunciation } from '../word-pronunciation';
import type { StudySessionController } from "./use-study-session-controller";
type SentenceStageProps = Pick<
  StudySessionController,
  | "s"
  | "id"
  | "aiPending"
  | "sentence"
  | "setSentence"
  | "spoken"
  | "setSpoken"
  | "notes"
  | "setNotes"
  | "storeBusy"
  | "setAiPending"
  | "storeFeedback"
  | "busy"
  | "sentenceDone"
> & {
  word: NonNullable<StudySessionController["word"]>;
  content: NonNullable<StudySessionController["content"]>;
};
export function SentenceStage({
  word,
  s,
  id,
  content,
  aiPending,
  sentence,
  setSentence,
  spoken,
  setSpoken,
  notes,
  setNotes,
  storeBusy,
  setAiPending,
  storeFeedback,
  busy,
  sentenceDone,
}: SentenceStageProps) {
  const selectedMeaning = s.records[id!]?.meaning ?? content.meaning;
  return (
    <>
      <p className="muted">내 이야기로 한 문장을 써 보세요.</p>
      <div className="sentence-target">
        <h3 lang="en">
          {word.word}
        </h3>
        <WordIpa word={word} meaning={selectedMeaning}/>
        <span>
          <PartOfSpeechLabel pos={word.pos} /> · {selectedMeaning}
        </span>
      </div>
      <WordPronunciation word={word} meaning={selectedMeaning} showIpa={false}/>
      <GrammarTermsHelp pos={word.pos} />
      <label htmlFor="my-sentence">내 영어 문장</label>
      <textarea
        id="my-sentence"
        readOnly={aiPending}
        value={sentence}
        maxLength={2000}
        onChange={(e) => setSentence(e.target.value)}
        placeholder="오늘 있었던 일이나 평소 하는 일을 써 보세요."
        rows={3}
      />
      <label className="check-label">
        <input
          type="checkbox"
          checked={spoken}
          disabled={aiPending}
          onChange={(e) => setSpoken(e.target.checked)}
        />{" "}
        내 문장을 소리 내어 말해 봤어요
      </label>
      <label htmlFor="sentence-note">
        보완할 점 <span className="muted">선택</span>
      </label>
      <input
        id="sentence-note"
        readOnly={aiPending}
        value={notes}
        maxLength={2000}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="예: 전치사 확인하기, 과거형으로 바꾸기"
      />
      <SentenceFeedbackPanel
        key={`${s.id}:${id}`}
        sessionId={s.id}
        entryId={id!}
        sentence={sentence}
        feedback={s.records[id!]?.aiFeedback}
        busy={storeBusy}
        onPending={setAiPending}
        onFeedback={storeFeedback}
        onUse={setSentence}
      />
      <details className="notes-details">
        <summary>스스로 점검하기</summary>
        <ul>
          <li>오늘의 뜻과 품사로 썼나요?</li>
          <li>누가 무엇을 하는지 분명한가요? 시제와 전치사도 확인해 보세요.</li>
          <li>예문에서 사람·시간·장소를 하나 바꿔 보세요.</li>
        </ul>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => setSentence(content.example)}
        >
          예문 불러와 바꿔 쓰기
        </button>
        <p className="small-note">
          문법이 헷갈리면 ‘문장 보완이 필요해요’를 골라 주세요. 단어 친숙도는 바뀌지 않아요.
        </p>
        <div className="example-box">
          <p className="small-note">{content.source}</p>
          <p lang="en">{content.example}</p>
          <p className="translation">{content.translation}</p>
        </div>
        <DictionaryLinks word={word.word} />
      </details>
      <div className="button-row study-actions">
        <button
          className="primary-button"
          disabled={busy || !sentence.trim()}
          onClick={() => sentenceDone("written")}
        >
          문장을 완성했어요 <Check size={17} />
        </button>
        <button
          className="secondary-button"
          disabled={busy || !sentence.trim()}
          onClick={() => sentenceDone("improve")}
        >
          문장 보완이 필요해요
        </button>
      </div>
      <button
        className="text-button skip"
        disabled={busy}
        onClick={() => sentenceDone("unmeasured")}
      >
        {s.kind === "monthly"
          ? "문장 쓰기 건너뛰기"
          : "문장 쓰기는 다음에"}
      </button>
    </>
  );
}
