// Select by the user-visible option. Supports retained native and migrated Core controls.
async function chooseOption(control,value,label){
  if(await control.evaluate(e=>e.tagName==='SELECT'))return control.selectOption(value);
  const name=label??(value===''?'새로운 뜻 · 초안':await control.getAttribute('aria-label')==='페이지당 단어 수'?value+'개':value);
  await control.click();await control.page().getByRole('option',{name,exact:true}).click();
}
async function selectedOption(control){
  if(await control.evaluate(e=>e.tagName==='SELECT'))return control.inputValue();
  const text=(await control.innerText()).trim();return text==='새로운 뜻 · 초안'?'':text;
}
module.exports={chooseOption,selectedOption};
