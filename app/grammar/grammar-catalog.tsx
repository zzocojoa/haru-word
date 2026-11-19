'use client';
import {HaruPanel,HaruHeading,HaruParagraph} from '../haru-content';
import {HaruButton} from '../haru-controls';

import { useRef, type Ref, type Dispatch, type SetStateAction } from 'react';
import { HaruIcon } from '@/components/icons/haru-icon';
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
  return <HaruPanel className="grammar-catalog">
    <header className="grammar-catalog-heading">
      <div><HaruHeading level={2} ref={headingRef} tabIndex={-1}>품사와 문장 연습</HaruHeading><HaruParagraph className="small-note">15개 수업 · 수업당 약 3~5분</HaruParagraph></div>
      <span className="grammar-catalog-count"><HaruIcon name="check" size={16} />수업 마침 <b>{counts.complete}/15</b></span>
    </header>
    <div className="grammar-filters" role="group" aria-label="수업 표시">
      {GRAMMAR_FILTERS.map(([value, label]) => <HaruButton label={`${label} ${counts[value]}`} variant="secondary" className="haru-migrated haru-native-action" key={value} ref={value === 'all' ? allFilter : undefined} aria-pressed={filter === value} onClick={() => { onExpandedGroups(grammarCatalog(progress, value, date).groups.map(group => group.title)); onFilter(value); }}><span className="grammar-filter-label">{label}<span>{counts[value]}</span></span></HaruButton>)}
    </div>
    <HaruParagraph className="grammar-filter-result small-note" role="status">{filter === 'all' ? '자유롭게 선택 · 하루 목표와 별도' : `${filter === 'continue' ? '이어 할' : '다시 확인할'} 수업 ${visibleCount}개`}</HaruParagraph>
    <div className="grammar-groups">{groups.map(({ title, number, entries }) => {
      const expanded = expandedGroups.includes(title);
      return <details key={title} className="grammar-group" open={expanded} onToggle={event => {
        if (event.currentTarget.open === expanded) return;
        const open = event.currentTarget.open;
        onExpandedGroups(current => open ? [...new Set([...current, title])] : current.filter(group => group !== title));
      }}><summary><span aria-hidden="true">{number}</span><HaruHeading level={3}>{title}</HaruHeading><span className="small-note">{entries.length}개</span></summary><div className="grammar-grid">{entries.map(({ lesson, complete, continuing, review, recommendation }) =>
        <HaruButton label={`${lesson.pos} ${lesson.title} ${lesson.role} ${complete ? "수업 마침" : continuing ? "이어 하기" : "시작 전"}`} variant="secondary" className="haru-migrated haru-native-action grammar-tile" key={lesson.id} onClick={() => onOpen(lesson.id)}><span className="haru-grammar-tile-content">
          <div className="grammar-tile-heading"><span className="grammar-tile-code">{lesson.pos}</span><b>{lesson.title}</b><HaruIcon name="arrow-right" size={18} /></div>
          <HaruParagraph>{lesson.role}</HaruParagraph>
          <div className="grammar-tile-status"><span className={complete ? 'grammar-complete' : continuing ? 'grammar-continuing' : ''}>{complete ? <HaruIcon name="check" size={16} /> : continuing ? <HaruIcon name="repeat" size={16} /> : null}{complete ? '수업 마침' : continuing ? '이어 하기' : '시작 전'}</span>{review && <span className="grammar-review-tag"><HaruIcon name="repeat" size={16} />다시 확인</span>}</div>
          {recommendation.text && <span className="small-note">{recommendation.text}</span>}
        </span></HaruButton>
      )}</div></details>;
    })}</div>
    {!visibleCount && <div className="grammar-empty"><HaruParagraph>{filter === 'continue' ? '이어 할 수업이 없어요.' : '다시 확인할 수업이 없어요.'}</HaruParagraph><HaruButton label={["전체 수업 보기"].join('')} variant="secondary" endContent={<HaruIcon name="arrow-right" size={18} />} className="haru-migrated secondary-button" onClick={() => { onFilter('all'); allFilter.current?.focus(); }}>전체 수업 보기</HaruButton></div>}
    <details className="grammar-guide"><summary>수업 진행 안내</summary><HaruParagraph>처음 답·도움 사용은 따로 기록해요. 도움받은 문제는 ‘다시 확인’으로 남아요.</HaruParagraph></details>
  </HaruPanel>;
}
