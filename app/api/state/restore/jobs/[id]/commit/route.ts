import { commitRestoreJob } from '@/db/restore-jobs';
import { restoreEndpoint } from '@/lib/server/restore-http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { const {id}=await context.params; return restoreEndpoint(request,'commit',(db,user)=>commitRestoreJob(db,user,id)); }
