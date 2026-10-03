import sourceIndex from '../../data/grammar-review-sources.json';
export function exampleReviewSources(id: string) {
  const names = sourceIndex.examples[id as keyof typeof sourceIndex.examples] ?? [];
  return names.map(name => sourceIndex.sources[name as keyof typeof sourceIndex.sources]);
}
export { sourceIndex };
