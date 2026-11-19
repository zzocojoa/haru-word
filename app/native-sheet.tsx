'use client';
import {useCallback,useLayoutEffect,useRef,useState,type ComponentProps,type ReactNode} from 'react';
import {Dialog as NativeDialog} from '@astryxdesign/core/Dialog';
import {Stack} from '@astryxdesign/core/Layout';
import {HaruIcon} from '@/components/icons/haru-icon';
import {DialogContent} from '@/components/ui/dialog';
import {registerNativeModal} from '@/components/ui/native-modal-portal';
import {HaruIconButton} from './haru-controls';
import {installSheetSwipe} from './sheet-swipe';

type ContentProps=ComponentProps<typeof DialogContent>;
type NativeSheetProps=Pick<ContentProps,'children'|'className'|'showCloseButton'|'onOpenAutoFocus'|'onCloseAutoFocus'|'onEscapeKeyDown'|'onInteractOutside'|'onPointerDownOutside'> & {
  open:boolean;titleId:string;descriptionId:string;disabled:boolean;
  close:(beforeClose?:()=>Promise<boolean>)=>Promise<boolean>;blocked:()=>boolean;dirty:()=>boolean;
};

/** Presentation only: every implicit dismissal still goes through SheetDialog.close. */
export function NativeSheet({open,children,className='',showCloseButton=true,titleId,descriptionId,disabled,close,blocked,dirty,...events}:NativeSheetProps){
  const [present,setPresent]=useState(open),[retained,setRetained]=useState<ReactNode>(()=>children);
  const [element,setElement]=useState<HTMLDialogElement|null>(null);
  const latest=useRef({open,...events}),returned=useRef(false),opened=useRef(false),initialised=useRef(false);
  const dismissal=useRef<{event:KeyboardEvent|PointerEvent|null;nested:boolean}>({event:null,nested:false});
  if(open&&!present)setPresent(true);
  if(open&&retained!==children)setRetained(children);
  useLayoutEffect(()=>{latest.current={open,...events};});
  const returnFocus=useCallback(()=>{
    if(!opened.current||returned.current)return;
    returned.current=true;
    latest.current.onCloseAutoFocus?.(new Event('haru.closeAutoFocus',{cancelable:true}));
  },[]);
  useLayoutEffect(()=>()=>returnFocus(),[returnFocus]);
  // Run the caller after React removes the native modal from the top layer.
  // WebKit rejects background focus while an exiting dialog is still modal.
  useLayoutEffect(()=>{if(!open&&!present)returnFocus();},[open,present,returnFocus]);
  useLayoutEffect(()=>{
    if(open){opened.current=true;returned.current=false;initialised.current=false;return;}
    if(!present||!element)return;
    let active=true;
    const finish=()=>{if(active&&!latest.current.open){active=false;setPresent(false);}};
    const animations=element.getAnimations().filter(animation=>(animation.effect as KeyframeEffect|null)?.target===element);
    const timer=setTimeout(finish,Math.min(1000,Math.max(0,...animations.map(animation=>Number(animation.effect?.getComputedTiming().endTime)||0))+50));
    void Promise.allSettled(animations.map(animation=>animation.finished)).then(finish);
    return()=>{active=false;clearTimeout(timer);};
  },[open,present,element]);
  useLayoutEffect(()=>open&&element?registerNativeModal(element):undefined,[open,element]);
  useLayoutEffect(()=>{
    if(!open||!element||initialised.current)return;
    initialised.current=true;
    const event=new Event('haru.openAutoFocus',{cancelable:true});
    latest.current.onOpenAutoFocus?.(event);
    if(event.defaultPrevented)return;
    if(document.activeElement!==element&&document.activeElement!==document.body)return;
    const first=[...element.querySelectorAll<HTMLElement>('input,textarea,select,button,a[href],[tabindex]')].find(control=>control.tabIndex>=0&&control.getClientRects().length&&!control.matches(':disabled')&&!control.closest('[hidden],[inert]'));
    first?.focus({preventScroll:true});
  },[open,element]);
  useLayoutEffect(()=>element?installSheetSwipe(element,close,blocked,dirty):undefined,[element,close,blocked,dirty]);
  useLayoutEffect(()=>{
    if(!element)return;
    const key=(event:KeyboardEvent)=>{
      if(event.key!=='Escape'){dismissal.current={event:null,nested:false};return;}
      const nested=!!element.querySelector('.astryx-selector [role=combobox][aria-expanded=true],[data-slot=alert-dialog-content][data-state=open],[role=menu][data-state=open]');
      dismissal.current={event,nested};
      queueMicrotask(()=>{if(dismissal.current.event===event)dismissal.current={event:null,nested:false};});
    };
    const pointer=(event:PointerEvent)=>{dismissal.current={event:event.target===element?event:null,nested:false};};
    // The public native ref separates a close request from its preceding press.
    const nativeCancel=(event:Event)=>{if(event.target===element)dismissal.current={event:null,nested:!!element.querySelector('[role=alertdialog][data-state=open]')};};
    window.addEventListener('keydown',key,true);window.addEventListener('pointerdown',pointer,true);
    element.addEventListener('cancel',nativeCancel,true);
    return()=>{window.removeEventListener('keydown',key,true);window.removeEventListener('pointerdown',pointer,true);element.removeEventListener('cancel',nativeCancel,true);};
  },[element]);
  const requestClose=()=>{
    const cause=dismissal.current;
    dismissal.current={event:null,nested:false};
    if(cause.nested)return;
    if(cause.event instanceof KeyboardEvent){
      // Core already prevents the native cancel. The caller owns a separate veto.
      const event=new KeyboardEvent('keydown',{key:'Escape',code:cause.event.code,cancelable:true});
      latest.current.onEscapeKeyDown?.(event);if(event.defaultPrevented)return;
    }
    if(cause.event instanceof PointerEvent){
      // Legacy gutters live on the native root; a press inside them is content.
      const rect=element?.getBoundingClientRect(),{clientX:x,clientY:y}=cause.event;
      if(rect&&x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom)return;
      const event=new CustomEvent('haru.pointerDownOutside',{cancelable:true,detail:{originalEvent:cause.event}});
      latest.current.onPointerDownOutside?.(event);latest.current.onInteractOutside?.(event);
      if(event.defaultPrevented)return;
    }
    void close();
  };
  if(!present)return null;
  return <NativeDialog ref={setElement} isOpen={present} onOpenChange={value=>{if(!value)requestClose();}}
    purpose="info" padding={1} width="100%" maxHeight="none" role="dialog" tabIndex={-1}
    aria-labelledby={titleId} aria-describedby={descriptionId} data-slot="dialog-content" data-state={open?'open':'closed'} data-haru-native-sheet
    className={`sheet-dialog haru-native-sheet ${className}`}>
    <Stack direction="vertical" gap={4} padding={0} className="haru-sheet-frame">
      <Stack gap={0} padding={0} className="sheet-handle" data-sheet-handle data-disabled={disabled||undefined} aria-hidden="true"><span/></Stack>
      {open?children:retained}
      {showCloseButton&&<HaruIconButton label="닫기" icon={<HaruIcon name="x" size={16}/>} data-slot="dialog-close" className="haru-sheet-close" onClick={()=>{void close();}}/>}
    </Stack>
  </NativeDialog>;
}
