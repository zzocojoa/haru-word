import { z } from 'zod';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { clearTestFamiliarityDraft } from '@/db/familiarity-cleanup';
import { database } from '@/db/store';
import { isFamiliarityCleanupAccount } from '@/lib/server/familiarity-cleanup';
import { json, validateJsonMutation } from '@/lib/server/http';
import { readBoundedJsonText, RequestBodyError } from '@/lib/server/request-body';

const requestSchema = z.strictObject({
  revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1),
});

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: '로그인한 뒤 다시 시도해 주세요.' }, 401);
  if (!isFamiliarityCleanupAccount(user.userId)) return json({ error: '정리 기능을 사용할 수 없어요.' }, 404);
  const rejected = validateJsonMutation(request);
  if (rejected) return rejected;

  let raw: unknown;
  try {
    raw = JSON.parse(await readBoundedJsonText(request, { bytes: 256 }));
  } catch (error) {
    if (error instanceof RequestBodyError && error.status === 413)
      return json({ error: '요청이 너무 커요.' }, 413);
    return json({ error: '요청 형식이 잘못됐어요.' }, 400);
  }
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return json({ error: '현재 기록을 다시 불러와 주세요.' }, 400);

  try {
    const { revision } = parsed.data;
    const result = await clearTestFamiliarityDraft(database(), user.userId, revision);
    if (result === 'conflict') return json({ error: '다른 기기에서 기록이 바뀌었어요. 최신 기록을 확인해 주세요.', conflict: true }, 409);
    if (result === 'ineligible') return json({ error: '정리할 미확정 테스트 진행이 없어요.' }, 422);
    console.info(JSON.stringify({ event: 'test_familiarity_draft_cleared' }));
    return json({ revision: revision + 1 });
  } catch {
    console.error(JSON.stringify({ event: 'test_familiarity_cleanup_failed' }));
    return json({ error: '정리 결과를 확인하지 못했어요. 최신 기록을 확인해 주세요.' }, 503);
  }
}
