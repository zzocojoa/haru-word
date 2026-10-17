import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/store';
import { loadImagePracticePosition, saveImagePracticePosition } from '@/db/image-practice-position';
import { json, validateJsonMutation } from '@/lib/server/http';
import { readBoundedJsonText, RequestBodyError } from '@/lib/server/request-body';
import images from '@/data/word-image-ui.json';

export const dynamic = 'force-dynamic';
const entryIds = new Set(images.entries.map(row => row[0]));
const unauthorized = () => json({ error: '로그인을 확인한 뒤 다시 열어 주세요.' }, 401);

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user || (request.headers.has('x-image-practice-owner') && request.headers.get('x-image-practice-owner') !== user.userId)) return unauthorized();
  try { return json(await loadImagePracticePosition(database(), user.userId)); }
  catch { return json({ error: '연습 위치를 불러오지 못했어요.' }, 503); }
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user || (request.headers.has('x-image-practice-owner') && request.headers.get('x-image-practice-owner') !== user.userId)) return unauthorized();
  const rejected = validateJsonMutation(request);
  if (rejected) return rejected;
  let body;
  try { body = JSON.parse(await readBoundedJsonText(request, { bytes: 1024 })); }
  catch (error) { return json({ error: '위치 요청 형식을 확인해 주세요.' }, error instanceof RequestBodyError ? error.status : 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['entryId', 'revision'].includes(key)) ||
      typeof body.entryId !== 'string' || !entryIds.has(body.entryId) || !Number.isSafeInteger(body.revision) || body.revision < 0 || body.revision >= Number.MAX_SAFE_INTEGER)
    return json({ error: '유효한 카드와 위치 revision이 필요해요.' }, 400);
  try {
    const position = await saveImagePracticePosition(database(), user.userId, body.entryId, body.revision);
    return position ? json(position) : json({ error: '다른 기기에서 연습 위치가 바뀌었어요.', conflict: true }, 409);
  } catch { return json({ error: '연습 위치를 저장하지 못했어요.' }, 503); }
}
