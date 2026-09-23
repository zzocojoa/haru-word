"use client";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cardContent } from "@/lib/catalog";
import { editExpression, expressionDraft, type ExpressionDraft } from "@/lib/expression";
import {
  allSenses,
  FAMILIARITY_TEXT,
  POS,
  recordFamiliarity,
  RESULT_TEXT,
  selectSense,
  senseProgress,
  type Familiarity,
  type Progress,
  type Word,
} from "@/lib/learning";
import { Plus } from "lucide-react";
import { useState } from "react";
import { DictionaryLinks, Speak } from "../ui";
import { ExpressionFields } from "../expression-fields";
export function WordEditor({
  activityDate,
  word,
  p,
  busy,
  onSave,
}: {
  activityDate: () => string;
  word: Word;
  p?: Progress;
  busy: boolean;
  onSave: (p: Progress) => void;
}) {
  const content = cardContent(word.id, p);
  const base = { ...p, meaning: p?.meaning || content.meaning };
  const senses = allSenses(base);
  const [senseKey, setSenseKey] = useState(content.meaning);
  const selectedSense = senseKey ? senseProgress(base, senseKey) : undefined;
  const [phrase, setPhrase] = useState(() => expressionDraft(content));
  const { meaning, expression, expressionTranslation } = phrase;
  function setPhraseField(field: keyof ExpressionDraft, value: string) {
    setPhrase(previous => editExpression(previous, field, value));
  }
  const [fam, setFam] = useState<Familiarity | undefined>(p?.familiarity);
  const [familiarityTouched, setFamiliarityTouched] = useState(false);
  const [example, setExample] = useState(content.example);
  const [translation, setTranslation] = useState(content.translation);
  const [notes, setNotes] = useState(p?.notes || "");
  const [useful, setUseful] = useState(!!p?.useful);
  const [encounters, setEncounters] = useState(p?.encounters || []);
  const [encounter, setEncounter] = useState("");
  const [source, setSource] = useState<"reading" | "listening">("reading");
  function chooseSense(key: string) {
    const c = key
      ? cardContent(word.id, { ...senseProgress(base, key), meaning: key })
      : { meaning: "", expression: "", expressionTranslation: "", example: "", translation: "" };
    setSenseKey(key);
    setPhrase(expressionDraft(c));
    setExample(c.example);
    setTranslation(c.translation);
    setNotes(key ? senseProgress(base, key).notes || "" : "");
  }
  const duplicate =
    !senseKey && senses.some((x) => x.meaning === meaning.trim());
  return (
    <>
      <DialogHeader>
        <DialogTitle className="dialog-word">
          <span lang="en">{word.word}</span>
          <Speak text={word.word} />
        </DialogTitle>
        <DialogDescription>
          {word.personal ? "수준 미지정" : word.level} · {POS[word.pos]} ·{" "}
          {word.personal ? "개인 추가" : `첨부 Oxford PDF ${word.page}쪽`}
        </DialogDescription>
      </DialogHeader>
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
      <p className="small-note">
        친숙도는 뜻의 익숙함이에요. 배운 단어를 다시 헷갈리거나 처음 본다고
        표시하면 재학습에 넣고, 이전 회상·문장 결과는 보존해요. ‘안다’로 바꿔도
        남은 보완점은 유지합니다.
      </p>
      <label className="check-label">
        <input
          type="checkbox"
          checked={useful}
          onChange={(e) => setUseful(e.target.checked)}
        />{" "}
        생활에서 자주 쓸 단어 · 같은 우선순위 안에서 먼저
      </label>
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
            {!senseKey && <option value="">새로운 뜻</option>}
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
        <p className="small-note">
          각 뜻의 회상·문장 결과를 따로 보관해요. 기존 뜻의 표현과 예문은
          아래에서 수정할 수 있어요. 뜻 자체를 바꾸려면 ‘다른 뜻 추가’를 눌러
          주세요.
        </p>
      </section>
      <label>
        {senseKey ? "선택한 학습 뜻" : "새로 학습할 뜻"}
        <input
          readOnly={!!senseKey}
          aria-label="오늘의 뜻"
          maxLength={2000}
          value={meaning}
          onChange={(e) => setPhraseField('meaning', e.target.value)}
        />
      </label>
      <ExpressionFields expression={expression} expressionTranslation={expressionTranslation}
        onExpressionChange={value => setPhraseField('expression', value)}
        onTranslationChange={value => setPhraseField('expressionTranslation', value)}
        help="영어 표현을 바꾸면 기존 표현 해석은 지워져요. 새 표현에 맞게 입력해 주세요." />
      <label>
        영어 예문
        <textarea
          maxLength={2000}
          value={example}
          onChange={(e) => setExample(e.target.value)}
        />
      </label>
      <label>
        예문의 한국어 해석
        <textarea
          maxLength={2000}
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
        />
      </label>
      <p className="small-note">
        {content.source}
        {content.attribution && (
          <>
            {" "}
            ·{" "}
            <a href={content.url} target="_blank" rel="noreferrer">
              {content.attribution}
            </a>
          </>
        )}
      </p>
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
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <section className="encounter-journal">
        <h3>읽기·듣기에서 다시 만났어요.</h3>
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
          이 행에 표현 덧붙이기
        </button>
        <p className="small-note">
          아래 ‘기록 저장’을 누르면 표현도 함께 저장됩니다. 최대 200개를
          보관해요.
        </p>
      </section>
      <DictionaryLinks word={word.word} />
      {duplicate && (
        <p className="status-warn" role="alert">
          이미 저장된 뜻이에요. 위 목록에서 선택해 주세요.
        </p>
      )}
      <button
        className="primary-button full"
        disabled={busy || !meaning.trim() || duplicate}
        onClick={() => {
          const edited = selectSense(base, {
            ...selectedSense,
            meaning: meaning.trim(),
            expression,
            expressionTranslation,
            example,
            translation,
            notes,
            ...(!senseKey
              ? {
                  en: "unmeasured",
                  ko: "unmeasured",
                  sentenceStatus: "unmeasured",
                  sentence: "",
                  studyDates: [],
                  needsReview: true,
                }
              : {}),
          });
          onSave({
            ...edited,
            ...(familiarityTouched && fam
              ? recordFamiliarity(edited, fam)
              : {}),
            familiarity: fam,
            useful,
            encounters,
          });
        }}
      >
        기록 저장
      </button>
    </>
  );
}
