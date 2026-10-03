import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Temporary mitigation for GHSA-vfj7-8cjw-p6xm, which has no patched release.
// Patch only the exact locked source; fail closed when upstream code changes.
export const BRACES_MAX_NESTING = 100;
export const BRACES_DEPTH_ERROR = 'Brace nesting exceeds the safe depth limit (100)';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const digest = source => createHash('sha256').update(source).digest('hex');
const rejection = `if (nesting > ${BRACES_MAX_NESTING + 1}) throw new SyntaxError('${BRACES_DEPTH_ERROR}');`;
const definitions = {
  parse: ['e572166565f15fa6ad9865ae49d678218e32aabfd1b3720f6d0d43d39800d310', source => source
    .replace('const advance = () => input[index++];', `const advance = () => input[index++];
  const pushBlock = node => {
    if (stack.length > ${BRACES_MAX_NESTING}) throw new SyntaxError('${BRACES_DEPTH_ERROR}');
    stack.push(node);
  };`)
    .replaceAll('stack.push(block);', 'pushBlock(block);')],
  compile: ['dc98f22eee3d511785d92a00758d5f0d48efed5f5813bdecc2de430c529b5c9f', source => source
    .replace('const walk = (node, parent = {}) => {', `const walk = (node, parent = {}, nesting = 0) => {\n    ${rejection}`)
    .replace('walk(child, node)', 'walk(child, node, nesting + 1)')],
  expand: ['41ccc196ebfa7b7781a634e721eb744e4e7bcb54cba427a7e3d6806a1b9e58f7', source => source
    .replace('const walk = (node, parent = {}) => {', `const walk = (node, parent = {}, nesting = 0) => {\n    ${rejection}`)
    .replace('walk(child, node)', 'walk(child, node, nesting + 1)')],
  stringify: ['379f22d77bfa1478341ccd49c5e4267464aabcbba03558bab332aac23fc6f23a', source => source
    .replace('const stringify = (node, parent = {}) => {', `const stringify = (node, parent = {}, nesting = 0) => {\n    ${rejection}`)
    .replace('stringify(child)', 'stringify(child, {}, nesting + 1)')],
};

export function guardBraces(projectRoot = root) {
  const lock = JSON.parse(readFileSync(resolve(projectRoot, 'package-lock.json'), 'utf8'));
  const packages = Object.entries(lock.packages).filter(([path]) => /(^|\/)node_modules\/braces$/.test(path));
  const changes = [];
  const checkout = realpathSync(projectRoot);
  const contained = path => {
    const actual = realpathSync(path), fromRoot = relative(checkout, actual);
    if (isAbsolute(fromRoot) || fromRoot === '..' || fromRoot.startsWith('..\\') || fromRoot.startsWith('../')) {
      throw Error('Refusing to patch a shared braces installation outside this checkout');
    }
    return actual;
  };
  for (const [path, entry] of packages) {
    if (entry.version !== '3.0.3') throw Error('Review the braces guard before changing its locked version');
    const directory = contained(resolve(projectRoot, path));
    for (const [name, [expected, transform]] of Object.entries(definitions)) {
      const target = contained(resolve(directory, 'lib', `${name}.js`));
      const info = statSync(target);
      if (!info.isFile() || info.nlink !== 1) throw Error('Refusing to patch a shared or non-regular braces source');
      const source = readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
      // Reverse only our exact edits to authenticate an already-patched file.
      const original = name === 'parse' ? source
        .replace(`\n  const pushBlock = node => {\n    if (stack.length > ${BRACES_MAX_NESTING}) throw new SyntaxError('${BRACES_DEPTH_ERROR}');\n    stack.push(node);\n  };`, '')
        .replaceAll('pushBlock(block);', 'stack.push(block);') : source
        .replace(', nesting = 0) => {', ') => {')
        .replace(`\n    ${rejection}`, '')
        .replace('walk(child, node, nesting + 1)', 'walk(child, node)')
        .replace('stringify(child, {}, nesting + 1)', 'stringify(child)');
      if (digest(original) !== expected) throw Error(`Unexpected braces source: ${name}`);
      const patched = transform(original);
      if (source !== original && source !== patched) throw Error(`Incomplete braces guard: ${name}`);
      if (source !== patched) changes.push([target, patched]);
    }
  }
  // Validate every source before writing any file; partial writes can be safely rerun.
  for (const [target, source] of changes) writeFileSync(target, source);
  return { packages: packages.length, filesPatched: changes.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify({ bracesGuard: guardBraces() }));
}
