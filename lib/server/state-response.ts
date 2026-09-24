import type { StoredStateDocuments } from '@/db/learning-state';

// D1 returns all three collections in one atomic batch. Keep that snapshot,
// but avoid parsing every document and building a second giant JSON string.
// This consumes the private query result; no caller may reuse it afterwards.
export function stateResponse(snapshot: StoredStateDocuments, complete: (bytes: number) => void, failed: () => void) {
  const encoder = new TextEncoder(); let bytes = 0;
  function* fragments() {
    yield `{"revision":${snapshot.revision},"state":{"settings":${snapshot.settings},"progress":{`;
    for (let i = 0; i < snapshot.progress.length; i++) {
      const row = snapshot.progress[i];
      yield `${i ? ',' : ''}${JSON.stringify(row.entry_id)}:${row.document}`;
    }
    snapshot.progress.length = 0;
    yield '},"sessions":{';
    for (let i = 0; i < snapshot.sessions.length; i++) {
      const row = snapshot.sessions[i];
      yield `${i ? ',' : ''}${JSON.stringify(row.session_id)}:${row.document}`;
    }
    yield '}';
    if (snapshot.grammar) {
      yield ',"grammar":{';
      for (let i = 0; i < snapshot.grammar.length; i++) {
        const row = snapshot.grammar[i];
        yield `${i ? ',' : ''}${JSON.stringify(row.lesson_id)}:${row.document}`;
      }
      yield '}';
    }
    yield '}}';
  }
  const iterator = fragments();
  const release = () => { iterator.return(); snapshot.progress.length = 0; snapshot.sessions.length = 0; if (snapshot.grammar) snapshot.grammar.length = 0; };
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      try {
        const parts: string[] = []; let length = 0, done = false;
        while (length < 32768) {
          const next = iterator.next();
          if (next.done) { done = true; break; }
          parts.push(next.value); length += next.value.length;
        }
        if (parts.length) {
          const encoded = encoder.encode(parts.join('')); bytes += encoded.byteLength; controller.enqueue(encoded);
        }
        if (done) { release(); controller.close(); complete(bytes); }
      } catch { release(); controller.error(new Error('State response interrupted')); failed(); }
    },
    cancel() { release(); failed(); },
  });
  return new Response(body, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' } });
}
