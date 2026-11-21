"use client";
import {HaruPanel,HaruHeading,HaruParagraph} from '../haru-content';
import {HaruButton} from '../haru-controls';

import { exportLog } from "@/lib/learning";
import type { Ref } from "react";
import { ArrowRight } from "lucide-react";
import { HaruIcon } from "@/components/icons/haru-icon";
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
> & { headingRef?: Ref<HTMLHeadingElement> };
export function SessionSummary({
  headingRef,
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
    <HaruPanel className="learning-panel session-summary">
      <div className={saved ? "success-icon" : "summary-pending-icon"} aria-hidden="true">
        <HaruIcon name={saved ? "cloud-saved" : "unassessed"} size={24} />
      </div>
      <HaruHeading level={2} ref={headingRef} tabIndex={-1}>
        {saved
          ? s.date === date
            ? "학습 기록을 저장했어요"
            : s.date + "의 학습 기록이에요."
          : "기록 저장을 확인하고 있어요."}
      </HaruHeading>
      <HaruParagraph className="muted">
        {s.finished
          ? "회차 마침"
          : "여기서 이어갈 수 있어요."}{" "}
        성공·실패 집계에서 미점검은 제외해요.
      </HaruParagraph>
      {s.date !== date && (
        <HaruParagraph className="notice">
          {s.date}에 시작한 회차입니다. 오늘({date})의 목록은 ‘학습 홈으로’에서
          확인하세요.
        </HaruParagraph>
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
      <HaruParagraph className="small-note">도움 없이 성공 {counts.successful} · 보완 필요 {counts.needsHelp} · 아직 확인 안 함 {counts.unmeasured}</HaruParagraph>
      {s.retry.length > 0 && (
        <HaruParagraph className="notice">
          재시도 {s.retry.length}개는 ‘도움 필요’로 남아 다음 학습에 우선 배정돼요.
        </HaruParagraph>
      )}
      <div className="button-row">
        <HaruButton label={["학습 홈으로 "].join('')} variant="primary" endContent={<ArrowRight size={17} />} className="haru-migrated primary-button" onClick={onClose}>
          학습 홈으로
        </HaruButton>
        {s.finished && (s.kind === "daily" || s.practiceMode === "repeat") && (
          <>
            <HaruButton label={["단어 다시 보기"].join('')} variant="secondary"
              className="haru-migrated secondary-button"
              onClick={() =>
                onReview(s.practiceMode === "repeat" ? s.period : s.date)
              }
            >
              단어 다시 보기
            </HaruButton>
            <HaruButton label={["다시 학습하기"].join('')} variant="secondary"
              className="haru-migrated secondary-button"
              disabled={busy}
              onClick={() =>
                onRepeat(s.practiceMode === "repeat" ? s.period : s.date)
              }
            >
              다시 학습하기
            </HaruButton>
          </>
        )}
        {!s.finished && (
          <HaruButton label={["이어서 학습"].join('')} variant="secondary" className="haru-migrated secondary-button" disabled={busy} onClick={resume}>
            이어서 학습
          </HaruButton>
        )}
        <HaruButton label={["이번 기록 CSV 받기"].join('')} variant="ghost"
          className="haru-migrated text-button"
          onClick={() =>
            download(
              "session-" + s.date + ".csv",
              exportLog({ ...state, sessions: { [s.id]: s } }, words),
              "text/csv;charset=utf-8",
            )
          }
        >
          이번 기록 CSV 받기
        </HaruButton>
      </div>
      <SessionRecords session={s} words={words} compact />
    </HaruPanel>
  );
}
