import { env } from 'cloudflare:workers';

export function getFamiliarityCleanupStatus(userId: string | null | undefined) {
  const testUserId = env.FAMILIARITY_CLEANUP_TEST_USER_ID;
  return {
    bindingPresent: typeof testUserId === 'string',
    matchesCurrentLogin: !!userId && userId === testUserId,
  };
}

export function isFamiliarityCleanupAccount(userId: string | null | undefined) {
  return getFamiliarityCleanupStatus(userId).matchesCurrentLogin;
}
