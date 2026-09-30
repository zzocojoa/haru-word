import { commitRestoreJob } from '@/db/restore-jobs';
import { restoreEndpoint } from '@/lib/server/restore-http';
import { supportsFeedbackStructure } from '@/lib/feedback-compatibility';
import { supportsSenseKeys } from '@/lib/state-data-keys';
import { grammarClientVersion } from '@/lib/grammar/compatibility';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { const {id}=await context.params; return restoreEndpoint(request,'commit',(db,user)=>commitRestoreJob(db,user,id,grammarClientVersion(request.headers.get('x-study-grammar')),supportsFeedbackStructure(request),supportsSenseKeys(request))); }
