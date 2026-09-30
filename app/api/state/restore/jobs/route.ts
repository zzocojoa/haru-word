import { activeRestoreJob, createRestoreJob, RestoreError } from '@/db/restore-jobs';
import { createRestoreSchema } from '@/lib/restore-validation';
import { readBoundedJsonText, restoreEndpoint } from '@/lib/server/restore-http';
import { RequestBodyError } from '@/lib/server/request-body';
export const dynamic = 'force-dynamic';
export function GET(request: Request) { return restoreEndpoint(request, 'status', async (db,user) => ({ job: await activeRestoreJob(db,user) })); }
export function POST(request: Request) {
  return restoreEndpoint(request, 'create', async (db,user,metrics) => {
    let value: unknown; try { value=JSON.parse(await readBoundedJsonText(request,{bytes:100_000},metrics)); } catch(e) { if(e instanceof RequestBodyError) throw e; throw new RestoreError('요청 형식이 잘못되었어요.'); }
    const parsed=createRestoreSchema.safeParse(value);
    if(!parsed.success) throw new RestoreError('백업 크기와 전송 목록을 확인해 주세요.');
    return createRestoreJob(db,user,parsed.data.revision,parsed.data.manifest);
  });
}
