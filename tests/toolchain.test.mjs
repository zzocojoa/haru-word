import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { transform, transformSync } from '@esbuild-kit/core-utils';

// The legacy Drizzle loader uses these APIs. Exercise its behavior when the
// vulnerable transitive compiler is replaced; do not merely assert a version.
const source = `
 type Item = { value?: number };
 enum Level { A1 = 'A1', B2 = 'B2' }
 const items: ReadonlyArray<Item> = [{ value: 3 }, {}];
 export const result = { level: Level.B2, total: items.reduce((n, item) => n + (item.value ?? 0), 0) };
`;

test('patched toolchain preserves TypeScript configuration values through the legacy CJS loader',()=>{
 const compiled=transformSync(source,path.resolve('work/toolchain-config.cts'));
 const module={exports:{}};
 vm.runInNewContext(compiled.code,{module,exports:module.exports,require:()=>{throw new Error('Unexpected import')}});
 assert.deepEqual(JSON.parse(JSON.stringify(module.exports.result)),{level:'B2',total:3});
 assert.ok(compiled.map);
});

test('patched toolchain preserves async TypeScript module loading and source maps',async()=>{
 const compiled=await transform(source+'\nexport const awaited = await Promise.resolve(result.total);',path.resolve('work/toolchain-config.mts'));
 const loaded=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
 assert.deepEqual(loaded.result,{level:'B2',total:3});assert.equal(loaded.awaited,3);
 assert.ok(compiled.map);
});
