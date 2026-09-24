"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  Info,
  NotebookPen,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { Suspense, lazy, useCallback, useRef } from "react";
import type { GrammarLeave } from './grammar/use-grammar-draft';
import { CompletedLesson } from "./completed-lesson";
import { CandidatePreparation } from "./learning/candidate-preparation";
import { FamiliarityAssessment } from "./learning/familiarity-assessment";
import { LearningAside } from "./learning/learning-aside";
import { AvailabilityNotice } from "./learning/availability-notice";
import { SaveStatus } from "./learning/save-status";
import { LearningMessage } from './learning/learning-message';
import { SettingsDialog } from "./learning/settings-dialog";
import { SourceDialog } from "./learning/source-dialog";
import { TodayOverview } from "./learning/today-overview";
import type { View } from "./learning/types";
import { useLearningController } from "./learning/use-learning-controller";
import { PendingReviews } from "./pending-reviews";
import { LearningLog, ReviewDesk } from "./review-and-log";
import { StudyDateDialog } from "./study-date-dialog";
import { StudySession } from "./study-session";
import { WordLibrary } from "./word-library";
import { useKeyboardInset } from "./use-keyboard-inset";
import { useTabPosition } from "./use-tab-position";

const BackupDialog = lazy(() => import("./backup-dialog"));
export default function LearningApp({
  initialServerTime,
  grammarEnabled = false,
}: {
  initialServerTime: number;
  grammarEnabled?: boolean;
}) {
  const {
    tab,
    showSession,
    active,
    assessing,
    preparing,
    unsaved,
    saving,
    loading,
    signedIn,
    setSettings,
    date,
    store,
    setTab,
    error,
    saveError,
    conflict,
    state,
    message,
    messageId,
    dismissMessage,
    clock,
    currentState,
    words,
    save,
    busy,
    closeSession,
    setReviewDate,
    repeat,
    assessment,
    setAssessing,
    start,
    beginAssessment,
    setMessage,
    assessmentWord,
    revealMeaning,
    markFamiliarity,
    candidate,
    suggestions,
    setPreparing,
    changeLevel,
    finished,
    unfinished,
    remaining,
    assignedIds,
    assessed,
    origins,
    pendingReviewIds,
    todays,
    visibleIds,
    repeating,
    setCorrectingSession,
    initialAssessment,
    metrics,
    monthlyRepair,
    correctMonthlyCarryover,
    navigation,
    openRestore,
    setAbout,
    settings,
    changeGoal,
    correctingSession,
    reviewDate,
    backupOpen,
    setBackupOpen,
    restored,
    about,
    registerLeave,
  } = useLearningController(initialServerTime);
  const keyboardOpen = useKeyboardInset();
  const visitTab = useTabPosition(tab, store.epoch, setTab);
  const grammarLeave = useRef<GrammarLeave | null>(null);
  const registerGrammarLeave = useCallback((fn: GrammarLeave) => { grammarLeave.current = fn; return () => { if (grammarLeave.current === fn) grammarLeave.current = null; }; }, []);
  async function flushGrammar() { return await grammarLeave.current?.() ?? true; }
  const availability = (
    <AvailabilityNotice
      surface={settings ? "settings" : "page"}
      loading={loading} saving={saving} signedIn={signedIn} unsaved={unsaved}
      error={error} saveError={saveError} conflict={conflict}
      store={store} state={state} clock={clock}
    />
  );
  return (
    <main
      className="shell"
      data-keyboard={keyboardOpen ? 'open' : undefined}
      data-studying={
        tab === "today" &&
        ((showSession && active && !active.finished) || assessing || preparing)
          ? "true"
          : undefined
      }
    >
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">
            <BookOpen size={22} />
          </span>
          하루단어
        </div>
        <div className="top-actions">
          <SaveStatus
            unsaved={unsaved}
            saving={saving}
            loading={loading}
            signedIn={signedIn}
          />
          <button
            className="icon-button"
            aria-label="학습 설정"
            onClick={async () => { if (await flushGrammar()) setSettings(true); }}
          >
            <Settings2 size={19} />
          </button>
        </div>
      </header>
      <div className="page-wrap">
        <div className="page-heading">
          <div>
            <h1>
              {tab === "today"
                ? "오늘의 학습"
                : tab === "library"
                  ? "나의 단어장"
                  : tab === "review"
                    ? "주간·월말 점검"
                    : "나의 학습 기록"}
            </h1>
          </div>
          <span className="daily-label">
            <CalendarDays size={17} />
            {new Intl.DateTimeFormat("ko-KR", {
              timeZone: "Asia/Seoul",
              month: "long",
              day: "numeric",
              weekday: "short",
            }).format(new Date(date + "T12:00:00+09:00"))}
          </span>
        </div>
        <Tabs
          key={store.epoch}
          value={tab}
          onValueChange={async (v) => { if (await flushGrammar()) visitTab(v as View); }}
          className="main-tabs"
        >
          <TabsList className="main-nav" aria-label="학습 화면">
            <TabsTrigger value="today" aria-label="오늘의 학습">
              <BookOpen />
              <span className="nav-label-wide">오늘의 학습</span>
              <span className="nav-label-compact" aria-hidden="true">
                오늘 학습
              </span>
            </TabsTrigger>
            <TabsTrigger value="library" aria-label="전체 단어장">
              <NotebookPen />
              <span className="nav-label-wide">전체 단어장</span>
              <span className="nav-label-compact" aria-hidden="true">
                단어장
              </span>
            </TabsTrigger>
            <TabsTrigger value="review" aria-label="주간·월말 점검">
              <RotateCcw />
              <span className="nav-label-wide">주간·월말 점검</span>
              <span className="nav-label-compact" aria-hidden="true">
                복습 점검
              </span>
            </TabsTrigger>
            <TabsTrigger value="log" aria-label="학습 기록">
              <CalendarCheck />
              <span className="nav-label-wide">학습 기록</span>
              <span className="nav-label-compact" aria-hidden="true">
                학습 기록
              </span>
            </TabsTrigger>
          </TabsList>
          {!loading && !signedIn && !error && (
            <div className="notice sign-in-notice">
              <div>
                <b>학습 기록을 안전하게 이어가세요.</b>
                <p>
                  ChatGPT 계정으로 로그인하면 다른 기기에서도 같은 기록을 사용할
                  수 있어요.
                </p>
              </div>
              <a
                className="primary-button"
                href="/signin-with-chatgpt?return_to=%2F"
                target="_top"
              >
                로그인하고 학습하기 <ArrowRight size={17} />
              </a>
            </div>
          )}
          {!settings && availability}
          {message && (
            <LearningMessage messageId={messageId} message={message} onDismiss={dismissMessage} />
          )}
          <TabsContent value="today" forceMount hidden={tab !== "today"}>
            <div className="workspace">
              <div className="main-study">
                {loading ? (
                  <section
                    className="learning-panel loading-surface"
                    aria-busy="true"
                  >
                    <p className="eyebrow">나의 학습 노트</p>
                    <h2>학습 기록을 불러오고 있어요.</h2>
                    <div className="loading-lines" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                  </section>
                ) : showSession &&
                  active &&
                  !(
                    active.finished &&
                    active.kind === "daily" &&
                    active.date !== date
                  ) ? (
                  <StudySession
                    registerLeave={registerLeave}
                    key={active.id}
                    currentState={currentState}
                    state={state}
                    session={active}
                    words={words}
                    activityDate={clock.currentDate}
                    date={date}
                    save={save}
                    busy={busy}
                    saved={!saving && !unsaved}
                    visible={tab === "today"}
                    onClose={closeSession}
                    onReview={setReviewDate}
                    onRepeat={repeat}
                  />
                ) : assessing && assessment ? (
                  <FamiliarityAssessment
                    state={state}
                    assessment={assessment}
                    busy={busy}
                    setAssessing={setAssessing}
                    start={start}
                    beginAssessment={beginAssessment}
                    save={save}
                    setMessage={setMessage}
                    assessmentWord={assessmentWord}
                    revealMeaning={revealMeaning}
                    markFamiliarity={markFamiliarity}
                  />
                ) : preparing ? (
                  <CandidatePreparation
                    candidate={candidate}
                    state={state}
                    busy={busy}
                    revealMeaning={revealMeaning}
                    save={save}
                    suggestions={suggestions}
                    words={words}
                    start={start}
                    setPreparing={setPreparing}
                  />
                ) : (
                  <>
                    <TodayOverview
                      date={date}
                      state={state}
                      changeLevel={changeLevel}
                      busy={busy}
                      finished={finished}
                      unfinished={unfinished}
                      remaining={remaining}
                      assignedIds={assignedIds}
                      assessed={assessed}
                      origins={origins}
                      pendingReviewIds={pendingReviewIds}
                      todays={todays}
                      visibleIds={visibleIds}
                      words={words}
                      suggestions={suggestions}
                      start={start}
                      setReviewDate={setReviewDate}
                      repeat={repeat}
                      repeating={repeating}
                      setCorrectingSession={setCorrectingSession}
                      setTab={setTab}
                      initialAssessment={initialAssessment}
                      monthlyRepair={monthlyRepair}
                      correctMonthlyCarryover={correctMonthlyCarryover}
                    />
                    <PendingReviews
                      state={state}
                      busy={busy}
                      onResume={(s) => start(s.kind, s.period, s)}
                    />
                    {!assessed && (
                      <section className="assessment-invite">
                        <div>
                          <span className="assessment-icon">Aa</span>
                          <div>
                            <h3>
                              {initialAssessment
                                ? "어디서 시작할까요?"
                                : "친숙도 탐색"}
                            </h3>
                            <p>
                              {state.settings.level} 단어 20개 · 정식 수준 시험은 아니에요.
                            </p>
                          </div>
                        </div>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => beginAssessment()}
                        >
                          {assessment && !assessment.completed
                            ? "탐색 이어서"
                            : "친숙도 확인"}
                          <ChevronRight size={17} />
                        </button>
                      </section>
                    )}
                  </>
                )}
              </div>
              <LearningAside loading={loading} metrics={metrics} />
            </div>
          </TabsContent>
          <TabsContent value="library" forceMount hidden={tab !== "library"}>
            {navigation.visited.includes("library") && (
              <WordLibrary
                grammarEnabled={grammarEnabled}
                persistence={{ currentState, save, stage: store.stageGrammar, canSave: signedIn && !loading && !conflict && !store.restoring, saved: signedIn && !loading && !saving && !unsaved && !conflict, registerLeave: registerGrammarLeave }}
                activityDate={clock.currentDate}
                state={state}
                words={words}
                save={save}
                busy={busy}
              />
            )}
          </TabsContent>
          <TabsContent value="review" forceMount hidden={tab !== "review"}>
            {navigation.visited.includes("review") && (
              <ReviewDesk
                date={date}
                state={state}
                words={words}
                start={start}
                busy={busy}
                save={save}
              />
            )}
          </TabsContent>
          <TabsContent value="log" forceMount hidden={tab !== "log"}>
            {navigation.visited.includes("log") && (
              <LearningLog
                now={clock.now}
                date={date}
                state={state}
                words={words}
                start={start}
                busy={busy}
                onReview={setReviewDate}
                onRestoreOpen={openRestore}
                onCorrectDate={setCorrectingSession}
              />
            )}
          </TabsContent>
        </Tabs>
        <footer>
          <span>Oxford 3000</span>
          <button className="text-button" onClick={() => setAbout(true)}>
            학습 방식·출처 <Info size={14} />
          </button>
        </footer>
      </div>
      <SettingsDialog
        settings={settings}
        setSettings={setSettings}
        state={state}
        changeLevel={changeLevel}
        busy={busy}
        changeGoal={changeGoal}
        save={save}
        beginAssessment={beginAssessment}
        availability={availability}
      />
      {correctingSession && (
        <StudyDateDialog
          key={correctingSession}
          state={state}
          sessionId={correctingSession}
          date={date}
          saving={saving}
          conflict={conflict}
          save={save}
          onClose={() => setCorrectingSession(null)}
          onSaved={(corrected) => {
            closeSession();
            setReviewDate(null);
            setTab("today");
            setMessage(
              `학습일을 ${corrected}로 수정했어요. 오늘 목표를 다시 계산했어요.`,
            );
          }}
        />
      )}
      {reviewDate && (
        <CompletedLesson
          todayDate={date}
          key={reviewDate}
          state={state}
          words={words}
          date={reviewDate}
          busy={busy}
          onClose={() => setReviewDate(null)}
          onRepeat={repeat}
        />
      )}
      {backupOpen && (
        <Suspense fallback={<p role="status">백업 도구를 여는 중이에요.</p>}>
          <BackupDialog
            date={date}
            now={clock.now}
            state={state}
            busy={busy}
            restoring={store.restoring}
            error={error}
            conflict={conflict}
            onClose={() => setBackupOpen(false)}
            onRestore={store.restore}
            getRevision={store.getRevision}
            onReload={store.load}
            onComplete={restored}
          />
        </Suspense>
      )}
      <SourceDialog open={about} onOpenChange={setAbout} />
    </main>
  );
}
