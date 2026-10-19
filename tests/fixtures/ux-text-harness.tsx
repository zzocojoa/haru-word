import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DeferredReloadBlocked, deferredView } from '../../app/deferred-view';
import { RecordText } from '../../app/record-text';
const FailedMaterial = deferredView(async () => { throw new Error('synthetic module failure'); }, () => () => null, '검사용');
function Harness() {
  const [blocked, setBlocked] = useState<false | 'busy' | 'unsaved'>('unsaved');
  return <main><h1>문구 회귀 검사</h1><button onClick={() => setBlocked('busy')}>저장 대기 설정</button><button onClick={() => setBlocked(false)}>저장 완료 설정</button>
    <DeferredReloadBlocked.Provider value={blocked}><FailedMaterial /></DeferredReloadBlocked.Provider>
    <RecordText text={'원문 <태그>와 줄바꿈\n'.repeat(30)} label="내 문장" />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
