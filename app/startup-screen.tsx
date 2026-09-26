/** Rendered in the first HTML, independently of iOS's cached launch image. */
export function StartupScreen() {
  return (
    <main className="app-splash" aria-labelledby="splash-title" aria-busy="true">
      <div className="app-splash-brand">
        <svg width="72" height="72" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <rect width="32" height="32" rx="8" fill="#d9f95f" />
          <path d="M7 8h7l2 2 2-2h7v16h-7l-2 2-2-2H7zM16 10v15" fill="none" stroke="#242621" strokeWidth="2" />
        </svg>
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
