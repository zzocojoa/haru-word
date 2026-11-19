import { env } from 'cloudflare:workers';

export function isFamiliarityCleanupAccount(userId: string | null | undefined) {
  return !!userId && userId === env.FAMILIARITY_CLEANUP_TEST_USER_ID;
}
