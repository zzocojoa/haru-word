// Shared malformed sessions must be rejected before either write path touches DB.
export const invalidSessionCases = [
  ['calendar date', s => { s.date = '2026-02-30'; }],
  ['cursor', s => { s.index = 999; }],
  ['missing record', s => { delete s.records[s.ids[0]]; }],
  ['finished stage', s => { s.finished = true; }],
  ['empty retry', s => { s.retryMode = true; }],
  ['period', s => { s.period = '2026-13-01'; }],
  ['resume past targets', s => { s.resumeAfterRetry = { stage: 'ko', index: s.ids.length }; }],
  ['resume past warmup', s => { s.warmupIds = [s.ids[0]]; s.resumeAfterRetry = { stage: 'warmup', index: 1 }; }],
  ['daily checkpoint', s => { s.resumeAfterRetry = { stage: 'checkpoint', index: 0 }; }],
  ['batch start', s => { s.batchStart = s.ids.length; }],
];
