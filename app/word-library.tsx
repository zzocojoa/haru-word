"use client";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SheetDialog as Dialog, SheetDialogContent as DialogContent } from './sheet-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { GRAMMAR_LESSONS, POS_LESSON, LESSON_MAP } from '@/lib/grammar/content';
import type { LessonId } from '@/lib/grammar/model';
import { GrammarLesson } from './grammar/grammar-lesson';
import { GrammarCatalog } from './grammar/grammar-catalog';
import type { GrammarFilter } from './grammar/grammar-presentation';
import type { GrammarPersistence, GrammarLeave } from './grammar/use-grammar-draft';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cardContent } from "@/lib/catalog";
import {
  allSenses,
  FAMILIARITY_TEXT,
  hasReviewWork,
  LEVELS,
  POS,
  type State,
  type Word,
} from "@/lib/learning";
import { ChevronLeft, ChevronRight, Plus, Search, CircleHelp, ArrowRight } from "lucide-react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PersonalWord } from "./library/personal-word";
import { WordEditor } from "./library/word-editor";
import { useNavigationState } from './navigation';
import { useViewRestoration } from './use-view-restoration';
type Props = {
  activityDate: () => string;
  state: State;
  words: Word[];
  save: (s: State) => Promise<boolean>;
  busy: boolean;
  error?: string;
};
type LibraryProps = Props & { grammarEnabled?: boolean; grammarPracticeEnabled?: boolean; persistence: GrammarPersistence };
export const WordLibrary = memo(function WordLibrary(props: LibraryProps) {
  const [view, setView] = useNavigationState('library.view', 'words'), [lessonId, setLessonId] = useNavigationState<LessonId | null>('library.lesson', null);
  const [grammarFilter, setGrammarFilter] = useState<GrammarFilter>('all');
  const [expandedGroups, setExpandedGroups] = useState(['문장 뼈대']);
  const [help, setHelp] = useNavigationState<LessonId | null>('library.help', null), [pos, setPos] = useState('all'), [page, setPage] = useState(0);
  const leave = useRef<GrammarLeave | null>(null), listPosition = useRef(0), focusReturn = useRef<HTMLElement | null>(null);
  const helpReturn = useRef<HTMLButtonElement | null>(null);
  const listPanel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null), pendingPosition = useRef<number | null>(null);
  const pendingSearchFocus = useRef(false);
  const restoration = useViewRestoration();
  const registerLeave = useCallback((fn: GrammarLeave) => { leave.current = fn; return () => { if (leave.current === fn) leave.current = null; }; }, []);
  const flush = useCallback(async () => await leave.current?.() ?? true, []);
  const registerOuterLeave = props.persistence.registerLeave;
  useEffect(() => registerOuterLeave(flush), [registerOuterLeave, flush]);
  useLayoutEffect(() => {
    if (pendingPosition.current === null) return;
    const top = pendingPosition.current;
    pendingPosition.current = null;
    const focusSearch = pendingSearchFocus.current;
    pendingSearchFocus.current = false;
    return restoration.schedule(focusSearch ? 'destination' : 'view', () => {
      const target = view === 'words'
        ? !focusSearch && focusReturn.current?.isConnected && listPanel.current?.contains(focusReturn.current)
          ? focusReturn.current : listPanel.current?.querySelector<HTMLInputElement>('input[type="text"], input:not([type])')
        : heading.current;
      target?.focus({ preventScroll: true });
      window.scrollTo({ top, behavior: 'instant' });
    });
  }, [view, lessonId, restoration]);
  async function switchView(next: string) {
    if (next === view || !await flush()) return;
    if (view === 'words') listPosition.current = window.scrollY;
    pendingPosition.current = next === 'words' ? listPosition.current : 0;
    setView(next);
  }
  async function openLesson(id: LessonId) {
    if (!await flush()) return;
    if (view === 'words') listPosition.current = window.scrollY;
    setHelp(null); setLessonId(id); setView('grammar'); pendingPosition.current = 0;
  }
  const lesson = lessonId ? LESSON_MAP.get(lessonId) : undefined;
  return <Tabs value={view} onValueChange={next => void switchView(next)} className="library-modes" data-lesson={view === 'grammar' && !!lesson}>
    {props.grammarEnabled && <TabsList className="library-mode-tabs" aria-label="단어장 학습 종류"><TabsTrigger value="words">단어 목록</TabsTrigger><TabsTrigger value="grammar">품사·문장 연습</TabsTrigger></TabsList>}
    <TabsContent ref={listPanel} value="words" forceMount hidden={view !== 'words'} onFocusCapture={e => { if (e.currentTarget.contains(e.target)) focusReturn.current = e.target as HTMLElement; }}><WordList {...props} pos={pos} setPos={setPos} page={page} setPage={setPage} onHelp={props.grammarEnabled ? (id, button) => { focusReturn.current = button; helpReturn.current = button; setHelp(id); } : undefined} /></TabsContent>
    {props.grammarEnabled && <TabsContent value="grammar" forceMount hidden={view !== 'grammar'}>
      {lesson ? <GrammarLesson key={lesson.id} lesson={lesson} enhanced={props.grammarPracticeEnabled} activityDate={props.activityDate} persistence={{ ...props.persistence, registerLeave }} onBack={() => { setLessonId(null); pendingPosition.current = 0; }} onWords={() => { pendingSearchFocus.current = true; focusReturn.current = null; setPos(lesson.pos); setPage(0); setView('words'); setLessonId(null); pendingPosition.current = 0; }} /> : <GrammarCatalog date={props.activityDate()} expandedGroups={expandedGroups} onExpandedGroups={setExpandedGroups} progress={props.state.grammar ?? {}} headingRef={heading} filter={grammarFilter} onFilter={setGrammarFilter} onOpen={id => void openLesson(id)} />}
    </TabsContent>}
    <Dialog navigationKey="library.help" open={!!help} onOpenChange={open => { if (!open) setHelp(null); }}><DialogContent className="framed-dialog grammar-help" onCloseAutoFocus={event => { event.preventDefault(); if (!lessonId) restoration.schedule('destination', () => helpReturn.current?.focus({ preventScroll: true })); }}>
      {help && (() => { const l = LESSON_MAP.get(help)!; return <><DialogHeader><DialogTitle>{l.title} · {l.pos}</DialogTitle><DialogDescription>{l.role}</DialogDescription></DialogHeader><div className="dialog-scroll"><p lang="en">{l.examples[0][0]}</p><p>{l.examples[0][1]}</p><p className="small-note">학습용 작성 예문</p></div><div className="dialog-actions"><button className="primary-button" onClick={() => void openLesson(help)}>이 품사 배우기<ArrowRight size={18} /></button></div></>; })()}
    </DialogContent></Dialog>
  </Tabs>;
});
const WordList = memo(function WordList({
  error,
  activityDate,
  state,
  words,
  save,
  busy,
  pos, setPos, page, setPage, onHelp,
}: Props & { pos: string; setPos: (pos: string) => void; page: number; setPage: (page: number) => void; onHelp?: (id: LessonId, button: HTMLButtonElement) => void }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [familiarity, setFamiliarity] = useState("all");
  const [selected, setSelected] = useNavigationState<{ word: Word; instance: string } | null>('library.word', null);
  const [adding, setAdding] = useNavigationState<string | null>('library.add', null);
  const [pageSize, setPageSize] = useState(10);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const dialogTrigger = useRef<HTMLButtonElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  function restoreFocus(event: Event) {
    event.preventDefault();
    (dialogTrigger.current?.isConnected
      ? dialogTrigger.current
      : searchInput.current
    )?.focus({ preventScroll: true });
  }
  const filtered = useMemo(
    () =>
      words.filter(
        (w) =>
          (pos === 'all' || w.pos === pos) &&
          (level === "all" ||
            (level === "personal"
              ? w.personal
              : !w.personal && w.level === level)) &&
          (familiarity === "all" ||
            (familiarity === "unmarked"
              ? !state.progress[w.id]?.familiarity
              : state.progress[w.id]?.familiarity === familiarity)) &&
          (!query ||
            `${w.word} ${cardContent(w.id, state.progress[w.id]).meaning} ${allSenses(
              state.progress[w.id],
            )
              .map((x) => x.meaning || "")
              .join(" ")}`
              .toLowerCase()
              .includes(query.trim().toLowerCase())),
      ),
    [words, state.progress, query, level, familiarity, pos],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  function movePage(next: number, fromBottom = false) {
    setPage(next);
    if (fromBottom) {
      listHeading.current?.focus({ preventScroll: true });
      listHeading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }
  const pagination = (bottom = false) => <nav className="pagination library-pagination" aria-label={`단어 목록 ${bottom ? '하단' : '상단'} 페이지 이동`}>
    <span role="status"><span className="sr-only">페이지 </span>{currentPage + 1} / {pages}</span>
    <div>
      <button className="icon-button" disabled={currentPage === 0} aria-label="이전 페이지" onClick={() => movePage(currentPage - 1, bottom)}><ChevronLeft size={19} /></button>
      <button className="icon-button" disabled={currentPage + 1 === pages} aria-label="다음 페이지" onClick={() => movePage(currentPage + 1, bottom)}><ChevronRight size={19} /></button>
    </div>
  </nav>;
  return (
    <section className="wide-panel library-panel">
      <h2 className="sr-only" ref={listHeading} tabIndex={-1}>단어 찾기</h2>
      <div className="library-controls" role="region" aria-label="단어 검색과 필터">
      <div className="filters">
        {onHelp && <Select value={pos} onValueChange={v => { setPos(v); setPage(0); }}><SelectTrigger aria-label="품사 필터"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">모든 품사</SelectItem>{GRAMMAR_LESSONS.map(l => <SelectItem value={l.pos} key={l.pos}>{l.title}</SelectItem>)}</SelectContent></Select>}
        <div className="search-box">
          <Search size={18} />
          <input
            ref={searchInput}
            value={query}
            aria-label="단어 또는 한국어 뜻 검색"
            placeholder="단어 또는 한국어 뜻 검색"
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <Select
          value={level}
          onValueChange={(v) => {
            setLevel(v);
            setPage(0);
          }}
        >
          <SelectTrigger aria-label="단어장 수준 필터">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">모든 수준</SelectItem>
            <SelectItem value="personal">개인 추가</SelectItem>
            {LEVELS.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={familiarity}
          onValueChange={(v) => {
            setFamiliarity(v);
            setPage(0);
          }}
        >
          <SelectTrigger aria-label="친숙도 필터">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">모든 친숙도</SelectItem>
            <SelectItem value="unmarked">아직 미표시</SelectItem>
            <SelectItem value="known">✓✓ 뜻을 알아요</SelectItem>
            <SelectItem value="uncertain">✓ 조금 헷갈려요</SelectItem>
            <SelectItem value="new">? 처음 봐요</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="library-tools"><div className="list-count">
        {filtered.length.toLocaleString()}개 학습 항목{" "}
        {(query || level !== 'all' || familiarity !== 'all' || pos !== 'all') && <button className="text-button" onClick={() => {setQuery('');setLevel('all');setFamiliarity('all');setPos('all');setPage(0);searchInput.current?.focus();}}>필터 초기화</button>}
      </div>
              <button
          className="secondary-button"
          onClick={(event) => {
            dialogTrigger.current = event.currentTarget;
            setAdding(crypto.randomUUID());
          }}
          disabled={busy}
        >
          <Plus size={17} />
          개인 단어 추가
        </button>
      </div></div>
      <div className="library-page-controls"><label>표시 개수<select aria-label="페이지당 단어 수" value={pageSize} onChange={event => { const size = Number(event.target.value); setPage(Math.floor(currentPage * pageSize / size)); setPageSize(size); }}><option value={10}>10개</option><option value={30}>30개</option></select></label>{pagination()}</div>
      <Table className="word-table" aria-label="나의 단어 목록">
        <TableHeader>
          <TableRow>
            <TableHead>단어</TableHead>
            <TableHead>오늘의 뜻</TableHead>
            <TableHead>수준</TableHead>
            <TableHead>친숙도</TableHead>
            <TableHead>학습 상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((w) => {
            const p = state.progress[w.id];
            return (
              <TableRow key={w.id}>
                <TableCell><div className="word-identity">
                  <button
                    className="word-link"
                    onClick={(event) => {
                      dialogTrigger.current = event.currentTarget;
                      setSelected({ word: w, instance: crypto.randomUUID() });
                    }}
                  >
                    <b lang="en">{w.word}</b>
                    <small>
                      {POS[w.pos]}
                      {w.headword !== w.word ? ` · ${w.headword}` : ""}
                      {w.personal ? " · 개인 추가" : ""}
                    </small>
                  </button>
                  {onHelp && POS_LESSON.has(w.pos) && <button className="pos-help-button" aria-label={`${w.word} ${POS[w.pos]} 도움말`} onClick={e => onHelp(POS_LESSON.get(w.pos)!.id, e.currentTarget)}><CircleHelp size={16} /><span className="sr-only">품사 설명</span></button>}</div>
                </TableCell>
                <TableCell className="meaning-cell" data-label="뜻">
                  {cardContent(w.id, p).meaning}
                </TableCell>
                <TableCell>
                  <span className="level-badge">
                    {w.personal ? "개인 추가" : w.level}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={"familiarity-tag " + (p?.familiarity || "")}>
                    {p?.familiarity
                      ? FAMILIARITY_TEXT[p.familiarity]
                      : "미표시"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={hasReviewWork(p) ? "today-review" : "muted"}>
                    {hasReviewWork(p)
                      ? "진행·복습 남음"
                      : p?.lastStudied
                        ? "학습 기록 있음"
                        : "학습 전"}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {!visible.length && (
        <div className="empty-state">
          <Search />
          <h3>일치하는 단어가 없어요.</h3>
          <p>검색어나 필터를 바꿔 보세요.</p>
        </div>
      )}
      {pagination(true)}
      <Dialog
        key={selected?.instance || 'closed-editor'}
        navigationKey="library.word"
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="word-dialog framed-dialog" onCloseAutoFocus={restoreFocus}>
          {selected && (
            <WordEditor
              error={error}
              activityDate={activityDate}
              key={selected.instance}
              word={selected.word}
              p={state.progress[selected.word.id]}
              busy={busy}
              onSave={async (p) => {
                const saved = await save({
                  ...state,
                  progress: { ...state.progress, [selected.word.id]: p },
                });
                if (saved) setSelected(current => current?.instance === selected.instance ? null : current);
                return saved;
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog key={adding || 'closed-personal'} navigationKey="library.add" open={!!adding} onOpenChange={open => { if (!open) setAdding(null); }}>
        <DialogContent className="word-dialog framed-dialog" onCloseAutoFocus={restoreFocus}>
          {adding && <PersonalWord
            error={error}
            key={adding}
            busy={busy}
            onSave={async (w, p) => {
              const saved = await save({
                  ...state,
                  progress: {
                    ...state.progress,
                    [w.id]: { ...p, personal: w },
                  },
                });
              if (saved) setAdding(current => current === adding ? null : current);
              return saved;
            }}
          />}
        </DialogContent>
      </Dialog>
    </section>
  );
});
