import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { accuracyCases, evaluateAccuracyCase } from '@/lib/english-accuracy';
import { evaluateOriginalAccuracyCase, ORIGINAL_FEEDBACK_COMPARISON } from '@/lib/original-feedback-evaluation';
import { evaluateFreeAccuracyCase, FREE_FEEDBACK_COMPARISON, FEEDBACK_DIAGNOSTICS, parseFeedbackValidationDetail } from '@/lib/free-feedback-evaluation';
import { FeedbackError } from '@/lib/gemini-feedback';
import { json, validateJsonMutation } from '@/lib/server/http';
import { readBoundedJsonText } from '@/lib/server/request-body';

export const dynamic = 'force-dynamic';
const fields = { caseId: z.string().max(40), provider: z.enum(['google', 'groq']) };
const schema = z.union([
  z.object({ ...fields, round: z.union([z.literal(1), z.literal(2)]) }).strict(),
  z.object({ ...fields, comparison: z.literal(ORIGINAL_FEEDBACK_COMPARISON) }).strict(),
  z.object({ ...fields, comparison: z.literal(FREE_FEEDBACK_COMPARISON) }).strict(),
]);
function tokenMatches(actual: string, expected: string) {
  if (actual.length !== 64 || expected.length !== 64) return false;
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
export async function POST(request: Request) {
  const token = env.english_accuracy_token;
  const expires = Date.parse(env.english_accuracy_expires ?? '');
  // A separate 256-bit secret authorizes this bounded synthetic-only operation.
  // No learner identity, learner state, user-generated input or keys are exposed.
  if (!token || !Number.isFinite(expires) || expires <= Date.now() || expires > Date.now() + 86_400_000) return json({ code: 'evaluation_disabled' }, 404);
  if (!tokenMatches(request.headers.get('x-english-accuracy-token') ?? '', token)) return json({ code: 'evaluation_unauthorized' }, 401);
  const rejected = validateJsonMutation(request);
  if (rejected) return rejected;
  let parsed;
  try { parsed = schema.safeParse(JSON.parse(await readBoundedJsonText(request, { bytes: 1024 }))); }
  catch { return json({ code: 'evaluation_invalid_request' }, 400); }
  if (!parsed.success) return json({ code: 'evaluation_invalid_request' }, 400);
  if (env.english_accuracy_profile && (!('comparison' in parsed.data) || parsed.data.comparison !== env.english_accuracy_profile)) return json({ code: 'evaluation_invalid_request' }, 400);
  if ('comparison' in parsed.data && parsed.data.comparison === FREE_FEEDBACK_COMPARISON && env.english_accuracy_profile !== FREE_FEEDBACK_COMPARISON) return json({ code: 'evaluation_disabled' }, 404);
  const { caseId, provider } = parsed.data;
  const profile = 'comparison' in parsed.data ? { comparison: parsed.data.comparison } : { round: parsed.data.round };
  const sample = accuracyCases.find(c => c.id === caseId);
  if (!sample) return json({ code: 'evaluation_invalid_case' }, 400);
  if (!(provider === 'google' ? env.google_api : env.groq_api)?.trim()) return json({ code: 'evaluation_key_missing' }, 503);
  const started = Date.now();
  try {
    const config = { google_api: env.google_api, groq_api: env.groq_api, signal: request.signal };
    const result = 'comparison' in parsed.data
      ? parsed.data.comparison === FREE_FEEDBACK_COMPARISON ? await evaluateFreeAccuracyCase(config, provider, sample) : await evaluateOriginalAccuracyCase(config, provider, sample)
      : await evaluateAccuracyCase(config, provider, sample, fetch, parsed.data.round);
    return json({ ...result, caseId, provider, ...profile, durationMs: Date.now() - started });
  } catch (error) {
    const known = error instanceof FeedbackError;
    const validationDetail = 'comparison' in parsed.data && parsed.data.comparison === FREE_FEEDBACK_COMPARISON
      && known && error.code.endsWith('invalid_response') ? parseFeedbackValidationDetail(error.validationDetail, { stage: error.validationStage, diagnostic: error.diagnostic }) : undefined;
    return json({ caseId, provider, ...profile, code: known ? error.code : 'evaluation_internal',
      ...(known && error.issue.providerStatus !== undefined ? { providerStatus: error.issue.providerStatus } : {}),
      ...(known && error.code.endsWith('invalid_response') && error.validationStage ? { validationStage: error.validationStage } : {}),
      ...('comparison' in parsed.data && parsed.data.comparison === FREE_FEEDBACK_COMPARISON && known && error.diagnostic && FEEDBACK_DIAGNOSTICS.includes(error.diagnostic) ? { diagnostic: error.diagnostic } : {}),
      ...(validationDetail ? { validationDetail } : {}),
      durationMs: Date.now() - started }, known ? error.status : 503);
  }
}
