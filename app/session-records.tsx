import { memo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FeedbackDetail } from "./sentence-feedback";
import {
  entryIdFor,
  FAMILIARITY_TEXT,
  POS,
  RESULT_TEXT,
  SENTENCE_TEXT,
  nextAction,
  sessionRecordComplete,
  type Session,
  type Word,
} from "@/lib/learning";

/** The same full record is shown after a pause and after completing a session. */
export const SessionRecords = memo(function SessionRecords({
  session: s,
  words,
  compact = false,
}: {
  session: Session;
  words: Word[];
  compact?: boolean;
}) {
  const warmup = s.warmupIds.length > 0 && (
    <article className="record-card">
      <h3>기억 깨우기 기록</h3>
      <dl>
        {s.warmupIds.map(id => (
          <div key={id}>
            <dt>{words.find(w => w.id === id)?.word}</dt>
            <dd>{RESULT_TEXT[s.warmupResults?.[id] || "unmeasured"]}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
  const records = s.ids.map(id => {
    const r = s.records[id];
    const w = words.find(w => w.id === entryIdFor(s, id));
    if (!r) return null;
    const detail = (
      <article className="record-card" key={id}>
        <header>
          <b>{w?.word}</b>
          <span>{r.lastPracticedOn || r.learnedOn || s.date} · {POS[w?.pos || ""]}</span>
        </header>
        <p>{r.meaning}</p>
        <p className="small-note">
          회차 시작 {s.date} · 실제 학습 {r.learnedOn || "기존 기록·미확인"}
          {r.lastPracticedOn && ` · 마지막 연습 ${r.lastPracticedOn}`}
        </p>
        <dl>
          <div><dt>처음 표시</dt><dd>{r.familiarity ? FAMILIARITY_TEXT[r.familiarity] : "미표시"}</dd></div>
          <div>
            <dt>영어→뜻</dt>
            <dd data-result={r.en}>{RESULT_TEXT[r.en]}{r.retryEn && ` · 재시도 ${RESULT_TEXT[r.retryEn]}`}</dd>
          </div>
          <div>
            <dt>뜻→영어</dt>
            <dd data-result={r.ko}>{RESULT_TEXT[r.ko]}{r.retryKo && ` · 재시도 ${RESULT_TEXT[r.retryKo]}`}</dd>
          </div>
          <div><dt>내 문장</dt><dd>{SENTENCE_TEXT[r.sentenceStatus]}{r.sentence && ` · ${r.sentence}`}</dd></div>
          <div><dt>말하기</dt><dd>{r.spoken ? "소리 내어 말해 봄" : "미측정"}</dd></div>
          <div><dt>보완점</dt><dd>{r.notes || "기록 없음"}</dd></div>
          <div><dt>다음 할 일</dt><dd>{nextAction(r, s)}</dd></div>
        </dl>
        {r.aiFeedback && (
          <details className="notes-details">
            <summary>저장한 AI 교정 의견</summary>
            <FeedbackDetail feedback={r.aiFeedback} />
          </details>
        )}
      </article>
    );
    if (!compact) return detail;
    const complete = sessionRecordComplete(s, r);
    const needsHelp = !complete && (r.en === "help" || r.ko === "help" || r.sentenceStatus === "improve");
    const unmeasured = r.en === "unmeasured" && r.ko === "unmeasured" && r.sentenceStatus === "unmeasured";
    return (
      <AccordionItem value={"word:" + id} key={id} className="journal-word">
        <AccordionTrigger className="journal-word-trigger">
          <span className="journal-word-summary">
            <span>
              <b lang="en">{w?.word || "단어"}</b>
              <span className="journal-word-pos">{POS[w?.pos || ""]}</span>
            </span>
            <span className="journal-word-meaning">{r.meaning || "뜻 미입력"}</span>
          </span>
          <span className={complete ? "status-good" : needsHelp ? "status-warn" : "journal-word-status"}>
            {complete ? "완료" : needsHelp ? "보완 필요" : unmeasured ? "미측정" : "진행 중"}
          </span>
        </AccordionTrigger>
        <AccordionContent className="journal-word-detail">{detail}</AccordionContent>
      </AccordionItem>
    );
  });
  if (compact) return (
    <Accordion type="single" collapsible className="journal-words">
      {warmup && (
        <AccordionItem value="warmup">
          <AccordionTrigger className="journal-word-trigger">기억 깨우기 · {s.warmupIds.length}개</AccordionTrigger>
          <AccordionContent className="journal-word-detail">{warmup}</AccordionContent>
        </AccordionItem>
      )}
      {records}
    </Accordion>
  );
  return <div className="record-cards">{warmup}{records}</div>;
});
