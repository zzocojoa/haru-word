'use client';
import { useRef } from 'react';
import type { Progress, Word } from '@/lib/learning';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SheetDialog, SheetDialogContent } from '../sheet-dialog';
import { useNavigationState } from '../navigation';
import { useViewRestoration } from '../use-view-restoration';
import { deferredView } from '../deferred-view';

const PracticeContent = deferredView(() => import('./image-practice'), feature => feature.ImagePracticeContent, '이미지 연습');

export function ImagePracticeLauncher({ words, progress }: { words: Word[]; progress: Record<string, Progress> }) {
  const [open, setOpen] = useNavigationState('app.imagePractice', false, true);
  const trigger = useRef<HTMLButtonElement>(null);
  const restoration = useViewRestoration();
  return <>
    <button ref={trigger} type="button" className="secondary-button full image-practice-entry" aria-haspopup="dialog" onClick={() => setOpen(true)}>이미지 연습</button>
    <SheetDialog navigationKey="app.imagePractice" open={open} onOpenChange={setOpen}>
      <SheetDialogContent className="framed-dialog image-practice-dialog" showCloseButton={false}
        onCloseAutoFocus={event => { event.preventDefault(); restoration.schedule('destination', () => trigger.current?.focus({ preventScroll: true })); }}>
        <DialogHeader><DialogTitle>이미지 연습</DialogTitle><DialogDescription className="sr-only">그림을 보고 단어를 떠올려요. 성적은 기록하지 않아요.</DialogDescription></DialogHeader>
        <button type="button" className="text-button image-practice-close" aria-label="연습 닫기" onClick={() => setOpen(false)}>닫기</button>
        {open && <PracticeContent words={words} progress={progress} />}
      </SheetDialogContent>
    </SheetDialog>
  </>;
}
