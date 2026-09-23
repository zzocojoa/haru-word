"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  entryIdFor,
  FAMILIARITY_TEXT,
  nextAction,
  POS,
  RESULT_TEXT,
  SENTENCE_TEXT,
  sessionRecordComplete,
  type Kind,
  type PracticeMode,
  type Session,
  type State,
  type Word,
} from "@/lib/learning";
import { groupJournalSessions, journalSessionLabel } from "@/lib/learning-journal";
import { ArrowRight, NotebookPen } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { FeedbackDetail } from "../sentence-feedback";
import { SessionRecords } from "../session-records";
import { RecordActions } from "./record-actions";
import { sessionCounts } from "@/lib/learning-display";
const LOG_PAGE_SIZE = 10;
type Props = {
  state: State;
  words: Word[];
  start: (
    kind: Kind,
    period?: string,
    existing?: Session,
    mode?: PracticeMode,
  ) => void;
  busy: boolean;
  save?: (s: State) => Promise<boolean>;
};
export function LearningLog({
  date,
  now,
  state,
  words,
  start,
  busy,
  onReview,
  onRestoreOpen,
  onCorrectDate,
}: Props & {
  date: string;
  now: () => number;
  onReview: (date: string) => void;
  onRestoreOpen: () => void;
  onCorrectDate: (id: string) => void;
}) {
  const [selected, setSelected] = useState<"all" | Kind>("all");
  const [limit, setLimit] = useState(LOG_PAGE_SIZE);
  const [openDate, setOpenDate] = useState("");
  const [openSession, setOpenSession] = useState("");
  const list = useMemo(
    () => groupJournalSessions(Object.values(state.sessions), selected),
    [state.sessions, selected],
  );
  const sessionCount = list.reduce((count, day) => count + day.sessions.length, 0);
  return (
    <section className="wide-panel">
      <div className="section-heading">
        <div><h2>날짜별 기록</h2><p className="muted">{list.length}일 · {sessionCount}회차</p></div>
        <RecordActions state={state} words={words} date={date} now={now} busy={busy} onRestoreOpen={onRestoreOpen}/>
      </div>
      <Select
        value={selected}
        onValueChange={(v) => {
          setSelected(v as "all" | Kind);
          setLimit(LOG_PAGE_SIZE);
          setOpenDate("");
          setOpenSession("");
        }}
      >
        <SelectTrigger className="journal-filter" aria-label="기록 종류 필터">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">모든 학습 기록</SelectItem>
          <SelectItem value="daily">일일 학습</SelectItem>
          <SelectItem value="weekly">주간 점검</SelectItem>
          <SelectItem value="monthly">월말 쓰기</SelectItem>
          <SelectItem value="practice">보완 연습</SelectItem>
        </SelectContent>
      </Select>
      {!list.length ? (
        <div className="empty-state">
          <NotebookPen size={32} />
          <h3>{selected === "all" ? "첫 학습 기록을 기다리고 있어요." : "이 종류의 학습 기록이 아직 없어요."}</h3>
          <p>{selected === "all" ? "오늘의 단어를 배우면 이곳에 기록이 쌓여요." : "다른 종류를 선택하면 이전 기록을 볼 수 있어요."}</p>
        </div>
      ) : (
        <Accordion
          type="single"
          collapsible
          value={openDate}
          onValueChange={(value) => { setOpenDate(value); setOpenSession(""); }}
          className="journal-list"
        >
          {list.slice(0, limit).map((day) => {
            const kinds = new Map<string, number>();
            for (const { session } of day.sessions) {
              const label = journalSessionLabel(session);
              kinds.set(label, (kinds.get(label) || 0) + 1);
            }
            const summary = [...kinds].map(([label, count]) => `${label} ${count}`).join(" · ");
            return (
              <AccordionItem className="journal-day" value={day.date} key={day.date}>
                <AccordionTrigger className="journal-day-trigger">
                  <span className="journal-session-summary">
                    <span className="journal-session-heading">
                      <time className="journal-date" dateTime={day.date}>{day.date}</time>
                      <span className="level-badge">{day.sessions.length}회차</span>
                    </span>
                    <span className="journal-day-summary">{summary}</span>
                  </span>
                  <span className="journal-toggle-label">{openDate === day.date ? "접기" : "회차 보기"}</span>
                </AccordionTrigger>
                <AccordionContent className="journal-day-content">
                  <Accordion type="single" collapsible value={openSession} onValueChange={setOpenSession} className="journal-day-sessions">
                    {day.sessions.map(({ session, number }) => (
                      <JournalSessionItem
                        key={session.id}
                        session={session}
                        number={number}
                        open={openSession === session.id}
                        words={words}
                        busy={busy}
                        start={start}
                        onReview={onReview}
                        onCorrectDate={onCorrectDate}
                      />
                    ))}
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
      {list.length > 0 && (
        <p className="small-note" role="status">
          {selected === "all" ? "전체" : "선택한 종류의"} {list.length.toLocaleString()}일 · {sessionCount.toLocaleString()}회차 중{" "}
          {Math.min(limit, list.length).toLocaleString()}일의 기록을 보고 있어요.
        </p>
      )}
      {list.length > limit && (
        <button
          className="secondary-button"
          onClick={() => setLimit(limit + LOG_PAGE_SIZE)}
        >
          이전 기록 더 보기
        </button>
      )}
      <p className="small-note">
        ‘미측정’은 확인하지 않은 항목으로, 성공률 계산에 넣지 않습니다. 날짜는
        한국 시간 기준이에요.
      </p>
    </section>
  );
}
function JournalSessionItem({
  session: s, number, open, words, busy, start, onReview, onCorrectDate,
}: Pick<Props, "words" | "busy" | "start"> & {
  session: Session;
  number: number;
  open: boolean;
  onReview: (date: string) => void;
  onCorrectDate: (id: string) => void;
}) {
  const counts = sessionCounts(s);
  const preview = s.ids.slice(0, 3)
    .map(id => words.find(w => w.id === entryIdFor(s, id))?.word || "단어")
    .join(" · ");
  return (
    <AccordionItem className="journal-session" value={s.id}>
      <AccordionTrigger className="journal-session-trigger">
        <span className="journal-session-summary">
          <span className="journal-session-heading">
            <span className="journal-session-number">{number}회차</span>
            <span className="level-badge">{journalSessionLabel(s)}</span>
          </span>
          <span className="journal-session-count">
            {counts.total}개 · 기록 완료 {counts.recorded} · 독립 성공 {counts.successful} · {s.finished ? "회차 종료" : "진행 중"}
          </span>
          <span className="journal-session-preview">
            <span lang="en">{preview}</span>{s.ids.length > 3 && ` 외 ${s.ids.length - 3}개`}
          </span>
          {s.practiceMode === "repeat" && s.period !== s.date && (
            <span className="journal-session-count">원래 학습일 {s.period}</span>
          )}
        </span>
        <span className="journal-toggle-label">{open ? "접기" : "기록 보기"}</span>
      </AccordionTrigger>
      <AccordionContent className="journal-session-content">
        <div className="button-row journal-session-actions">
          {s.finished && s.kind === "daily" && (
            <>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => onCorrectDate(s.id)}
                aria-label={`${s.date} ${s.ids.length}개 학습일 수정`}
              >
                학습일 수정
              </button>
              <button className="text-button" onClick={() => onReview(s.date)}>
                단어 다시 보기 <ArrowRight size={15} />
              </button>
            </>
          )}
          {!s.finished && (
            <button className="text-button" disabled={busy} onClick={() => start(s.kind, s.period, s)}>
              이어서 학습 <ArrowRight size={15} />
            </button>
          )}
        </div>
        <div className="journal-mobile"><SessionRecords session={s} words={words} compact /></div>
        <div className="journal-desktop"><SessionLogTable session={s} words={words} /></div>
      </AccordionContent>
    </AccordionItem>
  );
}

const SessionLogTable = memo(function SessionLogTable({
  session: s,
  words,
}: {
  session: Session;
  words: Word[];
}) {
  return (
    <Table className="log-table">
      <TableHeader>
        <TableRow>
          <TableHead>단어·오늘의 뜻</TableHead>
          <TableHead>처음 표시</TableHead>
          <TableHead>영어→뜻</TableHead>
          <TableHead>뜻→영어</TableHead>
          <TableHead>내 문장·보완점</TableHead>
          <TableHead>다음 할 일</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {s.ids.map((id) => {
          const w = words.find((w) => w.id === entryIdFor(s, id));
          const r = s.records[id];
          if (!r) return null;
          return (
            <TableRow key={id}>
              <TableCell>
                <b>{w?.word}</b>
                <small className="block">
                  {POS[w?.pos || ""]} · {r.meaning}
                </small>
                <small>
                  실제 학습: {r.learnedOn || "기존 기록·미확인"}
                  {r.lastPracticedOn
                    ? ` · 최근 연습: ${r.lastPracticedOn}`
                    : ""}
                </small>
              </TableCell>
              <TableCell>
                {r.familiarity ? FAMILIARITY_TEXT[r.familiarity] : "미표시"}
              </TableCell>
              <TableCell>
                {RESULT_TEXT[r.en]}
                {r.retryEn && (
                  <small className="block">
                    재시도: {RESULT_TEXT[r.retryEn]}
                  </small>
                )}
              </TableCell>
              <TableCell>
                {RESULT_TEXT[r.ko]}
                {r.retryKo && (
                  <small className="block">
                    재시도: {RESULT_TEXT[r.retryKo]}
                  </small>
                )}
              </TableCell>
              <TableCell>
                <p>
                  {SENTENCE_TEXT[r.sentenceStatus]} ·{" "}
                  {r.sentence || "문장 기록 없음"}
                </p>
                {r.sentenceStatus === "improve" && (
                  <span className="status-warn">문장 보완</span>
                )}
                {r.notes && <small>{r.notes}</small>}
                {r.aiFeedback && (
                  <details className="notes-details">
                    <summary>AI 교정 의견</summary>
                    <FeedbackDetail feedback={r.aiFeedback} />
                  </details>
                )}
              </TableCell>
              <TableCell>
                {sessionRecordComplete(s, r)
                  ? "이후에도 복습"
                  : nextAction(r, s)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
});
