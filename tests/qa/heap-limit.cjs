// Test process only. Workerd's local V8 default is much larger than production.
// Its documented Config.v8Flags can model constrained GC without changing the
// deployed Worker or the installed dependency. Fail loudly if the pinned
// Miniflare implementation changes instead of silently running unconstrained.
const Module=require('node:module'),fs=require('node:fs');
const original=Module._extensions['.js'];
Module._extensions['.js']=function(module,filename){
 if(filename.replaceAll('\\','/').endsWith('/miniflare/dist/src/index.js')){
  const source=fs.readFileSync(filename,'utf8'),needle='const configBuffer = serializeConfig(config);';
  if(source.split(needle).length!==2)throw Error('Update the workerd heap-limit test adapter for this Miniflare version');
  Module._extensions['.js']=original;
  module._compile(source.replace(needle,'config.v8Flags = ["--max-old-space-size=96", "--max-semi-space-size=4"]; '+needle),filename);
  process.stderr.write('QA workerd V8 cap: old space 96 MB, semi space 4 MB\n');
 }else original(module,filename);
};
