import { memo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FeedbackDetail } from "./feedback-detail";
import { RecordText } from './record-text';
import { StatusBadge } from "./study-ui";
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
        <RecordText text={r.meaning} label="저장한 뜻" />
        <p className="small-note">
          회차 시작일 {s.date} · 학습한 날 {r.learnedOn || "이전 기록 · 날짜 미확인"}
          {r.lastPracticedOn && ` · 마지막 연습 ${r.lastPracticedOn}`}
        </p>
        <dl>
          <div><dt>처음 확인한 친숙도</dt><dd>{r.familiarity ? FAMILIARITY_TEXT[r.familiarity] : "미확인"}</dd></div>
          <div>
            <dt>영어→뜻</dt>
            <dd data-result={r.en}>{RESULT_TEXT[r.en]}{r.retryEn && ` · 재시도 ${RESULT_TEXT[r.retryEn]}`}</dd>
          </div>
          <div>
            <dt>뜻→영어</dt>
            <dd data-result={r.ko}>{RESULT_TEXT[r.ko]}{r.retryKo && ` · 재시도 ${RESULT_TEXT[r.retryKo]}`}</dd>
          </div>
          <div><dt>내 문장</dt><dd>{SENTENCE_TEXT[r.sentenceStatus]}{r.sentence && <> · <RecordText text={r.sentence} label="내 문장" lang="en" /></>}</dd></div>
          <div><dt>말하기</dt><dd>{r.spoken ? "소리 내어 말해 봄" : "아직 확인 안 함"}</dd></div>
          <div><dt>보완점</dt><dd><RecordText text={r.notes || "기록 없음"} label="보완점" /></dd></div>
          <div><dt>다음 할 일</dt><dd>{nextAction(r, s)}</dd></div>
        </dl>
        {r.aiFeedback && (
          <details className="notes-details">
            <summary>저장한 AI 참고 의견</summary>
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
          <StatusBadge tone={complete ? "success" : needsHelp ? "warning" : "neutral"}>
            {complete ? "도움 없이 성공" : needsHelp ? "보완 필요" : unmeasured ? "아직 확인 안 함" : "진행 중"}
          </StatusBadge>
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
