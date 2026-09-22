"use client";
import { POS } from "@/lib/learning";
import { Check } from "lucide-react";
import { SentenceFeedbackPanel } from "../sentence-feedback";
import { DictionaryLinks, Speak } from "../ui";
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
  return (
    <>
      <p className="muted">나의 하루와 연결해 짧은 문장을 말하고 써 보세요.</p>
      <div className="sentence-target">
        <h3 lang="en">
          {word.word}
          <Speak text={word.word} />
        </h3>
        <span>
          {POS[word.pos]} · {s.records[id!]?.meaning || content.meaning}
        </span>
      </div>
      <label htmlFor="my-sentence">내 영어 문장</label>
      <textarea
        id="my-sentence"
        readOnly={aiPending}
        value={sentence}
        maxLength={2000}
        onChange={(e) => setSentence(e.target.value)}
        placeholder="오늘 배운 단어로 나의 이야기를 써 보세요."
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
          <li>주어와 동사, 시제, 전치사가 자연스러운가요?</li>
          <li>예문에서 사람·시간·장소를 하나 바꿔 보세요.</li>
        </ul>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => setSentence(content.example)}
        >
          이 예문에서 한 부분 바꾸기
        </button>
        <p className="small-note">
          AI 의견도 직접 확인해 주세요. 문법만 헷갈리면 ‘문장 보완’으로
          기록하며, 친숙도는 유지합니다.
        </p>
        <div className="example-box">
          <p className="small-note">{content.source}</p>
          <p lang="en">{content.example}</p>
          <p className="translation">{content.translation}</p>
        </div>
        <DictionaryLinks word={word.word} />
      </details>
      <div className="button-row">
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
          ? "문장은 선택 · 쓰기 점검만 기록"
          : "아직 못 썼어요 · 다음에"}
      </button>
    </>
  );
}
