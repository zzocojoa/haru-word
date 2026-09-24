import { cancelRestoreJob, getRestoreJob } from '@/db/restore-jobs';
import { restoreEndpoint } from '@/lib/server/restore-http';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { const {id}=await context.params; return restoreEndpoint(request,'status',(db,user)=>getRestoreJob(db,user,id)); }
export async function DELETE(request: Request, context: Context) { const {id}=await context.params; return restoreEndpoint(request,'cancel',(db,user)=>cancelRestoreJob(db,user,id)); }
