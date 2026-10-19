"use client";
import { exportLog } from "@/lib/learning";
import { ArrowRight, Check, CircleDashed } from "lucide-react";
import { SessionRecords } from "../session-records";
import { download } from "../ui";
import { sessionCounts } from '@/lib/learning-display';
import type { StudySessionController } from "./use-study-session-controller";
type SessionSummaryProps = Pick<
  StudySessionController,
  | "saved"
  | "s"
  | "date"
  | "total"
  | "completed"
  | "seconds"
  | "words"
  | "onClose"
  | "onReview"
  | "busy"
  | "onRepeat"
  | "resume"
  | "state"
>;
export function SessionSummary({
  saved,
  s,
  date,
  total,
  seconds,
  words,
  onClose,
  onReview,
  busy,
  onRepeat,
  resume,
  state,
}: SessionSummaryProps) {
  const counts = sessionCounts(s);
  return (
    <section className="learning-panel session-summary">
      <div className={saved ? "success-icon" : "summary-pending-icon"} aria-hidden="true">
        {saved ? <Check /> : <CircleDashed />}
      </div>
      <h2>
        {saved
          ? s.date === date
            ? "학습 기록을 저장했어요"
            : s.date + "의 학습 기록이에요."
          : "기록 저장을 확인하고 있어요."}
      </h2>
      <p className="muted">
        {s.finished
          ? "회차 마침"
          : "이 위치에서 다음에 이어갈 수 있어요."}{" "}
        아직 확인하지 않은 항목은 성공·실패에 포함하지 않아요.
      </p>
      {s.date !== date && (
        <p className="notice">
          {s.date}에 시작한 회차입니다. 오늘({date})의 목록은 ‘학습 홈으로’에서
          확인하세요.
        </p>
      )}
      <div className="summary-numbers">
        <div>
          <b>{total}</b>
          <span>목표 단어</span>
        </div>
        <div>
          <b>{counts.recorded}</b>
          <span>학습 기록함</span>
        </div>
        <div>
          <b>
            {Math.floor(seconds / 60)}
            <small>분</small>
          </b>
          <span>누적 활동 시간</span>
        </div>
      </div>
      <p className="small-note">도움 없이 성공 {counts.successful} · 보완 필요 {counts.needsHelp} · 아직 확인 안 함 {counts.unmeasured}</p>
      {s.retry.length > 0 && (
        <p className="notice">
          재시도 {s.retry.length}개는 ‘도움 필요’로 남아 다음 학습에 우선 배정돼요.
        </p>
      )}
      <div className="button-row">
        <button className="primary-button" onClick={onClose}>
          학습 홈으로 <ArrowRight size={17} />
        </button>
        {s.finished && (s.kind === "daily" || s.practiceMode === "repeat") && (
          <>
            <button
              className="secondary-button"
              onClick={() =>
                onReview(s.practiceMode === "repeat" ? s.period : s.date)
              }
            >
              단어 다시 보기
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                onRepeat(s.practiceMode === "repeat" ? s.period : s.date)
              }
            >
              다시 학습하기
            </button>
          </>
        )}
        {!s.finished && (
          <button className="secondary-button" disabled={busy} onClick={resume}>
            이어서 학습
          </button>
        )}
        <button
          className="text-button"
          onClick={() =>
            download(
              "session-" + s.date + ".csv",
              exportLog({ ...state, sessions: { [s.id]: s } }, words),
              "text/csv;charset=utf-8",
            )
          }
        >
          이번 기록 CSV 받기
        </button>
      </div>
      <SessionRecords session={s} words={words} compact />
    </section>
  );
}
