import { z } from 'zod';
import { grammarStateSchema } from './grammar/model';
import { createStateSchemas } from './state-shape';
import { InvalidResponseError } from './client-request';
import type { StateRevision, StateSnapshot } from './api-contracts';
import { stateReferenceIssues } from './state-integrity';
import { assertStateDataKeys } from './state-data-keys';

// Do not pull the vocabulary catalog into the client transport bundle.
const entryId = z.string().min(1).max(100);
const { settingsSchema, progressSchema, sessionSchema } = createStateSchemas(entryId);
const revisionSchema = z.object({ revision: z.number().int().nonnegative().safe() }).strict();
const snapshotSchema = revisionSchema.extend({ state: z.object({
  grammar: grammarStateSchema.optional(),
  settings: settingsSchema,
  progress: z.record(entryId, progressSchema),
  sessions: z.record(z.string().uuid(), sessionSchema),
}).strict() }).strict();

export function parseSnapshot(value: unknown): StateSnapshot {
  try { if (value && typeof value === 'object' && 'state' in value) assertStateDataKeys(value.state); }
  catch { throw new InvalidResponseError(); }
  const parsed = snapshotSchema.safeParse(value);
  if (!parsed.success || stateReferenceIssues(parsed.data.state).length) throw new InvalidResponseError();
  return parsed.data;
}
export function parseRevision(value: unknown, previous: number): StateRevision {
  const parsed = revisionSchema.safeParse(value);
  if (!parsed.success || parsed.data.revision !== previous + 1) throw new InvalidResponseError();
  return parsed.data;
}
