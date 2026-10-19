"use client";
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
import { ArrowRight, NotebookPen, RotateCcw } from "lucide-react";
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
              <section
                className="wide-panel review-card"
                data-review-kind={kind}
                key={kind}
              >
                <div className="review-icon">
                  {kind === "weekly" ? <RotateCcw /> : <NotebookPen />}
                </div>
                <h2>
                  {kind === "weekly"
                    ? "주간 점검"
                    : "월말 쓰기"}
                </h2>
                <p className="muted">
                  {kind === "weekly"
                    ? "그 주의 목표 단어 전체"
                    : "그달 배운 단어 전체 · 주간 통과 포함"}
                </p>
                <select
                  className="review-period"
                  aria-label={kind === "weekly" ? "주간 점검 기간" : "월말 점검 기간"}
                  value={period}
                  onChange={(event) => (kind === "weekly" ? setWeek : setMonth)(event.target.value)}
                >
                    {(kind === "weekly" ? weeks : months).map((p) => (
                      <option key={p} value={p}>
                        {p}
                        {kind === "weekly" ? "부터 한 주" : ""}
                      </option>
                    ))}
                </select>
                <div className="review-count">
                  <b>{ids.length}</b>
                  <span>
                    전체 항목{" "}
                    <small>
                      점검함 {ids.filter((id) => checked.has(id)).length} · 미점검 {ids.filter((id) => !checked.has(id)).length}
                    </small>
                  </span>
                </div>
                {session && <p className="review-session-label small-note">{sessionLabels.get(session.id)?.number}회차 · {sessionLabels.get(session.id)?.started} 시작{sessionLabels.get(session.id)?.latest ? ' · 최신 회차' : ''}</p>}
                {retained > 0 && (
                  <p className="small-note">
                    날짜 변경 {retained}개 · 기존 점검의 답·순서 유지
                  </p>
                )}
                <HelpDetails title="점검 방식" className="review-checklist">
                  <p>
                    {kind === "weekly"
                      ? "뜻 확인 → 영어 단어 떠올리기 → 문장 쓰기"
                      : "뜻 보고 영어 단어 쓰기 → 문장 쓰기(선택)"}
                  </p>
                  <p>{kind === 'monthly' ? '미점검은 이 회차에 남아요. 실제 도움·문장 보완은 일일 복습에 반영해요.' : '도움 필요·미완료 항목은 다음 학습에 먼저 배정해요.'}</p>
                  <p>
                    {kind === "weekly"
                      ? "저장한 위치에서 다음에 이어 할 수 있어요."
                      : "설정한 개수씩 나누어 점검해요."}
                  </p>
                </HelpDetails>
                {kind === "monthly" && !session && (
                  <label>
                    한 번에 점검할 단어 수
                    <select
                      aria-label="월말 묶음 크기"
                      value={state.settings.monthlyBatchSize || 15}
                      disabled={busy}
                      onChange={(e) =>
                        save?.({
                          ...state,
                          settings: {
                            ...state.settings,
                            monthlyBatchSize: Number(e.target.value),
                          },
                        })
                      }
                    >
                      {[1, 5, 10, 15].map((n) => (
                        <option key={n} value={n}>
                          {n}개씩 · {Math.ceil(ids.length / n)}묶음
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {!ids.length ? (
                  <div className="empty-note">
                    {kind === "weekly"
                      ? "그 주에 배정한 단어가 여기에 모여요."
                      : "일일 학습에서 뜻을 확인한 단어가 여기 모여요."}
                  </div>
                ) : (
                  <>
                    <button
                      className="primary-button full"
                      disabled={busy}
                      onClick={() => start(kind, period, session)}
                    >
                      {session
                        ? "중단한 점검 이어서"
                        : latest
                          ? "다시 점검하기"
                          : "전체 점검 시작"}
                      <ArrowRight size={17} />
                    </button>
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
                        <p className="small-note">
                          이어서 시작하면 추가 단어도 함께 확인해요. 기존 답과 순서는 유지돼요.
                        </p>
                      )}
                  </>
                )}
              </section>
            );
          },
        )}
      </div>
      <section className="wide-panel practice-desk">
        <h2>보완 연습</h2>
        <p className="muted">
          친숙도는 바뀌지 않아요. 한 번에 최대 20개를 연습해요.
        </p>
        {!practices.some(({ ids, session }) => ids.length || session) ? <p className="empty-practice" role="status">지금 보완할 항목이 없어요.</p> : <div className="practice-options">
          {practices.map(({ mode, ids, session }) => {
            return (
              <button
                key={mode}
                className="secondary-button"
                disabled={busy || (!ids.length && !session)}
                onClick={() => start("practice", undefined, session, mode)}
              >
                {mode === "known"
                  ? "아는 단어 다시 확인"
                  : mode === "ko"
                    ? "뜻→영어 추가 연습"
                    : "문장 보완 연습"}{" "}
                · {session ? "이어서" : ids.length + "개"}
              </button>
            );
          })}
        </div>}
      </section>
    </>
  );
}
