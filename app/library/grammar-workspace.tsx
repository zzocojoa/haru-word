'use client';
import { useLayoutEffect, type ComponentProps, type RefObject } from 'react';
import { LESSON_MAP } from '@/lib/grammar/content';
import type { LessonId } from '@/lib/grammar/model';
import { GrammarLesson } from '../grammar/grammar-lesson';
import { GrammarCatalog } from '../grammar/grammar-catalog';

type Props = ComponentProps<typeof GrammarCatalog> & Omit<ComponentProps<typeof GrammarLesson>, 'lesson'> & {
  lessonId: LessonId | null; visible: boolean; headingRef: RefObject<HTMLHeadingElement | null>;
};
export function GrammarWorkspace({ lessonId, visible, ...props }: Props) {
  useLayoutEffect(() => {
    if (visible && !lessonId) props.headingRef.current?.focus({ preventScroll: true });
  }, [visible, lessonId, props.headingRef]);
  const lesson = lessonId ? LESSON_MAP.get(lessonId) : undefined;
  return lesson ? <GrammarLesson {...props} key={lesson.id} lesson={lesson} /> : <GrammarCatalog {...props} />;
}
