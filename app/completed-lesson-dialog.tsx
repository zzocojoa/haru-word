'use client';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SheetDialog, SheetDialogContent } from './sheet-dialog';
import { deferredView } from './deferred-view';
import type { CompletedLessonProps } from './completed-lesson';

const Content = deferredView(() => import('./completed-lesson'), feature => feature.CompletedLesson, '완료 기록');

export function CompletedLessonDialog(props: CompletedLessonProps) {
  return <SheetDialog navigationKey="app.reviewDate" open onOpenChange={open => { if (!open) props.onClose(); }}>
    <SheetDialogContent className="completed-lesson framed-dialog">
      <DialogHeader>
        <DialogTitle>{props.date === props.todayDate ? '오늘 단어 다시 보기' : props.date + ' 단어 다시 보기'}</DialogTitle>
        <DialogDescription>저장된 뜻·표현을 확인해요. 성적은 바뀌지 않아요.</DialogDescription>
      </DialogHeader>
      <Content {...props} />
    </SheetDialogContent>
  </SheetDialog>;
}
