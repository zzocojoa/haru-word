import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { copyFileSync, linkSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { guardBraces, BRACES_DEPTH_ERROR, BRACES_MAX_NESTING } from '../scripts/guard-braces.mjs';

const require = createRequire(import.meta.url);
const braces = require('braces');
const bracesRoot = dirname(require.resolve('braces/package.json'));
const names = ['parse', 'compile', 'expand', 'stringify'];
const nested = depth => '{'.repeat(depth) + 'x' + '}'.repeat(depth);
const isBoundedError = error => error instanceof SyntaxError && error.message === BRACES_DEPTH_ERROR;
const snapshot = directory => names.map(name => readFileSync(resolve(directory, 'lib', `${name}.js`), 'utf8'));
function sandbox() {
  mkdirSync('work/braces-guard-tests', { recursive: true });
  const root = mkdtempSync(resolve('work/braces-guard-tests/case-'));
  writeFileSync(resolve(root, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/braces': { version: '3.0.3' } } }));
  mkdirSync(resolve(root, 'node_modules'), { recursive: true });
  return root;
}
function copySources(root) {
  const target = resolve(root, 'node_modules/braces');
  mkdirSync(resolve(target, 'lib'), { recursive: true });
  for (const name of names) copyFileSync(resolve(bracesRoot, 'lib', `${name}.js`), resolve(target, 'lib', `${name}.js`));
  return target;
}

test('braces keeps ordinary glob expansion, range options and escaped literals', () => {
  assert.deepEqual(braces('src/{app,lib}/**/*.{ts,tsx}'), ['src/(app|lib)/**/*.(ts|tsx)']);
  assert.deepEqual(braces.expand('src/{app,lib}/**/*.{ts,tsx}'), ['src/app/**/*.ts', 'src/app/**/*.tsx', 'src/lib/**/*.ts', 'src/lib/**/*.tsx']);
  assert.deepEqual(braces.expand('v{01..03}'), ['v01', 'v02', 'v03']);
  assert.deepEqual(braces(['a{1,2}', 'a{1,2}'], { expand: true, nodupes: true }), ['a1', 'a2']);
  assert.doesNotThrow(() => braces('\\{'.repeat(300) + 'x'));
  assert.doesNotThrow(() => braces('[' + '{'.repeat(300) + ']'));
  assert.throws(() => braces.parse('a{b,c}', { maxLength: 3 }), SyntaxError);
});

test('braces rejects deep patterns before recursive walkers can overflow', () => {
  for (const operation of [braces.parse, braces.compile, braces.expand, braces.stringify]) {
    assert.doesNotThrow(() => operation(nested(BRACES_MAX_NESTING)));
    for (const depth of [BRACES_MAX_NESTING + 1, 4000]) assert.throws(() => operation(nested(depth)), isBoundedError);
  }
  assert.throws(() => braces.parse('('.repeat(101) + 'x' + ')'.repeat(101)), isBoundedError);
});

test('direct AST inputs and cycles cannot bypass the walker bounds', () => {
  let ast = { type: 'text', value: 'x' };
  for (let index = 0; index < 4000; index++) ast = { type: 'root', nodes: [ast] };
  const cycle = { type: 'root', nodes: [] }; cycle.nodes.push(cycle);
  for (const operation of [braces.compile, braces.expand, braces.stringify]) {
    assert.throws(() => operation(ast), isBoundedError);
    assert.throws(() => operation(cycle), isBoundedError);
  }
});

test('the install guard is idempotent for the exact locked sources', () => {
  const before = snapshot(bracesRoot), result = guardBraces();
  assert.ok(result.packages >= 1); assert.equal(result.filesPatched, 0);
  assert.deepEqual(snapshot(bracesRoot), before);
});

test('unexpected source or package versions stop installation without changing files', () => {
  const root = sandbox(), target = copySources(root);
  // Recover the published parser and authenticate it independently. It must be
  // pending a patch when the last file fails, so eager writes would be caught.
  const parsePath = resolve(target, 'lib/parse.js');
  const originalParse = readFileSync(parsePath, 'utf8').replace(/\r\n/g, '\n')
    .replace(/^  const pushBlock = node => \{\n(?:.*\n){2}  \};\n/m, '')
    .replaceAll('pushBlock(block);', 'stack.push(block);');
  assert.equal(createHash('sha256').update(originalParse).digest('hex'), 'e572166565f15fa6ad9865ae49d678218e32aabfd1b3720f6d0d43d39800d310');
  writeFileSync(parsePath, originalParse);
  const modified = resolve(target, 'lib/stringify.js');
  writeFileSync(modified, readFileSync(modified, 'utf8') + '\n// Unreviewed source change\n');
  const before = snapshot(target);
  assert.throws(() => guardBraces(root), /Unexpected braces source: stringify/);
  assert.deepEqual(snapshot(target), before);
  writeFileSync(resolve(root, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/braces': { version: '3.0.4' } } }));
  assert.throws(() => guardBraces(root), /Review the braces guard/);
  assert.deepEqual(snapshot(target), before);
  writeFileSync(resolve(root, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/braces': { version: '3.0.3' } } }));
  copyFileSync(resolve(bracesRoot, 'lib/stringify.js'), modified);
  assert.deepEqual(guardBraces(root), { packages: 1, filesPatched: 1 });
  assert.deepEqual(snapshot(target), snapshot(bracesRoot));
  // Authentic source with only part of the reviewed guard must fail closed.
  writeFileSync(parsePath, readFileSync(parsePath, 'utf8').replaceAll('pushBlock(block);', 'stack.push(block);'));
  const partial = snapshot(target);
  assert.throws(() => guardBraces(root), /Incomplete braces guard: parse/);
  assert.deepEqual(snapshot(target), partial);
});

test('the install guard refuses to mutate a shared installation outside the checkout', () => {
  const root = sandbox(), before = snapshot(bracesRoot);
  symlinkSync(bracesRoot, resolve(root, 'node_modules/braces'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => guardBraces(root), /outside this checkout/);
  assert.deepEqual(snapshot(bracesRoot), before);
});

test('nested library links and source hardlinks cannot bypass checkout isolation', () => {
  const root = sandbox(), target = resolve(root, 'node_modules/braces'), before = snapshot(bracesRoot);
  mkdirSync(target, { recursive: true });
  symlinkSync(resolve(bracesRoot, 'lib'), resolve(target, 'lib'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => guardBraces(root), /outside this checkout/);
  assert.deepEqual(snapshot(bracesRoot), before);
  const linkedRoot = sandbox(), linkedTarget = copySources(linkedRoot);
  const external = resolve(root, 'shared-parse.js'), linked = resolve(linkedTarget, 'lib/parse.js');
  copyFileSync(linked, external);
  unlinkSync(linked); linkSync(external, linked);
  assert.throws(() => guardBraces(linkedRoot), /shared or non-regular/);
  assert.deepEqual(snapshot(linkedTarget), snapshot(bracesRoot));
});

test('explicit dev and build reject unverified dependencies even with lifecycle scripts disabled', () => {
  const root = sandbox(), target = copySources(root);
  writeFileSync(resolve(target, 'lib/stringify.js'), readFileSync(resolve(target, 'lib/stringify.js'), 'utf8') + '\n// unverified\n');
  mkdirSync(resolve(root, 'scripts'), { recursive: true });
  for (const name of ['run-framework.mjs', 'guard-braces.mjs']) copyFileSync(resolve('scripts', name), resolve(root, 'scripts', name));
  writeFileSync(resolve(root, 'scripts/execution-profile.mjs'), 'export const readExecutionProfile = () => "portable";');
  mkdirSync(resolve(root, 'node_modules/vinext/dist'), { recursive: true });
  writeFileSync(resolve(root, 'node_modules/vinext/dist/cli.js'), 'console.log("Framework CLI reached");');
  const env = { ...process.env, npm_config_ignore_scripts: 'true' };
  delete env.NODE_TEST_CONTEXT;
  for (const command of ['dev', 'build']) {
    const result = spawnSync(process.execPath, [resolve(root, 'scripts/run-framework.mjs'), command], { encoding: 'utf8', timeout: 10000, env });
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unexpected braces source: stringify/);
    assert.doesNotMatch(result.stdout, /Framework CLI reached/);
  }
});
