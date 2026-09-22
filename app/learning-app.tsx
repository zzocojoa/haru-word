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
import { Suspense, lazy } from "react";
import { CompletedLesson } from "./completed-lesson";
import { CandidatePreparation } from "./learning/candidate-preparation";
import { FamiliarityAssessment } from "./learning/familiarity-assessment";
import { LearningAside } from "./learning/learning-aside";
import { SaveError } from "./learning/save-error";
import { SaveStatus } from "./learning/save-status";
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

const BackupDialog = lazy(() => import("./backup-dialog"));
export default function LearningApp({
  initialServerTime,
}: {
  initialServerTime: number;
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
    carry,
    assessed,
    origins,
    todays,
    visibleIds,
    repeating,
    setCorrectingSession,
    initialAssessment,
    metrics,
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
  } = useLearningController(initialServerTime);
  return (
    <main
      className="shell"
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
          하루단어<span className="brand-en">WORD BY WORD</span>
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
            onClick={() => setSettings(true)}
          >
            <Settings2 size={19} />
          </button>
        </div>
      </header>
      <div className="page-wrap">
        <div className="page-heading">
          <div>
            <p className="eyebrow">하루 15분, 나를 위한 영어</p>
            <h1>
              {tab === "today"
                ? "오늘도, 한 단어씩."
                : tab === "library"
                  ? "나의 단어장"
                  : tab === "review"
                    ? "다시 만나는 단어들"
                    : "나의 학습 기록"}
            </h1>
            <p className="muted">
              {tab === "today"
                ? "헷갈리는 뜻에서, 나만의 문장까지."
                : "조금씩 배우고, 여러 번 꺼내 보세요."}
            </p>
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
          onValueChange={(v) => {
            setTab(v as View);
            window.scrollTo({ top: 0, behavior: "auto" });
          }}
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
          {error && (
            <SaveError
              saveError={saveError}
              error={error}
              conflict={conflict}
              saving={saving}
              unsaved={unsaved}
              store={store}
              state={state}
            />
          )}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          <TabsContent value="today" forceMount hidden={tab !== "today"}>
            <div className="workspace">
              <div className="main-study">
                {clock.error && (
                  <p className="notice" role="alert">
                    한국 시간을 확인하지 못했어요. 기록은 보존돼요. 연결을
                    확인하고{" "}
                    <button
                      className="text-button"
                      onClick={() => void clock.refresh()}
                    >
                      시간 다시 확인
                    </button>
                  </p>
                )}
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
                      carry={carry}
                      assessed={assessed}
                      origins={origins}
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
                                ? "처음이라면, 아는 단어부터 확인해요."
                                : "학습 범위를 다시 확인할 수 있어요."}
                            </h3>
                            <p>
                              {state.settings.level} 목록 여러 부분에서 20개를
                              살펴봐요. 뜻과 말하기 실력은 따로 기록해요.
                              {!initialAssessment &&
                                " 탐색 중에도 기존 학습은 계속할 수 있어요."}
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
          <span>매일 조금씩, 내 것이 되는 영어.</span>
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
            onReload={store.load}
            onComplete={restored}
          />
        </Suspense>
      )}
      <SourceDialog open={about} onOpenChange={setAbout} />
    </main>
  );
}
