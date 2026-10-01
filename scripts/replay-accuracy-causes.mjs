// Offline only. This replays existing authored responses; it does not generate
// new answers, modify scores or certify that a changed prompt is more accurate.
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = 'data/evaluations/english-accuracy-2026-10-01-chunked-free.json';
const frozenArtifactHash = '2947cde93dc821ce68c0e8deff36d8cabf399893fb445db356d92398a96e2e0d';
const hashFile = path => createHash('sha256').update(readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n')).digest('hex');
const dimensions = ['meaning', 'grammar', 'correction', 'structure'];
export function replayAccuracyCauses(report, fixture, parse) {
  if (report.comparison !== 'chunked-free-v1' || report.rows.length !== 120 || fixture.cases.length !== 60
      || report.calls !== 120 || report.totalCalls !== 480 || report.publication.promptPublished || report.publication.gatePassed) throw Error('Invalid frozen pilot.');
  const seen = new Set(), accepted = [], unavailable = [];
  for (const row of report.rows) {
    const sample = fixture.cases.find(c => c.id === row.caseId), key = `${row.provider}:${row.caseId}`;
    if (!sample || !['google', 'groq'].includes(row.provider) || seen.has(key) || !/^B\d{3}$/.test(row.label)
        || !['response', 'failure'].includes(row.status)) throw Error('Invalid authored row.');
    seen.add(key);
    if (row.status !== 'response') {
      // No raw rejected output was retained. Never infer a more precise cause.
      unavailable.push({ label: row.label, caseId: row.caseId, provider: row.provider,
        validationStage: ['fields', 'structure'].includes(row.validationStage) ? row.validationStage : 'other',
        diagnostic: ['wire_fields', 'chunk_count'].includes(row.diagnostic) ? row.diagnostic : 'other', exactCause: 'not_recorded' });
      continue;
    }
    if (row.feedback?.original !== sample.sentence || row.feedback.model !== report.summaries[row.provider].model
        || !dimensions.every(d => ['pass', 'fail'].includes(row.dimensions[d]))) throw Error('Invalid response context.');
    const { original, model } = row.feedback, content = { ...row.feedback };
    delete content.original; delete content.model; delete content.createdAt;
    let parserAccepted = false, validationStage;
    try { parse(JSON.stringify(content), original, model); parserAccepted = true; }
    catch (error) { validationStage = ['fields', 'structure', 'judgment', 'content_type', 'content_limit', 'json_syntax'].includes(error.stage) ? error.stage : 'other'; }
    const failedDimensions = dimensions.filter(d => row.dimensions[d] === 'fail');
    if (row.overall !== (failedDimensions.length ? 'fail' : 'pass')) throw Error('Invalid frozen judgment.');
    accepted.push({ label: row.label, caseId: row.caseId, provider: row.provider, parserAccepted,
      ...(validationStage ? { validationStage } : {}), failedDimensions,
      interpretation: failedDimensions.length ? 'frozen_semantic_failure' : 'frozen_pass' });
  }
  const failures = accepted.filter(r => r.failedDimensions.length);
  return { schemaVersion: 1, purpose: 'Offline root-cause replay; no new generation or score', sourceArtifact: source,
    sourceArtifactContentHash: hashFile(source), fixtureContentHash: hashFile('tests/fixtures/english-accuracy.json'),
    actualProviderCalls: 0, frozenScores: Object.fromEntries(['google', 'groq'].map(p => [p, report.summaries[p].overallPass])),
    validResponses: accepted.length, parserAccepted: accepted.filter(r => r.parserAccepted).length,
    knownSemanticFailures: failures.length, knownSemanticFailuresAccepted: failures.filter(r => r.parserAccepted).length,
    failedDimensions: Object.fromEntries(dimensions.map(d => [d, failures.filter(r => r.failedDimensions.includes(d)).length])),
    unavailableOutputs: unavailable.length, rows: accepted, unavailable,
    conclusion: 'Format/ordering/judgment consistency does not validate English meaning, roles or explanations. Model-internal cause remains unknown.',
  };
}

export async function runCauseReplay() {
  if (hashFile(source) !== frozenArtifactHash) throw Error('Frozen pilot changed.');
  // Import only the local parser, never either provider transport or a key.
  const directory = resolve(root, '.sites-runtime/english-accuracy');
  mkdirSync(directory, { recursive: true });
  const runDirectory = mkdtempSync(resolve(directory, 'cause-replay-run-')), buildFile = resolve(runDirectory, 'parser.mjs');
  const parserFiles = ['lib/provider-feedback-contract.ts', 'lib/sentence-feedback.ts', 'lib/sentence-structure.ts', 'lib/learning/feedback-identity.ts', 'package-lock.json'];
  const parserSourceHashes = Object.fromEntries(parserFiles.map(p => [p, hashFile(p)]));
  await build({ entryPoints: [resolve(root, 'lib/provider-feedback-contract.ts')], outfile: buildFile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { parseProviderFeedback } = await import(pathToFileURL(buildFile).href);
  const report = JSON.parse(readFileSync(resolve(root, source), 'utf8'));
  const fixture = JSON.parse(readFileSync(resolve(root, 'tests/fixtures/english-accuracy.json'), 'utf8'));
  const replay = replayAccuracyCauses(report, fixture, parseProviderFeedback);
  if (replay.fixtureContentHash !== report.fixtureContentHash) throw Error('Fixture changed.');
  if (parserFiles.some(p => hashFile(p) !== parserSourceHashes[p]) || hashFile(source) !== frozenArtifactHash) throw Error('Replay sources changed during execution.');
  replay.parserSourceHashes = parserSourceHashes;
  replay.parserBundleHash = hashFile(buildFile);
  const path = resolve(directory, 'cause-replay.json');
  const temporary = resolve(runDirectory, 'result.json.tmp');
  writeFileSync(temporary, JSON.stringify(replay, null, 2) + '\n'); renameSync(temporary, path);
  return replay;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw Error('Offline replay accepts no live or credential arguments.');
  runCauseReplay().then(r => console.log(JSON.stringify({ actualProviderCalls: r.actualProviderCalls, validResponses: r.validResponses,
    parserAccepted: r.parserAccepted, knownSemanticFailures: r.knownSemanticFailures, knownSemanticFailuresAccepted: r.knownSemanticFailuresAccepted,
    failedDimensions: r.failedDimensions, unavailableOutputs: r.unavailableOutputs }))).catch(() => { console.error('Offline replay failed; frozen artifacts unchanged.'); process.exitCode = 1; });
}
