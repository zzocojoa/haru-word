"use client";
import {HaruPanel,HaruHeading,HaruParagraph} from '../haru-content';
import {HaruButton,HaruSelector} from '../haru-controls';

import { resumeMonthlyWriting } from '@/lib/learning/session-flow';
import { RecordText } from '../record-text';
import {HaruAccordion,HaruDisclosure} from '../haru-disclosure';
import {
  Table,
  TableBody,
  TableCell,
  TableHeaderCell,
  TableHeader,
  TableRow,
} from "@astryxdesign/core/Table";
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
import { ArrowRight } from "lucide-react";
import { HaruIcon } from "@/components/icons/haru-icon";
import { Fragment, memo, useCallback, useMemo, useRef, useState } from "react";
import { FeedbackDetail } from "../feedback-detail";
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
  onStudyHome,
}: Props & {
  date: string;
  now: () => number;
  onReview: (date: string) => void;
  onRestoreOpen: () => void;
  onCorrectDate: (id: string) => void;
  onStudyHome: () => void;
}) {
  const [selected, setSelected] = useState<"all" | Kind>("all");
  const filterRef = useRef<HTMLButtonElement>(null);
  const [limit, setLimit] = useState(LOG_PAGE_SIZE);
  const [openDate, setOpenDate] = useState("");
  const [openSession, setOpenSession] = useState("");
  const list = useMemo(
    () => groupJournalSessions(Object.values(state.sessions), selected),
    [state.sessions, selected],
  );
  const sessionCount = list.reduce((count, day) => count + day.sessions.length, 0);
  const changeFilter = useCallback((value: string) => {
    setSelected(value as "all" | Kind);
    setLimit(LOG_PAGE_SIZE);
    setOpenDate("");
    setOpenSession("");
  }, []);
  const journalFilter = useMemo(() => <HaruSelector label="기록 종류 필터" isLabelHidden ref={filterRef} containerClassName="haru-journal-filter" controlClassName="journal-filter" value={selected} onChange={changeFilter}
    options={[{value:'all',label:'모든 학습 기록'},{value:'daily',label:'일일 학습'},{value:'weekly',label:'주간 점검'},{value:'monthly',label:'월말 쓰기'},{value:'practice',label:'보완 연습'}]} />,
  [selected, changeFilter]);
  return (
    <HaruPanel className="wide-panel">
      <div className="section-heading">
        <div><HaruHeading level={2}>날짜별 기록</HaruHeading><HaruParagraph className="muted">{list.length}일 · {sessionCount}회차</HaruParagraph></div>
        <RecordActions state={state} words={words} date={date} now={now} busy={busy} onRestoreOpen={onRestoreOpen}/>
      </div>
      {journalFilter}
      {list.length > 0 && <HaruParagraph className="small-note">날짜 · 한국 시간</HaruParagraph>}
      {!list.length ? (
        <div className="empty-state">
          <HaruIcon name="record-empty" size={32} />
          <HaruHeading level={3}>{selected === "all" ? "첫 학습 기록을 기다리고 있어요." : "이 종류의 학습 기록이 아직 없어요."}</HaruHeading>
          {selected === "all" ? <HaruButton label={["오늘의 학습으로 "].join('')} variant="secondary" endContent={<ArrowRight size={16}/>} className="haru-migrated secondary-button" onClick={onStudyHome}>오늘의 학습으로 </HaruButton> : <HaruButton label={["전체 기록 보기"].join('')} variant="secondary" className="haru-migrated secondary-button" onClick={() => { changeFilter("all"); filterRef.current?.focus(); }}>전체 기록 보기</HaruButton>}
        </div>
      ) : (
        <HaruAccordion
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
              <HaruDisclosure className="journal-day" value={day.date} key={day.date} trigger={<>
                  <span className="journal-session-summary">
                    <span className="journal-session-heading">
                      <time className="journal-date" dateTime={day.date}>{day.date}</time>
                      <span className="level-badge">{day.sessions.length}회차</span>
                    </span>
                    <span className="journal-day-summary">{summary}</span>
                  </span>
                  <span className="journal-toggle-label">{openDate === day.date ? "접기" : "회차 보기"}</span>
                </>} triggerClassName="journal-day-trigger">

                <div className="journal-day-content">
                  <HaruAccordion type="single" collapsible value={openSession} onValueChange={setOpenSession} className="journal-day-sessions">
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
                  </HaruAccordion>
                </div>
              </HaruDisclosure>
            );
          })}
        </HaruAccordion>
      )}
      {list.length > limit && (
        <HaruParagraph className="small-note" role="status">
          {selected === "all" ? "전체" : "선택한 종류의"} {list.length.toLocaleString()}일 · {sessionCount.toLocaleString()}회차 중{" "}
          {Math.min(limit, list.length).toLocaleString()}일의 기록을 보고 있어요.
        </HaruParagraph>
      )}
      {list.length > limit && (
        <HaruButton label={["이전 기록 더 보기"].join('')} variant="secondary"
          className="haru-migrated secondary-button"
          onClick={() => setLimit(limit + LOG_PAGE_SIZE)}
        >
          이전 기록 더 보기
        </HaruButton>
      )}
    </HaruPanel>
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
  const resumable = !resumeMonthlyWriting(s).finished;
  const preview = s.ids.slice(0, 3)
    .map(id => words.find(w => w.id === entryIdFor(s, id))?.word || "단어")
    .join(" · ");
  return (
    <HaruDisclosure className="journal-session" value={s.id} trigger={<>
        <span className="journal-session-summary">
          <span className="journal-session-heading">
            <span className="journal-session-number">{number}회차</span>
            <span className="level-badge">{journalSessionLabel(s)}</span>
          </span>
          <span className="journal-session-count">
            {counts.total}개 · 학습 기록함 {counts.recorded} · 도움 없이 성공 {counts.successful} · {resumable ? "진행 중" : "회차 마침"}
          </span>
          <span className="journal-session-preview">
            <span lang="en">{preview}</span>{s.ids.length > 3 && ` 외 ${s.ids.length - 3}개`}
          </span>
          {s.practiceMode === "repeat" && s.period !== s.date && (
            <span className="journal-session-count">원래 학습일 {s.period}</span>
          )}
        </span>
        <span className="journal-toggle-label">{open ? "접기" : "기록 보기"}</span>
      </>} triggerClassName="journal-session-trigger">

      <div className="journal-session-content">
        <div className="button-row journal-session-actions">
          {s.finished && s.kind === "daily" && (
            <>
              <HaruButton label={`${s.date} ${s.ids.length}개 학습일 수정`} variant="ghost"
                className="haru-migrated text-button"
                disabled={busy}
                onClick={() => onCorrectDate(s.id)}
                aria-label={`${s.date} ${s.ids.length}개 학습일 수정`}
              >
                학습일 수정
              </HaruButton>
              <HaruButton label={["단어 다시 보기 "].join('')} variant="ghost" endContent={<ArrowRight size={15} />} className="haru-migrated text-button" onClick={() => onReview(s.date)}>
                단어 다시 보기
              </HaruButton>
            </>
          )}
          {resumable && (
            <HaruButton label={["이어서 학습 "].join('')} variant="ghost" endContent={<ArrowRight size={15} />} className="haru-migrated text-button" disabled={busy} onClick={() => start(s.kind, s.period, s)}>
              이어서 학습
            </HaruButton>
          )}
        </div>
        <div className="journal-mobile"><SessionRecords session={s} words={words} compact /></div>
        <div className="journal-desktop"><SessionLogTable session={s} words={words} /></div>
      </div>
    </HaruDisclosure>
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
    <Table className="haru-table log-table" aria-label="단어별 학습 기록">
      <TableHeader>
        <TableRow>
          <TableHeaderCell>단어·학습한 뜻</TableHeaderCell>
          <TableHeaderCell>처음 확인한 친숙도</TableHeaderCell>
          <TableHeaderCell>영어→뜻</TableHeaderCell>
          <TableHeaderCell>뜻→영어</TableHeaderCell>
          <TableHeaderCell>내 문장·보완점</TableHeaderCell>
          <TableHeaderCell>다음 할 일</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {s.ids.map((id) => {
          const w = words.find((w) => w.id === entryIdFor(s, id));
          const r = s.records[id];
          if (!r) return null;
          return (
            <Fragment key={id}><TableRow>
              <TableCell>
                <b>{w?.word}</b>
                <div className="small-note">{POS[w?.pos || ""]} · <RecordText text={r.meaning} label="저장한 뜻" /></div>
                <small>
                  실제 학습: {r.learnedOn || "이전 기록 · 날짜 미확인"}
                  {r.lastPracticedOn
                    ? ` · 최근 연습: ${r.lastPracticedOn}`
                    : ""}
                </small>
              </TableCell>
              <TableCell>
                {r.familiarity ? FAMILIARITY_TEXT[r.familiarity] : "미확인"}
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
                <div>{SENTENCE_TEXT[r.sentenceStatus]} · <RecordText text={r.sentence || "문장 기록 없음"} label="내 문장" lang="en" /></div>
                {r.sentenceStatus === "improve" && (
                  <span className="status-warn">문장 보완</span>
                )}
                {r.notes && <div className="record-note"><RecordText text={r.notes} label="보완점" /></div>}
              </TableCell>
              <TableCell>
                {sessionRecordComplete(s, r)
                  ? "다음에 다시 복습"
                  : nextAction(r, s)}
              </TableCell>
            </TableRow>
            {r.aiFeedback && <TableRow className="journal-feedback-row">
              <TableCell colSpan={6}>
                <details className="notes-details">
                  <summary aria-label={`${w?.word || '단어'} AI 참고 의견`}>AI 참고 의견</summary>
                  <FeedbackDetail feedback={r.aiFeedback} />
                </details>
              </TableCell>
            </TableRow>}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
});
