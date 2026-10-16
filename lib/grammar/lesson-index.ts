import raw from '../../data/grammar-index.json' with { type: 'json' };
import type { LessonId } from './model';
export const GRAMMAR_INDEX = raw.entries as { id: LessonId; pos: string; title: string; role: string; example: string[] }[];
export const LESSON_INDEX = new Map(GRAMMAR_INDEX.map(lesson => [lesson.id, lesson]));
export const POS_INDEX = new Map(GRAMMAR_INDEX.map(lesson => [lesson.pos, lesson]));
