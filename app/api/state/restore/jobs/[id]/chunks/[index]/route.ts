import { uploadRestorePart } from '@/db/restore-jobs';
import { RESTORE_PART_BYTES } from '@/lib/restore-protocol';
import { readBoundedJsonText, restoreEndpoint } from '@/lib/server/restore-http';
export const dynamic = 'force-dynamic';
export async function PUT(request: Request, context: { params: Promise<{ id: string; index: string }> }) {
  const { id,index }=await context.params;
  return restoreEndpoint(request,'upload',async(db,user,metrics)=>uploadRestorePart(db,user,id,/^\d+$/.test(index)?Number(index):-1,await readBoundedJsonText(request,{bytes:RESTORE_PART_BYTES},metrics)));
}
