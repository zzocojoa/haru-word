"use client";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cardContent } from "@/lib/catalog";
import { changedWordSenseKeys, createWordEditorDraft, editWordEditorDraft, selectWordEditorDraft,
  wordEditorDraftIssue, wordSenseDraft, type WordSenseDraft } from '@/lib/word-editor-draft';
import {
  allSenses,
  FAMILIARITY_TEXT,
  POS,
  RESULT_TEXT,
  senseProgress,
  type Familiarity,
  type Progress,
  type Word,
} from "@/lib/learning";
import { Plus } from "lucide-react";
import { useState } from "react";
import { DictionaryLinks } from "../ui";
import { WordPronunciation } from '../word-pronunciation';
import { HelpDetails } from "../study-ui";
import { editedWordDraftsProgress } from "@/lib/learning-commands";
import { useEditorSubmission } from "./use-editor-submission";
import { ExpressionFields } from "../expression-fields";
import { useSheetProtection } from '../sheet-dialog';
import { resolveWordImage } from '@/lib/word-image';
import { WordImagePreview } from '../word-image-preview';
export function WordEditor({
  error,
  activityDate,
  word,
  p,
  busy,
  retryBlocked,
  onSave,
  imagePilotEnabled = false,
}: {
  error?: string;
  activityDate: () => string;
  word: Word;
  p?: Progress;
  busy: boolean;
  retryBlocked: boolean;
  onSave: (p: Progress) => Promise<boolean>;
  imagePilotEnabled?: boolean;
}) {
  const { submitting, failed, submit } = useEditorSubmission();
  const content = cardContent(word.id, p);
  // One editor instance owns its baseline, including after a failed optimistic save.
  const [base] = useState(() => ({ ...p, meaning: p?.meaning || content.meaning }));
  const senses = allSenses(base);
  const [draft, setDraft] = useState(() => createWordEditorDraft(content.meaning, wordSenseDraft({ ...content, notes: p?.notes })));
  const senseKey = draft.selected;
  const selectedSense = senseKey ? senseProgress(base, senseKey) : undefined;
  const { meaning, expression, expressionTranslation, example, translation, notes } = draft.senses[senseKey].value;
  function setDraftField(field: keyof WordSenseDraft, value: string) {
    setDraft(previous => editWordEditorDraft(previous, field, value));
  }
  const [fam, setFam] = useState<Familiarity | undefined>(p?.familiarity);
  const [familiarityTouched, setFamiliarityTouched] = useState(false);
  const [useful, setUseful] = useState(!!p?.useful);
  const [encounters, setEncounters] = useState(p?.encounters || []);
  const [encounter, setEncounter] = useState("");
  const [source, setSource] = useState<"reading" | "listening">("reading");
  const changedKeys = changedWordSenseKeys(draft);
  const dirty = changedKeys.length > 0 || familiarityTouched ||
    useful !== !!p?.useful || JSON.stringify(encounters) !== JSON.stringify(p?.encounters || []) || !!encounter.trim();
  useSheetProtection(dirty, submitting);
  function chooseSense(key: string) {
    if (submitting || key === senseKey) return;
    const saved = key ? senseProgress(base, key) : undefined;
    const initial = key ? wordSenseDraft({ ...cardContent(word.id, { ...saved, meaning: key }), notes: saved?.notes }) : wordSenseDraft();
    setDraft(previous => selectWordEditorDraft(previous, key, initial));
  }
  const issue = wordEditorDraftIssue(draft, senses.map(sense => sense.meaning || ''));
  const image = imagePilotEnabled ? resolveWordImage(word, meaning) : undefined;
  return (
    <>
      <DialogHeader>
        <DialogTitle className="dialog-word">
          <span lang="en">{word.word}</span>
          {image && <WordImagePreview key={image.sha256} image={image}/>}
        </DialogTitle>
        <DialogDescription>
          {word.personal ? "수준 미지정" : word.level} · {POS[word.pos]} ·{" "}
          {word.personal ? "개인 추가" : `첨부 Oxford PDF ${word.page}쪽`}
        </DialogDescription>
      </DialogHeader>
      <div className="dialog-scroll">
      <WordPronunciation word={word} meaning={meaning}/>
      {error && <p className="error-banner" role="alert">{error}</p>}
      <fieldset className="editor-fields" disabled={submitting}>
      <section className="sense-selector">
        <label>
          학습할 뜻 선택
          <select
            aria-label="학습할 뜻 선택"
            value={senseKey}
            onChange={(e) => chooseSense(e.target.value)}
          >
            {senses.map((x) => (
              <option key={x.meaning} value={x.meaning}>
                {x.meaning}
              </option>
            ))}
            {Object.hasOwn(draft.senses, '') && <option value="">새로운 뜻 · 초안</option>}
          </select>
        </label>
        <div className="button-row">
          <button
            className="secondary-button"
            disabled={senses.length >= 100 || !senseKey}
            onClick={() => chooseSense("")}
          >
            <Plus size={15} />
            다른 뜻 추가
          </button>
        </div>
        <p className="small-note">다른 뜻은 추가해요. 성적도 따로 저장돼요.</p>
      </section>
      <label>
        {senseKey ? "선택한 학습 뜻" : "새로 학습할 뜻"}
        <input
          readOnly={!!senseKey}
          aria-label="학습할 뜻"
          maxLength={2000}
          value={meaning}
          onChange={(e) => setDraftField('meaning', e.target.value)}
        />
      </label>
      <ExpressionFields expression={expression} expressionTranslation={expressionTranslation}
        onExpressionChange={value => setDraftField('expression', value)}
        onTranslationChange={value => setDraftField('expressionTranslation', value)}
        help="표현을 바꾸면 해석이 지워져요. 새 해석을 입력해 주세요." />
      <label>
        영어 예문
        <textarea
          maxLength={2000}
          value={example}
          onChange={(e) => setDraftField('example', e.target.value)}
        />
      </label>
      <label>
        예문의 한국어 해석
        <textarea
          maxLength={2000}
          value={translation}
          onChange={(e) => setDraftField('translation', e.target.value)}
        />
      </label>
      <p className="small-note">
        {content.source}
        {content.attribution && (
          <>
            {" "}
            ·{" "}
            <a className="source-link" href={content.url} target="_blank" rel="noreferrer">
              {content.attribution}
            </a>
          </>
        )}
      </p>
      <HelpDetails title="친숙도·학습 우선순위">
      <div className="familiarity-actions mini">
        {(["known", "uncertain", "new"] as const).map((f) => (
          <button
            key={f}
            aria-pressed={fam === f}
            className={fam === f ? "selected" : ""}
            onClick={() => {
              setFam(f);
              setFamiliarityTouched(true);
            }}
          >
            {FAMILIARITY_TEXT[f]}
          </button>
        ))}
      </div>
      <p className="small-note">성적은 유지돼요. 헷갈리는 단어는 재학습에 넣어요.</p>
      <label className="check-label">
        <input
          type="checkbox"
          checked={useful}
          onChange={(e) => setUseful(e.target.checked)}
        />{" "}
        자주 쓰는 단어 · 같은 조건에서 먼저 학습
      </label>
      </HelpDetails>
      <HelpDetails title="내 성적·문장·보완점">
      {p?.familiarityCheck && (
        <div className="example-box">
          <p className="eyebrow">최근 친숙도 확인</p>
          <p className="small-note">
            확인 전: {FAMILIARITY_TEXT[p.familiarityCheck.initial]} → 확인 후:{" "}
            {p.familiarityCheck.final
              ? FAMILIARITY_TEXT[p.familiarityCheck.final]
              : "아직 확정하지 않음"}
          </p>
          {p.familiarityCheck.answer && (
            <p>떠올린 뜻: {p.familiarityCheck.answer}</p>
          )}
        </div>
      )}
      <div className="result-inline">
        <span>영어→뜻: {RESULT_TEXT[selectedSense?.en || "unmeasured"]}</span>
        <span>뜻→영어: {RESULT_TEXT[selectedSense?.ko || "unmeasured"]}</span>
      </div>
      {selectedSense?.sentence && (
        <div className="example-box">
          <p className="eyebrow">내 문장</p>
          <p>{selectedSense.sentence}</p>
        </div>
      )}
      <label>
        보완점
        <textarea
          maxLength={2000}
          value={notes}
          onChange={(e) => setDraftField('notes', e.target.value)}
        />
      </label>
      </HelpDetails>
      <HelpDetails title="읽기·듣기 기록"><section className="encounter-journal">
        {encounters.map((item, i) => (
          <p key={i}>
            <small>
              {item.date} · {item.source === "reading" ? "읽기" : "듣기"}
            </small>
            <span>{item.text}</span>
          </p>
        ))}
        <label>
          어디서 만났나요?
          <select
            value={source}
            onChange={(e) =>
              setSource(e.target.value as "reading" | "listening")
            }
          >
            <option value="reading">읽기</option>
            <option value="listening">듣기</option>
          </select>
        </label>
        <label>
          새로 만난 표현
          <textarea
            maxLength={2000}
            value={encounter}
            onChange={(e) => setEncounter(e.target.value)}
          />
        </label>
        <button
          className="secondary-button"
          disabled={!encounter.trim() || encounters.length >= 200}
          onClick={() => {
            setEncounters([
              ...encounters,
              { date: activityDate(), source, text: encounter.trim() },
            ]);
            setEncounter("");
          }}
        >
          표현 기록에 추가
        </button>
        <p className="small-note">
          ‘기록 저장’을 누르면 표현도 함께 저장돼요. 최대 200개까지 보관해요.
        </p>
      </section></HelpDetails>
      <DictionaryLinks word={word.word} />
      {issue && (
        <p className="status-warn" role="alert">
          {issue === 'duplicate' ? '이미 저장된 뜻이에요. 새 뜻 초안을 수정해 주세요.'
            : issue === 'limit' ? '뜻은 최대 100개까지 저장할 수 있어요.' : '새 뜻 초안에 뜻을 입력해 주세요.'}
          {senseKey && <button className="text-button" onClick={() => chooseSense('')}>새 뜻 초안 보기</button>}
        </p>
      )}
      {changedKeys.length > 1 && <p className="small-note">수정한 뜻 {changedKeys.length}개를 함께 저장해요.</p>}
      </fieldset>
      </div>
      <div className="dialog-actions">
      <button
        className="primary-button full"
        disabled={(failed ? retryBlocked : busy) || submitting || !meaning.trim() || !!issue}
        aria-busy={submitting}
        onClick={() => {
          void submit(() => onSave(editedWordDraftsProgress(base, draft, {
            familiarity: fam, familiarityTouched, useful, encounters,
          })));
        }}
      >
        {failed ? '다시 저장' : '기록 저장'}
      </button>
      </div>
    </>
  );
}
