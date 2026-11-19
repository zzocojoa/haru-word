"use client";
import {HaruPanel,HaruHeading,HaruParagraph} from '../haru-content';
import {HaruButton,HaruSelector} from '../haru-controls';

import { cardMeaning } from "@/lib/catalog-basics";
import { resumeMonthlyWriting } from '@/lib/learning/session-flow';
import {
  entryIdFor,
  practiceTargets,
  reviewTargets,
  reviewWeeks,
  sessionRecordMeasured,
  targetIdentity,
  weekStart,
  type Kind,
  type PracticeMode,
  type Session,
  type State,
  type Word,
} from "@/lib/learning";
import { HaruIcon } from "@/components/icons/haru-icon";
import { useMemo, useState } from "react";
import { useVocabularyState } from '../learning/use-vocabulary-state';
import { PendingReviews } from "../pending-reviews";
import { HelpDetails } from "../study-ui";
import { reviewSessionLabels } from '@/lib/learning-display';
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
export function ReviewDesk({
  state,
  start,
  busy,
  save,
  date,
}: Props & { date: string }) {
  const vocabulary = useVocabularyState(state);
  const [selectedWeek, setWeek] = useState<string | null>(null);
  const [selectedMonth, setMonth] = useState<string | null>(null);
  const sessionLabels = useMemo(() => reviewSessionLabels(state.sessions), [state.sessions]);
  const week = selectedWeek ?? weekStart(date),
    month = selectedMonth ?? date.slice(0, 7);
  const weeks = useMemo(
    () => reviewWeeks({ sessions: state.sessions }, date, week),
    [week, date, state.sessions],
  );
  const months = useMemo(
    () =>
      [
        ...new Set([
          month,
          date.slice(0, 7),
          ...Object.values(state.sessions)
            .filter((s) => s.kind === "monthly")
            .map((s) => s.period),
          ...Object.values(state.progress).flatMap(
            (p) => p.studyDates?.map((d) => d.slice(0, 7)) || [],
          ),
        ]),
      ]
        .sort()
        .reverse(),
    [month, date, state.progress, state.sessions],
  );
  const periodFields = useMemo(() => ({
    weekly: <HaruSelector label="주간 점검 기간" isLabelHidden containerClassName="haru-review-period" controlClassName="review-period" value={week}
      onChange={setWeek} options={weeks.map(period => ({value:period,label:period+'부터 한 주'}))} />,
    monthly: <HaruSelector label="월말 점검 기간" isLabelHidden containerClassName="haru-review-period" controlClassName="review-period" value={month}
      onChange={setMonth} options={months.map(period => ({value:period,label:period}))} />,
  }), [week, month, weeks, months]);
  const reviews = useMemo(
    () =>
      (["weekly", "monthly"] as const).map((kind) => {
        const period = kind === "weekly" ? week : month;
        const targets = reviewTargets(vocabulary, kind, period);
        const targetIds = targets.map((t) =>
          targetIdentity(t.entryId, t.meaning),
        );
        const sessions = Object.values(vocabulary.sessions)
          .map(resumeMonthlyWriting)
          .filter((s) => s.kind === kind && s.period === period)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
        const session = sessions.find((s) => !s.finished);
        const latest = sessions[0];
        const ids = [
          ...new Set([
            ...targetIds,
            ...(session?.ids.map((id) =>
              targetIdentity(
                entryIdFor(session, id),
                session.records[id].meaning,
              ),
            ) || []),
          ]),
        ];
        const retained = ids.length - targetIds.length;
        const checked = new Set(
          sessions.flatMap((s) =>
            Object.entries(s.records)
              .filter(([, r]) => sessionRecordMeasured(s, r))
              .map(([id, r]) => targetIdentity(entryIdFor(s, id), r.meaning)),
          ),
        );
        return { kind, period, ids, session, latest, checked, retained };
      }),
    [vocabulary, week, month],
  );
  const practices = useMemo(
    () =>
      (["known", "ko", "sentence"] as const).map((mode) => ({
        mode,
        ids: practiceTargets(vocabulary, mode, (id) =>
          ({ meaning: cardMeaning(id, vocabulary.progress[id]) }),
        ),
        session: Object.values(vocabulary.sessions).find(
          (s) =>
            s.kind === "practice" && s.practiceMode === mode && !s.finished,
        ),
      })),
    [vocabulary],
  );
  return (
    <>
      <PendingReviews
        state={state}
        busy={busy}
        onResume={(s) => start(s.kind, s.period, s)}
        excludeSessionIds={reviews.flatMap(r => r.session ? [r.session.id] : [])}
      />
      <div className="review-grid">
        {reviews.map(
          ({ kind, period, ids, session, latest, checked, retained }) => {
            return (
              <HaruPanel
                className="wide-panel review-card"
                data-review-kind={kind}
                key={kind}
              >
                <div className="review-icon">
                  <HaruIcon name={kind === "weekly" ? "calendar-repeat" : "calendar-pencil"} size={24} />
                </div>
                <HaruHeading level={2}>
                  {kind === "weekly"
                    ? "주간 점검"
                    : "월말 쓰기"}
                </HaruHeading>
                <HaruParagraph className="muted">
                  {kind === "weekly"
                    ? "그 주의 목표 단어 전체"
                    : "그달 배운 단어 전체 · 주간 통과 포함"}
                </HaruParagraph>
                {periodFields[kind]}
                <div className="review-count">
                  <b>{ids.length}</b>
                  <span>
                    전체 항목{" "}
                    <small>
                      점검함 {ids.filter((id) => checked.has(id)).length} · 미점검 {ids.filter((id) => !checked.has(id)).length}
                    </small>
                  </span>
                </div>
                {session && <HaruParagraph className="review-session-label small-note">{sessionLabels.get(session.id)?.number}회차 · {sessionLabels.get(session.id)?.started} 시작{sessionLabels.get(session.id)?.latest ? ' · 최신 회차' : ''}</HaruParagraph>}
                {retained > 0 && (
                  <HaruParagraph className="small-note">
                    날짜 변경 {retained}개 · 기존 점검의 답·순서 유지
                  </HaruParagraph>
                )}
                <HelpDetails title="점검 방식" className="review-checklist">
                  <HaruParagraph>
                    {kind === "weekly"
                      ? "뜻 확인 → 영어 단어 떠올리기 → 문장 쓰기"
                      : "뜻 보고 영어 단어 쓰기 → 문장 쓰기(선택)"}
                  </HaruParagraph>
                  <HaruParagraph>{kind === 'monthly' ? '미점검은 이 회차에 남아요. 실제 도움·문장 보완은 일일 복습에 반영해요.' : '도움 필요·미완료 항목은 다음 학습에 먼저 배정해요.'}</HaruParagraph>
                  <HaruParagraph>
                    {kind === "weekly"
                      ? "저장한 위치에서 다음에 이어 할 수 있어요."
                      : "설정한 개수씩 나누어 점검해요."}
                  </HaruParagraph>
                </HelpDetails>
                {kind === "monthly" && !session && (
                  <HaruSelector label="한 번에 점검할 단어 수" containerClassName="haru-review-batch" value={String(state.settings.monthlyBatchSize || 15)} disabled={busy}
                    onChange={value => save?.({...state,settings:{...state.settings,monthlyBatchSize:Number(value)}})}
                    options={[1,5,10,15].map(n => ({value:String(n),label:n+'개씩 · '+Math.ceil(ids.length/n)+'묶음'}))} />
                )}
                {!ids.length ? (
                  <div className="empty-note">
                    {kind === "weekly"
                      ? "그 주에 배정한 단어가 여기에 모여요."
                      : "일일 학습에서 뜻을 확인한 단어가 여기 모여요."}
                  </div>
                ) : (
                  <>
                    <HaruButton label={[(session
                        ? "중단한 점검 이어서"
                        : latest
                          ? "다시 점검하기"
                          : "전체 점검 시작")].join('')} variant="primary" endContent={<HaruIcon name="arrow-right" size={17} />}
                      className="haru-migrated primary-button full"
                      disabled={busy}
                      onClick={() => start(kind, period, session)}
                    >
                      {session
                        ? "중단한 점검 이어서"
                        : latest
                          ? "다시 점검하기"
                          : "전체 점검 시작"}

                    </HaruButton>
                    {session &&
                      ids.some(
                        (id) =>
                          !session.ids.some(
                            (key) =>
                              targetIdentity(
                                entryIdFor(session, key),
                                session.records[key].meaning,
                              ) === id,
                          ),
                      ) && (
                        <HaruParagraph className="small-note">
                          이어서 시작하면 추가 단어도 함께 확인해요. 기존 답과 순서는 유지돼요.
                        </HaruParagraph>
                      )}
                  </>
                )}
              </HaruPanel>
            );
          },
        )}
      </div>
      <HaruPanel className="wide-panel practice-desk">
        <HaruHeading level={2}>보완 연습</HaruHeading>
        <HaruParagraph className="muted">
          친숙도는 바뀌지 않아요. 한 번에 최대 20개를 연습해요.
        </HaruParagraph>
        {!practices.some(({ ids, session }) => ids.length || session) ? <HaruParagraph className="empty-practice" role="status">지금 보완할 항목이 없어요.</HaruParagraph> : <div className="practice-options">
          {practices.map(({ mode, ids, session }) => {
            return (
              <HaruButton label={[(mode === "known"
                    ? "아는 단어 다시 확인"
                    : mode === "ko"
                      ? "뜻→영어 추가 연습"
                      : "문장 보완 연습"),(" "),"· ",(session ? "이어서" : ids.length + "개")].join('')} variant="secondary" icon={<HaruIcon name={mode === "known" ? "repeat" : mode === "ko" ? "recall-card" : "sentence-write"} size={18} />}
                key={mode}
                className="haru-migrated secondary-button"
                disabled={busy || (!ids.length && !session)}
                onClick={() => start("practice", undefined, session, mode)}
              >

                <span>
                  {mode === "known"
                    ? "아는 단어 다시 확인"
                    : mode === "ko"
                      ? "뜻→영어 추가 연습"
                      : "문장 보완 연습"}{" "}
                  · {session ? "이어서" : ids.length + "개"}
                </span>
              </HaruButton>
            );
          })}
        </div>}
      </HaruPanel>
    </>
  );
}
