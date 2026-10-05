// Local synthetic learner and speech events only; no real audio or external requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { base, launchBrowser, closeBrowser, accountHeaders, axePath, waitForWorker } = require('./qa/runtime.cjs');
const { emptyState } = require('./fixtures/backup-history.cjs');
const engine = process.env.QA_BROWSER || 'chromium';
const baseline = process.argv.includes('--baseline');
const out = `outputs/pronunciation-ui/${baseline ? 'baseline' : engine}`;
const words = JSON.parse(fs.readFileSync('data/words.json'));
const content = JSON.parse(fs.readFileSync('data/content.json'));
const word = words.find(w => w.word === 'quickly' && w.pos === 'adv.');
const rest = words.filter(w => w.level === 'A1' && w.id !== word.id).slice(0, 9);
const ids = [...rest.slice(0, 5), word, ...rest.slice(5)].map(w => w.id);
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

(async () => {
  await waitForWorker();
  const browser = await launchBrowser({ engine });
  fs.mkdirSync(out, { recursive: true });
  const checks = [], errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', extraHTTPHeaders: accountHeaders('audio_ui') });
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    await context.addInitScript(() => {
      const audio = { voices: [{ lang: 'en-US' }], utterance: null, calls: 0, cancelled: 0, paused: false,
        getVoices() { return this.voices; }, cancel() { this.cancelled++; }, resume() { this.paused = false; },
        speak(utterance) { this.utterance = utterance; this.calls++; } };
      window.__testAudio = audio;
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: audio });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class { constructor(text) { this.text = text; } } });
    });
    const initial = { state: emptyState(), revision: 1 }, id = crypto.randomUUID();
    const sample = words.filter(w => w.level === 'A1').slice(0, 20).map(w => w.id);
    const session = { id, kind: 'daily', date, period: date, ids, warmupIds: [], stage: 'learn', index: 5,
      records: Object.fromEntries(ids.map(entry => [entry, { meaning: content[entry].meaning, material: content[entry], en: 'unmeasured', ko: 'unmeasured', sentenceStatus: 'unmeasured', sentence: '', notes: '' }])),
      retry: [], retryMode: false, elapsed: 36, paused: true, finished: false, createdAt: new Date().toISOString() };
    let revision = initial.revision, stored = { ...initial.state,
      settings: { ...initial.state.settings, dailyGoal: 10, activeSessionId: id, assessments: { A1: { ids: sample, index: 20, marks: Object.fromEntries(sample.map(entry => [entry, 'uncertain'])), completed: true } } },
      sessions: { [id]: session } };
    const get = async () => structuredClone({ state: stored, revision });
    await context.route('**/api/state', async route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: await get() });
      assert.equal(route.request().method(), 'PUT');
      const delta = route.request().postDataJSON();
      assert.equal(delta.revision, revision);
      stored = { ...stored, settings: delta.settings || stored.settings,
        progress: { ...stored.progress, ...delta.progress }, sessions: { ...stored.sessions, ...delta.sessions }, grammar: { ...stored.grammar, ...delta.grammar } };
      await route.fulfill({ json: { revision: ++revision } });
    });
    const page = await context.newPage();
    await page.clock.install();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByText('서버에 저장됨', { exact: true }).waitFor();
    await page.getByRole('button', { name: /학습 이어서/ }).click();
    await page.locator('.word-stage h3').getByText('quickly', { exact: true }).waitFor();
    await page.getByText('서버에 저장됨', { exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    const before = await get();
    const audio = page.locator('.word-pronunciation .speak-wrap');
    const button = audio.getByRole('button', { name: 'quickly 기기 음성 듣기', exact: true });
    const help = audio.locator('.audio-help');
    const message = audio.getByRole('status');
    const control = async event => page.evaluate(name => window.__testAudio.utterance[name]?.(), event);
    await page.screenshot({ path: `${out}/idle-390.png` });
    await button.click();
    await control('onstart');
    await message.getByText(baseline ? '기기 음성 재생 중이에요.' : '재생 중', { exact: true }).waitFor();
    await page.screenshot({ path: `${out}/playing-390.png` });
    if (baseline) { console.log(JSON.stringify({ baseline: true, screenshots: out })); return; }

    assert.equal(await help.getAttribute('open'), null);
    assert.equal(await help.getByText('기기 음성은 사전 발음과 다를 수 있어요.', { exact: true }).isVisible(), false);
    assert.equal(await message.evaluate(el => getComputedStyle(el).borderWidth), '0px');
    const bounds = await audio.boundingBox();
    assert(bounds.height <= 132, `Normal playback section too tall: ${bounds.height}`);
    assert.match(await audio.getByRole('link', { name: '사전 발음', exact: true }).getAttribute('href'), /^https:\/\/www\.oxfordlearnersdictionaries\.com\//);
    checks.push('normal playback stays compact with one listening button and dictionary link');

    await page.addScriptTag({ path: axePath });
    async function layout(label, controlledClock = false) {
      for (const width of [320, 390, 1440]) for (const zoom of [100, 200]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(value => document.documentElement.style.fontSize = value + '%', zoom);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${label} overflow at ${width}/${zoom}`);
        for (const item of await audio.locator('button,a,summary').all()) if (await item.isVisible()) {
          const box = await item.boundingBox();
          assert(box.width >= 44 && box.height >= 44, `${label} touch target ${box.width}x${box.height}`);
        }
      }
      await page.evaluate(() => document.documentElement.style.fontSize = '100%');
      await page.setViewportSize({ width: 390, height: 844 });
      const audit = page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.map(v => v.id));
      // Drain axe's deferred work in virtual time, below the speech watchdog deadline.
      if (controlledClock) await page.clock.runFor(1000);
      assert.deepEqual(await audit, [], label);
      checks.push(`${label}: 320/390/1440px, 200% text, 44px targets and axe`);
    }
    await layout('playing');
    await help.locator('summary').focus();
    await page.keyboard.press('Enter');
    await help.getByText('기기 음성은 사전 발음과 다를 수 있어요.', { exact: true }).waitFor();
    await layout('expanded help');
    await help.locator('summary').click();
    await control('onerror');
    await message.getByText(/기기 음성을 재생하지 못했어요.*Safari/).waitFor();
    await page.screenshot({ path: `${out}/error-390.png` });
    await layout('error recovery');
    await help.locator('summary').click();
    assert.equal(await message.getByText(/기기 음성을 재생하지 못했어요.*Safari/).isVisible(), true);
    await help.locator('summary').click();
    // Freeze the watchdog while layout/axe scans take real wall time on slow machines.
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await button.click();
    await message.getByText('준비 중', { exact: true }).waitFor();
    await layout('starting', true);
    await message.getByText('준비 중', { exact: true }).waitFor();
    await control('onstart');
    await page.clock.resume();
    await message.getByText('재생 중', { exact: true }).waitFor();
    await control('onend');
    await page.waitForFunction(() => document.querySelector('.word-pronunciation .audio-message')?.textContent === '');
    assert.equal(await message.textContent(), '');
    checks.push('keyboard disclosure, visible error details and manual retry preserve playback lifecycle');

    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await button.click();
    await page.clock.runFor(3999);
    await message.getByText('준비 중', { exact: true }).waitFor();
    await page.clock.runFor(1);
    await message.getByText(/기기 음성을 재생하지 못했어요.*Safari/).waitFor();
    await page.clock.resume();
    checks.push('controlled clock preserves the 4000ms startup watchdog without wall-time races');

    await page.evaluate(() => Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined }));
    await button.click();
    await message.getByText(/이 브라우저는 기기 음성을 지원하지 않아요.*Safari/).waitFor();
    await help.locator('summary').click();
    assert.equal(await message.getByText(/이 브라우저는 기기 음성을 지원하지 않아요/).isVisible(), true);
    await layout('unsupported browser help');
    assert.deepEqual(await get(), before, 'Listening and opening help must not change saved study records');
    assert.deepEqual(errors, []);
    checks.push('unsupported browser has recovery help; learning revision and records remain unchanged');

    const reviewed = words.find(w => w.word === 'close' && w.pos === 'v.');
    async function reviewedSense(meaning) {
      stored = { ...before.state, sessions: { [id]: { ...session, ids: [reviewed.id], index: 0,
        records: { [reviewed.id]: { ...session.records[word.id], meaning, material: content[reviewed.id] } } } } };
      revision++;
      await page.reload();
      await page.getByText('서버에 저장됨', { exact: true }).waitFor();
      await page.getByRole('button', { name: /학습 이어서/ }).click();
      await page.locator('.word-stage h3').getByText('close', { exact: true }).waitFor();
    }
    await reviewedSense(content[reviewed.id].meaning);
    await page.locator('.word-pronunciation .phonetic').getByText('/kloʊz/', { exact: true }).waitFor();
    await page.getByRole('link', { name: '미국식 사전 발음 듣기', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'close 기기 음성 듣기', exact: true }).count(), 0);
    await page.getByLabel('오늘 공부할 뜻', { exact: false }).fill('마감하다');
    await page.getByRole('link', { name: '사전에서 발음 확인', exact: true }).waitFor();
    assert.equal(await page.locator('.word-pronunciation .phonetic').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'close 기기 음성 듣기', exact: true }).count(), 0);
    checks.push('reviewed heteronym keeps dictionary-only pronunciation; changed sense never guesses IPA');
    assert.deepEqual(errors, []);

    // Render the real shared sentence consumer with the built page's CSS, without enabling grammar or writing learner data.
    const sentencePage = await context.newPage();
    sentencePage.on('pageerror', error => errors.push(error.message));
    await sentencePage.goto(base, { waitUntil: 'networkidle' });
    await sentencePage.evaluate(() => {
      const main = document.createElement('main'); main.id = 'sentence-fixture'; document.body.replaceChildren(main);
    });
    const bundle = await require('esbuild').build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { GrammarReading } from './app/grammar/grammar-reading';
      import { PRACTICE_LESSONS_V4 } from './lib/grammar/content-v4';
      createRoot(document.getElementById('sentence-fixture')).render(<section className="grammar-lesson">
        <GrammarReading practice={PRACTICE_LESSONS_V4.noun} progress={{stage:0,answers:{},sentence:''}} disabled={false}
          onHelp={()=>{}} onChoice={()=>{}} onAnswer={()=>{}} onNext={()=>{}}/>
      </section>);
    ` }, bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent' });
    await sentencePage.addScriptTag({ content: bundle.outputFiles[0].text });
    const sentenceAudio = sentencePage.locator('.grammar-reading-tools .speak-wrap');
    const sentenceButton = sentenceAudio.getByRole('button');
    const sentenceMessage = sentenceAudio.getByRole('status');
    await sentenceButton.waitFor();
    assert.equal(await sentenceAudio.locator('.audio-help').count(), 0);
    assert.equal(await sentenceAudio.getByRole('link').count(), 0);
    await sentenceButton.click();
    const sentenceHelp = sentenceAudio.locator('.audio-help');
    await sentenceHelp.waitFor();
    assert.equal(await sentenceHelp.getAttribute('open'), null);
    await sentencePage.evaluate(() => window.__testAudio.utterance.onerror());
    await sentenceMessage.getByText(/기기 음성을 재생하지 못했어요.*Safari/).waitFor();
    assert.equal(await sentenceHelp.getAttribute('open'), null);
    await sentenceHelp.locator('summary').focus();
    await sentencePage.keyboard.press('Enter');
    await sentenceHelp.getByText('기기 음성은 사전 발음과 다를 수 있어요.', { exact: true }).waitFor();
    await sentenceButton.click();
    await sentenceMessage.getByText('준비 중', { exact: true }).waitFor();
    await sentencePage.evaluate(() => window.__testAudio.utterance.onstart());
    await sentenceMessage.getByText('재생 중', { exact: true }).waitFor();
    await sentencePage.evaluate(() => window.__testAudio.utterance.onend());
    await sentencePage.waitForFunction(() => document.querySelector('.grammar-reading-tools .audio-message')?.textContent === '');
    await sentencePage.evaluate(() => window.__testAudio.voices = [{ lang: 'en-GB' }]);
    await sentenceButton.click();
    await sentenceMessage.getByText(/미국식 영어 음성을 찾지 못했어요/).waitFor();
    checks.push('shared grammar sentence has no initial help clutter, exposes specific errors and supports retry');
    assert.deepEqual(errors, []);
    fs.writeFileSync(`${out}/results.json`, JSON.stringify({ engine, checks, errors, actualIPhoneAudio: false, liveAiCalls: 0, productionWrites: 0, playbackHeight390: bounds.height }, null, 2));
    console.log(JSON.stringify({ engine, checks, playbackHeight390: bounds.height }));
  } finally { await closeBrowser(browser); }
})().catch(error => { console.error(error); process.exitCode = 1; });
