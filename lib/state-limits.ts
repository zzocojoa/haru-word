// Account totals, shared by delta saves and both whole/partitioned restores.
export const STATE_COUNTS = { progress: 5_000, sessions: 10_000, grammar: 15 } as const;
export const STATE_BACKUP_BYTES = 20_000_000;
export const STATE_PART_BYTES = 1_800_000;
