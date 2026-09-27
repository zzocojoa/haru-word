"use client";
import { POS } from "@/lib/learning";
import { countDailyOrigins, dailyAllocationRule } from "@/lib/learning/daily-allocation";
import { todayWordStatuses, RECORD_STATUS_DISPLAY } from "@/lib/today-status";
import { useMemo, useState } from "react";
import { useVocabularyState } from './use-vocabulary-state';
import { HelpDetails, StatusBadge } from "../study-ui";
import { ArrowRight, BookOpen, RotateCcw, Sparkles } from "lucide-react";
import { LevelSelect } from "../ui";
import type { LearningViewProps } from "./types";
type TodayOverviewProps = Pick<
  LearningViewProps,
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
  | "pendingReviewIds"
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
  | "setSettings"
  | "beginAssessment"
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
  pendingReviewIds,
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
  setSettings,
  beginAssessment,
  initialAssessment,
  monthlyRepair,
  correctMonthlyCarryover,
}: TodayOverviewProps) {
  const vocabulary = useVocabularyState(state);
  const statuses = useMemo(() => todayWordStatuses(vocabulary, visibleIds, date, unfinished),
    [vocabulary, visibleIds, date, unfinished]);
  const checked = visibleIds.filter(id => statuses[id].recordStatus === 'recorded').length;
  const assigned = assignedIds.length > 0;
  const [year, month, day] = date.split('-').map(Number);
  const [filter, setFilter] = useState<'all' | 'remaining'>('all');
  const [showPendingReview, setShowPendingReview] = useState(false);
  const [pendingLimit, setPendingLimit] = useState(20);
  const wordById = useMemo(() => new Map(words.map(w => [w.id, w])), [words]);
  const filteredIds = visibleIds.filter(id => filter === 'all' || statuses[id].recordStatus !== 'recorded');
  const additions = countDailyOrigins(suggestions, origins.byId);
  return (
    <section className="learning-panel home-panel">
      <div className="panel-top">
        <div className="today-date">
          <span>오늘 · 한국 시간</span>
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
            ? "오늘 회차를 마쳤어요"
            : unfinished
              ? "남은 단어를 이어서"
              : "오늘 목표 " + state.settings.dailyGoal + "개"}
        </h2>
        {(!finished || remaining > 0) && <p className="muted">
          {finished
            ? `목표까지 ${remaining}개 더 배울 수 있어요.`
            : unfinished
              ? `기록 완료 ${checked}/${assignedIds.length}개${remaining ? ` · 회차 후 ${remaining}개 추가 가능` : ''}`
              : dailyAllocationRule(state.settings.dailyGoal, state.settings.newWordsPaused)}
        </p>}
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
          <span>기록 완료</span>
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
          <button className="secondary-button full" disabled={busy || !monthlyRepair.changed} onClick={correctMonthlyCarryover}>오늘 배정 바로잡기</button>
        </section>
      )}
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
                ? `기존 기록 유지 · 추가 단어는 새 회차에 저장${suggestions.length < remaining ? " · 가능한 단어부터 배정" : ""}`
                : "현재 추가할 수 있는 단어가 없어요."}
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
          <p className="small-note">기존 성적은 유지돼요.</p>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => setCorrectingSession(todays.at(-1)!.id)}
          >
            학습일 수정
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
      {(!finished || remaining > 0) && !unfinished && !initialAssessment && !suggestions.length && <div className="no-target-actions">
        <p className="small-note">{state.settings.newWordsPaused ? '신규 단어 쉬기 설정을 확인해 주세요.' : '수준을 바꾸거나 친숙도를 다시 확인해 보세요.'}</p>
        <div className="button-row"><button className="secondary-button" disabled={busy} onClick={()=>setSettings(true)}>배정 설정 확인</button><button className="text-button" disabled={busy} onClick={()=>void beginAssessment()}>친숙도 확인</button></div>
      </div>}
      <div className="today-words" role="region" aria-labelledby="today-targets-heading">
        <header>
          <h3 id="today-targets-heading">{month}월 {day}일 목표 단어</h3>
          <small>{assigned ? `배정 ${assignedIds.length}개` : '시작 전 · 배정 예정'}</small>
        </header>
        <p className="daily-allocation">새 학습 {origins.newCount}개 · 이전 학습·복습 {origins.returning}개</p>
        {assigned && suggestions.length > 0 && <p className="small-note planned-allocation">추가 예정: 새 학습 {additions.newCount}개 · 복습 {additions.returning}개</p>}
        <HelpDetails title="오늘 배정 기준">
        <p className="today-targets-note">
          {assigned
            ? '오늘 배정 목록이며, 이전 단어도 복습으로 포함돼요.'
            : state.settings.newWordsPaused ? '오늘 시작하면 아래 복습 단어가 배정돼요.' : '시작하면 배정돼요. 새 단어와 보완·대기 복습을 함께 골라요.'}
          {assigned && remaining > 0 && ` 목표까지 ${remaining}개는 아직 배정 전이에요.`}
        </p>
        <p className="small-note">{state.settings.newWordsPaused ? '신규 단어 쉬기 중에는 복습만 배정해요.' : '한쪽 후보가 부족하면 다른 쪽으로 채워요.'} 목표를 늘려도 기존 배정은 유지해요. 추가·재학습은 새 회차에 저장해요.</p>
        <p className="small-note">기록 완료는 회상·문장 결과를 남긴 수예요. 독립 성공과는 달라요. 월말 점검이 남아 있어도 다음 날 학습할 수 있어요.</p>
        </HelpDetails>
        <div className="target-filters" role="group" aria-label="오늘 단어 필터">
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>전체 {visibleIds.length}</button>
          <button type="button" aria-pressed={filter === 'remaining'} onClick={() => setFilter('remaining')}>남은 단어 {visibleIds.length - checked}</button>
        </div>
        {filteredIds.length === 0 && <p className="empty-note" role="status">{visibleIds.length ? '남은 단어가 없어요.' : '배정할 단어가 없어요.'}</p>}
        {filteredIds.map((id) => {
          const i = visibleIds.indexOf(id);
          const w = wordById.get(id)!;
          const status = statuses[id];
          return (
            <div key={id} className="today-word-row">
              <span className="today-word-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <b lang="en">{w.word}</b>
                <small>{POS[w.pos]} · {w.personal ? "개인 추가" : w.level}</small>
                <span className={`daily-origin ${origins.byId[id] === 'returning' ? 'returning' : 'new'}`}>{origins.byId[id] === 'returning' ? <RotateCcw size={12} aria-hidden="true"/> : <Sparkles size={12} aria-hidden="true"/>}{origins.byId[id] === 'returning' ? '복습' : '새 학습'}</span>
              </div>
              <div className="today-word-status">
                {status.recordStatus && <StatusBadge tone={RECORD_STATUS_DISPLAY[status.recordStatus].tone}>{RECORD_STATUS_DISPLAY[status.recordStatus].label}</StatusBadge>}
                {status.notices.some(n => n.warning) && <StatusBadge tone="warning">보완 필요</StatusBadge>}
                {<HelpDetails title="상태 상세"><p>{(origins.byId[id] === 'returning' ? '이전 학습·복습 항목' : '새 학습 항목')}</p><ul>{status.notices.map(notice => <li key={notice.label}>{notice.label}</li>)}</ul></HelpDetails>}
              </div>
            </div>
          );
        })}
      </div>
      {pendingReviewIds.length > 0 && (
        <details className="pending-daily-review notes-details" onToggle={e => setShowPendingReview(e.currentTarget.open)}>
          <summary>대기 중인 복습 {pendingReviewIds.length}개</summary>
          <p className="small-note">오늘 미배정 복습 · 다음 배정에서 다시 골라요. 주간·월말 점검과 별도예요.</p>
          {showPendingReview && <ul aria-label="대기 중인 복습 단어" tabIndex={0}>
            {pendingReviewIds.slice(0, pendingLimit).map(id => {
              const word = wordById.get(id)!;
              return <li key={id}><span lang="en">{word.word}</span> <small>{POS[word.pos]} · {word.level}</small></li>;
            })}
          </ul>}
          {showPendingReview && pendingReviewIds.length > pendingLimit && <button className="text-button" onClick={() => setPendingLimit(n => n + 20)}>복습 목록 더 보기 · {pendingReviewIds.length - pendingLimit}개 남음</button>}
        </details>
      )}
      {unfinished && <p className="small-note pause-note">중단한 위치와 입력은 저장돼요.</p>}
      {state.settings.newWordsPaused && (
        <p className="notice">
          신규 단어 쉬기 켜짐 · 남은 학습·복습만 배정해요.
        </p>
      )}
      {new Date(date + "T12:00:00Z").getUTCDay() ===
        (state.settings.reviewDay ?? 0) && (
        <button className="text-button" onClick={() => setTab("review")}>
          오늘은 정해 둔 주간 점검일이에요 →
        </button>
      )}
      <p className="small-note centered">
        약 15분 · 한국 시간 자정에 다음 학습일
      </p>
    </section>
  );
}
