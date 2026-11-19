'use client';
import {HaruParagraph} from '../haru-content';
import {HaruButton} from '../haru-controls';

import { useRef } from 'react';
import { HaruIcon } from '@/components/icons/haru-icon';
import type { Progress, Word } from '@/lib/learning';
import { DialogHeader } from '@/components/ui/dialog';
import { SheetDialog, SheetDialogContent, SheetDialogTitle as DialogTitle, SheetDialogDescription as DialogDescription } from '../sheet-dialog';
import { useNavigationState } from '../navigation';
import { useViewRestoration } from '../use-view-restoration';
import { deferredView } from '../deferred-view';
import type { ImagePracticePositionController } from '@/lib/image-practice-position';

const PracticeContent = deferredView(() => import('./image-practice'), feature => feature.ImagePracticeContent, '이미지 연습');

export function ImagePracticeLauncher({ words, progress, controller }: { words: Word[]; progress: Record<string, Progress>; controller: ImagePracticePositionController | null }) {
  const [open, setOpen] = useNavigationState('app.imagePractice', false, true);
  const trigger = useRef<HTMLButtonElement>(null);
  const restoration = useViewRestoration();
  return <>
    <HaruButton label="이미지 연습" variant="secondary" icon={<HaruIcon name="image-card" size={18} />} ref={trigger} type="button" className="haru-migrated secondary-button full image-practice-entry" aria-haspopup="dialog" onClick={() => {setOpen(true);}}>이미지 연습</HaruButton>
    <SheetDialog navigationKey="app.imagePractice" open={open} onOpenChange={setOpen}>
      <SheetDialogContent className="framed-dialog image-practice-dialog" showCloseButton={false}
        onCloseAutoFocus={event => { event.preventDefault(); restoration.schedule('destination', () => trigger.current?.focus({ preventScroll: true })); }}>
        <DialogHeader><DialogTitle>이미지 연습</DialogTitle><DialogDescription>그림을 보고 영어 단어를 떠올려 보세요. 성적은 기록하지 않아요.</DialogDescription></DialogHeader>
        <HaruButton label="연습 닫기" variant="ghost" type="button" className="haru-migrated text-button image-practice-close" aria-label="연습 닫기" onClick={() => {setOpen(false);}}><span className="haru-practice-action"><HaruIcon name="x" size={20} />닫기</span></HaruButton>
        {open && (controller ? <PracticeContent key={controller.owner} words={words} progress={progress} controller={controller} /> : <HaruParagraph role="status">이미지 연습을 이어 하려면 로그인해 주세요.</HaruParagraph>)}
      </SheetDialogContent>
    </SheetDialog>
  </>;
}
