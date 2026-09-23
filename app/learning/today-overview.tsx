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
  | "monthlyRepair"
  | "correctMonthlyCarryover"
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
  monthlyRepair,
  correctMonthlyCarryover,
}: TodayOverviewProps) {
  const statuses = useMemo(() => todayWordStatuses(state, visibleIds, date, unfinished),
    [state, visibleIds, date, unfinished]);
  const checked = visibleIds.filter(id => statuses[id].learning === '오늘 학습 완료').length;
  const monthlyPending = Object.values(state.sessions).some(s => s.kind === 'monthly' && !s.finished);
  const assigned = assignedIds.length > 0;
  const [year, month, day] = date.split('-').map(Number);
  return (
    <section className="learning-panel home-panel">
      <div className="panel-top">
        <div className="today-date">
          <span>오늘의 학습일 · 한국 시간</span>
          <time dateTime={date}>{year}년 {month}월 {day}일</time>
        </div>
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
              ? `오늘 배정한 전체 ${assignedIds.length}개 중 ${checked}개의 회상·문장 결과를 기록했어요.${remaining ? ` 회차를 마치면 목표까지 ${remaining}개를 추가할 수 있어요.` : ' 남은 단계부터 이어서 해요.'}`
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
          <span>오늘 연습 완료</span>
          <b>
            {checked}<small>/ {visibleIds.length}개</small>
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
      {(monthlyRepair.cleared > 0 || monthlyRepair.replacements.length > 0 || monthlyRepair.unavailable > 0) && (
        <section className="monthly-repair" aria-label="중복 배정 바로잡기">
          <h3>완료한 단어가 다시 배정되었나요?</h3>
          <p>이전 월말 점검의 미측정 항목이 일일 복습으로 표시된 기록을 찾았어요.</p>
          <p>잘못된 복습 표시 {monthlyRepair.cleared}건 · 오늘 교체할 단어 {monthlyRepair.replacements.length}개</p>
          <p>과거 성적과 월말 점검은 유지하고, 오늘 답·문장·수정 내용을 저장하지 않은 단어만 교체해요.</p>
          {monthlyRepair.unavailable > 0 && <p>대체 후보가 부족한 {monthlyRepair.unavailable}개는 유지해요. 신규 단어 쉬기 설정이나 학습 수준을 확인해 주세요.</p>}
          <button className="secondary-button full" disabled={busy || monthlyRepair.state === state} onClick={correctMonthlyCarryover}>오늘 배정 바로잡기</button>
        </section>
      )}
      <div className="today-words" role="region" aria-labelledby="today-targets-heading">
        <header>
          <h3 id="today-targets-heading">{month}월 {day}일 목표 단어</h3>
          <small>{assigned ? `배정 ${assignedIds.length}개` : '시작 전 · 배정 예정'}</small>
        </header>
        <p className="daily-allocation">새 학습 {origins.newCount}개 · 이전 학습·복습 {origins.returning}개</p>
        <p className="today-targets-note">
          {assigned
            ? '아래는 오늘 날짜에 배정된 전체 목록이에요. 이전에 본 단어도 오늘의 복습 목표에 포함돼요.'
            : '오늘 시작하면 아래 단어가 배정돼요. 미완료·보완 단어부터 채우고, 남은 목표 수에 새 단어를 넣어요.'}
          {assigned && remaining > 0 && ` 목표까지 ${remaining}개는 아직 배정 전이에요.`}
        </p>
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
        <p className="today-status-guide">오늘 연습 완료는 양방향 회상과 문장 결과를 모두 기록한 단어 수예요. 주간·월말 점검은 아래에서 별도로 이어가요.</p>
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
          {state.settings.newWordsPaused
            ? '설정에서 신규 단어 쉬기를 켜 두었어요. 남은 학습·복습 항목만 배정해요. 새 단어도 배우려면 설정에서 꺼 주세요.'
            : '월말 점검이 남아 있어도 오늘과 다음 날 학습을 시작할 수 있어요. 미완료·보완 단어로 목표가 차면 새 단어는 배정되지 않을 수 있어요.'}
        </p>
      )}
      {new Date(date + "T12:00:00Z").getUTCDay() ===
        (state.settings.reviewDay ?? 0) && (
        <button className="text-button" onClick={() => setTab("review")}>
          오늘은 정해 둔 주간 점검일이에요 →
        </button>
      )}
      <p className="small-note centered">
        하루 약 15분 · 한국 시간 자정에 다음 학습일로 바뀌어요.
      </p>
    </section>
  );
}
