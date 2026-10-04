import test from 'node:test';
import assert from 'node:assert/strict';
import { speakOnDevice } from '../lib/device-speech.ts';

function device({ paused = false, voices = [{ lang: 'en-US' }], throws } = {}) {
  const calls = [], states = [], timers = new Map();
  let sequence = 0;
  const engine = {
    paused,
    getVoices() { if (throws === 'voices') throw Error('test'); return voices; },
    cancel() { calls.push('cancel'); if (throws === 'cancel') throw Error('test'); },
    resume() { calls.push('resume'); engine.paused = false; if (throws === 'resume') throw Error('test'); },
    speak(utterance) { calls.push('speak'); engine.utterance = utterance; if (throws === 'speak') throw Error('test'); },
  };
  const host = {
    speechSynthesis: engine,
    SpeechSynthesisUtterance: class { constructor(text) { if (throws === 'constructor') throw Error('test'); this.text = text; } },
    setTimeout(callback, delay) { assert.equal(delay, 4000); timers.set(++sequence, callback); return sequence; },
    clearTimeout(id) { timers.delete(id); },
  };
  return { host, engine, calls, states, timers, report: state => states.push(state), timeout() { for (const callback of [...timers.values()]) callback(); } };
}

test('paused engine is resumed and speech remains in the click call stack', () => {
  const d = device({ paused: true });
  const stop = speakOnDevice('apple', d.report, d.host);
  assert.deepEqual(d.calls, ['cancel', 'resume', 'speak']);
  assert.equal(d.engine.utterance.lang, 'en-US');
  assert.equal(d.engine.utterance.rate, .85);
  assert.equal(d.engine.utterance.volume, 1);
  assert.equal(d.states.at(-1).status, 'starting');
  stop();
});

test('American language tags accept hyphens, underscores and case', () => {
  for (const lang of ['en-US', 'en_US', 'EN-us']) {
    const d = device({ voices: [{ lang: 'en-GB' }, { lang }] });
    const stop = speakOnDevice('apple', d.report, d.host);
    assert.equal(d.engine.utterance.voice, d.host.speechSynthesis.getVoices()[1]);
    stop();
  }
});

test('unloaded voices use en-US immediately, with no automatic second request', () => {
  const d = device({ voices: [] });
  speakOnDevice('apple', d.report, d.host);
  assert.equal(d.engine.utterance.voice, undefined);
  assert.equal(d.engine.utterance.lang, 'en-US');
  assert.deepEqual(d.calls, ['cancel', 'speak']);
  d.timeout();
  assert.equal(d.states.at(-1).status, 'error');
  assert.deepEqual(d.calls, ['cancel', 'speak', 'cancel']);
});

test('silent engine without start/error events times out and can be retried', () => {
  const d = device();
  speakOnDevice('apple', d.report, d.host);
  const stale = d.engine.utterance.onstart;
  d.timeout();
  assert.equal(d.states.at(-1).status, 'error');
  assert.match(d.states.at(-1).message, /Safari.*Chrome/);
  assert.equal(d.timers.size, 0);
  const stop = speakOnDevice('apple', d.report, d.host);
  stale();
  assert.equal(d.states.at(-1).status, 'starting');
  d.engine.utterance.onstart();
  assert.equal(d.states.at(-1).status, 'speaking');
  assert.equal(d.timers.size, 0);
  d.engine.utterance.onend();
  assert.deepEqual(d.states.at(-1), { status: 'idle', message: '' });
  stop();
});

test('one button cannot cancel a later button through stale callbacks or cleanup', () => {
  const d = device(), first = [], second = [];
  const stopFirst = speakOnDevice('apple', state => first.push(state), d.host);
  const staleError = d.engine.utterance.onerror;
  const stopSecond = speakOnDevice('orange', state => second.push(state), d.host);
  assert.equal(first.at(-1).status, 'idle');
  const before = [...d.calls];
  stopFirst();
  staleError({ error: 'audio-busy' });
  assert.deepEqual(d.calls, before);
  assert.equal(second.at(-1).status, 'starting');
  stopSecond();
  assert.equal(d.timers.size, 0);
});

test('component cleanup cancels its playback, detaches callbacks and timer', () => {
  const d = device();
  const stop = speakOnDevice('apple', d.report, d.host);
  stop();
  assert.equal(d.engine.utterance.onstart, null);
  assert.equal(d.engine.utterance.onend, null);
  assert.equal(d.engine.utterance.onerror, null);
  assert.equal(d.timers.size, 0);
  assert.equal(d.states.at(-1).status, 'idle');
});

for (const code of ['not-allowed', 'audio-busy', 'language-unavailable', 'synthesis-failed', 'canceled', 'interrupted']) {
  test(`speech error ${code} releases playback and reports the recovery path`, () => {
    const d = device();
    speakOnDevice('apple', d.report, d.host);
    d.engine.utterance.onerror({ error: code });
    assert.equal(d.states.at(-1).status, 'error');
    assert.equal(d.timers.size, 0);
  });
}
test('missing API or utterance constructor is explained without throwing', () => {
  for (const missing of ['speechSynthesis', 'SpeechSynthesisUtterance']) {
    const d = device();
    delete d.host[missing];
    speakOnDevice('apple', d.report, d.host)();
    assert.equal(d.states.at(-1).status, 'error');
    assert.match(d.states.at(-1).message, /지원하지/);
    assert.deepEqual(d.calls, []);
  }
});
test('other language voices never substitute an unreviewed pronunciation', () => {
  const d = device({ voices: [{ lang: 'ko-KR' }, { lang: 'en-GB' }] });
  speakOnDevice('apple', d.report, d.host)();
  assert.match(d.states.at(-1).message, /미국/);
  assert.deepEqual(d.calls, []);
});
for (const throws of ['voices', 'constructor', 'cancel', 'resume', 'speak']) {
  test(`platform ${throws} exception becomes a visible failure`, () => {
    const d = device({ throws, paused: true });
    speakOnDevice('apple', d.report, d.host)();
    assert.equal(d.states.at(-1).status, 'error');
    assert.equal(d.timers.size, 0);
  });
}
