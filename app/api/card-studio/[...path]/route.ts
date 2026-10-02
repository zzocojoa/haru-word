import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { proxyCardStudio } from '@/lib/server/card-studio';
export const dynamic = 'force-dynamic';
async function proxy(request: Request) { return proxyCardStudio(request, env, await getChatGPTUser()); }
export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };
