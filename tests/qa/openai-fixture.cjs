// Fixed synthetic responses only. Historical records keep their original shape.
const model = 'gpt-6.1-sol';
const aiHeaders = { 'X-Study-AI-Contract': '2' };
const currentAiHeaders = { 'X-Study-AI-Contract': '4' };
function openaiFeedback(feedback, selected = model) {
  return { ...feedback, provider: 'openai', model: selected, requestedModel: selected,
    promptVersion: 'reference-v1', validationVersion: 'structured-v1' };
}
function currentOpenaiFeedback(route, feedback, selected = model) {
  const input = route.request().postDataJSON();
  if (!/^[a-f0-9]{64}$/.test(input.expectedContextFingerprint || '')) throw Error('Current synthetic feedback requires the request context fingerprint');
  return { ...openaiFeedback(feedback, selected), promptVersion: 'reference-v7', validationVersion: 'judgment-v6',
    contextFingerprint: input.expectedContextFingerprint, ...(input.contextNote ? { contextNote: input.contextNote } : {}) };
}
function feedbackReceipt(route,state='completed'){
  const input=route.request().postDataJSON();
  if(typeof input.requestId!=='string'||!Number.isSafeInteger(input.requestStartedAt))throw Error('Synthetic AI request lacks its UUID receipt contract');
  return {requestId:input.requestId,state,persisted:true};
}
async function acknowledgePending(page){
  const button=page.getByRole('button',{name:'이전 AI 요청 결과 확인',exact:true});
  if(!await button.count()||!await button.isVisible())return false;
  // Mocked POSTs have no real D1 receipt. This explicit GET acknowledges the
  // unknown result; this click must never be replaced by another AI POST.
  await button.click();await page.locator('[data-feedback-code="receipt_unknown"]').waitFor();return true;
}
module.exports = { model, aiHeaders, currentAiHeaders, openaiFeedback,currentOpenaiFeedback,feedbackReceipt,acknowledgePending };
