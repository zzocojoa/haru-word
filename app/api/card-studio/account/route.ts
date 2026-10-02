import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { isCardStudioOwner } from '@/lib/server/card-studio';
export const dynamic = 'force-dynamic';
// The operator uses their own authenticated site identity for initial setup.
// No account listing, owner identity, credentials or learning records are exposed.
export async function GET() {
  const user = await getChatGPTUser();
  return Response.json(user ? { userId: user.userId, enabled: isCardStudioOwner(env, user) } : { error: 'LOGIN_REQUIRED' },
    { status: user ? 200 : 401, headers: { 'Cache-Control': 'no-store' } });
}
