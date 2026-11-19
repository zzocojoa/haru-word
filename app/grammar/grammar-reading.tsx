'use client';
import {HaruParagraph} from '../haru-content';
import {HaruButton,HaruIconButton} from '../haru-controls';

import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { glossRanges, type ReadingLine, type LessonPractice } from '@/lib/grammar/content-v2';
import type { GrammarProgress } from '@/lib/grammar/model';
import { Speak } from '../ui';
import { GrammarQuestion } from './grammar-question';

export function GrammarReading({ practice, progress, disabled, onHelp, onChoice, onAnswer, onNext }: {
  practice: LessonPractice; progress: GrammarProgress; disabled: boolean;
  onHelp: (level: NonNullable<GrammarProgress['observationHelp']>) => void; onChoice: (text: string) => void;
  onAnswer: (text: string) => void; onNext: () => void;
}) {
  const [translated, setTranslated] = useState(false), [open, setOpen] = useState<string | null>(null);
  return <div className="grammar-stage">
    <div className="grammar-reading">
      <div className="grammar-reading-tools"><span className="small-note">짧게 읽기 · 밑줄 단어를 눌러 보세요</span><Speak text={practice.reading.map(l => l.en).join(' ')} /></div>
      {practice.reading.map((line, i) => <div key={line.en} className="grammar-reading-line">
        <ReadingLineView line={line} prefix={String(i)} open={open} onOpen={id => { setOpen(id); if (id) onHelp('gloss'); }} revealed={!!progress.observation} disabled={disabled} />
        {translated && <HaruParagraph className="grammar-reading-translation">{line.ko}</HaruParagraph>}
      </div>)}
      <HaruButton label={[(translated ? '해석 접기' : '한국어 해석')].join('')} variant="ghost" className="haru-migrated text-button" aria-expanded={translated} onClick={() => { setTranslated(value => !value); if (!translated) onHelp('translation'); }}>{translated ? '해석 접기' : '한국어 해석'}</HaruButton>
    </div>
    <GrammarQuestion key={practice.observation.id} question={practice.observation} answer={progress.observation}
      hinted={progress.observationHelp === 'answer'} clued={progress.observationHelp === 'clue' || progress.observationHelp === 'answer'} choice={progress.observationChoice}
      selection={[]} onOrder={() => {}} onChoice={onChoice} onAnswer={onAnswer}
      onHint={() => onHelp('answer')} onClue={() => onHelp('clue')} onNext={onNext} disabled={disabled} nextLabel="역할 알아보기" />
  </div>;
}

function ReadingLineView({ line, prefix, open, onOpen, revealed, disabled }: {
  line: ReadingLine; prefix: string; open: string | null; onOpen: (id: string | null) => void; revealed: boolean; disabled: boolean;
}) {
  const ranges = glossRanges(line);
  const fragments = ranges.map((range, index) => {
    const before = line.en.slice(index ? ranges[index - 1].end : 0, range.start);
    return <span key={index}>{before}<GlossWord gloss={range} id={`${prefix}-${index}`} open={open} onOpen={onOpen} revealed={revealed} disabled={disabled} /></span>;
  });
  return <HaruParagraph className="grammar-reading-text" lang="en">{fragments}{line.en.slice(ranges.at(-1)?.end ?? 0)}</HaruParagraph>;
}

function GlossWord({ gloss, id, open, onOpen, revealed, disabled }: {
  gloss: ReturnType<typeof glossRanges>[number]; id: string; open: string | null; onOpen: (id: string | null) => void; revealed: boolean; disabled: boolean;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  return <Popover open={open === id} onOpenChange={value => onOpen(value ? id : null)}>
    <PopoverTrigger asChild><HaruButton label={`${gloss.text} 뜻과 쓰임`} variant="secondary" ref={trigger} className="haru-migrated haru-native-action grammar-gloss-word" data-revealed={revealed} disabled={disabled} aria-label={`${gloss.text} 뜻과 쓰임`}>
      {gloss.text}{revealed && <span className="grammar-inline-role" lang="ko">{gloss.pos}</span>}
    </HaruButton></PopoverTrigger>
    <PopoverContent className="grammar-gloss" collisionPadding={16} sideOffset={8} aria-label={`${gloss.text} 뜻과 쓰임`} lang="ko"
      onCloseAutoFocus={event => { event.preventDefault(); if (open === null) trigger.current?.focus({ preventScroll: true }); }}>
      <div className="grammar-gloss-heading"><b lang="en">{gloss.text}</b><HaruIconButton label="뜻풀이 닫기" icon={<X size={18} />} className="haru-migrated haru-native-action icon-button" aria-label="뜻풀이 닫기" onClick={() => onOpen(null)}></HaruIconButton></div>
      <HaruParagraph>{gloss.meaning}</HaruParagraph><HaruParagraph className="small-note">기본형 <span lang="en">{gloss.lemma}</span> · {gloss.pos}</HaruParagraph><HaruParagraph>{gloss.role}</HaruParagraph>
    </PopoverContent>
  </Popover>;
}
