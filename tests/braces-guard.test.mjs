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
function copySources(root, packagePath = 'node_modules/braces') {
  const target = resolve(root, packagePath);
  mkdirSync(resolve(target, 'lib'), { recursive: true });
  for (const name of names) copyFileSync(resolve(bracesRoot, 'lib', `${name}.js`), resolve(target, 'lib', `${name}.js`));
  return target;
}
function restorePublishedSources(directory) {
  const hashes = ['e572166565f15fa6ad9865ae49d678218e32aabfd1b3720f6d0d43d39800d310',
    'dc98f22eee3d511785d92a00758d5f0d48efed5f5813bdecc2de430c529b5c9f',
    '41ccc196ebfa7b7781a634e721eb744e4e7bcb54cba427a7e3d6806a1b9e58f7',
    '379f22d77bfa1478341ccd49c5e4267464aabcbba03558bab332aac23fc6f23a'];
  for (const [index, name] of names.entries()) {
    const file = resolve(directory, 'lib', `${name}.js`);
    const original = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
      .replace(/^  const pushBlock = node => \{\n(?:.*\n){2}  \};\n/m, '')
      .replaceAll('pushBlock(block);', 'stack.push(block);')
      .replace(', nesting = 0) => {', ') => {')
      .replace(/^    if \(nesting > 101\) throw new SyntaxError\([^\n]+\);\n/m, '')
      .replace('walk(child, node, nesting + 1)', 'walk(child, node)')
      .replace('stringify(child, {}, nesting + 1)', 'stringify(child)');
    assert.equal(createHash('sha256').update(original).digest('hex'), hashes[index]);
    writeFileSync(file, original);
  }
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

test('all direct and nested locked copies are validated before any source is patched', () => {
  const root = sandbox(), packagePaths = ['node_modules/braces', 'node_modules/tool/node_modules/braces'];
  const targets = packagePaths.map(packagePath => copySources(root, packagePath));
  targets.forEach(restorePublishedSources);
  const writeLock = version => writeFileSync(resolve(root, 'package-lock.json'), JSON.stringify({ packages: {
    [packagePaths[0]]: { version: '3.0.3' }, [packagePaths[1]]: { version },
  } }));
  writeLock('3.0.4');
  const beforeVersionFailure = targets.map(snapshot);
  assert.throws(() => guardBraces(root), /Review the braces guard/);
  assert.deepEqual(targets.map(snapshot), beforeVersionFailure);
  writeLock('3.0.3');
  const finalSource = resolve(targets[1], 'lib/stringify.js');
  writeFileSync(finalSource, readFileSync(finalSource, 'utf8') + '\n// unverified nested source\n');
  const beforeSourceFailure = targets.map(snapshot);
  assert.throws(() => guardBraces(root), /Unexpected braces source: stringify/);
  assert.deepEqual(targets.map(snapshot), beforeSourceFailure);
  copyFileSync(resolve(bracesRoot, 'lib/stringify.js'), finalSource);
  restorePublishedSources(targets[1]);
  assert.deepEqual(guardBraces(root), { packages: 2, filesPatched: 8 });
  for (const target of targets) assert.deepEqual(snapshot(target), snapshot(bracesRoot));
  const patched = targets.map(snapshot);
  assert.deepEqual(guardBraces(root), { packages: 2, filesPatched: 0 });
  assert.deepEqual(targets.map(snapshot), patched);
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

test('explicit dev and build patch authentic sources before CLI handoff with lifecycle scripts disabled', () => {
  for (const command of ['dev', 'build']) {
    const root = sandbox(), target = copySources(root);
    restorePublishedSources(target);
    mkdirSync(resolve(root, 'scripts'), { recursive: true });
    for (const name of ['run-framework.mjs', 'guard-braces.mjs']) copyFileSync(resolve('scripts', name), resolve(root, 'scripts', name));
    writeFileSync(resolve(root, 'scripts/execution-profile.mjs'), 'export const readExecutionProfile = () => "portable";');
    mkdirSync(resolve(root, 'node_modules/vinext/dist'), { recursive: true });
    const expected = names.map(name => createHash('sha256').update(readFileSync(resolve(bracesRoot, 'lib', `${name}.js`), 'utf8').replace(/\r\n/g, '\n')).digest('hex'));
    writeFileSync(resolve(root, 'node_modules/vinext/dist/cli.js'), `
      import assert from 'node:assert/strict';
      import { createHash } from 'node:crypto';
      import { readFileSync } from 'node:fs';
      assert.equal(process.env.npm_config_ignore_scripts, 'true');
      const hashes = ${JSON.stringify(names)}.map(name => createHash('sha256').update(readFileSync(new URL('../../braces/lib/' + name + '.js', import.meta.url), 'utf8').replace(/\\r\\n/g, '\\n')).digest('hex'));
      assert.deepEqual(hashes, ${JSON.stringify(expected)});
      console.log(JSON.stringify({ command: process.argv.slice(2), guarded: true }));
    `);
    const env = { ...process.env, npm_config_ignore_scripts: 'true' };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, [resolve(root, 'scripts/run-framework.mjs'), command, '--fixture'], { encoding: 'utf8', timeout: 10000, env });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { command: [command, ...(command === 'dev' ? ['--port', '5173'] : []), '--fixture'], guarded: true });
    assert.deepEqual(snapshot(target), snapshot(bracesRoot));
  }
});
