'use client';
import { useMemo, useRef, useState } from 'react';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cardContent } from '@/lib/catalog';
import type { Progress, Word } from '@/lib/learning';
import { resolveWordImage, WORD_IMAGES, type WordImage } from '@/lib/word-image';
import { useNavigationState } from '../navigation';
import { SheetDialog, SheetDialogContent } from '../sheet-dialog';
import { HelpDetails } from '../study-ui';
import { WordPronunciation } from '../word-pronunciation';

// Scene descriptions give an equivalent visual clue without naming the answer.
const SCENES: Record<string, string> = {
  adb44eba7b3ceef3: '줄기와 초록 잎이 달린 둥근 붉은 과일 하나',
  '5f16580c8972ee74': '두 바퀴와 페달, 안장, 손잡이가 있는 초록색 탈것',
  b126d2370a9613ab: '성인이 손과 발을 더 높은 바위에 짚는 모습',
  f5864c8efbe7df47: '강 양쪽을 연결하는 보행용 구조물',
  b46ad64c7a5a69ba: '성인이 물이 가득 든 잔을 두 손으로 수평을 유지하며 옮기는 모습',
  '1eaf195d746c1bed': '네 사람이 서로를 향해 모여 대화하는 모습',
  '43a095930598d1d9': '두 사람의 말풍선에 같은 서류 가방이 나타나는 대화',
  '2447b4e906f054db': '성인이 끝이 맞지 않는 나무 조각 두 개를 눈으로 비교하는 모습',
  bbaf364b8296dc31: '금고 앞 창구에서 손님과 직원이 동전을 주고받는 모습',
  '7d0090e31581cfbc': '사람이 강물과 맞닿은 육지 경사에 앉아 있는 모습',
  ff5920d7a9cc4dc1: '큰 창으로 햇빛이 가득 들어오는 방',
  '3d61cb48c5e328b3': '성인이 손가락 하나로 가방을 힘들이지 않고 들고 있는 모습',
  edc5dbe7137fd1e4: '기존 깃발과 발자국보다 먼 곳에 새 착지 자국이 있는 장면',
  '0cfe94787a643244': '성인이 마이크에 말하고 연결된 기기에 소리 파형이 나타나는 모습',
  '24a628a66305abe3': '책상 상판보다 낮은 위치에 가방이 놓인 장면',
  e4bb7a482ef799cf: '비를 맞던 사람이 우산을 펼치는 두 장면',
  '297bb80156b3fbbb': '같은 과일이 담긴 바구니에서 손이 하나를 집는 모습',
  '3252a93921452ecf': '여러 과일 중 두 사람이 같은 과일을 함께 가리키는 모습',
  '9d7dc668641d5e80': '성인이 다른 사람에게 잔과 받침을 두 손으로 권하는 모습',
  a3e22f23c501f85a: '열린 새장을 벗어나 하늘로 날아가는 새',
};
type Card = { word: Word; image: WordImage };

export function ImagePracticeLauncher({ words, progress }: { words: Word[]; progress: Record<string, Progress> }) {
  const [open, setOpen] = useNavigationState('app.imagePractice', false, true);
  const trigger = useRef<HTMLButtonElement>(null);
  const eligible = useMemo(() => WORD_IMAGES.flatMap(entry => {
    const word = words.find(word => word.id === entry.entryId);
    const image = word && resolveWordImage(word, cardContent(word.id, progress[word.id]).meaning);
    return word && image ? [{ word, image }] : [];
  }), [words, progress]);
  const [deck, setDeck] = useState<Card[]>([]);
  return <>
    <button ref={trigger} type="button" className="secondary-button full image-practice-entry" aria-haspopup="dialog"
      onClick={() => { setDeck(eligible); setOpen(true); }}>이미지 연습</button>
    <SheetDialog navigationKey="app.imagePractice" open={open} onOpenChange={setOpen}>
      <SheetDialogContent className="framed-dialog image-practice-dialog" showCloseButton={false}
        onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus({ preventScroll: true }); }}>
        <DialogHeader><DialogTitle>이미지 연습</DialogTitle><DialogDescription>시범 {deck.length}개 · 성적 미기록</DialogDescription></DialogHeader>
        <button type="button" className="text-button image-practice-close" aria-label="연습 닫기" onClick={() => setOpen(false)}>닫기</button>
        {open && (deck.length ? <PracticeCards deck={deck}/> : <p role="status">현재 선택한 뜻으로 연습할 이미지가 없어요.</p>)}
      </SheetDialogContent>
    </SheetDialog>
  </>;
}

function PracticeCards({ deck }: { deck: Card[] }) {
  const [index, setIndex] = useState(0);
  return <>
    <p className="small-note" aria-live="polite">{index + 1} / {deck.length}</p>
    <PracticeCard key={index} card={deck[index]} last={index === deck.length - 1}
      onNext={() => setIndex(index === deck.length - 1 ? 0 : index + 1)}/>
  </>;
}
function PracticeCard({ card, last, onNext }: { card: Card; last: boolean; onNext: () => void }) {
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  return <div className="dialog-scroll">
    {!revealed ? <><img className="image-practice-picture" src={card.image.url} width={card.image.width} height={card.image.height}
      alt={SCENES[card.image.entryId]} onLoad={() => setReady(true)}/>
    {!ready && <p role="status">이미지 불러오는 중</p>}
    <button type="button" className="primary-button full" disabled={!ready} onClick={() => setRevealed(true)}>단어 확인</button></>
      : <><p lang="en" className="image-practice-answer">{card.word.word}</p>
        <HelpDetails title="뜻·발음"><p>{card.image.baseMeaning}</p><WordPronunciation word={card.word} meaning={card.image.baseMeaning}/></HelpDetails>
        <button type="button" className="primary-button full" onClick={onNext}>{last ? '처음부터' : '다음'}</button></>}
  </div>;
}
