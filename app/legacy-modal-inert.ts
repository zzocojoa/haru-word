/**
 * Radix hideOthers exempts live regions. Astryx buttons contain one even when idle,
 * which can leave background buttons exposed after a nested Radix modal opens.
 * Keep the retained Radix modal's background inert using our public data-slot roots.
 * Native top-layer dialogs/popovers retain their own platform interaction rules.
 */
export function installLegacyModalInert(doc:Document=document){
  if(!('inert' in HTMLElement.prototype))return ()=>{};
  const previous=new Map<HTMLElement,boolean>(),opened=new Map<HTMLElement,number>();let sequence=0;
  const restore=(element:HTMLElement)=>{element.inert=previous.get(element)??false;previous.delete(element);};
  const sync=()=>{
    const roots=[...doc.querySelectorAll<HTMLElement>('[data-slot="dialog-content"][role="dialog"][data-state="open"],[data-slot="alert-dialog-content"][role="alertdialog"][data-state="open"],[data-slot="select-content"][role="listbox"][data-state="open"]')];
    for(const element of opened.keys())if(!roots.includes(element))opened.delete(element);
    for(const element of roots)if(!opened.has(element))opened.set(element,++sequence);
    const top=roots.sort((a,b)=>opened.get(b)!-opened.get(a)!)[0];
    const wanted=new Set<HTMLElement>();
    if(top){
      const allowed=[top];
      // The modal's backdrop owns edge Back and outside-pointer dismissal.
      // Preserve its own preceding overlay, while older modal overlays stay inert.
      const slot=top.getAttribute('data-slot');
      const overlaySlot=slot==='dialog-content'?'dialog-overlay':slot==='alert-dialog-content'?'alert-dialog-overlay':null;
      if(overlaySlot){
        for(let node=top.previousElementSibling;node;node=node.previousElementSibling){
          if(node.matches('[data-slot="dialog-content"],[data-slot="alert-dialog-content"]'))break;
          if(node instanceof HTMLElement&&node.getAttribute('data-slot')===overlaySlot&&node.getAttribute('data-state')==='open'){allowed.push(node);break;}
        }
      }
      // An ancestor native modal contains the retained dialog; its other children still need locking.
      for(const selector of ['dialog:modal','[popover]:popover-open'])if(CSS.supports(`selector(${selector})`))allowed.push(...[...doc.querySelectorAll<HTMLElement>(selector)].filter(layer=>!layer.contains(top)));
      const scan=(node:HTMLElement)=>{
        if(allowed.includes(node))return;
        if(allowed.some(root=>node.contains(root))){
          for(const child of node.children)if(child instanceof HTMLElement)scan(child);
        }else wanted.add(node);
      };
      for(const child of doc.body.children)if(child instanceof HTMLElement)scan(child);
    }
    for(const element of previous.keys())if(!wanted.has(element))restore(element);
    for(const element of wanted)if(!previous.has(element)){previous.set(element,element.inert);element.inert=true;}
  };
  const observer=new MutationObserver(sync);
  observer.observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-state','data-slot','role','open']});sync();
  return ()=>{observer.disconnect();for(const element of previous.keys())restore(element);opened.clear();};
}
