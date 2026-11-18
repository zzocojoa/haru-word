import { HaruIcon } from '@/components/icons/haru-icon';

/** Rendered in the first HTML, independently of iOS's cached launch image. */
export function StartupScreen() {
  return (
    <main className="app-splash" aria-labelledby="splash-title" aria-busy="true">
      <div className="app-splash-brand">
        <HaruIcon name="brand" size={72} />
        <h1 id="splash-title">하루단어</h1>
        <p className="app-splash-status" role="status">
          <span className="app-splash-spinner" aria-hidden="true" />
          학습 기록을 불러오는 중
        </p>
        <noscript>
          <style>{'.app-splash-status { display: none; }'}</style>
          <p>JavaScript를 켠 뒤 다시 열어 주세요.</p>
        </noscript>
      </div>
    </main>
  );
}
