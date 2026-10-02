import plan from '../data/evaluations/coherent-feedback-plan.json';
import { accuracyCases, accuracyModels, accuracyRequest, type AccuracyCase, type AccuracyProvider } from './english-accuracy';
import { coherentFeedbackContract, coherentFeedbackInput, coherentWordInstruction, coherentGrammarInstruction } from './coherent-feedback';
import { generateTutorFeedback } from './gemini-feedback';
import { generateGroqFeedback } from './groq-feedback';
import { GOOGLE_PRIMARY_TIMEOUT_MS, type FeedbackProviders } from './feedback-fallback';
import { FeedbackError } from './provider-feedback-error';
import { ReasoningPilotError, usageEvidence, type ReasoningEvidence } from './reasoning-pilot-evaluation';
import { tokenEvidenceQuotaHeaders } from './token-evidence-evaluation';
import { captureGroqHttpDiagnostic } from './groq-http-diagnostics';
export { parseGroqHttpDiagnostic } from './groq-http-diagnostics';
export { accuracyModels };
export { sentenceFeedbackSchema } from './sentence-feedback';
export { FEEDBACK_ISSUES } from './original-feedback-evaluation';
export { FEEDBACK_VALIDATION_STAGES, FEEDBACK_DIAGNOSTICS } from './provider-feedback-contract';
export { parseFeedbackValidationDetail } from './feedback-validation-detail';
export { parseTokenEvidenceQuota } from './token-evidence-evaluation';
export const COHERENT_FEEDBACK_COMPARISON = 'coherent-feedback-v1' as const;
export const coherentFeedbackCases = plan.caseIds.map(id => accuracyCases.find(sample => sample.id === id)!);
export const allowedCoherentFeedbackCase = (id: string) => plan.caseIds.includes(id);
export const coherentFeedbackSchedule = () => coherentFeedbackCases.flatMap(sample => (['google','groq'] as const).map(provider => ({caseId:sample.id,provider})));
export class CoherentFeedbackError extends ReasoningPilotError {}
const hash = async (value: unknown) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))), b => b.toString(16).padStart(2, '0')).join('');
export function coherentFeedbackRequest(sample: AccuracyCase) {
  return { input: coherentFeedbackInput(accuracyRequest(sample, 1).input), instruction: sample.domain === 'word' ? coherentWordInstruction : coherentGrammarInstruction };
}
// Same request constructors/parser as the dormant learner flag, direct one-call
// transports at their existing model/reasoning/time/output limits; no fallback.
export async function evaluateCoherentFeedbackCase(config: FeedbackProviders, provider: AccuracyProvider, sample: AccuracyCase, fetcher: typeof fetch = fetch) {
  if (!allowedCoherentFeedbackCase(sample.id)) throw Error('Invalid fixed coherent case');
  const {input,instruction} = coherentFeedbackRequest(sample), evidence: ReasoningEvidence = {requestHash:'',quota:{},usage:{}};
  const promptHash = await hash(instruction + coherentFeedbackContract.instruction);
  const measured: typeof fetch = async(url,init) => {
    evidence.requestHash = await hash({url:String(url),body:JSON.parse(String(init?.body))});
    const response = await fetcher(url,init); evidence.quota = tokenEvidenceQuotaHeaders(response.headers);
    if (provider === 'groq' && !response.ok) evidence.httpError = await captureGroqHttpDiagnostic(response, init?.signal ?? undefined);
    if(response.ok)try{
      const raw = await response.clone().json() as {usageMetadata?:unknown;usage?:unknown;candidates?:{finishReason?:string}[];choices?:{finish_reason?:string}[]};
      evidence.usage = usageEvidence(provider==='google'?raw.usageMetadata:raw.usage,provider);
      const finish = provider==='google'?raw.candidates?.[0]?.finishReason:raw.choices?.[0]?.finish_reason;
      if(typeof finish==='string'&&['STOP','MAX_TOKENS','SAFETY','RECITATION','OTHER','stop','length','content_filter'].includes(finish))evidence.finish=finish;
    }catch{ /* The shared transport rejects malformed envelopes safely. */ }
    return response;
  };
  try {
    const feedback = provider==='google'
      ? await generateTutorFeedback(config.google_api!,input,instruction,measured,GOOGLE_PRIMARY_TIMEOUT_MS,config.signal,coherentFeedbackContract)
      : await generateGroqFeedback(config.groq_api!,input,instruction,measured,config.signal,coherentFeedbackContract);
    return {feedback,promptHash,...evidence};
  } catch(error){if(error instanceof FeedbackError)throw new CoherentFeedbackError(error,evidence);throw error;}
}
export async function coherentFeedbackProfile(sample: AccuracyCase, provider: AccuracyProvider) {
  try { await evaluateCoherentFeedbackCase({google_api:'synthetic',groq_api:'synthetic'},provider,sample,async()=>Response.json({}, {status:400})); }
  catch(error){if(error instanceof CoherentFeedbackError&&error.evidence.requestHash)return {requestHash:error.evidence.requestHash,promptHash:await hash(coherentFeedbackRequest(sample).instruction+coherentFeedbackContract.instruction)};throw error;}
  throw Error('Missing synthetic coherent request profile');
}
