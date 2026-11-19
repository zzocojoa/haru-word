export async function load(url,context,nextLoad){
  if(url.startsWith('file:')&&new URL(url).pathname.endsWith('.css'))return {format:'module',source:'export {};',shortCircuit:true};
  return nextLoad(url,context);
}
