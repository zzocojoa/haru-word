"use client";
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
  exportLog,
  exportTutor,
  FAMILIARITY_TEXT,
  KIND_TEXT,
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
import { ArrowRight, Download, NotebookPen } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { FeedbackDetail } from "../sentence-feedback";
import { SessionRecords } from "../session-records";
import { download } from "../ui";
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
  const sessions = useMemo(
    () =>
      Object.values(state.sessions).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    [state.sessions],
  );
  const [selected, setSelected] = useState("all");
  const [limit, setLimit] = useState(LOG_PAGE_SIZE);
  const list = useMemo(
    () => sessions.filter((s) => selected === "all" || s.kind === selected),
    [sessions, selected],
  );
  return (
    <section className="wide-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">LEARNING JOURNAL</p>
          <h2>쌓이는 나의 영어</h2>
          <p className="muted">
            친숙도, 양방향 회상, 문장 사용을 따로 기록해요.
          </p>
        </div>
        <div className="button-row">
          <button
            className="secondary-button"
            onClick={() =>
              download(
                "haru-words-" + date + ".csv",
                exportLog(state, words),
                "text/csv;charset=utf-8",
              )
            }
          >
            <Download size={16} />
            CSV 받기
          </button>
          <button
            className="text-button"
            onClick={() =>
              download(
                "haru-words-backup-" + date + ".json",
                JSON.stringify(
                  {
                    format: "haru-words-v1",
                    exportedAt: new Date(now()).toISOString(),
                    state,
                  },
                  null,
                  2,
                ),
              )
            }
          >
            전체 백업
          </button>
          <button
            className="text-button"
            data-backup-trigger
            disabled={busy}
            onClick={onRestoreOpen}
          >
            백업 가져오기
          </button>
          <button
            className="text-button"
            onClick={() =>
              download(
                "tutor-handoff-" + date + ".txt",
                exportTutor(state, words),
                "text/plain;charset=utf-8",
              )
            }
          >
            튜터 프롬프트·최근 기록 받기
          </button>
        </div>
      </div>
      <Select
        value={selected}
        onValueChange={(v) => {
          setSelected(v);
          setLimit(LOG_PAGE_SIZE);
        }}
      >
        <SelectTrigger aria-label="기록 종류 필터">
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
          <h3>첫 학습 기록을 기다리고 있어요.</h3>
          <p>오늘의 단어를 배우면 이곳에 기록이 쌓여요.</p>
        </div>
      ) : (
        <div className="journal-list">
          {list.slice(0, limit).map((s) => (
            <article className="journal-session" key={s.id}>
              <header>
                <div>
                  <span className="journal-date">{s.date}</span>
                  <span className="level-badge">
                    {s.practiceMode === "repeat"
                      ? "다시 학습 · " + s.period
                      : KIND_TEXT[s.kind]}
                  </span>
                  <span className="muted">
                    {s.ids.length}개 · {s.finished ? "회차 종료" : "진행 중"}
                  </span>
                </div>
                {s.finished && s.kind === "daily" && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => onCorrectDate(s.id)}
                    aria-label={`${s.date} ${s.ids.length}개 학습일 수정`}
                  >
                    학습일 수정
                  </button>
                )}
                {s.finished && s.kind === "daily" && (
                  <button
                    className="text-button"
                    onClick={() => onReview(s.date)}
                  >
                    단어 다시 보기 <ArrowRight size={15} />
                  </button>
                )}
                {!s.finished && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => start(s.kind, s.period, s)}
                  >
                    이어서 학습 <ArrowRight size={15} />
                  </button>
                )}
              </header>
              <div className="journal-mobile">
                <SessionRecords session={s} words={words} />
              </div>
              <div className="journal-desktop">
                <SessionLogTable session={s} words={words} />
              </div>
            </article>
          ))}
        </div>
      )}
      {list.length > 0 && (
        <p className="small-note" role="status">
          전체 {list.length.toLocaleString()}회차 중{" "}
          {Math.min(limit, list.length).toLocaleString()}회차를 보고 있어요.
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
