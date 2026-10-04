// Synthetic card data for local UI-only QA. No learner or operating account.
const cards = [1, 2].map(i => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  revision: 1, status: 'ready', asset_id: null, created_at: i,
  content: { template: 'expression', expression: `Study card ${i}`, meaning_ko: '합성 학습 표현',
    example_en: 'Take your time.', example_ko: '천천히 해.', note_ko: '' } }));
function initialState() {
  return { csrf: 'synthetic-ui-fixture', cards, assets: [], schedules: [], deliveries: [], previews: [], usage: [],
    cursors: { cards: null, assets: null, schedules: null, deliveries: null },
    totals: { cards: 2, assets: 0, schedules: 0, deliveries: 0, active_schedules: 0 },
    summary: { ready_cards: 0, attention: 0, api_accepted: 0, next_schedule: null },
    connection: null, mode: 'dry_run', now: 1791080000000 };
}
async function fixture(page, state) {
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace('/api/card-studio', '');
    if (p === '/api/boot') return route.fulfill({ json: { local: false, mode: state.mode, kakao_configured: true } });
    if (p === '/api/state') return route.fulfill({ json: state });
    if (p === '/api/page/cards') return route.fulfill({ json: { items: cards, total: 2, next: null } });
    return route.fulfill({ status: 500, json: { message: 'Unexpected synthetic request' } });
  });
}
module.exports = { cards, initialState, fixture };
