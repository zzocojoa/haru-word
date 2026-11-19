"use client";
import {HaruPanel,HaruHeading,HaruParagraph} from '../haru-content';
import {HaruButton} from '../haru-controls';

import { GrammarTermsHelp, PartOfSpeechLabel } from '../grammar-terms';
import { countDailyOrigins, dailyAllocationRule } from "@/lib/learning/daily-allocation";
import { todayWordStatuses, RECORD_STATUS_DISPLAY } from "@/lib/today-status";
import { useMemo, useState, type ReactNode } from "react";
import { useVocabularyState } from './use-vocabulary-state';
import { HelpDetails, StatusBadge } from "../study-ui";
import { HaruIcon } from "@/components/icons/haru-icon";
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
> & { imagePractice?: ReactNode };
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
  imagePractice,
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
  const assessment = state.settings.assessments[state.settings.level];
  const assessmentAction = assessment && !assessment.completed
    ? "친숙도 확인 이어서"
    : "단어 20개 친숙도 확인";
  const primaryAction = unfinished
    ? "중단한 학습 이어서"
    : initialAssessment
      ? assessmentAction
      : suggestions.length ? "오늘의 학습 시작" : "지금 배정할 단어가 없어요";
  return (
    <HaruPanel className="learning-panel home-panel">
      <div className="panel-top">
        <div className="today-date">
          <span>오늘</span>
          <time dateTime={date}>{year}년 {month}월 {day}일</time>
        </div>
        <LevelSelect
          value={state.settings.level}
          onChange={changeLevel}
          disabled={busy}
        />
      </div>
      <div className="home-title">
        <HaruHeading level={2}>
          {finished
            ? "오늘 회차를 마쳤어요"
            : unfinished
              ? "남은 단어를 이어서"
              : "오늘 배정"}
        </HaruHeading>
        {((!finished && !unfinished) || remaining > 0) && <HaruParagraph className="muted">
          {finished
            ? `목표까지 ${remaining}개 더 배울 수 있어요.`
            : unfinished
              ? `회차 후 ${remaining}개 추가 가능`
              : dailyAllocationRule(state.settings.dailyGoal, state.settings.newWordsPaused)}
        </HaruParagraph>}
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
          <span>학습 기록함</span>
          <b>
            {checked}<small>/ {visibleIds.length}개</small>
          </b>
        </div>
        {finished && !remaining ? (
          <div>
            <span>다음 학습 범위</span>
            <b>{state.settings.level}<small>{assessed ? "친숙도 확인함" : "친숙도 확인 전"}</small></b>
          </div>
        ) : (
          <div>
            <span>친숙도</span>
            <b>{assessed ? "확인함" : "확인 전"}</b>
          </div>
        )}
      </div>
      {(monthlyRepair.cleared > 0 || monthlyRepair.replacements.length > 0 || monthlyRepair.unavailable > 0) && (
        <section className="monthly-repair" aria-labelledby="monthly-repair-heading">
          <HaruHeading level={3} id="monthly-repair-heading">중복 배정 바로잡기</HaruHeading>
          <HaruParagraph>이전 월말 미점검 단어가 일일 복습에 잘못 들어갔어요.</HaruParagraph>
          <HaruParagraph>잘못된 복습 표시 {monthlyRepair.cleared}건 · 오늘 교체할 단어 {monthlyRepair.replacements.length}개</HaruParagraph>
          <HaruParagraph>오늘 답·문장·수정 내용을 저장하지 않은 단어만 교체해요. 과거 성적과 월말 점검은 유지돼요.</HaruParagraph>
          {monthlyRepair.unavailable > 0 && <HaruParagraph>대체 후보가 부족한 {monthlyRepair.unavailable}개는 유지해요. 새 단어 쉬기 설정이나 학습 수준을 확인해 주세요.</HaruParagraph>}
          <HaruButton label={["오늘 배정 바로잡기"].join('')} variant={'secondary'} className="haru-migrated secondary-button full" disabled={busy || !monthlyRepair.changed} onClick={correctMonthlyCarryover}>오늘 배정 바로잡기</HaruButton>
        </section>
      )}
      {finished ? (
        <div className="completed-actions">
          {remaining > 0 && suggestions.length > 0 && (
            <HaruButton label={["추가 ",(suggestions.length),"개 학습하기 "].join('')} variant={'primary'}
              className="haru-migrated primary-button full"
              disabled={busy}
              onClick={() => start("daily")}
             endContent={<HaruIcon name="plus" size={17} />}>
              추가 {suggestions.length}개 학습하기
            </HaruButton>
          )}
          {remaining > 0 && (
            <HaruParagraph className="small-note">
              {suggestions.length
                ? `추가 단어는 새 회차에 기록해요.${suggestions.length < remaining ? " 가능한 단어부터 배정해요." : ""}`
                : "현재 추가할 수 있는 단어가 없어요."}
            </HaruParagraph>
          )}
          <HaruButton label={["오늘 단어 다시 보기"].join('')} variant={(remaining && suggestions.length)?'secondary':'primary'}
            className={`haru-migrated ${remaining && suggestions.length
                ? "secondary-button full"
                : "primary-button full"}`}
            onClick={() => setReviewDate(date)}
           icon={<HaruIcon name="book-open" size={17} />}>

            오늘 단어 다시 보기
          </HaruButton>
          <HaruButton label={[(repeating ? "다시 학습 이어서" : "오늘 단어 다시 연습")].join('')} variant={'secondary'}
            className="haru-migrated secondary-button full"
            disabled={busy}
            onClick={() => repeat(date)}
           icon={<HaruIcon name="repeat" size={17} />}>

            {repeating ? "다시 학습 이어서" : "오늘 단어 다시 연습"}
          </HaruButton>
          <HaruParagraph className="small-note">기존 성적은 유지돼요.</HaruParagraph>
          <HaruButton label={["학습일 수정"].join('')} variant={'ghost'}
            className="haru-migrated text-button"
            disabled={busy}
            onClick={() => setCorrectingSession(todays.at(-1)!.id)}
          >
            학습일 수정
          </HaruButton>
          <HaruButton label={["오늘의 기록 보기 "].join('')} variant={'ghost'} className="haru-migrated text-button" onClick={() => setTab("log")} endContent={<HaruIcon name="record-file" size={17} />}>
            오늘의 기록 보기
          </HaruButton>
        </div>
      ) : (
        <HaruButton label={primaryAction} variant="primary"
          className="haru-migrated primary-button full"
          disabled={
            busy || (!unfinished && !initialAssessment && !suggestions.length)
          }
          onClick={() => start("daily")}
         endContent={<HaruIcon name="arrow-right" size={17} />}>
          {primaryAction}
        </HaruButton>
      )}
      {imagePractice}
      {(!finished || remaining > 0) && !unfinished && !initialAssessment && !suggestions.length && <div className="no-target-actions">
        <HaruParagraph className="small-note">{state.settings.newWordsPaused ? '새 단어 쉬기 설정을 확인해 주세요.' : '수준을 바꾸거나 친숙도를 다시 확인해 보세요.'}</HaruParagraph>
        <div className="button-row"><HaruButton label={["배정 설정 확인"].join('')} variant={'secondary'} className="haru-migrated secondary-button" disabled={busy} onClick={()=>setSettings(true)}>배정 설정 확인</HaruButton><HaruButton label={["친숙도 확인"].join('')} variant={'ghost'} className="haru-migrated text-button" disabled={busy} onClick={()=>void beginAssessment()}>친숙도 확인</HaruButton></div>
      </div>}
      <div className="today-words" role="region" aria-labelledby="today-targets-heading">
        <header>
          <HaruHeading level={3} id="today-targets-heading">{month}월 {day}일 목표 단어</HaruHeading>
          <small>{assigned ? `배정 ${assignedIds.length}개` : '시작 전 · 배정 예정'}</small>
        </header>
        <HaruParagraph className="daily-allocation">새 학습 {origins.newCount}개 · 이전 학습·복습 {origins.returning}개</HaruParagraph>
        {assigned && suggestions.length > 0 && <HaruParagraph className="small-note planned-allocation">추가 예정: 새 학습 {additions.newCount}개 · 복습 {additions.returning}개</HaruParagraph>}
        <HelpDetails title="오늘 배정 기준">
        <HaruParagraph className="today-targets-note">
          {assigned
            ? '오늘 배정 목록이며, 이전 단어도 복습으로 포함돼요.'
            : state.settings.newWordsPaused ? '오늘 시작하면 아래 복습 단어가 배정돼요.' : '시작하면 배정돼요. 새 단어와 보완·대기 복습을 함께 골라요.'}
          {assigned && remaining > 0 && ` 목표까지 ${remaining}개는 아직 배정 전이에요.`}
        </HaruParagraph>
        <HaruParagraph className="small-note">{state.settings.newWordsPaused ? '새 단어 쉬기 중에는 복습만 배정해요.' : '한쪽 후보가 부족하면 다른 쪽으로 채워요.'} 목표를 늘려도 기존 배정은 유지해요. 추가·재학습은 새 회차에 저장해요.</HaruParagraph>
        <HaruParagraph className="small-note">‘학습 기록함’은 답·문장 결과를 남긴 수이며 정답 수가 아니에요. 월말 점검이 남아도 다음 날 학습할 수 있어요.</HaruParagraph>
        </HelpDetails>
        <GrammarTermsHelp />
        <div className="target-filters" role="group" aria-label="오늘 단어 필터">
          <HaruButton label={["전체 ",(visibleIds.length)].join('')} variant={'secondary'} className="haru-migrated haru-native-action" type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>전체 {visibleIds.length}</HaruButton>
          <HaruButton label={["남은 단어 ",(visibleIds.length - checked)].join('')} variant={'secondary'} className="haru-migrated haru-native-action" type="button" aria-pressed={filter === 'remaining'} onClick={() => setFilter('remaining')}>남은 단어 {visibleIds.length - checked}</HaruButton>
        </div>
        {filteredIds.length === 0 && <HaruParagraph className="empty-note" role="status">{visibleIds.length ? '남은 단어가 없어요.' : '배정할 단어가 없어요.'}</HaruParagraph>}
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
                <small><PartOfSpeechLabel pos={w.pos} /> · {w.personal ? "개인 추가" : w.level}</small>
                <span className={`daily-origin ${origins.byId[id] === 'returning' ? 'returning' : 'new'}`}>
                  <HaruIcon name={origins.byId[id] === 'returning' ? 'repeat' : 'sparkle'} size={12} />
                  {origins.byId[id] === 'returning' ? '복습' : '새 학습'}
                </span>
              </div>
              <div className="today-word-status">
                {status.recordStatus && (
                  <StatusBadge
                    tone={RECORD_STATUS_DISPLAY[status.recordStatus].tone}
                    icon={<HaruIcon name={status.recordStatus === 'recorded' ? 'check' : 'unassessed'} size={14} />}
                  >
                    {RECORD_STATUS_DISPLAY[status.recordStatus].label}
                  </StatusBadge>
                )}
                {status.notices.some(n => n.warning) && (
                  <StatusBadge tone="warning" icon={<HaruIcon name="alert-circle" size={14} />}>
                    보완 필요
                  </StatusBadge>
                )}
                {<HelpDetails title="상태 상세"><HaruParagraph>{(origins.byId[id] === 'returning' ? '이전 학습·복습 항목' : '새 학습 항목')}</HaruParagraph><ul>{status.notices.map(notice => <li key={notice.label}>{notice.label}</li>)}</ul></HelpDetails>}
              </div>
            </div>
          );
        })}
      </div>
      {pendingReviewIds.length > 0 && (
        <details className="pending-daily-review notes-details" onToggle={e => setShowPendingReview(e.currentTarget.open)}>
          <summary>대기 중인 복습 {pendingReviewIds.length}개</summary>
          <HaruParagraph className="small-note">오늘 배정되지 않은 복습이에요. 다음 학습에서 다시 골라요. 주간·월말 점검과는 별도예요.</HaruParagraph>
          {showPendingReview && <ul aria-label="대기 중인 복습 단어" tabIndex={0}>
            {pendingReviewIds.slice(0, pendingLimit).map(id => {
              const word = wordById.get(id)!;
              return <li key={id}><span lang="en">{word.word}</span> <small><PartOfSpeechLabel pos={word.pos} /> · {word.level}</small></li>;
            })}
          </ul>}
          {showPendingReview && pendingReviewIds.length > pendingLimit && <HaruButton label={["복습 목록 더 보기 · ",(pendingReviewIds.length - pendingLimit),"개 남음"].join('')} variant={'ghost'} className="haru-migrated text-button" onClick={() => setPendingLimit(n => n + 20)}>복습 목록 더 보기 · {pendingReviewIds.length - pendingLimit}개 남음</HaruButton>}
        </details>
      )}
      {unfinished && <HaruParagraph className="small-note pause-note">중단한 위치와 입력은 저장돼요.</HaruParagraph>}
      {state.settings.newWordsPaused && (
        <HaruParagraph className="notice">
          새 단어 쉬기 중 · 남은 학습과 복습만 해요.
        </HaruParagraph>
      )}
      {new Date(date + "T12:00:00Z").getUTCDay() ===
        (state.settings.reviewDay ?? 0) && (
        <HaruButton label={["오늘은 정해 둔 주간 점검일이에요 →"].join('')} variant={'ghost'} className="haru-migrated text-button" onClick={() => setTab("review")}>
          오늘은 정해 둔 주간 점검일이에요 →
        </HaruButton>
      )}
    </HaruPanel>
  );
}
