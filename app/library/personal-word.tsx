"use client";
import {HaruParagraph} from '../haru-content';
import {HaruButton,HaruTextInput,HaruSelector} from '../haru-controls';
import {EditorTextArea as HaruTextArea} from './editor-textarea';
import {
  DialogHeader,
} from "@/components/ui/dialog";
import {SheetDialogTitle as DialogTitle,SheetDialogDescription as DialogDescription} from '../sheet-dialog';
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
          Oxford 목록과 별도로 저장해요.
        </DialogDescription>
      </DialogHeader>
      <div className="dialog-scroll">
      {error && <HaruParagraph className="error-banner" role="alert">{error}</HaruParagraph>}
      <fieldset className="editor-fields" disabled={submitting}>
      <HaruTextInput label={["영어 단어"].join('')} value={word}
          onChange={(e) => setWord(e.target.value)}
          maxLength={80} disabled={submitting} />
      <HaruSelector label="개인 단어 품사" isLabelHidden containerClassName="haru-personal-pos" disabled={submitting} value={pos} onChange={setPos} options={Object.entries(POS).map(([value,label])=>({value,label}))} />
      <HaruTextInput label={["학습할 한국어 뜻"].join('')} value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          maxLength={2000} disabled={submitting} />
      <HaruTextArea rows={2} label={["영어 예문"].join('')} value={example}
          onChange={(e) => setExample(e.target.value)}
          maxLength={2000} disabled={submitting} />
      <HaruTextArea rows={2} label={["예문 해석"].join('')} value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          maxLength={2000} disabled={submitting} />
      </fieldset>
      </div>
      <div className="dialog-actions">
      <HaruButton label={[(failed ? '다시 저장' : '내 단어장에 추가')].join('')} variant="primary"
        className="haru-migrated primary-button full"
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
      </HaruButton>
      </div>
    </>
  );
}
