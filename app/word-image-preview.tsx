'use client';
import { useState } from 'react';
import type { WordImage } from '@/lib/word-image';

// The keyed inner view also resets a failed request when the selected image changes.
export function WordImagePreview({ image, className = 'word-image-preview' }: { image: WordImage; className?: string }) {
  return <Preview key={image.sha256} image={image} className={className}/>;
}
function Preview({ image, className }: { image: WordImage; className: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? null : <img className={className} src={image.url} width={image.width} height={image.height}
    alt="선택한 뜻의 연상 그림" onError={() => setFailed(true)}/>;
}
