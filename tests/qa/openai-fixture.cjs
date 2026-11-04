// New-generation fixtures only. Keep historical Google/Groq record fixtures intact.
const model = 'gpt-6.1-sol';
const aiHeaders = { 'X-Study-AI-Contract': '2' };
function openaiFeedback(feedback, selected = model) {
  return { ...feedback, provider: 'openai', model: selected, requestedModel: selected,
    promptVersion: 'reference-v1', validationVersion: 'structured-v1' };
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
module.exports = { model, aiHeaders, openaiFeedback,feedbackReceipt,acknowledgePending };
