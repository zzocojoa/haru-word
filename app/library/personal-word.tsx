"use client";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { POS, type Progress, type Word } from "@/lib/learning";
import { useState } from "react";
import { useEditorSubmission } from "./use-editor-submission";
import { useSheetProtection } from '../sheet-dialog';
export function PersonalWord({
  error,
  busy,
  retryBlocked,
  onSave,
}: {
  error?: string;
  busy: boolean;
  retryBlocked: boolean;
  onSave: (w: Word, p: Progress) => Promise<boolean>;
}) {
  const { submitting, failed, submit } = useEditorSubmission();
  const [id] = useState(() => "personal_" + crypto.randomUUID());
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [pos, setPos] = useState("n.");
  const [example, setExample] = useState("");
  const [translation, setTranslation] = useState("");
  useSheetProtection(!!(word || meaning || example || translation || pos !== 'n.'), submitting);
  return (
    <>
      <DialogHeader>
        <DialogTitle>나에게 필요한 단어 추가</DialogTitle>
        <DialogDescription>
          공식 목록과 별도로 ‘개인 추가’로 저장해요.
        </DialogDescription>
      </DialogHeader>
      <div className="dialog-scroll">
      {error && <p className="error-banner" role="alert">{error}</p>}
      <fieldset className="editor-fields" disabled={submitting}>
      <label>
        영어 단어
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          maxLength={80}
        />
      </label>
      <Select disabled={submitting} value={pos} onValueChange={setPos}>
        <SelectTrigger aria-label="개인 단어 품사">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(POS).map(([v, t]) => (
            <SelectItem key={v} value={v}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label>
        오늘의 한국어 뜻
        <input
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          maxLength={2000}
        />
      </label>
      <label>
        영어 예문
        <textarea
          value={example}
          onChange={(e) => setExample(e.target.value)}
          maxLength={2000}
        />
      </label>
      <label>
        예문 해석
        <textarea
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          maxLength={2000}
        />
      </label>
      </fieldset>
      </div>
      <div className="dialog-actions">
      <button
        className="primary-button full"
        disabled={(failed ? retryBlocked : busy) || submitting || !word.trim() || !meaning.trim()}
        aria-busy={submitting}
        onClick={() =>
          void submit(() => onSave(
            {
              id,
              word: word.trim(),
              headword: word.trim(),
              pos,
              level: "A1",
              page: 0,
              personal: true,
            },
            {
              meaning: meaning.trim(),
              example,
              translation,
              familiarity: "new",
            },
          ))
        }
      >
        {failed ? '다시 저장' : '내 단어장에 추가'}
      </button>
      </div>
    </>
  );
}
