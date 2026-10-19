import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { FEEDBACK_ISSUES } from '../lib/feedback-issue.ts';
import { exportLog } from '../lib/learning/exports.ts';
import { EMPTY } from '../lib/learning/model.ts';
import { WORD_MAP } from '../lib/catalog-basics.ts';

await build({ entryPoints: ['app/ai-use-notice.tsx', 'app/learning/image-practice.tsx', 'app/feedback-issue-notice.tsx', 'app/feedback-attribution.tsx', 'app/feedback-detail.tsx', 'app/record-text.tsx', 'app/study/recall-stage.tsx'], outdir: 'work/ux-text-unit', bundle: true, format: 'esm', platform: 'node', external: ['react', 'react-dom', 'react/jsx-runtime', 'lucide-react'], outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const { AiUseNotice } = await import('../work/ux-text-unit/ai-use-notice.mjs');
const { ImagePracticeContent } = await import('../work/ux-text-unit/learning/image-practice.mjs');
const { FeedbackIssueNotice } = await import('../work/ux-text-unit/feedback-issue-notice.mjs');
const { FeedbackAttribution } = await import('../work/ux-text-unit/feedback-attribution.mjs');
const { FeedbackDetail } = await import('../work/ux-text-unit/feedback-detail.mjs');
const { RecordText } = await import('../work/ux-text-unit/record-text.mjs');
const { RecallStage } = await import('../work/ux-text-unit/study/recall-stage.mjs');
const html = (component, props) => render(createElement(component, props));

test('both AI notices name the transmitted fields and preserve visible privacy and fallback disclosures', () => {
  for (const grammar of [false, true]) {
    const result = html(AiUseNotice, { grammar });
    assert.ok(result.includes(grammar ? '문장과 수업 목표를 Google에 보내요.' : '문장과 단어·뜻을 Google에 보내요.'));
    for (const text of ['응답 실패 시 Groq에도 보내요.', '개인정보는 넣지 마세요.', 'Google 무료 API의 입력·응답은 서비스 개선에 쓰일 수 있어요.']) assert.ok(result.includes(text));
    assert.doesNotMatch(result, /<details|수업 목표을/);
  }
});

test('position errors distinguish an unread cursor from an unconfirmed save without claiming a failed write', () => {
  for (const available of [false, true]) {
    const position = { available, status: 'error', entryId: null, displayVersion: 0 };
    const controller = { subscribe: () => () => {}, getSnapshot: () => position, open() {}, retry() {} };
    const result = html(ImagePracticeContent, { words: [...WORD_MAP.values()], progress: {}, controller });
    assert.ok(result.includes(available
      ? '연습 위치 저장 결과를 확인하지 못했어요. 다시 저장하면 서버 위치부터 확인해요.'
      : '연습 위치를 불러오지 못했어요. 다시 불러와 주세요.'));
    assert.doesNotMatch(result, /연습 위치를 저장하지 못했어요|위치 저장됨/);
    assert.match(result, available ? />다시 저장<\/button>/ : />다시 불러오기<\/button>/);
  }
});

test('all AI failures preserve distinct safe diagnostics while operator tasks stay out of the primary guidance', () => {
  for (const code of Object.keys(FEEDBACK_ISSUES)) {
    const result = html(FeedbackIssueNotice, { issue: { code, providerStatus: 503, retryAfterSeconds: 17 } });
    assert.ok(result.includes(code));
    assert.match(result, /오류 상세/);
    const primary = result.split('<details>')[0];
    assert.doesNotMatch(primary, /API 키|google_api|groq_api|AI Studio|Console|무료 계정|새 키로/);
    assert.match(primary, /17초/);
    if (/(timeout|network)$/.test(code)) {
      assert.match(primary, /결과를 확인하지 못했어요/);
      assert.match(primary, /자동으로 재요청하지 않아요/);
      assert.match(primary, /이전 요청이 사용량에 포함될 수 있어요/);
    }
    assert.ok(result.includes(FEEDBACK_ISSUES[code][1]), code + ' retains original bounded reason');
  }
  for (const code of ['login_required', 'save_required', 'stale_input', 'provider_blocked', 'grammar_client_outdated', 'analysis_conflict']) {
    assert.ok(html(FeedbackIssueNotice, { issue: { code } }).split('<details>')[0].includes(FEEDBACK_ISSUES[code][2]));
  }
});

test('AI reference caution appears once with detail and survives attribution-only history', () => {
  const feedback = { original: 'I like music.', correctedSentence: 'I like music.', meaningUsage: 'appropriate', grammar: 'natural', explanation: '검사용 의견', model: 'gemini-3.1-flash-lite', createdAt: '2026-10-19T00:00:00Z' };
  assert.equal((html(FeedbackDetail, { feedback }).match(/AI 참고 의견/g) || []).length, 1);
  assert.match(html(FeedbackDetail, { feedback }), /정답 판정은 아니에요/);
  assert.match(html(FeedbackAttribution, { feedback }), /AI 참고 의견 · 최종 기록은 직접 확인해 주세요/);
});

test('recall conceals the opposite answer and preserves independent/helped/unmeasured choices', () => {
  for (const stage of ['en', 'ko']) {
    const props = { s: { stage, records: { word: { meaning: '고유한 참고 뜻' } } }, id: 'word', word: { word: 'concealedword', pos: 'n.' }, content: { meaning: '고유한 참고 뜻' }, answer: '', busy: false, hint: false, revealed: false, setAnswer() {}, recall() {}, revealAnswer() {} };
    const before = html(RecallStage, props);
    assert.ok(!before.includes(stage === 'en' ? '고유한 참고 뜻' : 'concealedword'));
    assert.match(before, /label.*recall-answer/);
    assert.match(before, /이번에는 건너뛰기/);
    const after = html(RecallStage, { ...props, revealed: true, hint: true });
    assert.ok(after.includes('concealedword') && after.includes('고유한 참고 뜻'));
    assert.match(after, /disabled=""[^>]*>도움 없이 맞혔어요/);
    assert.match(after, /도움 필요.*기록해요/);
  }
});

test('long records keep every original character in a closed disclosure without interpreting markup', () => {
  const text = 'original <script>not code</script>\n'.repeat(20);
  const result = html(RecordText, { text, label: '내 문장', lang: 'en' });
  assert.match(result, /<details[^>]*><summary>내 문장 더 보기/);
  assert.doesNotMatch(result, /<details[^>]*\bopen\b|<script>/);
  assert.equal((result.match(/original/g) || []).length, 20);
  assert.match(result, /lang="en"/);
  assert.doesNotMatch(html(RecordText, { text: '짧은 원문', label: '보완점' }), /<details/);
});

test('UI labels do not change CSV headers, historical result labels, learner text or source records', () => {
  const state = structuredClone(EMPTY), id = 'synthetic', record = { meaning: '검사용 뜻', en: 'independent', ko: 'help', sentenceStatus: 'unmeasured', sentence: 'Original, "sentence"', notes: '원래 메모', familiarity: 'new' };
  state.sessions[id] = { id, kind: 'daily', date: '2026-10-19', period: '2026-10-19', ids: ['word'], records: { word: record }, warmupIds: [], stage: 'sentence', index: 0, retry: [], retryMode: false, elapsed: 0, finished: false, paused: true, createdAt: '2026-10-19T00:00:00Z' };
  const before = structuredClone(state), csv = exportLog(state, [{ id: 'word', word: 'word', pos: 'n.', level: 'A1' }]);
  const header = ['학습일','종류','단어','품사','수준','학습 뜻','처음 표시','영어→뜻','뜻→영어','문장 상태','말하기','내 문장','보완점','재시도 영어→뜻','재시도 뜻→영어','다음 할 일','AI 검토 원문','AI 교정 제안','AI 설명','회차 시작일','실제 학습일','마지막 연습일','AI 제공사','AI 모델'];
  assert.equal(csv.split('\r\n')[0], '\ufeff' + header.map(h => '"' + h + '"').join(','));
  assert.match(csv, /"독립 성공","도움 필요","미측정"/);
  assert.ok(csv.includes('"Original, ""sentence"""'));
  assert.ok(csv.includes('"원래 메모"'));
  assert.doesNotMatch(csv, /아직 확인 안 함|도움 없이 성공/);
  assert.deepEqual(state, before);
});
