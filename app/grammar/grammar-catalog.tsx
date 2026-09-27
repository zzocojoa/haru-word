'use client';
import { useRef, type Ref, type Dispatch, type SetStateAction } from 'react';
import { ArrowRight, Check, RotateCcw } from 'lucide-react';
import type { GrammarState, LessonId } from '@/lib/grammar/model';
import { GRAMMAR_FILTERS, grammarCatalog, type GrammarFilter } from './grammar-presentation';

export function GrammarCatalog({ progress, headingRef, onOpen, filter, onFilter, expandedGroups, onExpandedGroups, date }: {
  date: string;
  progress: GrammarState;
  headingRef: Ref<HTMLHeadingElement>;
  onOpen: (id: LessonId) => void;
  filter: GrammarFilter;
  onFilter: (filter: GrammarFilter) => void;
  expandedGroups: string[];
  onExpandedGroups: Dispatch<SetStateAction<string[]>>;
}) {
  const allFilter = useRef<HTMLButtonElement>(null);
  const { counts, groups, visibleCount } = grammarCatalog(progress, filter, date);
  return <section className="grammar-catalog">
    <header className="grammar-catalog-heading">
      <div><h2 ref={headingRef} tabIndex={-1}>문장 속 역할을 익혀요</h2><p className="small-note">15개 미니 수업 · 한 수업 3~5분</p></div>
      <span className="grammar-catalog-count"><Check size={16} aria-hidden="true" />수업 마침 <b>{counts.complete}/15</b></span>
    </header>
    <div className="grammar-filters" role="group" aria-label="수업 표시">
      {GRAMMAR_FILTERS.map(([value, label]) => <button key={value} ref={value === 'all' ? allFilter : undefined} aria-pressed={filter === value} onClick={() => { onExpandedGroups(grammarCatalog(progress, value, date).groups.map(group => group.title)); onFilter(value); }}>{label}<span>{counts[value]}</span></button>)}
    </div>
    <p className="grammar-filter-result small-note" role="status">{filter === 'all' ? '자유롭게 선택 · 하루 목표와 별도' : `${filter === 'continue' ? '이어 할' : '다시 확인할'} 수업 ${visibleCount}개`}</p>
    <div className="grammar-groups">{groups.map(({ title, number, entries }) => {
      const expanded = expandedGroups.includes(title);
      return <details key={title} className="grammar-group" open={expanded} onToggle={event => {
        if (event.currentTarget.open === expanded) return;
        const open = event.currentTarget.open;
        onExpandedGroups(current => open ? [...new Set([...current, title])] : current.filter(group => group !== title));
      }}><summary><span aria-hidden="true">{number}</span><h3>{title}</h3><span className="small-note">{entries.length}개</span></summary><div className="grammar-grid">{entries.map(({ lesson, complete, continuing, review, recommendation }) =>
        <button className="grammar-tile" key={lesson.id} onClick={() => onOpen(lesson.id)}>
          <div className="grammar-tile-heading"><span className="grammar-tile-code">{lesson.pos}</span><b>{lesson.title}</b><ArrowRight size={18} aria-hidden="true" /></div>
          <p>{lesson.role}</p>
          <div className="grammar-tile-status"><span className={complete ? 'grammar-complete' : continuing ? 'grammar-continuing' : ''}>{complete ? <Check size={14} aria-hidden="true" /> : continuing ? <RotateCcw size={14} aria-hidden="true" /> : null}{complete ? '수업 마침' : continuing ? '이어 하기' : '시작 전'}</span>{review && <span className="grammar-review-tag">다시 확인</span>}</div>
          {recommendation.text && <span className="small-note">{recommendation.text}</span>}
        </button>
      )}</div></details>;
    })}</div>
    {!visibleCount && <div className="grammar-empty"><p>{filter === 'continue' ? '이어 할 수업이 없어요.' : '다시 확인할 수업이 없어요.'}</p><button className="secondary-button" onClick={() => { onFilter('all'); allFilter.current?.focus(); }}>전체 수업 보기<ArrowRight size={18} aria-hidden="true" /></button></div>}
    <details className="grammar-guide"><summary>수업 진행 안내</summary><p>처음 답·도움 사용은 따로 기록해요. 도움받은 문제는 ‘다시 확인’으로 남아요.</p></details>
  </section>;
}
