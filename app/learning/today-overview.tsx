"use client";
import { POS, hasReviewWork } from "@/lib/learning";
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
  | "carry"
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
  carry,
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
            : unfinished && remaining
              ? `배우던 ${unfinished.ids.length}개를 먼저 마치면 목표까지 ${remaining}개를 추가할 수 있어요.`
              : carry
                ? `이월된 ${carry}개 중 오늘 목표 안에 먼저 배정해요.`
                : "헷갈리는 단어부터, 뜻을 넘어 나의 문장까지."}
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
        {date} 배정 · 이월·복습 {origins.returning}개 · 새 학습{" "}
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
            {finished ? "언제든 다시 볼 수 있어요" : "이월 → 헷갈림 → 처음"}
          </small>
        </header>
        {visibleIds.map((id, i) => {
          const w = words.find((w) => w.id === id)!;
          const p = state.progress[id];
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
              <span
                className={hasReviewWork(p) ? "status-warn" : "word-reason"}
              >
                {hasReviewWork(p)
                  ? finished
                    ? "보완할 단어"
                    : "이월"
                  : finished
                    ? "학습한 단어"
                    : p?.familiarity === "uncertain"
                      ? "헷갈리는 단어"
                      : p?.familiarity === "new"
                        ? "처음 보는 단어"
                        : "학습 후보"}
              </span>
            </div>
          );
        })}
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
      {(state.settings.newWordsPaused ||
        Object.values(state.sessions).some(
          (s) => s.kind === "monthly" && !s.finished,
        )) && (
        <p className="notice">
          신규 단어를 쉬고 있어요. 이월 단어와 진행 중인 월말 점검을 먼저
          마쳐요.
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
