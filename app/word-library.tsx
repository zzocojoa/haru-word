"use client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { memo, useMemo, useRef, useState } from "react";
import { PersonalWord } from "./library/personal-word";
import { WordEditor } from "./library/word-editor";
type Props = {
  activityDate: () => string;
  state: State;
  words: Word[];
  save: (s: State) => Promise<boolean>;
  busy: boolean;
};
export const WordLibrary = memo(function WordLibrary({
  activityDate,
  state,
  words,
  save,
  busy,
}: Props) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [familiarity, setFamiliarity] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<{ word: Word; instance: string } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
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
    [words, state.progress, query, level, familiarity],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 30));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * 30, (currentPage + 1) * 30);
  return (
    <section className="wide-panel library-panel">
      <h2 className="sr-only">단어 찾기</h2>
      <div className="library-controls" role="region" aria-label="단어 검색과 필터">
      <div className="filters">
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
        {(query || level !== 'all' || familiarity !== 'all') && <button className="text-button" onClick={() => {setQuery('');setLevel('all');setFamiliarity('all');setPage(0);searchInput.current?.focus();}}>필터 초기화</button>}
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
                <TableCell>
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
      <div className="pagination">
        <span>
          {currentPage + 1} / {pages} 페이지
        </span>
        <div>
          <button
            className="icon-button"
            disabled={currentPage === 0}
            aria-label="이전 페이지"
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft size={19} />
          </button>
          <button
            className="icon-button"
            disabled={currentPage + 1 === pages}
            aria-label="다음 페이지"
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="word-dialog framed-dialog" onCloseAutoFocus={restoreFocus}>
          {selected && (
            <WordEditor
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
      <Dialog open={!!adding} onOpenChange={open => { if (!open) setAdding(null); }}>
        <DialogContent className="word-dialog framed-dialog" onCloseAutoFocus={restoreFocus}>
          {adding && <PersonalWord
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
