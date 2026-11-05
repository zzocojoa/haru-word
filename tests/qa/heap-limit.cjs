// Test process only. Workerd's local V8 default is much larger than production.
// Miniflare 5 has a debugging environment input for Config.v8Flags. Verify the
// actual Wrangler-resolved consumer before setting it; fail closed on changes.
// This preload runs only in the owned resource-test process, never deployment.
const {createRequire}=require('node:module'),fs=require('node:fs'),path=require('node:path');
const fromWrangler=createRequire(path.resolve('node_modules/wrangler/package.json'));
const source=fs.readFileSync(fromWrangler.resolve('miniflare'),'utf8');
const input='v8Flags: process.env.MINIFLARE_WORKERD_V8_FLAGS ? process.env.MINIFLARE_WORKERD_V8_FLAGS.split(" ") : []';
if(source.split(input).length!==2)throw Error('Update the workerd heap-limit test adapter for this Miniflare version');
process.env.MINIFLARE_WORKERD_V8_FLAGS='--max-old-space-size=96 --max-semi-space-size=4';
process.stderr.write('QA workerd V8 cap: old space 96 MB, semi space 4 MB\n');
