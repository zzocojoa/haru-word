import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

test('rejects a legacy cleanup request without reading its body or reaching the learning database', async () => {
  const { outputFiles, metafile } = await build({
    entryPoints: ['app/api/state/familiarity-cleanup/route.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    metafile: true,
  });
  assert.deepEqual(Object.keys(metafile.inputs).sort(), [
    'app/api/state/familiarity-cleanup/route.ts',
    'lib/server/http.ts',
  ]);
  const { POST } = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].contents).toString('base64'));
  const request = new Request('https://study.example/api/state/familiarity-cleanup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: 3 }),
  });
  const response = await POST(request);
  assert.equal(response.status, 410);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { error: '테스트 진행 정리 기능이 종료됐어요.' });
  assert.equal(request.bodyUsed, false);
});
