import { z } from 'zod';
import { createStateSchemas } from './state-shape';
import { InvalidResponseError } from './client-request';
import type { StateRevision, StateSnapshot } from './api-contracts';

// Do not pull the vocabulary catalog into the client transport bundle.
const { settingsSchema, progressSchema, sessionSchema } = createStateSchemas(z.string().min(1).max(100));
const revisionSchema = z.object({ revision: z.number().int().nonnegative().safe() }).strict();
const snapshotSchema = revisionSchema.extend({ state: z.object({
  settings: settingsSchema,
  progress: z.record(z.string(), progressSchema),
  sessions: z.record(z.string().uuid(), sessionSchema),
}).strict() }).strict();

export function parseSnapshot(value: unknown): StateSnapshot {
  const parsed = snapshotSchema.safeParse(value);
  if (!parsed.success) throw new InvalidResponseError();
  return parsed.data;
}
export function parseRevision(value: unknown, previous: number): StateRevision {
  const parsed = revisionSchema.safeParse(value);
  if (!parsed.success || parsed.data.revision !== previous + 1) throw new InvalidResponseError();
  return parsed.data;
}
