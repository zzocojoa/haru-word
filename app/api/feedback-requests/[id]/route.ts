import {z} from 'zod';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {database} from '@/db/store';
import {getFeedbackRequest} from '@/db/feedback-requests';
import {feedbackErrorBody} from '@/lib/feedback-issue';
import {json} from '@/lib/server/http';
import {aiContractVersion,requiresAiContractFeedback} from '@/lib/ai-contract';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
  const user=await getChatGPTUser();if(!user)return json(feedbackErrorBody('login_required'),401);
  const {id}=await context.params;if(!z.string().uuid().safeParse(id).success)return json(feedbackErrorBody('invalid_request'),400);
  try{
    const response=await getFeedbackRequest(database(),user.userId,id);
    const body=await response.clone().json() as {feedback?:import('@/lib/sentence-feedback').SentenceFeedback};
    if(requiresAiContractFeedback(body.feedback,aiContractVersion(request)))return json(feedbackErrorBody('ai_client_outdated'),426);
    return response;
  }
  catch{return json(feedbackErrorBody('site_error'),503);}
}
