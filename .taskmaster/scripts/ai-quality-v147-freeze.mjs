// Evaluation tooling. Hash-only manifests; no environment/credential discovery.
import {lstatSync, realpathSync, readdirSync, openSync, readFileSync, fstatSync, closeSync, writeFileSync, fsyncSync} from 'node:fs';
import {resolve, relative, sep, isAbsolute, dirname, basename} from 'node:path';
import {createHash} from 'node:crypto';
import {PLAN, MODELS, digest, validateSpec} from './ai-quality-v147-budget.mjs';
import {dispatchSyntheticOnce} from './ai-quality-v147-dispatch.mjs';

export const FREEZE_PROTOCOL = 'ai-quality-v147-freeze-v1';
export const COMPONENTS = ['sourceBaseline', 'sourceCandidate', 'buildBaseline', 'buildCandidate', 'runtime', 'rubric', 'corpus', 'requestBuilder', 'modelOptions', 'quote', 'limits', 'collectionPolicy', 'riskDecision'];
const FLAGS = ['grammar_enabled', 'grammar_practice_v2_enabled', 'grammar_practice_v3_enabled', 'grammar_practice_v4_enabled', 'large_backup_restore_enabled', 'ai_feedback_enabled', 'feedback_judgment_enabled'];
const check = (ok, code) => { if (!ok) throw new Error(code); };
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const fields = (x, names) => object(x) && Object.keys(x).sort().join('|') === [...names].sort().join('|');
const hash = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const integer = x => Number.isSafeInteger(x) && x > 0;
const uuid = x => typeof x === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function pathName(path) {
  check(typeof path === 'string' && path.length > 0 && !isAbsolute(path) && !/[\\:\x00-\x1f]/.test(path), 'FREEZE_RELATIVE_PATH');
  const parts = path.split('/');
  check(parts.every(p => p && !['.', '..'].includes(p) && !/[. ]$/.test(p) && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)), 'FREEZE_PATH_ALIAS');
  check(!parts.some(p => /^(?:\.env(?:[._-].*)?|\.sites-runtime|\.wrangler|\.git|node_modules|work|outputs)$/i.test(p)), 'FREEZE_PROTECTED_PATH');
  return parts;
}
function checkedPath(root, path) {
  let current = root;
  for (const p of pathName(path)) { current = resolve(current, p); check(!lstatSync(current).isSymbolicLink(), 'FREEZE_LINK'); }
  check(relative(root, current) && !relative(root, current).startsWith('..' + sep) && !isAbsolute(relative(root, current)) && realpathSync(current) === current, 'FREEZE_PATH_SCOPE');
  return current;
}

// Caller explicitly declares closed input trees and individual files. Tree
// additions/removals change the inventory; it is not merely a list of old hashes.
export function captureFreezeFiles({root, trees = [], files = []}) {
  check(typeof root === 'string' && !root.split(/[\\/]/).some(p => /^(?:\.env(?:[._-].*)?|\.sites-runtime|\.wrangler|\.git)$/i.test(p)), 'FREEZE_PROTECTED_ROOT');
  check(typeof root === 'string' && isAbsolute(root) && realpathSync(root) === resolve(root) && !lstatSync(root).isSymbolicLink(), 'FREEZE_ROOT');
  check(Array.isArray(trees) && Array.isArray(files) && trees.length + files.length > 0, 'FREEZE_INPUT_SET');
  const paths = new Set(), names = new Set(), seenPaths = new Set();
  function add(path) {
    const absolute = checkedPath(root, path), stat = lstatSync(absolute);
    check(stat.isFile() && stat.nlink === 1, 'FREEZE_REGULAR_FILE');
    const folded = path.toLowerCase(); check(!names.has(folded), 'FREEZE_DUPLICATE_FILE'); names.add(folded); paths.add(path);
  }
  function walk(path) {
    const absolute = checkedPath(root, path); check(lstatSync(absolute).isDirectory(), 'FREEZE_TREE');
    for (const e of readdirSync(absolute, {withFileTypes: true})) { const p = path + '/' + e.name; if (e.isDirectory()) walk(p); else add(p); }
  }
  for (const path of [...trees, ...files]) { pathName(path); check(!seenPaths.has(path.toLowerCase()), 'FREEZE_DUPLICATE_INPUT'); seenPaths.add(path.toLowerCase()); }
  for (const path of trees) walk(path); for (const path of files) add(path);
  const inventory = [...paths].sort().map(path => {
    const absolute = checkedPath(root, path), before = lstatSync(absolute), fd = openSync(absolute, 'r');
    try {
      const opened = fstatSync(fd); check(opened.isFile() && opened.nlink === 1 && opened.dev === before.dev && opened.ino === before.ino, 'FREEZE_FILE_REPLACED');
      const bytes = readFileSync(fd), after = fstatSync(fd), final = lstatSync(absolute);
      check(after.size === opened.size && after.mtimeMs === opened.mtimeMs && final.ino === opened.ino && final.dev === opened.dev && !final.isSymbolicLink(), 'FREEZE_FILE_CHANGED');
      return {path, bytes: bytes.length, sha256: sha(bytes)};
    } finally { closeSync(fd); }
  });
  return {rootHash: sha(realpathSync(root)), trees: [...trees], files: [...files], inventory, hash: digest({rootHash: sha(realpathSync(root)), trees, files, inventory})};
}

function environment(e, mode) {
  check(fields(e, ['nodeVersion', 'platform', 'arch', 'timezone', 'compatibilityDate', 'compatibilityFlags', 'featureFlags', 'providerEndpoint', 'outboundMode']), 'FREEZE_ENV_FIELDS');
  check(/^v(?:22|24)\.\d+\.\d+$/.test(e.nodeVersion) && ['win32', 'linux', 'darwin'].includes(e.platform) && ['x64', 'arm64'].includes(e.arch)
    && e.timezone === 'Asia/Seoul' && /^20\d\d-\d\d-\d\d$/.test(e.compatibilityDate), 'FREEZE_RUNTIME');
  check(Array.isArray(e.compatibilityFlags) && e.compatibilityFlags.every(x => typeof x === 'string' && /^[a-z0-9_]{1,80}$/.test(x)) && new Set(e.compatibilityFlags).size === e.compatibilityFlags.length, 'FREEZE_COMPAT_FLAGS');
  check(fields(e.featureFlags, FLAGS) && FLAGS.every(k => ['true', 'false'].includes(e.featureFlags[k])), 'FREEZE_FEATURE_FLAGS');
  check(e.providerEndpoint === 'https://api.openai.com/v1/responses' && e.outboundMode === (mode === 'synthetic' ? 'synthetic-intercept' : 'approved-openai-only'), 'FREEZE_ENDPOINT');
}
function observation(o) {
  check(fields(o, ['schemaVersion', 'protocol', 'planId', 'runId', 'mode', 'components', 'environment', 'schedule', 'order']), 'FREEZE_FIELDS');
  check(o.schemaVersion === 1 && o.protocol === FREEZE_PROTOCOL && o.planId === PLAN && uuid(o.runId) && ['synthetic', 'evaluation'].includes(o.mode), 'FREEZE_IDENTITY');
  check(fields(o.components, COMPONENTS) && COMPONENTS.every(k => hash(o.components[k])), 'FREEZE_COMPONENTS'); environment(o.environment, o.mode);
  check(Array.isArray(o.schedule) && o.schedule.length > 0 && Array.isArray(o.order), 'FREEZE_SCHEDULE'); const keys = new Set();
  for (const s of o.schedule) {
    check(fields(s, ['key', 'modelId', 'role', 'kind', 'maximumBytes', 'outputTokenMax', 'bodySha256', 'bodyDigest', 'parentKey', 'recipeHash']) && typeof s.key === 'string' && /^[A-Za-z0-9_.:/-]{1,240}$/.test(s.key) && !keys.has(s.key), 'FREEZE_SLOT_FIELDS'); keys.add(s.key);
    check(MODELS.includes(s.modelId) && ['generation', 'judge', 'calibration'].includes(s.role) && ['static', 'derived'].includes(s.kind)
      && integer(s.maximumBytes) && s.maximumBytes <= 262144 && integer(s.outputTokenMax) && s.outputTokenMax <= 4096
      && (s.role !== 'generation' || s.outputTokenMax === 4096), 'FREEZE_SLOT');
    check(s.kind === 'static' ? hash(s.bodySha256) && hash(s.bodyDigest) && s.parentKey === null && s.recipeHash === null
      : s.role === 'judge' && s.bodySha256 === null && s.bodyDigest === null && typeof s.parentKey === 'string' && hash(s.recipeHash), 'FREEZE_WIRE_KIND');
  }
  check(o.order.length === keys.size && new Set(o.order).size === keys.size && o.order.every(k => keys.has(k)), 'FREEZE_ORDER');
  for (const s of o.schedule) if (s.kind === 'derived') {
    const parent = o.schedule.find(p => p.key === s.parentKey); check(parent?.role === 'generation' && parent.modelId !== s.modelId && o.order.indexOf(parent.key) < o.order.indexOf(s.key), 'FREEZE_PARENT');
  }
}
export function sealFreeze(current) { observation(current); const payload = structuredClone(current); return {schemaVersion: 1, hash: digest(payload), payload}; }
export function verifyFreeze(seal, current) {
  check(fields(seal, ['schemaVersion', 'hash', 'payload']) && seal.schemaVersion === 1 && hash(seal.hash), 'FREEZE_ENVELOPE');
  observation(seal.payload); check(digest(seal.payload) === seal.hash, 'FREEZE_SEAL_CHANGED'); observation(current);
  check(digest(current) === seal.hash, 'FREEZE_CONDITIONS_CHANGED'); return {hash: seal.hash, runId: current.runId, realDispatchAuthorized: false};
}
export function writeFreezeExclusive(file, seal) {
  verifyFreeze(seal, seal.payload); const directory = dirname(resolve(file));
  check(isAbsolute(file) && realpathSync(directory) === directory && !lstatSync(directory).isSymbolicLink() && basename(file) === seal.payload.runId + '-freeze.json', 'FREEZE_OUTPUT_SCOPE');
  const fd = openSync(file, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(seal) + '\n', 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
}
function body(seal, key, raw) {
  const slot = seal.payload.schedule.find(s => s.key === key); check(slot && typeof raw === 'string' && Buffer.byteLength(raw) <= slot.maximumBytes, 'FREEZE_WIRE_LIMIT');
  let parsed; try { parsed = JSON.parse(raw); } catch { throw new Error('FREEZE_WIRE_JSON'); }
  check(fields(parsed, ['model', 'instructions', 'input', 'text', 'reasoning', 'max_output_tokens', 'store', 'stream', 'service_tier'])
    && parsed.model === slot.modelId && parsed.max_output_tokens === slot.outputTokenMax && parsed.store === false && parsed.stream === false && parsed.service_tier === 'default'
    && fields(parsed.reasoning, ['effort']) && ['low', 'medium', 'high'].includes(parsed.reasoning.effort)
    && typeof parsed.instructions === 'string' && Array.isArray(parsed.input) && parsed.input.length === 1 && fields(parsed.input[0], ['role', 'content']) && parsed.input[0].role === 'user' && typeof parsed.input[0].content === 'string'
    && fields(parsed.text, ['format']) && object(parsed.text.format) && parsed.text.format.type === 'json_schema' && parsed.text.format.strict === true, 'FREEZE_WIRE_FIELDS');
  return {slot, parsed, bodySha256: sha(raw), bodyDigest: digest(parsed), bytes: Buffer.byteLength(raw)};
}
function parent(seal, slot, p) {
  check(fields(p, ['key', 'requestId', 'responseHash', 'receiptHash', 'sourceSeal']) && p.key === slot.parentKey && uuid(p.requestId) && hash(p.responseHash) && hash(p.receiptHash) && p.sourceSeal === seal.hash, 'FREEZE_PARENT_RECEIPT');
}
// Future judge payload cannot be known at run freeze. Bind its exact bytes to a
// specific captured parent and frozen recipe before its own credential/consume.
// This hash binding does not authenticate an untrusted provider receipt.
function bindDerivedWire({seal, current, key, raw, parentReceipt, recipeHash}) {
  verifyFreeze(seal, current); const b = body(seal, key, raw); check(b.slot.kind === 'derived' && recipeHash === b.slot.recipeHash, 'FREEZE_DERIVATION'); parent(seal, b.slot, parentReceipt);
  const value = {schemaVersion: 1, sourceSeal: seal.hash, runId: seal.payload.runId, key, bodySha256: b.bodySha256, bodyDigest: b.bodyDigest, bytes: b.bytes, parentReceiptHash: digest(parentReceipt), recipeHash};
  return {hash: digest(value), value};
}
export function buildDerivedWire({seal, current, key, templateRaw, parentRaw, parentReceipt}) {
  verifyFreeze(seal, current); const slot = seal.payload.schedule.find(s => s.key === key);
  check(slot?.kind === 'derived' && typeof templateRaw === 'string' && sha(templateRaw) === slot.recipeHash && Buffer.byteLength(templateRaw) <= slot.maximumBytes
    && typeof parentRaw === 'string' && Buffer.byteLength(parentRaw) <= 262144, 'FREEZE_RECIPE'); parent(seal, slot, parentReceipt);
  check(sha(parentRaw) === parentReceipt.responseHash, 'FREEZE_PARENT_BYTES');
  let template, content, feedback; try { template = JSON.parse(templateRaw); content = JSON.parse(template.input[0].content); feedback = JSON.parse(parentRaw); } catch { throw new Error('FREEZE_DERIVED_JSON'); }
  check(fields(content, ['domain', 'input', 'reference', 'feedback']) && ['word', 'grammar'].includes(content.domain) && object(content.input) && object(content.reference) && content.feedback === null, 'FREEZE_RECIPE_CONTENT');
  check(fields(feedback, ['original', 'meaningUsage', 'grammar', 'correctedSentence', 'explanation']) && feedback.original === content.input.sentence
    && typeof feedback.original === 'string' && feedback.original.length <= 2000 && typeof feedback.correctedSentence === 'string' && feedback.correctedSentence.length <= 2000 && typeof feedback.explanation === 'string' && feedback.explanation.length <= 6000
    && ['appropriate', 'needs_work', 'uncertain'].includes(feedback.meaningUsage) && ['natural', 'needs_work', 'uncertain'].includes(feedback.grammar), 'FREEZE_PARENT_VISIBLE');
  content.feedback = feedback; template.input[0].content = JSON.stringify(content); const raw = JSON.stringify(template);
  return {raw, binding: bindDerivedWire({seal, current, key, raw, parentReceipt, recipeHash: slot.recipeHash})};
}
export function verifyFrozenWire({seal, current, key, raw, derivedBinding = null, parentReceipt = null, templateRaw = null, parentRaw = null}) {
  verifyFreeze(seal, current); const b = body(seal, key, raw);
  if (b.slot.kind === 'static') check(derivedBinding === null && parentReceipt === null && templateRaw === null && parentRaw === null && b.bodySha256 === b.slot.bodySha256 && b.bodyDigest === b.slot.bodyDigest, 'FREEZE_STATIC_BODY_CHANGED');
  else {
    parent(seal, b.slot, parentReceipt); check(fields(derivedBinding, ['hash', 'value']) && derivedBinding.hash === digest(derivedBinding.value), 'FREEZE_DERIVED_SEAL');
    const expected = buildDerivedWire({seal, current, key, templateRaw, parentRaw, parentReceipt});
    check(raw === expected.raw && digest(derivedBinding) === digest(expected.binding), 'FREEZE_DERIVED_BODY_CHANGED');
  }
  return {bodySha256: b.bodySha256, bodyDigest: b.bodyDigest, bytes: b.bytes, realDispatchAuthorized: false, receiptAuthenticated: false};
}

export function verifyFrozenBudget(seal, spec) {
  verifyFreeze(seal, seal.payload); validateSpec(spec); const {sourceSeal, ...outline} = spec;
  check(sourceSeal === seal.hash && spec.runId === seal.payload.runId && spec.mode === seal.payload.mode
    && digest(outline) === seal.payload.components.limits && digest(spec.quote) === seal.payload.components.quote, 'FREEZE_BUDGET_BINDING');
}

export async function dispatchFrozenSynthetic({seal, observe, context, key, raw, loadSyntheticCredential, transport, afterCredential}) {
  check(seal?.payload?.mode === 'synthetic' && context.spec.mode === 'synthetic', 'FREEZE_LIVE_NOT_SUPPORTED');
  const verify = () => { const current = observe(); verifyFreeze(seal, current); verifyFrozenBudget(seal, context.spec); verifyFrozenWire({seal, current, key, raw}); };
  verify(); check(typeof loadSyntheticCredential === 'function' && typeof transport === 'function', 'FREEZE_SYNTHETIC_CALLBACKS');
  return dispatchSyntheticOnce({context, key, body: JSON.parse(raw), transport: async ({requestId}) => {
    verify(); const credential = loadSyntheticCredential(); check(credential === 'SYNTHETIC_FREEZE_NEVER_REAL', 'FREEZE_SYNTHETIC_CREDENTIAL');
    afterCredential?.(); verify(); return transport({requestId, raw, credential});
  }});
}
