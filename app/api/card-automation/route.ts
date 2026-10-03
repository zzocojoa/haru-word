import { env } from 'cloudflare:workers';
import { handleCardAutomationRelay } from '@/lib/server/card-automation.generated.mjs';

export const dynamic = 'force-dynamic';
// A signed server request uses the existing bridge identity. Browser login alone grants no access.
export async function POST(request: Request) {
  return handleCardAutomationRelay(request, env);
}
