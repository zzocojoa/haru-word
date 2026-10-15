import { env } from 'cloudflare:workers';
import { handleTopicSentenceValidation } from '@/lib/server/topic-sentence-validation.mjs';
export const dynamic = 'force-dynamic';
export function POST(request: Request) {
  return handleTopicSentenceValidation(request, env);
}
