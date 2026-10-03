export type DeviceSpeechState = { status: 'idle' | 'starting' | 'speaking' | 'error'; message: string };
type SpeechHost = {
  speechSynthesis?: SpeechSynthesis;
  SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (id: number) => void;
};
type Playback = { utterance: SpeechSynthesisUtterance; stop: () => void };
// Keep the utterance alive, and let only the current playback cancel the shared engine.
let current: Playback | undefined;
const failure = '기기 음성을 재생하지 못했어요. 기기 볼륨을 확인하고, 앱 안이라면 Safari 또는 Chrome에서 이 페이지를 열어 다시 눌러 주세요.';

// Call synchronously from a click: deferring speak() can lose mobile user activation.
export function speakOnDevice(text: string, report: (state: DeviceSpeechState) => void, host: SpeechHost = window): () => void {
  current?.stop();
  const engine = host.speechSynthesis, Utterance = host.SpeechSynthesisUtterance;
  const error = (message: string) => report({ status: 'error', message });
  if (!engine || !Utterance) {
    error('이 브라우저는 기기 음성을 지원하지 않아요. Safari 또는 Chrome에서 열거나 사전 발음을 이용해 주세요.');
    return () => {};
  }
  let playback: Playback | undefined;
  let timer: number | undefined;
  const finish = (state: DeviceSpeechState, cancel = false) => {
    if (!playback || current !== playback) return;
    current = undefined;
    if (timer !== undefined) host.clearTimeout(timer);
    playback.utterance.onstart = null;
    playback.utterance.onend = null;
    playback.utterance.onerror = null;
    if (cancel) { try { engine.cancel(); } catch {} }
    report(state);
  };
  try {
    const voices = engine.getVoices();
    const voice = voices.find(v => v.lang.replace(/_/g, '-').toLowerCase() === 'en-us');
    if (voices.length && !voice) {
      error('미국식 영어 음성을 찾지 못했어요. 기기에 영어(미국) 음성을 추가하거나 사전 발음을 이용해 주세요.');
      return () => {};
    }
    const utterance = new Utterance(text);
    utterance.lang = 'en-US';
    utterance.rate = .85;
    utterance.volume = 1;
    if (voice) utterance.voice = voice;
    playback = { utterance, stop: () => finish({ status: 'idle', message: '' }, true) };
    current = playback;
    utterance.onstart = () => {
      if (current !== playback) return;
      if (timer !== undefined) host.clearTimeout(timer);
      report({ status: 'speaking', message: '기기 음성 재생 중이에요.' });
    };
    utterance.onend = () => finish({ status: 'idle', message: '' });
    // Our own cancellation detaches this handler first. A live platform error
    // (including unexpected cancellation) must not silently swallow a click.
    utterance.onerror = () => finish({ status: 'error', message: failure });
    report({ status: 'starting', message: '기기 음성을 준비하고 있어요.' });
    timer = host.setTimeout(() => finish({ status: 'error', message: failure }, true), 4000);
    engine.cancel();
    if (engine.paused) engine.resume();
    engine.speak(utterance);
  } catch {
    if (playback) finish({ status: 'error', message: failure }, true);
    else error(failure);
  }
  return () => playback?.stop();
}
