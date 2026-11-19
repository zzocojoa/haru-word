"use client";
import {HaruParagraph,HaruPanel,HaruHeading} from './haru-content';
import {HaruButton,HaruIconButton,HaruTextInput,HaruSelector} from './haru-controls';
import { DialogHeader } from "@/components/ui/dialog";
import { SheetDialog as Dialog, SheetDialogContent as DialogContent, SheetDialogTitle as DialogTitle, SheetDialogDescription as DialogDescription } from './sheet-dialog';
import {TabList,Tab} from '@astryxdesign/core/TabList';
import { GRAMMAR_INDEX, POS_INDEX, LESSON_INDEX } from '@/lib/grammar/lesson-index';
import type { LessonId } from '@/lib/grammar/model';
import type { GrammarFilter } from './grammar/grammar-presentation';
import type { GrammarPersistence, GrammarLeave } from './grammar/use-grammar-draft';
import {
  Table,
  TableBody,
  TableCell,
  TableHeaderCell,
  TableHeader,
  TableRow,
} from "@astryxdesign/core/Table";
import { cardMeaning } from "@/lib/catalog-basics";
import {
  allSenses,
  FAMILIARITY_TEXT,
  hasReviewWork,
  LEVELS,
  POS,
  type State,
  type Word,
} from "@/lib/learning";
import { HaruIcon } from '@/components/icons/haru-icon';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { deferredView } from './deferred-view';
import { useNavigationState } from './navigation';
import { useViewRestoration } from './use-view-restoration';

const GrammarWorkspace = deferredView(() => import('./library/grammar-workspace'), feature => feature.GrammarWorkspace, '문법');
const WordEditor = deferredView(() => import('./library/word-editor'), feature => feature.WordEditor, '단어 편집', (props, status) => <>
  <DialogHeader><DialogTitle>{props.word.word}</DialogTitle><DialogDescription>단어 편집 자료</DialogDescription></DialogHeader>{status}
</>);
const PersonalWord = deferredView(() => import('./library/personal-word'), feature => feature.PersonalWord, '개인 단어', (_props, status) => <>
  <DialogHeader><DialogTitle>나에게 필요한 단어 추가</DialogTitle><DialogDescription>개인 단어 편집 자료</DialogDescription></DialogHeader>{status}
</>);
type Props = {
  activityDate: () => string;
  state: State;
  words: Word[];
  save: (s: State) => Promise<boolean>;
  busy: boolean;
  retryBlocked: boolean;
  error?: string;
  imagePilotEnabled?: boolean;
};
type LibraryProps = Props & { grammarEnabled?: boolean; grammarPracticeEnabled?: boolean; grammarV3Enabled?: boolean; grammarV4Enabled?: boolean; persistence: GrammarPersistence };
export const WordLibrary = memo(function WordLibrary(props: LibraryProps) {
  const [view, setView] = useNavigationState('library.view', 'words'), [lessonId, setLessonId] = useNavigationState<LessonId | null>('library.lesson', null);
  const [grammarFilter, setGrammarFilter] = useState<GrammarFilter>('all');
  const [grammarVisited, setGrammarVisited] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(['문장 뼈대']);
  const [help, setHelp] = useNavigationState<LessonId | null>('library.help', null), [pos, setPos] = useState('all'), [page, setPage] = useState(0);
  const leave = useRef<GrammarLeave | null>(null), listPosition = useRef(0), focusReturn = useRef<HTMLElement | null>(null);
  const helpReturn = useRef<HTMLButtonElement | null>(null);
  const listPanel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null), pendingPosition = useRef<number | null>(null);
  const pendingSearchFocus = useRef(false);
  const restoration = useViewRestoration();
  const registerLeave = useCallback((fn: GrammarLeave) => { leave.current = fn; return () => { if (leave.current === fn) leave.current = null; }; }, []);
  const openHelp = useCallback((id: LessonId, button: HTMLButtonElement) => {
    focusReturn.current = button; helpReturn.current = button; setHelp(id);
  }, [setHelp]);
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
  const tabPending = useRef(false), tabButtons = useRef<Record<string,HTMLButtonElement|null>>({});
  async function requestView(next: string) {
    if (next === view || tabPending.current) return;
    tabPending.current = true;
    try {if (!await switchView(next)) tabButtons.current[view]?.focus({preventScroll:true});}
    finally {tabPending.current = false;}
  }
  async function switchView(next: string) {
    if (next === view) return true;
    if (!await flush()) return false;
    if (next === 'grammar') setGrammarVisited(true);
    if (view === 'words') listPosition.current = window.scrollY;
    pendingPosition.current = next === 'words' ? listPosition.current : 0;
    setView(next);
    return true;
  }
  async function openLesson(id: LessonId) {
    if (!await flush()) return;
    setGrammarVisited(true);
    if (view === 'words') listPosition.current = window.scrollY;
    setHelp(null); setLessonId(id); setView('grammar'); pendingPosition.current = 0;
  }
  return <section className="library-modes" data-lesson={view === 'grammar' && !!lessonId}>
    {props.grammarEnabled && <TabList value={view} onChange={requestView} className="library-mode-tabs haru-library-tabs" data-slot="tabs-list" role="tablist" aria-label="단어장 학습 종류" layout="hug" overflow="visible">
      {([['words','단어 목록'],['grammar','품사와 문장 연습']] as const).map(([value,label]) => <Tab key={value} value={value} label={label} aria-label={label} id={'haru-library-tab-'+value} panelId={'haru-library-panel-'+value} ref={node => {tabButtons.current[value]=node;}} onFocus={() => void requestView(value)} data-slot="tabs-trigger" data-state={view===value?'active':'inactive'} />)}
    </TabList>}
    <div ref={listPanel} id="haru-library-panel-words" role="tabpanel" aria-labelledby={props.grammarEnabled?"haru-library-tab-words":undefined} data-slot="tabs-content" tabIndex={0} hidden={view !== 'words'} onFocusCapture={e => { if (e.currentTarget.contains(e.target)) focusReturn.current = e.target as HTMLElement; }}><WordList {...props} pos={pos} setPos={setPos} page={page} setPage={setPage} onHelp={props.grammarEnabled ? openHelp : undefined} /></div>
    {props.grammarEnabled && <div id="haru-library-panel-grammar" role="tabpanel" aria-labelledby="haru-library-tab-grammar" data-slot="tabs-content" tabIndex={0} hidden={view !== 'grammar'}>
      {(grammarVisited || view === 'grammar') && <GrammarWorkspace visible={view === 'grammar'} lessonId={lessonId} enhanced={props.grammarPracticeEnabled || props.grammarV3Enabled || props.grammarV4Enabled} contentVersion={props.grammarV4Enabled ? 4 : props.grammarV3Enabled ? 3 : 2} activityDate={props.activityDate} persistence={{ ...props.persistence, registerLeave }} onBack={() => { setLessonId(null); pendingPosition.current = 0; }} onWords={() => { pendingSearchFocus.current = true; focusReturn.current = null; setPos(LESSON_INDEX.get(lessonId!)!.pos); setPage(0); setView('words'); setLessonId(null); pendingPosition.current = 0; }} date={props.activityDate()} expandedGroups={expandedGroups} onExpandedGroups={setExpandedGroups} progress={props.state.grammar ?? {}} headingRef={heading} filter={grammarFilter} onFilter={setGrammarFilter} onOpen={id => void openLesson(id)} />}
    </div>}
    <Dialog navigationKey="library.help" open={!!help} onOpenChange={open => { if (!open) setHelp(null); }}><DialogContent className="framed-dialog grammar-help" onCloseAutoFocus={event => { event.preventDefault(); if (!lessonId) restoration.schedule('destination', () => helpReturn.current?.focus({ preventScroll: true })); }}>
      {help && (() => { const l = LESSON_INDEX.get(help)!; return <><DialogHeader><DialogTitle>{l.title} · {l.pos}</DialogTitle><DialogDescription>{l.role}</DialogDescription></DialogHeader><div className="dialog-scroll"><HaruParagraph lang="en">{l.example[0]}</HaruParagraph><HaruParagraph>{l.example[1]}</HaruParagraph><HaruParagraph className="small-note">학습용 작성 예문</HaruParagraph></div><div className="dialog-actions"><HaruButton label={["이 품사 배우기"].join('')} variant="primary" endContent={<HaruIcon name="arrow-right" size={18} />} className="haru-migrated primary-button" onClick={() => void openLesson(help)}>이 품사 배우기</HaruButton></div></>; })()}
    </DialogContent></Dialog>
  </section>;
});
const WordList = memo(function WordList({
  error,
  activityDate,
  state,
  words,
  save,
  busy,
  retryBlocked,
  imagePilotEnabled = false,
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
  const restoration = useViewRestoration();
  function restoreFocus(event: Event) {
    event.preventDefault();
    // Closing also restores navigation history. The explicit dialog trigger
    // must win over the browser's earlier pointer-focus snapshot.
    restoration.schedule('destination', () => {
      (dialogTrigger.current?.isConnected
        ? dialogTrigger.current
        : searchInput.current
      )?.focus({ preventScroll: true });
    });
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
            `${w.word} ${cardMeaning(w.id, state.progress[w.id])} ${allSenses(
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
  const visible = useMemo(() => filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize),
    [filtered, currentPage, pageSize]);
  // Grammar drafts keep their latest state while unchanged word rows retain their render.
  const wordTable = useMemo(() => (
      <Table className="haru-table word-table" aria-label="나의 단어 목록">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>단어</TableHeaderCell>
            <TableHeaderCell>학습할 뜻</TableHeaderCell>
            <TableHeaderCell>수준</TableHeaderCell>
            <TableHeaderCell>친숙도</TableHeaderCell>
            <TableHeaderCell>학습 상태</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((w) => {
            const p = state.progress[w.id];
            return (
              <TableRow key={w.id}>
                <TableCell><div className="word-identity">
                  <HaruButton label={`${w.word} ${POS[w.pos]}${w.headword !== w.word ? ` · ${w.headword}` : ""}${w.personal ? " · 개인 추가" : ""}`} variant="secondary"
                    className="haru-migrated haru-native-action word-link"
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
                  </HaruButton>
                  {onHelp && POS_INDEX.has(w.pos) && <HaruIconButton label={`${w.word} ${POS[w.pos]} 도움말`} icon={<HaruIcon name="help-circle" size={16} />} className="haru-migrated haru-native-action pos-help-button" aria-label={`${w.word} ${POS[w.pos]} 도움말`} onClick={e => onHelp(POS_INDEX.get(w.pos)!.id, e.currentTarget)}></HaruIconButton>}</div>
                </TableCell>
                <TableCell className="meaning-cell" data-label="뜻">
                  {cardMeaning(w.id, p)}
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
                      : "미확인"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={hasReviewWork(p) ? "today-review" : "muted"}>
                    {hasReviewWork(p)
                      ? "학습·복습 남음"
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
  ), [visible, state.progress, onHelp, setSelected]);
  const libraryControls = useMemo(() => (
      <div className="library-controls" role="region" aria-label="단어 검색과 필터">
      <div className="filters">
        {onHelp && <HaruSelector label="품사 필터" isLabelHidden containerClassName="library-filter" value={pos} onChange={v=>{setPos(v);setPage(0);}} options={[{value:"all",label:"모든 품사"},...GRAMMAR_INDEX.map(l=>({value:l.pos,label:l.title}))]} />}
        <div className="search-box">
          <HaruIcon name="search" size={18} />
          <HaruTextInput label="단어 또는 한국어 뜻 검색" isLabelHidden containerClassName="library-search"
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
        <HaruSelector label="단어장 수준 필터" isLabelHidden containerClassName="library-filter" value={level} onChange={v=>{setLevel(v);setPage(0);}} options={[{value:"all",label:"모든 수준"},{value:"personal",label:"개인 추가"},...LEVELS.map(value=>({value,label:value}))]} />
        <HaruSelector label="친숙도 필터" isLabelHidden containerClassName="library-filter" value={familiarity} onChange={v=>{setFamiliarity(v);setPage(0);}} options={[{value:"all",label:"모든 친숙도"},{value:"unmarked",label:"친숙도 미확인"},{value:"known",label:"✓✓ 뜻을 알아요"},{value:"uncertain",label:"✓ 조금 헷갈려요"},{value:"new",label:"? 처음 봐요"}]} />
      </div>
      <div className="library-tools"><div className="list-count">
        {filtered.length.toLocaleString()}개 학습 항목{" "}
        {(query || level !== 'all' || familiarity !== 'all' || pos !== 'all') && <HaruButton label={["필터 초기화"].join('')} variant="ghost" className="haru-migrated text-button" onClick={() => {setQuery('');setLevel('all');setFamiliarity('all');setPos('all');setPage(0);searchInput.current?.focus();}}>필터 초기화</HaruButton>}
      </div>
              <HaruButton label={["개인 단어 추가"].join('')} variant="secondary" icon={<HaruIcon name="notebook-plus" size={17} />}
          className="haru-migrated secondary-button"
          onClick={(event) => {
            dialogTrigger.current = event.currentTarget;
            setAdding(crypto.randomUUID());
          }}
          disabled={busy}
        >

          개인 단어 추가
        </HaruButton>
      </div></div>
  ), [onHelp, pos, query, level, familiarity, filtered.length, busy, setPos, setPage, setAdding]);
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
      <HaruIconButton label="이전 페이지" icon={<HaruIcon name="chevron-left" size={19} />} className="haru-migrated haru-native-action icon-button" disabled={currentPage === 0} aria-label="이전 페이지" onClick={() => movePage(currentPage - 1, bottom)}></HaruIconButton>
      <HaruIconButton label="다음 페이지" icon={<HaruIcon name="chevron-right" size={19} />} className="haru-migrated haru-native-action icon-button" disabled={currentPage + 1 === pages} aria-label="다음 페이지" onClick={() => movePage(currentPage + 1, bottom)}></HaruIconButton>
    </div>
  </nav>;
  return (
    <HaruPanel className="wide-panel library-panel">
      <HaruHeading level={2} className="sr-only" ref={listHeading} tabIndex={-1}>단어 찾기</HaruHeading>
      {libraryControls}
      <div className="library-page-controls"><HaruSelector label="표시 개수" aria-label="페이지당 단어 수" containerClassName="library-page-size" value={String(pageSize)} onChange={value=>{const size=Number(value);setPage(Math.floor(currentPage * pageSize / size));setPageSize(size);}} options={[{value:"10",label:"10개"},{value:"30",label:"30개"}]} />{pagination()}</div>
      {wordTable}
      {!visible.length && (
        <div className="empty-state">
          <HaruIcon name="search-empty" size={24} />
          <HaruHeading level={3}>일치하는 단어가 없어요.</HaruHeading>
          <HaruParagraph>검색어나 필터를 바꿔 보세요.</HaruParagraph>
        </div>
      )}
      {pagination(true)}
      <Dialog        key={selected?.instance || 'closed-editor'}
        navigationKey="library.word"
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="word-dialog framed-dialog" onCloseAutoFocus={restoreFocus}>
          {selected && (
            <WordEditor
              imagePilotEnabled={imagePilotEnabled}
              error={error}
              activityDate={activityDate}
              key={selected.instance}
              word={selected.word}
              p={state.progress[selected.word.id]}
              busy={busy}
              retryBlocked={retryBlocked}
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
            retryBlocked={retryBlocked}
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
    </HaruPanel>
  );
});
