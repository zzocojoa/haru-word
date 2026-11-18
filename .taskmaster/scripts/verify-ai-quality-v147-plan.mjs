// Run the verifier for the current phase; prior planning proof remains archived.
import {readFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile(new URL('../docs/ai-quality-v147-manifest.json',import.meta.url),'utf8'));
await import(manifest.executionStarted?'./verify-ai-quality-v147-execution.mjs':'./verify-ai-quality-v147-revision2.mjs');
