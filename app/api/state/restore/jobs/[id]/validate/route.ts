import { validateRestoreJob } from '@/db/restore-jobs';
import { restoreEndpoint } from '@/lib/server/restore-http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { const {id}=await context.params; return restoreEndpoint(request,'validate',(db,user)=>validateRestoreJob(db,user,id)); }
