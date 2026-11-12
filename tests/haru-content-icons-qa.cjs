// P030–P053: real local UI and isolated synthetic records; no provider generation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
const { createIconQa } = require('./qa/haru-icon-helpers.cjs');
const { history } = require('./fixtures/backup-history.cjs');
const { completedAssessment } = require('./qa/fixtures.cjs');

// Measure the actual laid-out text, including glyphs hidden by a line clamp.
const textGeometry = element => {
  const range = document.createRange();
  range.selectNodeContents(element);
  const rects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
  const bounds = element.getBoundingClientRect();
  const control = element.closest('button')?.getBoundingClientRect() ?? bounds;
  const inside = frame => rects.every(rect => rect.left >= frame.left - 1 && rect.right <= frame.right + 1
    && rect.top >= frame.top - 1 && rect.bottom <= frame.bottom + 1);
  return {
    text: element.textContent.trim(),
    lines: new Set(rects.map(rect => Math.round(rect.top * 2) / 2)).size,
    inside: inside(bounds) && inside(control),
    clipped: element.clientWidth > 0 && (element.scrollWidth > element.clientWidth + 1
      || element.scrollHeight > element.clientHeight + 1),
    width: bounds.width, controlWidth: control.width, controlHeight: control.height,
  };
};

(async () => {
  const qa = await createIconQa('haru-content-icons');
  const { page, context, base, report } = qa;
  let failure, heldPosition, heldState;
  try {
    const words = JSON.parse(fs.readFileSync('data/words.json', 'utf8'));
    const imageRows = JSON.parse(fs.readFileSync('data/word-image-ui.json', 'utf8')).entries;
    const imageIds = imageRows.map(row => row[0]);
    const imageRoot = process.env.QA_WORD_IMAGE_ASSET_ROOT || 'public/word-images-pilot';
    const positionPath = '/api/image-practice/position';
    const button = name => page.getByRole('button', { name, exact: true });
    const until = async (predicate, label) => {
      for (let attempt = 0; attempt < 150; attempt++) {
        if (await predicate()) return;
        await page.waitForTimeout(100);
      }
      throw Error(label + ' did not settle');
    };
    const position = async () => {
      const response = await context.request.get(base + positionPath);
      assert.equal(response.status(), 200, await response.text());
      return response.json();
    };
    const grammarSaved = async predicate => {
      await until(async () => predicate((await qa.getState()).state.grammar?.noun), 'Grammar persistence');
      await page.locator('.grammar-toolbar').getByText('저장됨', { exact: true }).waitFor();
      await qa.saved();
    };
    const artwork = locator => locator.evaluate(element => element.innerHTML);
    let holdPosition = false, holdState = false;
    const positionCalls = [], externalRequests = [];
    const optionalFontStylesheet = new URL('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;600;700;800&display=optional');
    const queryKey = url => JSON.stringify([...url.searchParams.entries()].sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv)));
    const recordRequest = (entries, request, response) => {
      const url = request.url(), resourceType = request.resourceType(), method = request.method();
      const previous = entries.find(entry => entry.url === url && entry.resourceType === resourceType && entry.method === method);
      if (previous) previous.count++;
      else entries.push({ url, resourceType, method, count: 1, response });
    };
    report.optionalFontStylesheets = [];
    report.externalRequests = externalRequests;
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      // Isolate only the optional stylesheet mounted by app/web-fonts.tsx.
      // Axe reads a cross-origin stylesheet again with XHR; allow that same CSS
      // resource, including equivalent query escaping, without any remote fetch.
      if (request.method() === 'GET' && ['stylesheet', 'xhr', 'fetch'].includes(request.resourceType())
        && url.origin === optionalFontStylesheet.origin && url.pathname === optionalFontStylesheet.pathname
        && !url.username && !url.password && !url.hash && queryKey(url) === queryKey(optionalFontStylesheet)) {
        recordRequest(report.optionalFontStylesheets, request, 'empty-css');
        return route.fulfill({ contentType: 'text/css', headers: { 'access-control-allow-origin': base },
          body: '/* Optional web fonts omitted in icon layout QA. */' });
      }
      if (url.origin !== base) {
        recordRequest(externalRequests, request, 'blocked');
        return route.abort();
      }
      if (url.pathname.startsWith('/word-images/v1/')) {
        const filename = path.join(imageRoot, path.basename(url.pathname));
        // The first three exercises use the repository's approved pilot files.
        // Do not substitute a different picture for a missing exercise asset.
        assert.ok(fs.existsSync(filename), 'Approved pilot image exists: ' + filename);
        return route.fulfill({ contentType: 'image/webp', body: fs.readFileSync(filename) });
      }
      if (url.pathname === positionPath) {
        positionCalls.push(request.method());
        if (holdPosition && request.method() === 'PUT') { holdPosition = false; heldPosition = route; return; }
      }
      if (url.pathname === '/api/state' && holdState && request.method() === 'PUT') {
        holdState = false; heldState = route; return;
      }
      return route.continue();
    });

    const initial = await qa.getState(), historical = history(1, 3);
    await qa.seed({
      settings: { ...initial.state.settings, ...historical.settings, assessments: { A1: completedAssessment(words) } },
      progress: historical.progress, sessions: historical.sessions, grammar: {},
    });
    const baseline = await qa.getState();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await qa.saved();

    // Image practice changes only its independent cursor, never learning scores.
    const entry = button('이미지 연습');
    await qa.inspect('image-entry', { icons: [[entry.locator('svg'), 18, 'P030 image practice']] });
    assert.deepEqual(positionCalls, [], 'Opening Today does not read or write the image cursor');
    await qa.click(entry, 'image-entry');
    const dialog = page.getByRole('dialog', { name: '이미지 연습', exact: true });
    const previous = dialog.getByRole('button', { name: '이전', exact: true });
    const next = dialog.getByRole('button', { name: '다음', exact: true });
    const number = () => dialog.getByRole('button', { name: /카드 번호 \d+ \/ \d+/ });
    const status = dialog.locator('.image-practice-position');
    const close = dialog.getByRole('button', { name: '연습 닫기', exact: true });
    const imageIcons = () => [
      [dialog.locator('.image-practice-hint > svg'), 18, 'P031 card flip hint'],
      [previous.locator('svg'), 18, 'P032 previous card'],
      [next.locator('svg'), 18, 'P033 next card'],
      [number().locator('svg'), 18, 'P034 card number'],
      [status.locator('svg'), 16, 'P035 cursor status'],
      [close.locator('svg'), 20, 'P036 close practice'],
    ];
    const inspectImageNavigation = async (width, textSize, phase) => {
      report.imageNavigationVisibility ??= [];
      for (const navigationButton of [previous, number(), next]) {
        const bounds = await navigationButton.boundingBox();
        assert.ok(bounds && bounds.width >= 44 && bounds.height >= 44 && bounds.x >= 0 && bounds.y >= 0
          && bounds.x + bounds.width <= width + 0.5 && bounds.y + bounds.height <= 844.5,
        'Image navigation target remains complete: ' + JSON.stringify({ width, textSize, phase, bounds }));
        const visibility = await navigationButton.evaluate(element => {
          const target = element.getBoundingClientRect();
          const ancestors = [];
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            const clipsX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX);
            const clipsY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY);
            if (!clipsX && !clipsY) continue;
            const frame = parent.getBoundingClientRect();
            // Overflow clips at the client padding box, inside borders and
            // scrollbars; fitting the outer viewport alone does not prove visibility.
            const left = frame.left + parent.clientLeft;
            const top = frame.top + parent.clientTop;
            const right = left + parent.clientWidth;
            const bottom = top + parent.clientHeight;
            ancestors.push({
              tag: parent.tagName, className: parent.className,
              controls: parent.classList.contains('image-practice-controls'),
              clipsX, clipsY, clip: { left, top, right, bottom },
              outsideX: clipsX && (target.left < left - 0.5 || target.right > right + 0.5),
              outsideY: clipsY && (target.top < top - 0.5 || target.bottom > bottom + 0.5),
            });
          }
          return { label: element.getAttribute('aria-label') || element.textContent.trim(), ancestors };
        });
        const evidence = { width, textSize, phase, bounds, ...visibility };
        report.imageNavigationVisibility.push(evidence);
        assert.ok(visibility.ancestors.some(ancestor => ancestor.controls),
          'Image navigation is checked against its actual controls scroller');
        assert.deepEqual(visibility.ancestors.filter(ancestor => ancestor.outsideX || ancestor.outsideY), [],
          'Image navigation borders fit every ancestor clip box: ' + JSON.stringify(evidence));
      }
    };
    await number().waitFor();
    await page.waitForFunction(() => document.querySelector('.image-practice-picture')?.naturalWidth > 0);
    assert.equal(await previous.isDisabled(), true, 'The first card still disables Previous');
    assert.equal(await next.isDisabled(), false);
    await status.getByText('이동하면 위치가 저장돼요.', { exact: true }).waitFor();
    const blankCursor = await position(), plainCloud = await artwork(status.locator('svg'));
    await qa.inspect('image-front', { icons: imageIcons() });
    for (const width of [320, 390, 1440]) for (const textSize of [100, 200]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(size => { document.documentElement.style.fontSize = size + '%'; }, textSize);
      await qa.settle();
      assert.equal(await dialog.evaluate(element => element.scrollWidth > element.clientWidth + 1), false,
        'Image dialog has no horizontal clipping at ' + width + '/' + textSize);
      await inspectImageNavigation(width, textSize, 'initial');
      const hint = dialog.locator('.image-practice-hint');
      await hint.scrollIntoViewIfNeeded();
      await qa.settle();
      assert.equal(await hint.evaluate(element => {
        const bounds = element.getBoundingClientRect(), body = element.closest('.dialog-scroll').getBoundingClientRect();
        return bounds.top >= body.top - 1 && bounds.bottom <= body.bottom + 1;
      }), true, 'The flip explanation can be scrolled fully into view');
      await inspectImageNavigation(width, textSize, 'after-hint-scroll');
      if (width === 320) await qa.capture('image-controls-320-' + textSize + '.png', false);
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
    await page.setViewportSize({ width: 390, height: 844 });
    const flip = dialog.locator('.image-practice-flip');
    await flip.click();
    await dialog.locator('.image-practice-answer').waitFor();
    assert.equal(await flip.locator('button, a, input').count(), 0, 'The flip card contains no nested interactive control');
    await qa.inspect('image-back', { icons: imageIcons() });
    assert.deepEqual(await position(), blankCursor, 'Flipping a card does not save a cursor');
    assert.deepEqual(await qa.getState(), baseline, 'Image viewing does not grade or change learning records');

    holdPosition = true;
    await qa.click(next, 'image-next');
    await until(() => !!heldPosition, 'Held image cursor save');
    await status.getByText('위치 저장 중', { exact: true }).waitFor();
    await qa.checkIcon(status.locator('svg'), 16, 'P035 saving');
    const savingCursorArt = await artwork(status.locator('svg'));
    assert.notEqual(savingCursorArt, plainCloud);
    await qa.capture('image-position-saving-320.png', false);
    const failedPosition = heldPosition; heldPosition = null;
    await failedPosition.fulfill({ status: 503, json: { error: 'Synthetic cursor save failure' } });
    const retryPosition = dialog.getByRole('button', { name: '다시 저장', exact: true });
    await retryPosition.waitFor();
    const failedCursorArt = await artwork(status.locator('svg'));
    assert.notEqual(failedCursorArt, savingCursorArt);
    assert.deepEqual(await position(), blankCursor, 'A failed cursor write preserves the server position');
    await qa.inspect('image-position-error', { icons: imageIcons() });
    const retryStart = positionCalls.length;
    await qa.click(retryPosition, 'image-position-retry');
    await status.getByText('위치 저장됨', { exact: true }).waitFor();
    assert.deepEqual(positionCalls.slice(retryStart), ['GET', 'PUT'], 'Retry reads the server before saving the pending cursor');
    assert.equal((await position()).entryId, imageIds[1]);
    const savedCursorArt = await artwork(status.locator('svg'));
    assert.notEqual(savedCursorArt, failedCursorArt);
    assert.notEqual(savedCursorArt, plainCloud);
    await qa.checkIcon(status.locator('svg'), 16, 'P035 saved');
    await qa.capture('image-position-saved-320.png', false);
    await qa.click(number(), 'image-number');
    const numberInput = dialog.getByLabel(/카드 번호 \(1/);
    assert.equal(await numberInput.getAttribute('inputmode'), 'numeric');
    const cursorBeforeInvalid = await position();
    await numberInput.fill('0');
    await dialog.getByRole('button', { name: '이동', exact: true }).click();
    await dialog.locator('#image-practice-number-error').waitFor();
    assert.equal(await numberInput.getAttribute('aria-invalid'), 'true');
    assert.deepEqual(await position(), cursorBeforeInvalid);
    await numberInput.fill('3');
    await numberInput.press('Enter');
    await status.getByText('위치 저장됨', { exact: true }).waitFor();
    assert.equal((await position()).entryId, imageIds[2]);
    assert.equal(await number().getAttribute('aria-label'), '카드 번호 3 / ' + imageIds.length);
    assert.equal(await number().evaluate(element => element === document.activeElement), true, 'Number jump restores focus');
    await qa.click(close, 'image-close');
    await dialog.waitFor({ state: 'hidden' });
    await until(() => entry.evaluate(element => element === document.activeElement), 'Image entry focus return');
    await page.reload({ waitUntil: 'domcontentloaded' }); await qa.saved();
    await entry.click(); await number().waitFor();
    await status.getByText('위치 저장됨', { exact: true }).waitFor();
    assert.equal(await number().getAttribute('aria-label'), '카드 번호 3 / ' + imageIds.length);
    await close.click(); await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual(await qa.getState(), baseline, 'Cursor failure, retry, jump and reload preserve learning history and revision');
    report.checks.push('P030–P036: card flip, native number entry, boundary disabled state, independent cursor save/failure/retry/reload, 44px controls and focus return');

    // Library actions here are read-only; opening the add form never submits it.
    await page.getByRole('tab', { name: '단어장', exact: true }).click();
    const search = page.getByRole('textbox', { name: '단어 또는 한국어 뜻 검색', exact: true });
    await search.waitFor();
    const library = page.locator('.library-panel');
    const topPagination = page.getByRole('navigation', { name: '단어 목록 상단 페이지 이동', exact: true });
    const previousPage = topPagination.getByRole('button', { name: '이전 페이지', exact: true });
    const nextPage = topPagination.getByRole('button', { name: '다음 페이지', exact: true });
    const addWord = button('개인 단어 추가');
    const posHelp = library.locator('.pos-help-button').first();
    const libraryIcons = [
      [library.locator('.search-box > svg'), 18, 'P037 search'],
      [addWord.locator('svg'), 17, 'P038 add personal word'],
      [previousPage.locator('svg'), 19, 'P039 previous page'],
      [nextPage.locator('svg'), 19, 'P040 next page'],
      [posHelp.locator('svg'), 16, 'P041 part of speech help'],
    ];
    await qa.inspect('library-list', { icons: libraryIcons });
    // Overflow alone misses a readable word squeezed into one glyph per line,
    // or a SelectValue whose own clipping hides part of the selected label.
    const beforeLibraryReadability = await qa.getState();
    report.libraryReadability = [];
    const shortWords = library.locator('.word-link b').filter({ hasText: /^[a-z]{2,8}$/i });
    const selectedValues = library.locator('.library-controls [data-slot=select-value]');
    assert.ok(await shortWords.count() > 0, 'Visible short English words exist for layout inspection');
    assert.equal(await selectedValues.count(), 3);
    for (const width of [320, 390, 430, 768, 1440]) for (const textSize of [100, 200]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(size => { document.documentElement.style.fontSize = size + '%'; }, textSize);
      await qa.settle();
      const entry = { width, textSize, words: [], filters: [] };
      report.libraryReadability.push(entry);
      for (const word of await shortWords.all()) {
        const geometry = await word.evaluate(textGeometry);
        entry.words.push(geometry);
        assert.ok(geometry.lines === 1 && geometry.inside && !geometry.clipped,
          'A short English word stays whole at ' + width + '/' + textSize + ': ' + JSON.stringify(geometry));
      }
      for (const value of await selectedValues.all()) {
        const geometry = await value.evaluate(textGeometry);
        entry.filters.push(geometry);
        assert.ok(geometry.lines > 0 && geometry.inside && !geometry.clipped,
          'The complete selected filter label is visible at ' + width + '/' + textSize + ': ' + JSON.stringify(geometry));
      }
      if (width === 320 && textSize === 200) {
        await library.locator('.library-controls').evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await qa.settle();
        await qa.capture('library-filters-readable-320-200.png', false);
        await library.locator('.word-table tbody tr').first().evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await qa.settle();
        await qa.capture('library-words-readable-320-200.png', false);
      }
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
    await page.setViewportSize({ width: 390, height: 844 });
    await qa.settle();
    assert.deepEqual(await qa.getState(), beforeLibraryReadability, 'Library readability inspection preserves records and revision');
    report.checks.push('Library 320–1440px/100–200%: short English words remain on one line and every selected filter label fits without clipping');
    assert.equal(await previousPage.isDisabled(), true);
    await qa.click(nextPage, 'library-next-page');
    assert.equal(await previousPage.isDisabled(), false);
    assert.match(await topPagination.getByRole('status').innerText(), /2\s*\//);
    await qa.click(previousPage, 'library-previous-page');
    assert.equal(await previousPage.isDisabled(), true);
    await qa.click(posHelp, 'library-pos-help');
    await page.getByRole('dialog').waitFor();
    await button('이 품사 배우기').waitFor();
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await until(() => posHelp.evaluate(element => element === document.activeElement), 'POS help focus return');
    await search.fill('__haru_icons_no_matching_word__');
    await library.getByRole('heading', { name: '일치하는 단어가 없어요.', exact: true }).waitFor();
    await qa.inspect('library-no-results', { icons: [
      [library.locator('.search-box > svg'), 18, 'P037 search'],
      [library.locator('.empty-state > svg'), 24, 'P042 no search results'],
    ] });
    assert.equal(await previousPage.isDisabled(), true); assert.equal(await nextPage.isDisabled(), true);
    await search.fill('');
    await qa.click(addWord, 'library-add-word');
    await page.getByRole('dialog', { name: '나에게 필요한 단어 추가', exact: true }).waitFor();
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await until(() => addWord.evaluate(element => element === document.activeElement), 'Add-word focus return');
    assert.deepEqual(await qa.getState(), baseline, 'Search, pagination, help and opening/canceling add preserve every record');
    assert.deepEqual(report.requests.filter(request => request.path === '/api/state'), [], 'Read-only image/library flows do not issue a state mutation');
    report.checks.push('P037–P042: search and empty state, native pagination boundaries, help/add dialogs, unchanged accessible labels, no learning-state write');

    // Complete one current-content lesson through its actual controls.
    const version = Number(process.env.QA_GRAMMAR_VERSION || 4);
    assert.ok([2, 3, 4].includes(version));
    const fixtureFile = path.resolve('work/haru-content-icons/content-v4.cjs');
    await build({ entryPoints: ['lib/grammar/content-v4.ts'], outfile: fixtureFile, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
    const practice = require(fixtureFile).practiceForVersion('noun', version);
    await page.getByRole('tab', { name: '품사와 문장 연습', exact: true }).click();
    const nounTile = page.locator('.grammar-tile').filter({ has: page.locator('b', { hasText: /^명사$/ }) });
    await nounTile.waitFor();
    await qa.inspect('grammar-catalog', { icons: [
      [page.locator('.grammar-catalog-count > svg'), 16, 'P043 completed lesson count'],
      [nounTile.locator('.grammar-tile-heading > svg'), 18, 'P044 enter lesson'],
    ] });
    await qa.click(nounTile, 'grammar-enter');
    const lesson = page.locator('.grammar-lesson');
    const backToList = button('수업 목록');
    const hint = button('힌트 보기');
    const reveal = button('답 보기 · 도움으로 기록');
    const nextStage = button('역할 알아보기');
    const feedbackIcon = () => lesson.locator('.grammar-feedback-title > svg');
    await nextStage.waitFor();
    assert.equal(await nextStage.isDisabled(), true);
    await qa.inspect('grammar-reading', { icons: [
      [backToList.locator('svg'), 18, 'P046 lesson list'],
      [hint.locator('svg'), 17, 'P049 hint'],
      [reveal.locator('svg'), 17, 'P049 reveal answer'],
      [nextStage.locator('svg'), 18, 'P047 next stage'],
    ] });
    const beforeReadingReadability = await qa.getState();
    report.readingAudioReadability = [];
    const readingAudio = lesson.locator('.grammar-reading-tools .device-audio');
    for (const width of [320, 390, 430]) for (const textSize of [100, 200]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(size => { document.documentElement.style.fontSize = size + '%'; }, textSize);
      await qa.settle();
      const geometry = await readingAudio.locator('span').evaluate(textGeometry);
      report.readingAudioReadability.push({ width, textSize, ...geometry });
      assert.ok(geometry.lines >= 1 && geometry.lines <= 2 && geometry.inside && !geometry.clipped,
        'The device-audio label stays readable at ' + width + '/' + textSize + ': ' + JSON.stringify(geometry));
      assert.ok(geometry.controlWidth >= 44 && geometry.controlHeight >= 44, 'The reading audio control keeps its touch target');
      if (width === 320 && textSize === 200) {
        await readingAudio.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await qa.settle();
        await qa.capture('grammar-reading-audio-320-200.png', false);
      }
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
    await page.setViewportSize({ width: 390, height: 844 });
    await qa.settle();
    assert.deepEqual(await qa.getState(), beforeReadingReadability, 'Reading audio layout inspection does not play audio or change records');
    report.checks.push('Reading audio 320–430px/100–200%: the complete label uses at most two lines inside a 44px control; no audio is played');
    const wrong = practice.observation.options.find(option => option !== practice.observation.answer);
    const choices = lesson.locator('.grammar-choices');
    await choices.getByRole('button', { name: wrong, exact: true }).click();
    assert.equal(await lesson.locator('.grammar-feedback').count(), 0, 'Selection alone is not an answer');
    await qa.checkIcon(choices.locator('[aria-pressed=true] svg'), 16, 'P048 selected answer');
    await hint.click();
    assert.equal(await hint.isDisabled(), true);
    await reveal.click();
    assert.equal(await reveal.isDisabled(), true);
    await grammarSaved(progress => progress?.observationHelp === 'answer' && progress.observation === undefined);
    assert.equal(await nextStage.isDisabled(), true, 'Revealing help does not submit an answer');
    await qa.inspect('grammar-answer-revealed', { icons: [[feedbackIcon(), 19, 'P050 answer shown without submission']] });
    const revealedArt = await artwork(feedbackIcon());
    await button('답 확인').click();
    await grammarSaved(progress => progress?.observation?.latest === wrong);
    assert.equal(await lesson.locator('.grammar-feedback').getAttribute('data-tone'), 'review');
    await qa.inspect('grammar-incorrect', { icons: [[feedbackIcon(), 19, 'P050 incorrect answer'], [choices.locator('[aria-pressed=true] svg'), 16, 'P048 selected answer']] });
    const incorrectArt = await artwork(feedbackIcon());
    assert.notEqual(incorrectArt, revealedArt);
    await choices.getByRole('button', { name: practice.observation.answer, exact: true }).click();
    await button('답 확인').click();
    await grammarSaved(progress => progress?.observation?.latest === practice.observation.answer);
    assert.equal(await lesson.locator('.grammar-feedback').getAttribute('data-tone'), 'success');
    assert.notEqual(await artwork(feedbackIcon()), incorrectArt);
    await qa.checkIcon(feedbackIcon(), 19, 'P050 correct answer');
    const observation = (await qa.getState()).state.grammar.noun.observation;
    assert.equal(observation.first, wrong); assert.equal(observation.helped, true); assert.equal(observation.attempts, 2);
    await qa.click(nextStage, 'grammar-next-stage');
    await grammarSaved(progress => progress?.stage === 1);
    await qa.inspect('grammar-progress', { icons: [
      [backToList.locator('svg'), 18, 'P046 lesson list'],
      [button('3문제 연습').locator('svg'), 18, 'P047 enter practice'],
    ] });
    // Existing <=640px layout intentionally replaces the stepper with a text count.
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await lesson.locator('.grammar-stepper').isVisible(), false);
      assert.equal(await lesson.locator('.grammar-phase-count').isVisible(), true);
      assert.match(await lesson.locator('.grammar-stage-label').innerText(), /2\/5.*이해하기/);
    }
    await qa.inspect('grammar-completed-step', { widths: [768, 1440], icons: [
      [lesson.locator('.grammar-stepper [data-done=true] svg').first(), 14, 'P045 completed step'],
    ] });
    await qa.click(backToList, 'grammar-list');
    await nounTile.waitFor();
    await qa.inspect('grammar-catalog-continuing', { icons: [
      [nounTile.locator('.grammar-continuing > svg'), 16, 'P043 continue lesson'],
      [nounTile.locator('.grammar-review-tag > svg'), 16, 'P043 review needed'],
    ] });
    await nounTile.click(); await button('3문제 연습').click();
    await grammarSaved(progress => progress?.stage === 2);
    for (let index = 0; index < practice.questions.length; index++) {
      const question = practice.questions[index];
      if (question.kind === 'choice') {
        await lesson.locator('.grammar-choices').getByRole('button', { name: question.answer, exact: true }).click();
        await button('답 확인').click();
      } else {
        for (const word of (question.orderFormat ? question.answer.replace(/[.!?]+$/, '') : question.answer).split(' ')) {
          const token = question.orderFormat ? question.options.find(option => option.toLowerCase() === word.toLowerCase()) : word;
          assert.ok(token, 'The expected order token exists');
          await lesson.locator('.grammar-options button:not([disabled])').filter({ hasText: new RegExp('^' + token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
        }
        await button('내 답 확인').click();
      }
      await grammarSaved(progress => progress?.answers?.['q' + (index + 1)]?.latest === question.answer);
      await button('다음').click();
      await grammarSaved(progress => progress?.stage === index + 3);
    }
    const sentence = page.getByRole('textbox', { name: '내 문장', exact: true });
    const ai = button('AI 참고 의견 요청'), complete = button('수업 마치기');
    await sentence.waitFor();
    assert.equal(await ai.isDisabled(), true); assert.equal(await complete.isDisabled(), true);
    await qa.inspect('grammar-writing-empty', { icons: [[ai.locator('svg'), 18, 'P051 AI feedback'], [complete.locator('svg'), 18, 'Complete lesson']] });
    const originalSentence = 'I keep my sentence and previous learning records.';
    await sentence.fill(originalSentence);
    await grammarSaved(progress => progress?.sentence === originalSentence);
    assert.equal(await ai.isDisabled(), false);
    const checks = lesson.locator('.grammar-self-checks fieldset');
    assert.equal(await checks.locator('input[type=radio]').count(), 6, 'Self-checks remain native radios');
    await checks.nth(0).getByLabel('확인했어요', { exact: true }).check();
    assert.equal(await complete.isDisabled(), true, 'Both native self-check groups remain required');
    await checks.nth(1).getByLabel('확인했어요', { exact: true }).check();
    await grammarSaved(progress => progress?.checks?.meaning === 'appropriate' && progress?.checks?.form === 'appropriate');
    assert.equal(await checks.locator('input:checked').count(), 2);
    await qa.inspect('grammar-writing', { icons: [[ai.locator('svg'), 18, 'P051 AI feedback'], [complete.locator('svg'), 18, 'Complete lesson']] });
    const beforeCompletion = await qa.getState();
    holdState = true;
    await qa.click(complete, 'grammar-complete');
    await until(() => !!heldState, 'Held grammar completion save');
    const summary = lesson.locator('.grammar-summary-heading');
    const repeat = button('다른 3문제로 확인');
    await summary.getByText('완료 기록을 저장하고 있어요.', { exact: true }).waitFor();
    await qa.checkIcon(summary.locator('svg'), 26, 'P052 saving completion');
    const savingArt = await artwork(summary.locator('svg'));
    assert.equal(await repeat.isDisabled(), true);
    await qa.capture('grammar-summary-saving-320.png', false);
    const failedState = heldState; heldState = null;
    await failedState.fulfill({ status: 503, json: { error: '검사용 저장하지 못했어요. 현재 입력을 보존한 뒤 다시 시도해 주세요.' } });
    await summary.getByText('완료 기록을 저장해 주세요.', { exact: true }).waitFor();
    assert.deepEqual(await qa.getState(), beforeCompletion, 'Failed completion leaves the stored draft and historical records unchanged');
    assert.equal(await repeat.isDisabled(), true);
    assert.equal(await summary.getAttribute('data-pending'), 'true');
    const failedArt = await artwork(summary.locator('svg'));
    assert.notEqual(failedArt, savingArt);
    await qa.inspect('grammar-summary-error', { icons: [[summary.locator('svg'), 26, 'P052 unsaved completion'], [repeat.locator('svg'), 17, 'P053 repeat while disabled']] });
    const downloaded = page.waitForEvent('download');
    await button('현재 입력 백업').click();
    const backup = JSON.parse(fs.readFileSync(await (await downloaded).path(), 'utf8'));
    const pendingState = backup.state ?? backup;
    assert.equal(pendingState.grammar.noun.sentence, originalSentence);
    assert.equal(pendingState.grammar.noun.stage, 6);
    assert.deepEqual(pendingState.sessions, baseline.state.sessions, 'The emergency backup retains earlier learning records');
    const retryGrammar = lesson.locator('.grammar-message[role=alert]').getByRole('button', { name: '다시 저장', exact: true });
    await qa.click(retryGrammar, 'grammar-save-retry');
    await grammarSaved(progress => progress?.stage === 6 && !!progress.completedAt);
    await summary.getByText('수업을 마쳤어요.', { exact: true }).waitFor();
    assert.equal(await summary.getAttribute('data-pending'), 'false');
    const completedArt = await artwork(summary.locator('svg'));
    assert.notEqual(completedArt, savingArt); assert.notEqual(completedArt, failedArt);
    await qa.inspect('grammar-summary-saved', { icons: [[summary.locator('svg'), 26, 'P052 saved completion'], [repeat.locator('svg'), 17, 'P053 repeat lesson']] });
    assert.match(await summary.innerText(), /수업을 마쳐도 내용을 모두 익혔다는 뜻은 아니에요/);
    const completed = (await qa.getState()).state.grammar.noun;
    assert.equal(completed.sentence, originalSentence); assert.deepEqual(completed.observation, observation);
    for (let index = 0; index < 3; index++) assert.equal(completed.answers['q' + (index + 1)].first, practice.questions[index].answer);
    await backToList.click(); await nounTile.waitFor();
    await qa.inspect('grammar-catalog-completed', { icons: [
      [nounTile.locator('.grammar-complete > svg'), 16, 'P043 completed lesson'],
      [nounTile.locator('.grammar-review-tag > svg'), 16, 'P043 recommended review'],
      [nounTile.locator('.grammar-tile-heading > svg'), 18, 'P044 reopen completed lesson'],
    ] });
    await nounTile.click(); await repeat.waitFor();
    await qa.click(repeat, 'grammar-repeat');
    await grammarSaved(progress => !!progress?.review && !progress.review.completedAt);
    const after = await qa.getState(), reviewed = after.state.grammar.noun;
    assert.equal(reviewed.completedAt, completed.completedAt);
    assert.deepEqual(reviewed.answers, completed.answers);
    assert.deepEqual(reviewed.observation, completed.observation);
    assert.equal(reviewed.sentence, originalSentence);
    for (const key of ['settings', 'progress', 'sessions']) assert.deepEqual(after.state[key], baseline.state[key], 'Grammar flow preserves ' + key);
    assert.deepEqual(Object.keys(after.state.grammar), ['noun'], 'No other lesson record is created');
    assert.deepEqual(report.requests.filter(request => /\/api\/(?:sentence|grammar)-feedback(?:\/|$)/.test(request.path)), [], 'No AI generation is requested');
    assert.deepEqual(externalRequests, [], 'No unapproved external app or API request is made');
    report.checks.push('P043–P053: current lesson flow, selected/help/incorrect/correct meanings, native radios, disabled gates, completion save/failure/backup/retry, review preserves first answers and prior records');
    report.checks.push('Every inspected layout preserves server revision/state; 320–1440px and 100/200% text use real Chromium/WebKit evidence, not an actual-device claim');
  } catch (error) { failure = error; }
  finally {
    for (const route of [heldPosition, heldState]) if (route) await route.abort().catch(() => {});
  }
  await qa.finish(failure);
})().catch(error => { console.error(error); process.exitCode = 1; });
