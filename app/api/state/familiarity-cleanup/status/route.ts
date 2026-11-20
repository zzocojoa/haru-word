import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getFamiliarityCleanupStatus } from '@/lib/server/familiarity-cleanup';
import { json, validateSameOrigin } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: '로그인한 뒤 다시 시도해 주세요.' }, 401);
  const rejected = validateSameOrigin(request);
  if (rejected) return rejected;
  return json(getFamiliarityCleanupStatus(user.userId));
}
