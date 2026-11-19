'use client';
import {useId,type ReactNode,type KeyboardEvent} from 'react';
import {CollapsibleGroup,useCollapsible} from '@astryxdesign/core/Collapsible';
import {ChevronDown} from 'lucide-react';

type GroupProps={children:ReactNode;className?:string;type:'single';collapsible?:true;value?:string;defaultValue?:string;onValueChange?:(value:string)=>void};
/** The public hook keeps Astryx state while the journal retains its headings and lazy bodies. */
export function HaruAccordion({children,className='',value,defaultValue='',onValueChange}:GroupProps){
 function navigate(event:KeyboardEvent<HTMLDivElement>){
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  const root=event.currentTarget,target=event.target as HTMLElement;
  if(target.closest('[data-haru-accordion]')!==root||!target.matches('[data-slot=accordion-trigger]'))return;
  const buttons=[...root.querySelectorAll<HTMLButtonElement>('[data-slot=accordion-trigger]')].filter(button=>button.closest('[data-haru-accordion]')===root&&button.getClientRects().length&&!button.disabled);
  const index=buttons.indexOf(target as HTMLButtonElement);if(index<0)return;
  event.preventDefault();
  const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
  buttons[next]?.focus();
 }
 return <CollapsibleGroup type="single" value={value} defaultValue={defaultValue} onChange={next=>{if(typeof next==='string')onValueChange?.(next);}}>
  <div className={className} data-haru-accordion data-slot="accordion" data-orientation="vertical" onKeyDown={navigate}>{children}</div>
 </CollapsibleGroup>;
}
export function HaruDisclosure({value,trigger,children,className='',triggerClassName}:{value:string;trigger:ReactNode;children:ReactNode;className?:string;triggerClassName:string}){
 const {isOpen,toggle}=useCollapsible({isCollapsible:true,value}),id=useId(),state=isOpen?'open':'closed';
 return <div className={'haru-disclosure border-b last:border-b-0 '+className} data-slot="accordion-item" data-state={state} data-orientation="vertical">
  <h3 className="flex"><button type="button" id={id} onClick={toggle} aria-expanded={isOpen} aria-controls={id+'-content'} data-slot="accordion-trigger" data-state={state} data-orientation="vertical"
   className={'flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180 '+triggerClassName}>
   {trigger}<ChevronDown className="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200" aria-hidden="true" />
  </button></h3>
  {isOpen&&<div id={id+'-content'} role="region" aria-labelledby={id} data-slot="accordion-content" data-state={state} className="overflow-hidden text-sm">{children}</div>}
 </div>;
}
