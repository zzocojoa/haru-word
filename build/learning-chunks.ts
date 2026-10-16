import path from 'node:path';
import type { Plugin } from 'vite';

type Info = { importedIds: string[] };
export function staticDependencies(entry: string, get: (id: string) => Info | null): Set<string> {
  if (!get(entry)) throw new Error('Learning client entry missing from the build graph');
  const seen = new Set<string>();
  function visit(id: string) {
    if (seen.has(id)) return;
    seen.add(id);
    // Dynamic imports deliberately stay outside this closure.
    for (const dependency of get(id)?.importedIds ?? []) visit(dependency);
  }
  visit(entry);
  return seen;
}

// Only the client build is affected. Preserve Vinext's framework groups and
// entry ownership; merge small subgroups without promoting deferred textbooks.
export function learningChunks(): Plugin {
  let entry = '';
  return {
    name: 'learning-shared-chunks', apply: 'build', enforce: 'post',
    applyToEnvironment: environment => environment.name === 'client',
    configResolved(config) { entry = path.resolve(config.root, 'app/learning-app.tsx').replaceAll('\\', '/'); },
    outputOptions(options) {
      if (typeof options.codeSplitting !== 'object') throw new Error('Expected Vinext client chunk groups');
      let initial: Set<string> | undefined;
      return { ...options, codeSplitting: { ...options.codeSplitting, groups: [...options.codeSplitting.groups ?? [], {
        name(id, context) {
          if (!initial) {
            initial = staticDependencies(entry, moduleId => context.getModuleInfo(moduleId));
            for (const moduleId of initial) if (/\/data\/(?:content|word-image-ui)\.json(?:\?|$)/.test(moduleId.replaceAll('\\', '/')))
              throw new Error('Deferred learning material returned to the initial build graph');
          }
          return initial.has(id) ? 'learning-shared' : null;
        },
        priority: -1, minSize: 0, entriesAware: true, entriesAwareMergeThreshold: 32_768,
      }] } };
    },
  };
}
