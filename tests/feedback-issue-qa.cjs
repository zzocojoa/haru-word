// Synthetic local records and mocked AI only. Never contacts Google.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { base, accountHeaders, launchBrowser, closeBrowser, axePath } = require('./qa/runtime.cjs');
(async () => {
  await build({ entryPoints: ['lib/grammar/content.ts'], outfile: 'work/feedback-issue-content.cjs', bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
  const { LESSON_MAP } = require('../work/feedback-issue-content.cjs');
  const engine = process.env.QA_BROWSER || 'chromium', browser = await launchBrowser({ engine }), checks = [];
  try {
    for (const domain of ['sentence', 'grammar']) {
      const context = await browser.newContext({ extraHTTPHeaders: accountHeaders('feedback_issues'), viewport: { width: 390, height: 844 } });
      const page = await context.newPage(), errors = [], original = 'I like books.';
      page.setDefaultTimeout(10000); page.on('pageerror', e => errors.push(e.message));
      const snapshot = async () => (await context.request.get(base + '/api/state', { headers: { 'X-Study-Grammar': '1' } })).json();
      const initial = await snapshot(), now = new Date().toISOString();
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const word = JSON.parse(fs.readFileSync('data/words.json', 'utf8')).find(w => w.word === 'arrive' && w.pos === 'v.'), sid = crypto.randomUUID();
      const record = { meaning: '도착하다', familiarity: 'known', en: 'independent', ko: 'independent', sentenceStatus: 'unmeasured', sentence: '', notes: '' };
      const session = { id: sid, kind: 'daily', date, period: date, ids: [word.id], warmupIds: [], stage: 'sentence', index: 0, records: { [word.id]: record }, retry: [], retryMode: false, elapsed: 0, finished: false, paused: false, createdAt: now };
      const noun = { stage: 5, answers: Object.fromEntries(LESSON_MAP.get('noun').questions.map((q, i) => ['q' + (i + 1), { first: q.answer, latest: q.answer, helped: false, attempts: 1 }])), sentence: original, check: 'appropriate', updatedAt: now };
      assert.equal((await context.request.put(base + '/api/state', { data: { revision: initial.revision, progress: {}, sessions: domain === 'sentence' ? { [sid]: session } : {}, settings: { ...initial.state.settings, activeSessionId: domain === 'sentence' ? sid : null }, grammar: domain === 'grammar' ? { noun } : {} } })).status(), 200);
      await page.goto(base);
      if (domain === 'sentence') await page.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click();
      else {
        await page.getByRole('tab', { name: '단어장', exact: true }).click();
        await page.getByRole('tab', { name: '품사와 문장 연습', exact: true }).click();
        await page.locator('.grammar-tile').first().click();
      }
      const input = page.getByRole('textbox', { name: domain === 'sentence' ? '내 영어 문장' : '내 문장', exact: true });
      const transmission = page.locator('.ai-use-notice');
      await transmission.waitFor();
      assert.equal(await transmission.count(), 1);
      assert.equal(await transmission.isVisible(), true);
      assert.equal(await transmission.textContent(), `AI 요청 시 문장과 ${domain === 'grammar' ? '수업 목표를' : '단어·뜻을'} Google에 보내요. 응답 실패 시 Groq에도 보내요. 개인정보는 넣지 마세요. Google 무료 API의 입력·응답은 서비스 개선에 쓰일 수 있어요.`);
      assert.equal(await transmission.evaluate(el => el.previousElementSibling?.tagName === 'BUTTON' && el.previousElementSibling.textContent.includes('AI 참고 의견 요청') && !el.closest('details')), true, 'transmission notice directly follows the request button without a disclosure');
      checks.push(domain + ': transmission/privacy notice is visible exactly once directly below the request button before any AI call');
      await input.fill(original);
      let response, calls = 0;
      await page.route('**/api/' + domain + '-feedback', route => { calls++; return response.abort ? route.abort('failed') : route.fulfill({ status: response.status, json: response.body }); });
      const cases = [
        { status: 429, body: { code: 'provider_minute_limit', providerStatus: 429, retryAfterSeconds: 15 }, code: 'provider_minute_limit', title: 'Google 분당 한도' },
        { status: 429, body: { code: 'provider_daily_limit', providerStatus: 429 }, code: 'provider_daily_limit', title: 'Google 일일 한도' },
        { status: 503, body: { code: 'provider_key_invalid', providerStatus: 400 }, code: 'provider_key_invalid', title: 'Google 키 인증 실패' },
        { status: 503, body: { code: 'provider_timeout' }, code: 'provider_timeout', title: 'Google 응답 시간 초과' },
        { status: 503, body: { code: 'provider_network' }, code: 'provider_network', title: 'Google 연결 실패' },
        { status: 502, body: { code: 'provider_blocked' }, code: 'provider_blocked', title: 'Google 정책에 따른 응답 중단' },
        { status: 502, body: { code: 'provider_truncated' }, code: 'provider_truncated', title: 'AI 응답 길이 초과' },
        { status: 429, body: { error: 'PRIVATE_PROVIDER_MESSAGE' }, code: 'request_limited', title: '요청이 제한됐어요' },
        { status: 503, body: { code: 'untrusted', error: 'PRIVATE_PROVIDER_MESSAGE' }, code: 'site_error', title: '사이트 처리 실패' },
        { status: 200, body: null, code: 'invalid_response', title: '사이트 응답 형식 오류' },
        { abort: true, code: 'client_network', title: '사이트 연결 실패' },
        { status: 429, body: { code: 'groq_limit', providerStatus: 429, retryAfterSeconds: 8, previous: { code: 'provider_daily_limit', providerStatus: 429 } }, code: 'groq_limit', title: 'Groq 사용 한도' },
        { status: 503, body: { code: 'groq_key_invalid', providerStatus: 401, previous: { code: 'provider_timeout' } }, code: 'groq_key_invalid', title: 'Groq 키 인증 실패' },
        { status: 503, body: { code: 'groq_timeout', previous: { code: 'provider_network' } }, code: 'groq_timeout', title: 'Groq 응답 시간 초과' },
        { status: 502, body: { code: 'groq_invalid_response', previous: { code: 'provider_limit' } }, code: 'groq_invalid_response', title: 'Groq 교정 형식 오류' },
      ];
      for (const sample of cases) {
        response = sample;
        await page.getByRole('button', { name: 'AI 참고 의견 요청', exact: true }).click();
        const notice = page.locator('[data-feedback-code="' + sample.code + '"]');
        await notice.waitFor();
        // Technical titles moved into an explicit disclosure; the learner gets an action first.
        const visibleGuidance = await notice.innerText();
        assert.match(visibleGuidance, /직접 점검|자기 점검|다시 요청|개인정보|연결을 확인/);
        assert.doesNotMatch(visibleGuidance, /API 키|AI Studio|Groq Console|google_api|groq_api/);
        for (const summary of await notice.locator('summary').all()) await summary.click();
        assert.match(await notice.innerText(), new RegExp(sample.title));
        for (const summary of await notice.locator('summary').all()) await summary.click();
        assert.doesNotMatch(await notice.innerText(), /PRIVATE_PROVIDER_MESSAGE|untrusted/);
        assert.equal(await input.inputValue(), original);
        assert.ok(await page.getByRole('button', { name: domain === 'sentence' ? '문장을 완성했어요' : '수업 마치기', exact: false }).isEnabled());
        const before = calls; await page.waitForTimeout(80); assert.equal(calls, before, 'no automatic provider retry');
        if (sample.body?.previous) {
          assert.match(await notice.innerText(), /Google·Groq 점검을 마치지 못했어요/);
          assert.equal(await notice.locator('.ai-feedback-failure').count(), 2);
          await notice.getByText('Groq 오류 상세', { exact: true }).click();
          assert.match(await notice.innerText(), new RegExp(sample.code));
          await page.setViewportSize({ width: 320, height: 900 });
          assert.equal(await notice.evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
          if (sample.code === 'groq_limit') {
            await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
            assert.equal(await notice.evaluate(el => el.scrollWidth > el.clientWidth + 1), false, '200% dual-provider error text');
            await page.addStyleTag({ content: 'html { font-size: 100% !important; }' });
            const violations = await page.evaluate(async () => (await axe.run('.ai-feedback-issue', { runOnly: ['wcag2a', 'wcag2aa'] })).violations);
            assert.deepEqual(violations.map(v => v.id), []);
            await notice.screenshot({ path: 'work/groq-dual-error-' + domain + '-' + engine + '.png' });
          }
          await page.setViewportSize({ width: 390, height: 844 });
        }
        if (sample.code === 'provider_minute_limit') {
          assert.match(await notice.innerText(), /15초/);
          await notice.getByText('Google 오류 상세', { exact: true }).focus(); await page.keyboard.press('Enter');
          assert.match(await notice.innerText(), /provider_minute_limit · Google HTTP 429/);
          for (const width of [320, 390, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            assert.equal(await notice.evaluate(el => el.scrollWidth > el.clientWidth + 1), false, domain + ' notice overflow ' + width);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
          }
          await page.setViewportSize({ width: 320, height: 900 });
          await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
          assert.equal(await notice.evaluate(el => el.scrollWidth > el.clientWidth + 1), false, '200% error text');
          await page.addStyleTag({ content: 'html { font-size: 100% !important; }' });
          await page.addScriptTag({ path: axePath });
          const violations = await page.evaluate(async () => (await axe.run('.ai-feedback-issue', { runOnly: ['wcag2a', 'wcag2aa'] })).violations);
          assert.deepEqual(violations.map(v => v.id), []);
          await notice.screenshot({ path: 'work/feedback-issue-' + domain + '-' + engine + '.png' });
          await page.setViewportSize({ width: 390, height: 844 });
        }
      }
      assert.equal(calls, cases.length);
      const waitSaved = async model => {
        for (let i = 0; i < 100; i++) {
          const state = (await snapshot()).state;
          const feedback = domain === 'sentence' ? state.sessions[sid].records[word.id].aiFeedback : state.grammar.noun.feedback;
          if (feedback?.model === model) return state;
          await page.waitForTimeout(100);
        }
        throw Error('feedback not saved');
      };
      const success = (model, sentence) => ({ status: 200, body: { feedback: { original: sentence, model, createdAt: now, meaningUsage: 'appropriate', grammar: 'natural', correctedSentence: sentence, explanation: '알맞게 사용했어요.' } } });
      response = success('openai/gpt-oss-120b', original);
      await page.getByRole('button', { name: 'AI 참고 의견 요청', exact: true }).click();
      await page.locator('[data-feedback-provider="Groq"]').waitFor();
      await page.locator('[data-feedback-provider="Groq"]').screenshot({ path: 'work/groq-attribution-' + domain + '-' + engine + '.png' });
      const stored = await waitSaved('openai/gpt-oss-120b');
      if (domain === 'sentence') assert.equal(stored.sessions[sid].records[word.id].sentenceStatus, 'unmeasured');
      await page.reload();
      if (domain === 'sentence') await page.getByRole('button', { name: '중단한 학습 이어서', exact: true }).click();
      else { await page.getByRole('tab', { name: '단어장', exact: true }).click(); await page.getByRole('tab', { name: '품사와 문장 연습', exact: true }).click(); await page.locator('.grammar-tile').first().click(); }
      await page.locator('[data-feedback-provider="Groq"]').waitFor();
      assert.equal(calls, cases.length + 1, 'reload never calls a provider');
      const next = 'I like tea.'; await input.fill(next);
      response = success('gemini-3.1-flash-lite', next);
      await page.getByRole('button', { name: 'AI 참고 의견 요청', exact: true }).click();
      await page.locator('[data-feedback-provider="Google Gemini"]').waitFor();
      await waitSaved('gemini-3.1-flash-lite');
      assert.equal(calls, cases.length + 2); assert.deepEqual(errors, []);
      checks.push(domain + ': ' + cases.length + ' failure cases, draft preserved, manual completion available, no retries, layout/keyboard/accessibility');
      checks.push(domain + ': Google/Groq attribution survives server save and reload, with no grade changes or automatic rechecks');
      await context.close();
    }
    fs.writeFileSync('work/feedback-issue-qa-' + engine + '.json', JSON.stringify({ passed: true, checks }, null, 2));
    console.log(JSON.stringify({ passed: true, engine, checks }));
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error); process.exit(1); });
