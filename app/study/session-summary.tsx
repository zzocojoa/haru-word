"use client";
import { exportLog } from "@/lib/learning";
import { ArrowRight, Check } from "lucide-react";
import { SessionRecords } from "../session-records";
import { download } from "../ui";
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
  completed,
  seconds,
  words,
  onClose,
  onReview,
  busy,
  onRepeat,
  resume,
  state,
}: SessionSummaryProps) {
  return (
    <section className="learning-panel session-summary">
      <div className="success-icon">
        <Check />
      </div>
      <p className="eyebrow">{saved ? "SESSION SAVED" : "SAVE PENDING"}</p>
      <h2>
        {saved
          ? s.date === date
            ? "오늘의 기록을 남겼어요."
            : s.date + "의 학습 기록이에요."
          : "기록 저장을 확인하고 있어요."}
      </h2>
      <p className="muted">
        {s.finished
          ? "회차를 마쳤어요."
          : "이 위치에서 다음에 이어갈 수 있어요."}{" "}
        미측정은 성공·실패로 계산하지 않아요.
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
          <b>{completed}</b>
          <span>이번 점검 완료</span>
        </div>
        <div>
          <b>
            {Math.floor(seconds / 60)}
            <small>분</small>
          </b>
          <span>누적 활동 시간</span>
        </div>
      </div>
      {s.retry.length > 0 && (
        <p className="notice">
          재시도 {s.retry.length}개가 남았어요. 다른 단어 두 개를 거칠 수 없었던
          항목은 ‘도움 필요’를 유지하고 다음 학습에 우선 배정해요.
        </p>
      )}
      <SessionRecords session={s} words={words} />
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
          이번 기록 받기
        </button>
      </div>
    </section>
  );
}
