import { json } from '@/lib/server/http';
export const dynamic = 'force-dynamic';
// Permanent retirement: old tokens, expiry and provider flags cannot revive it.
export async function POST() { return json({ code: 'legacy_evaluation_disabled' }, 410); }
