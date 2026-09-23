"use client";
import { POS } from "@/lib/learning";
import { todayWordStatuses } from "@/lib/today-status";
import { useMemo } from "react";
import { ArrowRight, BookOpen, RotateCcw } from "lucide-react";
import { LevelSelect } from "../ui";
import type { LearningController } from "./use-learning-controller";
type TodayOverviewProps = Pick<
  LearningController,
  | "date"
  | "state"
  | "changeLevel"
  | "busy"
  | "finished"
  | "unfinished"
  | "remaining"
  | "assignedIds"
  | "assessed"
  | "origins"
  | "todays"
  | "visibleIds"
  | "words"
  | "suggestions"
  | "start"
  | "setReviewDate"
  | "repeat"
  | "repeating"
  | "setCorrectingSession"
  | "setTab"
  | "initialAssessment"
>;
export function TodayOverview({
  date,
  state,
  changeLevel,
  busy,
  finished,
  unfinished,
  remaining,
  assignedIds,
  assessed,
  origins,
  todays,
  visibleIds,
  words,
  suggestions,
  start,
  setReviewDate,
  repeat,
  repeating,
  setCorrectingSession,
  setTab,
  initialAssessment,
}: TodayOverviewProps) {
  const statuses = useMemo(() => todayWordStatuses(state, visibleIds, date, unfinished),
    [state, visibleIds, date, unfinished]);
  const checked = visibleIds.filter(id => statuses[id].learning === '오늘 학습 완료').length;
  const monthlyPending = Object.values(state.sessions).some(s => s.kind === 'monthly' && !s.finished);
  return (
    <section className="learning-panel home-panel">
      <div className="panel-top">
        <span className="eyebrow">
          <time dateTime={date}>{date}</time>오늘의 학습 노트
        </span>
        <LevelSelect
          value={state.settings.level}
          onChange={changeLevel}
          disabled={busy}
        />
      </div>
      <div className="home-title">
        <h2>
          {finished
            ? "오늘의 작은 성취를 쌓았어요."
            : unfinished
              ? "배우던 단어를 이어서 만나요."
              : "오늘, 단어 " + state.settings.dailyGoal + "개만 내 것으로."}
        </h2>
        <p className="muted">
          {finished
            ? remaining
              ? `오늘 ${assignedIds.length}개 학습을 마쳤어요. 목표 ${state.settings.dailyGoal}개까지 ${remaining}개를 더 배울 수 있어요.`
              : "오늘 단어를 다시 살펴보거나, 같은 단어로 한 번 더 학습해 보세요."
            : unfinished
              ? `이번 회차 ${visibleIds.length}개 중 ${checked}개의 회상·문장 결과를 기록했어요.${remaining ? ` 회차를 마치면 목표까지 ${remaining}개를 추가할 수 있어요.` : ' 남은 단계부터 이어서 해요.'}`
              : "남은 학습·복습 → 헷갈리는 단어 → 처음 보는 단어 순으로 배정해요."}
        </p>
      </div>
      <div className="daily-metrics">
        <div>
          <span>오늘의 목표</span>
          <b>
            {Math.max(assignedIds.length, state.settings.dailyGoal)}
            <small>단어</small>
          </b>
        </div>
        <div>
          <span>나를 위한 시간</span>
          <b>
            15<small>분</small>
          </b>
        </div>
        <div>
          <span>{finished && !remaining ? "다음 학습 범위" : "학습 범위"}</span>
          <b>
            {state.settings.level}
            <small>{assessed ? "탐색 완료" : "임시 시작점"}</small>
          </b>
        </div>
      </div>
      <p className="daily-allocation">
        {date} 배정 · 이전 학습·복습 {origins.returning}개 · 새 학습{" "}
        {origins.newCount}개
      </p>
      <div className="today-words">
        <header>
          <span>
            {finished
              ? "오늘 배운 단어"
              : unfinished
                ? todays.length > 1
                  ? "이번 회차 목표 단어"
                  : "오늘의 목표 단어"
                : "오늘 만날 단어"}
          </span>
          <small>
            {finished ? "언제든 다시 볼 수 있어요" : unfinished ? "오늘의 진행과 복습 상태" : "배정 이유"}
          </small>
        </header>
        {visibleIds.map((id, i) => {
          const w = words.find((w) => w.id === id)!;
          const status = statuses[id];
          return (
            <div key={id}>
              <span className="today-word-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <b lang="en">{w.word}</b>
                <small>
                  {POS[w.pos]} · {w.personal ? "개인 추가" : w.level}
                </small>
              </div>
              <div className="today-word-status">
                {status.learning && <span className={status.learning === '오늘 학습 완료' ? 'status-good' : 'today-progress'}>{status.learning}</span>}
                {status.notices.map(notice => <span key={notice.label}
                  className={notice.warning ? 'status-warn' : 'today-review'}>{notice.label}</span>)}
              </div>
            </div>
          );
        })}
        <p className="today-status-guide">오늘의 진행과 정기 점검은 따로 표시해요. 점검 대기는 아직 확인하지 않은 항목이에요.</p>
      </div>
      {finished ? (
        <div className="completed-actions">
          {remaining > 0 && suggestions.length > 0 && (
            <button
              className="primary-button full"
              disabled={busy}
              onClick={() => start("daily")}
            >
              추가 {suggestions.length}개 학습하기 <ArrowRight size={17} />
            </button>
          )}
          {remaining > 0 && (
            <p className="small-note">
              {suggestions.length
                ? `기존 ${assignedIds.length}개 기록은 그대로 두고, 추가 단어를 새 회차에 저장해요.${suggestions.length < remaining ? " 현재 배정 가능한 단어부터 시작해요." : ""}`
                : "현재 추가할 수 있는 단어가 없어요. 신규 단어 쉬기 설정이나 학습 수준·친숙도를 확인해 주세요."}
            </p>
          )}
          <button
            className={
              remaining && suggestions.length
                ? "secondary-button full"
                : "primary-button full"
            }
            onClick={() => setReviewDate(date)}
          >
            <BookOpen size={17} />
            오늘 단어 다시 보기
          </button>
          <button
            className="secondary-button full"
            disabled={busy}
            onClick={() => repeat(date)}
          >
            <RotateCcw size={17} />
            {repeating ? "오늘 단어 다시 학습 이어서" : "오늘 단어 다시 학습"}
          </button>
          <p className="small-note">
            기존 완료 기록은 유지하고, 다시 학습한 결과는 별도 회차로 저장해요.
          </p>
          <p className="small-note">
            오늘 배정한 {assignedIds.length}개 회차를 종료했어요. 다음
            학습일에는 이월 단어부터 목표를 다시 정해요.
          </p>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => setCorrectingSession(todays.at(-1)!.id)}
          >
            이 학습을 다른 날 했나요? 학습일 수정
          </button>
          <button className="text-button" onClick={() => setTab("log")}>
            오늘의 기록 보기 <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        <button
          className="primary-button full"
          disabled={
            busy || (!unfinished && !initialAssessment && !suggestions.length)
          }
          onClick={() => start("daily")}
        >
          {unfinished
            ? "중단한 학습 이어서"
            : initialAssessment
              ? "20개 친숙도부터 확인"
              : !suggestions.length
                ? "지금 배정할 단어가 없어요"
                : "오늘의 학습 시작"}
          <ArrowRight size={17} />
        </button>
      )}
      {unfinished && <p className="small-note">‘오늘 종료 · 저장’은 중단한 위치를 저장해요. 남은 단계까지 마치면 오늘 회차가 완료돼요.</p>}
      {(state.settings.newWordsPaused || monthlyPending) && (
        <p className="notice">
          {monthlyPending
            ? '진행 중인 월말 점검이 있어 새 단어 배정을 잠시 쉬고 있어요. 아래 ‘이어서 할 점검’에서 계속할 수 있어요.'
            : '설정에서 신규 단어 쉬기를 켜 두었어요. 남은 학습·복습 항목만 배정해요.'}
          {monthlyPending && state.settings.newWordsPaused && ' 신규 단어 쉬기 설정도 켜져 있어, 점검 후 새 단어를 배우려면 설정에서 꺼 주세요.'}
        </p>
      )}
      {new Date(date + "T12:00:00Z").getUTCDay() ===
        (state.settings.reviewDay ?? 0) && (
        <button className="text-button" onClick={() => setTab("review")}>
          오늘은 정해 둔 주간 점검일이에요 →
        </button>
      )}
      <p className="small-note centered">
        답을 먼저 보지 않고, 스스로 떠올리는 연습을 해요.
      </p>
    </section>
  );
}
