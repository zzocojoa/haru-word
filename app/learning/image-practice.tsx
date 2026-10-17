'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cardMeaning } from '@/lib/catalog-basics';
import type { Progress, Word } from '@/lib/learning';
import { resolveWordImage, WORD_IMAGES, type WordImage } from '@/lib/word-image';
import { HelpDetails } from '../study-ui';
import { WordPronunciation } from '../word-pronunciation';
import { PartOfSpeechLabel } from '../grammar-terms';
import { practiceNumber, resolvePracticeEntry, type ImagePracticePositionController, type PositionView } from '@/lib/image-practice-position';

// Curated pilot descriptions preserve a visual clue without naming the answer.
// Other images identify the exercise without inventing an unreviewed description.
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

export function ImagePracticeContent({ words, progress, controller }: { words: Word[]; progress: Record<string, Progress>; controller: ImagePracticePositionController }) {
  // Freeze this deck until the dialog closes, as before lazy loading.
  const [deck] = useState(() => {
    const byId = new Map(words.map(word => [word.id, word]));
    return WORD_IMAGES.flatMap(entry => {
      const word = byId.get(entry.entryId);
      const image = word && resolveWordImage(word, cardMeaning(word.id, progress[word.id]));
      return word && image ? [{ word, image }] : [];
    });
  });
  const position = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.open(); }, [controller]);
  return <>
    <p className="text-muted-foreground text-sm">{deck.length.toLocaleString('ko-KR')}개 · 성적 미기록</p>
    {!deck.length ? <p role="status">현재 선택한 뜻으로 연습할 이미지가 없어요.</p>
      : position.available ? <PracticeCards deck={deck} position={position} controller={controller}/>
      : <PositionStatus position={position} controller={controller}/>}
  </>;
}

function PositionStatus({ position, controller, fallback = false, displayedEntryId = position.entryId }: { position: PositionView; controller: ImagePracticePositionController; fallback?: boolean; displayedEntryId?: string | null }) {
  const status = position.status;
  return <div className="image-practice-status">
    <p role="status">{status === 'idle' || status === 'loading' ? '연습 위치 확인 중' : status === 'saving' ? '위치 저장 중'
      : status === 'conflict' ? '다른 기기에서 연습 위치가 바뀌었어요.' : status === 'auth' ? '로그인을 확인한 뒤 다시 열어 주세요.'
      : status === 'error' ? '위치 저장 실패 · 서버 확인이 필요해요.' : fallback ? '저장 위치 확인됨' : position.entryId ? '위치 저장됨' : '이동하면 위치가 저장돼요.'}</p>
    {status === 'error' && <button type="button" className="text-button" onClick={controller.retry}>{position.available ? '다시 저장' : '다시 불러오기'}</button>}
    {status === 'conflict' && position.remote && <div className="image-practice-choices">
      <button type="button" className="secondary-button" onClick={controller.useRemote}>다른 기기 위치로 이동</button>
      <button type="button" className="secondary-button" onClick={() => controller.keepCurrent(displayedEntryId)}>현재 위치 저장</button>
    </div>}
    {position.storageWarning && <p className="small-note">기기 내 위치 복구를 사용할 수 없어요. 창을 나가기 전에 서버 저장을 확인해 주세요.</p>}
  </div>;
}
function PracticeCards({ deck, position, controller }: { deck: Card[]; position: PositionView; controller: ImagePracticePositionController }) {
  const resolved = resolvePracticeEntry(position.entryId, WORD_IMAGES.map(entry => entry.entryId), deck.map(card => card.word.id));
  const index = Math.max(0, deck.findIndex(card => card.word.id === resolved.entryId));
  const [visit, setVisit] = useState(0);
  const [jump, setJump] = useState(false);
  const [number, setNumber] = useState('');
  const [numberError, setNumberError] = useState(false);
  const numberButton = useRef<HTMLButtonElement>(null);
  const move = (next: number) => {
    controller.move(deck[next].word.id); setVisit(value => value + 1); setJump(false); setNumberError(false);
  };
  const nextUrl = deck[index + 1]?.image.url;
  useEffect(() => {
    if (nextUrl) { const next = new Image(); next.src = nextUrl; }
  }, [nextUrl]);
  return <>
    <PracticeCard key={`${deck[index].word.id}:${visit}:${position.displayVersion}`} card={deck[index]}/>
    <div className="image-practice-controls">
      <p className="sr-only" aria-live="polite" aria-atomic="true">카드 {index + 1} / {deck.length}</p>
      {resolved.fallback && <p className="small-note" role="status">저장한 카드는 현재 연습에서 제외되어 다음 유효 카드 또는 첫 카드로 이동했어요. 이동 버튼을 누르면 새 위치를 저장해요.</p>}
      <PositionStatus position={position} controller={controller} fallback={resolved.fallback} displayedEntryId={resolved.entryId}/>
      <nav className="image-practice-navigation" aria-label="이미지 연습 카드 이동">
        <button type="button" className="secondary-button" disabled={index === 0 || position.status === 'auth'} onClick={() => move(index - 1)}>이전</button>
        <button ref={numberButton} type="button" className="text-button" aria-expanded={jump} aria-label={`카드 번호 ${index + 1} / ${deck.length}`} onClick={() => { setJump(!jump); setNumber(String(index + 1)); setNumberError(false); }}>{index + 1} / {deck.length}</button>
        <button type="button" className="secondary-button" disabled={index === deck.length - 1 || position.status === 'auth'} onClick={() => move(index + 1)}>다음</button>
      </nav>
      {jump && <form className="image-practice-jump" onSubmit={event => {
        event.preventDefault(); const next = practiceNumber(number, deck.length);
        if (next === null) setNumberError(true);
        else { move(next); numberButton.current?.focus({ preventScroll: true }); }
      }}>
        <label htmlFor="image-practice-number">카드 번호 (1–{deck.length})</label>
        <input id="image-practice-number" type="text" inputMode="numeric" value={number} aria-invalid={numberError}
          aria-describedby={numberError ? 'image-practice-number-error' : undefined} onChange={event => { setNumber(event.target.value); setNumberError(false); }}/>
        <button type="submit" className="secondary-button" disabled={position.status === 'auth'}>이동</button>
        {numberError && <p id="image-practice-number-error" role="alert">1부터 {deck.length} 사이 정수를 입력해 주세요.</p>}
      </form>}
    </div>
  </>;
}
function PracticeCard({ card }: { card: Card }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revealed, setRevealed] = useState(false);
  return <div className="dialog-scroll">
    {!revealed ? <>{!failed && <img className="image-practice-picture" src={card.image.url} width={card.image.width} height={card.image.height}
      alt={SCENES[card.image.entryId] || '영단어를 떠올리는 그림. 단어 확인을 누르면 뜻과 품사를 볼 수 있어요.'} onLoad={() => setReady(true)} onError={() => setFailed(true)}/>}
    {failed ? <p role="alert">이미지를 불러오지 못했어요. 아래 이동 버튼으로 다른 카드를 볼 수 있어요.</p>
      : <>{!ready && <p role="status">이미지 불러오는 중</p>}
        <button type="button" className="primary-button full" disabled={!ready} onClick={() => setRevealed(true)}>단어 확인</button></>}</>
      : <><div className="image-practice-sense">
        <p lang="en" className="image-practice-answer">{card.word.word}</p>
        <p className="image-practice-meaning">{card.image.baseMeaning}</p>
        <p className="small-note"><PartOfSpeechLabel pos={card.image.pos}/></p>
        </div>
        <HelpDetails title="발음"><WordPronunciation word={card.word} meaning={card.image.baseMeaning}/></HelpDetails></>}
  </div>;
}
